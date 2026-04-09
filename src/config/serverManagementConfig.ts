// Server Management Configuration
// Premium monitoring, billing, AI analysis, and agent system

export const SERVER_MANAGEMENT_CONFIG = {
  // Pricing
  MONTHLY_BASE_PRICE: 49.00, // $49 per month
  CURRENCY: 'USD',
  
  // Monitoring
  METRICS_COLLECTION_INTERVAL: 30_000, // 30 seconds
  METRICS_RETENTION_DAYS: 90, // Keep 90 days of metrics
  METRICS_THRESHOLDS: {
    CPU_WARNING: 75,
    CPU_CRITICAL: 90,
    RAM_WARNING: 80,
    RAM_CRITICAL: 95,
    DISK_WARNING: 85,
    DISK_CRITICAL: 95,
    ERROR_RATE_WARNING: 0.05, // 5%
    ERROR_RATE_CRITICAL: 0.10, // 10%
  },

  // AI Analysis
  AI_ANALYSIS_INTERVAL: 60 * 60 * 1000, // Every hour
  AI_MODEL: 'claude-3-5-sonnet-20241022',
  
  // Agent Settings
  AGENT_HEARTBEAT_INTERVAL: 30_000, // 30 seconds
  AGENT_TIMEOUT: 120_000, // 2 minutes
  AGENT_AUTO_RESTART: true,
  
  // Billing
  BILLING_CYCLE_DAY: 1, // Day of month to charge
  BILLING_PAYMENT_TERMS: 7, // Days to pay after invoice
  REQUIRE_VALID_PAYMENT_METHOD: true,
  
  // SSH
  SSH_KEY_TYPES: ['rsa', 'ed25519'],
  SSH_DEFAULT_PORT: 22,
  SSH_TIMEOUT: 30_000,
  SSH_KEY_ENCRYPTION: 'aes-256-cbc', // Use proper encryption in production
  
  // SSL
  SSL_CHECK_INTERVAL: 24 * 60 * 60 * 1000, // Daily
  SSL_EXPIRY_WARNING_DAYS: 30,
  AUTO_RENEW_SSL: true,
  
  // Server Types
  SERVER_TYPES: ['vps', 'dedicated', 'cloud'],
  SUPPORTED_PROVIDERS: {
    aws: {
      name: 'Amazon AWS',
      icon: 'cloud',
      regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'],
    },
    digitalocean: {
      name: 'DigitalOcean',
      icon: 'cloud',
      regions: ['nyc1', 'nyc3', 'sfo1', 'sfo2', 'lon1', 'ams3', 'blr1', 'sgp1'],
    },
    hostinger: {
      name: 'Hostinger',
      icon: 'server',
      regions: ['us', 'eu', 'asia'],
    },
    linode: {
      name: 'Linode',
      icon: 'cloud',
      regions: ['us-east', 'us-west', 'eu-west', 'ap-south'],
    },
  },

  // Deployment
  DEPLOYMENT_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  ROLLBACK_ENABLED: true,
  AUTO_HEALTH_CHECK: true,

  // Notifications
  ENABLE_EMAIL_ALERTS: true,
  ENABLE_SLACK_ALERTS: false,
  ALERT_ON_HIGH_LOAD: true,
  ALERT_ON_DISK_FULL: true,
  ALERT_ON_SSL_EXPIRY: true,
  ALERT_ON_AGENT_OFFLINE: true,

  // Logging
  LOG_RETENTION_DAYS: 180,
  LOG_LEVELS: ['info', 'warning', 'error', 'critical'],
  AUDIT_ACTIONS: [
    'start', 'stop', 'restart', 'deploy', 'update',
    'ssh_connect', 'scale_up', 'scale_down', 'backup',
    'restore', 'ssl_install', 'domain_add', 'domain_remove'
  ],

  // Performance
  CACHE_METRICS: true,
  CACHE_TTL_SECONDS: 60,
  AGGREGATE_METRICS: true,
  AGGREGATE_INTERVAL: 300_000, // 5 minutes

  // Security
  VERIFY_SSH_KEYS: true,
  REQUIRE_MFA_FOR_SSH: false,
  RATE_LIMIT_AGENT_REQUESTS: 1000, // per hour
  ENCRYPT_SENSITIVE_DATA: true,

  // Feature Flags
  FEATURES: {
    REAL_TIME_METRICS: true,
    AI_ANALYSIS: true,
    AUTO_SCALING: false, // Coming soon
    MULTI_REGION_FAILOVER: false, // Coming soon
    TERRAFORM_SUPPORT: false, // Coming soon
    KUBERNETES_SUPPORT: false, // Coming soon
  },
};

// Helper function to get threshold status
export function getMetricStatus(metric: string, value: number): 'normal' | 'warning' | 'critical' {
  const thresholds = SERVER_MANAGEMENT_CONFIG.METRICS_THRESHOLDS;
  
  const metricKey = metric.toUpperCase();
  const warningThreshold = thresholds[`${metricKey}_WARNING` as keyof typeof thresholds];
  const criticalThreshold = thresholds[`${metricKey}_CRITICAL` as keyof typeof thresholds];
  
  if (criticalThreshold !== undefined && value >= criticalThreshold) {
    return 'critical';
  }
  if (warningThreshold !== undefined && value >= warningThreshold) {
    return 'warning';
  }
  return 'normal';
}

// Format bytes to readable size
export function formatBytes(bytes: number, decimals = 2): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

// Format uptime
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

// Calculate monthly cost based on usage
export function calculateMonthlyCost(metrics: any[]): number {
  if (!metrics || metrics.length === 0) return SERVER_MANAGEMENT_CONFIG.MONTHLY_BASE_PRICE;
  
  const avgCpu = metrics.reduce((sum, m) => sum + m.cpu_percent, 0) / metrics.length;
  const avgRam = metrics.reduce((sum, m) => sum + (m.ram_used_mb / m.ram_total_mb * 100), 0) / metrics.length;
  
  let overage = 0;
  
  // Charge $0.50 for each 10% CPU over 80% average
  if (avgCpu > 80) {
    overage += ((avgCpu - 80) / 10) * 0.50;
  }
  
  // Charge $0.30 for each 10% RAM over 80% average
  if (avgRam > 80) {
    overage += ((avgRam - 80) / 10) * 0.30;
  }
  
  return SERVER_MANAGEMENT_CONFIG.MONTHLY_BASE_PRICE + overage;
}
