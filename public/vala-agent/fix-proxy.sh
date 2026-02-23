#!/bin/bash
# VALA Agent - Ultimate Nginx Proxy & Agent Fix
# This bypasses ALL port blocks by routing through Nginx (port 80)
# Run: curl -sSL https://id-preview--2dbe056f-e58d-4a25-ac47-b8b9c5f67907.lovable.app/vala-agent/fix-proxy.sh | sudo bash

set -e

echo "========================================="
echo "  VALA Agent - Ultimate Connectivity Fix"
echo "========================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "Please run as root: sudo bash"
  exit 1
fi

# 1. Ensure Nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "[!] Nginx not found. Installing..."
    apt-get update -qq && apt-get install -y nginx
fi

# 2. Check/Install Agent
if ! pm2 status | grep -q "vala-agent"; then
    echo "[!] VALA Agent not found. Installing first..."
    curl -sSL https://id-preview--2dbe056f-e58d-4a25-ac47-b8b9c5f67907.lovable.app/vala-agent/install.sh | sudo bash
fi

# 3. Get server IP and Token
SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')
AGENT_TOKEN=$(grep "VALA_AGENT_TOKEN" /opt/vala-agent/ecosystem.config.js | cut -d"'" -f2)

if [ -z "$AGENT_TOKEN" ]; then
    echo "[!] Could not find Agent Token. Please reinstall the agent."
    exit 1
fi

echo "[✓] Server IP: $SERVER_IP"
echo "[✓] Agent Token: $AGENT_TOKEN"

# 4. Create Nginx Proxy Config
NGINX_CONF="/etc/nginx/sites-available/vala-agent-proxy"

cat > "$NGINX_CONF" << 'NGINX_EOF'
server {
    listen 80;
    server_name _;

    location /vala-agent/ {
        proxy_pass http://127.0.0.1:9876/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
NGINX_EOF

# Enable the site
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/vala-agent-proxy

# Remove default if it conflicts on port 80
if [ -f /etc/nginx/sites-enabled/default ]; then
    echo "[i] Disabling default site to avoid conflict on port 80..."
    rm -f /etc/nginx/sites-enabled/default
fi

# Test and Reload
echo "[i] Testing nginx configuration..."
if nginx -t; then
    systemctl restart nginx
    echo "[✓] Nginx reloaded on port 80"
else
    echo "[!] Nginx test failed. Restoring default site..."
    ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
    exit 1
fi

# 5. Open Firewall for port 80
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp
    ufw allow 443/tcp
fi

# 6. Test the proxy locally
sleep 2
echo "[i] Testing local proxy..."
TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/vala-agent/health)
if [ "$TEST" == "200" ]; then
    echo "[✓] Local Proxy Test SUCCESS (HTTP 200)"
else
    echo "[!] Local Proxy Test FAILED (HTTP $TEST)"
fi

echo ""
echo "========================================="
echo "  ✅ DONE! Infrastructure fixed."
echo "========================================="
echo "  NEW AGENT URL: http://$SERVER_IP/vala-agent/"
echo "  AGENT TOKEN: $AGENT_TOKEN"
echo "========================================="
echo ""
echo "Copy-paste the token above if it changed."

