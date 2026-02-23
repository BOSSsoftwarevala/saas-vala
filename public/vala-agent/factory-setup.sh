#!/bin/bash
#############################################
#  VALA SOFTWARE FACTORY - Full VPS Setup
#  Version: 2.0.0
#  Powered by SoftwareVala™
#############################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${PURPLE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║          VALA SOFTWARE FACTORY INSTALLER v2.0            ║"
echo "║          Powered by SoftwareVala™                        ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Run as root: sudo bash${NC}"
  exit 1
fi

#================================
# STEP 1 — SERVER PREPARATION
#================================
echo -e "${CYAN}[1/5] Preparing server...${NC}"

apt-get update -qq

# Node 20+
if ! command -v node &>/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  echo -e "${YELLOW}Installing Node.js 20...${NC}"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo -e "${GREEN}✓ Node $(node -v)${NC}"

# Git
apt-get install -y git -qq
echo -e "${GREEN}✓ Git $(git --version | awk '{print $3}')${NC}"

# PM2
npm install -g pm2 --silent 2>/dev/null
echo -e "${GREEN}✓ PM2 $(pm2 -v)${NC}"

# Nginx
apt-get install -y nginx -qq
systemctl enable nginx
systemctl start nginx
echo -e "${GREEN}✓ Nginx installed${NC}"

# UFW
apt-get install -y ufw -qq
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo -e "${GREEN}✓ UFW active (22,80,443)${NC}"

#================================
# STEP 2 — FACTORY DIRECTORY
#================================
echo -e "${CYAN}[2/5] Creating factory structure...${NC}"

mkdir -p /factory/apps /factory/logs /factory/scripts /factory/nginx

echo -e "${GREEN}✓ /factory ready${NC}"

#================================
# STEP 3 — DEPLOY SCRIPT
#================================
echo -e "${CYAN}[3/5] Creating deploy engine...${NC}"

cat > /factory/scripts/deploy.sh << 'DEPLOY_EOF'
#!/bin/bash
# VALA Factory Deploy Script
# Usage: bash /factory/scripts/deploy.sh <repo_url> <app_name> [port]

REPO_URL="$1"
APP_NAME="$2"
APP_PORT="${3:-0}"
APP_DIR="/factory/apps/$APP_NAME"
LOG_FILE="/factory/logs/${APP_NAME}-deploy-$(date +%Y%m%d-%H%M%S).log"

exec > >(tee -a "$LOG_FILE") 2>&1

echo "========================================"
echo "  DEPLOYING: $APP_NAME"
echo "  REPO: $REPO_URL"
echo "  TIME: $(date)"
echo "========================================"

if [ -z "$REPO_URL" ] || [ -z "$APP_NAME" ]; then
  echo "ERROR: Usage: deploy.sh <repo_url> <app_name> [port]"
  exit 1
fi

# Auto-assign port if not provided
if [ "$APP_PORT" -eq 0 ]; then
  # Find next available port starting from 3001
  APP_PORT=3001
  while ss -tlnp | grep -q ":${APP_PORT} "; do
    APP_PORT=$((APP_PORT + 1))
  done
fi

echo "[1/7] Cloning/Pulling repository..."
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git fetch origin
  BRANCH=$(git rev-parse --abbrev-ref HEAD)
  git reset --hard "origin/$BRANCH"
  git pull origin "$BRANCH"
  echo "  ✓ Updated existing repo (branch: $BRANCH)"
else
  rm -rf "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
  echo "  ✓ Cloned fresh"
fi

COMMIT_SHA=$(git rev-parse --short HEAD)
COMMIT_MSG=$(git log -1 --pretty=%B)
echo "  Commit: $COMMIT_SHA - $COMMIT_MSG"

echo "[2/7] Installing dependencies..."
if [ -f "package.json" ]; then
  npm install --production 2>&1 | tail -3
  echo "  ✓ npm install done"
elif [ -f "requirements.txt" ]; then
  pip3 install -r requirements.txt 2>&1 | tail -3
  echo "  ✓ pip install done"
elif [ -f "composer.json" ]; then
  composer install --no-dev 2>&1 | tail -3
  echo "  ✓ composer install done"
else
  echo "  ⚠ No package manager detected"
fi

echo "[3/7] Building..."
if [ -f "package.json" ]; then
  if grep -q '"build"' package.json; then
    npm run build 2>&1 | tail -5
    echo "  ✓ Build complete"
  else
    echo "  ⚠ No build script"
  fi
fi

echo "[4/7] Detecting app type and start command..."
START_CMD=""
IS_STATIC=false

if [ -d "dist" ] || [ -d "build" ] || [ -d "out" ]; then
  IS_STATIC=true
  STATIC_DIR="$APP_DIR/dist"
  [ -d "build" ] && STATIC_DIR="$APP_DIR/build"
  [ -d "out" ] && STATIC_DIR="$APP_DIR/out"
  echo "  → Static site detected: $STATIC_DIR"
elif [ -f "package.json" ]; then
  if grep -q '"start"' package.json; then
    START_CMD="npm start"
  elif [ -f "server.js" ]; then
    START_CMD="node server.js"
  elif [ -f "index.js" ]; then
    START_CMD="node index.js"
  elif [ -f "app.js" ]; then
    START_CMD="node app.js"
  fi
  echo "  → Node app: $START_CMD"
elif [ -f "manage.py" ]; then
  START_CMD="python3 manage.py runserver 0.0.0.0:$APP_PORT"
  echo "  → Django app"
elif [ -f "app.py" ]; then
  START_CMD="python3 app.py"
  echo "  → Python app"
fi

echo "[5/7] Starting with PM2..."
pm2 delete "$APP_NAME" 2>/dev/null || true

if [ "$IS_STATIC" = true ]; then
  # Serve static with a simple http server
  pm2 serve "$STATIC_DIR" "$APP_PORT" --name "$APP_NAME" --spa
  echo "  ✓ Static site served on port $APP_PORT"
elif [ -n "$START_CMD" ]; then
  cd "$APP_DIR"
  PORT=$APP_PORT pm2 start "$START_CMD" --name "$APP_NAME" -- --port "$APP_PORT"
  echo "  ✓ App started on port $APP_PORT"
else
  echo "  ✗ Could not detect start command"
  exit 1
fi

pm2 save --force

echo "[6/7] Configuring Nginx..."
NGINX_CONF="/factory/nginx/${APP_NAME}.conf"

if [ "$IS_STATIC" = true ]; then
cat > "$NGINX_CONF" << NGINX_EOF
server {
    listen 80;
    server_name ${APP_NAME}.saasvala.com;

    root ${STATIC_DIR};
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX_EOF
else
cat > "$NGINX_CONF" << NGINX_EOF
server {
    listen 80;
    server_name ${APP_NAME}.saasvala.com;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 60s;
        proxy_read_timeout 300s;
    }
}
NGINX_EOF
fi

ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/${APP_NAME}.conf"

if nginx -t 2>&1; then
  systemctl reload nginx
  echo "  ✓ Nginx configured & reloaded"
else
  echo "  ✗ Nginx config error"
  rm -f "/etc/nginx/sites-enabled/${APP_NAME}.conf"
fi

echo "[7/7] Verification..."
sleep 2
PM2_STATUS=$(pm2 jlist 2>/dev/null | python3 -c "import sys,json; apps=json.load(sys.stdin); a=[x for x in apps if x['name']=='$APP_NAME']; print(a[0]['pm2_env']['status'] if a else 'not_found')" 2>/dev/null || echo "unknown")

echo ""
echo "========================================"
echo "  ✅ DEPLOYMENT COMPLETE"
echo "========================================"
echo "  App:     $APP_NAME"
echo "  Port:    $APP_PORT"
echo "  Status:  $PM2_STATUS"
echo "  Commit:  $COMMIT_SHA"
echo "  Domain:  ${APP_NAME}.saasvala.com"
echo "  Log:     $LOG_FILE"
echo "========================================"

# Output JSON for webhook
echo "DEPLOY_RESULT:$(echo "{\"app_name\":\"$APP_NAME\",\"port\":$APP_PORT,\"status\":\"$PM2_STATUS\",\"commit\":\"$COMMIT_SHA\",\"domain\":\"${APP_NAME}.saasvala.com\",\"log\":\"$LOG_FILE\"}")"
DEPLOY_EOF

chmod +x /factory/scripts/deploy.sh
echo -e "${GREEN}✓ Deploy engine ready${NC}"

#================================
# STEP 4 — WEBHOOK LISTENER
#================================
echo -e "${CYAN}[4/5] Creating webhook service...${NC}"

WEBHOOK_TOKEN=$(openssl rand -hex 32)

cat > /factory/scripts/package.json << 'EOF'
{
  "name": "vala-factory-webhook",
  "version": "2.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  }
}
EOF

cd /factory/scripts && npm install --production --silent 2>/dev/null

cat > /factory/scripts/webhook.js << WEBHOOK_EOF
const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 4000;
const TOKEN = '${WEBHOOK_TOKEN}';

app.use(cors());
app.use(express.json());

// Auth
const auth = (req, res, next) => {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  if (t !== TOKEN) return res.status(403).json({ error: 'Unauthorized' });
  next();
};

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'vala-factory', version: '2.0.0', uptime: process.uptime() });
});

// Deploy
app.post('/deploy', auth, (req, res) => {
  const { repo_url, app_name, port } = req.body;
  if (!repo_url || !app_name) {
    return res.status(400).json({ error: 'repo_url and app_name required' });
  }

  const portArg = port || 0;
  const cmd = \`bash /factory/scripts/deploy.sh "\${repo_url}" "\${app_name}" "\${portArg}" 2>&1\`;

  console.log(\`[DEPLOY] Starting: \${app_name} from \${repo_url}\`);

  exec(cmd, { timeout: 300000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
    const resultMatch = stdout.match(/DEPLOY_RESULT:(.*)/);
    let result = null;
    try { result = JSON.parse(resultMatch?.[1] || '{}'); } catch(e) {}

    if (error) {
      console.error(\`[DEPLOY] Failed: \${app_name}\`, error.message);
      return res.status(500).json({ success: false, error: error.message, logs: stdout.split('\\n').slice(-20) });
    }

    console.log(\`[DEPLOY] Success: \${app_name}\`);
    res.json({ success: true, result, logs: stdout.split('\\n').slice(-15) });
  });
});

// List apps
app.get('/apps', auth, (req, res) => {
  exec('pm2 jlist', (err, stdout) => {
    try {
      const apps = JSON.parse(stdout).map(a => ({
        name: a.name,
        status: a.pm2_env.status,
        cpu: a.monit?.cpu,
        memory: a.monit?.memory,
        uptime: a.pm2_env.pm_uptime,
        restarts: a.pm2_env.restart_time,
        port: a.pm2_env.env?.PORT || a.pm2_env.args?.[1] || 'N/A'
      }));
      res.json({ success: true, apps });
    } catch (e) {
      res.json({ success: false, error: e.message });
    }
  });
});

// Restart app
app.post('/restart', auth, (req, res) => {
  const { app_name } = req.body;
  if (!app_name) return res.status(400).json({ error: 'app_name required' });
  exec(\`pm2 restart \${app_name}\`, (err, stdout) => {
    res.json({ success: !err, output: stdout || err?.message });
  });
});

// Stop app
app.post('/stop', auth, (req, res) => {
  const { app_name } = req.body;
  if (!app_name) return res.status(400).json({ error: 'app_name required' });
  exec(\`pm2 stop \${app_name}\`, (err, stdout) => {
    res.json({ success: !err, output: stdout || err?.message });
  });
});

// Delete app
app.post('/delete', auth, (req, res) => {
  const { app_name } = req.body;
  if (!app_name) return res.status(400).json({ error: 'app_name required' });
  exec(\`pm2 delete \${app_name} && rm -rf /factory/apps/\${app_name} /factory/nginx/\${app_name}.conf /etc/nginx/sites-enabled/\${app_name}.conf && nginx -t && systemctl reload nginx\`, (err, stdout) => {
    res.json({ success: !err, output: stdout || err?.message });
  });
});

// Logs
app.get('/logs/:app_name', auth, (req, res) => {
  const { app_name } = req.params;
  const lines = req.query.lines || 50;
  exec(\`pm2 logs \${app_name} --lines \${lines} --nostream\`, { timeout: 10000 }, (err, stdout) => {
    res.json({ success: !err, logs: (stdout || '').split('\\n') });
  });
});

// System status
app.get('/status', auth, (req, res) => {
  const cmds = {
    node: 'node -v',
    npm: 'npm -v',
    git: 'git --version',
    nginx: 'nginx -v 2>&1',
    pm2: 'pm2 -v',
    disk: 'df -h / | tail -1',
    memory: 'free -h | grep Mem',
    uptime: 'uptime -p'
  };

  const results = {};
  let done = 0;
  const keys = Object.keys(cmds);

  keys.forEach(key => {
    exec(cmds[key], { timeout: 5000 }, (err, stdout) => {
      results[key] = (stdout || '').trim() || err?.message || 'N/A';
      done++;
      if (done === keys.length) {
        res.json({ success: true, system: results });
      }
    });
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`VALA Factory Webhook running on port \${PORT}\`);
});
WEBHOOK_EOF

# Add nginx proxy for webhook on /factory/ path
cat > /etc/nginx/sites-available/vala-factory << 'NGINX_EOF'
server {
    listen 80 default_server;
    server_name _;

    location /factory/ {
        proxy_pass http://127.0.0.1:4000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 60s;
        proxy_read_timeout 300s;
    }

    location /vala-agent/ {
        proxy_pass http://127.0.0.1:9876/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/vala-factory /etc/nginx/sites-enabled/vala-factory
rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/vala-agent-proxy

# Start webhook with PM2
pm2 delete vala-factory 2>/dev/null || true
pm2 start /factory/scripts/webhook.js --name vala-factory
pm2 save --force
pm2 startup 2>/dev/null || true

nginx -t && systemctl reload nginx

echo -e "${GREEN}✓ Webhook service active on port 4000${NC}"

#================================
# STEP 5 — VERIFICATION
#================================
echo -e "${CYAN}[5/5] System verification...${NC}"

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          ✅ VALA FACTORY INSTALLED SUCCESSFULLY          ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${CYAN}Versions:${NC}"
echo "  Node.js:  $(node -v)"
echo "  NPM:      $(npm -v)"
echo "  Git:      $(git --version | awk '{print $3}')"
echo "  PM2:      $(pm2 -v)"
echo "  Nginx:    $(nginx -v 2>&1 | awk -F/ '{print $2}')"

echo ""
echo -e "${CYAN}Firewall:${NC}"
ufw status | head -10

echo ""
echo -e "${CYAN}PM2 Status:${NC}"
pm2 list

echo ""
echo -e "${CYAN}Nginx Status:${NC}"
systemctl is-active nginx

echo ""
SERVER_IP=$(curl -s -4 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Factory Details:${NC}"
echo -e "  Server IP:       ${GREEN}${SERVER_IP}${NC}"
echo -e "  Factory URL:     ${GREEN}http://${SERVER_IP}/factory/${NC}"
echo -e "  Agent URL:       ${GREEN}http://${SERVER_IP}/vala-agent/${NC}"
echo -e "  Webhook Token:   ${GREEN}${WEBHOOK_TOKEN}${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${PURPLE}SAVE THE WEBHOOK TOKEN! You'll need it for deployments.${NC}"
echo ""
echo -e "${CYAN}Test deployment:${NC}"
echo -e "  curl -X POST http://${SERVER_IP}/factory/deploy \\"
echo -e "    -H 'Authorization: Bearer ${WEBHOOK_TOKEN}' \\"
echo -e "    -H 'Content-Type: application/json' \\"
echo -e "    -d '{\"repo_url\":\"https://github.com/user/repo\",\"app_name\":\"myapp\"}'"
echo ""
echo -e "${GREEN}VALA Factory is LIVE! 🏭🚀${NC}"
