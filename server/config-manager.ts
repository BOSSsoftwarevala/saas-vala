import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { UltraLogger } from './logger';
import { UltraDatabase } from './database';

export interface EnvironmentConfig {
  name: 'development' | 'staging' | 'production';
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
    poolSize: number;
  };
  redis: {
    enabled: boolean;
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  server: {
    port: number;
    host: string;
    timeout: number;
    keepAlive: boolean;
  };
  security: {
    jwtSecret: string;
    jwtExpiry: string;
    bcryptRounds: number;
    sessionSecret: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file: string;
    maxSize: string;
    maxFiles: number;
  };
  features: {
    botProtection: boolean;
    fileStorage: boolean;
    queueSystem: boolean;
    failover: boolean;
    monitoring: boolean;
    caching: boolean;
  };
  external: {
    emailProvider: string;
    emailApiKey: string;
    cdnProvider: string;
    cdnRegion: string;
    smsProvider: string;
    smsApiKey: string;
  };
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class UltraConfigManager extends EventEmitter {
  private static instance: UltraConfigManager;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private currentEnvironment: EnvironmentConfig['name'];
  private configs: Map<EnvironmentConfig['name'], EnvironmentConfig> = new Map();
  private configPath: string;
  private envPath: string;

  static getInstance(): UltraConfigManager {
    if (!UltraConfigManager.instance) {
      UltraConfigManager.instance = new UltraConfigManager();
    }
    return UltraConfigManager.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    
    this.currentEnvironment = (process.env.NODE_ENV as EnvironmentConfig['name']) || 'development';
    this.configPath = process.env.CONFIG_PATH || path.join(process.cwd(), 'config');
    this.envPath = path.join(process.cwd(), '.env');

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Ensure config directory exists
      if (!fs.existsSync(this.configPath)) {
        fs.mkdirSync(this.configPath, { recursive: true });
      }

      // Load configurations
      await this.loadConfigurations();

      // Validate current configuration
      const validation = this.validateConfig(this.currentEnvironment);
      if (!validation.valid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }

      // Log warnings
      if (validation.warnings.length > 0) {
        this.logger.warn('config-manager', 'Configuration warnings', { warnings: validation.warnings });
      }

      // Watch for configuration changes
      this.watchConfigChanges();

      this.logger.info('config-manager', 'Configuration manager initialized', {
        environment: this.currentEnvironment,
        configPath: this.configPath
      });

    } catch (error) {
      this.logger.error('config-manager', 'Failed to initialize configuration manager', error as Error);
      throw error;
    }
  }

  private async loadConfigurations(): Promise<void> {
    // Load default configuration
    const defaultConfig = this.getDefaultConfig();
    this.configs.set('development', defaultConfig);

    // Load environment-specific configurations
    const environments: EnvironmentConfig['name'][] = ['development', 'staging', 'production'];
    
    for (const env of environments) {
      const configPath = path.join(this.configPath, `${env}.json`);
      
      if (fs.existsSync(configPath)) {
        try {
          const configData = fs.readFileSync(configPath, 'utf8');
          const config = JSON.parse(configData);
          
          // Merge with default config
          const mergedConfig = this.mergeConfigs(defaultConfig, config);
          this.configs.set(env, mergedConfig);
          
          this.logger.debug('config-manager', `Loaded configuration for ${env}`);
        } catch (error) {
          this.logger.error('config-manager', `Failed to load configuration for ${env}`, error as Error);
        }
      }
    }

    // Override with environment variables
    this.overrideWithEnvVars();
  }

  private getDefaultConfig(): EnvironmentConfig {
    return {
      name: 'development',
      database: {
        host: 'localhost',
        port: 5432,
        name: 'saasvala',
        user: 'postgres',
        password: '',
        ssl: false,
        poolSize: 10
      },
      redis: {
        enabled: false,
        host: 'localhost',
        port: 6379,
        password: undefined,
        db: 0
      },
      server: {
        port: 3000,
        host: '0.0.0.0',
        timeout: 30000,
        keepAlive: true
      },
      security: {
        jwtSecret: 'your-super-secret-jwt-key',
        jwtExpiry: '24h',
        bcryptRounds: 12,
        sessionSecret: 'your-super-secret-session-key'
      },
      logging: {
        level: 'info',
        file: '/var/log/saasvala/application.log',
        maxSize: '50MB',
        maxFiles: 10
      },
      features: {
        botProtection: true,
        fileStorage: true,
        queueSystem: true,
        failover: false,
        monitoring: true,
        caching: true
      },
      external: {
        emailProvider: 'smtp',
        emailApiKey: '',
        cdnProvider: 'local',
        cdnRegion: 'us-east-1',
        smsProvider: 'twilio',
        smsApiKey: ''
      }
    };
  }

  private mergeConfigs(defaultConfig: EnvironmentConfig, overrideConfig: Partial<EnvironmentConfig>): EnvironmentConfig {
    return {
      ...defaultConfig,
      ...overrideConfig,
      database: { ...defaultConfig.database, ...overrideConfig.database },
      redis: { ...defaultConfig.redis, ...overrideConfig.redis },
      server: { ...defaultConfig.server, ...overrideConfig.server },
      security: { ...defaultConfig.security, ...overrideConfig.security },
      logging: { ...defaultConfig.logging, ...overrideConfig.logging },
      features: { ...defaultConfig.features, ...overrideConfig.features },
      external: { ...defaultConfig.external, ...overrideConfig.external }
    };
  }

  private overrideWithEnvVars(): void {
    const envMappings: Record<string, { config: keyof EnvironmentConfig; field?: string }> = {
      'NODE_ENV': { config: 'name' },
      'DB_HOST': { config: 'database', field: 'host' },
      'DB_PORT': { config: 'database', field: 'port' },
      'DB_NAME': { config: 'database', field: 'name' },
      'DB_USER': { config: 'database', field: 'user' },
      'DB_PASSWORD': { config: 'database', field: 'password' },
      'DB_SSL': { config: 'database', field: 'ssl' },
      'DB_POOL_SIZE': { config: 'database', field: 'poolSize' },
      'REDIS_ENABLED': { config: 'redis', field: 'enabled' },
      'REDIS_HOST': { config: 'redis', field: 'host' },
      'REDIS_PORT': { config: 'redis', field: 'port' },
      'REDIS_PASSWORD': { config: 'redis', field: 'password' },
      'REDIS_DB': { config: 'redis', field: 'db' },
      'PORT': { config: 'server', field: 'port' },
      'HOST': { config: 'server', field: 'host' },
      'SERVER_TIMEOUT': { config: 'server', field: 'timeout' },
      'JWT_SECRET': { config: 'security', field: 'jwtSecret' },
      'JWT_EXPIRY': { config: 'security', field: 'jwtExpiry' },
      'BCRYPT_ROUNDS': { config: 'security', field: 'bcryptRounds' },
      'SESSION_SECRET': { config: 'security', field: 'sessionSecret' },
      'LOG_LEVEL': { config: 'logging', field: 'level' },
      'LOG_FILE': { config: 'logging', field: 'file' },
      'LOG_MAX_SIZE': { config: 'logging', field: 'maxSize' },
      'LOG_MAX_FILES': { config: 'logging', field: 'maxFiles' },
      'BOT_PROTECTION_ENABLED': { config: 'features', field: 'botProtection' },
      'FILE_STORAGE_ENABLED': { config: 'features', field: 'fileStorage' },
      'QUEUE_SYSTEM_ENABLED': { config: 'features', field: 'queueSystem' },
      'FAILOVER_ENABLED': { config: 'features', field: 'failover' },
      'MONITORING_ENABLED': { config: 'features', field: 'monitoring' },
      'CACHING_ENABLED': { config: 'features', field: 'caching' },
      'EMAIL_PROVIDER': { config: 'external', field: 'emailProvider' },
      'EMAIL_API_KEY': { config: 'external', field: 'emailApiKey' },
      'CDN_PROVIDER': { config: 'external', field: 'cdnProvider' },
      'CDN_REGION': { config: 'external', field: 'cdnRegion' },
      'SMS_PROVIDER': { config: 'external', field: 'smsProvider' },
      'SMS_API_KEY': { config: 'external', field: 'smsApiKey' }
    };

    for (const [envVar, mapping] of Object.entries(envMappings)) {
      const envValue = process.env[envVar];
      if (envValue !== undefined) {
        const config = this.configs.get(this.currentEnvironment);
        if (config) {
          if (mapping.field) {
            // Type conversion based on field
            let convertedValue: any = envValue;
            
            if (mapping.field === 'port' || mapping.field === 'poolSize' || mapping.field === 'maxFiles') {
              convertedValue = parseInt(envValue);
            } else if (mapping.field === 'ssl' || mapping.field === 'enabled' || mapping.field === 'keepAlive') {
              convertedValue = envValue.toLowerCase() === 'true';
            } else if (mapping.field === 'timeout') {
              convertedValue = parseInt(envValue);
            } else if (mapping.field === 'bcryptRounds') {
              convertedValue = parseInt(envValue);
            }

            (config[mapping.config] as any)[mapping.field] = convertedValue;
          } else {
            // Direct assignment for simple fields
            (config as any)[mapping.config] = envValue;
          }
        }
      }
    }
  }

  private watchConfigChanges(): void {
    // Watch for changes in config files
    fs.watch(this.configPath, { recursive: true }, async (eventType, filename) => {
      if (eventType === 'change' && filename?.endsWith('.json')) {
        try {
          this.logger.info('config-manager', `Configuration file changed: ${filename}`);
          await this.loadConfigurations();
          
          const validation = this.validateConfig(this.currentEnvironment);
          if (!validation.valid) {
            this.logger.error('config-manager', 'Configuration validation failed after reload', { errors: validation.errors });
          } else {
            this.emit('configChanged', { environment: this.currentEnvironment, filename });
          }
        } catch (error) {
          this.logger.error('config-manager', 'Failed to reload configuration', error as Error);
        }
      }
    });
  }

  private validateConfig(environment: EnvironmentConfig['name']): ConfigValidationResult {
    const config = this.configs.get(environment);
    if (!config) {
      return {
        valid: false,
        errors: [`Configuration for environment ${environment} not found`],
        warnings: []
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate database configuration
    if (!config.database.host) {
      errors.push('Database host is required');
    }
    if (!config.database.name) {
      errors.push('Database name is required');
    }
    if (!config.database.user) {
      errors.push('Database user is required');
    }
    if (config.database.port < 1 || config.database.port > 65535) {
      errors.push('Database port must be between 1 and 65535');
    }

    // Validate server configuration
    if (config.server.port < 1 || config.server.port > 65535) {
      errors.push('Server port must be between 1 and 65535');
    }

    // Validate security configuration
    if (config.security.jwtSecret === 'your-super-secret-jwt-key') {
      warnings.push('Using default JWT secret - please change in production');
    }
    if (config.security.sessionSecret === 'your-super-secret-session-key') {
      warnings.push('Using default session secret - please change in production');
    }
    if (config.security.bcryptRounds < 10) {
      warnings.push('BCrypt rounds should be at least 10 for security');
    }

    // Validate production-specific settings
    if (environment === 'production') {
      if (config.database.password === '') {
        errors.push('Database password is required in production');
      }
      if (!config.database.ssl) {
        warnings.push('Database SSL should be enabled in production');
      }
      if (config.logging.level === 'debug') {
        warnings.push('Debug logging should not be used in production');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Public API methods
  getConfig(environment?: EnvironmentConfig['name']): EnvironmentConfig {
    const env = environment || this.currentEnvironment;
    const config = this.configs.get(env);
    
    if (!config) {
      throw new Error(`Configuration for environment ${env} not found`);
    }
    
    return { ...config };
  }

  getCurrentEnvironment(): EnvironmentConfig['name'] {
    return this.currentEnvironment;
  }

  async setEnvironment(environment: EnvironmentConfig['name']): Promise<void> {
    if (!this.configs.has(environment)) {
      throw new Error(`Configuration for environment ${environment} not found`);
    }

    const validation = this.validateConfig(environment);
    if (!validation.valid) {
      throw new Error(`Cannot switch to environment ${environment}: ${validation.errors.join(', ')}`);
    }

    const previousEnvironment = this.currentEnvironment;
    this.currentEnvironment = environment;

    this.logger.info('config-manager', `Environment switched from ${previousEnvironment} to ${environment}`);
    this.emit('environmentChanged', { from: previousEnvironment, to: environment });
  }

  async updateConfig(environment: EnvironmentConfig['name'], updates: Partial<EnvironmentConfig>): Promise<void> {
    const config = this.configs.get(environment);
    if (!config) {
      throw new Error(`Configuration for environment ${environment} not found`);
    }

    const updatedConfig = this.mergeConfigs(config, updates);
    
    // Validate updated configuration
    this.configs.set(environment, updatedConfig);
    const validation = this.validateConfig(environment);
    
    if (!validation.valid) {
      // Revert to original config
      this.configs.set(environment, config);
      throw new Error(`Invalid configuration update: ${validation.errors.join(', ')}`);
    }

    // Save to file
    const configPath = path.join(this.configPath, `${environment}.json`);
    fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));

    this.logger.info('config-manager', `Configuration updated for environment ${environment}`);
    this.emit('configUpdated', { environment, updates });
  }

  async createEnvironment(environment: EnvironmentConfig['name'], config: Partial<EnvironmentConfig>): Promise<void> {
    if (this.configs.has(environment)) {
      throw new Error(`Environment ${environment} already exists`);
    }

    const defaultConfig = this.getDefaultConfig();
    const newConfig = this.mergeConfigs(defaultConfig, { ...config, name: environment });

    // Validate new configuration
    this.configs.set(environment, newConfig);
    const validation = this.validateConfig(environment);
    
    if (!validation.valid) {
      this.configs.delete(environment);
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Save to file
    const configPath = path.join(this.configPath, `${environment}.json`);
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));

    this.logger.info('config-manager', `Environment ${environment} created`);
    this.emit('environmentCreated', { environment });
  }

  async deleteEnvironment(environment: EnvironmentConfig['name']): Promise<void> {
    if (environment === this.currentEnvironment) {
      throw new Error('Cannot delete current environment');
    }

    if (!this.configs.has(environment)) {
      throw new Error(`Environment ${environment} does not exist`);
    }

    // Delete config file
    const configPath = path.join(this.configPath, `${environment}.json`);
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }

    this.configs.delete(environment);

    this.logger.info('config-manager', `Environment ${environment} deleted`);
    this.emit('environmentDeleted', { environment });
  }

  getEnvironments(): EnvironmentConfig['name'][] {
    return Array.from(this.configs.keys());
  }

  async exportConfig(environment: EnvironmentConfig['name'], includeSecrets: boolean = false): Promise<string> {
    const config = this.getConfig(environment);
    
    if (!includeSecrets) {
      // Remove sensitive data
      const sanitized = { ...config };
      sanitized.database.password = '***';
      sanitized.security.jwtSecret = '***';
      sanitized.security.sessionSecret = '***';
      sanitized.external.emailApiKey = '***';
      sanitized.external.smsApiKey = '***';
      
      return JSON.stringify(sanitized, null, 2);
    }
    
    return JSON.stringify(config, null, 2);
  }

  async importConfig(environment: EnvironmentConfig['name'], configData: string): Promise<void> {
    try {
      const config = JSON.parse(configData);
      
      // Validate structure
      const requiredFields = ['name', 'database', 'server', 'security', 'logging', 'features', 'external'];
      for (const field of requiredFields) {
        if (!config[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      await this.createEnvironment(environment as EnvironmentConfig['name'], config);
      
      this.logger.info('config-manager', `Configuration imported for environment ${environment}`);
      
    } catch (error) {
      this.logger.error('config-manager', `Failed to import configuration for environment ${environment}`, error as Error);
      throw error;
    }
  }

  async backupConfigs(): Promise<string> {
    const backup: Record<string, EnvironmentConfig> = {};
    
    for (const [env, config] of this.configs.entries()) {
      backup[env] = config;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.configPath, `backup-${timestamp}.json`);
    
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    
    this.logger.info('config-manager', `Configuration backup created: ${backupPath}`);
    
    return backupPath;
  }

  async restoreConfigs(backupPath: string): Promise<void> {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    try {
      const backupData = fs.readFileSync(backupPath, 'utf8');
      const backup: Record<string, EnvironmentConfig> = JSON.parse(backupData);

      for (const [env, config] of Object.entries(backup)) {
        const configPath = path.join(this.configPath, `${env}.json`);
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        this.configs.set(env as EnvironmentConfig['name'], config);
      }

      this.logger.info('config-manager', `Configuration restored from: ${backupPath}`);
      this.emit('configsRestored', { backupPath });

    } catch (error) {
      this.logger.error('config-manager', `Failed to restore configurations from: ${backupPath}`, error as Error);
      throw error;
    }
  }

  getEnvironmentVariable(key: string): string | undefined {
    return process.env[key];
  }

  setEnvironmentVariable(key: string, value: string): void {
    process.env[key] = value;
    this.logger.debug('config-manager', `Environment variable set: ${key}`);
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    currentEnvironment: string;
    configFilesExist: boolean;
    configValid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check if config files exist
    const configFilesExist = fs.existsSync(this.configPath);
    if (!configFilesExist) {
      issues.push('Config directory does not exist');
    }

    // Check if current config is valid
    const validation = this.validateConfig(this.currentEnvironment);
    const configValid = validation.valid;
    if (!configValid) {
      issues.push(...validation.errors);
    }

    return {
      healthy: issues.length === 0,
      currentEnvironment: this.currentEnvironment,
      configFilesExist,
      configValid,
      issues
    };
  }
}

export default UltraConfigManager;
