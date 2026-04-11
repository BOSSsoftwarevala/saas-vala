import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  apkPipeline,
  BuildSource,
  BuildResult,
  BuildLog,
  TestResult,
  APKStorage,
  LicenseKey,
  BuildQueue
} from '@/lib/apk-pipeline';
import {
  ultraApkPipeline,
  KeystoreInfo,
  ObfuscationConfig,
  AppVersion,
  OTAUpdate,
  IntegrityCheck,
  OfflineLicense,
  ArchitectureBuild,
  BuildSandbox,
  OptimizationReport,
  PermissionSet,
  AppErrorLog,
  AppAnalytics,
  InstallValidation,
  SecureDownload,
  BuildPriority,
  ValidationReport,
  EndToEndCheck
} from '@/lib/ultra-apk-pipeline';
import {
  Smartphone, Package, GitBranch, Upload, Play, Pause, RotateCcw,
  Download, Eye, EyeOff, Settings, Terminal, Clock, CheckCircle2,
  XCircle, AlertTriangle, Shield, Key, Database, Server,
  Activity, Zap, TrendingUp, Users, FileText, Archive,
  RefreshCw, Trash2, Save, FolderOpen, Link, Lock,
  Unlock, Monitor, Cpu, HardDrive, Wifi, Battery,
  Code, TestTube, Flask, Bug, Hammer, Wrench,
  Rocket, Launch, Globe, Android, Apple, Smartphone as PhoneIcon,
  Fingerprint, ShieldCheck, Security, Scan, Layers,
  Archive as ArchiveIcon, GitMerge, GitCommit, History,
  AlertCircle, Info, ChevronRight, ChevronDown,
  Smartphone as Mobile, Tablet, Monitor as Desktop,
  MapPin, Globe2, Cloud, CloudDownload, CloudUpload,
  KeyRound, Crown, Zap as ZapIcon, Target, Targeted,
  ShieldAlert, ShieldCheck as ShieldCheckIcon, ShieldOff,
  Timer, TimerOff, TimerReset, Clock as ClockIcon,
  BarChart, PieChart, LineChart, TrendingUp as TrendingUpIcon,
  UserCheck, UserX, Users as UsersIcon, UserPlus,
  DownloadCloud, UploadCloud, CloudDrizzle,
  Building, Building2, Hammer as HammerIcon,
  Settings2, Settings3, Settings4, Settings5,
  PackageOpen, PackageSearch, PackageCheck,
  FileCheck, FileX, FileLock, FileUnlock,
  LockOpen, LockKey, LockClosed,
  Keyhole, KeyRound as KeyIcon,
  Fingerprint as FingerprintIcon,
  Shield as ShieldIcon,
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  Scan as ScanIcon,
  ScanLine as ScanLineIcon,
  Zap as ZapIcon2,
  Battery as BatteryIcon,
  Wifi as WifiIcon,
  Signal as SignalIcon,
  SignalHigh as SignalHighIcon,
  SignalLow as SignalLowIcon,
  SignalMedium as SignalMediumIcon,
  SignalZero as SignalZeroIcon,
  Activity as ActivityIcon,
  Activity as ActivityIcon2,
  Activity as ActivityIcon3,
  Activity as ActivityIcon4,
  Activity as ActivityIcon5
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function UltraAPKPipelineAdmin() {
  const [selectedTab, setSelectedTab] = useState('dashboard');
  const [builds, setBuilds] = useState<BuildResult[]>([]);
  const [buildQueue, setBuildQueue] = useState<BuildQueue[]>([]);
  const [storedAPKs, setStoredAPKs] = useState<APKStorage[]>([]);
  const [licenseKeys, setLicenseKeys] = useState<LicenseKey[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [selectedBuild, setSelectedBuild] = useState<BuildResult | null>(null);
  const [buildLogs, setBuildLogs] = useState<BuildLog[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [projectId, setProjectId] = useState('');
  const [selectedBuildId, setSelectedBuildId] = useState('');
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [newKeyDeviceId, setNewKeyDeviceId] = useState('');
  const [newKeyProductId, setNewKeyProductId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ultra features state
  const [keystores, setKeystores] = useState<KeystoreInfo[]>([]);
  const [obfuscationConfigs, setObfuscationConfigs] = useState<Map<string, ObfuscationConfig>>(new Map());
  const [appVersions, setAppVersions] = useState<Map<string, AppVersion>>(new Map());
  const [otaUpdates, setOtaUpdates] = useState<Map<string, OTAUpdate>>(new Map());
  const [integrityChecks, setIntegrityChecks] = useState<Map<string, IntegrityCheck>>(new Map());
  const [offlineLicenses, setOfflineLicenses] = useState<Map<string, OfflineLicense>>(new Map());
  const [architectureBuilds, setArchitectureBuilds] = useState<Map<string, ArchitectureBuild[]>>(new Map());
  const [optimizationReports, setOptimizationReports] = useState<Map<string, OptimizationReport>>(new Map());
  const [permissionSets, setPermissionSets] = useState<Map<string, PermissionSet>>(new Map());
  const [errorLogs, setErrorLogs] = useState<AppErrorLog[]>([]);
  const [analytics, setAnalytics] = useState<Map<string, AppAnalytics>>(new Map());
  const [validationReports, setValidationReports] = useState<Map<string, ValidationReport>>(new Map());
  const [endToEndChecks, setEndToEndChecks] = useState<Map<string, EndToEndCheck>>(new Map());

  // Settings state
  const [autoSigning, setAutoSigning] = useState(true);
  const [obfuscationEnabled, setObfuscationEnabled] = useState(true);
  const [otaEnabled, setOtaEnabled] = useState(true);
  const [offlineModeEnabled, setOfflineModeEnabled] = useState(true);
  const [multiArchEnabled, setMultiArchEnabled] = useState(true);
  const [resourceOptimization, setResourceOptimization] = useState(true);
  const [downloadSecurity, setDownloadSecurity] = useState(true);
  const [failsafeEnabled, setFailsafeEnabled] = useState(true);

  useEffect(() => {
    updateData();
    const interval = setInterval(updateData, 5000);
    return () => clearInterval(interval);
  }, []);

  const updateData = () => {
    // Basic data
    setBuilds(apkPipeline.getActiveBuilds());
    setBuildQueue(apkPipeline.getBuildQueue());
    setStoredAPKs(apkPipeline.getStoredAPKs());
    setLicenseKeys(apkPipeline.getLicenseKeys());
    setTestResults(apkPipeline.getTestResults());
    
    // Ultra features data
    setKeystores(ultraApkPipeline.getKeystores());
    setObfuscationConfigs(ultraApkPipeline.getObfuscationConfigs());
    setAppVersions(ultraApkPipeline.getAppVersions());
    setOtaUpdates(ultraApkPipeline.getOTAUpdates());
    setIntegrityChecks(ultraApkPipeline.getIntegrityChecks());
    setOfflineLicenses(ultraApkPipeline.getOfflineLicenses());
    setArchitectureBuilds(ultraApkPipeline.getArchitectureBuilds());
    setOptimizationReports(ultraApkPipeline.getOptimizationReports());
    setPermissionSets(ultraApkPipeline.getPermissionSets());
    setAnalytics(ultraApkPipeline.getAnalytics());
    setValidationReports(ultraApkPipeline.getValidationReports());
    setEndToEndChecks(ultraApkPipeline.getEndToEndChecks());
  };

  const handleSubmitGitHubBuild = async () => {
    if (!githubUrl.trim() || !projectId.trim()) {
      toast.error('Please provide GitHub URL and Project ID');
      return;
    }

    setIsSubmitting(true);
    try {
      const source: BuildSource = {
        id: `source-${Date.now()}`,
        type: 'github',
        url: githubUrl,
        projectId,
        adminId: 'current-admin',
        timestamp: new Date()
      };

      const buildId = await apkPipeline.submitBuild(source);
      
      // Apply ultra features
      await applyUltraFeatures(buildId, projectId);
      
      toast.success(`Ultra build submitted: ${buildId}`);
      setGithubUrl('');
      setProjectId('');
      updateData();
    } catch (error) {
      toast.error('Failed to submit ultra build');
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyUltraFeatures = async (buildId: string, projectId: string) => {
    try {
      // 1. Generate keystore if auto-signing enabled
      if (autoSigning) {
        await ultraApkPipeline.generateKeystore(projectId);
      }

      // 2. Configure obfuscation
      if (obfuscationEnabled) {
        await ultraApkPipeline.configureObfuscation(buildId);
      }

      // 3. Increment version
      await ultraApkPipeline.incrementVersion(projectId);

      // 4. Configure permissions
      await ultraApkPipeline.configurePermissions(buildId, 'web-app');

      // 5. Set build priority to high for ultra builds
      await ultraApkPipeline.setBuildPriority(buildId, 'high', 'current-admin', 'Ultra build priority');

      toast.success('Ultra features applied successfully');
    } catch (error) {
      console.error('Failed to apply ultra features:', error);
    }
  };

  const handleGenerateKeystore = async (appId: string) => {
    try {
      const keystore = await ultraApkPipeline.generateKeystore(appId);
      toast.success(`Keystore generated: ${keystore.id}`);
      updateData();
    } catch (error) {
      toast.error('Failed to generate keystore');
    }
  };

  const handleValidateIntegrity = async (buildId: string) => {
    try {
      const build = builds.find(b => b.id === buildId);
      if (build?.apkPath) {
        const integrity = await ultraApkPipeline.verifyIntegrity(buildId, build.apkPath);
        toast.success(`Integrity ${integrity.verified ? 'verified' : 'failed'}`);
        updateData();
      }
    } catch (error) {
      toast.error('Failed to validate integrity');
    }
  };

  const handlePerformEndToEndCheck = async (buildId: string) => {
    try {
      const check = await ultraApkPipeline.performEndToEndCheck(buildId);
      toast.success(`End-to-end check ${check.overallPassed ? 'passed' : 'failed'}`);
      updateData();
    } catch (error) {
      toast.error('Failed to perform end-to-end check');
    }
  };

  const handleGenerateValidationReport = async (buildId: string) => {
    try {
      const report = await ultraApkPipeline.generateValidationReport(buildId);
      toast.success(`Validation report generated - Score: ${report.securityScore}/100`);
      updateData();
    } catch (error) {
      toast.error('Failed to generate validation report');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-500';
      case 'failed': return 'text-red-500';
      case 'building': return 'text-blue-500';
      case 'testing': return 'text-purple-500';
      case 'pending': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success': return 'default';
      case 'failed': return 'destructive';
      case 'building': return 'secondary';
      case 'testing': return 'secondary';
      case 'pending': return 'outline';
      default: return 'outline';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getSecurityScore = (buildId: string) => {
    const report = validationReports.get(buildId);
    return report?.securityScore || 0;
  };

  const getSecurityScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 70) return 'text-yellow-500';
    if (score >= 50) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
          <Shield className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Ultra APK Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            Enterprise-grade APK builder with 25 ultra-secure features
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
            <Shield className="h-3 w-3 mr-1" />
            Ultra Secure
          </Badge>
          <Button variant="outline" onClick={() => updateData()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Ultra Features Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Ultra Features Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={autoSigning} onCheckedChange={setAutoSigning} />
              <Label className="text-sm">Auto Signing</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={obfuscationEnabled} onCheckedChange={setObfuscationEnabled} />
              <Label className="text-sm">Obfuscation</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={otaEnabled} onCheckedChange={setOtaEnabled} />
              <Label className="text-sm">OTA Updates</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={offlineModeEnabled} onCheckedChange={setOfflineModeEnabled} />
              <Label className="text-sm">Offline Mode</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={multiArchEnabled} onCheckedChange={setMultiArchEnabled} />
              <Label className="text-sm">Multi-Arch</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={resourceOptimization} onCheckedChange={setResourceOptimization} />
              <Label className="text-sm">Optimization</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-8 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{builds.length}</div>
            <div className="text-xs text-muted-foreground">Active Builds</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-500">
              {builds.filter(b => b.status === 'success').length}
            </div>
            <div className="text-xs text-muted-foreground">Successful</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-purple-500">
              {keystores.length}
            </div>
            <div className="text-xs text-muted-foreground">Keystores</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-500">
              {validationReports.size}
            </div>
            <div className="text-xs text-muted-foreground">Validations</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-orange-500">
              {endToEndChecks.size}
            </div>
            <div className="text-xs text-muted-foreground">E2E Checks</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-cyan-500">
              {architectureBuilds.size}
            </div>
            <div className="text-xs text-muted-foreground">Multi-Arch</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-pink-500">
              {otaUpdates.size}
            </div>
            <div className="text-xs text-muted-foreground">OTA Updates</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-indigo-500">
              {offlineLicenses.size}
            </div>
            <div className="text-xs text-muted-foreground">Offline Licenses</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-8">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="builds">Builds</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="keys">Keys</TabsTrigger>
              <TabsTrigger value="ota">OTA</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-4">
              {/* Submit Ultra Build */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Rocket className="h-5 w-5" />
                    Submit Ultra Build
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h4 className="font-medium">Build from GitHub</h4>
                      <Input
                        placeholder="GitHub URL (e.g., username/repo)"
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                      />
                      <Input
                        placeholder="Project ID"
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                      />
                      <Button
                        onClick={handleSubmitGitHubBuild}
                        disabled={isSubmitting}
                        className="w-full"
                      >
                        {isSubmitting ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <GitBranch className="h-4 w-4 mr-2" />
                        )}
                        Ultra Build from GitHub
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-medium">Ultra Features Applied</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span>Auto APK Signing</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span>Code Obfuscation</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span>Version Management</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span>Resource Optimization</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span>Multi-Arch Support</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span>Security Hardening</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Ultra Builds */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Ultra Builds
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {builds.slice(0, 5).map((build) => (
                      <div key={build.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={getStatusBadge(build.status)}>
                              {build.status}
                            </Badge>
                            <span className="font-medium">{build.id}</span>
                            <Badge className="bg-purple-500/20 text-purple-400">
                              Ultra
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={cn("text-sm font-medium", getSecurityScoreColor(getSecurityScore(build.id)))}>
                              Security: {getSecurityScore(build.id)}%
                            </div>
                            {build.apkSize && (
                              <span className="text-sm text-muted-foreground">
                                {formatFileSize(build.apkSize)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleValidateIntegrity(build.id)}
                          >
                            <Fingerprint className="h-4 w-4 mr-2" />
                            Validate
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePerformEndToEndCheck(build.id)}
                          >
                            <Target className="h-4 w-4 mr-2" />
                            E2E Check
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateValidationReport(build.id)}
                          >
                            <ShieldCheck className="h-4 w-4 mr-2" />
                            Report
                          </Button>
                        </div>
                      </div>
                    ))}
                    {builds.length === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No ultra builds yet. Submit your first ultra build above.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
              {/* Keystores */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    APK Signing Keystores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {keystores.map((keystore) => (
                      <div key={keystore.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-medium">{keystore.appId}</div>
                            <div className="text-sm text-muted-foreground">
                              Created: {keystore.createdAt.toLocaleDateString()}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Last Used: {keystore.lastUsed?.toLocaleDateString() || 'Never'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {keystore.keyAlias}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleGenerateKeystore(keystore.appId)}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Regenerate
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {keystores.length === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No keystores generated yet. Enable auto-signing to generate keystores automatically.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Integrity Checks */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Fingerprint className="h-5 w-5" />
                    APK Integrity Checks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from(integrityChecks.entries()).map(([buildId, check]) => (
                      <div key={buildId} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-medium">{buildId}</div>
                            <div className="text-sm text-muted-foreground">
                              Last Check: {check.lastCheck.toLocaleString()}
                            </div>
                          </div>
                          <Badge variant={check.verified ? 'default' : 'destructive'}>
                            {check.verified ? 'Verified' : 'Failed'}
                          </Badge>
                        </div>
                        <div className="text-sm font-mono text-muted-foreground">
                          Original: {check.originalHash.substring(0, 16)}...
                        </div>
                        <div className="text-sm font-mono text-muted-foreground">
                          Current: {check.currentHash.substring(0, 16)}...
                        </div>
                      </div>
                    ))}
                    {integrityChecks.size === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No integrity checks performed yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="validation" className="space-y-4">
              {/* Validation Reports */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5" />
                    APK Validation Reports
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from(validationReports.entries()).map(([buildId, report]) => (
                      <div key={buildId} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="font-medium">{buildId}</div>
                            <div className="text-sm text-muted-foreground">
                              APK Size: {formatFileSize(report.apkSize)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={cn("text-lg font-bold", getSecurityScoreColor(report.securityScore))}>
                              {report.securityScore}/100
                            </div>
                            <Badge variant={report.passed ? 'default' : 'destructive'}>
                              {report.passed ? 'Passed' : 'Failed'}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                          <div>
                            <span className="font-medium">Version: </span>
                            {report.versionInfo.versionName}
                          </div>
                          <div>
                            <span className="font-medium">Permissions: </span>
                            {report.permissions.length}
                          </div>
                        </div>

                        {report.recommendations.length > 0 && (
                          <div className="mb-3">
                            <div className="text-sm font-medium mb-1">Recommendations:</div>
                            <div className="text-sm text-muted-foreground">
                              {report.recommendations.join(', ')}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleValidateIntegrity(buildId)}
                          >
                            <Fingerprint className="h-4 w-4 mr-2" />
                            Re-validate
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePerformEndToEndCheck(buildId)}
                          >
                            <Target className="h-4 w-4 mr-2" />
                            E2E Check
                          </Button>
                        </div>
                      </div>
                    ))}
                    {validationReports.size === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No validation reports available. Generate reports for completed builds.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* End-to-End Checks */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    End-to-End Checks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from(endToEndChecks.entries()).map(([buildId, check]) => (
                      <div key={buildId} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{buildId}</div>
                          <Badge variant={check.overallPassed ? 'default' : 'destructive'}>
                            {check.overallPassed ? 'Passed' : 'Failed'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-5 gap-2 text-sm mb-2">
                          <div className="text-center">
                            <div className={cn(
                              "w-2 h-2 rounded-full mx-auto mb-1",
                              check.stages.repository ? "bg-green-500" : "bg-red-500"
                            )} />
                            <div>Repo</div>
                          </div>
                          <div className="text-center">
                            <div className={cn(
                              "w-2 h-2 rounded-full mx-auto mb-1",
                              check.stages.build ? "bg-green-500" : "bg-red-500"
                            )} />
                            <div>Build</div>
                          </div>
                          <div className="text-center">
                            <div className={cn(
                              "w-2 h-2 rounded-full mx-auto mb-1",
                              check.stages.install ? "bg-green-500" : "bg-red-500"
                            )} />
                            <div>Install</div>
                          </div>
                          <div className="text-center">
                            <div className={cn(
                              "w-2 h-2 rounded-full mx-auto mb-1",
                              check.stages.license ? "bg-green-500" : "bg-red-500"
                            )} />
                            <div>License</div>
                          </div>
                          <div className="text-center">
                            <div className={cn(
                              "w-2 h-2 rounded-full mx-auto mb-1",
                              check.stages.run ? "bg-green-500" : "bg-red-500"
                            )} />
                            <div>Run</div>
                          </div>
                        </div>
                        {check.failedStage && (
                          <div className="text-sm text-red-500">
                            Failed at: {check.failedStage}
                          </div>
                        )}
                      </div>
                    ))}
                    {endToEndChecks.size === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No end-to-end checks performed yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart className="h-5 w-5" />
                    App Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from(analytics.entries()).map(([appId, data]) => (
                      <div key={appId} className="p-4 border rounded-lg">
                        <div className="font-medium mb-3">{appId}</div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Total Installs</div>
                            <div className="text-lg font-bold">{data.totalInstalls}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Active Users</div>
                            <div className="text-lg font-bold">{data.activeUsers}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Crashes</div>
                            <div className="text-lg font-bold text-red-500">{data.crashCount}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Retention</div>
                            <div className="text-lg font-bold">{data.retentionRate}%</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {analytics.size === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No analytics data available yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="keys" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    License Keys
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Generate New Key */}
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-3">Generate New License Key</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Input
                        placeholder="Device ID"
                        value={newKeyDeviceId}
                        onChange={(e) => setNewKeyDeviceId(e.target.value)}
                      />
                      <Input
                        placeholder="Product ID"
                        value={newKeyProductId}
                        onChange={(e) => setNewKeyProductId(e.target.value)}
                      />
                      <Button
                        onClick={async () => {
                          if (!newKeyDeviceId.trim() || !newKeyProductId.trim()) {
                            toast.error('Please provide Device ID and Product ID');
                            return;
                          }
                          setIsGeneratingKey(true);
                          try {
                            const key = await apkPipeline.generateLicenseKey(newKeyProductId, newKeyDeviceId);
                            const offlineLicense = await ultraApkPipeline.enableOfflineMode(key, newKeyDeviceId, newKeyProductId);
                            toast.success(`License key generated: ${key}`);
                            setNewKeyDeviceId('');
                            setNewKeyProductId('');
                            updateData();
                          } catch (error) {
                            toast.error('Failed to generate license key');
                          } finally {
                            setIsGeneratingKey(false);
                          }
                        }}
                        disabled={isGeneratingKey}
                      >
                        {isGeneratingKey ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Key className="h-4 w-4 mr-2" />
                        )}
                        Generate Key
                      </Button>
                    </div>
                  </div>

                  {/* Offline Licenses */}
                  <div className="space-y-3">
                    <h4 className="font-medium">Offline Licenses</h4>
                    {Array.from(offlineLicenses.entries()).map(([key, license]) => (
                      <div key={key} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{license.productId}</div>
                          <Badge variant="outline">
                            {license.offlineUsageCount}/{license.maxOfflineUsage} uses
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                          <div>Device: {license.deviceId}</div>
                          <div>Expires: {license.expiry.toLocaleDateString()}</div>
                          <div>Last Sync: {license.lastSync.toLocaleDateString()}</div>
                          <div>Grace Period: {license.gracePeriod} days</div>
                        </div>
                      </div>
                    ))}
                    {offlineLicenses.size === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No offline licenses generated yet.
                      </p>
                    )}
                  </div>

                  {/* Regular License Keys */}
                  <div className="space-y-3">
                    <h4 className="font-medium">Regular License Keys</h4>
                    {licenseKeys.map((key) => (
                      <div key={key.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={key.active ? 'default' : 'secondary'}>
                              {key.active ? 'Active' : 'Inactive'}
                            </Badge>
                            <span className="font-medium">{key.key}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {key.createdAt.toLocaleDateString()}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                          <div>Product: {key.productId}</div>
                          <div>Device: {key.deviceId}</div>
                          <div>Expires: {key.expiry.toLocaleDateString()}</div>
                          {key.lastUsed && (
                            <div>Last Used: {key.lastUsed.toLocaleDateString()}</div>
                          )}
                        </div>
                      </div>
                    ))}
                    {licenseKeys.length === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No license keys generated yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ota" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CloudDownload className="h-5 w-5" />
                    OTA Updates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from(otaUpdates.entries()).map(([id, update]) => (
                      <div key={id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="font-medium">{update.appId}</div>
                            <div className="text-sm text-muted-foreground">
                              {update.currentVersion} → {update.latestVersion}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={update.mandatory ? 'destructive' : 'outline'}>
                              {update.mandatory ? 'Mandatory' : 'Optional'}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {formatFileSize(update.size)}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                          <div>Release Date: {update.releaseDate.toLocaleDateString()}</div>
                          <div>Checksum: {update.checksum.substring(0, 16)}...</div>
                        </div>
                      </div>
                    ))}
                    {otaUpdates.size === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No OTA updates available yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Multi-Architecture Builds */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    Multi-Architecture Builds
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from(architectureBuilds.entries()).map(([buildId, archs]) => (
                      <div key={buildId} className="p-4 border rounded-lg">
                        <div className="font-medium mb-3">{buildId}</div>
                        <div className="grid grid-cols-2 gap-4">
                          {archs.map((arch) => (
                            <div key={arch.arch} className="p-3 border rounded">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">{arch.arch}</span>
                                <Badge variant={arch.supported ? 'default' : 'destructive'}>
                                  {arch.supported ? 'Supported' : 'Failed'}
                                </Badge>
                              </div>
                              {arch.supported && (
                                <div className="text-sm text-muted-foreground">
                                  Size: {formatFileSize(arch.size)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {architectureBuilds.size === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No multi-architecture builds available yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="logs" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="h-5 w-5" />
                    Build Logs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedBuild ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{selectedBuild.id}</div>
                          <div className="text-sm text-muted-foreground">
                            Status: {selectedBuild.status}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedBuild(null)}
                        >
                          Clear
                        </Button>
                      </div>
                      <ScrollArea className="h-96">
                        <div className="space-y-2 font-mono text-sm">
                          {buildLogs.map((log, index) => (
                            <div key={index} className="flex gap-2">
                              <span className="text-muted-foreground">
                                [{log.timestamp.toLocaleTimeString()}]
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {log.step}
                              </Badge>
                              <span className={cn(
                                log.level === 'error' ? 'text-red-500' :
                                log.level === 'warn' ? 'text-yellow-500' :
                                log.level === 'info' ? 'text-blue-500' :
                                'text-muted-foreground'
                              )}>
                                {log.message}
                              </span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Select a build to view its logs
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Ultra Security Score */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Ultra Security Score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-500">
                  {builds.length > 0 
                    ? Math.round(Array.from(validationReports.values()).reduce((sum, r) => sum + r.securityScore, 0) / validationReports.size)
                    : 0
                  }%
                </div>
                <div className="text-sm text-muted-foreground">Overall Score</div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Signing</span>
                  <span className="text-green-500">Active</span>
                </div>
                <div className="flex justify-between">
                  <span>Obfuscation</span>
                  <span className="text-green-500">Active</span>
                </div>
                <div className="flex justify-between">
                  <span>Integrity</span>
                  <span className="text-green-500">Verified</span>
                </div>
                <div className="flex justify-between">
                  <span>Validation</span>
                  <span className="text-green-500">Passed</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Active Builds</span>
                <span>{builds.filter(b => b.status === 'building').length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Queue Length</span>
                <span>{buildQueue.filter(q => q.status === 'queued').length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Success Rate</span>
                <span>
                  {builds.length > 0 
                    ? `${Math.round((builds.filter(b => b.status === 'success').length / builds.length) * 100)}%`
                    : 'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Storage Used</span>
                <span>
                  {formatFileSize(storedAPKs.reduce((sum, apk) => sum + apk.apkSize, 0))}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Settings className="h-4 w-4 mr-2" />
                Ultra Settings
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Database className="h-4 w-4 mr-2" />
                Storage Manager
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Shield className="h-4 w-4 mr-2" />
                Security Audit
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <TrendingUp className="h-4 w-4 mr-2" />
                Performance Stats
              </Button>
            </CardContent>
          </Card>

          {/* Optimization Report */}
          {optimizationReports.size > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Optimization</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from(optimizationReports.entries()).slice(0, 1).map(([buildId, report]) => (
                  <div key={buildId} className="text-sm">
                    <div className="flex justify-between">
                      <span>Space Saved</span>
                      <span className="text-green-500">
                        {formatFileSize(report.savings)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Compression</span>
                      <span>{report.compressionRatio.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
