// Deployment functions - separate file for easy management
import { runCommand } from './server.js';


// Fetch and deploy the repository's configured default branch. This avoids
// assuming every repository uses "main".
const GIT_DEFAULT_BRANCH = `
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
    # Fetch the branch into its own tracking ref and check out from that ref
    # explicitly. A repository with a narrow fetch refspec (one that only
    # tracks a single branch) makes a plain "git checkout <branch>" fail with
    # "pathspec did not match any file(s) known to git", because git refuses
    # to guess a remote branch that the configured refspec does not cover.
    git fetch origin "+refs/heads/\${DEFAULT_BRANCH}:refs/remotes/origin/\${DEFAULT_BRANCH}"
    git checkout -B "\${DEFAULT_BRANCH}" "refs/remotes/origin/\${DEFAULT_BRANCH}"
    git reset --hard "refs/remotes/origin/\${DEFAULT_BRANCH}"
`;

// async function HexTorq_Examinations_Web_Backend() {
//   const WORK_DIR = '/home/mohan/.config/htop/mohan/APPS/HexTorq-Examinations/HexTorq-Examinations-Web-Backend';
//   const SERVICE_NAME = 'HexTorq_Examinations_Web_Backend';
//   const RUN_AS_USER = 'prod';

//   const command = `
//     sudo -n -u ${RUN_AS_USER} -H bash -lc '
//       export NVM_DIR="$HOME/.nvm" &&
//       [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" &&
//       cd "${WORK_DIR}" &&
//       pm2 stop "${SERVICE_NAME}" || true &&
//       git reset --hard HEAD &&
//       git pull --rebase &&
//       source .venv/bin/activate &&
//       pip install -e . &&
//       set -a && . ./.env && set +a && pm2 restart "${SERVICE_NAME}" --update-env
//     '
//   `;

//   return await runCommand(command);
// }
async function HexTorq_Examinations_Web_Backend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/APPS/HexTorq-Examinations/HexTorq-Examinations-Web-Backend';
  const SERVICE_NAME = 'HexTorq_Examinations_Web_Backend';

  const command = ` cd "${WORK_DIR}" &&
                    pm2 stop "${SERVICE_NAME}" || true &&
                    git reset --hard HEAD &&
                    git pull --rebase &&
                    npm i &&
                    npx prisma migrate deploy &&
                    npx prisma generate &&
                    pm2 restart "${SERVICE_NAME}"
  `;

  return await runCommand(command);
}



async function Pay_Panda_Backend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/APPS/Pay-Panda/Pay-Panda-Backend';
  const SERVICE_NAME = 'Pay_Panda_Backend';

  const command = ` cd "${WORK_DIR}" &&
                    pm2 stop "${SERVICE_NAME}" || true &&
                    git reset --hard HEAD &&
                    git pull --rebase &&
                    npm i &&
                    npx prisma db push &&

                    npx prisma generate &&
                    pm2 restart "${SERVICE_NAME}"
  `;

  return await runCommand(command);
}



async function ADF_Backend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/APPS/ADF-Backend';
  const SERVICE_NAME = 'ADF_Backend';

  const command = ` cd "${WORK_DIR}" &&
                    pm2 stop "${SERVICE_NAME}" || true &&
                    git reset --hard HEAD &&
                    git pull --rebase &&
                    npm i &&
                    npm run build &&
                    npm run migrate &&
                    npm run seed:content &&
                    pm2 restart "${SERVICE_NAME}"
  `;

  return await runCommand(command);
}


async function HexTorq_Projects_Backend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/APPS/HexTorq-Projects-Backend';
  const SERVICE_NAME = 'HexTorq-Projects-Backend';

  const command = ` cd "${WORK_DIR}" &&
                    pm2 stop "${SERVICE_NAME}" || true &&
                    git reset --hard HEAD &&
                    git pull --rebase &&
                    npm ci  &&
                    npx prisma generate &&
                    npx prisma migrate deploy &&
                    pm2 restart "${SERVICE_NAME}"
  `;

  return await runCommand(command);
}



async function QA_Labs_Backend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/APPS/QA-Labs-Backend';
  const SERVICE_NAME = 'QA-Labs-Backend';

  const command = ` cd "${WORK_DIR}" &&
                    pm2 stop "${SERVICE_NAME}" || true &&
                    git reset --hard HEAD &&
                    git pull --rebase &&
                    npm ci  &&
                    npx prisma generate &&
                    npx prisma migrate deploy &&
                    pm2 restart "${SERVICE_NAME}"
  `;

  return await runCommand(command);
}


async function Print_Panda_Backend() {


  const WORK_DIR =
    '/home/mohan/.config/htop/mohan/APPS/Print-Panda-Backend';
  const SERVICE_NAME = 'Print-Panda_Backend';
  const BRANCH = 'main';

  const command = `
    set -e
pm2 stop "${SERVICE_NAME}" || true
    cd "${WORK_DIR}"

    git fetch origin "${BRANCH}"
    git reset --hard "origin/${BRANCH}"

    npm ci

    pm2 restart "${SERVICE_NAME}" 
  `;
  return runCommand(command);
}



async function HexTorq_Learn_Backend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/APPS/HexTorq-Learn-Backend';
  const SERVICE_NAME = 'HexTorq-Learn-Backend';

  const command = ` cd "${WORK_DIR}" &&
                    pm2 stop "${SERVICE_NAME}" || true &&
                    git reset --hard HEAD &&
                    git pull --rebase &&
                    npm ci &&
                    npx prisma generate &&
                    npx prisma db push &&
                    pm2 restart "${SERVICE_NAME}"
  `;

  return await runCommand(command);
}


async function Tnnalavariyam_Backend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/APPS/tnnalavariyam-backend';
  const SERVICE_NAME = 'Tnnalavariyam-Backend';

  const command = ` cd "${WORK_DIR}" &&
                    pm2 stop "${SERVICE_NAME}" || true &&
                    git reset --hard HEAD &&
                    git pull --rebase &&
                    npm ci &&
                    npx prisma generate &&
                    npx prisma db push &&
                    pm2 restart "${SERVICE_NAME}"
  `;

  return await runCommand(command);
}





async function Panda_Spot_Backend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/APPS/Panda-Spot/Panda-Spot-Backend';
  const SERVICE_NAME = 'Panda-Spot-Backend';

  const command = ` cd "${WORK_DIR}" &&
                    pm2 stop "${SERVICE_NAME}" || true &&
                    git reset --hard HEAD &&
                    git pull --rebase &&
                    npm ci &&
                    npx prisma generate &&
                    npx prisma db push &&
                    pm2 restart "${SERVICE_NAME}"
  `;

  return await runCommand(command);
}



async function Panda_Spot_Face_Engine() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/APPS/Panda-Spot/Panda-Spot-Face-Engine';
  const SERVICE_NAME = 'Panda-Spot-Face-Engine';

  const command = ` cd "${WORK_DIR}" &&
                    pm2 stop "${SERVICE_NAME}" || true &&
                    git reset --hard HEAD &&
                    git pull --rebase &&
                    .venv/bin/pip install -r requirements.txt &&
                    pm2 restart "${SERVICE_NAME}"
  `;

  return await runCommand(command);
}


async function HC_Backend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/APPS/HC-Backend';
  const SERVICE_NAME = 'HC-Backend';

  const command = ` cd "${WORK_DIR}" &&
                    pm2 stop "${SERVICE_NAME}" || true &&
                    git reset --hard HEAD &&
                    git pull --rebase &&
                    npm ci &&
                    npx prisma generate &&
                    npx prisma db push &&
                    pm2 restart "${SERVICE_NAME}"
  `;

  return await runCommand(command);
}










// ============================================================
// NEXYRA deployment functions
// ============================================================

async function NEXYRA_Energy_ML() {
  const WORK_DIR =
    '/home/mohan/.config/htop/mohan/HACKATHON/energy-ml-service';
  const SERVICE_NAME = 'nexyra-energy-ml';
  const PM2_CONFIG = '.pm2/energy-ml.config.cjs';
  const HEALTH_URL = 'http://127.0.0.1:19003/health';

  const command = `
    set -e

    cd "${WORK_DIR}"

    if [ -n "$(git status --porcelain)" ]; then
      echo "NEXYRA_Energy_ML deployment stopped: repository has uncommitted changes."
      git status --short
      exit 1
    fi

    git fetch origin main
    git checkout --detach origin/main

    pm2 stop "${SERVICE_NAME}" || true

    /usr/local/bin/uv python install 3.13

    if [ ! -x ".venv/bin/python" ]; then
      /usr/local/bin/uv venv \
        --python 3.13 \
        --seed \
        .venv
    fi

    /usr/local/bin/uv pip install \
      --python .venv/bin/python \
      -r requirements.txt

    .venv/bin/python -m pip check
    .venv/bin/python -m compileall -q app

    pm2 startOrReload "${PM2_CONFIG}" \
      --only "${SERVICE_NAME}" \
      --update-env

    pm2 save

    ok=0
    for i in $(seq 1 30); do
      if curl -fsS "${HEALTH_URL}" >/dev/null; then
        ok=1
        break
      fi
      sleep 1
    done

    if [ "$ok" -ne 1 ]; then
      echo "NEXYRA_Energy_ML health check failed."
      pm2 logs "${SERVICE_NAME}" --lines 100 --nostream
      exit 1
    fi

    echo "NEXYRA_Energy_ML deployment passed."
    curl -fsS "${HEALTH_URL}"
    echo
    git rev-parse HEAD
  `;

  return await runCommand(command);
}



async function NEXYRA_Auditor_Backend() {
  const WORK_DIR =
    '/home/mohan/.config/htop/mohan/HACKATHON/auditor-backend';
  const SERVICE_NAME = 'nexyra-auditor-backend';
  const PM2_CONFIG = '.pm2/auditor-backend.config.cjs';
  const DATABASE_PATH =
    '/home/mohan/.config/htop/mohan/HACKATHON/auditor-backend/data/auditor.sqlite';
  const HEALTH_URL = 'http://127.0.0.1:19002/api/v1/health';

  const command = `
    set -e

    cd "${WORK_DIR}"

    if [ -n "$(git status --porcelain)" ]; then
      echo "NEXYRA_Auditor_Backend deployment stopped: repository has uncommitted changes."
      git status --short
      exit 1
    fi

    git fetch origin main
    git checkout --detach origin/main

    export NVM_DIR="$HOME/.nvm"
    . "$NVM_DIR/nvm.sh"
    nvm use 24

    pm2 stop "${SERVICE_NAME}" || true

    npm ci
    npm run build

    DATABASE_PATH="${DATABASE_PATH}" npm run db:migrate

    pm2 startOrReload "${PM2_CONFIG}" \
      --only "${SERVICE_NAME}" \
      --update-env

    pm2 save

    ok=0
    for i in $(seq 1 30); do
      if curl -fsS "${HEALTH_URL}" >/dev/null; then
        ok=1
        break
      fi
      sleep 1
    done

    if [ "$ok" -ne 1 ]; then
      echo "NEXYRA_Auditor_Backend health check failed."
      pm2 logs "${SERVICE_NAME}" --lines 100 --nostream
      exit 1
    fi

    echo "NEXYRA_Auditor_Backend deployment passed."
    curl -fsS "${HEALTH_URL}"
    echo
    git rev-parse HEAD
  `;

  return await runCommand(command);
}



async function NEXYRA_Simulation_Backend() {
  const WORK_DIR =
    '/home/mohan/.config/htop/mohan/HACKATHON/simulation-backend';
  const SERVICE_NAME = 'nexyra-simulation-backend';
  const PM2_CONFIG = '.pm2/simulation-backend.config.cjs';
  const DATABASE_PATH =
    '/home/mohan/.config/htop/mohan/HACKATHON/simulation-backend/data/simulation.sqlite';
  const HEALTH_URL = 'http://127.0.0.1:19001/api/v1/health';

  const command = `
    set -e

    cd "${WORK_DIR}"

    if [ -n "$(git status --porcelain)" ]; then
      echo "NEXYRA_Simulation_Backend deployment stopped: repository has uncommitted changes."
      git status --short
      exit 1
    fi

    git fetch origin main
    git checkout --detach origin/main

    export NVM_DIR="$HOME/.nvm"
    . "$NVM_DIR/nvm.sh"
    nvm use 24

    pm2 stop "${SERVICE_NAME}" || true

    npm ci
    npm run build

    DATABASE_PATH="${DATABASE_PATH}" npm run db:migrate

    pm2 startOrReload "${PM2_CONFIG}" \
      --only "${SERVICE_NAME}" \
      --update-env

    pm2 save

    ok=0
    for i in $(seq 1 30); do
      if curl -fsS "${HEALTH_URL}" >/dev/null; then
        ok=1
        break
      fi
      sleep 1
    done

    if [ "$ok" -ne 1 ]; then
      echo "NEXYRA_Simulation_Backend health check failed."
      pm2 logs "${SERVICE_NAME}" --lines 100 --nostream
      exit 1
    fi

    echo "NEXYRA_Simulation_Backend deployment passed."
    curl -fsS "${HEALTH_URL}"
    echo
    git rev-parse HEAD
  `;

  return await runCommand(command);
}


async function Rathinam_CCTV_Backend() {
  const WORK_DIR =
    '/home/mohan/.config/htop/mohan/SERVER/cctv-be';

  const SERVICE_NAME = 'cctv-be';

  const command = `
    set -e
    umask 0002

    cd "${WORK_DIR}"

    ${GIT_DEFAULT_BRANCH}
    find . -maxdepth 1 -type f -name '.env*' -exec chmod 600 {} + 2>/dev/null || true

    if [ -x "venv/bin/python" ]; then
      PYTHON="$(pwd)/venv/bin/python"
      PIP="$(pwd)/venv/bin/pip"
    elif [ -x ".venv/bin/python" ]; then
      PYTHON="$(pwd)/.venv/bin/python"
      PIP="$(pwd)/.venv/bin/pip"
    else
      echo "Python virtual environment not found."
      exit 1
    fi

    "\${PIP}" install -r requirements.txt
    "\${PYTHON}" manage.py migrate --noinput
    "\${PYTHON}" manage.py collectstatic --noinput

    pm2 restart "${SERVICE_NAME}" --update-env
    pm2 save

    echo "Rathinam CCTV backend deployment completed."
    pm2 status
  `;

  return await runCommand(command);
}


async function Rathinam_CCTV_Frontend() {
  const WORK_DIR =
    '/home/mohan/.config/htop/mohan/SERVER/cctv-fe';

  const DEPLOY_DIR = '/usr/share/nginx/html/cctv';

  const command = `
    set -e
    umask 0002

    cd "${WORK_DIR}"

    ${GIT_DEFAULT_BRANCH}
    find . -maxdepth 1 -type f -name '.env*' -exec chmod 600 {} + 2>/dev/null || true

    npm ci
    npm run build

    sudo mkdir -p "${DEPLOY_DIR}"
    sudo rm -rf "${DEPLOY_DIR}"/*
    sudo cp -r dist/. "${DEPLOY_DIR}/"

    sudo chown -R www-data:www-data "${DEPLOY_DIR}"

    sudo nginx -t
    sudo systemctl reload nginx

    echo "Rathinam CCTV frontend deployment completed."

  `;

  return await runCommand(command);
}



async function HexTorq_Cloud_Console_Backend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/APPS/HexTorq-Cloud-Console-Backend';
  const SERVICE_NAME = 'HexTorq-Cloud-Console-Backend';

  const command = ` cd "${WORK_DIR}" &&
                    pm2 stop "${SERVICE_NAME}" || true &&
                    git reset --hard HEAD &&
                    git pull --rebase &&
                    npm i &&
                    npx prisma migrate deploy &&
                    npx prisma generate &&
                    set -a && . ./.env && set +a && pm2 restart "${SERVICE_NAME}" --update-env
  `;

  return await runCommand(command);
}

async function RGU_Fleet_Management_Backend_Linux() {
  const WORK_DIR =
    '/home/mohan/.config/htop/mohan/APPS/RGU-Fleet-Management/RGU-Fleet-Management-Backend-Linux';

  const command = `
    set -Eeuo pipefail
    cd "${WORK_DIR}"
    ${GIT_DEFAULT_BRANCH}

    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1

    docker compose -p rgu-fleet-v3 \\
      --env-file .env \\
      -f deploy/compose.yaml \\
      -f .local/limits.yaml \\
      build --pull=false api

    docker compose -p rgu-fleet-v3 \\
      --env-file .env \\
      -f deploy/compose.yaml \\
      -f .local/limits.yaml \\
      up -d --no-deps api

    for attempt in $(seq 1 30); do
      STATUS=$(docker inspect --format '{{.State.Health.Status}}' rgu-fleet-v3-api-1 2>/dev/null || true)
      if [ "$STATUS" = "healthy" ]; then
        curl --fail --silent --show-error http://127.0.0.1:21001/api/health
        echo
        echo "RGU Fleet Linux backend deployment completed."
        exit 0
      fi
      if [ "$STATUS" = "unhealthy" ]; then
        docker logs --tail 120 rgu-fleet-v3-api-1
        exit 1
      fi
      sleep 2
    done

    docker logs --tail 120 rgu-fleet-v3-api-1
    echo "RGU Fleet API did not become healthy within 60 seconds."
    exit 1
  `;

  return await runCommand(command);
}


async function Rathinam_AI_Bot_Backend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/SERVER/ai-bot-be';
  const SERVICE_NAME = 'ai-bot-be';
  const MOCK_SERVICE_NAME = 'ai-bot-mock';
  const command = `
    set -Eeuo pipefail
    umask 0002
    cd "${WORK_DIR}"
    ${GIT_DEFAULT_BRANCH}
    if [ ! -x "venv/bin/python" ]; then python3 -m venv venv; fi
    venv/bin/pip install -r requirements.txt
    venv/bin/pip install gunicorn python-multipart
    venv/bin/python -m compileall -q .
    if pm2 describe "${MOCK_SERVICE_NAME}" >/dev/null 2>&1; then
      pm2 restart "${MOCK_SERVICE_NAME}" --update-env
    else
      pm2 start "$(pwd)/venv/bin/python" --name "${MOCK_SERVICE_NAME}" --cwd "$(pwd)" --interpreter none -- mock_server.py
    fi
    if pm2 describe "${SERVICE_NAME}" >/dev/null 2>&1; then
      pm2 restart "${SERVICE_NAME}" --update-env
    else
      pm2 start "$(pwd)/venv/bin/gunicorn" --name "${SERVICE_NAME}" --cwd "$(pwd)" --interpreter none -- -k uvicorn.workers.UvicornWorker -w 2 -b 127.0.0.1:30007 main:app
    fi
    pm2 save
    echo "AI Bot backend and mock services deployment completed."
    pm2 status
  `;
  return await runCommand(command);
}

async function Rathinam_AI_Bot_Mock() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/SERVER/ai-bot-be';
  const SERVICE_NAME = 'ai-bot-mock';
  const command = `
    set -Eeuo pipefail
    umask 0002
    cd "${WORK_DIR}"
    ${GIT_DEFAULT_BRANCH}
    if [ ! -x "venv/bin/python" ]; then python3 -m venv venv; fi
    venv/bin/pip install -r requirements.txt
    venv/bin/pip install python-multipart
    venv/bin/python -m compileall -q .
    if pm2 describe "${SERVICE_NAME}" >/dev/null 2>&1; then
      pm2 restart "${SERVICE_NAME}" --update-env
    else
      pm2 start "$(pwd)/venv/bin/python" --name "${SERVICE_NAME}" --cwd "$(pwd)" --interpreter none -- mock_server.py
    fi
    pm2 save
    echo "AI Bot mock service deployment completed."
    pm2 status
  `;
  return await runCommand(command);
}

async function Rathinam_AI_Bot_Frontend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/SERVER/ai-bot-fe';
  const TARGET_DIR = '/home/mohan/.config/htop/mohan/SERVER/ai-bot-be/frontend';
  const command = `
    set -Eeuo pipefail
    umask 0002
    cd "${WORK_DIR}"
    ${GIT_DEFAULT_BRANCH}
    if [ -d "${TARGET_DIR}/.git" ]; then
      find "${TARGET_DIR}/.git" -type d -exec chmod u+rwx {} +
      find "${TARGET_DIR}/.git" -type f -exec chmod u+rw {} +
    fi
    rm -rf "${TARGET_DIR}"
    mkdir -p "${TARGET_DIR}"
    cp -r ./* "${TARGET_DIR}/"
    python3 - "${TARGET_DIR}/index.html" "${TARGET_DIR}/js/app.js" <<'PY'
from pathlib import Path
import sys
html_path, js_path = map(Path, sys.argv[1:])
html = html_path.read_text()
html = html.replace('href="/static/css/style.css"', 'href="/ai-bot/static/css/style.css"')
html = html.replace('src="/static/js/app.js"', 'src="/ai-bot/static/js/app.js?v=2"')
js_path.write_text('const API_BASE = \"/ai-bot\";\\n' + js_path.read_text().replace('fetch(\"/', 'fetch(API_BASE + \"/').replace('fetch(' + chr(96) + '/', 'fetch(API_BASE + ' + chr(96) + '/'))
PY
    chown -R mohan:mohan "${TARGET_DIR}"
    sudo nginx -t
    sudo systemctl reload nginx
    echo "AI Bot frontend deployment completed."
  `;
  return await runCommand(command);
}

// Export all deployment functions
export const deployments = {
  Rathinam_AI_Bot_Mock,
  Rathinam_AI_Bot_Backend,
  Rathinam_AI_Bot_Frontend,
  HexTorq_Examinations_Web_Backend, //https://git-pipeline.metatronhost.in/git/webhook/HexTorq_Examinations_Web_Backend
  Pay_Panda_Backend,                 //https://git-pipeline.metatronhost.in/git/webhook/Pay_Panda_Backend
  ADF_Backend,                  //https://git-pipeline.metatronhost.in/git/webhook/ADF_Backend
  HexTorq_Projects_Backend,          //https://git-pipeline.metatronhost.in/git/webhook/HexTorq_Projects_Backend
  QA_Labs_Backend,                   //https://git-pipeline.metatronhost.in/git/webhook/QA_Labs_Backend
  Print_Panda_Backend,               //https://git-pipeline.metatronhost.in/git/webhook/Print_Panda_Backend
  HexTorq_Learn_Backend,             //https://git-pipeline.metatronhost.in/git/webhook/HexTorq_Learn_Backend
  Tnnalavariyam_Backend,              //https://git-pipeline.metatronhost.in/git/webhook/Tnnalavariyam_Backend
  Panda_Spot_Backend,                 //https://git-pipeline.metatronhost.in/git/webhook/Panda_Spot_Backend
  Panda_Spot_Face_Engine,              //https://git-pipeline.metatronhost.in/git/webhook/Panda_Spot_Face_Engine
  HC_Backend,                 //https://git-pipeline.metatronhost.in/git/webhook/HC_Backend
  HexTorq_Cloud_Console_Backend, //https://git-pipeline.metatronhost.in/git/webhook/HexTorq_Cloud_Console_Backend
  RGU_Fleet_Management_Backend_Linux, //https://git-pipeline.metatronhost.in/git/webhook/RGU_Fleet_Management_Backend_Linux


  Rathinam_CCTV_Backend,              //https://git-pipeline.metatronhost.in/git/webhook/Rathinam_CCTV_Backend
  Rathinam_CCTV_Frontend,             //https://git-pipeline.metatronhost.in/git/webhook/Rathinam_CCTV_Frontend



  // NEXYRA_Energy_ML, //https://git-pipeline.metatronhost.in/git/webhook/NEXYRA_Energy_ML

  // NEXYRA_Auditor_Backend, //https://git-pipeline.metatronhost.in/git/webhook/NEXYRA_Auditor_Backend

  // NEXYRA_Simulation_Backend, //https://git-pipeline.metatronhost.in/git/webhook/NEXYRA_Simulation_Backend
};

async function Rathinam_Water_Tracker_Backend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/SERVER/water-be';
  const SERVICE_NAME = 'water-be';

  const command = `
    set -e
    umask 0002
    cd "${WORK_DIR}"
    ${GIT_DEFAULT_BRANCH}
    find . -maxdepth 1 -type f -name '.env*' -exec chmod 600 {} + 2>/dev/null || true
    venv/bin/pip install -r requirements.txt
    venv/bin/pip install python-dotenv
    venv/bin/python manage.py migrate --noinput
    venv/bin/python manage.py collectstatic --noinput
    pm2 restart "${SERVICE_NAME}" --update-env
    pm2 save
    echo "Water Tracker backend deployment completed."
  `;

  return await runCommand(command);
}

async function Rathinam_Water_Tracker_Frontend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/SERVER/water-fe';
  const DEPLOY_DIR = '/usr/share/nginx/html/water_tracker';

  const command = `
    set -e
    umask 0002
    cd "${WORK_DIR}"
    ${GIT_DEFAULT_BRANCH}
    find . -maxdepth 1 -type f -name '.env*' -exec chmod 600 {} + 2>/dev/null || true
    npm ci
    VITE_API_URL=/water_tracker/api/ npm run build
    sudo mkdir -p "${DEPLOY_DIR}"
    sudo rm -rf "${DEPLOY_DIR}"/*
    sudo cp -r dist/. "${DEPLOY_DIR}/"
    sudo chown -R www-data:www-data "${DEPLOY_DIR}"
    sudo nginx -t
    sudo systemctl reload nginx
    echo "Water Tracker frontend deployment completed."
  `;

  return await runCommand(command);
}

deployments.Rathinam_Water_Tracker_Backend = Rathinam_Water_Tracker_Backend;
deployments.Rathinam_Water_Tracker_Frontend = Rathinam_Water_Tracker_Frontend;

async function Rathinam_Power_Tracker_Backend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/SERVER/power-be';
  const SERVICE_NAME = 'power-be';
  const command = `
    set -e
    umask 0002
    cd "${WORK_DIR}"
    if [ -f .env ]; then eval "$(/home/mohan/.config/htop/mohan/MANAGEMENT/NodeJS-GIT-Pipeline/load-dotenv.sh .env)"; fi
    ${GIT_DEFAULT_BRANCH}
    find . -maxdepth 1 -type f -name '.env*' -exec chmod 600 {} + 2>/dev/null || true
    DB_NAME="$(awk -F= '$1=="DB_NAME" {print $2}' .env)"
    DB_USER="$(awk -F= '$1=="DB_USER" {print $2}' .env)"
    sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" <<SQL
GRANT USAGE ON SCHEMA public TO "$DB_USER";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "$DB_USER";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "$DB_USER";
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO "$DB_USER";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO "$DB_USER";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO "$DB_USER";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO "$DB_USER";
SQL
    venv/bin/pip install -r requirements.txt
    venv/bin/python manage.py migrate --noinput
    pm2 restart "${SERVICE_NAME}" --update-env
    pm2 save
    echo "Power Tracker backend deployment completed."
  `;
  return await runCommand(command);
}

async function Rathinam_Power_Tracker_Frontend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/SERVER/power-fe';
  const DEPLOY_DIR = '/usr/share/nginx/html/powertracker';
  const command = `
    set -e
    umask 0002
    cd "${WORK_DIR}"
    ${GIT_DEFAULT_BRANCH}
    find . -maxdepth 1 -type f -name '.env*' -exec chmod 600 {} + 2>/dev/null || true
    npm ci
    VITE_API_URL=/powertracker/api npm run build
    sudo mkdir -p "${DEPLOY_DIR}"
    sudo rm -rf "${DEPLOY_DIR}"/*
    sudo cp -r dist/. "${DEPLOY_DIR}/"
    sudo chown -R www-data:www-data "${DEPLOY_DIR}"
    sudo nginx -t
    sudo systemctl reload nginx
    echo "Power Tracker frontend deployment completed."
  `;
  return await runCommand(command);
}

deployments.Rathinam_Power_Tracker_Backend = Rathinam_Power_Tracker_Backend;
deployments.Rathinam_Power_Tracker_Frontend = Rathinam_Power_Tracker_Frontend;

async function Rathinam_Maintenance_Backend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/SERVER/maintenance-be';
  const SERVICE_NAME = 'maintenance-be';
  const command = `
    set -e
    umask 0002
    cd "${WORK_DIR}"
    if [ -f .env ]; then eval "$(/home/mohan/.config/htop/mohan/MANAGEMENT/NodeJS-GIT-Pipeline/load-dotenv.sh .env)"; fi
    ${GIT_DEFAULT_BRANCH}
    find . -maxdepth 1 -type f -name '.env*' -exec chmod 600 {} + 2>/dev/null || true
    venv/bin/pip install -r requirements.txt
    venv/bin/pip install gunicorn
    venv/bin/python manage.py migrate --noinput
    pm2 restart "${SERVICE_NAME}" --update-env
    pm2 save
    echo "Maintenance backend deployment completed."
  `;
  return await runCommand(command);
}

async function Rathinam_Maintenance_Frontend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/SERVER/maintenance-fe';
  const DEPLOY_DIR = '/usr/share/nginx/html/maintenance';
  const command = `
    set -e
    umask 0002
    cd "${WORK_DIR}"
    ${GIT_DEFAULT_BRANCH}
    find . -maxdepth 1 -type f -name '.env*' -exec chmod 600 {} + 2>/dev/null || true
    npm install
    npm run build
    sudo mkdir -p "${DEPLOY_DIR}"
    sudo rm -rf "${DEPLOY_DIR}"/*
    sudo cp -r dist/. "${DEPLOY_DIR}/"
    sudo chown -R www-data:www-data "${DEPLOY_DIR}"
    sudo nginx -t
    sudo systemctl reload nginx
    echo "Maintenance frontend deployment completed."
  `;
  return await runCommand(command);
}

deployments.Rathinam_Maintenance_Backend = Rathinam_Maintenance_Backend;
deployments.Rathinam_Maintenance_Frontend = Rathinam_Maintenance_Frontend;

async function Rathinam_Transport_Backend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/SERVER/transport-be';
  const SERVICE_NAME = 'transport-be';
  const command = `
    set -e
    umask 0002
    cd "${WORK_DIR}"
    if [ -f .env ]; then eval "$(/home/mohan/.config/htop/mohan/MANAGEMENT/NodeJS-GIT-Pipeline/load-dotenv.sh .env)"; fi
    ${GIT_DEFAULT_BRANCH}
    find . -maxdepth 1 -type f -name '.env*' -exec chmod 600 {} + 2>/dev/null || true
    venv/bin/pip install -r requirements.txt
    venv/bin/python manage.py migrate --noinput
    venv/bin/python manage.py collectstatic --noinput
    pm2 restart "${SERVICE_NAME}" --update-env
    pm2 save
    echo "Transport backend deployment completed."
  `;
  return await runCommand(command);
}

async function Rathinam_Transport_Frontend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/SERVER/transport-fe';
  const DEPLOY_DIR = '/usr/share/nginx/html/transport';
  const command = `
    set -e
    umask 0002
    cd "${WORK_DIR}"
    ${GIT_DEFAULT_BRANCH}
    find . -maxdepth 1 -type f -name '.env*' -exec chmod 600 {} + 2>/dev/null || true
    npm install
    npm run build
    sudo mkdir -p "${DEPLOY_DIR}"
    sudo rm -rf "${DEPLOY_DIR}"/*
    sudo cp -r dist/. "${DEPLOY_DIR}/"
    sudo chown -R www-data:www-data "${DEPLOY_DIR}"
    sudo nginx -t
    sudo systemctl reload nginx
    echo "Transport frontend deployment completed."
  `;
  return await runCommand(command);
}

deployments.Rathinam_Transport_Backend = Rathinam_Transport_Backend;
deployments.Rathinam_Transport_Frontend = Rathinam_Transport_Frontend;

async function Rathinam_Food_Tracker_Backend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/SERVER/food-be';
  const SERVICE_NAME = 'food-be';
  const command = `
    set -e
    umask 0002
    cd "${WORK_DIR}"
    if [ -f .env ]; then eval "$(/home/mohan/.config/htop/mohan/MANAGEMENT/NodeJS-GIT-Pipeline/load-dotenv.sh .env)"; fi
    if [ -f .env.vps ]; then eval "$(/home/mohan/.config/htop/mohan/MANAGEMENT/NodeJS-GIT-Pipeline/load-dotenv.sh .env.vps)"; fi
    ${GIT_DEFAULT_BRANCH}
    find . -maxdepth 1 -type f -name '.env*' -exec chmod 600 {} + 2>/dev/null || true
    venv/bin/pip install -r requirements.txt
    venv/bin/python manage.py migrate --noinput
    pm2 restart "${SERVICE_NAME}" --update-env
    pm2 save
    echo "Food Tracker backend deployment completed."
  `;
  return await runCommand(command);
}

async function Rathinam_Food_Tracker_Frontend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/SERVER/food-fe';
  const DEPLOY_DIR = '/usr/share/nginx/html/food_tracker';
  const command = `
    set -e
    umask 0002
    cd "${WORK_DIR}"
    ${GIT_DEFAULT_BRANCH}
    find . -maxdepth 1 -type f -name '.env*' -exec chmod 600 {} + 2>/dev/null || true
    npm install
    npm run build
    sudo mkdir -p "${DEPLOY_DIR}"
    sudo rm -rf "${DEPLOY_DIR}"/*
    sudo cp -r dist/. "${DEPLOY_DIR}/"
    sudo chown -R www-data:www-data "${DEPLOY_DIR}"
    sudo nginx -t
    sudo systemctl reload nginx
    echo "Food Tracker frontend deployment completed."
  `;
  return await runCommand(command);
}

deployments.Rathinam_Food_Tracker_Backend = Rathinam_Food_Tracker_Backend;
deployments.Rathinam_Food_Tracker_Frontend = Rathinam_Food_Tracker_Frontend;

async function Rathinam_Reports_Backend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/SERVER/report-m-be';
  const SERVICE_NAME = 'reports-be';
  const command = `
    set -Eeuo pipefail
    umask 0002
    cd "${WORK_DIR}"
    ${GIT_DEFAULT_BRANCH}
    find . -maxdepth 1 -type f -name '.env*' -exec chmod 600 {} + 2>/dev/null || true
    venv/bin/pip install -r requirements.txt
    venv/bin/pip install bcrypt python-multipart
    pm2 restart "${SERVICE_NAME}" --update-env
    pm2 save
    echo "Reports FastAPI backend deployment completed."
  `;
  return await runCommand(command);
}

deployments.Rathinam_Reports_Backend = Rathinam_Reports_Backend;

async function Rathinam_Reports_Frontend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/SERVER/report-m-fe';
  const DEPLOY_DIR = '/usr/share/nginx/html/Report';
  const command = `
    set -Eeuo pipefail
    umask 0002
    cd "${WORK_DIR}"
    ${GIT_DEFAULT_BRANCH}
    npm ci
    npm run build
    sudo mkdir -p "${DEPLOY_DIR}"
    sudo rm -rf "${DEPLOY_DIR}"/*
    sudo cp -r dist/. "${DEPLOY_DIR}/"
    sudo chown -R www-data:www-data "${DEPLOY_DIR}"
    sudo nginx -t
    sudo systemctl reload nginx
    echo "Reports frontend deployment completed."
  `;
  return await runCommand(command);
}

deployments.Rathinam_Reports_Frontend = Rathinam_Reports_Frontend;

async function Rathinam_RGU_Portal_UI() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/SERVER/portal-ui';
  const DEPLOY_DIR = '/usr/share/nginx/html/rgu';
  const command = `
    set -e
    umask 0002
    cd "${WORK_DIR}"
    ${GIT_DEFAULT_BRANCH}
    find . -maxdepth 1 -type f -name '.env*' -exec chmod 600 {} + 2>/dev/null || true
    sudo mkdir -p "${DEPLOY_DIR}"
    sudo rm -rf "${DEPLOY_DIR}"/*
    sudo cp -r ./. "${DEPLOY_DIR}/"
    sudo chown -R www-data:www-data "${DEPLOY_DIR}"
    sudo nginx -t
    sudo systemctl reload nginx
    echo "RGU Portal deployment completed."
  `;
  return await runCommand(command);
}

deployments.Rathinam_RGU_Portal_UI = Rathinam_RGU_Portal_UI;

async function Rathinam_Nextup_Backend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/SERVER/nextup-be';
  const SERVICE_NAME = 'nextup-be';
  const command = `
    set -e
    umask 0002
    cd "${WORK_DIR}"
    ${GIT_DEFAULT_BRANCH}
    find . -maxdepth 1 -type f -name '.env*' -exec chmod 600 {} + 2>/dev/null || true
    venv/bin/pip install -r requirements.txt
    venv/bin/python manage.py migrate --noinput
    pm2 restart "${SERVICE_NAME}" --update-env
    pm2 save
    echo "Nextup backend deployment completed."
  `;
  return await runCommand(command);
}

deployments.Rathinam_Nextup_Backend = Rathinam_Nextup_Backend;

async function Rathinam_Nextup_Frontend() {
  const WORK_DIR = '/home/mohan/.config/htop/mohan/SERVER/nextup-fe';
  const DEPLOY_DIR = '/usr/share/nginx/html/nextup';
  const command = `
    set -e
    umask 0002
    cd "${WORK_DIR}"
    ${GIT_DEFAULT_BRANCH}
    find . -maxdepth 1 -type f -name '.env*' -exec chmod 600 {} + 2>/dev/null || true
    npm ci
    npm run build
    sudo mkdir -p "${DEPLOY_DIR}"
    sudo rm -rf "${DEPLOY_DIR}"/*
    sudo cp -r dist/. "${DEPLOY_DIR}/"
    sudo chown -R www-data:www-data "${DEPLOY_DIR}"
    sudo nginx -t
    sudo systemctl reload nginx
    echo "Nextup frontend deployment completed."
  `;
  return await runCommand(command);
}

deployments.Rathinam_Nextup_Frontend = Rathinam_Nextup_Frontend;


// ============================================================
// HexTorq control-plane services
// ============================================================

async function HexTorq_Pipeline_Agent() {
  const WORK_DIR =
    '/home/mohan/.config/htop/mohan/MANAGEMENT/HexTorq-Cloud-Console-Pipeline-Agent';
  const SERVICE_NAME = 'HexTorq-Pipeline-Agent';
  const HEALTH_URL = 'http://127.0.0.1:9100/health';

  const command = `
    set -Eeuo pipefail

    cd "${WORK_DIR}"

    # The working tree may still carry operator patches (for example a
    # hand-written console heartbeat). Upstream now ships its own heartbeat,
    # so tracked files are reset to the committed state before pulling.
    git reset --hard HEAD

    git fetch origin main
    git checkout main
    git reset --hard origin/main

    npm ci

    set -a && . ./.env && set +a
    pm2 restart "${SERVICE_NAME}" --update-env
    pm2 save

    ok=0
    for i in $(seq 1 20); do
      if curl -fsS "${HEALTH_URL}" >/dev/null; then
        ok=1
        break
      fi
      sleep 1
    done

    if [ "$ok" -ne 1 ]; then
      echo "HexTorq_Pipeline_Agent health check failed."
      pm2 logs "${SERVICE_NAME}" --lines 60 --nostream
      exit 1
    fi

    echo "HexTorq Pipeline Agent deployment completed."
    curl -fsS "${HEALTH_URL}"
    echo
    git rev-parse HEAD
  `;

  return await runCommand(command);
}

deployments.HexTorq_Pipeline_Agent = HexTorq_Pipeline_Agent;
