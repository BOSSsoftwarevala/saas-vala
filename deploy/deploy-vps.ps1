# SaaS Vala Deployment to Hostinger VPS
# PowerShell deployment script for Windows

# Configuration
$VPS_HOST = "72.61.236.249"
$VPS_USER = "root"
$VPS_PASSWORD = "r9EH64xnvP4Bqnr#r9EH64xnvP4Bqnr#"
$PROJECT_NAME = "saas-vala"
$DEPLOY_DIR = "/var/www/$PROJECT_NAME"
$APP_PORT = "8082"
$APP_DOMAIN = "saasvala.com"

# Colors for output
function Write-Info($message) {
    Write-Host "[INFO] $message" -ForegroundColor Blue
}

function Write-Success($message) {
    Write-Host "[SUCCESS] $message" -ForegroundColor Green
}

function Write-Warning($message) {
    Write-Host "[WARNING] $message" -ForegroundColor Yellow
}

function Write-Error($message) {
    Write-Host "[ERROR] $message" -ForegroundColor Red
}

# Check if plink is available (PuTTY's SSH client)
function Test-Plink {
    $plinkPaths = @(
        "C:\Program Files\PuTTY\plink.exe",
        "C:\Program Files (x86)\PuTTY\plink.exe",
        "C:\Program Files\PuTTY64\plink.exe"
    )
    
    foreach ($path in $plinkPaths) {
        if (Test-Path $path) {
            return $path
        }
    }
    
    return $null
}

# Check if pscp is available (PuTTY's SCP client)
function Test-Pscp {
    $pscpPaths = @(
        "C:\Program Files\PuTTY\pscp.exe",
        "C:\Program Files (x86)\PuTTY\pscp.exe",
        "C:\Program Files\PuTTY64\pscp.exe"
    )
    
    foreach ($path in $pscpPaths) {
        if (Test-Path $path) {
            return $path
        }
    }
    
    return $null
}

# Execute SSH command
function Invoke-SSHCommand($command) {
    $plink = Test-Plink
    if (-not $plink) {
        Write-Error "PuTTY plink.exe not found. Please install PuTTY from https://www.putty.org/"
        exit 1
    }
    
    Write-Info "Executing: $command"
    $output = & $plink -batch -pw $VPS_PASSWORD "$VPS_USER@$VPS_HOST" $command 2>&1
    return $output
}

# Copy file via SCP
function Copy-ToVPS($localPath, $remotePath) {
    $pscp = Test-Pscp
    if (-not $pscp) {
        Write-Error "PuTTY pscp.exe not found. Please install PuTTY from https://www.putty.org/"
        exit 1
    }
    
    Write-Info "Copying: $localPath -> $remotePath"
    $output = & $pscp -batch -pw $VPS_PASSWORD $localPath "$VPS_USER@$VPS_HOST`:$remotePath" 2>&1
    return $output
}

# Main deployment function
function Deploy {
    Write-Info "Starting deployment to Hostinger VPS..."
    Write-Info "VPS: $VPS_HOST"
    Write-Info "Domain: $APP_DOMAIN"
    Write-Info "Port: $APP_PORT"
    Write-Host ""
    
    # Test SSH connection
    Write-Info "Testing SSH connection..."
    $testOutput = Invoke-SSHCommand "echo 'Connection successful'"
    if ($testOutput -match "Connection successful") {
        Write-Success "SSH connection established"
    } else {
        Write-Error "Failed to connect to VPS"
        exit 1
    }
    
    # Create deployment directory
    Write-Info "Creating deployment directory..."
    Invoke-SSHCommand "mkdir -p $DEPLOY_DIR"
    
    # Install Node.js if not present
    Write-Info "Checking Node.js installation..."
    Invoke-SSHCommand "which node || curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs"
    
    # Clone or update repository
    Write-Info "Cloning/updating repository..."
    Invoke-SSHCommand "cd $DEPLOY_DIR && git clone https://github.com/BOSSsoftwarevala/saas-vala.git . || git pull origin main"
    
    # Install dependencies
    Write-Info "Installing dependencies..."
    Invoke-SSHCommand "cd $DEPLOY_DIR && npm install"
    
    # Build application
    Write-Info "Building application..."
    Invoke-SSHCommand "cd $DEPLOY_DIR && npm run build"
    
    # Install nginx if not present
    Write-Info "Checking nginx installation..."
    Invoke-SSHCommand "which nginx || apt update && apt install -y nginx"
    
    # Configure nginx
    Write-Info "Configuring nginx..."
    $nginxConfig = @"
server {
    listen 8082;
    server_name $APP_DOMAIN www.$APP_DOMAIN;
    
    root $DEPLOY_DIR/dist;
    index index.html;
    
    location / {
        try_files `$uri `$uri/ /index.html;
    }
    
    location /api {
        proxy_pass https://astmdnelnuqwpdbyzecr.supabase.co;
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
"@
    
    Invoke-SSHCommand "cat > /etc/nginx/sites-available/$PROJECT_NAME << 'EOF'$nginxConfig'EOF'"
    Invoke-SSHCommand "ln -sf /etc/nginx/sites-available/$PROJECT_NAME /etc/nginx/sites-enabled/"
    Invoke-SSHCommand "rm -f /etc/nginx/sites-enabled/default"
    
    # Restart nginx
    Write-Info "Restarting nginx..."
    Invoke-SSHCommand "systemctl restart nginx"
    
    # Configure firewall
    Write-Info "Configuring firewall..."
    Invoke-SSHCommand "ufw allow 8082/tcp || true"
    
    Write-Host ""
    Write-Success "🎉 Deployment completed successfully!"
    Write-Info "Application is now available at: http://${APP_DOMAIN}:${APP_PORT}"
    Write-Info "SSH to VPS: ssh root@$VPS_HOST"
    Write-Info "View logs: tail -f /var/log/nginx/error.log"
}

# Run deployment
Deploy
