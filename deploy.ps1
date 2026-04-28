# =====================================================
# FULL AUTO DEPLOY SYSTEM - POWERSHELL
# =====================================================
# ZERO MANUAL WORK - FULLY AUTONOMOUS
# =====================================================

$ErrorActionPreference = "Stop"

# CONFIGURATION
$VPS_IP = "72.61.236.249"
$VPS_USER = "root"
$SSH_KEY_PATH = "C:\Users\dell\.ssh\id_ed25519"
$PROJECT_PATH = "/var/www/saas-vala"
$REPO_URL = "https://github.com/BOSSsoftwarevala/saas-vala.git"
$PORT = "8082"

# LOGGING
function Log-Message {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor Cyan
}

function Log-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Log-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Log-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

# =====================================================
# MODULE 1: SSH CONNECTION & SETUP
# =====================================================

function Setup-VPS {
    Log-Message "Connecting to VPS..."
    
    $sshCommand = @"
        set -e
        
        # Create log directory
        sudo mkdir -p /var/log/saas-vala
        sudo chown root:root /var/log/saas-vala
        
        # Check if project directory exists
        if [ ! -d "/var/www/saas-vala" ]; then
            echo "Cloning repository..."
            git clone https://github.com/BOSSsoftwarevala/saas-vala.git /var/www/saas-vala
        else
            echo "Project directory exists, pulling latest code..."
        fi
"@
    
    ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} $sshCommand
    Log-Success "VPS setup complete"
}

# =====================================================
# MODULE 2: PULL LATEST CODE
# =====================================================

function Pull-Code {
    Log-Message "Pulling latest code from GitHub..."
    
    $sshCommand = @"
        set -e
        cd /var/www/saas-vala
        
        # Stash any local changes
        git stash || true
        
        # Pull latest code
        git fetch origin main
        git reset --hard origin/main
        
        echo "Code pulled successfully"
"@
    
    ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} $sshCommand
    Log-Success "Code pulled successfully"
}

# =====================================================
# MODULE 3: INSTALL DEPENDENCIES
# =====================================================

function Install-Dependencies {
    Log-Message "Installing dependencies..."
    
    $sshCommand = @"
        set -e
        cd /var/www/saas-vala
        
        # Check if Node.js is installed
        if ! command -v node &> /dev/null; then
            echo "Node.js not found, installing..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            apt install -y nodejs
        fi
        
        # Install npm dependencies
        npm install
        
        echo "Dependencies installed successfully"
"@
    
    ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} $sshCommand
    Log-Success "Dependencies installed"
}

# =====================================================
# MODULE 4: BUILD PROJECT
# =====================================================

function Build-Project {
    Log-Message "Building project..."
    
    $sshCommand = @"
        set -e
        cd /var/www/saas-vala
        
        # Build project
        npm run build
        
        echo "Build completed successfully"
"@
    
    ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} $sshCommand
    Log-Success "Project built successfully"
}

# =====================================================
# MODULE 5: RESTART SERVICES
# =====================================================

function Restart-Services {
    Log-Message "Restarting services..."
    
    $sshCommand = @"
        set -e
        cd /var/www/saas-vala
        
        # Kill existing node processes
        pkill -f "npm.*preview" || true
        pkill -f "vite" || true
        
        # Wait for processes to stop
        sleep 2
        
        # Start with PM2
        if command -v pm2 &> /dev/null; then
            pm2 delete app || true
            pm2 start npm --name app -- run preview -- --port 8082
            pm2 save
        else
            # Fallback: start with nohup
            nohup npm run preview -- --port 8082 > /var/log/saas-vala/app.log 2>&1 &
        fi
        
        echo "Services restarted"
"@
    
    ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} $sshCommand
    Log-Success "Services restarted"
}

# =====================================================
# MODULE 6: VERIFY DEPLOYMENT
# =====================================================

function Verify-Deployment {
    Log-Message "Verifying deployment..."
    
    # Wait for app to start
    Start-Sleep -Seconds 5
    
    $sshCommand = @"
        set -e
        
        if lsof -i :8082 > /dev/null 2>&1; then
            echo "App is running on port 8082"
        else
            echo "ERROR: App is not running on port 8082"
            exit 1
        fi
        
        # Check PM2 status if available
        if command -v pm2 &> /dev/null; then
            pm2 list
        fi
"@
    
    ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} $sshCommand
    Log-Success "Deployment verified"
}

# =====================================================
# MAIN EXECUTION
# =====================================================

function Main {
    Log-Message "=========================================="
    Log-Message "SAAS VALA - AUTO DEPLOY SYSTEM"
    Log-Message "=========================================="
    
    # Log deployment start
    Log-Message "Deployment started at $(Get-Date)"
    
    try {
        Setup-VPS
        Pull-Code
        Install-Dependencies
        Build-Project
        Restart-Services
        Verify-Deployment
        
        Log-Success "=========================================="
        Log-Success "DEPLOYMENT COMPLETED SUCCESSFULLY"
        Log-Success "=========================================="
        Log-Message "App is running at: http://${VPS_IP}:${PORT}"
        Log-Message "Access at: https://www.saasvala.com"
        
        # Save deployment log
        ssh ${VPS_USER}@${VPS_IP} "echo '[$(date)] Deployment successful via PowerShell' >> /var/log/saas-vala/deploy.log"
        
        exit 0
    }
    catch {
        Log-Error "=========================================="
        Log-Error "DEPLOYMENT FAILED"
        Log-Error "=========================================="
        Log-Error $_.Exception.Message
        
        # Save error log
        ssh ${VPS_USER}@${VPS_IP} "echo '[$(date)] Deployment failed via PowerShell' >> /var/log/saas-vala/error.log"
        
        exit 1
    }
}

# Run main function
Main
