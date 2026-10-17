import express from 'express';
import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { AsyncLocalStorage } from 'async_hooks';
import { deployments } from './deployments.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const LOG_FILE = process.env.LOG_FILE || 'git_pipeline_deploy.log';
const PORT = process.env.PORT || 9000;
const MAX_CONCURRENT_DEPLOYS = 3;
const MAX_PROJECT_LOG_LINES = 5000;

const deploymentStatus = new Map();
const deploymentLogs = new Map();
const deploymentClients = new Map();

const deploymentContext = new AsyncLocalStorage();

let activeDeployments = 0;

/* -------------------- Helpers -------------------- */

function getCurrentProject() {
  return deploymentContext.getStore()?.project || null;
}

function ensureProject(project) {
  if (!deploymentLogs.has(project)) {
    deploymentLogs.set(project, []);
  }

  if (!deploymentClients.has(project)) {
    deploymentClients.set(project, new Set());
  }
}

function sendSse(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function parsePositiveNumber(value, fallback, max) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(number), max);
}

/*
  Supported values:

  30m = last 30 minutes
  1h  = last 1 hour
  6h  = last 6 hours
  24h = last 24 hours
  7d  = last 7 days
  all = no time filtering
*/
function parseTimeWindow(value) {
  if (!value || value === 'all') {
    return null;
  }

  const match = String(value)
    .trim()
    .toLowerCase()
    .match(/^(\d+)(m|h|d)$/);

  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2];

  let milliseconds;

  if (unit === 'm') {
    milliseconds = amount * 60 * 1000;
  } else if (unit === 'h') {
    milliseconds = amount * 60 * 60 * 1000;
  } else {
    milliseconds = amount * 24 * 60 * 60 * 1000;
  }

  return Date.now() - milliseconds;
}

function getTimeFromQuery(req) {
  return req.query.time || req.query.since || req.query.range || 'all';
}

function filterLogs(logs, req) {
  const requestedLines = parsePositiveNumber(
    req.query.lines || req.query.limit,
    500,
    MAX_PROJECT_LOG_LINES
  );

  const timeValue = getTimeFromQuery(req);
  const fromTime = parseTimeWindow(timeValue);

  if (timeValue !== 'all' && fromTime === null) {
    return {
      error: 'Invalid time value. Use values like 30m, 1h, 6h, 24h, or 7d.',
    };
  }

  let filteredLogs = logs;

  if (fromTime !== null) {
    filteredLogs = filteredLogs.filter((entry) => {
      return new Date(entry.timestamp).getTime() >= fromTime;
    });
  }

  return {
    logs: filteredLogs.slice(-requestedLines),
    lines: requestedLines,
    time: timeValue,
  };
}

function appendProjectLog(project, message) {
  if (!project) return;

  ensureProject(project);

  const entry = {
    timestamp: new Date().toISOString(),
    message,
  };

  const logs = deploymentLogs.get(project);

  logs.push(entry);

  if (logs.length > MAX_PROJECT_LOG_LINES) {
    logs.splice(0, logs.length - MAX_PROJECT_LOG_LINES);
  }

  const clients = deploymentClients.get(project);

  for (const client of clients) {
    try {
      sendSse(client, entry);
    } catch {
      clients.delete(client);
    }
  }
}

/* -------------------- Logging -------------------- */

function log(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;

  console.log(formattedMessage);

  const project = getCurrentProject();

  if (project) {
    appendProjectLog(project, message);
  }

  const logDirectory = path.dirname(LOG_FILE);

  if (!fs.existsSync(logDirectory)) {
    try {
      fs.mkdirSync(logDirectory, { recursive: true });
    } catch (error) {
      console.error('Cannot create log directory:', error.message);
    }
  }

  try {
    fs.appendFileSync(LOG_FILE, `${formattedMessage}\n`);
  } catch (error) {
    console.error('Cannot write log file:', error.message);
  }
}

/* -------------------- Command Runner -------------------- */

export function runCommand(command, timeout = 900000) {
  return new Promise((resolve) => {
    let resolved = false;

    const process = exec(
      command,
      {
        maxBuffer: 10 * 1024 * 1024,
        shell: '/bin/bash',
      },
      (error) => {
        if (resolved) return;

        resolved = true;

        if (error) {
          log('❌ Error running command');
          log(`   ↳ Exit code: ${error.code}`);
          log(`   ↳ Message: ${error.message}`);

          return resolve(false);
        }

        log('✅ Command succeeded');
        resolve(true);
      }
    );

    process.stdout?.on('data', (data) => {
      data
        .toString()
        .split('\n')
        .filter((line) => line.trim())
        .forEach((line) => {
          log(`   [OUTPUT] ${line}`);
        });
    });

    process.stderr?.on('data', (data) => {
      data
        .toString()
        .split('\n')
        .filter((line) => line.trim())
        .forEach((line) => {
          log(`   [OUTPUT] ${line}`);
        });
    });

    const timeoutHandle = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        process.kill('SIGTERM');

        log(`⏱️ Command timed out after ${timeout}ms`);
        resolve(false);
      }
    }, timeout);

    process.on('close', () => {
      clearTimeout(timeoutHandle);
    });
  });
}

/* -------------------- Deployment Runner -------------------- */

async function executeDeployment(project, deployFunction) {
  activeDeployments++;

  const runId = `${project}-${Date.now()}`;

  ensureProject(project);

  deploymentStatus.set(project, {
    project,
    runId,
    status: 'deploying',
    startTime: new Date(),
  });

  return deploymentContext.run({ project }, async () => {
    try {
      log(`🔄 Starting deployment for ${project}`);

      const success = await deployFunction();

      deploymentStatus.set(project, {
        project,
        runId,
        status: success ? 'success' : 'failed',
        completedTime: new Date(),
      });

      log(
        success
          ? `✅ Deploy complete for ${project}`
          : `❌ Deploy failed for ${project}`
      );

      return success;
    } catch (error) {
      deploymentStatus.set(project, {
        project,
        runId,
        status: 'error',
        error: error.message,
        completedTime: new Date(),
      });

      log(`❌ Deployment error for ${project}: ${error.message}`);

      return false;
    } finally {
      activeDeployments--;
    }
  });
}

/* -------------------- Basic API -------------------- */

app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Git Pipeline server is running.',
    activeDeployments,
    maxConcurrentDeployments: MAX_CONCURRENT_DEPLOYS,
    deployments: Object.keys(deployments),
  });
});

app.get('/status', (req, res) => {
  res.json({
    activeDeployments,
    maxConcurrentDeployments: MAX_CONCURRENT_DEPLOYS,
    deployments: Object.fromEntries(deploymentStatus),
  });
});

app.get('/status/:project', (req, res) => {
  const project = req.params.project;
  const status = deploymentStatus.get(project);

  if (!status) {
    return res.status(404).json({
      message: `No deployment history found for ${project}`,
    });
  }

  res.json(status);
});

/* -------------------- Deployment Logs -------------------- */

/*
  Recent logs.

  Examples:

  /logs/Rathinam_CCTV_Backend?lines=100
  /logs/Rathinam_CCTV_Backend?time=1h
  /logs/Rathinam_CCTV_Backend?lines=100&time=6h
  /logs/Rathinam_CCTV_Backend?lines=500&time=24h
*/
app.get('/logs/:project', (req, res) => {
  const project = req.params.project;

  ensureProject(project);

  const logs = deploymentLogs.get(project) || [];
  const result = filterLogs(logs, req);

  if (result.error) {
    return res.status(400).json({
      message: result.error,
    });
  }

  res.json({
    project,
    lines: result.lines,
    time: result.time,
    count: result.logs.length,
    logs: result.logs,
  });
});

/*
  Live deployment log stream.

  Examples:

  /logs/Rathinam_CCTV_Backend/stream
  /logs/Rathinam_CCTV_Backend/stream?lines=100
  /logs/Rathinam_CCTV_Backend/stream?lines=100&time=1h
*/
app.get('/logs/:project/stream', (req, res) => {
  const project = req.params.project;

  ensureProject(project);

  const logs = deploymentLogs.get(project) || [];
  const result = filterLogs(logs, req);

  if (result.error) {
    return res.status(400).json({
      message: result.error,
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (res.flushHeaders) {
    res.flushHeaders();
  }

  sendSse(res, {
    type: 'connected',
    project,
    lines: result.lines,
    time: result.time,
    status: deploymentStatus.get(project) || null,
  });

  result.logs.forEach((entry) => {
    sendSse(res, entry);
  });

  const clients = deploymentClients.get(project);
  clients.add(res);

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
});

/* -------------------- PM2 Live Logs -------------------- */

/*
  Examples:

  /pm2/logs/R-CCTV-BE/stream
  /pm2/logs/R-CCTV-BE/stream?lines=100
  /pm2/logs/21/stream?lines=200
*/
app.get('/pm2/logs/:target/stream', (req, res) => {
  const target = req.params.target;

  const lines = parsePositiveNumber(
    req.query.lines,
    100,
    1000
  );

  if (!/^[a-zA-Z0-9_.-]+$/.test(target)) {
    return res.status(400).json({
      message: 'Invalid PM2 process name or ID',
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (res.flushHeaders) {
    res.flushHeaders();
  }

  sendSse(res, {
    type: 'connected',
    target,
    lines,
  });

  const pm2Process = spawn(
    'pm2',
    ['logs', target, '--lines', String(lines), '--raw'],
    {
      shell: false,
    }
  );

  pm2Process.stdout.on('data', (data) => {
    data
      .toString()
      .split('\n')
      .filter((line) => line.trim())
      .forEach((line) => {
        sendSse(res, {
          type: 'pm2-log',
          target,
          stream: 'stdout',
          timestamp: new Date().toISOString(),
          message: line,
        });
      });
  });

  pm2Process.stderr.on('data', (data) => {
    data
      .toString()
      .split('\n')
      .filter((line) => line.trim())
      .forEach((line) => {
        sendSse(res, {
          type: 'pm2-log',
          target,
          stream: 'stderr',
          timestamp: new Date().toISOString(),
          message: line,
        });
      });
  });

  pm2Process.on('error', (error) => {
    sendSse(res, {
      type: 'error',
      message: error.message,
    });
  });

  req.on('close', () => {
    pm2Process.kill('SIGTERM');
  });
});

/* -------------------- Webhook -------------------- */

app.post('/webhook/:project', async (req, res) => {
  const project = req.params.project;

  log(`📥 Webhook received for project: ${project}`);

  const deployFunction = deployments[project];

  if (!deployFunction) {
    return res.status(400).json({
      message: `Unknown project: ${project}`,
      availableDeployments: Object.keys(deployments),
    });
  }

  res.status(202).json({
    message: `Deployment initiated for ${project}`,
    status: 'processing',
    activeDeployments,
  });

  executeDeployment(project, deployFunction).catch((error) => {
    log(`💥 Unhandled deployment error: ${error.message}`);
  });
});

/* -------------------- Graceful Shutdown -------------------- */

process.on('SIGTERM', () => {
  log('🛑 SIGTERM received');

  if (activeDeployments === 0) {
    process.exit(0);
  }

  log(`⏳ Waiting for ${activeDeployments} deployment(s)`);

  const interval = setInterval(() => {
    if (activeDeployments === 0) {
      clearInterval(interval);
      log('✅ All deployments completed');
      process.exit(0);
    }
  }, 1000);
});

/* -------------------- Start Server -------------------- */

app.listen(PORT, () => {
  log(`🚀 Git Pipeline server listening on port ${PORT}`);
  log(`📝 Logs written to: ${LOG_FILE}`);
  log(`⚙️ Max concurrent deployments: ${MAX_CONCURRENT_DEPLOYS}`);
});
