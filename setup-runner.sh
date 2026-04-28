#!/bin/bash

# =====================================================
# SELF-HOSTED GITHUB RUNNER SETUP - ONE-TIME
# =====================================================
# RUN THIS ON YOUR VPS TO ENABLE ZERO-TOUCH DEPLOY
# =====================================================

set -e

# CONFIGURATION
RUNNER_DIR="/opt/actions-runner"
RUNNER_NAME="saas-vala-runner"
RUNNER_LABELS="vps,prod"
LOG_DIR="/var/log/saas-vala"

echo "=========================================="
echo "GITHUB SELF-HOSTED RUNNER SETUP"
echo "=========================================="

# Step 1: Create directories
echo "[1/6] Creating directories..."
sudo mkdir -p $RUNNER_DIR
sudo mkdir -p $LOG_DIR
sudo chown root:root $RUNNER_DIR
sudo chown root:root $LOG_DIR

# Step 2: Download runner
echo "[2/6] Downloading GitHub Actions Runner..."
cd $RUNNER_DIR
curl -o actions-runner.tar.gz -L https://github.com/actions/runner/releases/latest/download/actions-runner-linux-x64.tar.gz
tar xzf actions-runner.tar.gz
rm actions-runner.tar.gz

# Step 3: Prompt for token
echo "[3/6] Configuration requires a GitHub token"
echo ""
echo "GET YOUR TOKEN:"
echo "1. Go to: https://github.com/BOSSsoftwarevala/saas-vala/settings/actions/runners"
echo "2. Click 'New self-hosted runner'"
echo "3. Select 'Linux' and 'x64'"
echo "4. Copy the token (not the full command, just the token)"
echo ""
read -p "Enter your GitHub runner token: " RUNNER_TOKEN

# Step 4: Configure runner
echo "[4/6] Configuring runner..."
./config.sh \
  --url https://github.com/BOSSsoftwarevala/saas-vala \
  --token $RUNNER_TOKEN \
  --name $RUNNER_NAME \
  --work _work \
  --labels $RUNNER_LABELS \
  --replace

# Step 5: Install as service
echo "[5/6] Installing runner as service..."
sudo ./svc.sh install
sudo ./svc.sh start

# Step 6: Verify
echo "[6/6] Verifying runner status..."
sleep 3
sudo ./svc.sh status

echo ""
echo "=========================================="
echo "✅ RUNNER SETUP COMPLETE"
echo "=========================================="
echo ""
echo "Runner is now running on your VPS"
echo "It will automatically deploy on every push to main"
echo ""
echo "View runner status: sudo ./svc.sh status"
echo "View runner logs: sudo ./svc.sh logs"
echo "Stop runner: sudo ./svc.sh stop"
echo "Start runner: sudo ./svc.sh start"
echo ""
echo "Log directory: $LOG_DIR"
echo "Runner directory: $RUNNER_DIR"
