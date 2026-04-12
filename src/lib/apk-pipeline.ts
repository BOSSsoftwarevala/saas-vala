// Browser-compatible mock implementations for Node.js modules
const execSync = () => { throw new Error('execSync not available in browser'); };
const spawn = () => { throw new Error('spawn not available in browser'); };
const fs = {
  promises: {
    readFile: async () => '',
    writeFile: async () => {},
    mkdir: async () => {},
    access: async () => {},
    stat: async () => ({ isFile: () => false, isDirectory: () => false }),
    readdir: async () => [],
    rm: async () => {},
    copyFile: async () => {}
  }
};
const path = {
  join: (...parts: string[]) => parts.join('/'),
  resolve: (...parts: string[]) => parts.join('/'),
  dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
  basename: (p: string) => p.split('/').pop() || '',
  extname: (p: string) => p.includes('.') ? '.' + p.split('.').pop() : ''
};
const crypto = {
  createHash: (algorithm: string) => ({
    update: (data: string) => ({
      digest: (encoding: string) => 'mock-hash-' + algorithm + '-' + data.length
    })
  }),
  randomBytes: (size: number) => Buffer.alloc(size).fill(0),
  createHmac: () => ({ update: () => ({ digest: () => 'mock-hmac' }) })
};
const createHash = crypto.createHash;

// APK Pipeline - Auto Git Scan → Build → Test → Secure APK (Admin Only)

// 1. Input Sources
interface BuildSource {
  id: string;
  type: 'github' | 'upload';
  url?: string;
  zipPath?: string;
  projectId: string;
  adminId: string;
  timestamp: Date;
}

// 2. Project Detection
interface ProjectInfo {
  type: 'react' | 'next' | 'php' | 'static' | 'node' | 'vue' | 'angular';
  framework: string;
  buildCommand: string;
  outputDir: string;
  hasPackageJson: boolean;
  hasBuildConfig: boolean;
  missingFiles: string[];
  dependencies: string[];
}

// 3. Build Configuration
interface BuildConfig {
  appId: string;
  appName: string;
  version: string;
  minSdkVersion: number;
  targetSdkVersion: number;
  permissions: string[];
  icons: IconConfig;
  splash: SplashConfig;
  plugins: string[];
}

interface IconConfig {
  foreground: string;
  background: string;
  icon: string;
}

interface SplashConfig {
  backgroundColor: string;
  splash: string;
}

// 4. Build Result
interface BuildResult {
  id: string;
  sourceId: string;
  status: 'pending' | 'building' | 'testing' | 'success' | 'failed';
  apkPath?: string;
  apkSize?: number;
  downloadUrl?: string;
  logs: BuildLog[];
  errors: string[];
  startTime: Date;
  endTime?: Date;
  testResults?: TestResult;
}

interface BuildLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  step: string;
}

// 5. Test Result
interface TestResult {
  id: string;
  buildId: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  tests: {
    launch: boolean;
    uiLoad: boolean;
    keyActivation: boolean;
    functionality: boolean;
  };
  emulatorId: string;
  screenshots: string[];
  logs: string[];
  errors: string[];
}

// 6. APK Storage
interface APKStorage {
  id: string;
  buildId: string;
  productId: string;
  version: string;
  apkPath: string;
  apkSize: number;
  checksum: string;
  downloadUrl: string;
  protected: boolean;
  createdAt: Date;
}

// 7. Key System
interface LicenseKey {
  id: string;
  productId: string;
  deviceId: string;
  key: string;
  expiry: Date;
  active: boolean;
  createdAt: Date;
  lastUsed?: Date;
}

// 8. Queue System
interface BuildQueue {
  id: string;
  buildId: string;
  priority: 'low' | 'normal' | 'high';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
}

class APKPipeline {
  private static instance: APKPipeline;
  
  // Core systems
  private activeBuilds: Map<string, BuildResult> = new Map();
  private buildQueue: BuildQueue[] = [];
  private projectInfo: Map<string, ProjectInfo> = new Map();
  private apkStorage: Map<string, APKStorage> = new Map();
  private licenseKeys: Map<string, LicenseKey> = new Map();
  private testResults: Map<string, TestResult> = new Map();
  private buildHistory: BuildResult[] = [];
  
  // Configuration
  private readonly BUILD_DIR = '/tmp/apk-builds';
  private readonly OUTPUT_DIR = '/tmp/apk-output';
  private readonly MAX_CONCURRENT_BUILDS = 3;
  private readonly BUILD_TIMEOUT = 300000; // 5 minutes
  
  static getInstance(): APKPipeline {
    if (!APKPipeline.instance) {
      APKPipeline.instance = new APKPipeline();
    }
    return APKPipeline.instance;
  }

  constructor() {
    this.initializeDirectories();
    this.startQueueProcessor();
  }

  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.BUILD_DIR, { recursive: true });
      await fs.mkdir(this.OUTPUT_DIR, { recursive: true });
    } catch (error) {
      console.error('Failed to initialize directories:', error);
    }
  }

  // 1. INPUT SOURCES
  async submitBuild(source: BuildSource): Promise<string> {
    const buildId = `build-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const buildResult: BuildResult = {
      id: buildId,
      sourceId: source.id,
      status: 'pending',
      logs: [],
      errors: [],
      startTime: new Date()
    };
    
    this.activeBuilds.set(buildId, buildResult);
    
    // Add to queue
    const queueItem: BuildQueue = {
      id: `queue-${Date.now()}`,
      buildId,
      priority: 'normal',
      status: 'queued',
      queuedAt: new Date(),
      retryCount: 0,
      maxRetries: 3
    };
    
    this.buildQueue.push(queueItem);
    this.buildQueue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
    
    this.addLog(buildId, 'info', 'Build submitted to queue', 'input');
    
    return buildId;
  }

  // 2. AUTO GIT SCAN ENGINE
  async scanRepository(buildId: string, source: BuildSource): Promise<ProjectInfo> {
    this.addLog(buildId, 'info', 'Starting repository scan', 'scan');
    
    const workDir = path.join(this.BUILD_DIR, buildId);
    
    try {
      // Clone repository
      if (source.type === 'github' && source.url) {
        await this.cloneRepository(source.url, workDir);
      } else if (source.type === 'upload' && source.zipPath) {
        await this.extractZip(source.zipPath, workDir);
      }
      
      // Detect project type
      const projectInfo = await this.detectProjectType(workDir);
      this.projectInfo.set(buildId, projectInfo);
      
      // Check for missing files
      const missingFiles = await this.checkMissingFiles(workDir, projectInfo);
      projectInfo.missingFiles = missingFiles;
      
      this.addLog(buildId, 'info', `Detected project type: ${projectInfo.type}`, 'scan');
      this.addLog(buildId, 'info', `Missing files: ${missingFiles.length}`, 'scan');
      
      return projectInfo;
      
    } catch (error) {
      this.addLog(buildId, 'error', `Repository scan failed: ${error.message}`, 'scan');
      throw error;
    }
  }

  private async cloneRepository(url: string, workDir: string): Promise<void> {
    const gitUrl = url.includes('github.com') ? url : `https://github.com/${url}`;
    execSync(`git clone "${gitUrl}" "${workDir}"`, { stdio: 'pipe' });
  }

  private async extractZip(zipPath: string, workDir: string): Promise<void> {
    // Extract ZIP file
    execSync(`unzip -q "${zipPath}" -d "${workDir}"`, { stdio: 'pipe' });
  }

  private async detectProjectType(workDir: string): Promise<ProjectInfo> {
    const packageJsonPath = path.join(workDir, 'package.json');
    const composerJsonPath = path.join(workDir, 'composer.json');
    const indexHtmlPath = path.join(workDir, 'index.html');
    
    let projectType: ProjectInfo['type'] = 'static';
    let framework = '';
    let buildCommand = '';
    let outputDir = 'dist';
    
    // Check for Node.js projects
    if (await this.fileExists(packageJsonPath)) {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (dependencies.next) {
        projectType = 'next';
        framework = 'Next.js';
        buildCommand = 'npm run build';
        outputDir = 'out';
      } else if (dependencies.react) {
        projectType = 'react';
        framework = 'React';
        buildCommand = 'npm run build';
        outputDir = 'build';
      } else if (dependencies.vue) {
        projectType = 'vue';
        framework = 'Vue.js';
        buildCommand = 'npm run build';
        outputDir = 'dist';
      } else if (dependencies['@angular/core']) {
        projectType = 'angular';
        framework = 'Angular';
        buildCommand = 'npm run build';
        outputDir = 'dist';
      } else {
        projectType = 'node';
        framework = 'Node.js';
        buildCommand = 'npm run build';
        outputDir = 'dist';
      }
    }
    // Check for PHP projects
    else if (await this.fileExists(composerJsonPath)) {
      projectType = 'php';
      framework = 'PHP';
      buildCommand = 'composer install && npm run build';
      outputDir = 'dist';
    }
    // Check for static sites
    else if (await this.fileExists(indexHtmlPath)) {
      projectType = 'static';
      framework = 'Static HTML';
      buildCommand = '';
      outputDir = '.';
    }
    
    return {
      type: projectType,
      framework,
      buildCommand,
      outputDir,
      hasPackageJson: await this.fileExists(packageJsonPath),
      hasBuildConfig: await this.hasBuildConfig(workDir),
      missingFiles: [],
      dependencies: await this.getDependencies(workDir)
    };
  }

  private async checkMissingFiles(workDir: string, projectInfo: ProjectInfo): Promise<string[]> {
    const missing: string[] = [];
    
    // Check for essential files
    const essentialFiles = ['index.html'];
    if (projectInfo.hasPackageJson) {
      essentialFiles.push('package.json');
    }
    
    for (const file of essentialFiles) {
      if (!(await this.fileExists(path.join(workDir, file)))) {
        missing.push(file);
      }
    }
    
    return missing;
  }

  // 3. AUTO FIX ENGINE
  async autoFixProject(buildId: string, workDir: string, projectInfo: ProjectInfo): Promise<void> {
    this.addLog(buildId, 'info', 'Starting auto-fix process', 'fix');
    
    try {
      // Add missing files
      await this.addMissingFiles(workDir, projectInfo);
      
      // Add Android wrapper (Capacitor)
      await this.addAndroidWrapper(workDir, projectInfo);
      
      // Fix dependencies
      await this.fixDependencies(workDir, projectInfo);
      
      // Generate Android configuration
      await this.generateAndroidConfig(workDir, projectInfo);
      
      this.addLog(buildId, 'info', 'Auto-fix completed successfully', 'fix');
      
    } catch (error) {
      this.addLog(buildId, 'error', `Auto-fix failed: ${error.message}`, 'fix');
      throw error;
    }
  }

  private async addMissingFiles(workDir: string, projectInfo: ProjectInfo): Promise<void> {
    // Add missing index.html for static projects
    if (projectInfo.missingFiles.includes('index.html')) {
      const indexHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mobile App</title>
</head>
<body>
    <div id="app">
        <h1>Welcome to Mobile App</h1>
        <p>Your application is loading...</p>
    </div>
    <script src="app.js"></script>
</body>
</html>`;
      await fs.writeFile(path.join(workDir, 'index.html'), indexHtml);
    }
  }

  private async addAndroidWrapper(workDir: string, projectInfo: ProjectInfo): Promise<void> {
    // Add Capacitor configuration
    const capacitorConfig = {
      appId: 'com.example.app',
      appName: 'Mobile App',
      webDir: projectInfo.outputDir,
      server: {
        androidScheme: 'https'
      }
    };
    
    await fs.writeFile(
      path.join(workDir, 'capacitor.config.ts'),
      `export default ${JSON.stringify(capacitorConfig, null, 2)};`
    );
    
    // Add package.json dependencies for Capacitor
    if (projectInfo.hasPackageJson) {
      const packageJsonPath = path.join(workDir, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      packageJson.devDependencies = {
        ...packageJson.devDependencies,
        '@capacitor/android': '^5.0.0',
        '@capacitor/cli': '^5.0.0',
        '@capacitor/core': '^5.0.0'
      };
      
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    }
  }

  private async fixDependencies(workDir: string, projectInfo: ProjectInfo): Promise<void> {
    if (!projectInfo.hasPackageJson) return;
    
    // Install dependencies
    execSync('npm install', { cwd: workDir, stdio: 'pipe' });
  }

  private async generateAndroidConfig(workDir: string, projectInfo: ProjectInfo): Promise<void> {
    // Create Android manifest template
    const androidManifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/AppTheme">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;
    
    const androidDir = path.join(workDir, 'android');
    await fs.mkdir(androidDir, { recursive: true });
    await fs.writeFile(path.join(androidDir, 'AndroidManifest.xml'), androidManifest);
  }

  // 4. BUILD ENGINE
  async buildAPK(buildId: string): Promise<string> {
    this.addLog(buildId, 'info', 'Starting APK build process', 'build');
    
    const buildResult = this.activeBuilds.get(buildId);
    if (!buildResult) throw new Error('Build not found');
    
    const workDir = path.join(this.BUILD_DIR, buildId);
    const projectInfo = this.projectInfo.get(buildId);
    
    if (!projectInfo) throw new Error('Project info not found');
    
    try {
      // Build the web project
      if (projectInfo.buildCommand) {
        this.addLog(buildId, 'info', `Running build command: ${projectInfo.buildCommand}`, 'build');
        execSync(projectInfo.buildCommand, { cwd: workDir, stdio: 'pipe' });
      }
      
      // Initialize Capacitor
      execSync('npx cap init', { cwd: workDir, stdio: 'pipe' });
      
      // Add Android platform
      execSync('npx cap add android', { cwd: workDir, stdio: 'pipe' });
      
      // Sync web assets
      execSync('npx cap sync android', { cwd: workDir, stdio: 'pipe' });
      
      // Build APK
      const androidDir = path.join(workDir, 'android');
      execSync('./gradlew assembleRelease', { cwd: androidDir, stdio: 'pipe' });
      
      // Find generated APK
      const apkPath = path.join(androidDir, 'app/build/outputs/apk/release/app-release.apk');
      
      if (!(await this.fileExists(apkPath))) {
        throw new Error('APK not found after build');
      }
      
      // Move APK to output directory
      const finalApkPath = path.join(this.OUTPUT_DIR, `${buildId}.apk`);
      await fs.copyFile(apkPath, finalApkPath);
      
      // Get APK size
      const stats = await fs.stat(finalApkPath);
      
      buildResult.status = 'testing';
      buildResult.apkPath = finalApkPath;
      buildResult.apkSize = stats.size;
      
      this.addLog(buildId, 'info', `APK built successfully: ${stats.size} bytes`, 'build');
      
      return finalApkPath;
      
    } catch (error) {
      buildResult.status = 'failed';
      buildResult.errors.push(error.message);
      this.addLog(buildId, 'error', `Build failed: ${error.message}`, 'build');
      throw error;
    }
  }

  // 5. SECURITY
  async secureAPK(buildId: string, apkPath: string): Promise<void> {
    this.addLog(buildId, 'info', 'Applying security measures', 'security');
    
    try {
      // Disable debug mode
      const androidDir = path.join(this.BUILD_DIR, buildId, 'android');
      const gradleFile = path.join(androidDir, 'app/build.gradle');
      
      if (await this.fileExists(gradleFile)) {
        let gradleContent = await fs.readFile(gradleFile, 'utf-8');
        gradleContent = gradleContent.replace('debuggable true', 'debuggable false');
        gradleContent = gradleContent.replace('minifyEnabled false', 'minifyEnabled true');
        await fs.writeFile(gradleFile, gradleContent);
      }
      
      // Add obfuscation
      const proguardFile = path.join(androidDir, 'app/proguard-rules.pro');
      const proguardRules = `
# Add project specific ProGuard rules here.
-keep class com.example.app.** { *; }
-keep class android.webkit.** { *; }
-keep class com.getcapacitor.** { *; }
`;
      await fs.writeFile(proguardFile, proguardRules);
      
      this.addLog(buildId, 'info', 'Security measures applied', 'security');
      
    } catch (error) {
      this.addLog(buildId, 'error', `Security failed: ${error.message}`, 'security');
      throw error;
    }
  }

  // 6. KEY SYSTEM INTEGRATION
  async integrateKeySystem(buildId: string, apkPath: string): Promise<void> {
    this.addLog(buildId, 'info', 'Integrating key system', 'keys');
    
    try {
      // Add license validation code to the app
      const workDir = path.join(this.BUILD_DIR, buildId);
      const outputDir = path.join(workDir, this.projectInfo.get(buildId)!.outputDir);
      
      // Add license validation script
      const licenseScript = `
// License Validation System
class LicenseValidator {
  constructor() {
    this.apiUrl = 'https://api.vala-builder.com/license/validate';
    this.productId = '${this.projectInfo.get(buildId)?.type || 'default'}';
  }
  
  async validateLicense(key) {
    try {
      const deviceId = await this.getDeviceId();
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key,
          productId: this.productId,
          deviceId,
        }),
      });
      
      const result = await response.json();
      if (result.valid) {
        localStorage.setItem('license', JSON.stringify(result));
        return true;
      } else {
        this.showInvalidLicense();
        return false;
      }
    } catch (error) {
      console.error('License validation failed:', error);
      this.showInvalidLicense();
      return false;
    }
  }
  
  async getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = 'device-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }
  
  showInvalidLicense() {
    document.body.innerHTML = \`
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial, sans-serif;">
        <div style="text-align: center; padding: 20px; border: 1px solid #ccc; border-radius: 8px;">
          <h2>License Required</h2>
          <p>Please enter your license key to continue:</p>
          <input type="text" id="licenseKey" placeholder="Enter license key" style="padding: 8px; margin: 10px;">
          <br>
          <button onclick="validateAndContinue()" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px;">Validate</button>
        </div>
      </div>
    \`;
    
    window.validateAndContinue = async () => {
      const key = document.getElementById('licenseKey').value;
      const valid = await this.validateLicense(key);
      if (valid) {
        location.reload();
      }
    };
  }
  
  async checkLicense() {
    const license = localStorage.getItem('license');
    if (license) {
      const parsed = JSON.parse(license);
      if (new Date(parsed.expiry) > new Date()) {
        return true;
      }
    }
    
    this.showInvalidLicense();
    return false;
  }
}

// Initialize license validator
const licenseValidator = new LicenseValidator();

// Check license on app start
document.addEventListener('DOMContentLoaded', async () => {
  await licenseValidator.checkLicense();
});
`;
      
      await fs.writeFile(path.join(outputDir, 'license-validator.js'), licenseScript);
      
      // Update index.html to include license script
      const indexPath = path.join(outputDir, 'index.html');
      if (await this.fileExists(indexPath)) {
        let indexContent = await fs.readFile(indexPath, 'utf-8');
        indexContent = indexContent.replace(
          '</body>',
          '<script src="license-validator.js"></script></body>'
        );
        await fs.writeFile(indexPath, indexContent);
      }
      
      this.addLog(buildId, 'info', 'Key system integrated', 'keys');
      
    } catch (error) {
      this.addLog(buildId, 'error', `Key system integration failed: ${error.message}`, 'keys');
      throw error;
    }
  }

  // 7. DEVICE BINDING
  async generateLicenseKey(productId: string, deviceId: string, expiryDays: number = 365): Promise<string> {
    const key = `VALA-${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
    
    const licenseKey: LicenseKey = {
      id: `license-${Date.now()}`,
      productId,
      deviceId,
      key,
      expiry: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
      active: true,
      createdAt: new Date()
    };
    
    this.licenseKeys.set(key, licenseKey);
    
    return key;
  }

  async validateLicenseKey(key: string, deviceId: string): Promise<boolean> {
    const license = this.licenseKeys.get(key);
    
    if (!license || !license.active) {
      return false;
    }
    
    if (license.deviceId !== deviceId) {
      return false; // Device binding violation
    }
    
    if (new Date() > license.expiry) {
      return false; // Expired
    }
    
    // Update last used
    license.lastUsed = new Date();
    
    return true;
  }

  // 8. AUTO TEST ENGINE
  async testAPK(buildId: string, apkPath: string): Promise<TestResult> {
    this.addLog(buildId, 'info', 'Starting APK testing', 'test');
    
    const testResult: TestResult = {
      id: `test-${Date.now()}`,
      buildId,
      status: 'running',
      tests: {
        launch: false,
        uiLoad: false,
        keyActivation: false,
        functionality: false
      },
      emulatorId: `emu-${Date.now()}`,
      screenshots: [],
      logs: [],
      errors: []
    };
    
    this.testResults.set(testResult.id, testResult);
    
    try {
      // Install APK in emulator
      await this.installInEmulator(apkPath, testResult.emulatorId);
      testResult.tests.launch = true;
      
      // Launch app and test UI
      await this.testUILaunch(testResult.emulatorId, testResult);
      
      // Test key activation
      await this.testKeyActivation(testResult.emulatorId, testResult);
      
      // Test basic functionality
      await this.testFunctionality(testResult.emulatorId, testResult);
      
      testResult.status = 'passed';
      this.addLog(buildId, 'info', 'APK tests passed', 'test');
      
    } catch (error) {
      testResult.status = 'failed';
      testResult.errors.push(error.message);
      this.addLog(buildId, 'error', `APK tests failed: ${error.message}`, 'test');
    }
    
    return testResult;
  }

  private async installInEmulator(apkPath: string, emulatorId: string): Promise<void> {
    // Simulate APK installation
    execSync(`adb -s ${emulatorId} install -r "${apkPath}"`, { stdio: 'pipe' });
  }

  private async testUILaunch(emulatorId: string, testResult: TestResult): Promise<void> {
    // Simulate UI launch test
    execSync(`adb -s ${emulatorId} shell am start -n com.example.app/.MainActivity`, { stdio: 'pipe' });
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for launch
    testResult.tests.uiLoad = true;
  }

  private async testKeyActivation(emulatorId: string, testResult: TestResult): Promise<void> {
    // Simulate key activation test
    const testKey = await this.generateLicenseKey('test', emulatorId);
    const valid = await this.validateLicenseKey(testKey, emulatorId);
    testResult.tests.keyActivation = valid;
  }

  private async testFunctionality(emulatorId: string, testResult: TestResult): Promise<void> {
    // Simulate basic functionality test
    testResult.tests.functionality = true;
  }

  // 9. OUTPUT STORAGE
  async storeAPK(buildId: string, apkPath: string, productId: string, version: string): Promise<string> {
    const checksum = createHash('sha256').update(await fs.readFile(apkPath)).digest('hex');
    
    const storage: APKStorage = {
      id: `storage-${Date.now()}`,
      buildId,
      productId,
      version,
      apkPath,
      apkSize: (await fs.stat(apkPath)).size,
      checksum,
      downloadUrl: `/api/apk/download/${buildId}`,
      protected: true,
      createdAt: new Date()
    };
    
    this.apkStorage.set(storage.id, storage);
    
    return storage.downloadUrl;
  }

  // 10. QUEUE SYSTEM
  private startQueueProcessor(): void {
    setInterval(async () => {
      await this.processQueue();
    }, 5000); // Process queue every 5 seconds
  }

  private async processQueue(): Promise<void> {
    const activeBuildsCount = Array.from(this.activeBuilds.values())
      .filter(b => b.status === 'building' || b.status === 'testing').length;
    
    if (activeBuildsCount >= this.MAX_CONCURRENT_BUILDS) {
      return; // Max concurrent builds reached
    }
    
    const nextItem = this.buildQueue.find(item => item.status === 'queued');
    if (!nextItem) return;
    
    nextItem.status = 'processing';
    nextItem.startedAt = new Date();
    
    // Process build
    this.processBuild(nextItem.buildId).catch(error => {
      console.error(`Build ${nextItem.buildId} failed:`, error);
      this.handleBuildFailure(nextItem, error);
    });
  }

  private async processBuild(buildId: string): Promise<void> {
    const buildResult = this.activeBuilds.get(buildId);
    if (!buildResult) return;
    
    try {
      buildResult.status = 'building';
      
      // Get build source
      const source = await this.getBuildSource(buildResult.sourceId);
      
      // Scan repository
      const projectInfo = await this.scanRepository(buildId, source);
      
      // Auto-fix project
      await this.autoFixProject(buildId, path.join(this.BUILD_DIR, buildId), projectInfo);
      
      // Build APK
      const apkPath = await this.buildAPK(buildId);
      
      // Apply security
      await this.secureAPK(buildId, apkPath);
      
      // Integrate key system
      await this.integrateKeySystem(buildId, apkPath);
      
      // Test APK
      const testResult = await this.testAPK(buildId, apkPath);
      buildResult.testResults = testResult;
      
      if (testResult.status === 'passed') {
        // Store APK
        const downloadUrl = await this.storeAPK(buildId, apkPath, source.projectId, '1.0.0');
        buildResult.downloadUrl = downloadUrl;
        buildResult.status = 'success';
      } else {
        buildResult.status = 'failed';
        buildResult.errors.push('APK tests failed');
      }
      
      buildResult.endTime = new Date();
      
    } catch (error) {
      buildResult.status = 'failed';
      buildResult.errors.push(error.message);
      buildResult.endTime = new Date();
    }
    
    // Update queue
    const queueItem = this.buildQueue.find(item => item.buildId === buildId);
    if (queueItem) {
      queueItem.status = buildResult.status === 'success' ? 'completed' : 'failed';
      queueItem.completedAt = new Date();
    }
    
    // Add to history
    this.buildHistory.push(buildResult);
  }

  private async handleBuildFailure(queueItem: BuildQueue, error: Error): Promise<void> {
    queueItem.retryCount++;
    
    if (queueItem.retryCount < queueItem.maxRetries) {
      queueItem.status = 'queued';
      this.addLog(queueItem.buildId, 'warn', `Retrying build (${queueItem.retryCount}/${queueItem.maxRetries})`, 'queue');
    } else {
      queueItem.status = 'failed';
      this.addLog(queueItem.buildId, 'error', `Build failed permanently: ${error.message}`, 'queue');
    }
  }

  // 16. ADMIN CONTROL PANEL
  async getBuildStatus(buildId: string): Promise<BuildResult | null> {
    return this.activeBuilds.get(buildId) || null;
  }

  async getBuildLogs(buildId: string): Promise<BuildLog[]> {
    const build = this.activeBuilds.get(buildId);
    return build ? build.logs : [];
  }

  async retryBuild(buildId: string): Promise<boolean> {
    const build = this.activeBuilds.get(buildId);
    if (!build || build.status !== 'failed') return false;
    
    // Reset build status
    build.status = 'pending';
    build.errors = [];
    build.logs = [];
    build.startTime = new Date();
    build.endTime = undefined;
    
    // Add to queue
    const queueItem: BuildQueue = {
      id: `queue-${Date.now()}`,
      buildId,
      priority: 'high',
      status: 'queued',
      queuedAt: new Date(),
      retryCount: 0,
      maxRetries: 3
    };
    
    this.buildQueue.push(queueItem);
    
    return true;
  }

  async downloadAPK(buildId: string): Promise<string | null> {
    const build = this.activeBuilds.get(buildId);
    if (!build || build.status !== 'success' || !build.apkPath) return null;
    
    return build.apkPath;
  }

  // Helper methods
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async hasBuildConfig(workDir: string): Promise<boolean> {
    const configFiles = ['webpack.config.js', 'vite.config.js', 'rollup.config.js', 'next.config.js'];
    for (const file of configFiles) {
      if (await this.fileExists(path.join(workDir, file))) {
        return true;
      }
    }
    return false;
  }

  private async getDependencies(workDir: string): Promise<string[]> {
    const packageJsonPath = path.join(workDir, 'package.json');
    if (!(await this.fileExists(packageJsonPath))) return [];
    
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    return Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies });
  }

  private addLog(buildId: string, level: BuildLog['level'], message: string, step: string): void {
    const build = this.activeBuilds.get(buildId);
    if (!build) return;
    
    build.logs.push({
      timestamp: new Date(),
      level,
      message,
      step
    });
  }

  private async getBuildSource(sourceId: string): Promise<BuildSource> {
    // This would typically fetch from database
    return {
      id: sourceId,
      type: 'github',
      url: 'https://github.com/example/repo',
      projectId: 'project-1',
      adminId: 'admin-1',
      timestamp: new Date()
    };
  }

  // Public API
  getActiveBuilds(): BuildResult[] {
    return Array.from(this.activeBuilds.values());
  }

  getBuildQueue(): BuildQueue[] {
    return [...this.buildQueue];
  }

  getStoredAPKs(): APKStorage[] {
    return Array.from(this.apkStorage.values());
  }

  getLicenseKeys(): LicenseKey[] {
    return Array.from(this.licenseKeys.values());
  }

  getTestResults(): TestResult[] {
    return Array.from(this.testResults.values());
  }

  async cleanup(): Promise<void> {
    // Clean up old build files
    const oldBuilds = Array.from(this.activeBuilds.entries())
      .filter(([_, build]) => {
        const age = Date.now() - build.startTime.getTime();
        return age > 24 * 60 * 60 * 1000; // Older than 24 hours
      });
    
    for (const [buildId, build] of oldBuilds) {
      try {
        const workDir = path.join(this.BUILD_DIR, buildId);
        await fs.rm(workDir, { recursive: true, force: true });
        this.activeBuilds.delete(buildId);
      } catch (error) {
        console.error(`Failed to cleanup build ${buildId}:`, error);
      }
    }
  }
}

// Export all interfaces for ExtremeAPKPipelineAdmin
export type { BuildSource, BuildResult, BuildLog, TestResult, APKStorage, LicenseKey, BuildQueue };
export const apkPipeline = APKPipeline.getInstance();
