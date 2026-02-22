import express from 'express';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { deployments } from './deployments.js';

const app = express();
app.use(express.json());     // Accept JSON bodies

const LOG_FILE = process.env.LOG_FILE || '/home/user/git_pipeline_deploy.log';
const PORT = process.env.PORT || 7777;
const MAX_CONCURRENT_DEPLOYS = 3;

// Track active deployments
const deploymentStatus = new Map();
let activeDeployments = 0;

function log(msg) {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] ${msg}`;
  console.log(logMsg);
  
  // Ensure log directory exists
  const logDir = path.dirname(LOG_FILE);
  if (!fs.existsSync(logDir)) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch (e) {
      console.error('Cannot create log directory:', e);
      return;
    }
  }
  
  try {
    fs.appendFileSync(LOG_FILE, `${logMsg}\n`);
  } catch (e) {
    console.error('Cannot write to log file:', e);
  }
}

export function runCommand(command, timeout = 900000) {  // 15 minute default timeout
  return new Promise((resolve) => {
    let isResolved = false;
    
    const proc = exec(command, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (isResolved) return;
      isResolved = true;
      
      if (err) {
        log(`❌ Error running command`);
        log(`   ↳ Exit code: ${err.code}`);
        log(`   ↳ Message: ${err.message}`);
        return resolve(false);
      }

      log(`✅ Command succeeded`);
      resolve(true);
    });
    
    // Capture stdout in real-time
    if (proc.stdout) {
      proc.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        lines.forEach(line => {
          log(`   [OUTPUT] ${line}`);
        });
      });
    }
    
    // Capture stderr in real-time
    if (proc.stderr) {
      proc.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        lines.forEach(line => {
          log(`   [ERROR] ${line}`);
        });
      });
    }
    
    // Timeout handler
    const timeoutHandle = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        proc.kill();
        log(`⏱️ Command timed out after ${timeout}ms`);
        resolve(false);
      }
    }, timeout);
    
    proc.on('close', () => clearTimeout(timeoutHandle));
  });
}


// Sample for the static served files from the npm build - TEMPLATE
// async function reservation_dine_360() {
//   const WORK_DIR = process.env.RESERVATION_DIR || '/home/user/web/reservation.dine360.ca/dine-360-reservation';
//   const PUBLIC_DIR = process.env.RESERVATION_PUBLIC || '/home/user/web/reservation.dine360.ca/public_html';
//
//   const command = `
//     cd "${WORK_DIR}" && \
//     git reset --hard HEAD && \
//     git pull --rebase && \
//     npm install && \
//     npm run build && \
//     rsync -a --delete "${WORK_DIR}/out/" "${PUBLIC_DIR}/"
//   `;
//   return await runCommand(command);
// }


// Deployment wrapper with concurrency control and status tracking
async function executeDeployment(project, deployFunc) {
  if (activeDeployments >= MAX_CONCURRENT_DEPLOYS) {
    log(`⏳ Deployment queued for ${project} (${activeDeployments}/${MAX_CONCURRENT_DEPLOYS} active)`);
  }
  
  activeDeployments++;
  deploymentStatus.set(project, { status: 'deploying', startTime: new Date() });
  
  try {
    log(`🔄 Starting deployment for ${project}`);
    const success = await deployFunc();
    
    if (success) {
      deploymentStatus.set(project, { status: 'success', completedTime: new Date() });
      log(`✅ Deploy complete for ${project}`);
    } else {
      deploymentStatus.set(project, { status: 'failed', completedTime: new Date() });
      log(`❌ Deploy failed for ${project}`);
    }
    
    return success;
  } catch (error) {
    deploymentStatus.set(project, { status: 'error', error: error.message, completedTime: new Date() });
    log(`❌ Deployment error for ${project}: ${error.message}`);
    return false;
  } finally {
    activeDeployments--;
  }
}

// Deployment functions moved to deployments.js





/* ────────────────────────────────────────── */
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Git Pipeline server is running.',
    activeDeployments,
    maxConcurrent: MAX_CONCURRENT_DEPLOYS
  });
});

/* ────────────────────────────────────────── */
// Deployment status endpoint
app.get('/status/:project', (req, res) => {
  const project = req.params.project;
  const status = deploymentStatus.get(project);
  
  if (!status) {
    return res.status(404).json({ message: 'No deployment history for project: ' + project });
  }
  
  res.status(200).json(status);
});

/* ────────────────────────────────────────── */
// All deployments status
app.get('/status', (req, res) => {
  res.status(200).json({ 
    activeDeployments,
    maxConcurrent: MAX_CONCURRENT_DEPLOYS,
    recentDeployments: Object.fromEntries(deploymentStatus)
  });
});

/* ────────────────────────────────────────── */
// Webhook endpoint - FIXED: removed duplicate switch statement
app.post('/webhook/:project', async (req, res) => {
  const project = req.params.project;
  
  log(`📥 Webhook received for project: ${project}`);
  
  // Validate project exists
  const deployFunc = deployments[project];
  if (!deployFunc) {
    log(`⚠️ Unknown project: ${project}`);
    return res.status(400).json({ message: 'Unknown project: ' + project });
  }

  // Send immediate response to webhook provider
  res.status(202).json({ 
    message: 'Deployment initiated for ' + project,
    activeDeployments,
    status: 'processing'
  });

  // Execute deployment asynchronously in background
  executeDeployment(project, deployFunc).catch(err => {
    log(`💥 Unhandled error in deployment: ${err.message}`);
  });
});

/* ──────────────────────────────────────────
   GRACEFUL SHUTDOWN
   ────────────────────────────────────────── */
process.on('SIGTERM', () => {
  log('🛑 SIGTERM received, shutting down gracefully...');
  if (activeDeployments === 0) {
    process.exit(0);
  } else {
    log(`⏳ Waiting for ${activeDeployments} deployment(s) to complete...`);
    const checkInterval = setInterval(() => {
      if (activeDeployments === 0) {
        clearInterval(checkInterval);
        log('✅ All deployments complete, exiting.');
        process.exit(0);
      }
    }, 1000);
  }
});

/* ────────────────────────────────────────── */
app.listen(PORT, () => {
  log(`🚀 Git Pipeline server listening on port ${PORT}`);
  log(`📝 Logs written to: ${LOG_FILE}`);
  log(`⚙️  Max concurrent deployments: ${MAX_CONCURRENT_DEPLOYS}`);
});
