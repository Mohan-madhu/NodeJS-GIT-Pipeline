# Troubleshooting Guide

## Common Issues & Solutions

### Issue 1: Server Won't Start

**Error**: `Error: EADDRINUSE: address already in use :::7777`

**Solution**:
```bash
# Find what's using port 7777
lsof -i :7777

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=8080 npm start
```

---

### Issue 2: Permission Denied on Log File

**Error**: `Error: EACCES: permission denied, open '/home/user/git_pipeline_deploy.log'`

**Solution**:
```bash
# Create log directory with proper permissions
mkdir -p /home/user
chmod 755 /home/user

# Set proper file permissions
touch /home/user/git_pipeline_deploy.log
chmod 666 /home/user/git_pipeline_deploy.log

# Or run with sudo
sudo npm start
```

---

### Issue 3: Git Command Not Found

**Error**: `git: command not found` in logs

**Solution**:
```bash
# Install git
sudo apt install git

# Verify git is installed
which git

# Ensure user running server has git access
sudo -u <username> git --version
```

---

### Issue 4: npm install Fails During Deployment

**Error**: `npm: command not found` or `npm ERR!` in logs

**Solution**:
```bash
# Ensure npm is installed on the server
node --version
npm --version

# Install Node.js if missing
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Use full path to npm in deployment function
const command = `/usr/bin/npm install && /usr/bin/npm run build`;
```

---

### Issue 5: PM2 Commands Not Responding

**Error**: `PM2 is not installed` or `pm2: command not found`

**Solution**:
```bash
# Install PM2 globally
npm install -g pm2

# Verify installation
pm2 --version

# If still not found, use full path
/usr/bin/pm2 restart Janahanlaw_Frontend
```

---

### Issue 6: Deployment Hangs / Times Out

**Symptoms**: Command runs but never completes, then times out after 5 minutes

**Solutions**:

a) **Increase timeout** in `server.js`:
```javascript
// In runCommand function, change timeout
return await runCommand(command, 600000);  // 10 minutes instead of 5
```

b) **Check for interactive prompts**:
```bash
# Add -n flag to npm to skip prompts
npm install -n && npm run build
```

c) **Use background processes properly**:
```javascript
// Don't use & in commands - it doesn't wait
const BAD_command = `cd "${WORK_DIR}" && npm build &`;

// Instead, let runCommand handle it
const GOOD_command = `cd "${WORK_DIR}" && npm run build`;
```

---

### Issue 7: Webhook Triggered but No Deployment Starts

**Symptoms**: Webhook fires but no deployment happens

**Debug steps**:
```bash
# Check server is running
curl http://localhost:7777/

# Check logs for webhook receipt
tail -f /home/user/git_pipeline_deploy.log | grep "Webhook"

# Verify project name matches
# If webhook URL is /webhook/janahanlaw, the case must match exactly
```

**Common causes**:
- Wrong project name in webhook URL
- Server not running
- Firewall blocking webhook provider

---

### Issue 8: Logs Not Being Written

**Symptoms**: No log output or logs disappear

**Debug**:
```bash
# Check if log file exists
ls -la /home/user/git_pipeline_deploy.log

# Check directory permissions
ls -la /home/user/ | grep pipeline

# Verify user can write to directory
touch /home/user/test_write.txt

# Check disk space
df -h /home/user

# View any permission errors
dmesg | tail -20
```

**Fix**:
```bash
# Recreate with proper permissions
rm /home/user/git_pipeline_deploy.log
touch /home/user/git_pipeline_deploy.log
chmod 666 /home/user/git_pipeline_deploy.log
chown nobody:nogroup /home/user/git_pipeline_deploy.log
```

---

### Issue 9: High Memory Usage

**Symptoms**: Server increasingly uses more memory, eventually crashes

**Causes**:
- Too many concurrent deployments
- Long command timeouts accumulating
- Memory leak in logs

**Solutions**:

a) **Reduce concurrent deployments** in `server.js`:
```javascript
const MAX_CONCURRENT_DEPLOYS = 2;  // From 3 to 2
```

b) **Implement log rotation**:
```bash
# Create logrotate config
sudo tee /etc/logrotate.d/git-pipeline << EOF
/home/user/git_pipeline_deploy.log {
    daily
    rotate 7
    compress
    missingok
}
EOF
```

c) **Monitor with PM2**:
```bash
pm2 monit
```

---

### Issue 10: SSH Key Permission Errors During Git Pull

**Error**: `Permission denied (publickey)` during git pull

**Solution**:

a) **Check SSH keys**:
```bash
# As the user running the server
ssh-keygen -t ed25519 -C "deployment"
cat ~/.ssh/id_ed25519.pub  # Add this to GitHub/GitLab
```

b) **Configure git to use SSH key**:
```bash
eval $(ssh-agent -s)
ssh-add ~/.ssh/id_ed25519
```

c) **Or use SSH config** (create `~/.ssh/config`):
```
Host github.com
    IdentityFile ~/.ssh/id_ed25519
    User git
```

d) **Test SSH connection**:
```bash
ssh -T git@github.com
```

---

### Issue 11: SUDO Command Requires Password

**Symptoms**: Deployment hangs when hitting `sudo` command

**Error in logs**: `sudo: no tty present and no askpass program specified`

**Solution**:

a) **Allow specific commands without password** (as root):
```bash
visudo
```

Add line:
```
your-user ALL=(ALL) NOPASSWD: /home/user/web/janahanlaw.com/public_html/GIT/janahan-law/*
```

c) **Or run server as root** (not recommended for security):
```bash
sudo npm start
```

---

### Issue 12: Deployment Succeeds but Changes Don't Show

**Symptoms**: Logs show success but website unchanged

**Causes**:
- Build output not synced to web root
- Wrong directory path
- File permissions on output

**Solutions**:

a) **Verify rsync command**:
```bash
rsync -a --delete /path/to/build/ /var/www/html/
```

b) **Check permissions**:
```bash
ls -la /var/www/html/
```

c) **Verify build output**:
```bash
ls -la /home/user/web/project/dist/
```

---

### Issue 13: Multiple Deployments Running Simultaneously

**Symptoms**: Server trying to deploy same project multiple times

**Solution**:
The server now has a concurrency limit. To debug:

```bash
# Check active deployments
curl http://localhost:7777/status

# Should show:
{
  "activeDeployments": 2,
  "maxConcurrent": 3,
  "recentDeployments": {...}
}
```

Reduce `MAX_CONCURRENT_DEPLOYS` if conflicts occur.

---

### Issue 14: Error Output Too Large

**Error**: `Error: stdout maxBuffer exceeded`

**Solution**:
Already fixed in v1.1.0! Buffer increased from 1MB to 10MB. If you still encounter this, increase further in `server.js`:

```javascript
const proc = exec(command, { maxBuffer: 50 * 1024 * 1024 }, ...
```

---

### Issue 15: GitHub Shows "Delivery Failed"

**Symptoms**: Webhook delivery marked as failed in GitHub

**Debug**:
1. Go to GitHub > Settings > Webhooks
2. Click the webhook
3. Click "Recent Deliveries"
4. Click failed delivery to see response code and body

**Common response codes**:
- **502**: Server crashed or down
- **503**: Server overloaded (MAX_CONCURRENT_DEPLOYS exceeded)
- **400**: Unknown project name
- **500**: Deployment error (check logs)

---

## Debug Mode

To enable extra logging, add this to `server.js` at the start:

```javascript
if (process.env.DEBUG) {
  console.log('🐛 DEBUG MODE ENABLED');
  console.log('LOG_FILE:', LOG_FILE);
  console.log('PORT:', PORT);
  console.log('MAX_CONCURRENT_DEPLOYS:', MAX_CONCURRENT_DEPLOYS);
}
```

Then run:
```bash
DEBUG=1 npm start
```

---

## Getting Help

If you can't find your issue here:

1. **Check logs**:
   ```bash
   tail -100 /home/user/git_pipeline_deploy.log
   ```

2. **Check status**:
   ```bash
   pm2 status
   curl http://localhost:7777/status
   ```

3. **Review this guide** again for similar issues

4. **Check GitHub Issues**: https://github.com/mohan-madhu/nodejs-git-pipeline/issues

5. **Enable debug mode** and capture full output
