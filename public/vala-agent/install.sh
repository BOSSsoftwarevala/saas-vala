#!/bin/bash

#############################################
#  VALA SERVER AGENT - Auto Installer
#  Version: 1.0.0
#  Powered by SoftwareVala™
#############################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Banner
echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   ██╗   ██╗ █████╗ ██╗      █████╗      █████╗ ██╗          ║"
echo "║   ██║   ██║██╔══██╗██║     ██╔══██╗    ██╔══██╗██║          ║"
echo "║   ██║   ██║███████║██║     ███████║    ███████║██║          ║"
echo "║   ╚██╗ ██╔╝██╔══██║██║     ██╔══██║    ██╔══██║██║          ║"
echo "║    ╚████╔╝ ██║  ██║███████╗██║  ██║    ██║  ██║██║          ║"
echo "║     ╚═══╝  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝    ╚═╝  ╚═╝╚═╝          ║"
echo "║                                                              ║"
echo "║              SERVER AGENT INSTALLER v1.0.0                   ║"
echo "║              Powered by SoftwareVala™                        ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Please run as root (use sudo)${NC}"
  exit 1
fi

echo -e "${CYAN}[1/7] Checking system requirements...${NC}"

# Check OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
    echo -e "${GREEN}✓ Detected: $OS $VER${NC}"
else
    echo -e "${YELLOW}Warning: Could not detect OS${NC}"
fi

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VER=$(node -v)
    echo -e "${GREEN}✓ Node.js: $NODE_VER${NC}"
else
    echo -e "${YELLOW}Node.js not found. Installing...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    echo -e "${GREEN}✓ Node.js installed${NC}"
fi

# Check PM2
if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}✓ PM2 installed${NC}"
else
    echo -e "${YELLOW}PM2 not found. Installing...${NC}"
    npm install -g pm2
    echo -e "${GREEN}✓ PM2 installed${NC}"
fi

echo -e "${CYAN}[2/7] Creating agent directory...${NC}"
AGENT_DIR="/opt/vala-agent"
mkdir -p $AGENT_DIR
cd $AGENT_DIR

echo -e "${CYAN}[3/7] Generating secure token...${NC}"
AGENT_TOKEN=$(openssl rand -hex 32)
echo -e "${GREEN}✓ Token generated${NC}"

echo -e "${CYAN}[4/7] Creating agent application...${NC}"

# Create package.json
cat > package.json << 'EOF'
{
  "name": "vala-server-agent",
  "version": "1.0.0",
  "description": "VALA AI Server Agent - Boundaryless Control",
  "main": "agent.js",
  "scripts": {
    "start": "node agent.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "systeminformation": "^5.21.20"
  }
}
EOF

# Create main agent file
cat > agent.js << 'AGENTEOF'
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const si = require('systeminformation');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.VALA_AGENT_PORT || 9876;
const TOKEN = process.env.VALA_AGENT_TOKEN;

if (!TOKEN) {
  console.error('ERROR: VALA_AGENT_TOKEN not set!');
  process.exit(1);
}

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Auth middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  
  const token = authHeader.split(' ')[1];
  if (token !== TOKEN) {
    return res.status(403).json({ success: false, error: 'Invalid token' });
  }
  
  next();
};

app.use(authenticate);

// Helper to execute commands safely
const execCommand = (cmd, timeout = 30000) => {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout }, (error, stdout, stderr) => {
      if (error && error.killed) {
        reject(new Error('Command timed out'));
      } else if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout.trim());
      }
    });
  });
};

// Command handlers
const handlers = {
  
  async status() {
    const [cpu, mem, disk, osInfo, time, load] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.fsSize(),
      si.osInfo(),
      si.time(),
      si.currentLoad()
    ]);
    
    return {
      hostname: os.hostname(),
      platform: osInfo.platform,
      distro: osInfo.distro,
      kernel: osInfo.kernel,
      uptime: os.uptime(),
      uptime_human: formatUptime(os.uptime()),
      cpu: {
        model: cpu.brand,
        cores: cpu.cores,
        usage: load.currentLoad.toFixed(2) + '%'
      },
      memory: {
        total: formatBytes(mem.total),
        used: formatBytes(mem.used),
        free: formatBytes(mem.free),
        usage: ((mem.used / mem.total) * 100).toFixed(2) + '%'
      },
      disk: disk.map(d => ({
        mount: d.mount,
        size: formatBytes(d.size),
        used: formatBytes(d.used),
        available: formatBytes(d.available),
        usage: d.use.toFixed(2) + '%'
      }))
    };
  },

  async cpu_usage() {
    const load = await si.currentLoad();
    return {
      current: load.currentLoad.toFixed(2) + '%',
      user: load.currentLoadUser.toFixed(2) + '%',
      system: load.currentLoadSystem.toFixed(2) + '%',
      cores: load.cpus.map((c, i) => ({ core: i, load: c.load.toFixed(2) + '%' }))
    };
  },

  async memory_usage() {
    const mem = await si.mem();
    return {
      total: formatBytes(mem.total),
      used: formatBytes(mem.used),
      free: formatBytes(mem.free),
      available: formatBytes(mem.available),
      usage: ((mem.used / mem.total) * 100).toFixed(2) + '%',
      swap_total: formatBytes(mem.swaptotal),
      swap_used: formatBytes(mem.swapused)
    };
  },

  async disk_usage() {
    const disks = await si.fsSize();
    return disks.map(d => ({
      filesystem: d.fs,
      mount: d.mount,
      type: d.type,
      size: formatBytes(d.size),
      used: formatBytes(d.used),
      available: formatBytes(d.available),
      usage: d.use.toFixed(2) + '%'
    }));
  },

  async list_processes() {
    const processes = await si.processes();
    return {
      all: processes.all,
      running: processes.running,
      blocked: processes.blocked,
      sleeping: processes.sleeping,
      top_cpu: processes.list
        .sort((a, b) => b.cpu - a.cpu)
        .slice(0, 10)
        .map(p => ({ pid: p.pid, name: p.name, cpu: p.cpu.toFixed(2), mem: p.mem.toFixed(2) })),
      top_mem: processes.list
        .sort((a, b) => b.mem - a.mem)
        .slice(0, 10)
        .map(p => ({ pid: p.pid, name: p.name, cpu: p.cpu.toFixed(2), mem: p.mem.toFixed(2) }))
    };
  },

  async service_status(params) {
    const service = params.service || 'nginx';
    try {
      const status = await execCommand(`systemctl is-active ${service}`);
      const info = await execCommand(`systemctl show ${service} --property=MainPID,ActiveState,SubState`);
      return { service, status, info };
    } catch (e) {
      return { service, status: 'not found or inactive', error: e.message };
    }
  },

  async restart(params) {
    const service = params.service;
    if (!service) throw new Error('Service name required');
    
    const allowedServices = ['nginx', 'apache2', 'mysql', 'postgresql', 'redis', 'pm2', 'php-fpm', 'php8.1-fpm', 'php8.2-fpm'];
    if (!allowedServices.includes(service) && !service.startsWith('pm2:')) {
      throw new Error(`Service not allowed. Allowed: ${allowedServices.join(', ')}, pm2:app_name`);
    }
    
    if (service.startsWith('pm2:')) {
      const appName = service.replace('pm2:', '');
      await execCommand(`pm2 restart ${appName}`);
      return { success: true, message: `PM2 app ${appName} restarted` };
    }
    
    await execCommand(`systemctl restart ${service}`);
    return { success: true, message: `Service ${service} restarted` };
  },

  async logs(params) {
    const type = params.type || 'system';
    const lines = Math.min(params.lines || 100, 500);
    
    const logPaths = {
      system: '/var/log/syslog',
      nginx: '/var/log/nginx/error.log',
      nginx_access: '/var/log/nginx/access.log',
      auth: '/var/log/auth.log',
      mysql: '/var/log/mysql/error.log',
      pm2: `${os.homedir()}/.pm2/logs`
    };
    
    if (type === 'pm2') {
      const output = await execCommand(`pm2 logs --lines ${lines} --nostream`);
      return { type, lines: output.split('\n') };
    }
    
    const logPath = logPaths[type];
    if (!logPath || !fs.existsSync(logPath)) {
      throw new Error(`Log type '${type}' not found`);
    }
    
    const output = await execCommand(`tail -n ${lines} ${logPath}`);
    return { type, path: logPath, lines: output.split('\n') };
  },

  async nginx_reload() {
    await execCommand('nginx -t');
    await execCommand('systemctl reload nginx');
    return { success: true, message: 'Nginx configuration reloaded' };
  },

  async ssl_status() {
    try {
      const output = await execCommand(`find /etc/letsencrypt/live -name "cert.pem" -exec openssl x509 -enddate -noout -in {} \\;`);
      const certs = output.split('\n').filter(Boolean);
      return { certificates: certs };
    } catch (e) {
      return { message: 'No Let\'s Encrypt certificates found or error reading', error: e.message };
    }
  },

  async firewall_status() {
    try {
      const status = await execCommand('ufw status verbose');
      return { firewall: 'ufw', status };
    } catch (e) {
      try {
        const iptables = await execCommand('iptables -L -n --line-numbers');
        return { firewall: 'iptables', rules: iptables };
      } catch (e2) {
        return { message: 'No firewall detected or permission denied' };
      }
    }
  },

  async deploy(params) {
    const { repo, branch = 'main', path: deployPath, commands } = params;
    
    if (!repo || !deployPath) {
      throw new Error('Required: repo (git URL) and path (deploy directory)');
    }
    
    const results = [];
    
    // Clone or pull
    if (fs.existsSync(deployPath)) {
      results.push(await execCommand(`cd ${deployPath} && git fetch origin && git checkout ${branch} && git pull origin ${branch}`));
    } else {
      results.push(await execCommand(`git clone -b ${branch} ${repo} ${deployPath}`));
    }
    
    // Run custom commands
    if (commands && Array.isArray(commands)) {
      for (const cmd of commands) {
        results.push(await execCommand(`cd ${deployPath} && ${cmd}`));
      }
    }
    
    return { 
      success: true, 
      deployed_to: deployPath,
      branch,
      results 
    };
  },

  async backup(params) {
    const { type = 'full', path: backupPath = '/var/backups/vala' } = params;
    
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${type}-${timestamp}.tar.gz`;
    const fullPath = path.join(backupPath, filename);
    
    if (type === 'full') {
      await execCommand(`tar -czf ${fullPath} /var/www /etc/nginx/sites-available /etc/nginx/sites-enabled 2>/dev/null || true`);
    } else if (type === 'www') {
      await execCommand(`tar -czf ${fullPath} /var/www`);
    }
    
    const stats = fs.statSync(fullPath);
    return {
      success: true,
      filename,
      path: fullPath,
      size: formatBytes(stats.size),
      created_at: new Date().toISOString()
    };
  },

  async database_backup(params) {
    const { type = 'mysql', database, output_path = '/var/backups/vala/db' } = params;
    
    if (!database) throw new Error('Database name required');
    
    if (!fs.existsSync(output_path)) {
      fs.mkdirSync(output_path, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${database}-${timestamp}.sql.gz`;
    const fullPath = path.join(output_path, filename);
    
    if (type === 'mysql') {
      await execCommand(`mysqldump ${database} | gzip > ${fullPath}`);
    } else if (type === 'postgresql') {
      await execCommand(`pg_dump ${database} | gzip > ${fullPath}`);
    }
    
    const stats = fs.statSync(fullPath);
    return {
      success: true,
      database,
      type,
      filename,
      path: fullPath,
      size: formatBytes(stats.size)
    };
  },

  async kill_process(params) {
    const { pid, name, signal = 'TERM' } = params;
    
    if (!pid && !name) throw new Error('PID or process name required');
    
    if (pid) {
      await execCommand(`kill -${signal} ${pid}`);
      return { success: true, message: `Sent ${signal} to PID ${pid}` };
    }
    
    await execCommand(`pkill -${signal} ${name}`);
    return { success: true, message: `Sent ${signal} to process ${name}` };
  },

  async exec(params) {
    const { command, timeout = 30000 } = params;
    
    if (!command) throw new Error('Command required');
    
    // Security: Block dangerous commands
    const blocked = ['rm -rf /', 'mkfs', 'dd if=', ':(){', 'chmod -R 777 /', '> /dev/sda'];
    if (blocked.some(b => command.includes(b))) {
      throw new Error('Command blocked for security reasons');
    }
    
    const output = await execCommand(command, timeout);
    return { command, output };
  }
};

// Helper functions
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

// Main endpoint
app.post('/', async (req, res) => {
  const { command, params = {} } = req.body;
  
  console.log(`[${new Date().toISOString()}] Command: ${command}`);
  
  if (!command) {
    return res.status(400).json({ success: false, error: 'Command required' });
  }
  
  if (!handlers[command]) {
    return res.status(400).json({ 
      success: false, 
      error: `Unknown command: ${command}`,
      available: Object.keys(handlers)
    });
  }
  
  try {
    const data = await handlers[command](params);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error(`Command ${command} failed:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', agent: 'VALA Server Agent', version: '1.0.0' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    VALA SERVER AGENT                         ║
║                    Running on port ${PORT}                       ║
║                    Powered by SoftwareVala™                  ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
AGENTEOF

echo -e "${GREEN}✓ Agent application created${NC}"

echo -e "${CYAN}[5/7] Installing dependencies...${NC}"
npm install --production
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo -e "${CYAN}[6/7] Configuring PM2...${NC}"

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'vala-agent',
    script: 'agent.js',
    env: {
      NODE_ENV: 'production',
      VALA_AGENT_PORT: 9876,
      VALA_AGENT_TOKEN: '${AGENT_TOKEN}'
    },
    max_memory_restart: '256M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/var/log/vala-agent-error.log',
    out_file: '/var/log/vala-agent.log'
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo -e "${GREEN}✓ PM2 configured${NC}"

echo -e "${CYAN}[7/7] Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow 9876/tcp
    echo -e "${GREEN}✓ Firewall rule added for port 9876${NC}"
else
    echo -e "${YELLOW}Note: UFW not found. Please manually allow port 9876${NC}"
fi

# Get server IP
SERVER_IP=$(curl -s ifconfig.me || curl -s icanhazip.com || echo "YOUR_SERVER_IP")

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║         ✓ VALA SERVER AGENT INSTALLED SUCCESSFULLY!         ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Your Agent Details:${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Agent URL:   ${GREEN}http://${SERVER_IP}:9876${NC}"
echo -e "  Agent Token: ${GREEN}${AGENT_TOKEN}${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${PURPLE}SAVE THESE DETAILS! You'll need them to connect VALA AI.${NC}"
echo ""
echo -e "${CYAN}Quick Commands:${NC}"
echo -e "  pm2 status        - Check agent status"
echo -e "  pm2 logs vala-agent - View agent logs"
echo -e "  pm2 restart vala-agent - Restart agent"
echo ""
echo -e "${GREEN}VALA AI is now ready to control this server! 🚀${NC}"
