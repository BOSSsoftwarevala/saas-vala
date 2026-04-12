#!/bin/bash

# SaaS Vala VPS Setup Script
# This script sets up the complete VPS environment

set -e

echo "🚀 Starting SaaS Vala VPS Setup..."

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js 18.x
echo "📦 Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install Python 3.11
echo "📦 Installing Python 3.11..."
apt install -y python3.11 python3.11-pip python3.11-venv

# Install PostgreSQL
echo "📦 Installing PostgreSQL..."
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

# Create database and user
echo "🗄️ Setting up PostgreSQL database..."
sudo -u postgres psql -c "CREATE DATABASE saasvala;"
sudo -u postgres psql -c "CREATE USER saasvala_user WITH PASSWORD 'saasvala_secure_password_2024';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE saasvala TO saasvala_user;"

# Install Redis
echo "📦 Installing Redis..."
apt install -y redis-server
systemctl start redis-server
systemctl enable redis-server

# Configure Redis
sed -i 's/supervised no/supervised systemd/' /etc/redis/redis.conf
systemctl restart redis-server

# Install Nginx
echo "📦 Installing Nginx..."
apt install -y nginx
systemctl start nginx
systemctl enable nginx

# Install PM2 for process management
echo "📦 Installing PM2..."
npm install -g pm2

# Create application directory
echo "📁 Creating application directory..."
mkdir -p /var/www/saasvala
cd /var/www/saasvala

# Clone repository (you'll need to set up SSH keys or use HTTPS)
echo "📥 Cloning repository..."
# git clone https://github.com/BOSSsoftwarevala/saas-vala.git .

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Build the application
echo "🔨 Building application..."
npm run build

# Set up environment file
echo "⚙️ Setting up environment..."
cat > .env << EOF
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://saasvala_user:saasvala_secure_password_2024@localhost:5432/saasvala
REDIS_URL=redis://localhost:6379
JWT_SECRET=saasvala_jwt_secret_ultra_secure_2024
SENTRY_DSN=your_sentry_dsn_here
EOF

# Configure Nginx
echo "🌐 Configuring Nginx..."
cat > /etc/nginx/sites-available/saasvala << EOF
server {
    listen 80;
    server_name saasvala.com www.saasvala.com;

    # Redirect to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name saasvala.com www.saasvala.com;

    # SSL Configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/saasvala.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/saasvala.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Static files
    location / {
        root /var/www/saasvala/dist;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/saasvala /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Install Certbot for SSL
echo "🔒 Installing Certbot for SSL..."
apt install -y certbot python3-certbot-nginx
certbot --nginx -d saasvala.com -d www.saasvala.com --non-interactive --agree-tos --email admin@saasvala.com

# Create PM2 ecosystem file
echo "🚀 Creating PM2 ecosystem..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'saasvala',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/saasvala',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/saasvala/error.log',
    out_file: '/var/log/saasvala/out.log',
    log_file: '/var/log/saasvala/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
EOF

# Create log directory
mkdir -p /var/log/saasvala

# Start application with PM2
echo "🚀 Starting application with PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Set up firewall
echo "🔥 Setting up firewall..."
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable

# Set up automatic updates
echo "🔄 Setting up automatic updates..."
apt install -y unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

# Create backup script
echo "💾 Creating backup script..."
cat > /usr/local/bin/backup-saasvala.sh << EOF
#!/bin/bash
DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/saasvala"
mkdir -p \$BACKUP_DIR

# Backup database
pg_dump saasvala > \$BACKUP_DIR/database_\$DATE.sql

# Backup files
tar -czf \$BACKUP_DIR/files_\$DATE.tar.gz /var/www/saasvala

# Keep only last 7 days
find \$BACKUP_DIR -name "*.sql" -mtime +7 -delete
find \$BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
EOF

chmod +x /usr/local/bin/backup-saasvala.sh

# Add to crontab for daily backups at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-saasvala.sh") | crontab -

# Create monitoring script
echo "📊 Creating monitoring script..."
cat > /usr/local/bin/monitor-saasvala.sh << EOF
#!/bin/bash

# Check if application is running
if ! pm2 list | grep -q "saasvala.*online"; then
    echo "Application is down, restarting..."
    pm2 restart saasvala
    logger "SaaS Vala application restarted due to downtime"
fi

# Check database connection
if ! pg_isready -h localhost -p 5432 -U saasvala_user; then
    logger "Database connection failed"
    systemctl restart postgresql
fi

# Check Redis
if ! redis-cli ping > /dev/null 2>&1; then
    logger "Redis is down, restarting..."
    systemctl restart redis-server
fi

# Check disk space
DISK_USAGE=\$(df / | awk 'NR==2 {print \$5}' | sed 's/%//')
if [ \$DISK_USAGE -gt 80 ]; then
    logger "Disk usage is high: \$DISK_USAGE%"
fi
EOF

chmod +x /usr/local/bin/monitor-saasvala.sh

# Add monitoring to crontab (every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/monitor-saasvala.sh") | crontab -

# Restart Nginx
systemctl restart nginx

echo "✅ VPS Setup Complete!"
echo "🌐 Your application is now running at: https://saasvala.com"
echo "📊 Monitor with: pm2 monit"
echo "📋 View logs: pm2 logs saasvala"
echo "🔧 Manage with: pm2 restart|stop|start saasvala"
