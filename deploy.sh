#!/bin/bash

# =====================================================
# FULL AUTO DEPLOY SYSTEM - SAAS VALA
# =====================================================
# ZERO MANUAL WORK - FULLY AUTONOMOUS
# =====================================================

set -e  # Exit on error

# CONFIGURATION
VPS_IP="72.61.236.249"
VPS_USER="root"
PROJECT_PATH="/var/www/saas-vala"
REPO_URL="https://github.com/BOSSsoftwarevala/saas-vala.git"
PORT="8082"
LOG_DIR="/var/log/saas-vala"

# COLORS
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# LOGGING
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# =====================================================
# MODULE 1: SSH CONNECTION & SETUP
# =====================================================

setup_vps() {
    log "Connecting to VPS..."
    
    ssh ${VPS_USER}@${VPS_IP} << 'ENDSSH'
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
ENDSSH
    
    log_success "VPS setup complete"
}

# =====================================================
# MODULE 2: PULL LATEST CODE
# =====================================================

pull_code() {
    log "Pulling latest code from GitHub..."
    
    ssh ${VPS_USER}@${VPS_IP} << 'ENDSSH'
        set -e
        cd /var/www/saas-vala
        
        # Stash any local changes
        git stash || true
        
        # Pull latest code
        git fetch origin main
        git reset --hard origin/main
        
        echo "Code pulled successfully"
ENDSSH
    
    log_success "Code pulled successfully"
}

# =====================================================
# MODULE 3: INSTALL DEPENDENCIES
# =====================================================

install_dependencies() {
    log "Installing dependencies..."
    
    ssh ${VPS_USER}@${VPS_IP} << 'ENDSSH'
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
ENDSSH
    
    log_success "Dependencies installed"
}

# =====================================================
# MODULE 4: BUILD PROJECT
# =====================================================

build_project() {
    log "Building project..."
    
    ssh ${VPS_USER}@${VPS_IP} << 'ENDSSH'
        set -e
        cd /var/www/saas-vala
        
        # Build project
        npm run build
        
        echo "Build completed successfully"
ENDSSH
    
    log_success "Project built successfully"
}

# =====================================================
# MODULE 5: APPLY DATABASE MIGRATIONS
# =====================================================

apply_migrations() {
    log "Applying database migrations..."
    
    ssh ${VPS_USER}@${VPS_IP} << 'ENDSSH'
        set -e
        cd /var/www/saas-vala
        
        # Check if there are Supabase migrations
        if [ -d "supabase/migrations" ]; then
            echo "Found Supabase migrations"
            # Note: Migrations need to be applied via Supabase Dashboard or CLI
            # This is a placeholder for future auto-migration
            echo "Migrations need to be applied via Supabase Dashboard"
        fi
ENDSSH
    
    log_success "Migration check complete"
}

# =====================================================
# MODULE 6: RESTART SERVICES
# =====================================================

restart_services() {
    log "Restarting services..."
    
    ssh ${VPS_USER}@${VPS_IP} << 'ENDSSH'
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
ENDSSH
    
    log_success "Services restarted"
}

# =====================================================
# MODULE 7: VERIFY DEPLOYMENT
# =====================================================

verify_deployment() {
    log "Verifying deployment..."
    
    # Wait for app to start
    sleep 5
    
    # Check if port is listening
    ssh ${VPS_USER}@${VPS_IP} << 'ENDSSH'
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
ENDSSH
    
    log_success "Deployment verified"
}

# =====================================================
# MODULE 8: ERROR HANDLING & RETRY
# =====================================================

deploy_with_retry() {
    local max_retries=3
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        log "Deployment attempt $((retry_count + 1))/$max_retries"
        
        if setup_vps && pull_code && install_dependencies && build_project && apply_migrations && restart_services && verify_deployment; then
            log_success "Deployment successful!"
            return 0
        else
            log_error "Deployment failed, retrying..."
            retry_count=$((retry_count + 1))
            sleep 5
        fi
    done
    
    log_error "Deployment failed after $max_retries attempts"
    return 1
}

# =====================================================
# MAIN EXECUTION
# =====================================================

main() {
    log "=========================================="
    log "SAAS VALA - AUTO DEPLOY SYSTEM"
    log "=========================================="
    
    # Log deployment start
    log "Deployment started at $(date)"
    
    # Execute deployment
    if deploy_with_retry; then
        log_success "=========================================="
        log_success "DEPLOYMENT COMPLETED SUCCESSFULLY"
        log_success "=========================================="
        log "App is running at: http://${VPS_IP}:${PORT}"
        log "Access at: https://www.saasvala.com"
        
        # Save deployment log
        ssh ${VPS_USER}@${VPS_IP} "echo '[$(date)] Deployment successful' >> ${LOG_DIR}/deploy.log"
        
        exit 0
    else
        log_error "=========================================="
        log_error "DEPLOYMENT FAILED"
        log_error "=========================================="
        
        # Save error log
        ssh ${VPS_USER}@${VPS_IP} "echo '[$(date)] Deployment failed' >> ${LOG_DIR}/error.log"
        
        exit 1
    fi
}

# Run main function
main
