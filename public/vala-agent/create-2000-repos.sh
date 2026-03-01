#!/bin/bash

# =============================================================================
# SaaSVala – Create 2000 GitHub Repositories
# Organization: https://github.com/saasvala
# Usage: chmod +x create-2000-repos.sh && ./create-2000-repos.sh
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   SAASVALA – 2000 PRODUCT GITHUB REPO CREATOR v1.0      ║"
echo "║   40 Categories × 50 Products = 2000 Repositories       ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# --- GitHub Token ---
if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${YELLOW}Enter your GitHub Token (ghp_...):${NC}"
    read -s TOKEN
    echo ""
else
    TOKEN="$GITHUB_TOKEN"
fi

if [ -z "$TOKEN" ]; then
    echo -e "${RED}No token provided! Exiting.${NC}"
    exit 1
fi

# --- Choose: org or user ---
ORG="saasvala"
echo -e "${BLUE}Creating repos under: github.com/${ORG}${NC}"

# Validate token
echo -e "${BLUE}Validating token...${NC}"
AUTH_CHECK=$(curl -s -H "Authorization: token $TOKEN" "https://api.github.com/user" | grep '"login"')
if [ -z "$AUTH_CHECK" ]; then
    echo -e "${RED}Invalid token! Exiting.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Token valid${NC}"
echo ""

# --- 40 Category Slugs (exact order) ---
CATEGORIES=(
  "upcoming-products"
  "on-demand-solutions"
  "this-week-top-products"
  "evergreen-software"
  "education-edtech"
  "healthcare-medical-services"
  "real-estate-property-services"
  "ecommerce-online-marketplaces"
  "retail-local-commerce"
  "food-beverage-services"
  "hospitality-tourism"
  "transportation-mobility"
  "logistics-supply-chain"
  "finance-banking-insurance"
  "investment-trading-wealth-management"
  "manufacturing-industrial-production"
  "construction-infrastructure"
  "automotive-electric-vehicles"
  "agriculture-dairy-fisheries"
  "energy-utilities"
  "telecom-internet-services"
  "information-technology-software"
  "cloud-computing-devops"
  "artificial-intelligence-automation"
  "cybersecurity-data-protection"
  "marketing-advertising-branding"
  "media-entertainment-gaming"
  "beauty-fashion-lifestyle"
  "home-facility-services"
  "security-surveillance"
  "government-public-administration"
  "legal-professional-services"
  "sports-fitness-wellness"
  "research-innovation"
  "environment-sustainability"
  "mining-natural-resources"
  "wholesale-distribution"
  "pharmaceuticals-biotechnology"
  "ngo-social-development"
  "investment-infrastructure-capital-projects"
)

# --- Logging ---
LOG="create-repos_$(date +%Y%m%d_%H%M%S).log"
echo "Started: $(date)" > "$LOG"

TOTAL_CREATED=0
TOTAL_SKIPPED=0
TOTAL_FAILED=0
GRAND_TOTAL=$((${#CATEGORIES[@]} * 50))

echo -e "${CYAN}Total repos to create: ${GRAND_TOTAL}${NC}"
echo ""

# --- Working directory ---
WORKDIR=$(mktemp -d)
echo -e "${BLUE}Working directory: $WORKDIR${NC}"
echo ""

# --- Main Loop ---
for ROW_IDX in "${!CATEGORIES[@]}"; do
    ROW_NUM=$((ROW_IDX + 1))
    CATEGORY="${CATEGORIES[$ROW_IDX]}"

    echo -e "${CYAN}━━━ ROW ${ROW_NUM}/40: ${CATEGORY} ━━━${NC}"

    for PRODUCT_NUM in $(seq 1 50); do
        REPO_NAME="ai-${CATEGORY}-software-${PRODUCT_NUM}"
        COUNTER=$(( (ROW_IDX * 50) + PRODUCT_NUM ))

        echo -ne "${BLUE}[${COUNTER}/${GRAND_TOTAL}]${NC} ${REPO_NAME} ... "

        # --- Check if repo already exists ---
        EXISTS=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "Authorization: token $TOKEN" \
            "https://api.github.com/repos/${ORG}/${REPO_NAME}")

        if [ "$EXISTS" = "200" ]; then
            echo -e "${YELLOW}EXISTS (skipped)${NC}"
            ((TOTAL_SKIPPED++))
            echo "SKIPPED: $REPO_NAME (already exists)" >> "$LOG"
            continue
        fi

        # --- Create repo via org endpoint ---
        CREATE_RESP=$(curl -s -X POST \
            -H "Authorization: token $TOKEN" \
            -H "Accept: application/vnd.github.v3+json" \
            "https://api.github.com/orgs/${ORG}/repos" \
            -d "{
                \"name\": \"${REPO_NAME}\",
                \"description\": \"SaaS Vala - Row ${ROW_NUM} Product ${PRODUCT_NUM} | ${CATEGORY} | Enterprise Software Solution\",
                \"private\": false,
                \"auto_init\": false,
                \"has_issues\": true,
                \"has_projects\": false,
                \"has_wiki\": false
            }")

        # Check if creation succeeded
        CREATED_NAME=$(echo "$CREATE_RESP" | grep -o '"full_name":"[^"]*"' | head -1)
        if [ -z "$CREATED_NAME" ]; then
            # Try user endpoint as fallback
            CREATE_RESP=$(curl -s -X POST \
                -H "Authorization: token $TOKEN" \
                -H "Accept: application/vnd.github.v3+json" \
                "https://api.github.com/user/repos" \
                -d "{
                    \"name\": \"${REPO_NAME}\",
                    \"description\": \"SaaS Vala - Row ${ROW_NUM} Product ${PRODUCT_NUM} | ${CATEGORY}\",
                    \"private\": false,
                    \"auto_init\": false
                }")
            CREATED_NAME=$(echo "$CREATE_RESP" | grep -o '"full_name":"[^"]*"' | head -1)
        fi

        if [ -z "$CREATED_NAME" ]; then
            echo -e "${RED}FAILED${NC}"
            echo "FAILED: $REPO_NAME | Response: $CREATE_RESP" >> "$LOG"
            ((TOTAL_FAILED++))
            sleep 1
            continue
        fi

        # --- Scaffold code and push ---
        REPO_DIR="${WORKDIR}/${REPO_NAME}"
        mkdir -p "${REPO_DIR}/frontend/src" "${REPO_DIR}/frontend/public" \
                 "${REPO_DIR}/backend/src" "${REPO_DIR}/backend/routes" \
                 "${REPO_DIR}/database/migrations" "${REPO_DIR}/database/seeds" \
                 "${REPO_DIR}/docs"

        # README.md
        cat > "${REPO_DIR}/README.md" << READMEEOF
# ${REPO_NAME}

> **SaaS Vala** — Row ${ROW_NUM}, Product ${PRODUCT_NUM}
> Category: \`${CATEGORY}\`

## 🚀 Enterprise Software Solution

Professional-grade SaaS application with full analytics, role-based access, and seamless integrations.

### Tech Stack

| Layer     | Technology  |
|-----------|-------------|
| Frontend  | React       |
| Backend   | Node.js     |
| Database  | PostgreSQL  |
| AI        | Integrated  |
| Auth      | JWT         |
| Payments  | Stripe      |

### Features

- ✅ APK Download
- ✅ License Key Activation
- ✅ Auto Updates
- ✅ 24/7 Support

### Routes

| Route       | Path |
|-------------|------|
| Marketplace | \`/saasvala/${CATEGORY}/${ROW_NUM}/${PRODUCT_NUM}\` |
| API         | \`/api/${CATEGORY}/${PRODUCT_NUM}\` |
| Demo        | \`/demo/${CATEGORY}/${PRODUCT_NUM}\` |
| Buy         | \`/buy/${CATEGORY}/${PRODUCT_NUM}\` |

### Pricing

- ~~\$10~~ → **\$5** (90% OFF)
- ⭐ Rating: 4.9

---

© SaaS Vala | [softwarevala.net](https://softwarevala.net)
READMEEOF

        # package.json
        cat > "${REPO_DIR}/package.json" << PKGEOF
{
  "name": "${REPO_NAME}",
  "version": "1.0.0",
  "description": "SaaS Vala - Row ${ROW_NUM} Product ${PRODUCT_NUM} | ${CATEGORY}",
  "main": "backend/src/index.js",
  "scripts": {
    "dev": "concurrently \"npm run dev:frontend\" \"npm run dev:backend\"",
    "dev:frontend": "cd frontend && npm run dev",
    "dev:backend": "cd backend && npm run dev",
    "build": "cd frontend && npm run build",
    "start": "node backend/src/index.js"
  },
  "keywords": ["saasvala", "${CATEGORY}", "enterprise", "saas"],
  "author": "SaaS Vala",
  "license": "MIT"
}
PKGEOF

        # .env.example
        cat > "${REPO_DIR}/.env.example" << ENVEOF
DATABASE_URL=postgresql://user:pass@localhost:5432/${REPO_NAME}
JWT_SECRET=your-secret-key
STRIPE_KEY=sk_test_xxx
PORT=5000
NODE_ENV=production
ENVEOF

        # backend/src/index.js
        cat > "${REPO_DIR}/backend/src/index.js" << BACKEOF
const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    product: '${REPO_NAME}',
    row: ${ROW_NUM},
    category: '${CATEGORY}'
  });
});

app.get('/api/${CATEGORY}/${PRODUCT_NUM}', (req, res) => {
  res.json({
    row: ${ROW_NUM},
    product: ${PRODUCT_NUM},
    category: '${CATEGORY}',
    slug: '${REPO_NAME}',
    price: 5,
    old_price: 10,
    discount: '90%',
    rating: 4.9,
    badges: ['LIVE DEMO'],
    features: ['APK Download', 'License Key', 'Auto Updates', '24/7 Support']
  });
});

app.listen(PORT, () => console.log(\`${REPO_NAME} running on port \${PORT}\`));
BACKEOF

        # frontend/src/App.jsx
        cat > "${REPO_DIR}/frontend/src/App.jsx" << FRONTEOF
import React from 'react';

export default function App() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', background: '#0a0a0a', color: '#fff', minHeight: '100vh' }}>
      <h1>${REPO_NAME}</h1>
      <p>Row ${ROW_NUM} | Product ${PRODUCT_NUM} | ${CATEGORY}</p>
      <p>Enterprise Software Solution by SaaS Vala</p>
      <div style={{ marginTop: '1rem' }}>
        <span style={{ background: '#22c55e', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>LIVE DEMO</span>
        <span style={{ background: '#f97316', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', marginLeft: '8px' }}>90% OFF</span>
      </div>
      <p style={{ marginTop: '1rem' }}><s>\$10</s> → <strong>\$5</strong></p>
    </div>
  );
}
FRONTEOF

        # database/migrations/001_init.sql
        cat > "${REPO_DIR}/database/migrations/001_init.sql" << SQLEOF
-- ${REPO_NAME} Initial Schema
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  license_key VARCHAR(255) UNIQUE NOT NULL,
  product_slug VARCHAR(255) DEFAULT '${REPO_NAME}',
  status VARCHAR(50) DEFAULT 'active',
  activated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);
SQLEOF

        # docs/API.md
        cat > "${REPO_DIR}/docs/API.md" << DOCEOF
# API Documentation — ${REPO_NAME}

## Endpoints

### Health Check
\`\`\`
GET /health
\`\`\`

### Product API
\`\`\`
GET /api/${CATEGORY}/${PRODUCT_NUM}
\`\`\`

### Marketplace
\`\`\`
/saasvala/${CATEGORY}/${ROW_NUM}/${PRODUCT_NUM}
\`\`\`
DOCEOF

        # .gitignore
        cat > "${REPO_DIR}/.gitignore" << GIEOF
node_modules/
.env
dist/
build/
*.log
GIEOF

        # --- Git init + push ---
        cd "${REPO_DIR}"
        git init -q
        git add -A
        git commit -q -m "🚀 SaaS Vala | Row ${ROW_NUM} Product ${PRODUCT_NUM} | ${CATEGORY} | Auto-scaffolded"
        git branch -M main
        git remote add origin "https://${TOKEN}@github.com/${ORG}/${REPO_NAME}.git" 2>/dev/null

        if git push -u origin main --force -q 2>/dev/null; then
            echo -e "${GREEN}✓ CREATED + PUSHED${NC}"
            echo "SUCCESS: $REPO_NAME" >> "${WORKDIR}/../${LOG}" 2>/dev/null || echo "SUCCESS: $REPO_NAME" >> "$LOG"
            ((TOTAL_CREATED++))
        else
            echo -e "${RED}✗ PUSH FAILED${NC}"
            echo "PUSH_FAILED: $REPO_NAME" >> "${WORKDIR}/../${LOG}" 2>/dev/null || echo "PUSH_FAILED: $REPO_NAME" >> "$LOG"
            ((TOTAL_FAILED++))
        fi

        cd - > /dev/null

        # Cleanup to save disk
        rm -rf "${REPO_DIR}"

        # Rate limit: GitHub allows ~5000 req/hour, be safe
        sleep 2
    done

    echo -e "${GREEN}✓ Row ${ROW_NUM} complete${NC}"
    echo ""
done

# --- Final Summary ---
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║              FINAL REPORT                                ║${NC}"
echo -e "${CYAN}╠═══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  ✓ Created:  ${TOTAL_CREATED}${NC}"
echo -e "${YELLOW}║  ⊘ Skipped:  ${TOTAL_SKIPPED}${NC}"
echo -e "${RED}║  ✗ Failed:   ${TOTAL_FAILED}${NC}"
echo -e "${CYAN}║  Total:      ${GRAND_TOTAL}${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Log file: ${YELLOW}${LOG}${NC}"
echo -e "View repos: ${GREEN}https://github.com/orgs/saasvala/repositories${NC}"
echo ""

# Cleanup
rm -rf "$WORKDIR"
