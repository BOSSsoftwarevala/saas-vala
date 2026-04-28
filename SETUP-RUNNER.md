# ZERO-TOUCH AUTO DEPLOY SETUP

## OVERVIEW
This setup enables fully autonomous deployment on every git push to `main` branch. No SSH, no manual commands needed.

## ARCHITECTURE
```
Git Push → GitHub Actions → Self-Hosted Runner (on VPS) → PM2 Restart
```

## ONE-TIME SETUP (ON VPS)

### Step 1: SSH into VPS
```bash
ssh root@72.61.236.249
```

### Step 2: Upload and run setup script
```bash
# From your local machine, upload the script
scp setup-runner.sh root@72.61.236.249:/tmp/

# On VPS, run the script
cd /tmp
chmod +x setup-runner.sh
./setup-runner.sh
```

### Step 3: Get GitHub Runner Token
1. Go to: https://github.com/BOSSsoftwarevala/saas-vala/settings/actions/runners
2. Click "New self-hosted runner"
3. Select:
   - OS: Linux
   - Architecture: x64
4. Copy the **token** (not the full command, just the token)
5. Paste it when the script prompts

### Step 4: Verify Runner
```bash
cd /opt/actions-runner
sudo ./svc.sh status
```

You should see: `✅ Runner is running`

## HOW IT WORKS

After setup:
1. **Push to main** → GitHub triggers workflow
2. **Self-hosted runner** (on your VPS) receives job
3. **Runner executes**:
   - Pulls latest code
   - Installs dependencies
   - Builds project
   - Restarts PM2
   - Health check
4. **Done** - App is live

## VERIFICATION

After pushing to main:
1. Go to: https://github.com/BOSSsoftwarevala/saas-vala/actions
2. See workflow running
3. Check logs for deployment status

## RUNNER MANAGEMENT

On VPS:
```bash
cd /opt/actions-runner

# Check status
sudo ./svc.sh status

# View logs
sudo ./svc.sh logs

# Stop runner
sudo ./svc.sh stop

# Start runner
sudo ./svc.sh start

# Restart runner
sudo ./svc.sh restart
```

## TROUBLESHOOTING

### Runner not starting
```bash
# Check logs
sudo ./svc.sh logs

# Reconfigure if needed
./config.sh --remove
./config.sh --url https://github.com/BOSSsoftwarevala/saas-vala --token <NEW_TOKEN> --name saas-vala-runner --work _work --labels vps,prod
```

### Deployment failing
Check GitHub Actions logs at: https://github.com/BOSSsoftwarevala/saas-vala/actions

### PM2 issues
```bash
pm2 list
pm2 logs app
pm2 restart app
```

## SECURITY

- Runner runs as root (required for PM2)
- VPS firewall should block unnecessary ports
- Never commit .env to repo
- Keep runner updated

## LOGS

- GitHub Actions: https://github.com/BOSSsoftwarevala/saas-vala/actions
- VPS logs: `/var/log/saas-vala/deploy.log`
- Runner logs: `/opt/actions-runner/_diag/`
- PM2 logs: `pm2 logs app`
