# =====================================================
# FULL AUTO DEPLOY SYSTEM - POWERSHELL
# =====================================================
# ZERO MANUAL WORK - FULLY AUTONOMOUS
# =====================================================

$ErrorActionPreference = "Stop"

# CONFIGURATION
$VPS_IP = "72.61.236.249"
$VPS_USER = "root"
$VPS_PASSWORD = "r9EH64xnvP4Bqnr#r9EH64xnvP4Bqnr#"
$PORT = "8082"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "SAAS VALA - AUTO DEPLOY SYSTEM" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Deployment started at $(Get-Date)" -ForegroundColor Cyan

# Create deployment script
$deployScript = @"
set -e
sudo mkdir -p /var/log/saas-vala
if [ ! -d "/var/www/saas-vala" ]; then
    git clone https://github.com/BOSSsoftwarevala/saas-vala.git /var/www/saas-vala
fi
cd /var/www/saas-vala
git stash || true
git fetch origin main
git reset --hard origin/main
npm install
npm run build
pkill -f "npm.*preview" || true
pkill -f "vite" || true
sleep 2
pm2 delete app || true
pm2 start npm --name app -- run preview -- --port 8082
pm2 save
sleep 5
if lsof -i :8082 > /dev/null 2>&1; then
    echo "App running on port 8082"
else
    echo "ERROR: App not running"
    exit 1
fi
echo "[$(date)] Deployment successful" >> /var/log/saas-vala/deploy.log
"@

try {
    # Save script locally
    $deployScript | Out-File -FilePath "deploy_remote.sh" -Encoding UTF8
    
    Write-Host "[INFO] Uploading deploy script to VPS..." -ForegroundColor Yellow
    
    # Create batch file with proper escaping
    $batchContent = @"
@echo off
set VPS_PASSWORD=r9EH64xnvP4Bqnr#r9EH64xnvP4Bqnr#
set VPS_USER=root
set VPS_IP=72.61.236.249
echo %%VPS_PASSWORD%% | ssh -o StrictHostKeyChecking=no %%VPS_USER%%@%%VPS_IP%% "cat > /tmp/deploy_remote.sh" < deploy_remote.sh
if %%errorlevel%% neq 0 exit /b 1
echo %%VPS_PASSWORD%% | ssh -o StrictHostKeyChecking=no %%VPS_USER%%@%%VPS_IP%% "chmod +x /tmp/deploy_remote.sh && bash /tmp/deploy_remote.sh"
"@
    
    $batchContent | Out-File -FilePath "deploy_helper.bat" -Encoding ASCII
    
    # Execute batch
    $result = cmd /c deploy_helper.bat 2>&1
    Write-Host $result
    
    if ($LASTEXITCODE -neq 0) {
        throw "Deployment failed with exit code $LASTEXITCODE"
    }
    
    # Cleanup
    Remove-Item deploy_remote.sh -ErrorAction SilentlyContinue
    Remove-Item deploy_helper.bat -ErrorAction SilentlyContinue
    
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "DEPLOYMENT COMPLETED SUCCESSFULLY" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "App running at: http://${VPS_IP}:${PORT}" -ForegroundColor Cyan
    Write-Host "Access at: https://www.saasvala.com" -ForegroundColor Cyan
    
    exit 0
}
catch {
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host "DEPLOYMENT FAILED" -ForegroundColor Red
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    Remove-Item deploy_remote.sh -ErrorAction SilentlyContinue
    Remove-Item deploy_helper.bat -ErrorAction SilentlyContinue
    
    exit 1
}
