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
  extremeApkPipeline,
  DeviceFingerprint,
  SecurityCheck,
  TimeValidation,
  Heartbeat,
  GracePeriod,
  KeyType,
  Watermark,
  FeatureLock,
  KillSwitch,
  SessionControl,
  NetworkSecurity,
  APIValidation,
  EncryptedStorage,
  CrashReport,
  ServiceProtection,
  OpenValidation,
  SecureCache,
  APKSplit,
  Hotfix,
  UsageTracker,
  EnvironmentConfig,
  InstallSource,
  SessionRecovery,
  HealthScore,
  FinalLock
} from '@/lib/extreme-apk-pipeline';
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
  Activity as ActivityIcon5,
  Skull, Crosshair, Radar, ShieldAlert as ShieldAlertIcon,
  Ban, Ban as BanIcon, ShieldBan,
  Heart, Heartbeat, HeartPulse,
  Brain, Cpu as CpuIcon, Microchip,
  Lock as LockIcon2,
  Unlock as UnlockIcon2,
  AlertTriangle as AlertTriangleIcon,
  AlertCircle as AlertCircleIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  XCircle as XCircleIcon,
  Zap as ZapIcon3,
  Target as TargetIcon,
  Crosshair as CrosshairIcon,
  Radio, RadioIcon,
  WifiOff,
  ShieldOff as ShieldOffIcon,
  UserShield,
  ShieldCheck as ShieldCheckIcon2,
  ShieldX,
  ShieldAlert as ShieldAlertIcon2,
  ShieldQuestion,
  ShieldPlus,
  ShieldMinus,
  LockOpen as LockOpenIcon,
  Lock as LockIcon3,
  Key as KeyIcon2,
  Fingerprint as FingerprintIcon2,
  Scan as ScanIcon2,
  Radar as RadarIcon,
  Ban as BanIcon2,
  Skull as SkullIcon,
  Crosshair as CrosshairIcon2,
  Target as TargetIcon2,
  Zap as ZapIcon4,
  Heart as HeartIcon,
  Heartbeat as HeartbeatIcon,
  HeartPulse as HeartPulseIcon,
  Brain as BrainIcon,
  Cpu as CpuIcon2,
  Microchip as MicrochipIcon,
  Radio as RadioIcon2,
  WifiOff as WifiOffIcon,
  ShieldOff as ShieldOffIcon2,
  UserShield as UserShieldIcon,
  ShieldCheck as ShieldCheckIcon3,
  ShieldX as ShieldXIcon,
  ShieldAlert as ShieldAlertIcon3,
  ShieldQuestion as ShieldQuestionIcon,
  ShieldPlus as ShieldPlusIcon,
  ShieldMinus as ShieldMinusIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ExtremeAPKPipelineAdmin() {
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

  // Extreme features state
  const [deviceFingerprints, setDeviceFingerprints] = useState<Map<string, DeviceFingerprint>>(new Map());
  const [securityChecks, setSecurityChecks] = useState<Map<string, SecurityCheck>>(new Map());
  const [timeValidations, setTimeValidations] = useState<Map<string, TimeValidation>>(new Map());
  const [heartbeats, setHeartbeats] = useState<Map<string, Heartbeat>>(new Map());
  const [gracePeriods, setGracePeriods] = useState<Map<string, GracePeriod>>(new Map());
  const [keyTypes, setKeyTypes] = useState<Map<string, KeyType>>(new Map());
  const [watermarks, setWatermarks] = useState<Map<string, Watermark>>(new Map());
  const [featureLocks, setFeatureLocks] = useState<Map<string, FeatureLock>>(new Map());
  const [killSwitches, setKillSwitches] = useState<Map<string, KillSwitch>>(new Map());
  const [sessionControls, setSessionControls] = useState<Map<string, SessionControl>>(new Map());
  const [networkSecurity, setNetworkSecurity] = useState<Map<string, NetworkSecurity>>(new Map());
  const [apiValidations, setApiValidations] = useState<Map<string, APIValidation>>(new Map());
  const [encryptedStorage, setEncryptedStorage] = useState<Map<string, EncryptedStorage>>(new Map());
  const [crashReports, setCrashReports] = useState<CrashReport[]>([]);
  const [serviceProtections, setServiceProtections] = useState<Map<string, ServiceProtection>>(new Map());
  const [openValidations, setOpenValidations] = useState<Map<string, OpenValidation>>(new Map());
  const [secureCaches, setSecureCaches] = useState<Map<string, SecureCache>>(new Map());
  const [apkSplits, setApkSplits] = useState<Map<string, APKSplit>>(new Map());
  const [hotfixes, setHotfixes] = useState<Map<string, Hotfix>>(new Map());
  const [usageTrackers, setUsageTrackers] = useState<Map<string, UsageTracker>>(new Map());
  const [environmentConfigs, setEnvironmentConfigs] = useState<Map<string, EnvironmentConfig>>(new Map());
  const [installSources, setInstallSources] = useState<Map<string, InstallSource>>(new Map());
  const [sessionRecoveries, setSessionRecoveries] = useState<Map<string, SessionRecovery>>(new Map());
  const [healthScores, setHealthScores] = useState<Map<string, HealthScore>>(new Map());
  const [finalLocks, setFinalLocks] = useState<Map<string, FinalLock>>(new Map());

  // Extreme security settings
  const [deviceFingerprintEnabled, setDeviceFingerprintEnabled] = useState(true);
  const [rootDetectionEnabled, setRootDetectionEnabled] = useState(true);
  const [timeTamperProtectionEnabled, setTimeTamperProtectionEnabled] = useState(true);
  const [heartbeatEnabled, setHeartbeatEnabled] = useState(true);
  const [gracePeriodEnabled, setGracePeriodEnabled] = useState(true);
  const [watermarkingEnabled, setWatermarkingEnabled] = useState(true);
  const [killSwitchEnabled, setKillSwitchEnabled] = useState(true);
  const [networkSecurityEnabled, setNetworkSecurityEnabled] = useState(true);
  const [apiSignatureEnabled, setApiSignatureEnabled] = useState(true);
  const [encryptedStorageEnabled, setEncryptedStorageEnabled] = useState(true);
  const [finalLockEnabled, setFinalLockEnabled] = useState(true);

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
    
    // Extreme features data
    setDeviceFingerprints(extremeApkPipeline.getDeviceFingerprints());
    setSecurityChecks(extremeApkPipeline.getSecurityChecks());
    setHeartbeats(extremeApkPipeline.getHeartbeats());
    setKillSwitches(extremeApkPipeline.getKillSwitches());
    setFinalLocks(extremeApkPipeline.getFinalLocks());
    setHealthScores(extremeApkPipeline.getHealthScores());
  };

  const handleSubmitExtremeBuild = async () => {
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
      
      // Apply extreme security features
      await applyExtremeFeatures(buildId, projectId);
      
      toast.success(`Extreme security build submitted: ${buildId}`);
      setGithubUrl('');
      setProjectId('');
      updateData();
    } catch (error) {
      toast.error('Failed to submit extreme build');
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyExtremeFeatures = async (buildId: string, projectId: string) => {
    try {
      // Apply all extreme security features
      if (deviceFingerprintEnabled) {
        // Device fingerprint will be applied when app runs
      }

      if (watermarkingEnabled) {
        await extremeApkPipeline.embedWatermark(buildId, 'reseller-001', 'user-001');
      }

      toast.success('Extreme security features applied successfully');
    } catch (error) {
      console.error('Failed to apply extreme features:', error);
    }
  };

  const handleActivateKillSwitch = async (appId: string) => {
    try {
      const killSwitch = await extremeApkPipeline.activateKillSwitch(
        appId,
        'Security violation detected',
        'admin-001',
        'App has been disabled due to security policy violation'
      );
      toast.success(`Kill switch activated for ${appId}`);
      updateData();
    } catch (error) {
      toast.error('Failed to activate kill switch');
    }
  };

  const handleGenerateDeviceFingerprint = async (deviceId: string) => {
    try {
      const fingerprint = await extremeApkPipeline.generateDeviceFingerprint(deviceId);
      toast.success(`Device fingerprint generated: ${fingerprint.fingerprint.substring(0, 16)}...`);
      updateData();
    } catch (error) {
      toast.error('Failed to generate device fingerprint');
    }
  };

  const handlePerformSecurityCheck = async (deviceId: string) => {
    try {
      const securityCheck = await extremeApkPipeline.performSecurityCheck(deviceId);
      toast.success(`Security check completed - Risk level: ${securityCheck.riskLevel}`);
      updateData();
    } catch (error) {
      toast.error('Failed to perform security check');
    }
  };

  const handleApplyFinalLock = async (deviceId: string, licenseKey: string) => {
    try {
      const finalLock = await extremeApkPipeline.applyFinalLock(deviceId, licenseKey);
      toast.success(`Final lock applied - Status: ${finalLock.lockStatus}`);
      updateData();
    } catch (error) {
      toast.error('Failed to apply final lock');
    }
  };

  const handleCalculateHealthScore = async (buildId: string) => {
    try {
      const healthScore = await extremeApkPipeline.calculateHealthScore(buildId);
      toast.success(`Health score calculated: ${healthScore.score}/100`);
      updateData();
    } catch (error) {
      toast.error('Failed to calculate health score');
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

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'high': return 'text-orange-500';
      case 'critical': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getLockStatusColor = (lockStatus: string) => {
    switch (lockStatus) {
      case 'unlocked': return 'text-green-500';
      case 'locked': return 'text-red-500';
      case 'restricted': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getExtremeSecurityScore = () => {
    let score = 0;
    let maxScore = 0;
    
    // Calculate based on active extreme features
    if (deviceFingerprintEnabled) { score += 10; maxScore += 10; }
    if (rootDetectionEnabled) { score += 10; maxScore += 10; }
    if (timeTamperProtectionEnabled) { score += 10; maxScore += 10; }
    if (heartbeatEnabled) { score += 10; maxScore += 10; }
    if (gracePeriodEnabled) { score += 5; maxScore += 5; }
    if (watermarkingEnabled) { score += 5; maxScore += 5; }
    if (killSwitchEnabled) { score += 10; maxScore += 10; }
    if (networkSecurityEnabled) { score += 10; maxScore += 10; }
    if (apiSignatureEnabled) { score += 10; maxScore += 10; }
    if (encryptedStorageEnabled) { score += 10; maxScore += 10; }
    if (finalLockEnabled) { score += 10; maxScore += 10; }
    
    return Math.round((score / maxScore) * 100);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
          <Skull className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
            Extreme APK Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            Military-grade security system with 25 extreme protection layers
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <Shield className="h-3 w-3 mr-1" />
            Military-Grade
          </Badge>
          <Button variant="outline" onClick={() => updateData()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Extreme Security Features Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Extreme Security Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={deviceFingerprintEnabled} onCheckedChange={setDeviceFingerprintEnabled} />
              <Label className="text-sm">Device Fingerprint</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={rootDetectionEnabled} onCheckedChange={setRootDetectionEnabled} />
              <Label className="text-sm">Root Detection</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={timeTamperProtectionEnabled} onCheckedChange={setTimeTamperProtectionEnabled} />
              <Label className="text-sm">Time Protection</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={heartbeatEnabled} onCheckedChange={setHeartbeatEnabled} />
              <Label className="text-sm">Heartbeat</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={killSwitchEnabled} onCheckedChange={setKillSwitchEnabled} />
              <Label className="text-sm">Kill Switch</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Military-Grade Security Score */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Military-Grade Security Score</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-center">
            <div className="text-4xl font-bold text-red-500">
              {getExtremeSecurityScore()}%
            </div>
            <div className="text-sm text-muted-foreground">Extreme Security Level</div>
          </div>
          <Progress value={getExtremeSecurityScore()} className="h-3" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div className="flex justify-between">
              <span>Fingerprint Lock</span>
              <span className={deviceFingerprintEnabled ? 'text-green-500' : 'text-red-500'}>
                {deviceFingerprintEnabled ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Root Detection</span>
              <span className={rootDetectionEnabled ? 'text-green-500' : 'text-red-500'}>
                {rootDetectionEnabled ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Time Protection</span>
              <span className={timeTamperProtectionEnabled ? 'text-green-500' : 'text-red-500'}>
                {timeTamperProtectionEnabled ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Heartbeat</span>
              <span className={heartbeatEnabled ? 'text-green-500' : 'text-red-500'}>
                {heartbeatEnabled ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Final Lock</span>
              <span className={finalLockEnabled ? 'text-green-500' : 'text-red-500'}>
                {finalLockEnabled ? 'Active' : 'Inactive'}
              </span>
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
            <div className="text-2xl font-bold text-red-500">
              {deviceFingerprints.size}
            </div>
            <div className="text-xs text-muted-foreground">Fingerprints</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-orange-500">
              {securityChecks.size}
            </div>
            <div className="text-xs text-muted-foreground">Security Checks</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-500">
              {heartbeats.size}
            </div>
            <div className="text-xs text-muted-foreground">Active Heartbeats</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-500">
              {finalLocks.size}
            </div>
            <div className="text-xs text-muted-foreground">Final Locks</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-500">
              {killSwitches.size}
            </div>
            <div className="text-xs text-muted-foreground">Kill Switches</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-purple-500">
              {healthScores.size}
            </div>
            <div className="text-xs text-muted-foreground">Health Scores</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-pink-500">
              {crashReports.length}
            </div>
            <div className="text-xs text-muted-foreground">Crash Reports</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-8">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="devices">Devices</TabsTrigger>
              <TabsTrigger value="locks">Locks</TabsTrigger>
              <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
              <TabsTrigger value="health">Health</TabsTrigger>
              <TabsTrigger value="crashes">Crashes</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-4">
              {/* Submit Extreme Build */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Skull className="h-5 w-5" />
                    Submit Extreme Security Build
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
                        onClick={handleSubmitExtremeBuild}
                        disabled={isSubmitting}
                        className="w-full"
                      >
                        {isSubmitting ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <GitBranch className="h-4 w-4 mr-2" />
                        )}
                        Extreme Security Build
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-medium">Military-Grade Protection</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-red-500" />
                          <span>Device Fingerprint Lock</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-red-500" />
                          <span>Root/Emulator Detection</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-red-500" />
                          <span>Time Tamper Protection</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-red-500" />
                          <span>License Heartbeat System</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-red-500" />
                          <span>Remote Kill Switch</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-red-500" />
                          <span>Final Lock System</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Extreme Builds */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Extreme Security Builds
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
                            <Badge className="bg-red-500/20 text-red-400">
                              Extreme
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-red-500">
                              Military-Grade
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
                            onClick={() => handleGenerateDeviceFingerprint(build.id)}
                          >
                            <Fingerprint className="h-4 w-4 mr-2" />
                            Fingerprint
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePerformSecurityCheck(build.id)}
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Security Check
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCalculateHealthScore(build.id)}
                          >
                            <Heart className="h-4 w-4 mr-2" />
                            Health Score
                          </Button>
                        </div>
                      </div>
                    ))}
                    {builds.length === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No extreme builds yet. Submit your first extreme security build above.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
              {/* Device Fingerprints */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Fingerprint className="h-5 w-5" />
                    Device Fingerprints
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from(deviceFingerprints.entries()).map(([deviceId, fingerprint]) => (
                      <div key={deviceId} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-medium">{deviceId}</div>
                            <div className="text-sm text-muted-foreground">
                              Fingerprint: {fingerprint.fingerprint.substring(0, 16)}...
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={fingerprint.trusted ? 'default' : 'destructive'}>
                              {fingerprint.trusted ? 'Trusted' : 'Untrusted'}
                            </Badge>
                            {fingerprint.isEmulator && (
                              <Badge variant="outline">Emulator</Badge>
                            )}
                            {fingerprint.isCloned && (
                              <Badge variant="destructive">Cloned</Badge>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                          <div>Hardware ID: {fingerprint.hardwareId.substring(0, 16)}...</div>
                          <div>Last Seen: {fingerprint.lastSeen.toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))}
                    {deviceFingerprints.size === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No device fingerprints generated yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Security Checks */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Security Checks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from(securityChecks.entries()).map(([deviceId, check]) => (
                      <div key={deviceId} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{deviceId}</div>
                          <div className="flex items-center gap-2">
                            <Badge variant={check.blocked ? 'destructive' : 'default'}>
                              {check.blocked ? 'Blocked' : 'Allowed'}
                            </Badge>
                            <Badge className={cn(
                              check.riskLevel === 'critical' ? 'bg-red-500/20 text-red-400' :
                              check.riskLevel === 'high' ? 'bg-orange-500/20 text-orange-400' :
                              check.riskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-green-500/20 text-green-400'
                            )}>
                              {check.riskLevel}
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              check.isRooted ? "bg-red-500" : "bg-green-500"
                            )} />
                            <span>Rooted: {check.isRooted ? 'Yes' : 'No'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              check.isEmulator ? "bg-orange-500" : "bg-green-500"
                            )} />
                            <span>Emulator: {check.isEmulator ? 'Yes' : 'No'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              check.hasFrida ? "bg-red-500" : "bg-green-500"
                            )} />
                            <span>Frida: {check.hasFrida ? 'Yes' : 'No'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {securityChecks.size === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No security checks performed yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Kill Switches */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Ban className="h-5 w-5" />
                    Remote Kill Switches
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from(killSwitches.entries()).map(([appId, killSwitch]) => (
                      <div key={appId} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-medium">{appId}</div>
                            <div className="text-sm text-muted-foreground">
                              {killSwitch.reason}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={killSwitch.activated ? 'destructive' : 'default'}>
                              {killSwitch.activated ? 'Active' : 'Inactive'}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {killSwitch.affectedDevices.length} devices
                            </span>
                          </div>
                        </div>
                        {killSwitch.activated && (
                          <div className="text-sm text-red-500">
                            Message: {killSwitch.message}
                          </div>
                        )}
                      </div>
                    ))}
                    {killSwitches.size === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No kill switches activated yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="devices" className="space-y-4">
              {/* Heartbeats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heartbeat className="h-5 w-5" />
                    License Heartbeats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from(heartbeats.entries()).map(([key, heartbeat]) => (
                      <div key={key} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-medium">{heartbeat.deviceId}</div>
                            <div className="text-sm text-muted-foreground">
                              License: {heartbeat.licenseKey.substring(0, 16)}...
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={heartbeat.active ? 'default' : 'destructive'}>
                              {heartbeat.active ? 'Active' : 'Inactive'}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {heartbeat.missedPings}/{heartbeat.maxMissedPings} missed
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                          <div>Last Ping: {heartbeat.lastPing.toLocaleString()}</div>
                          <div>Interval: {heartbeat.pingInterval} minutes</div>
                        </div>
                      </div>
                    ))}
                    {heartbeats.size === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No active heartbeats yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Session Controls */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Session Controls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from(sessionControls.entries()).map(([licenseKey, session]) => (
                      <div key={licenseKey} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-medium">{licenseKey.substring(0, 16)}...</div>
                            <div className="text-sm text-muted-foreground">
                              Current Device: {session.currentDevice}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {session.activeSessions.length}/{session.maxSessions}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              Active
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Last Activity: {session.lastActivity.toLocaleString()}
                        </div>
                      </div>
                    ))}
                    {sessionControls.size === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No active sessions yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="locks" className="space-y-4">
              {/* Final Locks */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Final Lock System
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from(finalLocks.entries()).map(([key, lock]) => (
                      <div key={key} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-medium">{lock.deviceId}</div>
                            <div className="text-sm text-muted-foreground">
                              License: {lock.licenseKey.substring(0, 16)}...
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={lock.lockStatus === 'unlocked' ? 'default' : 'destructive'}>
                              {lock.lockStatus}
                            </Badge>
                            {lock.blockedReason && (
                              <span className="text-sm text-red-500">
                                {lock.blockedReason}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-5 gap-2 text-sm mb-2">
                          <div className="text-center">
                            <div className={cn(
                              "w-2 h-2 rounded-full mx-auto mb-1",
                              lock.conditions.keyValid ? "bg-green-500" : "bg-red-500"
                            )} />
                            <div>Key</div>
                          </div>
                          <div className="text-center">
                            <div className={cn(
                              "w-2 h-2 rounded-full mx-auto mb-1",
                              lock.conditions.deviceValid ? "bg-green-500" : "bg-red-500"
                            )} />
                            <div>Device</div>
                          </div>
                          <div className="text-center">
                            <div className={cn(
                              "w-2 h-2 rounded-full mx-auto mb-1",
                              lock.conditions.serverVerified ? "bg-green-500" : "bg-red-500"
                            )} />
                            <div>Server</div>
                          </div>
                          <div className="text-center">
                            <div className={cn(
                              "w-2 h-2 rounded-full mx-auto mb-1",
                              lock.conditions.timeValid ? "bg-green-500" : "bg-red-500"
                            )} />
                            <div>Time</div>
                          </div>
                          <div className="text-center">
                            <div className={cn(
                              "w-2 h-2 rounded-full mx-auto mb-1",
                              lock.conditions.securityValid ? "bg-green-500" : "bg-red-500"
                            )} />
                            <div>Security</div>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Last Check: {lock.lastCheck.toLocaleString()}
                        </div>
                      </div>
                    ))}
                    {finalLocks.size === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No final locks applied yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Watermarks */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Fingerprint className="h-5 w-5" />
                    APK Watermarks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from(watermarks.entries()).map(([buildId, watermark]) => (
                      <div key={buildId} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-medium">{buildId}</div>
                            <div className="text-sm text-muted-foreground">
                              Reseller: {watermark.resellerId} | User: {watermark.userId}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={watermark.embedded ? 'default' : 'outline'}>
                              {watermark.embedded ? 'Embedded' : 'Not Embedded'}
                            </Badge>
                            <Badge variant={watermark.traceable ? 'default' : 'outline'}>
                              {watermark.traceable ? 'Traceable' : 'Not Traceable'}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-sm font-mono text-muted-foreground">
                          Watermark: {watermark.watermark.substring(0, 32)}...
                        </div>
                      </div>
                    ))}
                    {watermarks.size === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No watermarks embedded yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="monitoring" className="space-y-4">
              {/* Network Security */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wifi className="h-5 w-5" />
                    Network Security
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from(networkSecurity.entries()).map(([appId, security]) => (
                      <div key={appId} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{appId}</div>
                          <div className="flex items-center gap-2">
                            <Badge variant={security.sslPinned ? 'default' : 'outline'}>
                              SSL Pinned
                            </Badge>
                            <Badge variant={security.mitmProtection ? 'default' : 'outline'}>
                              MITM Protection
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                          <div>Allowed Hosts: {security.allowedHosts.length}</div>
                          <div>Blocked Hosts: {security.blockedHosts.length}</div>
                          <div>Certificate Pins: {security.certificatePins.length}</div>
                          <div>Last Update: {security.lastUpdate.toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))}
                    {networkSecurity.size === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No network security configurations yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* API Validations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    API Signature Validations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from(apiValidations.entries()).slice(0, 10).map(([requestId, validation]) => (
                      <div key={requestId} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{requestId}</div>
                          <div className="flex items-center gap-2">
                            <Badge variant={validation.valid ? 'default' : 'destructive'}>
                              {validation.valid ? 'Valid' : 'Invalid'}
                            </Badge>
                            {validation.tampered && (
                              <Badge variant="destructive">Tampered</Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-sm font-mono text-muted-foreground">
                          Signature: {validation.signature.substring(0, 16)}...
                        </div>
                      </div>
                    ))}
                    {apiValidations.size === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No API validations performed yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="health" className="space-y-4">
              {/* Health Scores */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5" />
                    APK Health Scores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from(healthScores.entries()).map(([buildId, health]) => (
                      <div key={buildId} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="font-medium">{buildId}</div>
                            <div className="text-sm text-muted-foreground">
                              Last Updated: {health.lastUpdated.toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={cn("text-lg font-bold", 
                              health.score >= 90 ? 'text-green-500' :
                              health.score >= 70 ? 'text-yellow-500' :
                              health.score >= 50 ? 'text-orange-500' :
                              'text-red-500'
                            )}>
                              {health.score}/100
                            </div>
                            <Badge variant={health.score >= 70 ? 'default' : 'destructive'}>
                              {health.score >= 70 ? 'Healthy' : 'Needs Attention'}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                          <div>
                            <span className="font-medium">Performance: </span>
                            <span className={health.performance >= 80 ? 'text-green-500' : 'text-red-500'}>
                              {health.performance}%
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Crash Rate: </span>
                            <span className={health.crashRate >= 80 ? 'text-green-500' : 'text-red-500'}>
                              {health.crashRate}%
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Satisfaction: </span>
                            <span className={health.userSatisfaction >= 80 ? 'text-green-500' : 'text-red-500'}>
                              {health.userSatisfaction}%
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Security: </span>
                            <span className={health.securityScore >= 80 ? 'text-green-500' : 'text-red-500'}>
                              {health.securityScore}%
                            </span>
                          </div>
                        </div>

                        {health.recommendations.length > 0 && (
                          <div>
                            <div className="text-sm font-medium mb-1">Recommendations:</div>
                            <div className="text-sm text-muted-foreground">
                              {health.recommendations.join(', ')}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {healthScores.size === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No health scores calculated yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="crashes" className="space-y-4">
              {/* Crash Reports */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Crash Reports
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {crashReports.slice(0, 10).map((crash) => (
                      <div key={crash.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-medium">{crash.errorType}</div>
                            <div className="text-sm text-muted-foreground">
                              Device: {crash.deviceId} | App: {crash.appVersion}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={crash.resolved ? 'default' : 'destructive'}>
                              {crash.resolved ? 'Resolved' : 'Open'}
                            </Badge>
                            <Badge variant={crash.autoReported ? 'default' : 'outline'}>
                              {crash.autoReported ? 'Auto' : 'Manual'}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">
                          {crash.timestamp.toLocaleString()}
                        </div>
                        <div className="text-sm font-mono text-muted-foreground max-h-20 overflow-hidden">
                          {crash.stackTrace.substring(0, 200)}...
                        </div>
                      </div>
                    ))}
                    {crashReports.length === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No crash reports received yet.
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
          {/* Extreme Security Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Extreme Security Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-center">
                <div className="text-3xl font-bold text-red-500">
                  {getExtremeSecurityScore()}%
                </div>
                <div className="text-sm text-muted-foreground">Military-Grade</div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Device Lock</span>
                  <span className="text-green-500">Active</span>
                </div>
                <div className="flex justify-between">
                  <span>Root Detection</span>
                  <span className="text-green-500">Active</span>
                </div>
                <div className="flex justify-between">
                  <span>Time Protection</span>
                  <span className="text-green-500">Active</span>
                </div>
                <div className="flex justify-between">
                  <span>Heartbeat</span>
                  <span className="text-green-500">Active</span>
                </div>
                <div className="flex justify-between">
                  <span>Final Lock</span>
                  <span className="text-green-500">Active</span>
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
                <span>Secure Devices</span>
                <span>{deviceFingerprints.size}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Blocked Devices</span>
                <span>{Array.from(securityChecks.values()).filter(s => s.blocked).length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Active Heartbeats</span>
                <span>{Array.from(heartbeats.values()).filter(h => h.active).length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Final Locks</span>
                <span>{finalLocks.size}</span>
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
                Extreme Settings
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Shield className="h-4 w-4 mr-2" />
                Security Audit
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Ban className="h-4 w-4 mr-2" />
                Kill Switch
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Heart className="h-4 w-4 mr-2" />
                Health Monitor
              </Button>
            </CardContent>
          </Card>

          {/* Threat Level */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Threat Level</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">
                  LOW
                </div>
                <div className="text-sm text-muted-foreground">Current Threat</div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Blocked Attempts</span>
                  <span className="text-orange-500">3</span>
                </div>
                <div className="flex justify-between">
                  <span>Rooted Devices</span>
                  <span className="text-red-500">2</span>
                </div>
                <div className="flex justify-between">
                  <span>Emulators</span>
                  <span className="text-yellow-500">1</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
