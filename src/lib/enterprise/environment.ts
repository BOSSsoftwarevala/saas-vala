export type Environment = 'development' | 'staging' | 'production';

export interface EnvironmentConfig {
  name: Environment;
  database: {
    url: string;
    ssl: boolean;
    poolSize: number;
    timeout: number;
  };
  redis?: {
    url: string;
    password?: string;
    db: number;
  };
  api: {
    baseUrl: string;
    timeout: number;
    retries: number;
  };
  storage: {
    provider: 'local' | 's3' | 'gcs';
    bucket?: string;
    region?: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
    enableConsole: boolean;
  };
  security: {
    jwtSecret: string;
    jwtExpiry: string;
    bcryptRounds: number;
    enableRateLimit: boolean;
  };
  features: {
    enableDebug: boolean;
    enableSwagger: boolean;
    enableAnalytics: boolean;
    enableMonitoring: boolean;
  };
  external: {
    emailProvider?: 'sendgrid' | 'ses' | 'smtp';
    smtp?: {
      host: string;
      port: number;
      secure: boolean;
      auth: { user: string; pass: string };
    };
    webhookUrls?: string[];
  };
}

export class EnvironmentManager {
  private static instance: EnvironmentManager;
  private currentEnvironment: Environment;
  private config: EnvironmentConfig;
  private configCache: Map<string, any> = new Map();

  static getInstance(): EnvironmentManager {
    if (!EnvironmentManager.instance) {
      EnvironmentManager.instance = new EnvironmentManager();
    }
    return EnvironmentManager.instance;
  }

  constructor() {
    this.currentEnvironment = this.detectEnvironment();
    this.config = this.loadConfig();
    this.validateConfig();
  }

  getEnvironment(): Environment {
    return this.currentEnvironment;
  }

  getConfig(): EnvironmentConfig {
    return this.config;
  }

  get<T = any>(path: string, defaultValue?: T): T {
    const cached = this.configCache.get(path);
    if (cached !== undefined) {
      return cached;
    }

    const value = this.getNestedValue(this.config, path, defaultValue);
    this.configCache.set(path, value);
    return value;
  }

  set(path: string, value: any): void {
    this.setNestedValue(this.config, path, value);
    this.configCache.delete(path);
  }

  isDevelopment(): boolean {
    return this.currentEnvironment === 'development';
  }

  isStaging(): boolean {
    return this.currentEnvironment === 'staging';
  }

  isProduction(): boolean {
    return this.currentEnvironment === 'production';
  }

  getDatabaseUrl(): string {
    return this.config.database.url;
  }

  getJwtSecret(): string {
    return this.config.security.jwtSecret;
  }

  isFeatureEnabled(feature: keyof EnvironmentConfig['features']): boolean {
    return this.config.features[feature];
  }

  getLogLevel(): EnvironmentConfig['logging']['level'] {
    return this.config.logging.level;
  }

  getApiTimeout(): number {
    return this.config.api.timeout;
  }

  getStorageConfig(): EnvironmentConfig['storage'] {
    return this.config.storage;
  }

  getExternalConfig(): EnvironmentConfig['external'] {
    return this.config.external;
  }

  async reloadConfig(): Promise<void> {
    this.config = this.loadConfig();
    this.configCache.clear();
    this.validateConfig();
  }

  private detectEnvironment(): Environment {
    const nodeEnv = process.env.NODE_ENV;
    const customEnv = process.env.ENVIRONMENT;
    
    if (customEnv) {
      return customEnv as Environment;
    }
    
    switch (nodeEnv) {
      case 'development':
        return 'development';
      case 'production':
        return 'production';
      case 'staging':
        return 'staging';
      default:
        return 'development';
    }
  }

  private loadConfig(): EnvironmentConfig {
    const baseConfig: Partial<EnvironmentConfig> = {
      name: this.currentEnvironment,
      database: {
        url: process.env.DATABASE_URL || import.meta.env.VITE_SUPABASE_URL,
        ssl: true,
        poolSize: parseInt(process.env.DB_POOL_SIZE || '20'),
        timeout: parseInt(process.env.DB_TIMEOUT || '30000'),
      },
      api: {
        baseUrl: process.env.API_BASE_URL || import.meta.env.VITE_SUPABASE_URL,
        timeout: parseInt(process.env.API_TIMEOUT || '30000'),
        retries: parseInt(process.env.API_RETRIES || '3'),
      },
      logging: {
        level: (process.env.LOG_LEVEL as any) || (this.currentEnvironment === 'production' ? 'info' : 'debug'),
        format: (process.env.LOG_FORMAT as any) || 'json',
        enableConsole: process.env.LOG_CONSOLE !== 'false',
      },
      security: {
        jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
        jwtExpiry: process.env.JWT_EXPIRY || '24h',
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
        enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
      },
      features: {
        enableDebug: this.currentEnvironment !== 'production',
        enableSwagger: this.currentEnvironment !== 'production',
        enableAnalytics: process.env.ENABLE_ANALYTICS !== 'false',
        enableMonitoring: process.env.ENABLE_MONITORING !== 'false',
      },
    };

    // Environment-specific overrides
    const envConfigs: Record<Environment, Partial<EnvironmentConfig>> = {
      development: {
        database: {
          ssl: false,
          poolSize: 5,
          timeout: 10000,
        },
        redis: {
          url: process.env.REDIS_URL || 'redis://localhost:6379',
          db: 0,
        },
        storage: {
          provider: 'local',
        },
        logging: {
          level: 'debug',
          format: 'text',
          enableConsole: true,
        },
        features: {
          enableDebug: true,
          enableSwagger: true,
          enableAnalytics: false,
          enableMonitoring: false,
        },
      },
      staging: {
        database: {
          ssl: true,
          poolSize: 10,
          timeout: 20000,
        },
        redis: {
          url: process.env.REDIS_URL || 'redis://localhost:6379',
          db: 1,
        },
        storage: {
          provider: 's3',
          bucket: process.env.S3_BUCKET || 'saasvala-staging',
          region: process.env.S3_REGION || 'us-east-1',
        },
        logging: {
          level: 'info',
          format: 'json',
          enableConsole: true,
        },
        features: {
          enableDebug: false,
          enableSwagger: true,
          enableAnalytics: true,
          enableMonitoring: true,
        },
      },
      production: {
        database: {
          ssl: true,
          poolSize: 20,
          timeout: 30000,
        },
        redis: {
          url: process.env.REDIS_URL!,
          password: process.env.REDIS_PASSWORD,
          db: 0,
        },
        storage: {
          provider: 's3',
          bucket: process.env.S3_BUCKET!,
          region: process.env.S3_REGION || 'us-east-1',
        },
        logging: {
          level: 'warn',
          format: 'json',
          enableConsole: false,
        },
        security: {
          jwtSecret: process.env.JWT_SECRET!,
          bcryptRounds: 14,
        },
        features: {
          enableDebug: false,
          enableSwagger: false,
          enableAnalytics: true,
          enableMonitoring: true,
        },
        external: {
          emailProvider: (process.env.EMAIL_PROVIDER as any) || 'ses',
          webhookUrls: process.env.WEBHOOK_URLS?.split(','),
        },
      },
    };

    return this.mergeConfigs(baseConfig, envConfigs[this.currentEnvironment]) as EnvironmentConfig;
  }

  private validateConfig(): void {
    const requiredFields = [
      'database.url',
      'security.jwtSecret',
      'api.baseUrl',
    ];

    for (const field of requiredFields) {
      const value = this.get(field);
      if (!value) {
        throw new Error(`Required configuration field '${field}' is missing`);
      }
    }

    // Environment-specific validations
    if (this.currentEnvironment === 'production') {
      if (this.config.security.jwtSecret === 'default-secret-change-in-production') {
        throw new Error('JWT secret must be changed in production');
      }
      if (!this.config.redis?.url) {
        throw new Error('Redis URL is required in production');
      }
    }
  }

  private mergeConfigs(base: any, override: any): any {
    const result = { ...base };
    
    for (const key in override) {
      if (override[key] && typeof override[key] === 'object' && !Array.isArray(override[key])) {
        result[key] = this.mergeConfigs(result[key] || {}, override[key]);
      } else {
        result[key] = override[key];
      }
    }
    
    return result;
  }

  private getNestedValue(obj: any, path: string, defaultValue?: any): any {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined || !(key in current)) {
        return defaultValue;
      }
      current = current[key];
    }
    
    return current;
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    let current = obj;
    
    for (const key of keys) {
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[lastKey] = value;
  }

  clearCache(): void {
    this.configCache.clear();
  }
}

// Environment-specific utilities
export const env = EnvironmentManager.getInstance();

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable '${key}' is not set`);
  }
  return value;
}

export function getEnv(key: string, defaultValue?: string): string {
  return process.env[key] || defaultValue || '';
}

export function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (!value) return defaultValue || 0;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? (defaultValue || 0) : parsed;
}

export function getEnvBoolean(key: string, defaultValue?: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue || false;
  return value.toLowerCase() === 'true';
}

// Environment validation
export function validateEnvironment(): void {
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Export common environment checks
export const isDev = env.isDevelopment();
export const isStaging = env.isStaging();
export const isProd = env.isProduction();
