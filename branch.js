// Shared building blocks for per-server deployment commands.
//
// This module is tracked in Git because every server deploys services the same
// way. Anything that differs per server (absolute paths, PM2 process names,
// which services exist) belongs in that server's own `deployments.js`, which is
// deliberately not tracked - several servers run this same branch, so one
// server's configuration must never overwrite another's.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the tracked dotenv helper, resolved next to this file. */
export const DOTENV_HELPER = path.join(here, 'load-dotenv.sh');

/**
 * Fetch and deploy the repository's configured branch.
 *
 * DEPLOY_BRANCH is supplied by the pipeline for the branch selected in the
 * console. When it is empty the repository's own default branch is used.
 *
 * The branch is fetched into its own tracking ref and checked out from that
 * ref explicitly. A repository with a narrow fetch refspec (one that only
 * tracks a single branch) makes a plain "git checkout <branch>" fail with
 * "pathspec did not match any file(s) known to git", because git refuses to
 * guess a remote branch that the configured refspec does not cover.
 */
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

/**
 * Load a .env file into the current shell as exported variables.
 *
 * Uses the tracked load-dotenv.sh helper so the quoting is handled the same
 * way on every server.
 */
export function loadEnv(envPath) {
  return `eval "$(sh ${DOTENV_HELPER} ${envPath})"`;
}
