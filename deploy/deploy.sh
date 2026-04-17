#!/bin/bash

# SaaS Vala Deployment Script
# Automated deployment to VPS with rollback capability

set -e

# Configuration
VPS_HOST="72.61.236.249"
VPS_USER="root"
VPS_PASSWORD="r9EH64xnvP4Bqnr#r9EH64xnvP4Bqnr#"
PROJECT_NAME="saas-vala"
DEPLOY_DIR="/var/www/${PROJECT_NAME}"
BACKUP_DIR="/var/backups/${PROJECT_NAME}"
DOCKER_COMPOSE_FILE="docker-compose.yml"
APP_PORT="8082"
APP_DOMAIN="saasvala.com"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if SSH connection works
check_ssh_connection() {
    log_info "Checking SSH connection to VPS..."
    if sshpass -p "${VPS_PASSWORD}" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${VPS_USER}@${VPS_HOST} "echo 'Connection successful'" > /dev/null 2>&1; then
        log_success "SSH connection established"
    else
        log_error "Failed to connect to VPS"
        exit 1
    fi
}

# Create backup on VPS
create_backup() {
    log_info "Creating backup on VPS..."
    local backup_name="backup-$(date +%Y%m%d_%H%M%S)"
    
    sshpass -p "${VPS_PASSWORD}" ssh ${VPS_USER}@${VPS_HOST} "
        mkdir -p ${BACKUP_DIR}
        if [ -d "${DEPLOY_DIR}" ]; then
            tar -czf ${BACKUP_DIR}/${backup_name}.tar.gz -C $(dirname ${DEPLOY_DIR}) $(basename ${DEPLOY_DIR})
            log_success 'Backup created: ${BACKUP_DIR}/${backup_name}.tar.gz'
        else
            log_warning 'No existing deployment to backup'
        fi
    "
}

# Deploy application files
deploy_files() {
    log_info "Deploying application files to VPS..."
    
    # Create deploy directory structure
    sshpass -p "${VPS_PASSWORD}" ssh ${VPS_USER}@${VPS_HOST} "
        mkdir -p ${DEPLOY_DIR}/{deploy,database,nginx/{sites-available,ssl},logs,uploads,ai-models,monitoring/{grafana/{dashboards,datasources}}}
    "
    
    # Copy deployment files
    sshpass -p "${VPS_PASSWORD}" scp -o StrictHostKeyChecking=no -r deploy/* ${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/deploy/
    
    # Copy application files
    sshpass -p "${VPS_PASSWORD}" scp -o StrictHostKeyChecking=no -r \
        package*.json \
        src/ \
        public/ \
        index.html \
        vite.config.ts \
        tsconfig.json \
        tailwind.config.js \
        postcss.config.js \
        .env.example \
        ${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/
    
    log_success "Files deployed successfully"
}

# Setup environment
setup_environment() {
    log_info "Setting up environment on VPS..."
    
    sshpass -p "${VPS_PASSWORD}" ssh ${VPS_USER}@${VPS_HOST} "
        cd ${DEPLOY_DIR}
        
        # Create environment file
        if [ ! -f .env ]; then
            cp .env.example .env
            log_info 'Created .env file from template'
        fi
        
        # Set proper permissions
        chown -R root:root ${DEPLOY_DIR}
        chmod 755 ${DEPLOY_DIR}
        chmod +x ${DEPLOY_DIR}/deploy/*.sh
        
        # Install Docker and Docker Compose if not present
        if ! command -v docker &> /dev/null; then
            log_info 'Installing Docker...'
            curl -fsSL https://get.docker.com -o get-docker.sh
            sh get-docker.sh
            systemctl enable docker
            systemctl start docker
        fi
        
        if ! command -v docker-compose &> /dev/null; then
            log_info 'Installing Docker Compose...'
            curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            chmod +x /usr/local/bin/docker-compose
        fi
        
        log_success 'Environment setup completed'
    "
}

# Deploy with Docker Compose
deploy_docker() {
    log_info "Deploying application with Docker Compose..."
    
    sshpass -p "${VPS_PASSWORD}" ssh ${VPS_USER}@${VPS_HOST} "
        cd ${DEPLOY_DIR}
        
        # Stop existing services
        docker-compose -f deploy/${DOCKER_COMPOSE_FILE} down || true
        
        # Build and start services
        docker-compose -f deploy/${DOCKER_COMPOSE_FILE} up -d --build
        
        # Wait for services to be healthy
        log_info 'Waiting for services to be healthy...'
        sleep 30
        
        # Check service status
        docker-compose -f deploy/${DOCKER_COMPOSE_FILE} ps
        
        log_success 'Docker deployment completed'
    "
}

# Setup SSL certificates
setup_ssl() {
    log_info "Setting up SSL certificates..."
    
    sshpass -p "${VPS_PASSWORD}" ssh ${VPS_USER}@${VPS_HOST} "
        # Install certbot if not present
        if ! command -v certbot &> /dev/null; then
            apt update
            apt install -y certbot python3-certbot-nginx
        fi
        
        # Generate self-signed certificate for initial setup
        mkdir -p ${DEPLOY_DIR}/deploy/nginx/ssl
        
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout ${DEPLOY_DIR}/deploy/nginx/ssl/saasvala.key \
            -out ${DEPLOY_DIR}/deploy/nginx/ssl/saasvala.crt \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=saasvala.com" \
            2>/dev/null
        
        log_success 'SSL certificates setup completed'
    "
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    sshpass -p "${VPS_PASSWORD}" ssh ${VPS_USER}@${VPS_HOST} "
        cd ${DEPLOY_DIR}
        
        # Wait for database to be ready
        log_info 'Waiting for database to be ready...'
        timeout 60 bash -c 'until docker-compose -f deploy/${DOCKER_COMPOSE_FILE} exec -T postgres pg_isready -U saasvala_user -d saasvala; do sleep 2; done'
        
        # Run migrations
        docker-compose -f deploy/${DOCKER_COMPOSE_FILE} exec -T postgres psql -U saasvala_user -d saasvala -f /docker-entrypoint-initdb.d/init.sql
        
        log_success 'Database migrations completed'
    "
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    # Check if main application is responding
    if curl -f -s "http://${VPS_HOST}/health" > /dev/null; then
        log_success "Main application is healthy"
    else
        log_error "Main application health check failed"
        return 1
    fi
    
    # Check API endpoints
    if curl -f -s "http://${VPS_HOST}/api/health" > /dev/null; then
        log_success "API endpoint is healthy"
    else
        log_warning "API endpoint health check failed"
    fi
    
    # Check database connection
    sshpass -p "${VPS_PASSWORD}" ssh ${VPS_USER}@${VPS_HOST} "
        cd ${DEPLOY_DIR}
        if docker-compose -f deploy/${DOCKER_COMPOSE_FILE} exec -T postgres pg_isready -U saasvala_user -d saasvala > /dev/null; then
            echo 'Database is healthy'
        else
            echo 'Database health check failed'
            exit 1
        fi
    "
    
    log_success "Health check completed"
}

# Setup monitoring
setup_monitoring() {
    log_info "Setting up monitoring..."
    
    sshpass -p "${VPS_PASSWORD}" ssh ${VPS_USER}@${VPS_HOST} "
        cd ${DEPLOY_DIR}
        
        # Create monitoring configuration
        cat > deploy/monitoring/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'saasvala-app'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/metrics'
    
  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:80']
      
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']
      
  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
EOF
        
        # Restart monitoring services
        docker-compose -f deploy/${DOCKER_COMPOSE_FILE} restart prometheus grafana
        
        log_success 'Monitoring setup completed'
    "
}

# Cleanup old backups
cleanup_backups() {
    log_info "Cleaning up old backups..."
    
    sshpass -p "${VPS_PASSWORD}" ssh ${VPS_USER}@${VPS_HOST} "
        # Keep only last 7 backups
        find ${BACKUP_DIR} -name 'backup-*.tar.gz' -mtime +7 -delete 2>/dev/null || true
        log_success 'Old backups cleaned up'
    "
}

# Rollback function
rollback() {
    log_warning "Initiating rollback..."
    
    local latest_backup=$(sshpass -p "${VPS_PASSWORD}" ssh ${VPS_USER}@${VPS_HOST} "ls -t ${BACKUP_DIR}/backup-*.tar.gz 2>/dev/null | head -1")
    
    if [ -n "$latest_backup" ]; then
        log_info "Rolling back to: $latest_backup"
        
        sshpass -p "${VPS_PASSWORD}" ssh ${VPS_USER}@${VPS_HOST} "
            cd ${DEPLOY_DIR}
            docker-compose -f deploy/${DOCKER_COMPOSE_FILE} down
            
            # Remove current deployment
            rm -rf ${DEPLOY_DIR}/*
            
            # Restore from backup
            tar -xzf $latest_backup -C $(dirname ${DEPLOY_DIR})
            
            # Restart services
            docker-compose -f deploy/${DOCKER_COMPOSE_FILE} up -d
            
            log_success 'Rollback completed'
        "
    else
        log_error "No backup found for rollback"
        exit 1
    fi
}

# Main deployment function
main() {
    log_info "Starting SaaS Vala deployment to VPS..."
    
    # Check for rollback flag
    if [ "$1" = "rollback" ]; then
        rollback
        exit 0
    fi
    
    # Install sshpass if not present
    if ! command -v sshpass &> /dev/null; then
        log_info "Installing sshpass..."
        if command -v apt &> /dev/null; then
            apt update && apt install -y sshpass
        elif command -v yum &> /dev/null; then
            yum install -y sshpass
        elif command -v brew &> /dev/null; then
            brew install hudochenkov/sshpass/sshpass
        else
            log_error "Please install sshpass manually"
            exit 1
        fi
    fi
    
    # Execute deployment steps
    check_ssh_connection
    create_backup
    deploy_files
    setup_environment
    setup_ssl
    deploy_docker
    run_migrations
    setup_monitoring
    health_check
    cleanup_backups
    
    log_success "🎉 Deployment completed successfully!"
    log_info "Application is now available at: https://saasvala.com"
    log_info "Grafana dashboard: https://saasvala.com:3001 (admin/admin123)"
    log_info "Prometheus metrics: https://saasvala.com:9090"
}

# Execute main function with all arguments
main "$@"
