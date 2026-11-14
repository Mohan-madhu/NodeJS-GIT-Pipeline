// Deployment functions - separate file for easy management.
//
// `deployments.js` holds the real deployment commands for this control plane
// and is tracked in Git. This file is the template used when setting up a new
// server: copy the branch block below into `deployments.js` so every service
// can be deployed from its configured branch.
import { runCommand } from './server.js';

// Fetch and deploy the repository's configured default branch.
//
// DEPLOY_BRANCH is supplied by the pipeline for the branch selected in the
// console. When it is empty the repository's own default branch is used.
//
// The branch is fetched into its own tracking ref and checked out from that
// ref explicitly. A repository with a narrow fetch refspec (one that only
// tracks a single branch) makes a plain "git checkout <branch>" fail with
// "pathspec did not match any file(s) known to git", because git refuses to
// guess a remote branch that the configured refspec does not cover.
export const GIT_DEFAULT_BRANCH = `
    git fetch origin
    DEFAULT_BRANCH="\${DEPLOY_BRANCH:-}"
    if [ -z "$DEFAULT_BRANCH" ]; then
      DEFAULT_BRANCH="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)"
      DEFAULT_BRANCH="\${DEFAULT_BRANCH#origin/}"
      if [ -z "$DEFAULT_BRANCH" ]; then
        DEFAULT_BRANCH="$(git remote show origin 2>/dev/null | awk '/HEAD branch/ {print $NF}' || true)"
      fi
      if [ -z "$DEFAULT_BRANCH" ]; then
        DEFAULT_BRANCH="$(git for-each-ref --format='%(refname:strip=3)' refs/remotes/origin | grep -v '^HEAD$' | head -n 1)"
      fi
    fi
    if [ -z "$DEFAULT_BRANCH" ]; then
      echo "Unable to determine the deployment branch."
      exit 1
    fi
    echo "Deploying configured branch: $DEFAULT_BRANCH"
    git fetch origin "+refs/heads/\${DEFAULT_BRANCH}:refs/remotes/origin/\${DEFAULT_BRANCH}"
    git checkout -B "\${DEFAULT_BRANCH}" "refs/remotes/origin/\${DEFAULT_BRANCH}"
    git reset --hard "refs/remotes/origin/\${DEFAULT_BRANCH}"
`;

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

// Export all deployment functions
export const deployments = {
  janahanlaw,
  Example_Service,
};
