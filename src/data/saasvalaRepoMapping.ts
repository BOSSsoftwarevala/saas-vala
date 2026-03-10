/**
 * Maps all 284 SaaSVala GitHub repositories to marketplace categories.
 * Each entry: { slug, title, category, demoUrl }
 * demoUrl pattern: https://{slug}.saasvala.com
 * github: https://github.com/saasvala/{slug}
 */

export interface RepoProduct {
  slug: string;
  title: string;
  category: string;
  demoUrl: string;
  githubUrl: string;
}

function repo(slug: string, title: string, category: string): RepoProduct {
  return {
    slug,
    title,
    category,
    demoUrl: `https://${slug}.saasvala.com`,
    githubUrl: `https://github.com/saasvala/${slug}`,
  };
}

// ══════════════════════════════════════════
// HEALTHCARE (50 repos)
// ══════════════════════════════════════════
export const healthcareRepos: RepoProduct[] = [
  repo('smarthospital-software', 'SMART HOSPITAL ERP', 'Healthcare'),
  repo('blood-bank-manager', 'BLOOD BANK MANAGER', 'Healthcare'),
  repo('ortho-flow-pro', 'ORTHO CLINIC PRO', 'Healthcare'),
  repo('dermal-suite-pro', 'DERMATOLOGY SUITE', 'Healthcare'),
  repo('ent-clinic-pro', 'ENT CLINIC MANAGER', 'Healthcare'),
  repo('harmony-care-suite', 'HARMONY CARE SUITE', 'Healthcare'),
  repo('clinic-flow-pro', 'CLINIC FLOW PRO', 'Healthcare'),
  repo('clinicflow-pro', 'CLINIC FLOW ADVANCED', 'Healthcare'),
  repo('oncology-care-suite', 'ONCOLOGY CARE SUITE', 'Healthcare'),
  repo('dialysis-flow-pro', 'DIALYSIS FLOW PRO', 'Healthcare'),
  repo('vaccine-hub-pro', 'VACCINE HUB PRO', 'Healthcare'),
  repo('hearingsuite-pro', 'HEARING SUITE PRO', 'Healthcare'),
  repo('little-steps-pediatric', 'PEDIATRIC CLINIC PRO', 'Healthcare'),
  repo('calm-counseling-companion', 'COUNSELING COMPANION', 'Healthcare'),
  repo('mindful-health-suite', 'MENTAL HEALTH SUITE', 'Healthcare'),
  repo('vitality-insight', 'VITALITY INSIGHT', 'Healthcare'),
  repo('rehabflow-pro', 'REHABILITATION SUITE', 'Healthcare'),
  repo('nutriflow-pro', 'NUTRITION TRACKER PRO', 'Healthcare'),
  repo('bloom-health-suite', 'BLOOM HEALTH SUITE', 'Healthcare'),
  repo('pharmacy-rx-counter', 'PHARMACY POS SUITE', 'Healthcare'),
  repo('maternity-care-hub', 'MATERNITY CARE HUB', 'Healthcare'),
  repo('childcare-shield', 'CHILDCARE SHIELD', 'Healthcare'),
  repo('caresphere-suite', 'CARESPHERE SUITE', 'Healthcare'),
  repo('pethealth-guardian', 'VETERINARY CLINIC', 'Healthcare'),
  repo('guardian-health-manager', 'GUARDIAN HEALTH MGR', 'Healthcare'),
  repo('clinical-vault-pro', 'CLINICAL VAULT PRO', 'Healthcare'),
  repo('inner-harmony-coach', 'WELLNESS COACHING', 'Healthcare'),
  repo('immortal-healing-lock', 'HEALING CENTER SYS', 'Healthcare'),
  repo('palliative-care-companion', 'PALLIATIVE CARE SYS', 'Healthcare'),
  repo('carebridge-post-op', 'POST-OP CARE BRIDGE', 'Healthcare'),
  repo('vetflow-pro', 'VET CLINIC FLOW PRO', 'Healthcare'),
  repo('lifelink-manager', 'LIFELINK MANAGER', 'Healthcare'),
  repo('medicalstock-pro', 'MEDICAL STOCK PRO', 'Healthcare'),
  repo('eyecase-digital', 'EYE CLINIC DIGITAL', 'Healthcare'),
  repo('chemist-s-friend', 'CHEMIST FRIEND POS', 'Healthcare'),
  repo('recovery-navigator', 'RECOVERY NAVIGATOR', 'Healthcare'),
  repo('secure-lab-suite', 'PATHOLOGY LAB SUITE', 'Healthcare'),
  repo('stellar-admin-suite', 'HOSPITAL ADMIN SUITE', 'Healthcare'),
  repo('optical-brilliance-suite', 'OPTICAL BRILLIANCE SUITE', 'Healthcare'),
];

// ══════════════════════════════════════════
// EDUCATION (35 repos)
// ══════════════════════════════════════════
export const educationRepos: RepoProduct[] = [
  repo('schoolmanagementsoftware', 'SCHOOL MANAGEMENT SYS', 'Education'),
  repo('core-school-hub', 'CORE SCHOOL HUB', 'Education'),
  repo('magic-learning-worlds', 'MAGIC LEARNING WORLDS', 'Education'),
  repo('ignite-learning-path', 'IGNITE LEARNING PATH', 'Education'),
  repo('lumina-learn', 'LUMINA LEARN LMS', 'Education'),
  repo('lms-pro', 'LMS PRO PLATFORM', 'Education'),
  repo('home-tutor-hub', 'HOME TUTOR HUB', 'Education'),
  repo('coaching-institute', 'COACHING INSTITUTE ERP', 'Education'),
  repo('private-tuition-center', 'TUITION CENTER PRO', 'Education'),
  repo('higher-secondary-school', 'HIGHER SECONDARY ERP', 'Education'),
  repo('eduspark-secondary-suite', 'EDUSPARK SECONDARY', 'Education'),
  repo('primary-school', 'PRIMARY SCHOOL ERP', 'Education'),
  repo('clearpath-learn', 'CLEARPATH LEARN', 'Education'),
  repo('skill-certifier-pro', 'SKILL CERTIFIER PRO', 'Education'),
  repo('training-center-pro', 'TRAINING CENTER PRO', 'Education'),
  repo('playlearn-joy', 'PLAYLEARN JOY (KIDS)', 'Education'),
  repo('campus-harmony', 'CAMPUS HARMONY', 'Education'),
  repo('batch-master-coach', 'BATCH MASTER COACH', 'Education'),
  repo('batch-buddy', 'BATCH BUDDY', 'Education'),
  repo('batch-buddy-ebbf853e', 'BATCH BUDDY PRO', 'Education'),
  repo('wonder-box-kids', 'WONDER BOX KIDS', 'Education'),
  repo('research-hub-secure', 'RESEARCH HUB SECURE', 'Education'),
  repo('sports-register-plus', 'SPORTS REGISTER PLUS', 'Education'),
  repo('academy-flow', 'ACADEMY FLOW', 'Education'),
];

// ══════════════════════════════════════════
// SPORTS & RECREATION (5 repos)
// ══════════════════════════════════════════
export const sportsRepos: RepoProduct[] = [
  repo('cricket-academy-manager', 'CRICKET ACADEMY MGR', 'Sports'),
  repo('club-manager-suite', 'CLUB MANAGER SUITE', 'Sports'),
  repo('splash-swim-manager', 'SWIM ACADEMY MANAGER', 'Sports'),
  repo('trekmaster-pro', 'TREK MASTER PRO', 'Sports'),
];

// ══════════════════════════════════════════
// FINANCE & BANKING (35 repos)
// ══════════════════════════════════════════
export const financeRepos: RepoProduct[] = [
  repo('pocket-currency-pro', 'POCKET CURRENCY PRO', 'Finance'),
  repo('financial-compass', 'FINANCIAL COMPASS', 'Finance'),
  repo('secure-fund-hub', 'SECURE FUND HUB', 'Finance'),
  repo('group-savings-hub', 'GROUP SAVINGS HUB', 'Finance'),
  repo('trusty-funds', 'TRUSTY FUNDS MANAGER', 'Finance'),
  repo('pension-pal', 'PENSION PAL', 'Finance'),
  repo('govsubsidy-manager', 'GOV SUBSIDY MANAGER', 'Finance'),
  repo('debt-guardian', 'DEBT GUARDIAN', 'Finance'),
  repo('nova-finance', 'NOVA FINANCE SUITE', 'Finance'),
  repo('credit-companion', 'CREDIT COMPANION', 'Finance'),
  repo('pocket-pay', 'POCKET PAY WALLET', 'Finance'),
  repo('cooperative-core', 'COOPERATIVE BANK CORE', 'Finance'),
  repo('trade-ledger-pro', 'TRADE LEDGER PRO', 'Finance'),
  repo('ledgerlink-pro', 'LEDGER LINK PRO', 'Finance'),
  repo('secure-atm-manager', 'ATM MANAGER PRO', 'Finance'),
  repo('investwise-offline', 'INVESTWISE OFFLINE', 'Finance'),
  repo('gold-compass', 'GOLD COMPASS', 'Finance'),
  repo('offlinepay-hub', 'OFFLINE PAY HUB', 'Finance'),
  repo('pocket-trader', 'POCKET TRADER', 'Finance'),
  repo('tax-guardian-offline', 'TAX GUARDIAN OFFLINE', 'Finance'),
  repo('branchwise-core', 'BRANCHWISE CORE', 'Finance'),
  repo('apex-digital-bank', 'APEX DIGITAL BANK', 'Finance'),
  repo('binary-balance-builder', 'BALANCE BUILDER PRO', 'Finance'),
  repo('binary-builder-pro', 'BINARY BUILDER PRO', 'Finance'),
  repo('broker-s-book', 'BROKER BOOK', 'Finance'),
  repo('grant-guardian', 'GRANT GUARDIAN', 'Finance'),
  repo('shg-connect', 'SHG CONNECT', 'Finance'),
  repo('impact-compass', 'IMPACT COMPASS NGO', 'Finance'),
  repo('global-send-pro', 'GLOBAL SEND PRO', 'Finance'),
  repo('wallet-key', 'WALLET KEY', 'Finance'),
  repo('spectrum-billing-core', 'SPECTRUM BILLING', 'Finance'),
  repo('cost-practice-companion', 'COST PRACTICE COMP', 'Finance'),
  repo('mql5', 'MQL5 TRADING BOT', 'Finance'),
];

// ══════════════════════════════════════════
// RETAIL & POS (32 repos)
// ══════════════════════════════════════════
export const retailRepos: RepoProduct[] = [
  repo('retail-pos-blueprint', 'RETAIL POS BLUEPRINT', 'Retail'),
  repo('retailflow-ui', 'RETAIL FLOW UI', 'Retail'),
  repo('retail-flow-blueprint', 'RETAIL FLOW SYSTEM', 'Retail'),
  repo('retail-blueprint', 'RETAIL BLUEPRINT ERP', 'Retail'),
  repo('kirana-lite', 'KIRANA LITE POS', 'Retail'),
  repo('kirana-store', 'KIRANA STORE PRO', 'Retail'),
  repo('super-market-pos', 'SUPERMARKET POS', 'Retail'),
  repo('furniture-store-pos', 'FURNITURE STORE POS', 'Retail'),
  repo('stationery-store-pos', 'STATIONERY STORE POS', 'Retail'),
  repo('greenshelf-pos', 'GREEN SHELF POS', 'Retail'),
  repo('flower-shop-pos', 'FLOWER SHOP POS', 'Retail'),
  repo('glimmer-pos', 'GLIMMER JEWELLERY POS', 'Retail'),
  repo('sweet-pos-blueprint', 'SWEET SHOP POS', 'Retail'),
  repo('style-pos-blueprint', 'FASHION STORE POS', 'Retail'),
  repo('evo-pos-blueprint', 'EVO POS SYSTEM', 'Retail'),
  repo('electro-pos-blueprint', 'ELECTRONICS STORE POS', 'Retail'),
  repo('dairy-counter-pos', 'DAIRY COUNTER POS', 'Retail'),
  repo('dairy-counter-companion', 'DAIRY COMPANION', 'Retail'),
  repo('giftflow-pos', 'GIFT SHOP POS', 'Retail'),
  repo('visionflow-pos', 'OPTICAL STORE POS', 'Retail'),
  repo('playzone-pos', 'TOY STORE POS', 'Retail'),
  repo('petstore-pos-ui', 'PET SHOP POS', 'Retail'),
  repo('booksmart-pos-ui', 'BOOK STORE POS', 'Retail'),
  repo('auto-parts-pos-pro', 'AUTO PARTS POS', 'Retail'),
  repo('butcher-pos-ui', 'BUTCHER SHOP POS', 'Retail'),
  repo('hardware-register', 'HARDWARE STORE POS', 'Retail'),
  repo('book-counter-pro', 'BOOK COUNTER PRO', 'Retail'),
  repo('godown-register', 'GODOWN REGISTER', 'Retail'),
  repo('order-ease', 'ORDER EASE POS', 'Retail'),
  repo('aroma-register', 'AROMA REGISTER POS', 'Retail'),
  repo('swift-commerce-hub', 'SWIFT COMMERCE HUB', 'Retail'),
];

// ══════════════════════════════════════════
// FOOD & RESTAURANT (15 repos)
// ══════════════════════════════════════════
export const foodRepos: RepoProduct[] = [
  repo('cafe-counter-pos', 'CAFE COUNTER POS', 'Food'),
  repo('ice-cream-parlour-pos', 'ICE CREAM PARLOUR POS', 'Food'),
  repo('food-truck-pos-pro', 'FOOD TRUCK POS PRO', 'Food'),
  repo('juice-corner-pos', 'JUICE CORNER POS', 'Food'),
  repo('fast-food-pos', 'FAST FOOD POS', 'Food'),
  repo('bakemaster-pro', 'BAKEMASTER PRO', 'Food'),
  repo('mithai-magic', 'MITHAI MAGIC (SWEETS)', 'Food'),
  repo('momos-master', 'MOMOS MASTER POS', 'Food'),
  repo('biometric-meal-pass', 'BIOMETRIC MEAL PASS', 'Food'),
  repo('panpal-daily', 'PAN PAL DAILY', 'Food'),
  repo('pepraji-diary', 'PEPRAJI DIARY', 'Food'),
];

// ══════════════════════════════════════════
// CONSTRUCTION & INFRASTRUCTURE (16 repos)
// ══════════════════════════════════════════
export const constructionRepos: RepoProduct[] = [
  repo('construction-hub', 'CONSTRUCTION HUB ERP', 'Construction'),
  repo('civilbase-pro', 'CIVIL BASE PRO', 'Construction'),
  repo('bridge-master-pro', 'BRIDGE MASTER PRO', 'Construction'),
  repo('bridge-builder-pro', 'BRIDGE BUILDER PRO', 'Construction'),
  repo('bridge-build-hub', 'BRIDGE BUILD HUB', 'Construction'),
  repo('roadworthy-pro', 'ROADWORTHY PRO', 'Construction'),
  repo('sitemaster-pro', 'SITE MASTER PRO', 'Construction'),
  repo('flooring-pro-suite', 'FLOORING PRO SUITE', 'Construction'),
  repo('roofing-companion', 'ROOFING COMPANION', 'Construction'),
  repo('demolition-hub', 'DEMOLITION HUB', 'Construction'),
  repo('civil-hub-pro', 'CIVIL HUB PRO', 'Construction'),
  repo('buildcraft-pro', 'BUILDCRAFT PRO', 'Construction'),
  repo('archifold-workspace', 'ARCHIFOLD WORKSPACE', 'Construction'),
  repo('project-pro-lite', 'PROJECT PRO LITE', 'Construction'),
];

// ══════════════════════════════════════════
// REAL ESTATE & PROPERTY (5 repos)
// ══════════════════════════════════════════
export const realEstateRepos: RepoProduct[] = [
  repo('property-pro-hub', 'PROPERTY PRO HUB', 'Real Estate'),
  repo('property-nexus-hub', 'PROPERTY NEXUS HUB', 'Real Estate'),
  repo('my-pg-manager', 'PG MANAGER PRO', 'Real Estate'),
];

// ══════════════════════════════════════════
// TRANSPORT & AUTOMOTIVE (8 repos)
// ══════════════════════════════════════════
export const transportRepos: RepoProduct[] = [
  repo('rto-agent-hub', 'RTO AGENT HUB', 'Transport'),
  repo('water-boat-ferry', 'WATER BOAT FERRY', 'Transport'),
  repo('cargo-logbook', 'CARGO LOGBOOK', 'Transport'),
  repo('auto-shop-dashboard', 'AUTO SHOP DASHBOARD', 'Transport'),
  repo('bike-job-master', 'BIKE JOB MASTER', 'Transport'),
  repo('bike-job-master-a115944b', 'BIKE JOB MASTER PRO', 'Transport'),
  repo('bike-deal-boss', 'BIKE DEAL BOSS', 'Transport'),
  repo('forecourt-flow', 'FORECOURT FLOW (FUEL)', 'Transport'),
];

// ══════════════════════════════════════════
// BEAUTY & WELLNESS (4 repos)
// ══════════════════════════════════════════
export const beautyRepos: RepoProduct[] = [
  repo('parlour-beauty-salon-management', 'BEAUTY SALON MGMT', 'Beauty'),
  repo('salon-smart-flow', 'SALON SMART FLOW', 'Beauty'),
  repo('gymflow-ui', 'GYM FLOW UI', 'Beauty'),
  repo('serenity-suite', 'SERENITY SPA SUITE', 'Beauty'),
];

// ══════════════════════════════════════════
// INSURANCE (5 repos)
// ══════════════════════════════════════════
export const insuranceRepos: RepoProduct[] = [
  repo('policypal-offline', 'POLICY PAL OFFLINE', 'Insurance'),
  repo('policypal-manager', 'POLICY PAL MANAGER', 'Insurance'),
  repo('secure-policy-hub', 'SECURE POLICY HUB', 'Insurance'),
  repo('secure-policy-hub-e46ec421', 'SECURE POLICY PRO', 'Insurance'),
  repo('policy-guardian-pro', 'POLICY GUARDIAN PRO', 'Insurance'),
];

// ══════════════════════════════════════════
// AGRICULTURE (3 repos)
// ══════════════════════════════════════════
export const agricultureRepos: RepoProduct[] = [
  repo('farmflow-manager', 'FARM FLOW MANAGER', 'Agriculture'),
  repo('crop-guardian', 'CROP GUARDIAN', 'Agriculture'),
];

// ══════════════════════════════════════════
// SERVICES & UTILITIES (8 repos)
// ══════════════════════════════════════════
export const servicesRepos: RepoProduct[] = [
  repo('offline-service-pro', 'OFFLINE SERVICE PRO', 'Services'),
  repo('service-master-pro', 'SERVICE MASTER PRO', 'Services'),
  repo('funeral-flow-manager', 'FUNERAL FLOW MANAGER', 'Services'),
  repo('sefty-tank-cleening', 'SEPTIC TANK CLEANING', 'Services'),
  repo('secure-wasteflow', 'WASTE FLOW MANAGER', 'Services'),
  repo('e-waste-guardian', 'E-WASTE GUARDIAN', 'Services'),
  repo('water-flow-manager', 'WATER FLOW MANAGER', 'Services'),
  repo('camplife-mobile', 'CAMP LIFE MOBILE', 'Services'),
];

// ══════════════════════════════════════════
// IT & TECHNOLOGY (15 repos)
// ══════════════════════════════════════════
export const itRepos: RepoProduct[] = [
  repo('test-vala-api', 'VALA API TEST', 'IT'),
  repo('simple-node-project', 'NODE PROJECT DEMO', 'IT'),
  repo('saas-factory', 'SAAS FACTORY', 'IT'),
  repo('saas-vala', 'SAAS VALA PLATFORM', 'IT'),
  repo('pixel-perfect-ui', 'PIXEL PERFECT UI', 'IT'),
  repo('secure-ai-lab-hub', 'AI LAB HUB', 'IT'),
  repo('alif-cloud-ui', 'ALIF CLOUD UI', 'IT'),
  repo('mysa-dashboard-suite', 'MYSA DASHBOARD SUITE', 'IT'),
  repo('isp-brilliance', 'ISP BRILLIANCE', 'IT'),
  repo('authentiscan-platform', 'AUTHENTISCAN KYC', 'IT'),
  repo('robot-command-center', 'ROBOT COMMAND CENTER', 'IT'),
  repo('star-command-os', 'STAR COMMAND OS', 'IT'),
  repo('secure-aerospace-ops', 'AEROSPACE OPS', 'IT'),
  repo('secure-defense-hub', 'DEFENSE HUB', 'IT'),
  repo('sevenone-assist', 'SEVENONE ASSIST', 'IT'),
];

// ══════════════════════════════════════════
// LEGAL (1 repo)
// ══════════════════════════════════════════
export const legalRepos: RepoProduct[] = [
  repo('diamond-legal-hub', 'DIAMOND LEGAL HUB', 'Legal'),
];

// ══════════════════════════════════════════
// HR & RECRUITMENT (2 repos)
// ══════════════════════════════════════════
export const hrRepos: RepoProduct[] = [
  repo('jobflow-pro', 'JOB FLOW PRO', 'HR'),
];

// ══════════════════════════════════════════
// ENERGY & UTILITIES (2 repos)
// ══════════════════════════════════════════
export const energyRepos: RepoProduct[] = [
  repo('energy-vault', 'ENERGY VAULT', 'Energy'),
];

// ══════════════════════════════════════════
// HOSPITALITY (1 repo)
// ══════════════════════════════════════════
export const hospitalityRepos: RepoProduct[] = [
  repo('scrap-office-master', 'SCRAP OFFICE MASTER', 'Hospitality'),
];

// ══════════════════════════════════════════
// GOVERNMENT / NGO (2 repos)
// ══════════════════════════════════════════
export const govRepos: RepoProduct[] = [
  repo('guinea-connect-hub', 'GUINEA CONNECT HUB', 'Government'),
  repo('aidflow-pro', 'AID FLOW PRO', 'Government'),
  repo('swift-response-core', 'SWIFT RESPONSE CORE', 'Government'),
];

// ═══════════════════════════════════════════
// MASTER EXPORT — All repos by category
// ═══════════════════════════════════════════
export const allReposByCategory: Record<string, RepoProduct[]> = {
  Healthcare: healthcareRepos,
  Education: educationRepos,
  Sports: sportsRepos,
  Finance: financeRepos,
  Retail: retailRepos,
  Food: foodRepos,
  Construction: constructionRepos,
  'Real Estate': realEstateRepos,
  Transport: transportRepos,
  Beauty: beautyRepos,
  Insurance: insuranceRepos,
  Agriculture: agricultureRepos,
  Services: servicesRepos,
  IT: itRepos,
  Legal: legalRepos,
  HR: hrRepos,
  Energy: energyRepos,
  Hospitality: hospitalityRepos,
  Government: govRepos,
};

/** Flat list of all repos */
export const allRepos: RepoProduct[] = Object.values(allReposByCategory).flat();

/** Quick lookup by slug */
export const repoBySlug: Record<string, RepoProduct> = {};
for (const r of allRepos) {
  repoBySlug[r.slug] = r;
}

/** Get category repos, with fallback to empty array */
export function getReposForCategory(category: string): RepoProduct[] {
  return allReposByCategory[category] || [];
}
