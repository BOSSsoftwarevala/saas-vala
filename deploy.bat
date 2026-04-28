@echo off
REM =====================================================
REM FULL AUTO DEPLOY SYSTEM - BATCH
REM =====================================================
REM ZERO MANUAL WORK - FULLY AUTONOMOUS
REM =====================================================

setlocal enabledelayedexpansion

REM CONFIGURATION
set VPS_IP=72.61.236.249
set VPS_USER=root
set SSH_KEY=C:\Users\dell\.ssh\id_ed25519
set PROJECT_PATH=/var/www/saas-vala
set PORT=8082

echo ==========================================
echo SAAS VALA - AUTO DEPLOY SYSTEM
echo ==========================================
echo Deployment started at %date% %time%

REM MODULE 1: SETUP VPS
echo [INFO] Connecting to VPS...
ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no %VPS_USER%@%VPS_IP% "set -e; sudo mkdir -p /var/log/saas-vala; if [ ! -d '%PROJECT_PATH%' ]; then git clone https://github.com/BOSSsoftwarevala/saas-vala.git %PROJECT_PATH%; fi"
if %errorlevel% neq 0 (
    echo [ERROR] VPS setup failed
    exit /b 1
)
echo [SUCCESS] VPS setup complete

REM MODULE 2: PULL CODE
echo [INFO] Pulling latest code...
ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no %VPS_USER%@%VPS_IP% "cd %PROJECT_PATH% && git stash || true && git fetch origin main && git reset --hard origin/main"
if %errorlevel% neq 0 (
    echo [ERROR] Code pull failed
    exit /b 1
)
echo [SUCCESS] Code pulled successfully

REM MODULE 3: INSTALL DEPENDENCIES
echo [INFO] Installing dependencies...
ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no %VPS_USER%@%VPS_IP% "cd %PROJECT_PATH% && npm install"
if %errorlevel% neq 0 (
    echo [ERROR] Dependency installation failed
    exit /b 1
)
echo [SUCCESS] Dependencies installed

REM MODULE 4: BUILD PROJECT
echo [INFO] Building project...
ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no %VPS_USER%@%VPS_IP% "cd %PROJECT_PATH% && npm run build"
if %errorlevel% neq 0 (
    echo [ERROR] Build failed
    exit /b 1
)
echo [SUCCESS] Project built successfully

REM MODULE 5: RESTART SERVICES
echo [INFO] Restarting services...
ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no %VPS_USER%@%VPS_IP% "cd %PROJECT_PATH% && pkill -f 'npm.*preview' || true && pkill -f vite || true && sleep 2 && pm2 delete app || true && pm2 start npm --name app -- run preview -- --port %PORT% && pm2 save"
if %errorlevel% neq 0 (
    echo [ERROR] Service restart failed
    exit /b 1
)
echo [SUCCESS] Services restarted

REM MODULE 6: VERIFY DEPLOYMENT
echo [INFO] Verifying deployment...
timeout /t 5 /nobreak >nul
ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no %VPS_USER%@%VPS_IP% "lsof -i :%PORT% > /dev/null 2>&1 && echo 'App running on port %PORT%' || (echo 'ERROR: App not running' && exit 1)"
if %errorlevel% neq 0 (
    echo [ERROR] Deployment verification failed
    exit /b 1
)
echo [SUCCESS] Deployment verified

echo ==========================================
echo [SUCCESS] DEPLOYMENT COMPLETED
echo ==========================================
echo App running at: http://%VPS_IP%:%PORT%
echo Access at: https://www.saasvala.com

ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no %VPS_USER%@%VPS_IP% "echo '[$(date)] Deployment successful via batch' >> /var/log/saas-vala/deploy.log"

exit /b 0
