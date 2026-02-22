import express from 'express';
import { exec } from 'child_process';
import fs from 'fs';

const app = express();
app.use(express.json());     // Accept JSON bodies

const LOG_FILE = '/home/user/deploy.log';
const PORT = 3012;

function log(msg) {
  console.log(msg)
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
}

// function runCommand(command) {
//   return new Promise((resolve) => {
//     exec(command, (err, stdout, stderr) => {
//       fs.appendFileSync(LOG_FILE, stdout + stderr);
//       if (err) {
//         log(`❌ Error running: ${command}`);
//         return resolve(false);
//       }
//       resolve(true);
//     });
//   });
// }


function runCommand(command) {
  return new Promise((resolve) => {
    exec(command, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (stdout) fs.appendFileSync(LOG_FILE, `[STDOUT]\n${stdout}\n`);
      if (stderr) fs.appendFileSync(LOG_FILE, `[STDERR]\n${stderr}\n`);

      if (err) {
        log(`❌ Error running: ${command}`);
        log(`   ↳ Exit code: ${err.code}`);
        log(`   ↳ Error: ${err.message}`);
        return resolve(false);
      }

      log(`✅ Success: ${command}`);
      resolve(true);
    });
  });
}


// Sample for the static served files from the npm build

// async function reservation_dine_360() {
//   const WORK_DIR = '/home/user/web/reservation.dine360.ca/dine-360-reservation';
//   const PUBLIC_DIR = '/home/user/web/reservation.dine360.ca/public_html';

//   // here we tell git to rebase local commits on top of remote
//   const command = `
//     cd "${WORK_DIR}" && \
//      git reset --hard HEAD  && \
//     git pull --rebase && \
//     npm install && \
//     npm run build && \
//     rsync -a --delete "${WORK_DIR}/out/" "${PUBLIC_DIR}/"
//   `;
//   return await runCommand(command);
// }


// Sample for the next start and stop with pm2 and npm build

// async function janahanlaw() {
//   const WORK_DIR = '/home/user/web/janahanlaw.com/public_html/GIT/janahan-law';
//   const PUBLIC_DIR = '/home/user/web/reservation.dine360.ca/public_html';

//   // here we tell git to rebase local commits on top of remote
//   const command = `
//     cd "${WORK_DIR}" && \
//      sudo rm -rf .next && \
//     pm2 stop "Janahanlaw_Frontend" && \
//     git reset --hard HEAD  && \
//     git pull --rebase && \
    
//     npm install && \
//     npm run build && \
//     pm2 restart "Janahanlaw_Frontend"
    
//   `;
//   return await runCommand(command);
// }





/* ──────────────────────────────────────────
   HEALTH‑CHECK / HOME ENDPOINT
   ────────────────────────────────────────── */
app.get('/', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Pipeline server is running.' });
});

/* ──────────────────────────────────────────
   WEBHOOK ENDPOINT
   ────────────────────────────────────────── */

//http://82.25.95.117:3012/webhook/{project}
app.post('/webhook/:project', async (req, res) => {
  const project = req.params.project;

  let success = false;
  log(`📥 Webhook received for project: ${project}`);

  switch (project) {
    case 'janahanlaw':
      success = await janahanlaw();
      break;
    case 'reservation_dine_360':
      success = await reservation_dine_360();
      break;
    case 'quantfortune':
      success = await quantfortune();
      break;
    case 'quantfortune_backend':
      success = await quantfortune_backend();
      break;
    default:
      log(`⚠️ Unknown project: ${project}`);
      res.status(400).json({ message: 'Unknown project: ' + project });
      return;
  }


  res.status(200).json({ message: 'Deploying ' + project });


  switch (project) {
    case 'janahanlaw':
      success = await janahanlaw();
      break;
    case 'reservation_dine_360':
      success = await reservation_dine_360();
      break;
    case 'quantfortune':
      success = await quantfortune();
      break;
    case 'quantfortune_backend':
      success = await quantfortune_backend();
      break;
    default:
      log(`⚠️ Unknown project: ${project}`);
      res.status(400).json({ message: 'Unknown project: ' + project });
      return;
  }

  if (success) log(`✅ Deploy complete for ${project}`);
  else log(`❌ Deploy failed for ${project}`);
});


/* ────────────────────────────────────────── */
app.listen(PORT, () => {
  log(`🚀 Common Webhook listening on port ${PORT}`);
});
