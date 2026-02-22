# Features & Improvements

## Bug Fixes

✅ **Fixed Duplicate Webhook Handler** - Removed duplicate switch statement that was executing deployments twice

✅ **Fixed Response Timing** - Webhook now returns HTTP 202 immediately while deployment runs in background

## New Features

### 1. **Deployment Status Tracking**
- Track active deployments in real-time
- Check deployment history for each project
- Endpoints:
  - `GET /status` - View all deployment activity
  - `GET /status/:project` - View specific project status

### 2. **Concurrency Control**
- Limits simultaneous deployments to prevent server overload (default: 3)
- Queues additional deployment requests
- Configurable via `MAX_CONCURRENT_DEPLOYS` constant

### 3. **Environment Variables**
- Configure paths and settings via environment variables
- No need to edit source code
- See `.env.example` for all available options:
  - `PORT` - Server port (default: 7777)
  - `LOG_FILE` - Log file location
  - `JANAHANLAW_DIR` - Project working directory
  - `JANAHANLAW_SERVICE` - PM2 service name

### 4. **Improved Error Handling**
- Better logging with auto-directory creation
- Try-catch blocks prevent crashes
- Command timeout protection (5 minutes default)
- Detailed error messages in logs

### 5. **Graceful Shutdown**
- SIGTERM signal handling
- Waits for active deployments to complete before exiting
- Prevents incomplete deployments on server restart

### 6. **Better Logging**
- Consistent timestamps on all log entries
- Automatic log directory creation
- Error logging doesn't crash the server
- Detailed deployment status in logs

### 7. **Increased Buffer Size**
- Increased from 1MB to 10MB to handle larger projects
- Prevents truncation of command output

### 8. **Health Check Improvements**
- `GET /` now shows active deployments and max concurrent limit
- Returns HTTP 202 (Accepted) for async operations
- More descriptive responses

## Configuration Examples

### Basic Setup
```bash
npm install
npm start
```

### Using Custom Environment
```bash
LOG_FILE=/var/log/deploy.log PORT=8080 npm start
```

### With .env File
```bash
cp .env.example .env
# Edit .env with your values
npm start
```

## Usage Examples

### Trigger Deployment
```bash
curl -X POST http://localhost:7777/webhook/janahanlaw
```

### Check Status
```bash
# All deployments
curl http://localhost:7777/status

# Specific project
curl http://localhost:7777/status/janahanlaw
```

## Adding New Projects

1. Create a new async function:
```javascript
async function my_project() {
  const WORK_DIR = process.env.MY_PROJECT_DIR || '/path/to/project';
  const command = `cd "${WORK_DIR}" && git pull && npm install && npm run build`;
  return await runCommand(command);
}
```

2. Add to webhook switch statement:
```javascript
case 'my_project':
  deployFunc = my_project;
  break;
```

3. Configure environment variables in `.env`

## Performance Improvements

- Reduced memory usage by limiting concurrent deployments
- Better resource management with timeout controls
- Immediate webhook responses (no blocking)
- Efficient status tracking
