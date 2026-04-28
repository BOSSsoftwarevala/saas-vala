@echo off
REM =====================================================
REM FULL AUTO DEPLOY SYSTEM - BATCH
REM =====================================================

set VPS_IP=72.61.236.249
set VPS_USER=root
set VPS_PASSWORD=r9EH64xnvP4Bqnr#r9EH64xnvP4Bqnr#
set PORT=8082

echo ==========================================
echo SAAS VALA - AUTO DEPLOY SYSTEM
echo ==========================================
echo Deployment started at %date% %time%

REM Create deployment script
(
echo set -e
echo sudo mkdir -p /var/log/saas-vala
echo if [ ! -d "/var/www/saas-vala" ]; then git clone https://github.com/BOSSsoftwarevala/saas-vala.git /var/www/saas-vala; fi
echo cd /var/www/saas-vala
echo git stash ^|^| true
echo git fetch origin main
echo git reset --hard origin/main
echo npm install
echo npm run build
echo pkill -f "npm.*preview" ^|^| true
echo pkill -f vite ^|^| true
echo sleep 2
echo pm2 delete app ^|^| true
echo pm2 start npm --name app -- run preview -- --port %PORT%
echo pm2 save
echo sleep 5
echo if lsof -i :%PORT% ^> /dev/null 2^>^&1; then echo "App running on port %PORT%"; else echo "ERROR: App not running" ^&^& exit 1; fi
echo echo "[$(date)] Deployment successful" ^>^> /var/log/saas-vala/deploy.log
) > deploy_commands.sh

echo [INFO] Deploy script created

REM Use PowerShell with SSH password via environment variable
powershell -Command "$env:SSH_PASSWORD='%VPS_PASSWORD%'; Get-Content deploy_commands.sh | ssh -o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no %VPS_USER%@%VPS_IP% 'bash -s'"

if %errorlevel% neq 0 (
    echo [ERROR] Deployment failed
    del deploy_commands.sh
    exit /b 1
)

del deploy_commands.sh

echo ==========================================
echo [SUCCESS] DEPLOYMENT COMPLETED
echo ==========================================
echo App running at: http://%VPS_IP%:%PORT%
echo Access at: https://www.saasvala.com

exit /b 0
