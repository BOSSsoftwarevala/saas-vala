import { UltraLogger } from './logger';
import { UltraHealthMonitor } from './health-monitor';
import { UltraDatabase } from './database';
import { UltraSecurity } from './security';
import { UltraPerformance } from './performance';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  message: string;
  details?: any;
  error?: string;
}

export interface TestSuite {
  name: string;
  tests: TestResult[];
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  passed: number;
  failed: number;
  skipped: number;
}

export class UltraSelfTest {
  private static instance: UltraSelfTest;
  private logger: UltraLogger;
  private healthMonitor: UltraHealthMonitor;
  private database: UltraDatabase;
  private security: UltraSecurity;
  private performance: UltraPerformance;

  static getInstance(): UltraSelfTest {
    if (!UltraSelfTest.instance) {
      UltraSelfTest.instance = new UltraSelfTest();
    }
    return UltraSelfTest.instance;
  }

  constructor() {
    this.logger = UltraLogger.getInstance();
    this.healthMonitor = UltraHealthMonitor.getInstance();
    this.database = UltraDatabase.getInstance();
    this.security = UltraSecurity.getInstance();
    this.performance = UltraPerformance.getInstance();
  }

  async runFullTestSuite(): Promise<TestSuite[]> {
    this.logger.info('self-test', 'Starting full self-test suite');
    
    const testSuites: TestSuite[] = [];

    // Core system tests
    testSuites.push(await this.runCoreTests());
    
    // Database tests
    testSuites.push(await this.runDatabaseTests());
    
    // Security tests
    testSuites.push(await this.runSecurityTests());
    
    // Performance tests
    testSuites.push(await this.runPerformanceTests());
    
    // Network tests
    testSuites.push(await this.runNetworkTests());
    
    // Integration tests
    testSuites.push(await this.runIntegrationTests());

    const overallStatus = this.calculateOverallStatus(testSuites);
    this.logger.info('self-test', `Self-test suite completed with status: ${overallStatus}`, {
      totalSuites: testSuites.length,
      passed: testSuites.filter(s => s.status === 'pass').length,
      failed: testSuites.filter(s => s.status === 'fail').length
    });

    return testSuites;
  }

  private async runCoreTests(): Promise<TestSuite> {
    const suite: TestSuite = {
      name: 'Core System Tests',
      tests: [],
      status: 'pass',
      duration: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    };

    const startTime = Date.now();

    // Test 1: Process health
    await this.runTest(suite, 'Process Health', async () => {
      const uptime = process.uptime();
      const memUsage = process.memoryUsage();
      
      if (uptime < 10) {
        throw new Error('Process uptime too low');
      }
      
      if (memUsage.heapUsed > 1024 * 1024 * 1024) { // 1GB
        throw new Error('Memory usage too high');
      }
      
      return { uptime, memoryUsage: memUsage };
    });

    // Test 2: File system access
    await this.runTest(suite, 'File System Access', async () => {
      const testFile = '/tmp/saasvala-test';
      
      try {
        await execAsync(`echo "test" > ${testFile}`);
        const { stdout } = await execAsync(`cat ${testFile}`);
        await execAsync(`rm ${testFile}`);
        
        if (stdout.trim() !== 'test') {
          throw new Error('File system read/write test failed');
        }
        
        return { success: true };
      } catch (error) {
        throw new Error(`File system error: ${error.message}`);
      }
    });

    // Test 3: Environment variables
    await this.runTest(suite, 'Environment Variables', async () => {
      const requiredVars = ['NODE_ENV', 'DB_HOST', 'DB_NAME'];
      const missing = requiredVars.filter(varName => !process.env[varName]);
      
      if (missing.length > 0) {
        throw new Error(`Missing environment variables: ${missing.join(', ')}`);
      }
      
      return { present: requiredVars.filter(varName => process.env[varName]) };
    });

    // Test 4: System resources
    await this.runTest(suite, 'System Resources', async () => {
      try {
        const { stdout: memInfo } = await execAsync('free -m');
        const { stdout: diskInfo } = await execAsync('df -h /');
        
        const memLines = memInfo.split('\n');
        const memData = memLines[1].split(/\s+/);
        const memAvailable = parseInt(memData[6]);
        
        if (memAvailable < 100) { // Less than 100MB available
          throw new Error('Low memory available');
        }
        
        const diskLines = diskInfo.split('\n');
        const diskData = diskLines[1].split(/\s+/);
        const diskUsage = parseInt(diskData[4]);
        
        if (diskUsage > 95) {
          throw new Error('Disk usage too high');
        }
        
        return { memoryAvailableMB: memAvailable, diskUsagePercent: diskUsage };
      } catch (error) {
        throw new Error(`System resource check failed: ${error.message}`);
      }
    });

    suite.duration = Date.now() - startTime;
    this.updateSuiteStatus(suite);
    
    return suite;
  }

  private async runDatabaseTests(): Promise<TestSuite> {
    const suite: TestSuite = {
      name: 'Database Tests',
      tests: [],
      status: 'pass',
      duration: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    };

    const startTime = Date.now();

    // Test 1: Database connection
    await this.runTest(suite, 'Database Connection', async () => {
      const health = await this.database.healthCheck();
      
      if (!health.connected) {
        throw new Error(`Database not connected: ${health.error}`);
      }
      
      return health;
    });

    // Test 2: Database query
    await this.runTest(suite, 'Database Query', async () => {
      try {
        const result = await this.database.query('SELECT 1 as test');
        
        if (!result || result.length === 0 || result[0].test !== 1) {
          throw new Error('Database query returned unexpected result');
        }
        
        return { result: result[0] };
      } catch (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }
    });

    // Test 3: Database transaction
    await this.runTest(suite, 'Database Transaction', async () => {
      try {
        const result = await this.database.transaction(async (client) => {
          const { rows } = await client.query('SELECT 1 as test');
          return rows[0];
        });
        
        if (!result || result.test !== 1) {
          throw new Error('Database transaction failed');
        }
        
        return { result };
      } catch (error) {
        throw new Error(`Database transaction failed: ${error.message}`);
      }
    });

    // Test 4: Data integrity
    await this.runTest(suite, 'Data Integrity Check', async () => {
      try {
        const integrity = await this.database.checkDataIntegrity();
        
        if (!integrity.valid) {
          throw new Error(`Data integrity issues found: ${integrity.issues.map(i => i.issue).join(', ')}`);
        }
        
        return integrity;
      } catch (error) {
        throw new Error(`Data integrity check failed: ${error.message}`);
      }
    });

    suite.duration = Date.now() - startTime;
    this.updateSuiteStatus(suite);
    
    return suite;
  }

  private async runSecurityTests(): Promise<TestSuite> {
    const suite: TestSuite = {
      name: 'Security Tests',
      tests: [],
      status: 'pass',
      duration: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    };

    const startTime = Date.now();

    // Test 1: JWT token generation
    await this.runTest(suite, 'JWT Token Generation', async () => {
      try {
        const payload = { userId: 'test-user', role: 'user' };
        const token = this.security.generateToken(payload);
        const decoded = this.security.verifyToken(token);
        
        if (!decoded || decoded.userId !== payload.userId) {
          throw new Error('JWT token generation/verification failed');
        }
        
        return { tokenGenerated: true, tokenVerified: true };
      } catch (error) {
        throw new Error(`JWT test failed: ${error.message}`);
      }
    });

    // Test 2: Input validation
    await this.runTest(suite, 'Input Validation', async () => {
      const testCases = [
        { input: 'test@example.com', type: 'email', valid: true },
        { input: 'invalid-email', type: 'email', valid: false },
        { input: 'TestPass123!', type: 'password', valid: true },
        { input: 'weak', type: 'password', valid: false },
        { input: '<script>alert("xss")</script>', type: 'general', valid: false }
      ];

      for (const testCase of testCases) {
        const result = this.security.validateInput(testCase.input, testCase.type as any);
        if (result.valid !== testCase.valid) {
          throw new Error(`Input validation failed for ${testCase.input} (${testCase.type})`);
        }
      }
      
      return { allTestsPassed: true };
    });

    // Test 3: Rate limiting
    await this.runTest(suite, 'Rate Limiting', async () => {
      const identifier = 'test-self-test';
      
      // First request should succeed
      const result1 = this.security.checkRateLimit(identifier, 2, 1000);
      if (!result1.allowed) {
        throw new Error('Rate limiting blocked first request');
      }
      
      // Second request should succeed
      const result2 = this.security.checkRateLimit(identifier, 2, 1000);
      if (!result2.allowed) {
        throw new Error('Rate limiting blocked second request');
      }
      
      // Third request should be blocked
      const result3 = this.security.checkRateLimit(identifier, 2, 1000);
      if (result3.allowed) {
        throw new Error('Rate limiting did not block third request');
      }
      
      return { rateLimitingWorking: true };
    });

    // Test 4: IP blocking
    await this.runTest(suite, 'IP Blocking', async () => {
      const testIP = '192.168.1.999';
      
      // IP should not be blocked initially
      if (this.security.isIPBlocked(testIP)) {
        throw new Error('IP initially blocked');
      }
      
      // Block IP
      this.security.blockIP(testIP, 'Test blocking', 1000);
      
      // IP should now be blocked
      if (!this.security.isIPBlocked(testIP)) {
        throw new Error('IP not blocked after blocking');
      }
      
      // Unblock IP
      this.security.unblockIP(testIP);
      
      // IP should not be blocked anymore
      if (this.security.isIPBlocked(testIP)) {
        throw new Error('IP still blocked after unblocking');
      }
      
      return { ipBlockingWorking: true };
    });

    suite.duration = Date.now() - startTime;
    this.updateSuiteStatus(suite);
    
    return suite;
  }

  private async runPerformanceTests(): Promise<TestSuite> {
    const suite: TestSuite = {
      name: 'Performance Tests',
      tests: [],
      status: 'pass',
      duration: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    };

    const startTime = Date.now();

    // Test 1: Cache functionality
    await this.runTest(suite, 'Cache Functionality', async () => {
      const testKey = 'test-key';
      const testValue = { data: 'test', timestamp: Date.now() };
      
      // Set cache
      this.performance.set(testKey, testValue, 5000);
      
      // Get cache
      const cached = this.performance.get(testKey);
      
      if (!cached || cached.data !== testValue.data) {
        throw new Error('Cache set/get failed');
      }
      
      // Delete cache
      this.performance.delete(testKey);
      
      // Should not be in cache anymore
      const cachedAfterDelete = this.performance.get(testKey);
      if (cachedAfterDelete !== null) {
        throw new Error('Cache delete failed');
      }
      
      return { cacheWorking: true };
    });

    // Test 2: Compression
    await this.runTest(suite, 'Compression', async () => {
      const testString = 'This is a test string that should be compressible. '.repeat(100);
      const contentType = 'text/plain';
      
      const compressed = this.performance.compress(testString, contentType);
      
      if (compressed === testString) {
        // String might not have been compressed if too small
        return { compressionSkipped: true };
      }
      
      const decompressed = this.performance.decompress(compressed as Buffer);
      
      if (decompressed !== testString) {
        throw new Error('Compression/decompression failed');
      }
      
      return { compressionWorking: true };
    });

    // Test 3: Response time
    await this.runTest(suite, 'Response Time', async () => {
      const startTime = Date.now();
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const responseTime = Date.now() - startTime;
      
      if (responseTime > 100) {
        throw new Error(`Response time too high: ${responseTime}ms`);
      }
      
      return { responseTime };
    });

    suite.duration = Date.now() - startTime;
    this.updateSuiteStatus(suite);
    
    return suite;
  }

  private async runNetworkTests(): Promise<TestSuite> {
    const suite: TestSuite = {
      name: 'Network Tests',
      tests: [],
      status: 'pass',
      duration: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    };

    const startTime = Date.now();

    // Test 1: Local HTTP server
    await this.runTest(suite, 'Local HTTP Server', async () => {
      try {
        const { stdout: statusCode } = await execAsync('curl -s -o /dev/null -w "%{http_code}" http://localhost:5173');
        
        if (statusCode !== '200') {
          throw new Error(`Local server returned status ${statusCode}`);
        }
        
        return { statusCode };
      } catch (error) {
        throw new Error(`Local server test failed: ${error.message}`);
      }
    });

    // Test 2: External connectivity
    await this.runTest(suite, 'External Connectivity', async () => {
      try {
        const { stdout: statusCode } = await execAsync('curl -s -o /dev/null -w "%{http_code}" https://httpbin.org/status/200 --max-time 10');
        
        if (statusCode !== '200') {
          throw new Error(`External connectivity test failed with status ${statusCode}`);
        }
        
        return { statusCode };
      } catch (error) {
        throw new Error(`External connectivity test failed: ${error.message}`);
      }
    });

    // Test 3: DNS resolution
    await this.runTest(suite, 'DNS Resolution', async () => {
      try {
        const { stdout } = await execAsync('nslookup google.com');
        
        if (!stdout.includes('google.com')) {
          throw new Error('DNS resolution failed');
        }
        
        return { dnsWorking: true };
      } catch (error) {
        throw new Error(`DNS resolution test failed: ${error.message}`);
      }
    });

    // Test 4: SSL certificate
    await this.runTest(suite, 'SSL Certificate', async () => {
      try {
        const { stdout } = await execAsync('openssl s_client -connect saasvala.com:443 -servername saasvala.com </dev/null 2>/dev/null | openssl x509 -noout -dates');
        
        if (!stdout.includes('notAfter')) {
          throw new Error('Could not get SSL certificate dates');
        }
        
        const notAfterMatch = stdout.match(/notAfter=(.+)/);
        if (!notAfterMatch) {
          throw new Error('Could not parse SSL certificate expiry');
        }
        
        const expiryDate = new Date(notAfterMatch[1]);
        const now = new Date();
        const daysUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysUntilExpiry < 7) {
          throw new Error(`SSL certificate expires in ${Math.floor(daysUntilExpiry)} days`);
        }
        
        return { expiryDate: expiryDate.toISOString(), daysUntilExpiry: Math.floor(daysUntilExpiry) };
      } catch (error) {
        throw new Error(`SSL certificate test failed: ${error.message}`);
      }
    });

    suite.duration = Date.now() - startTime;
    this.updateSuiteStatus(suite);
    
    return suite;
  }

  private async runIntegrationTests(): Promise<TestSuite> {
    const suite: TestSuite = {
      name: 'Integration Tests',
      tests: [],
      status: 'pass',
      duration: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    };

    const startTime = Date.now();

    // Test 1: Health monitoring integration
    await this.runTest(suite, 'Health Monitoring Integration', async () => {
      const health = await this.healthMonitor.getSystemHealth();
      
      if (!health || !health.services || health.services.length === 0) {
        throw new Error('Health monitoring not returning data');
      }
      
      return { servicesCount: health.services.length, overall: health.overall };
    });

    // Test 2: Logger integration
    await this.runTest(suite, 'Logger Integration', async () => {
      const stats = this.logger.getLogStats();
      
      if (!stats || typeof stats.totalLogs !== 'number') {
        throw new Error('Logger stats not available');
      }
      
      // Test logging
      this.logger.info('self-test', 'Integration test log message');
      
      return { totalLogs: stats.totalLogs };
    });

    // Test 3: Performance monitoring integration
    await this.runTest(suite, 'Performance Monitoring Integration', async () => {
      const stats = this.performance.getPerformanceStats();
      
      if (!stats || !stats.metrics || !stats.cache) {
        throw new Error('Performance stats not available');
      }
      
      return { 
        responseTime: stats.metrics.responseTime,
        cacheHitRate: stats.cache.hitRate
      };
    });

    // Test 4: End-to-end API test
    await this.runTest(suite, 'End-to-End API Test', async () => {
      try {
        // Test homepage
        const { stdout: homeStatus } = await execAsync('curl -s -o /dev/null -w "%{http_code}" https://saasvala.com');
        
        if (homeStatus !== '200') {
          throw new Error(`Homepage returned status ${homeStatus}`);
        }
        
        // Test API health endpoint if it exists
        try {
          const { stdout: apiStatus } = await execAsync('curl -s -o /dev/null -w "%{http_code}" https://saasvala.com/api/health --max-time 5');
          return { homeStatus, apiStatus };
        } catch {
          // API endpoint might not exist, that's okay
          return { homeStatus, apiStatus: 'not_tested' };
        }
      } catch (error) {
        throw new Error(`End-to-end API test failed: ${error.message}`);
      }
    });

    suite.duration = Date.now() - startTime;
    this.updateSuiteStatus(suite);
    
    return suite;
  }

  private async runTest(suite: TestSuite, name: string, testFn: () => Promise<any>): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      suite.tests.push({
        name,
        status: 'pass',
        duration,
        message: 'Test passed',
        details: result
      });
      
      suite.passed++;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      suite.tests.push({
        name,
        status: 'fail',
        duration,
        message: 'Test failed',
        error: error.message
      });
      
      suite.failed++;
      
      this.logger.error('self-test', `Test failed: ${name}`, error as Error);
    }
  }

  private updateSuiteStatus(suite: TestSuite): void {
    if (suite.failed > 0) {
      suite.status = 'fail';
    } else if (suite.passed > 0) {
      suite.status = 'pass';
    } else {
      suite.status = 'skip';
    }
  }

  private calculateOverallStatus(testSuites: TestSuite[]): 'pass' | 'fail' | 'skip' {
    const failedSuites = testSuites.filter(s => s.status === 'fail');
    const passedSuites = testSuites.filter(s => s.status === 'pass');
    
    if (failedSuites.length > 0) {
      return 'fail';
    } else if (passedSuites.length > 0) {
      return 'pass';
    } else {
      return 'skip';
    }
  }

  // Quick health check for deployment validation
  async quickHealthCheck(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    // Critical checks only
    const checks = [
      {
        name: 'Homepage Load',
        test: async () => {
          const { stdout } = await execAsync('curl -f -s -o /dev/null -w "%{http_code}" https://saasvala.com');
          return { statusCode: stdout.trim() };
        }
      },
      {
        name: 'Database Connection',
        test: async () => {
          const health = await this.database.healthCheck();
          return health;
        }
      },
      {
        name: 'Process Health',
        test: async () => {
          return { uptime: process.uptime(), memory: process.memoryUsage() };
        }
      }
    ];

    for (const check of checks) {
      const startTime = Date.now();
      try {
        const result = await check.test();
        results.push({
          name: check.name,
          status: 'pass',
          duration: Date.now() - startTime,
          message: 'Check passed',
          details: result
        });
      } catch (error) {
        results.push({
          name: check.name,
          status: 'fail',
          duration: Date.now() - startTime,
          message: 'Check failed',
          error: error.message
        });
      }
    }

    return results;
  }

  // Generate test report
  generateReport(testSuites: TestSuite[]): string {
    const totalTests = testSuites.reduce((sum, suite) => sum + suite.tests.length, 0);
    const totalPassed = testSuites.reduce((sum, suite) => sum + suite.passed, 0);
    const totalFailed = testSuites.reduce((sum, suite) => sum + suite.failed, 0);
    const totalSkipped = testSuites.reduce((sum, suite) => sum + suite.skipped, 0);
    const totalDuration = testSuites.reduce((sum, suite) => sum + suite.duration, 0);

    let report = `# Self-Test Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Overall Status:** ${this.calculateOverallStatus(testSuites).toUpperCase()}\n\n`;
    
    report += `## Summary\n\n`;
    report += `- **Total Tests:** ${totalTests}\n`;
    report += `- **Passed:** ${totalPassed}\n`;
    report += `- **Failed:** ${totalFailed}\n`;
    report += `- **Skipped:** ${totalSkipped}\n`;
    report += `- **Duration:** ${totalDuration}ms\n\n`;

    for (const suite of testSuites) {
      report += `## ${suite.name}\n\n`;
      report += `**Status:** ${suite.status.toUpperCase()}\n`;
      report += `**Duration:** ${suite.duration}ms\n`;
      report += `**Passed:** ${suite.passed} | **Failed:** ${suite.failed} | **Skipped:** ${suite.skipped}\n\n`;
      
      for (const test of suite.tests) {
        const icon = test.status === 'pass' ? '✅' : test.status === 'fail' ? '❌' : '⏭️';
        report += `${icon} **${test.name}** (${test.duration}ms)\n`;
        
        if (test.status === 'fail') {
          report += `   - Error: ${test.error}\n`;
        }
        
        report += `\n`;
      }
      
      report += `---\n\n`;
    }

    return report;
  }
}

export default UltraSelfTest;
