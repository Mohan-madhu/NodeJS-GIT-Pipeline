// Deployment functions - separate file for easy management
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

// Export all deployment functions
export const deployments = {
  janahanlaw
};
