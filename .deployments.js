// Deployment functions - TEMPLATE for a new server.
//
// Copy this file to `deployments.js` on the server and edit it there.
// `deployments.js` is deliberately NOT tracked in Git: several servers run the
// same shared branch, and each one has its own paths, PM2 process names and
// service list. Pushing one server's copy would overwrite another's on the
// next `git pull`.
//
// The reusable building blocks are tracked, so import them from here:
//   - GIT_DEFAULT_BRANCH : resolve and check out the configured branch
//   - loadEnv             : export a .env file into the deploy shell
//   - DOTENV_HELPER       : absolute path of the tracked dotenv helper
import { GIT_DEFAULT_BRANCH, loadEnv } from './branch.js';
import { runCommand } from './server.js';

// Janahanlaw Frontend Deployment
async function janahanlaw() {
  const WORK_DIR = process.env.JANAHANLAW_DIR || '/home/user/web/janahanlaw.com/public_html/GIT/janahan-law';
  const SERVICE_NAME = process.env.JANAHANLAW_SERVICE || 'Janahanlaw_Frontend';

  const command = `
    cd "${WORK_DIR}" && \
    sudo rm -rf .next && \
    pm2 stop "${SERVICE_NAME}" && \
    git reset --hard HEAD && \
    git pull --rebase && \
    npm install && \
    npm run build && \
    pm2 restart "${SERVICE_NAME}"
  `;

  return await runCommand(command);
}

// Example service that follows the branch selected in the console.
async function Example_Service() {
  const WORK_DIR = '/home/user/SERVER/example-service';
  const SERVICE_NAME = 'example-service';

  const command = `
    set -e
    cd "${WORK_DIR}"
    ${GIT_DEFAULT_BRANCH}
    npm ci
    pm2 restart "${SERVICE_NAME}" --update-env
    pm2 save
    echo "Example service deployment completed."
  `;

  return await runCommand(command);
}

// Example service that needs a .env file exported before it builds.
async function Example_Service_With_Env() {
  const WORK_DIR = '/home/user/SERVER/example-service';
  const SERVICE_NAME = 'example-service';

  const command = `
    set -e
    cd "${WORK_DIR}"
    if [ -f .env ]; then ${loadEnv('.env')}; fi
    if [ -f .env.vps ]; then ${loadEnv('.env.vps')}; fi
    ${GIT_DEFAULT_BRANCH}
    npm ci
    pm2 restart "${SERVICE_NAME}" --update-env
    pm2 save
    echo "Example service deployment completed."
  `;

  return await runCommand(command);
}

// Export all deployment functions
export const deployments = {
  janahanlaw,
  Example_Service,
  Example_Service_With_Env,
};
