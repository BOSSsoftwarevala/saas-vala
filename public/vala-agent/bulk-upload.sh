#!/bin/bash

# =============================================================================
# SaaSVala Bulk GitHub Uploader
# This script uploads all folders in current directory to SaaSVala GitHub
# =============================================================================

# Configuration
GITHUB_USERNAME="SaaSVala"
GITHUB_TOKEN="${SAASVALA_GITHUB_TOKEN:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
SUCCESS_COUNT=0
SKIP_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=0

# Log file
LOG_FILE="upload_log_$(date +%Y%m%d_%H%M%S).txt"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          SaaSVala Bulk GitHub Uploader v1.0                  ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if GitHub token is set
if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${YELLOW}GitHub token not found in environment.${NC}"
    echo -n "Enter your SaaSVala GitHub Personal Access Token: "
    read -s GITHUB_TOKEN
    echo ""
fi

if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}Error: GitHub token is required!${NC}"
    exit 1
fi

# Validate token
echo -e "${BLUE}Validating GitHub token...${NC}"
VALIDATION=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/user")

if [ "$VALIDATION" != "200" ]; then
    echo -e "${RED}Error: Invalid GitHub token!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Token validated successfully!${NC}"
echo ""

# Count total directories
TOTAL_COUNT=$(find . -maxdepth 1 -type d ! -name "." ! -name ".." | wc -l)
echo -e "${BLUE}Found ${TOTAL_COUNT} folders to process${NC}"
echo "Log file: $LOG_FILE"
echo ""
echo "Starting upload in 3 seconds... (Ctrl+C to cancel)"
sleep 3

# Function to create repo and push
upload_project() {
    local folder_name="$1"
    local repo_name=$(echo "$folder_name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/^-\|-$//g')
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Processing: $folder_name → $repo_name${NC}"
    
    # Check if repo already exists
    REPO_CHECK=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        "https://api.github.com/repos/$GITHUB_USERNAME/$repo_name")
    
    if [ "$REPO_CHECK" == "200" ]; then
        echo -e "${YELLOW}⚠ Repo already exists, pushing to existing...${NC}"
    else
        # Create new repository
        echo -e "${BLUE}Creating repository...${NC}"
        CREATE_RESULT=$(curl -s -X POST \
            -H "Authorization: token $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github.v3+json" \
            "https://api.github.com/user/repos" \
            -d "{\"name\":\"$repo_name\",\"private\":false,\"auto_init\":false}")
        
        if echo "$CREATE_RESULT" | grep -q '"id"'; then
            echo -e "${GREEN}✓ Repository created${NC}"
        else
            ERROR_MSG=$(echo "$CREATE_RESULT" | grep -o '"message":"[^"]*"' | head -1)
            echo -e "${RED}✗ Failed to create repo: $ERROR_MSG${NC}"
            echo "FAIL: $folder_name - $ERROR_MSG" >> "$LOG_FILE"
            ((FAIL_COUNT++))
            return 1
        fi
    fi
    
    # Enter folder and initialize git
    cd "$folder_name" || return 1
    
    # Initialize git if not already
    if [ ! -d ".git" ]; then
        git init -q
    fi
    
    # Add remote (remove if exists)
    git remote remove origin 2>/dev/null
    git remote add origin "https://$GITHUB_TOKEN@github.com/$GITHUB_USERNAME/$repo_name.git"
    
    # Add all files
    git add -A
    
    # Check if there are changes to commit
    if git diff --cached --quiet; then
        echo -e "${YELLOW}⚠ No changes to commit${NC}"
        # Still try to push existing commits
    else
        git commit -q -m "Initial commit - Uploaded via SaaSVala Bulk Uploader"
    fi
    
    # Push to GitHub
    echo -e "${BLUE}Pushing to GitHub...${NC}"
    if git push -u origin main --force -q 2>/dev/null || git push -u origin master --force -q 2>/dev/null; then
        echo -e "${GREEN}✓ Successfully uploaded: https://github.com/$GITHUB_USERNAME/$repo_name${NC}"
        echo "SUCCESS: $folder_name → https://github.com/$GITHUB_USERNAME/$repo_name" >> "../$LOG_FILE"
        ((SUCCESS_COUNT++))
    else
        # Try creating main branch first
        git checkout -b main 2>/dev/null
        if git push -u origin main --force -q 2>/dev/null; then
            echo -e "${GREEN}✓ Successfully uploaded: https://github.com/$GITHUB_USERNAME/$repo_name${NC}"
            echo "SUCCESS: $folder_name → https://github.com/$GITHUB_USERNAME/$repo_name" >> "../$LOG_FILE"
            ((SUCCESS_COUNT++))
        else
            echo -e "${RED}✗ Failed to push${NC}"
            echo "FAIL: $folder_name - Push failed" >> "../$LOG_FILE"
            ((FAIL_COUNT++))
        fi
    fi
    
    cd ..
    
    # Small delay to avoid rate limiting
    sleep 1
}

# Process all directories
CURRENT=0
for dir in */; do
    if [ -d "$dir" ]; then
        ((CURRENT++))
        folder_name="${dir%/}"
        echo -e "\n${BLUE}[$CURRENT/$TOTAL_COUNT]${NC}"
        upload_project "$folder_name"
    fi
done

# Summary
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                      UPLOAD COMPLETE                         ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓ Successful: $SUCCESS_COUNT${NC}"
echo -e "${YELLOW}⚠ Skipped:    $SKIP_COUNT${NC}"
echo -e "${RED}✗ Failed:     $FAIL_COUNT${NC}"
echo ""
echo -e "Log saved to: ${BLUE}$LOG_FILE${NC}"
echo ""
echo -e "${GREEN}All repos: https://github.com/$GITHUB_USERNAME?tab=repositories${NC}"
