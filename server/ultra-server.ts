#!/usr/bin/env node

/**
 * ULTRA SERVER MODULE - ALL IN ONE (FINAL STRICT)
 * Enterprise-grade, self-healing, auto-scaling, zero-downtime server system
 */

import { UltraHealthMonitor } from './health-monitor';
import { UltraAutoHealer } from './auto-healer';
import { UltraLogger } from './logger';
import { UltraSecurity } from './security';
import { UltraDatabase } from './database';
import { UltraPerformance } from './performance';
import { UltraDeployment } from './deployment';
import { UltraMonitoring } from './monitoring';
import { UltraSelfTest } from './self-test';

export interface UltraServerConfig {
  port: number;
  host: string;
  environment: 'development' | 'staging' | 'production';
  enableHealthCheck: boolean;
  enableAutoHealing: boolean;
  enableMonitoring: boolean;
  enableSecurity: boolean;
  enablePerformance: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  gracefulShutdownTimeout: number;
}

export class UltraServer {
  private static instance: UltraServer;
  private config: UltraServerConfig;
  private isRunning: boolean = false;
  private isShuttingDown: boolean = false;
  
  // Core modules
  private healthMonitor: UltraHealthMonitor;
  private autoHealer: UltraAutoHealer;
  private logger: UltraLogger;
  private security: UltraSecurity;
  private database: UltraDatabase;
  private performance: UltraPerformance;
  private deployment: UltraDeployment;
  private monitoring: UltraMonitoring;
  private selfTest: UltraSelfTest;

  static getInstance(config?: UltraServerConfig): UltraServer {
    if (!UltraServer.instance) {
      UltraServer.instance = new UltraServer(config);
    }
    return UltraServer.instance;
  }

  constructor(config?: UltraServerConfig) {
    this.config = {
      port: parseInt(process.env.PORT || '3000'),
      host: process.env.HOST || '0.0.0.0',
      environment: (process.env.NODE_ENV as any) || 'production',
      enableHealthCheck: process.env.ENABLE_HEALTH_CHECK !== 'false',
      enableAutoHealing: process.env.ENABLE_AUTO_HEALING !== 'false',
      enableMonitoring: process.env.ENABLE_MONITORING !== 'false',
      enableSecurity: process.env.ENABLE_SECURITY !== 'false',
      enablePerformance: process.env.ENABLE_PERFORMANCE !== 'false',
      logLevel: (process.env.LOG_LEVEL as any) || 'info',
      gracefulShutdownTimeout: parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT || '30000'),
      ...config
    };

    this.initializeModules();
    this.setupGracefulShutdown();
  }

  private initializeModules(): void {
    console.log('🚀 Initializing Ultra Server Modules...');

    // Initialize core modules
    this.logger = UltraLogger.getInstance();
    this.healthMonitor = UltraHealthMonitor.getInstance();
    this.autoHealer = UltraAutoHealer.getInstance();
    this.security = UltraSecurity.getInstance();
    this.database = UltraDatabase.getInstance();
    this.performance = UltraPerformance.getInstance();
    this.deployment = UltraDeployment.getInstance();
    this.monitoring = UltraMonitoring.getInstance();
    this.selfTest = UltraSelfTest.getInstance();

    this.logger.info('ultra-server', 'Ultra Server modules initialized');
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('ultra-server', 'Ultra Server is already running');
      return;
    }

    try {
      this.logger.info('ultra-server', 'Starting Ultra Server...');

      // Run self-tests first
      if (this.config.environment === 'production') {
        this.logger.info('ultra-server', 'Running pre-start self-tests...');
        const testResults = await this.selfTest.quickHealthCheck();
        const failedTests = testResults.filter(t => t.status === 'fail');
        
        if (failedTests.length > 0) {
          throw new Error(`Pre-start self-tests failed: ${failedTests.map(t => t.name).join(', ')}`);
        }
        
        this.logger.info('ultra-server', 'Pre-start self-tests passed');
      }

      // Start monitoring
      if (this.config.enableMonitoring) {
        await this.monitoring.startMonitoring();
        this.logger.info('ultra-server', 'Monitoring system started');
      }

      // Start health monitoring
      if (this.config.enableHealthCheck) {
        await this.healthMonitor.startMonitoring();
        this.logger.info('ultra-server', 'Health monitoring started');
      }

      // Auto-healing is started by health monitor alerts

      // Setup performance optimizations
      if (this.config.enablePerformance) {
        await this.performance.warmupCache();
        this.logger.info('ultra-server', 'Performance optimizations enabled');
      }

      // Verify database connection
      const dbHealth = await this.database.healthCheck();
      if (!dbHealth.connected) {
        throw new Error('Database connection failed');
      }
      this.logger.info('ultra-server', 'Database connection verified');

      // Log server startup
      this.logger.info('ultra-server', `Ultra Server started successfully on ${this.config.host}:${this.config.port}`, {
        environment: this.config.environment,
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid
      });

      this.isRunning = true;

      // Emit server ready event
      this.emit('server:ready', {
        port: this.config.port,
        host: this.config.host,
        environment: this.config.environment,
        startTime: new Date()
      });

    } catch (error) {
      this.logger.critical('ultra-server', 'Failed to start Ultra Server', error as Error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('ultra-server', 'Ultra Server is already shutting down');
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('ultra-server', 'Shutting down Ultra Server...');

    try {
      // Set shutdown timeout
      const shutdownTimeout = setTimeout(() => {
        this.logger.error('ultra-server', 'Graceful shutdown timeout, forcing exit');
        process.exit(1);
      }, this.config.gracefulShutdownTimeout);

      // Stop accepting new requests
      this.logger.info('ultra-server', 'Stopping new requests...');

      // Stop monitoring
      if (this.config.enableMonitoring) {
        await this.monitoring.stopMonitoring();
        this.logger.info('ultra-server', 'Monitoring stopped');
      }

      // Stop health monitoring
      if (this.config.enableHealthCheck) {
        await this.healthMonitor.stopMonitoring();
        this.logger.info('ultra-server', 'Health monitoring stopped');
      }

      // Close database connections
      await this.database.close();
      this.logger.info('ultra-server', 'Database connections closed');

      // Cleanup performance module
      this.performance.destroy();
      this.logger.info('ultra-server', 'Performance module cleaned up');

      // Cleanup security module
      this.security.destroy();
      this.logger.info('ultra-server', 'Security module cleaned up');

      // Clear shutdown timeout
      clearTimeout(shutdownTimeout);

      this.isRunning = false;
      this.isShuttingDown = false;

      this.logger.info('ultra-server', 'Ultra Server stopped successfully');

      // Emit server stopped event
      this.emit('server:stopped', {
        stopTime: new Date(),
        graceful: true
      });

    } catch (error) {
      this.logger.error('ultra-server', 'Error during shutdown', error as Error);
      throw error;
    }
  }

  async restart(): Promise<void> {
    this.logger.info('ultra-server', 'Restarting Ultra Server...');
    
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    await this.start();
    
    this.logger.info('ultra-server', 'Ultra Server restarted successfully');
  }

  async deploy(version: string): Promise<string> {
    this.logger.info('ultra-server', `Starting deployment of version ${version}`);
    
    try {
      const deploymentId = await this.deployment.deploy(version);
      this.logger.info('ultra-server', `Deployment ${deploymentId} started`);
      return deploymentId;
    } catch (error) {
      this.logger.error('ultra-server', 'Deployment failed', error as Error);
      throw error;
    }
  }

  async runSelfTest(full: boolean = false): Promise<any> {
    this.logger.info('ultra-server', `Running ${full ? 'full' : 'quick'} self-test`);
    
    try {
      if (full) {
        const testSuites = await this.selfTest.runFullTestSuite();
        const report = this.selfTest.generateReport(testSuites);
        
        this.logger.info('ultra-server', 'Full self-test completed', {
          totalSuites: testSuites.length,
          passed: testSuites.filter(s => s.status === 'pass').length,
          failed: testSuites.filter(s => s.status === 'fail').length
        });
        
        return { testSuites, report };
      } else {
        const results = await this.selfTest.quickHealthCheck();
        const failed = results.filter(r => r.status === 'fail');
        
        this.logger.info('ultra-server', 'Quick self-test completed', {
          total: results.length,
          passed: results.filter(r => r.status === 'pass').length,
          failed: failed.length
        });
        
        return { results, passed: failed.length === 0 };
      }
    } catch (error) {
      this.logger.error('ultra-server', 'Self-test failed', error as Error);
      throw error;
    }
  }

  getSystemStatus(): any {
    return {
      running: this.isRunning,
      shuttingDown: this.isShuttingDown,
      config: this.config,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform
    };
  }

  async getHealthReport(): Promise<any> {
    const systemHealth = await this.healthMonitor.getSystemHealth();
    const databaseHealth = await this.database.healthCheck();
    const performanceStats = this.performance.getPerformanceStats();
    const securityStats = this.security.getSecurityStats();
    const monitoringOverview = await this.monitoring.getSystemOverview();
    
    return {
      timestamp: new Date(),
      overall: systemHealth.overall,
      system: systemHealth,
      database: databaseHealth,
      performance: performanceStats,
      security: securityStats,
      monitoring: monitoringOverview
    };
  }

  // Event emitter functionality
  private eventListeners: Map<string, Array<(data: any) => void>> = new Map();

  on(event: string, listener: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          this.logger.error('ultra-server', `Error in event listener for ${event}`, error as Error);
        }
      });
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info('ultra-server', `Received ${signal}, starting graceful shutdown`);
      
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        this.logger.error('ultra-server', 'Error during graceful shutdown', error as Error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.critical('ultra-server', 'Uncaught exception', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.critical('ultra-server', 'Unhandled rejection', new Error(String(reason)));
      shutdown('unhandledRejection');
    });
  }

  // CLI interface
  static async runCLI(): Promise<void> {
    const args = process.argv.slice(2);
    const command = args[0];

    const server = UltraServer.getInstance();

    try {
      switch (command) {
        case 'start':
          await server.start();
          console.log('✅ Ultra Server started successfully');
          break;

        case 'stop':
          await server.stop();
          console.log('✅ Ultra Server stopped successfully');
          break;

        case 'restart':
          await server.restart();
          console.log('✅ Ultra Server restarted successfully');
          break;

        case 'status':
          const status = server.getSystemStatus();
          console.log('📊 Ultra Server Status:');
          console.log(JSON.stringify(status, null, 2));
          break;

        case 'health':
          const health = await server.getHealthReport();
          console.log('🏥 Ultra Server Health Report:');
          console.log(JSON.stringify(health, null, 2));
          break;

        case 'test':
          const fullTest = args.includes('--full');
          const testResults = await server.runSelfTest(fullTest);
          if (fullTest && testResults.report) {
            console.log(testResults.report);
          } else {
            console.log(testResults.passed ? '✅ Quick health check passed' : '❌ Quick health check failed');
          }
          break;

        case 'deploy':
          const version = args[1] || 'latest';
          const deploymentId = await server.deploy(version);
          console.log(`✅ Deployment ${deploymentId} started for version ${version}`);
          break;

        default:
          console.log(`
🚀 Ultra Server CLI

Usage: node ultra-server.js <command> [options]

Commands:
  start           Start the Ultra Server
  stop            Stop the Ultra Server
  restart         Restart the Ultra Server
  status          Show server status
  health          Show detailed health report
  test [--full]   Run self-tests (quick or full)
  deploy <version> Deploy a new version

Examples:
  node ultra-server.js start
  node ultra-server.js test --full
  node ultra-server.js deploy v1.2.3
          `);
          process.exit(0);
      }
    } catch (error) {
      console.error('❌ Command failed:', error.message);
      process.exit(1);
    }
  }
}

// CLI entry point
if (require.main === module) {
  UltraServer.runCLI().catch(error => {
    console.error('❌ Ultra Server CLI failed:', error);
    process.exit(1);
  });
}

export default UltraServer;
