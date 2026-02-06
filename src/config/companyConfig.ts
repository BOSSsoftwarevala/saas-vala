// ╔══════════════════════════════════════════════════════════════╗
// ║              SOFTWARE VALA™ - The Name of Trust              ║
// ║                   Company Configuration                       ║
// ╚══════════════════════════════════════════════════════════════╝

export const COMPANY_CONFIG = {
  // Brand Identity
  name: 'SOFTWARE VALA™',
  tagline: 'The Name of Trust',
  legalName: 'Software Vala',
  
  // Contact Information
  contact: {
    whatsapp: [
      { number: '+91-8768878787', label: 'Primary Support' },
      { number: '+91-8348838383', label: 'Sales & Queries' }
    ],
    email: 'hellosoftwarevala@gmail.com',
    supportEmail: 'hellosoftwarevala@gmail.com'
  },
  
  // Websites
  websites: {
    online: {
      url: 'https://softwarevala.net',
      label: 'Online Software'
    },
    offline: {
      url: 'https://erpvala.com', 
      label: 'Offline Software (ERP)'
    },
    valaAi: {
      url: 'https://vala.ai',
      label: 'VALA AI Platform'
    }
  },
  
  // Social Media
  social: {
    facebook: {
      url: 'https://facebook.com/share/1HpGSvExis',
      handle: '@softwarevala'
    },
    instagram: {
      url: 'https://instagram.com/new_software_vala',
      handle: '@new_software_vala'
    },
    whatsappChannel: {
      url: 'https://wa.me/918348838383',
      label: 'WhatsApp Direct'
    },
    youtube: {
      url: 'https://youtube.com/@softwarevala',
      handle: '@softwarevala'
    }
  },
  
  // Business Settings
  business: {
    currency: 'USD',
    secondaryCurrency: 'INR',
    timezone: 'Asia/Kolkata',
    country: 'India',
    
    // Trial & Demo Settings
    trialDays: 7,
    trialEnabled: true,
    noLimitsPolicy: true, // No boundaries philosophy
    
    // Payment Methods
    paymentMethods: ['bank_transfer', 'upi', 'crypto', 'wise', 'remitly']
  },
  
  // Branding Colors
  branding: {
    primary: '#0a0f1f',      // Deep Navy
    accent: '#3b82f6',        // Blue
    gold: '#f59e0b',          // Premium Gold
    success: '#10b981',       // Green
    gradient: 'linear-gradient(135deg, #0a0f1f 0%, #1e3a5f 100%)'
  }
} as const;

// Server Recommendations (Quality First, No Budget Limits)
export const RECOMMENDED_SERVERS = {
  primary: {
    provider: 'Hetzner',
    why: 'German engineering, 99.99% uptime, best quality',
    plans: [
      {
        name: 'CX21',
        specs: '2 vCPU, 4GB RAM, 40GB SSD',
        price: '€4.15/mo',
        use: 'Development & Testing'
      },
      {
        name: 'CPX31',
        specs: '4 vCPU, 8GB RAM, 160GB SSD',
        price: '€14.50/mo',
        use: 'Production Apps (Recommended)',
        recommended: true
      },
      {
        name: 'CPX51',
        specs: '8 vCPU, 16GB RAM, 240GB SSD',
        price: '€29.00/mo',
        use: 'High Traffic / Enterprise'
      }
    ],
    signupUrl: 'https://www.hetzner.com/cloud',
    freeCredits: '€20 new user credit'
  },
  alternatives: [
    {
      provider: 'DigitalOcean',
      why: 'Best API, $200 free credits',
      signupUrl: 'https://www.digitalocean.com'
    },
    {
      provider: 'Vultr',
      why: 'Global locations, good performance',
      signupUrl: 'https://www.vultr.com'
    }
  ]
} as const;

// Tool Stack (No Boundaries - Everything Unlimited)
export const VALA_TOOL_STACK = {
  ai: {
    name: 'VALA AI',
    description: 'Full-Stack AI Developer',
    features: [
      'Natural language server control',
      'Code analysis & auto-fix',
      'One-click deployments',
      'Database management',
      'License generation',
      'Real-time monitoring'
    ],
    trial: '7 days free',
    limits: 'UNLIMITED' // No boundaries
  },
  serverAgent: {
    name: 'VALA Server Agent',
    description: 'Boundaryless server control',
    features: [
      'Live CPU/RAM/Disk monitoring',
      'Service restart (nginx, mysql, pm2)',
      'Log viewing',
      'Backup creation',
      'Git deployments',
      'SSL management'
    ],
    trial: 'FREE forever',
    limits: 'UNLIMITED'
  },
  marketplace: {
    name: 'SaaS VALA Marketplace',
    description: '120+ ready-to-use software',
    pricing: '$5 per software',
    trial: '7 days demo',
    limits: 'UNLIMITED downloads after purchase'
  }
} as const;

// Helper Functions
export const getWhatsAppLink = (message?: string) => {
  const phone = '918348838383';
  const encodedMessage = message ? encodeURIComponent(message) : '';
  return `https://wa.me/${phone}${encodedMessage ? `?text=${encodedMessage}` : ''}`;
};

export const getTrialEndDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + COMPANY_CONFIG.business.trialDays);
  return date;
};

export const formatPhoneDisplay = (phone: string) => {
  return phone.replace(/(\+91)(\d{5})(\d{5})/, '$1-$2-$3');
};
