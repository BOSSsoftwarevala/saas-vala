export interface MarketplaceCategory {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeVariant: 'hot' | 'new' | 'trending' | 'limited' | 'live' | 'top';
  keywords: string[];
}

export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  // Row 1–5 are handled by dedicated components (UpcomingSection, OnDemandSection, etc.)
  // Rows 6–40 are rendered dynamically:
  { id: 'healthcare', icon: '🏥', title: 'Healthcare & Medical', subtitle: 'Hospital, Clinic, Pharmacy & Lab solutions.', badge: 'ESSENTIAL', badgeVariant: 'live', keywords: ['healthcare', 'hospital', 'clinic', 'medical'] },
  { id: 'finance', icon: '💰', title: 'Finance & Banking', subtitle: 'Banking, Loan, Insurance & Investment platforms.', badge: 'HIGH DEMAND', badgeVariant: 'hot', keywords: ['finance', 'banking', 'loan', 'investment'] },
  { id: 'retail', icon: '🛒', title: 'Retail & POS', subtitle: 'Point of Sale for every store type.', badge: 'BESTSELLER', badgeVariant: 'trending', keywords: ['retail', 'pos', 'store', 'shop'] },
  { id: 'restaurant', icon: '🍽️', title: 'Restaurant & Food', subtitle: 'POS, Kitchen, Delivery & Cloud Kitchen.', badge: 'TOP RATED', badgeVariant: 'top', keywords: ['restaurant', 'food', 'cafe', 'kitchen'] },
  { id: 'hotel', icon: '🏨', title: 'Hotel & Hospitality', subtitle: 'PMS, Booking, Revenue & Guest Management.', badge: 'PREMIUM', badgeVariant: 'new', keywords: ['hotel', 'resort', 'hospitality', 'pms'] },
  { id: 'logistics', icon: '📦', title: 'Logistics & Supply Chain', subtitle: 'Fleet, Freight, Courier & Delivery.', badge: 'TRENDING', badgeVariant: 'trending', keywords: ['logistics', 'courier', 'freight', 'supply'] },
  { id: 'real_estate', icon: '🏠', title: 'Real Estate & Property', subtitle: 'CRM, Portal, Builder & Tenant Management.', badge: 'HOT', badgeVariant: 'hot', keywords: ['real_estate', 'property', 'builder', 'rental'] },
  { id: 'construction', icon: '🏗️', title: 'Construction & Infrastructure', subtitle: 'Project, Site, Material & Safety Management.', badge: 'ENTERPRISE', badgeVariant: 'limited', keywords: ['construction', 'site', 'builder', 'infrastructure'] },
  { id: 'manufacturing', icon: '🏭', title: 'Manufacturing & Factory', subtitle: 'Production, Quality, MES & Shop Floor.', badge: 'INDUSTRIAL', badgeVariant: 'live', keywords: ['manufacturing', 'factory', 'production'] },
  { id: 'agriculture', icon: '🌾', title: 'Agriculture & Farming', subtitle: 'Farm, Crop, Livestock & Precision Agriculture.', badge: 'GREEN', badgeVariant: 'new', keywords: ['agriculture', 'farm', 'crop', 'livestock'] },
  { id: 'legal', icon: '⚖️', title: 'Legal & Law Firm', subtitle: 'Case, Court, Contract & Compliance.', badge: 'PROFESSIONAL', badgeVariant: 'top', keywords: ['legal', 'law', 'court', 'case'] },
  { id: 'government', icon: '🏛️', title: 'Government & E-Governance', subtitle: 'Municipality, Panchayat & Citizen Portal.', badge: 'OFFICIAL', badgeVariant: 'live', keywords: ['government', 'municipality', 'panchayat', 'governance'] },
  { id: 'ngo', icon: '🤝', title: 'NGO & Non-Profit', subtitle: 'Donor, Volunteer, Grant & Impact Management.', badge: 'SOCIAL', badgeVariant: 'new', keywords: ['ngo', 'charity', 'foundation', 'nonprofit'] },
  { id: 'gym_sports', icon: '💪', title: 'Gym & Sports', subtitle: 'Member, Trainer, Academy & Tournament.', badge: 'FITNESS', badgeVariant: 'trending', keywords: ['gym', 'sports', 'fitness', 'academy'] },
  { id: 'salon_spa', icon: '💇', title: 'Salon & Spa', subtitle: 'Appointment, Staff, Client & Billing.', badge: 'BEAUTY', badgeVariant: 'hot', keywords: ['salon', 'spa', 'beauty', 'wellness'] },
  { id: 'fashion', icon: '👗', title: 'Fashion & Textile', subtitle: 'Boutique, Garment, Design & Retail.', badge: 'STYLE', badgeVariant: 'trending', keywords: ['fashion', 'textile', 'garment', 'boutique'] },
  { id: 'ecommerce', icon: '🛍️', title: 'E-Commerce & Marketplace', subtitle: 'Multi Vendor, B2B, Dropshipping & Social Commerce.', badge: 'MEGA', badgeVariant: 'hot', keywords: ['ecommerce', 'marketplace', 'vendor', 'commerce'] },
  { id: 'mlm', icon: '🔗', title: 'MLM & Network Marketing', subtitle: 'Binary, Matrix, Unilevel & Hybrid Plans.', badge: 'NETWORK', badgeVariant: 'limited', keywords: ['mlm', 'network', 'direct_selling'] },
  { id: 'billing', icon: '🧾', title: 'Billing & Invoicing', subtitle: 'GST, Subscription, Utility & Recurring Billing.', badge: 'ESSENTIAL', badgeVariant: 'live', keywords: ['billing', 'invoice', 'gst'] },
  { id: 'transport', icon: '🚗', title: 'Transport & Vehicle', subtitle: 'Bus, Taxi, Fleet, Rental & Logistics.', badge: 'MOBILITY', badgeVariant: 'trending', keywords: ['transport', 'taxi', 'bus', 'vehicle'] },
  { id: 'hrms', icon: '👥', title: 'HRMS & People', subtitle: 'Recruitment, Attendance, Performance & Payroll.', badge: 'HR TECH', badgeVariant: 'top', keywords: ['hrms', 'hr', 'people', 'recruitment'] },
  { id: 'payroll', icon: '💵', title: 'Payroll & Salary', subtitle: 'Multi Country, Statutory & Compliance Payroll.', badge: 'FINANCE', badgeVariant: 'live', keywords: ['payroll', 'salary', 'wage'] },
  { id: 'warehouse', icon: '🏬', title: 'Warehouse & WMS', subtitle: 'Inventory, Fulfillment, Cold Storage & 3PL.', badge: 'STORAGE', badgeVariant: 'new', keywords: ['warehouse', 'wms', 'inventory', 'fulfillment'] },
  { id: 'pharmacy', icon: '💊', title: 'Pharmacy & Drug Store', subtitle: 'POS, Prescription, Inventory & Chain Management.', badge: 'MEDICAL', badgeVariant: 'live', keywords: ['pharmacy', 'drug', 'medical_store'] },
  { id: 'clinic', icon: '🩺', title: 'Clinic & Doctor Practice', subtitle: 'Appointment, EMR, Billing & Telemedicine.', badge: 'HEALTH', badgeVariant: 'top', keywords: ['clinic', 'doctor', 'practice', 'polyclinic'] },
  { id: 'telecom', icon: '📡', title: 'Telecom & ISP', subtitle: 'Billing, Network, Tower & CRM.', badge: 'NETWORK', badgeVariant: 'trending', keywords: ['telecom', 'isp', 'cable', 'broadband'] },
  { id: 'cybersecurity', icon: '🛡️', title: 'Cybersecurity & InfoSec', subtitle: 'SIEM, SOC, Threat Intel & Compliance.', badge: 'SECURE', badgeVariant: 'hot', keywords: ['cybersecurity', 'security', 'siem', 'soc'] },
  { id: 'data_analytics', icon: '📊', title: 'Data Analytics & BI', subtitle: 'Dashboard, Reporting, ETL & AI Analytics.', badge: 'INSIGHT', badgeVariant: 'top', keywords: ['data_analytics', 'analytics', 'bi', 'reporting'] },
  { id: 'investment', icon: '📈', title: 'Investment & Portfolio', subtitle: 'Stocks, Mutual Funds, Wealth & Robo Advisor.', badge: 'WEALTH', badgeVariant: 'hot', keywords: ['investment', 'portfolio', 'wealth'] },
  { id: 'crypto_forex', icon: '₿', title: 'Crypto & Forex', subtitle: 'Exchange, DeFi, Trading Bot & Wallet.', badge: 'WEB3', badgeVariant: 'limited', keywords: ['crypto', 'forex', 'defi', 'bitcoin'] },
  { id: 'insurance', icon: '🛡️', title: 'Insurance & InsurTech', subtitle: 'Policy, Claims, Underwriting & Agent Management.', badge: 'PROTECT', badgeVariant: 'live', keywords: ['insurance', 'policy', 'claims'] },
  { id: 'dairy', icon: '🥛', title: 'Dairy & Milk', subtitle: 'Collection, Processing, Distribution & Cooperative.', badge: 'AGRI', badgeVariant: 'new', keywords: ['dairy', 'milk', 'cattle'] },
  { id: 'mining', icon: '⛏️', title: 'Mining & Minerals', subtitle: 'Planning, Processing, Safety & Compliance.', badge: 'HEAVY', badgeVariant: 'limited', keywords: ['mining', 'mineral', 'ore'] },
  { id: 'energy', icon: '⚡', title: 'Energy & Power', subtitle: 'Solar, Wind, Grid & EV Charging.', badge: 'POWER', badgeVariant: 'trending', keywords: ['energy', 'solar', 'wind', 'power'] },
  { id: 'iot_factory', icon: '🤖', title: 'IoT & Smart Factory', subtitle: 'Sensors, Digital Twin, Edge & Smart City.', badge: 'INDUSTRY 4.0', badgeVariant: 'hot', keywords: ['iot', 'smart', 'sensor', 'factory'] },
];
