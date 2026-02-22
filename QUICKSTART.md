# Quick Reference Guide

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (optional)
cp .env.example .env
# Edit .env with your paths

# 3. Start server
npm start

# 4. Test server
curl http://localhost:7777/

# 5. Trigger deployment
curl -X POST http://localhost:7777/webhook/janahanlaw
```

---

## Common Commands

### View Server Status
```bash
curl http://localhost:7777/
```

### Check Active Deployments
```bash
curl http://localhost:7777/status
```

### Check Project Status
```bash
curl http://localhost:7777/status/janahanlaw
```

### Trigger Deployment
```bash
curl -X POST http://localhost:7777/webhook/janahanlaw
```

### View Server Logs
```bash
# Real-time logs
tail -f /home/user/git_pipeline_deploy.log

# Last 50 lines
tail -50 /home/user/git_pipeline_deploy.log

# Search for errors
grep "❌" /home/user/git_pipeline_deploy.log
```

---

## PM2 Commands

### Start Server
```bash
pm2 start server.js --name "git-pipeline"
```

### Status
```bash
pm2 status
pm2 list
```

### Logs
```bash
pm2 logs git-pipeline
pm2 logs git-pipeline --tail 50
```

### Stop/Restart/Reload
```bash
pm2 stop git-pipeline
pm2 restart git-pipeline
pm2 reload git-pipeline  # Graceful reload
```

### Auto-start on Boot
```bash
pm2 startup
pm2 save
```

### Remove from Auto-start
```bash
pm2 unstartup
```

---

## Environment Variables

### Set on Command Line
```bash
PORT=8080 LOG_FILE=/var/log/deploy.log npm start
```

### Using .env File
```bash
# Copy template
cp .env.example .env

# Edit with your values
nano .env

# Start (automatically loads .env)
npm start
```

### Available Variables
- `PORT` - Server port (default: 7777)
- `LOG_FILE` - Log file path
- `JANAHANLAW_DIR` - Project working directory
- `JANAHANLAW_SERVICE` - PM2 service name

---

## Adding a New Project

### 1. Create Deployment Function
```javascript
async function my_project() {
  const WORK_DIR = process.env.MY_PROJECT_DIR || '/path/to/project';
  const command = `
    cd "${WORK_DIR}" && \
    git reset --hard HEAD && \
    git pull --rebase && \
    npm install && \
    npm run build
  `;
  return await runCommand(command);
}
```

### 2. Add to Webhook Switch
```javascript
case 'my_project':
  deployFunc = my_project;
  break;
```

### 3. Configure Environment
```bash
# In .env or via export
export MY_PROJECT_DIR=/path/to/project
```

### 4. Trigger from Webhook
```
POST http://localhost:7777/webhook/my_project
```

---

## Troubleshooting

### Server Won't Start
```bash
# Check if port is in use
lsof -i :7777

# Kill process using port
kill -9 <PID>

# Try different port
PORT=8080 npm start
```

### Permission Denied
```bash
# Fix log directory permissions
mkdir -p /home/user
chmod 755 /home/user
touch /home/user/git_pipeline_deploy.log
chmod 666 /home/user/git_pipeline_deploy.log
```

### Webhook Not Triggering
```bash
# Check server is running
curl http://localhost:7777/

# Check logs for webhook receipt
tail -f /home/user/git_pipeline_deploy.log

# Verify project name matches webhook URL
```

### Git Command Not Found
```bash
sudo apt install git
which git
```

### npm Not Available
```bash
node --version
npm --version
sudo apt install nodejs npm
```

---

## Log Rotation

### Manual Setup with logrotate
```bash
# Create config
sudo tee /etc/logrotate.d/git-pipeline << EOF
/home/user/git_pipeline_deploy.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
}
EOF

# Test
sudo logrotate -f /etc/logrotate.d/git-pipeline
```

---

## Security Tips

### Firewall Rules (Ubuntu)
```bash
# Allow only GitHub webhooks
sudo ufw allow from 140.82.112.0/20 to any port 7777

# Or restrict to specific IP
sudo ufw allow from 192.168.1.100 to any port 7777
```

### Enable HTTPS
Use nginx reverse proxy with Let's Encrypt:
```bash
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot certonly --nginx -d deploy.example.com
```

---

## Performance Tuning

### Increase Concurrent Deployments
In `server.js`:
```javascript
const MAX_CONCURRENT_DEPLOYS = 5;  // Default is 3
```

### Increase Command Timeout
```javascript
return await runCommand(command, 600000);  // 10 minutes (was 5)
```

### Increase Buffer Size
```javascript
const proc = exec(command, { maxBuffer: 50 * 1024 * 1024 }, ...
```

---

## Useful References

- **Documentation**: [README.md](README.md)
- **Features**: [FEATURES.md](FEATURES.md)
- **Deployment**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **GitHub**: https://github.com/mohan-madhu/nodejs-git-pipeline

---

## HTTP Status Codes

| Code | Meaning | Scenario |
|------|---------|----------|
| 200 | OK | Health check successful |
| 202 | Accepted | Webhook accepted, deployment queued |
| 400 | Bad Request | Unknown project name |
| 404 | Not Found | No deployment history for project |

---

## Response Format

### Health Check (GET /)
```json
{
  "status": "OK",
  "message": "Git Pipeline server is running.",
  "activeDeployments": 1,
  "maxConcurrent": 3
}
```

### Webhook Trigger (POST /webhook/:project)
```json
{
  "message": "Deployment initiated for janahanlaw",
  "activeDeployments": 1,
  "status": "processing"
}
```

### Status (GET /status/:project)
```json
{
  "status": "success",
  "startTime": "2026-02-22T10:15:30.123Z",
  "completedTime": "2026-02-22T10:18:45.456Z"
}
```

---

## Need Help?

1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for your issue
2. Review [DEPLOYMENT.md](DEPLOYMENT.md) for setup help
3. Check logs: `tail -f /home/user/git_pipeline_deploy.log`
4. Verify server: `curl http://localhost:7777/`
5. Check GitHub Issues: https://github.com/mohan-madhu/nodejs-git-pipeline/issues
