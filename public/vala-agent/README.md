# VALA Server Agent

**Boundaryless Server Control for VALA AI**

## Quick Install (One Command)

SSH into your server and run:

```bash
curl -sSL https://your-domain.com/vala-agent/install.sh | sudo bash
```

Or manually:

```bash
wget https://your-domain.com/vala-agent/install.sh
chmod +x install.sh
sudo ./install.sh
```

## Requirements

- Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- Root access (sudo)
- Port 9876 available

## After Installation

You'll receive:
- **Agent URL**: `http://YOUR_SERVER_IP:9876`
- **Agent Token**: A secure 64-character token

**SAVE THESE!** You'll need them to connect VALA AI to your server.

## Connecting to VALA AI

In VALA AI Chat, say:
```
Connect my server
URL: http://YOUR_SERVER_IP:9876
Token: YOUR_TOKEN
```

## Available Commands

Once connected, VALA AI can:

| Command | Description |
|---------|-------------|
| `status` | Full server status (CPU, RAM, Disk) |
| `deploy` | Deploy projects from Git |
| `restart` | Restart services (nginx, mysql, pm2) |
| `logs` | View system/app logs |
| `backup` | Create server backups |
| `ssl_status` | Check SSL certificates |
| `database_backup` | Backup MySQL/PostgreSQL |

## Security

- Token-based authentication
- Dangerous commands blocked
- All actions logged
- HTTPS recommended (use nginx reverse proxy)

## Management

```bash
# Check status
pm2 status

# View logs
pm2 logs vala-agent

# Restart agent
pm2 restart vala-agent

# Stop agent
pm2 stop vala-agent
```

## Uninstall

```bash
pm2 delete vala-agent
rm -rf /opt/vala-agent
```

---

**Powered by SoftwareVala™**
