import { educationSystems } from './educationProducts';
import { healthcareSystems } from './healthcareData';
import { governmentSystems } from './governmentData';

// Category definitions for marketplace
export const categories = [
  { id: 'upcoming', title: 'UPCOMING', icon: '🚀' },
  { id: 'this-week', title: 'THIS WEEK', icon: '📅' },
  { id: 'top-selling', title: 'TOP SELLING', icon: '🔥' },
  { id: 'best-selling', title: 'BEST SELLING', icon: '⭐' },
  { id: 'education', title: 'EDUCATION', icon: '📚' },
  { id: 'healthcare', title: 'HEALTHCARE', icon: '🏥' },
  { id: 'government', title: 'GOVERNMENT', icon: '🏛️' },
  { id: 'retail', title: 'RETAIL', icon: '🛒' },
  { id: 'food-hospitality', title: 'FOOD & HOSPITALITY', icon: '🍽️' },
  { id: 'transport', title: 'TRANSPORT', icon: '🚗' },
  { id: 'logistics', title: 'LOGISTICS', icon: '📦' },
  { id: 'manufacturing', title: 'MANUFACTURING', icon: '🏭' },
  { id: 'construction', title: 'CONSTRUCTION', icon: '🏗️' },
  { id: 'agriculture', title: 'AGRICULTURE', icon: '🌾' },
  { id: 'real-estate', title: 'REAL ESTATE', icon: '🏠' },
  { id: 'finance', title: 'FINANCE', icon: '💰' },
  { id: 'insurance', title: 'INSURANCE', icon: '🛡️' },
  { id: 'automobile', title: 'AUTOMOBILE', icon: '🚙' },
  { id: 'energy-utilities', title: 'ENERGY & UTILITIES', icon: '⚡' },
  { id: 'home-services', title: 'HOME SERVICES', icon: '🔧' },
  { id: 'professional-services', title: 'PROFESSIONAL SERVICES', icon: '💼' },
  { id: 'media-creators', title: 'MEDIA & CREATORS', icon: '🎬' },
  { id: 'events-entertainment', title: 'EVENTS & ENTERTAINMENT', icon: '🎉' },
  { id: 'travel-tourism', title: 'TRAVEL & TOURISM', icon: '✈️' },
  { id: 'security-services', title: 'SECURITY SERVICES', icon: '🔒' },
  { id: 'ngo-social', title: 'NGO & SOCIAL', icon: '🤝' },
  { id: 'religious-services', title: 'RELIGIOUS SERVICES', icon: '🕌' },
  { id: 'warehousing', title: 'WAREHOUSING', icon: '🏢' },
  { id: 'technology-services', title: 'TECHNOLOGY SERVICES', icon: '💻' },
];

// Sample product images (real business photos from Unsplash)
const businessImages = {
  education: [
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop',
  ],
  healthcare: [
    'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=400&h=300&fit=crop',
  ],
  retail: [
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400&h=300&fit=crop',
  ],
  food: [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop',
  ],
  transport: [
    'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=400&h=300&fit=crop',
  ],
  finance: [
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&h=300&fit=crop',
  ],
  construction: [
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1531834685032-c34bf0d84c77?w=400&h=300&fit=crop',
  ],
  realestate: [
    'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1560184897-ae75f418493e?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1565402170291-8491f14678db?w=400&h=300&fit=crop',
  ],
  technology: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=300&fit=crop',
  ],
  logistics: [
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1553413077-190dd305871c?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=400&h=300&fit=crop',
  ],
  agriculture: [
    'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1592982537447-6f2a6a0c8a9a?w=400&h=300&fit=crop',
  ],
  events: [
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1511578314322-379afb476865?w=400&h=300&fit=crop',
  ],
  travel: [
    'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1488085061387-422e29b40080?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=300&fit=crop',
  ],
  generic: [
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=400&h=300&fit=crop',
  ],
};

// Product name generators by category
const productNames: Record<string, string[]> = {
  education: ['SCHOOL ERP PRO', 'COLLEGE MANAGER', 'LMS PLATFORM', 'EXAM PORTAL', 'LIBRARY SYSTEM'],
  healthcare: ['CLINIC MANAGER', 'HOSPITAL ERP', 'PHARMACY POS', 'LAB SYSTEM', 'PATIENT PORTAL'],
  retail: ['RETAIL POS', 'INVENTORY PRO', 'E-COMMERCE SUITE', 'STORE MANAGER', 'BILLING SOFTWARE'],
  food: ['RESTAURANT POS', 'KITCHEN DISPLAY', 'DELIVERY APP', 'TABLE BOOKING', 'MENU BUILDER'],
  transport: ['FLEET TRACKER', 'CAB BOOKING', 'BUS SCHEDULER', 'VEHICLE MANAGER', 'ROUTE PLANNER'],
  finance: ['ACCOUNTING PRO', 'TAX MANAGER', 'INVOICE SYSTEM', 'EXPENSE TRACKER', 'PAYROLL SUITE'],
  construction: ['PROJECT MANAGER', 'CONTRACTOR ERP', 'SITE TRACKER', 'MATERIAL MANAGER', 'BLUEPRINT PRO'],
  realestate: ['PROPERTY CRM', 'RENTAL MANAGER', 'BROKER SUITE', 'LISTING PORTAL', 'TENANT TRACKER'],
  technology: ['IT HELPDESK', 'ASSET MANAGER', 'CODE REVIEWER', 'BUG TRACKER', 'DEPLOY MANAGER'],
  logistics: ['WAREHOUSE WMS', 'SHIPMENT TRACKER', 'CARGO MANAGER', 'COURIER SYSTEM', 'LOAD PLANNER'],
  agriculture: ['FARM MANAGER', 'CROP TRACKER', 'AGRI MARKET', 'LIVESTOCK ERP', 'HARVEST PLANNER'],
  events: ['EVENT PLANNER', 'TICKET BOOKING', 'VENUE MANAGER', 'GUEST TRACKER', 'CATERING SUITE'],
  travel: ['TOUR OPERATOR', 'HOTEL BOOKING', 'VISA MANAGER', 'TRIP PLANNER', 'GUIDE CONNECT'],
  generic: ['BUSINESS ERP', 'CRM SUITE', 'HR MANAGER', 'PROJECT TRACKER', 'OFFICE SUITE'],
};

// Generate products for a category
export function generateProducts(categoryId: string, count: number = 8) {
  // Special handling for education - return all 45 real systems
  if (categoryId === 'education') {
    return educationSystems;
  }

  // Special handling for healthcare - return all 45 real systems
  if (categoryId === 'healthcare') {
    return healthcareSystems;
  }

  // Special handling for government - return all 45 real systems
  if (categoryId === 'government') {
    return governmentSystems;
  }

  const categoryMap: Record<string, keyof typeof businessImages> = {
    'education': 'education',
    'healthcare': 'healthcare',
    'government': 'generic',
    'retail': 'retail',
    'food-hospitality': 'food',
    'transport': 'transport',
    'logistics': 'logistics',
    'manufacturing': 'generic',
    'construction': 'construction',
    'agriculture': 'agriculture',
    'real-estate': 'realestate',
    'finance': 'finance',
    'insurance': 'finance',
    'automobile': 'transport',
    'energy-utilities': 'generic',
    'home-services': 'generic',
    'professional-services': 'generic',
    'media-creators': 'events',
    'events-entertainment': 'events',
    'travel-tourism': 'travel',
    'security-services': 'generic',
    'ngo-social': 'generic',
    'religious-services': 'generic',
    'warehousing': 'logistics',
    'technology-services': 'technology',
    'upcoming': 'technology',
    'this-week': 'generic',
    'top-selling': 'generic',
    'best-selling': 'generic',
  };

  const imageCategory = categoryMap[categoryId] || 'generic';
  const images = businessImages[imageCategory];
  const names = productNames[imageCategory] || productNames.generic;
  
  const statuses: ('upcoming' | 'live' | 'bestseller')[] = ['live', 'bestseller', 'upcoming', 'live', 'live', 'bestseller', 'live', 'upcoming'];
  
  // For special rows, set specific statuses
  if (categoryId === 'upcoming') {
    return Array.from({ length: count }, (_, i) => ({
      id: `${categoryId}-${i}`,
      title: names[i % names.length],
      subtitle: categories.find(c => c.id === categoryId)?.title || 'Business Software',
      image: images[i % images.length],
      status: 'upcoming' as const,
      price: Math.floor(Math.random() * 50000) + 5000,
      features: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4', 'Feature 5'],
    }));
  }
  
  if (categoryId === 'best-selling' || categoryId === 'top-selling') {
    return Array.from({ length: count }, (_, i) => ({
      id: `${categoryId}-${i}`,
      title: names[i % names.length],
      subtitle: categories.find(c => c.id === categoryId)?.title || 'Business Software',
      image: images[i % images.length],
      status: 'bestseller' as const,
      price: Math.floor(Math.random() * 50000) + 5000,
      features: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4', 'Feature 5'],
    }));
  }

  return Array.from({ length: count }, (_, i) => ({
    id: `${categoryId}-${i}`,
    title: names[i % names.length],
    subtitle: categories.find(c => c.id === categoryId)?.title || 'Business Software',
    image: images[i % images.length],
    status: statuses[i % statuses.length],
    price: Math.floor(Math.random() * 50000) + 5000,
    features: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4', 'Feature 5'],
  }));
}
