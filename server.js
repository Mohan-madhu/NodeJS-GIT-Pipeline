import express from 'express';
import { exec, execFile, spawn } from 'child_process';
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

const CONSOLE_AGENT_URL = process.env.CONSOLE_AGENT_URL?.replace(/\/$/, '');
const CONSOLE_AGENT_ID = process.env.CONSOLE_AGENT_ID;
const CONSOLE_AGENT_KEY = process.env.CONSOLE_AGENT_KEY;
const CONSOLE_EVENT_RELAY_ENABLED = Boolean(
  CONSOLE_AGENT_URL && CONSOLE_AGENT_ID && CONSOLE_AGENT_KEY
);
const MAX_QUEUED_EVENTS = 2000;

const deploymentStatus = new Map();
const deploymentLogs = new Map();
const deploymentClients = new Map();
const deploymentEventQueue = [];
const dynamicProjectsFile = process.env.DYNAMIC_PROJECTS_FILE || path.join(process.cwd(), 'dynamic-projects.json');
const dynamicProjects = new Map();

const deploymentContext = new AsyncLocalStorage();

let activeDeployments = 0;
let deploymentEventWorker = null;

function loadDynamicProjects() {
  try {
    const data = JSON.parse(fs.readFileSync(dynamicProjectsFile, 'utf8'));
    for (const [project, config] of Object.entries(data)) dynamicProjects.set(project, config);
  } catch { /* The registry is created on the first registration. */ }
}

function persistDynamicProjects() {
  const temporaryFile = `${dynamicProjectsFile}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(Object.fromEntries(dynamicProjects), null, 2));
  fs.renameSync(temporaryFile, dynamicProjectsFile);
}

function validProjectValue(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_.-]+$/.test(value) && value.length <= 200;
}

function validDynamicProject(config) {
  if (!config || !validProjectValue(config.projectKey)) return false;
  if (!['PM2', 'STATIC_FRONTEND'].includes(config.type)) return false;
  if (typeof config.repositoryUrl !== 'string' || !/^https:\/\/github\.com\/[^/]+\/[^/]+(?:\.git)?$/i.test(config.repositoryUrl)) return false;
  if (typeof config.branch !== 'string' || !/^[a-zA-Z0-9_./-]+$/.test(config.branch)) return false;
  if (typeof config.workingDirectory !== 'string' || !path.isAbsolute(config.workingDirectory)) return false;
  if (config.type === 'PM2' && (!validProjectValue(config.pm2ProcessName) || !validProjectValue(config.deploymentKey || config.projectKey))) return false;
  if (config.deployDirectory && (!path.isAbsolute(config.deployDirectory) || config.deployDirectory.includes('..'))) return false;
  return true;
}

function trustedConsoleRequest(req) {
  return CONSOLE_AGENT_ID && CONSOLE_AGENT_KEY &&
    req.headers['x-console-agent-id'] === CONSOLE_AGENT_ID &&
    req.headers['x-console-agent-key'] === CONSOLE_AGENT_KEY;
}

function dynamicDeployment(config) {
  const workDirectory = shellQuote(config.workingDirectory);
  const branch = shellQuote(config.branch);
  const processName = config.pm2ProcessName ? shellQuote(config.pm2ProcessName) : '';
  const outputDirectory = config.deployDirectory ? shellQuote(config.deployDirectory) : '';
  const command = [
    'set -Eeuo pipefail',
    `cd ${workDirectory}`,
    `git fetch origin ${branch}`,
    `git checkout ${branch}`,
    `git reset --hard origin/${branch}`,
    'npm install',
    'npm run build --if-present',
  ];
  if (config.type === 'PM2') {
    command.push(`pm2 restart ${processName} --update-env`);
  } else {
    if (!outputDirectory) throw new Error('deployDirectory is required for dynamic static services');
    command.push(`test -d dist && rsync -a --delete dist/ ${outputDirectory}/ || test -d build && rsync -a --delete build/ ${outputDirectory}/ || test -d out && rsync -a --delete out/ ${outputDirectory}/`);
  }
  return () => runCommand(command.join(' && '));
}

loadDynamicProjects();

function readGitRevision(workingDirectory) {
  if (!workingDirectory || !path.isAbsolute(workingDirectory)) return Promise.resolve({});
  return new Promise((resolve) => {
    execFile('git', ['-C', workingDirectory, 'log', '-1', '--pretty=format:%H%x00%s'], { timeout: 10000 }, (error, stdout) => {
      if (error) return resolve({});
      const [commitHash, commitMessage] = stdout.trim().split('\0');
      resolve({ commitHash, commitMessage });
    });
  });
}

/* -------------------- Helpers -------------------- */

function getCurrentProject() {
  return deploymentContext.getStore()?.project || null;
}

function getCurrentRunId() {
  return deploymentContext.getStore()?.runId || null;
}

function queueDeploymentEvent(event) {
  if (!CONSOLE_EVENT_RELAY_ENABLED) return;

  if (deploymentEventQueue.length >= MAX_QUEUED_EVENTS) {
    if (event.type === 'deployment-log') return;
    deploymentEventQueue.shift();
  }

  deploymentEventQueue.push(event);

  if (!deploymentEventWorker) {
    deploymentEventWorker = drainDeploymentEventQueue();
  }
}

async function drainDeploymentEventQueue() {
  try {
    while (deploymentEventQueue.length > 0) {
      const event = deploymentEventQueue.shift();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(`${CONSOLE_AGENT_URL}/console/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Console-Agent-Id': CONSOLE_AGENT_ID,
            'X-Console-Agent-Key': CONSOLE_AGENT_KEY,
          },
          body: JSON.stringify(event),
          signal: controller.signal,
        });

        if (!response.ok) {
          console.error(
            `[console-events] HTTP ${response.status} for ${event.type} ${event.projectKey}`
          );
          if (response.status >= 500 && (event.deliveryAttempts || 0) < 12) {
            const retryEvent = { ...event, deliveryAttempts: (event.deliveryAttempts || 0) + 1 };
            if (event.type === 'deployment-completed') deploymentEventQueue.unshift(retryEvent);
            else deploymentEventQueue.push(retryEvent);
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      } catch (error) {
        console.error(
          `[console-events] Delivery failed for ${event.type} ${event.projectKey}: ${error.message}`
        );
        if ((event.deliveryAttempts || 0) < 12) {
          const retryEvent = { ...event, deliveryAttempts: (event.deliveryAttempts || 0) + 1 };
          if (event.type === 'deployment-completed') deploymentEventQueue.unshift(retryEvent);
          else deploymentEventQueue.push(retryEvent);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } finally {
        clearTimeout(timeout);
      }
    }
  } finally {
    deploymentEventWorker = null;

    if (deploymentEventQueue.length > 0) {
      deploymentEventWorker = drainDeploymentEventQueue();
    }
  }
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

  return entry;
}

/* -------------------- Logging -------------------- */

function log(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;

  console.log(formattedMessage);

  const project = getCurrentProject();

  if (project) {
    const entry = appendProjectLog(project, message);

    queueDeploymentEvent({
      type: 'deployment-log',
      projectKey: project,
      runId: getCurrentRunId(),
      message,
      timestamp: entry.timestamp,
    });
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

function shellQuote(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

function repositoryFromCommand(command) {
  const match = String(command).match(/\bcd\s+(?:"([^"]+)"|'([^']+)'|([^\s;&]+))/);
  return match?.[1] || match?.[2] || match?.[3] || null;
}

function repositoryChangeState(workDirectory) {
  return new Promise((resolve) => {
    const probe = `
      set -e
      cd -- ${shellQuote(workDirectory)}
      git rev-parse --git-dir >/dev/null
      git fetch --prune origin >/dev/null 2>&1
      branch="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)"
      if [ -z "$branch" ]; then
        branch="$(git remote show origin 2>/dev/null | awk '/HEAD branch/ {print $NF}' || true)"
      fi
      if [ -z "$branch" ]; then
        branch="$(git for-each-ref --format='%(refname:strip=3)' refs/remotes/origin | grep -v '^HEAD$' | head -n 1)"
      fi
      branch="$(printf '%s' "$branch" | sed 's#^origin/##')"
      [ -n "$branch" ]
      local_commit="$(git rev-parse HEAD)"
      remote_commit="$(git rev-parse "origin/$branch")"
      if [ "$local_commit" = "$remote_commit" ]; then
        printf 'NO_CHANGES\\n'
        exit 0
      fi
      files="$(git diff --name-only "$local_commit" "$remote_commit")"
      if [ -n "$files" ] && ! printf '%s\\n' "$files" | grep -Ev '(^|/)(README([.]|$)|CHANGELOG([.]|$)|docs?/|[.]md$|[.]txt$)' | grep -q .; then
        printf 'DOCS_ONLY\\n'
      else
        printf 'CHANGED\\n'
      fi
    `;
    exec(probe, { shell: '/bin/bash', timeout: 30000 }, (error, stdout) => {
      if (error) return resolve({ state: 'UNKNOWN' });
      resolve({ state: stdout.trim().split(/\s+/)[0] || 'UNKNOWN' });
    });
  });
}

function isTruthyFlag(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'yes';
}

export async function runCommand(command, timeout = 900000) {
  const workDirectory = repositoryFromCommand(command);
  const forceDeployment = deploymentContext.getStore()?.force === true;
  if (workDirectory && !forceDeployment) {
    const decision = await repositoryChangeState(workDirectory);
    if (decision.state === 'NO_CHANGES' || decision.state === 'DOCS_ONLY') {
      log(
        decision.state === 'NO_CHANGES'
          ? `⏭️ Deployment skipped: no new commits for ${workDirectory}`
          : `⏭️ Deployment skipped: only documentation changes for ${workDirectory}`,
      );
      return true;
    }
  } else if (workDirectory && forceDeployment) {
    log(`⚡ Force deployment enabled; skipping change detection for ${workDirectory}`);
  }

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

async function executeDeployment(project, deployFunction, options = {}) {
  activeDeployments++;

  const runId = options.runId || `${project}-${Date.now()}`;
  const triggerSource = options.triggerSource || 'webhook';

  ensureProject(project);

  deploymentStatus.set(project, {
    project,
    runId,
    triggerSource,
    branch: options.branch,
    status: 'deploying',
    startTime: new Date(),
  });

  return deploymentContext.run({ project, runId, force: options.force === true }, async () => {
    queueDeploymentEvent({
      type: 'deployment-started',
      projectKey: project,
      runId,
      triggerSource,
      deployerEmail: options.deployerEmail,
      branch: options.branch,
      commitHash: options.commitHash,
      commitMessage: options.commitMessage,
      timestamp: new Date().toISOString(),
    });

    try {
      log(`🔄 Starting deployment for ${project}`);

      const success = await deployFunction();
      const failureReason = success ? undefined : 'Deployment command failed';
      const revision = await readGitRevision(options.workingDirectory);

      deploymentStatus.set(project, {
        project,
        runId,
        triggerSource,
        branch: options.branch,
        status: success ? 'success' : 'failed',
        completedTime: new Date(),
      });

      log(
        success
          ? `✅ Deploy complete for ${project}`
          : `❌ Deploy failed for ${project}`
      );

      queueDeploymentEvent({
        type: 'deployment-completed',
        projectKey: project,
        runId,
        status: success ? 'SUCCESS' : 'FAILED',
        failureReason,
        branch: options.branch,
        commitHash: revision.commitHash || options.commitHash,
        commitMessage: revision.commitMessage || options.commitMessage,
        timestamp: new Date().toISOString(),
      });

      return success;
    } catch (error) {
      deploymentStatus.set(project, {
        project,
        runId,
        triggerSource,
        branch: options.branch,
        status: 'error',
        error: error.message,
        completedTime: new Date(),
      });

      log(`❌ Deployment error for ${project}: ${error.message}`);

      queueDeploymentEvent({
        type: 'deployment-completed',
        projectKey: project,
        runId,
        status: 'ERROR',
        failureReason: error.message,
        branch: options.branch,
        timestamp: new Date().toISOString(),
      });

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

  // Keep the long-lived stream open while PM2 is quiet. Comment frames are
  // ignored by SSE clients but prevent reverse proxies from timing out.
  const heartbeat = setInterval(() => {
    if (!res.destroyed) res.write(': heartbeat\n\n');
  }, 15000);

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
  const historicalCount = { stdout: 0, stderr: 0 };

  const sendPm2Lines = (data, stream) => {
    data
      .toString()
      .split('\n')
      .filter((line) => line.trim())
      .forEach((line) => {
        const historical = historicalCount[stream] < lines;
        historicalCount[stream] += 1;
        sendSse(res, {
          type: 'pm2-log',
          target,
          stream,
          live: !historical,
          timestamp: historical ? undefined : new Date().toISOString(),
          message: line,
        });
      });
  };

  pm2Process.stdout.on('data', (data) => {
    sendPm2Lines(data, 'stdout');
  });

  pm2Process.stderr.on('data', (data) => {
    sendPm2Lines(data, 'stderr');
  });

  pm2Process.on('error', (error) => {
    sendSse(res, {
      type: 'error',
      message: error.message,
    });
  });

  req.on('close', () => {
    clearInterval(heartbeat);
    pm2Process.kill('SIGTERM');
  });
});

/* -------------------- Webhook -------------------- */

app.post('/projects/register', (req, res) => {
  if (!trustedConsoleRequest(req)) return res.status(401).json({ message: 'Console registration credentials required' });
  const config = {
    projectKey: req.body?.projectKey,
    type: req.body?.type,
    repositoryUrl: req.body?.repositoryUrl,
    branch: req.body?.branch || 'main',
    workingDirectory: req.body?.workingDirectory,
    deployDirectory: req.body?.deployDirectory || undefined,
    pm2ProcessName: req.body?.pm2ProcessName || undefined,
    deploymentKey: req.body?.deploymentKey || undefined,
  };
  if (!validDynamicProject(config)) return res.status(400).json({ message: 'Invalid dynamic project configuration' });
  dynamicProjects.set(config.projectKey, config);
  try {
    persistDynamicProjects();
  } catch (error) {
    dynamicProjects.delete(config.projectKey);
    return res.status(500).json({ message: 'Unable to persist dynamic project configuration', error: error.message });
  }
  res.status(201).json({ registered: true, projectKey: config.projectKey });
});

app.post('/webhook/:project', async (req, res) => {
  const project = req.params.project;
  const service = req.body?.service;
  const force = isTruthyFlag(req.query?.force) || isTruthyFlag(req.query?.hard) ||
    isTruthyFlag(req.body?.force) || isTruthyFlag(req.body?.hard);

  log(`📥 Webhook received for project: ${project}`);

  if (service?.projectKey && service.projectKey !== project) {
    return res.status(400).json({
      message: `Service project key ${service.projectKey} does not match URL project ${project}`,
    });
  }

  if (service?.enabled === false) {
    return res.status(409).json({
      message: `Service ${project} is disabled`,
    });
  }

  const dynamicProject = dynamicProjects.get(project);
  const deployFunction = deployments[project] ||
    (dynamicProject?.deploymentKey && deployments[dynamicProject.deploymentKey]) ||
    (dynamicProject ? dynamicDeployment(dynamicProject) : null);

  if (!deployFunction) {
    return res.status(400).json({
      message: `Unknown project: ${project}`,
      availableDeployments: Object.keys(deployments),
    });
  }

  const webhookPayload = typeof req.body?.payload === 'string'
    ? (() => {
      try { return JSON.parse(req.body.payload); } catch { return req.body; }
    })()
    : (req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : req.body);
  const commits = Array.isArray(webhookPayload?.commits) ? webhookPayload.commits : [];
  const headCommit = webhookPayload?.head_commit || webhookPayload?.commit || commits[commits.length - 1] || {};
  const githubBranch =
    typeof webhookPayload?.ref === 'string'
      ? webhookPayload.ref.replace(/^refs\/heads\//, '')
      : undefined;
  const deployerEmail =
    typeof req.body?.requestedBy === 'string' &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(req.body.requestedBy)
      ? req.body.requestedBy
      : undefined;
  const runId =
    typeof req.body?.runId === 'string' && req.body.runId.trim()
      ? req.body.runId.trim().slice(0, 200)
      : `${project}-${Date.now()}`;
  const triggerSource = req.body?.source === 'console' ? 'console' : 'webhook';
  const serviceBranch = typeof service?.branch === 'string' ? service.branch : undefined;
  const commitHash = [
    webhookPayload?.after,
    webhookPayload?.checkout_sha,
    headCommit.id,
    headCommit.sha,
    webhookPayload?.sha,
  ].find((value) => typeof value === 'string' && value.trim());
  const commitMessage = [
    headCommit.message,
    webhookPayload?.message,
  ].find((value) => typeof value === 'string' && value.trim());

  res.status(202).json({
    message: `Deployment initiated for ${project}`,
    status: 'processing',
    project,
    runId,
    activeDeployments,
  });

  executeDeployment(project, deployFunction, {
    runId,
    triggerSource,
    deployerEmail,
    branch: serviceBranch || githubBranch,
    commitHash,
    commitMessage,
    workingDirectory: service?.workingDirectory,
    force,
  }).catch((error) => {
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
  log(
    CONSOLE_EVENT_RELAY_ENABLED
      ? '🔗 HexTorq console event relay enabled'
      : '🔕 HexTorq console event relay disabled'
  );
});
