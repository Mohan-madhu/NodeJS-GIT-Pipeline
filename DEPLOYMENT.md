# Deployment Guide

This guide covers production deployment strategies and best practices for the Git Pipeline server.

## Production Setup with PM2

### 1. Install PM2 Globally
```bash
npm install -g pm2
```

### 2. Start the Server
```bash
pm2 start server.js --name "git-pipeline" --env production
```

### 3. Enable Auto-startup
```bash
pm2 startup
pm2 save
```

### 4. Monitor the Server
```bash
# View logs
pm2 logs git-pipeline

# View real-time stats
pm2 monit

# View all running processes
pm2 list
```

### 5. Restart/Reload
```bash
# Restart the process
pm2 restart git-pipeline

# Graceful reload (waits for active deployments)
pm2 reload git-pipeline

# Stop the process
pm2 stop git-pipeline
```

## Docker Deployment

### Basic Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY server.js .

ENV PORT=7777
ENV LOG_FILE=/app/logs/pipeline.log

RUN mkdir -p /app/logs

EXPOSE 7777

CMD ["node", "server.js"]
```

### Docker Compose Example
```yaml
version: '3.8'

services:
  git-pipeline:
    build: .
    ports:
      - "7777:7777"
    environment:
      - PORT=7777
      - LOG_FILE=/app/logs/pipeline.log
      - JANAHANLAW_DIR=/home/user/web/janahanlaw
      - JANAHANLAW_SERVICE=Janahanlaw_Frontend
    volumes:
      - ./logs:/app/logs
      - /var/run/docker.sock:/var/run/docker.sock
    restart: unless-stopped
```

## Nginx Reverse Proxy Configuration

```nginx
upstream git_pipeline {
    server localhost:7777;
}

server {
    listen 80;
    server_name deploy.example.com;

    location / {
        proxy_pass http://git_pipeline;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }
}
```

## GitHub Webhook Configuration

1. Go to your GitHub repository
2. Settings > Webhooks > Add webhook
3. Set these values:
   - **Payload URL**: `https://deploy.example.com/webhook/janahanlaw`
   - **Content type**: `application/json`
   - **Events**: Just the push event
   - **Active**: ✓ (checked)

## GitLab Webhook Configuration

1. Go to your GitLab project
2. Settings > Integrations > Webhooks
3. Set these values:
   - **URL**: `https://deploy.example.com/webhook/janahanlaw`
   - **Push events**: ✓ (checked)
   - **Add webhook**

## Logging & Monitoring

### Log Location
By default, logs are stored at: `/home/user/git_pipeline_deploy.log`

### Viewing Logs
```bash
# Tail logs in real-time
tail -f /home/user/git_pipeline_deploy.log

# View last 50 lines
tail -50 /home/user/git_pipeline_deploy.log

# Search for errors
grep "❌" /home/user/git_pipeline_deploy.log
```

### Log Rotation (Optional)
Create `/etc/logrotate.d/git-pipeline`:
```
/home/user/git_pipeline_deploy.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 nobody nobody
    sharedscripts
    postrotate
        pm2 reload git-pipeline
    endscript
}
```

### Monitoring with cron
Create a monitoring script to check if server is running:
```bash
#!/bin/bash
# save as /usr/local/bin/check-pipeline.sh

if ! curl -s http://localhost:7777/ > /dev/null; then
    echo "Git Pipeline is down!" | mail -s "Alert: Git Pipeline Server" admin@example.com
    pm2 restart git-pipeline
fi
```

Add to crontab:
```bash
*/5 * * * * /usr/local/bin/check-pipeline.sh
```

## Concurrency & Performance Tuning

### Adjust Concurrent Deployments
Edit `server.js` and change:
```javascript
const MAX_CONCURRENT_DEPLOYS = 3;  // Increase based on server resources
```

Higher values = more deployments at once, but use more CPU/memory.

### Command Timeout
Default is 5 minutes (300000ms). For slower builds, increase in the `runCommand` call:
```javascript
return await runCommand(command, 600000);  // 10 minutes
```

## Security Considerations

### 1. Firewall Rules
Only allow webhooks from trusted sources:
```bash
# Allow GitHub
ufw allow from 140.82.112.0/20 to any port 7777
ufw allow from 143.55.64.0/20 to any port 7777

# Allow GitLab
ufw allow from 34.74.90.0/25 to any port 7777
```

### 2. HTTPS/SSL
Use a reverse proxy with SSL (nginx + Let's Encrypt):
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d deploy.example.com
```

### 3. Rate Limiting (Using Nginx)
Add rate limiting to your nginx config:
```nginx
limit_req_zone $binary_remote_addr zone=webhook_limit:10m rate=10r/m;

location /webhook {
    limit_req zone=webhook_limit burst=20;
    proxy_pass http://git_pipeline;
}
```

### 4. Authentication (Optional - Implement in server.js)
Add webhook secret verification:
```javascript
import crypto from 'crypto';

function verifyGitHubSignature(req, secret) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;
  
  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  return signature === `sha256=${hash}`;
}
```

## Troubleshooting

### Deployment Not Triggering
1. Check webhook delivery in GitHub/GitLab
2. Verify server is running: `pm2 status`
3. Check logs: `tail -f /home/user/git_pipeline_deploy.log`

### Deployments Timing Out
Increase the timeout in `runCommand()` for slower builds

### High Memory Usage
Reduce `MAX_CONCURRENT_DEPLOYS` or check for long-running commands

### Permission Denied Errors
Ensure the user running the server has permission to:
- Write to log directory
- Access project directories
- Run `git`, `npm`, `pm2` commands via `sudo` if needed

## Performance Metrics

### Recommended Specs
- **CPU**: 2+ cores for concurrent deployments
- **RAM**: 1GB+ (increases with concurrent deployments)
- **Disk**: 100MB+ for logs and temporary files
- **Network**: Stable internet for git pulls

### Example Deployment Times
- Small project: 2-5 minutes
- Medium project: 5-15 minutes
- Large project: 15-30+ minutes

Keep these in mind when setting command timeouts.
