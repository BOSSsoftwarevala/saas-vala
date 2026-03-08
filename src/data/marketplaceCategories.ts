export interface MarketplaceCategory {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeVariant: 'hot' | 'new' | 'trending' | 'limited' | 'live' | 'top';
  keywords: string[];
}

/**
 * Rows 1–5 are handled by dedicated components:
 *   1. Upcoming Products (UpcomingSection)
 *   2. On-Demand Solutions (OnDemandSection)
 *   3. This Week Top Products (TopSellingSection)
 *   4. Evergreen Software (PopularProductsSection)
 *   5. Education & EdTech (EducationSection)
 *
 * Rows 6–40 below are rendered dynamically via MarketplaceCategoryRow.
 */
export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  // 6
  { id: 'healthcare', icon: '🏥', title: 'Healthcare & Medical', subtitle: 'Hospital, Clinic, Pharmacy & Lab solutions.', badge: 'ESSENTIAL', badgeVariant: 'live', keywords: ['healthcare', 'hospital', 'clinic', 'medical'] },
  // 7
  { id: 'real_estate', icon: '🏠', title: 'Real Estate', subtitle: 'CRM, Portal, Builder & Tenant Management.', badge: 'HOT', badgeVariant: 'hot', keywords: ['real_estate', 'property', 'builder', 'rental'] },
  // 8
  { id: 'ecommerce', icon: '🛍️', title: 'E-Commerce', subtitle: 'Multi Vendor, B2B, Dropshipping & Social Commerce.', badge: 'MEGA', badgeVariant: 'hot', keywords: ['ecommerce', 'marketplace', 'vendor', 'commerce'] },
  // 9
  { id: 'retail', icon: '🛒', title: 'Retail Commerce', subtitle: 'Point of Sale for every store type.', badge: 'BESTSELLER', badgeVariant: 'trending', keywords: ['retail', 'pos', 'store', 'shop'] },
  // 10
  { id: 'restaurant', icon: '🍽️', title: 'Food & Beverage', subtitle: 'POS, Kitchen, Delivery & Cloud Kitchen.', badge: 'TOP RATED', badgeVariant: 'top', keywords: ['restaurant', 'food', 'cafe', 'kitchen', 'beverage'] },
  // 11
  { id: 'hotel', icon: '🏨', title: 'Hospitality & Tourism', subtitle: 'PMS, Booking, Revenue & Guest Management.', badge: 'PREMIUM', badgeVariant: 'new', keywords: ['hotel', 'resort', 'hospitality', 'pms', 'tourism'] },
  // 12
  { id: 'transport', icon: '🚗', title: 'Transportation', subtitle: 'Bus, Taxi, Fleet, Rental & Logistics.', badge: 'MOBILITY', badgeVariant: 'trending', keywords: ['transport', 'taxi', 'bus', 'vehicle'] },
  // 13
  { id: 'logistics', icon: '📦', title: 'Logistics & Supply Chain', subtitle: 'Fleet, Freight, Courier & Delivery.', badge: 'TRENDING', badgeVariant: 'trending', keywords: ['logistics', 'courier', 'freight', 'supply'] },
  // 14
  { id: 'finance', icon: '💰', title: 'Finance & Banking', subtitle: 'Banking, Loan, Insurance & Investment platforms.', badge: 'HIGH DEMAND', badgeVariant: 'hot', keywords: ['finance', 'banking', 'loan', 'investment'] },
  // 15
  { id: 'investment', icon: '📈', title: 'Investment & Wealth', subtitle: 'Stocks, Mutual Funds, Wealth & Robo Advisor.', badge: 'WEALTH', badgeVariant: 'hot', keywords: ['investment', 'portfolio', 'wealth', 'trading'] },
  // 16
  { id: 'manufacturing', icon: '🏭', title: 'Manufacturing', subtitle: 'Production, Quality, MES & Shop Floor.', badge: 'INDUSTRIAL', badgeVariant: 'live', keywords: ['manufacturing', 'factory', 'production'] },
  // 17
  { id: 'construction', icon: '🏗️', title: 'Construction', subtitle: 'Project, Site, Material & Safety Management.', badge: 'ENTERPRISE', badgeVariant: 'limited', keywords: ['construction', 'site', 'builder', 'infrastructure'] },
  // 18
  { id: 'automotive', icon: '🚘', title: 'Automotive & EV', subtitle: 'Dealership, Service Center, EV & Fleet.', badge: 'INNOVATION', badgeVariant: 'new', keywords: ['automotive', 'car', 'ev', 'vehicle', 'dealership'] },
  // 19
  { id: 'agriculture', icon: '🌾', title: 'Agriculture', subtitle: 'Farm, Crop, Livestock & Precision Agriculture.', badge: 'GREEN', badgeVariant: 'new', keywords: ['agriculture', 'farm', 'crop', 'livestock'] },
  // 20
  { id: 'energy', icon: '⚡', title: 'Energy', subtitle: 'Solar, Wind, Grid & EV Charging.', badge: 'POWER', badgeVariant: 'trending', keywords: ['energy', 'solar', 'wind', 'power'] },
  // 21
  { id: 'telecom', icon: '📡', title: 'Telecom', subtitle: 'Billing, Network, Tower & CRM.', badge: 'NETWORK', badgeVariant: 'trending', keywords: ['telecom', 'isp', 'cable', 'broadband'] },
  // 22
  { id: 'it_software', icon: '💻', title: 'IT Software', subtitle: 'ERP, CRM, HRMS, Helpdesk & Custom Dev.', badge: 'TECH', badgeVariant: 'top', keywords: ['it', 'software', 'erp', 'helpdesk', 'saas'] },
  // 23
  { id: 'cloud_devops', icon: '☁️', title: 'Cloud DevOps', subtitle: 'CI/CD, Monitoring, Infrastructure & Containers.', badge: 'CLOUD', badgeVariant: 'live', keywords: ['cloud', 'devops', 'kubernetes', 'docker', 'cicd'] },
  // 24
  { id: 'ai_automation', icon: '🤖', title: 'Artificial Intelligence', subtitle: 'AI Agents, ML Models, NLP & Computer Vision.', badge: 'AI', badgeVariant: 'hot', keywords: ['ai', 'ml', 'artificial_intelligence', 'automation', 'nlp'] },
  // 25
  { id: 'cybersecurity', icon: '🛡️', title: 'Cybersecurity', subtitle: 'SIEM, SOC, Threat Intel & Compliance.', badge: 'SECURE', badgeVariant: 'hot', keywords: ['cybersecurity', 'security', 'siem', 'soc'] },
  // 26
  { id: 'marketing', icon: '📣', title: 'Marketing & Branding', subtitle: 'SEO, Social Media, Content & Ad Management.', badge: 'GROWTH', badgeVariant: 'trending', keywords: ['marketing', 'branding', 'seo', 'social_media', 'advertising'] },
  // 27
  { id: 'media_gaming', icon: '🎮', title: 'Media & Gaming', subtitle: 'Streaming, Publishing, eSports & Game Dev.', badge: 'ENTERTAINMENT', badgeVariant: 'top', keywords: ['media', 'gaming', 'streaming', 'entertainment', 'esports'] },
  // 28
  { id: 'beauty_fashion', icon: '💄', title: 'Beauty & Fashion', subtitle: 'Salon, Spa, Boutique & Fashion Retail.', badge: 'STYLE', badgeVariant: 'trending', keywords: ['beauty', 'fashion', 'salon', 'spa', 'boutique', 'textile'] },
  // 29
  { id: 'home_services', icon: '🏡', title: 'Home Services', subtitle: 'Plumbing, Cleaning, Maintenance & Repairs.', badge: 'LOCAL', badgeVariant: 'new', keywords: ['home', 'service', 'plumbing', 'cleaning', 'maintenance', 'repair'] },
  // 30
  { id: 'security_systems', icon: '📹', title: 'Security Systems', subtitle: 'CCTV, Access Control, Alarm & Surveillance.', badge: 'PROTECT', badgeVariant: 'live', keywords: ['security', 'cctv', 'surveillance', 'access_control', 'alarm'] },
  // 31
  { id: 'government', icon: '🏛️', title: 'Government Systems', subtitle: 'Municipality, Panchayat & Citizen Portal.', badge: 'OFFICIAL', badgeVariant: 'live', keywords: ['government', 'municipality', 'panchayat', 'governance'] },
  // 32
  { id: 'legal', icon: '⚖️', title: 'Legal Services', subtitle: 'Case, Court, Contract & Compliance.', badge: 'PROFESSIONAL', badgeVariant: 'top', keywords: ['legal', 'law', 'court', 'case'] },
  // 33
  { id: 'gym_sports', icon: '💪', title: 'Sports & Fitness', subtitle: 'Member, Trainer, Academy & Tournament.', badge: 'FITNESS', badgeVariant: 'trending', keywords: ['gym', 'sports', 'fitness', 'academy'] },
  // 34
  { id: 'research', icon: '🔬', title: 'Research & Innovation', subtitle: 'Labs, R&D, Patents & Academic Research.', badge: 'DISCOVERY', badgeVariant: 'new', keywords: ['research', 'innovation', 'lab', 'patent', 'rnd'] },
  // 35
  { id: 'environment', icon: '🌱', title: 'Environment & Sustainability', subtitle: 'Carbon Tracking, Recycling & Green Energy.', badge: 'ECO', badgeVariant: 'new', keywords: ['environment', 'sustainability', 'carbon', 'recycling', 'green'] },
  // 36
  { id: 'mining', icon: '⛏️', title: 'Mining', subtitle: 'Planning, Processing, Safety & Compliance.', badge: 'HEAVY', badgeVariant: 'limited', keywords: ['mining', 'mineral', 'ore'] },
  // 37
  { id: 'wholesale', icon: '🏬', title: 'Wholesale Distribution', subtitle: 'B2B, Bulk, Warehousing & Distributor Management.', badge: 'BULK', badgeVariant: 'live', keywords: ['wholesale', 'distribution', 'distributor', 'bulk', 'warehouse'] },
  // 38
  { id: 'pharma', icon: '💊', title: 'Pharma & Biotech', subtitle: 'Drug Discovery, Clinical Trials & Compliance.', badge: 'BIOTECH', badgeVariant: 'top', keywords: ['pharma', 'biotech', 'drug', 'clinical', 'pharmacy'] },
  // 39
  { id: 'ngo', icon: '🤝', title: 'NGO Systems', subtitle: 'Donor, Volunteer, Grant & Impact Management.', badge: 'SOCIAL', badgeVariant: 'new', keywords: ['ngo', 'charity', 'foundation', 'nonprofit'] },
  // 40
  { id: 'capital_infra', icon: '🏗️', title: 'Capital Infrastructure', subtitle: 'PPP, Mega Projects, Bridges & Smart Cities.', badge: 'MEGA PROJECT', badgeVariant: 'limited', keywords: ['capital', 'infrastructure', 'ppp', 'mega_project', 'smart_city'] },
];
