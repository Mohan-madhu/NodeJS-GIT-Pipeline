# NodeJS-GIT-Pipeline
[![Ask DeepWiki](https://devin.ai/assets/askdeepwiki.png)](https://deepwiki.com/Mohan-madhu/NodeJS-GIT-Pipeline)

This repository provides a lightweight and straightforward Node.js Express server designed to function as a webhook receiver for automating deployment pipelines. When a webhook is triggered (e.g., by a `git push`), this server executes a predefined set of shell commands to pull the latest changes, install dependencies, build the project, and restart services as needed.

## Features

*   **Webhook-driven Deployments**: Automate your deployment process by listening for POST requests from Git providers like GitHub.
*   **Multi-Project Support**: Easily configure deployment scripts for multiple projects within a single server instance.
*   **Customizable Scripts**: Define unique shell command sequences for each project's deployment needs (e.g., `git pull`, `npm install`, `npm run build`, `pm2 restart`, `rsync`).
*   **Comprehensive Logging**: All deployment actions, including `stdout` and `stderr` from commands, are logged to a file for easy debugging.
*   **Health Check Endpoint**: A simple `GET /` endpoint to verify that the pipeline server is running.

## Prerequisites

*   [Node.js](https://nodejs.org/) (v14.x or later recommended)
*   `npm` or `yarn`
*   A server environment where required command-line tools like `git` are installed. For specific deployment scripts, you may also need tools like `pm2` or `rsync`.

## Installation

1.  Clone the repository to your server:
    ```bash
    git clone https://github.com/mohan-madhu/nodejs-git-pipeline.git
    cd nodejs-git-pipeline
    ```

2.  Install the dependencies:
    ```bash
    npm install
    ```

## Configuration

All configuration is done within the `server.js` file.

### 1. Set Constants

Adjust the `LOG_FILE` path and `PORT` number at the top of `server.js` to fit your environment.

```javascript
const LOG_FILE = '/home/user/git_pipeline_deploy.log'; // Ensure this path is writable
const PORT = 7777;
```

### 2. Define a Deployment Function

For each project you want to automate, create an `async` function that defines the sequence of shell commands to be executed. The server includes commented-out examples you can use as a template.

Here is a generic example for a project that needs to be built and its static files synced:

```javascript
async function my_project_deploy() {
  const WORK_DIR = '/home/user/sites/my-project'; // Path to the Git repository on your server

  // Define the sequence of commands
  const command = `
    cd "${WORK_DIR}" && \
    git reset --hard HEAD && \
    git pull --rebase && \
    npm install && \
    npm run build && \
    rsync -a --delete "${WORK_dir}/dist/" "/var/www/my-project/"
  `;
  return await runCommand(command);
}
```

### 3. Add Project to Webhook Handler

Add a `case` for your new project inside the `switch` statement within the `/webhook/:project` endpoint. The `case` value should match the project name you will use in the webhook URL.

```javascript
// http://IP_ADDRESS:7777/webhook/{project}
app.post('/webhook/:project', async (req, res) => {
  const project = req.params.project;

  let success = false;
  log(`📥 Webhook received for project: ${project}`);

  // Send an immediate response to the webhook provider
  res.status(200).json({ message: 'Deploying ' + project });

  // Execute deployment script based on project name
  switch (project) {
    case 'my_project_name': // This name will be in the webhook URL
      success = await my_project_deploy();
      break;
    // Add other projects here
    // case 'another-project':
    //   success = await another_project_deploy();
    //   break;
    default:
      log(`⚠️ Unknown project: ${project}`);
      return; // Exit early for unknown projects
  }

  if (success) {
    log(`✅ Deploy complete for ${project}`);
  } else {
    log(`❌ Deploy failed for ${project}`);
  }
});
```

## Running the Server

You can run the server directly with Node.

```bash
node server.js
```

For production use, it is highly recommended to use a process manager like **PM2** to ensure the server restarts on failure and runs in the background.

```bash
# Install PM2 globally (if not already installed)
npm install pm2 -g

# Start the server with PM2
pm2 start server.js --name "git-pipeline"

# To monitor logs
pm2 logs git-pipeline
```

## Webhook Setup (GitHub Example)

1.  Navigate to your GitHub repository's **Settings** > **Webhooks**.
2.  Click **Add webhook**.
3.  **Payload URL**: Enter the URL to your server and endpoint, e.g., `http://YOUR_SERVER_IP:7777/webhook/my_project_name`.
4.  **Content type**: Select `application/json`.
5.  **Secret**: This script does not handle a webhook secret, so you can leave it blank.
6.  **Which events would you like to trigger this webhook?**: Select **"Just the push event."**
7.  Ensure **Active** is checked and click **Add webhook**.

Now, whenever you `git push` to your repository, GitHub will send a request to your server, triggering the corresponding deployment script.

## API Endpoints

| Method | Endpoint                    | Description                                                            |
| :----- | :-------------------------- | :--------------------------------------------------------------------- |
| `GET`  | `/`                         | Health check endpoint. Returns a status message if the server is alive. |
| `POST` | `/webhook/:project`         | Triggers the deployment script for the specified `:project`.           |