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
  Smartphone, Package, GitBranch, Upload, Play, Pause, RotateCcw,
  Download, Eye, EyeOff, Settings, Terminal, Clock, CheckCircle2,
  XCircle, AlertTriangle, Shield, Key, Database, Server,
  Activity, Zap, TrendingUp, Users, FileText, Archive,
  RefreshCw, Trash2, Save, FolderOpen, Link, Lock,
  Unlock, Monitor, Cpu, HardDrive, Wifi, Battery,
  Code, TestTube, Flask, Bug, Hammer, Wrench,
  Rocket, Launch, Globe, Android, Apple, Smartphone as PhoneIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function APKPipelineAdmin() {
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

  useEffect(() => {
    updateData();
    const interval = setInterval(updateData, 5000);
    return () => clearInterval(interval);
  }, []);

  const updateData = () => {
    setBuilds(apkPipeline.getActiveBuilds());
    setBuildQueue(apkPipeline.getBuildQueue());
    setStoredAPKs(apkPipeline.getStoredAPKs());
    setLicenseKeys(apkPipeline.getLicenseKeys());
    setTestResults(apkPipeline.getTestResults());
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
      toast.success(`Build submitted: ${buildId}`);
      setGithubUrl('');
      setProjectId('');
      updateData();
    } catch (error) {
      toast.error('Failed to submit build');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!projectId.trim()) {
      toast.error('Please provide Project ID');
      return;
    }

    setIsSubmitting(true);
    try {
      // In a real implementation, this would upload the file to storage
      const source: BuildSource = {
        id: `source-${Date.now()}`,
        type: 'upload',
        zipPath: file.name, // Simplified - would be actual uploaded path
        projectId,
        adminId: 'current-admin',
        timestamp: new Date()
      };

      const buildId = await apkPipeline.submitBuild(source);
      toast.success(`Build submitted: ${buildId}`);
      setProjectId('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      updateData();
    } catch (error) {
      toast.error('Failed to submit build');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetryBuild = async (buildId: string) => {
    try {
      const success = await apkPipeline.retryBuild(buildId);
      if (success) {
        toast.success('Build retry submitted');
      } else {
        toast.error('Cannot retry this build');
      }
      updateData();
    } catch (error) {
      toast.error('Failed to retry build');
    }
  };

  const handleDownloadAPK = async (buildId: string) => {
    try {
      const apkPath = await apkPipeline.downloadAPK(buildId);
      if (apkPath) {
        // Create download link
        const link = document.createElement('a');
        link.href = `/api/apk/download/${buildId}`;
        link.download = `${buildId}.apk`;
        link.click();
        toast.success('APK download started');
      } else {
        toast.error('APK not available for download');
      }
    } catch (error) {
      toast.error('Failed to download APK');
    }
  };

  const handleViewLogs = async (buildId: string) => {
    try {
      const logs = await apkPipeline.getBuildLogs(buildId);
      setBuildLogs(logs);
      const build = builds.find(b => b.id === buildId);
      setSelectedBuild(build || null);
      setSelectedTab('logs');
    } catch (error) {
      toast.error('Failed to fetch logs');
    }
  };

  const handleGenerateLicenseKey = async () => {
    if (!newKeyDeviceId.trim() || !newKeyProductId.trim()) {
      toast.error('Please provide Device ID and Product ID');
      return;
    }

    setIsGeneratingKey(true);
    try {
      const key = await apkPipeline.generateLicenseKey(newKeyProductId, newKeyDeviceId);
      toast.success(`License key generated: ${key}`);
      setNewKeyDeviceId('');
      setNewKeyProductId('');
      updateData();
    } catch (error) {
      toast.error('Failed to generate license key');
    } finally {
      setIsGeneratingKey(false);
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

  const formatDuration = (start: Date, end?: Date) => {
    const endTime = end || new Date();
    const duration = endTime.getTime() - start.getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const getBuildProgress = (build: BuildResult) => {
    switch (build.status) {
      case 'pending': return 0;
      case 'building': return 50;
      case 'testing': return 75;
      case 'success': return 100;
      case 'failed': return 100;
      default: return 0;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
          <Android className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
            APK Pipeline Admin
          </h1>
          <p className="text-sm text-muted-foreground">
            Automated Git → Build → Test → Secure APK pipeline (Admin Only)
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => updateData()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => apkPipeline.cleanup()}>
            <Trash2 className="h-4 w-4 mr-2" />
            Cleanup
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
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
            <div className="text-2xl font-bold text-red-500">
              {builds.filter(b => b.status === 'failed').length}
            </div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-500">
              {buildQueue.filter(q => q.status === 'queued').length}
            </div>
            <div className="text-xs text-muted-foreground">In Queue</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-purple-500">
              {storedAPKs.length}
            </div>
            <div className="text-xs text-muted-foreground">APKs Stored</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-orange-500">
              {licenseKeys.length}
            </div>
            <div className="text-xs text-muted-foreground">License Keys</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="builds">Builds</TabsTrigger>
              <TabsTrigger value="queue">Queue</TabsTrigger>
              <TabsTrigger value="apks">APKs</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="keys">Keys</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-4">
              {/* Submit New Build */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Rocket className="h-5 w-5" />
                    Submit New Build
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* GitHub Build */}
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
                        Build from GitHub
                      </Button>
                    </div>

                    {/* File Upload */}
                    <div className="space-y-3">
                      <h4 className="font-medium">Upload ZIP File</h4>
                      <Input
                        placeholder="Project ID"
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                      />
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".zip"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSubmitting}
                        className="w-full"
                      >
                        {isSubmitting ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Upload ZIP File
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Builds */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Builds
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
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              {formatDuration(build.startTime, build.endTime)}
                            </span>
                            {build.apkSize && (
                              <span className="text-sm text-muted-foreground">
                                {formatFileSize(build.apkSize)}
                              </span>
                            )}
                          </div>
                        </div>
                        <Progress value={getBuildProgress(build)} className="h-2 mb-2" />
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewLogs(build.id)}
                          >
                            <Terminal className="h-4 w-4 mr-2" />
                            Logs
                          </Button>
                          {build.status === 'success' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadAPK(build.id)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                          )}
                          {build.status === 'failed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetryBuild(build.id)}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Retry
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {builds.length === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No builds yet. Submit your first build above.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="builds" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    All Builds
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-3">
                      {builds.map((build) => (
                        <div key={build.id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-3 h-3 rounded-full", getStatusColor(build.status))} />
                              <div>
                                <div className="font-medium">{build.id}</div>
                                <div className="text-sm text-muted-foreground">
                                  Started: {build.startTime.toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <Badge variant={getStatusBadge(build.status)}>
                              {build.status}
                            </Badge>
                          </div>
                          
                          <Progress value={getBuildProgress(build)} className="h-2 mb-3" />
                          
                          {build.testResults && (
                            <div className="mb-3">
                              <div className="text-sm font-medium mb-1">Test Results:</div>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "w-2 h-2 rounded-full",
                                    build.testResults.tests.launch ? "bg-green-500" : "bg-red-500"
                                  )} />
                                  Launch
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "w-2 h-2 rounded-full",
                                    build.testResults.tests.uiLoad ? "bg-green-500" : "bg-red-500"
                                  )} />
                                  UI Load
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "w-2 h-2 rounded-full",
                                    build.testResults.tests.keyActivation ? "bg-green-500" : "bg-red-500"
                                  )} />
                                  Key Activation
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "w-2 h-2 rounded-full",
                                    build.testResults.tests.functionality ? "bg-green-500" : "bg-red-500"
                                  )} />
                                  Functionality
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {build.errors.length > 0 && (
                            <div className="mb-3">
                              <div className="text-sm font-medium text-red-500 mb-1">Errors:</div>
                              <div className="text-sm text-red-500">
                                {build.errors.join(', ')}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewLogs(build.id)}
                            >
                              <Terminal className="h-4 w-4 mr-2" />
                              View Logs
                            </Button>
                            {build.status === 'success' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadAPK(build.id)}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download APK
                              </Button>
                            )}
                            {build.status === 'failed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRetryBuild(build.id)}
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Retry Build
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                      {builds.length === 0 && (
                        <p className="text-muted-foreground text-center py-8">
                          No builds available
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="queue" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Build Queue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {buildQueue.map((item) => (
                      <div key={item.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              item.status === 'queued' ? 'outline' :
                              item.status === 'processing' ? 'secondary' :
                              item.status === 'completed' ? 'default' : 'destructive'
                            }>
                              {item.status}
                            </Badge>
                            <span className="font-medium">{item.buildId}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {item.priority}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              Retry: {item.retryCount}/{item.maxRetries}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                          <div>
                            Queued: {item.queuedAt.toLocaleTimeString()}
                          </div>
                          {item.startedAt && (
                            <div>
                              Started: {item.startedAt.toLocaleTimeString()}
                            </div>
                          )}
                          {item.completedAt && (
                            <div>
                              Completed: {item.completedAt.toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {buildQueue.length === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No builds in queue
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="apks" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Stored APKs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {storedAPKs.map((apk) => (
                      <div key={apk.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="font-medium">{apk.productId} v{apk.version}</div>
                            <div className="text-sm text-muted-foreground">
                              Build: {apk.buildId}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{formatFileSize(apk.apkSize)}</div>
                            <div className="text-sm text-muted-foreground">
                              {apk.createdAt.toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant={apk.protected ? 'default' : 'outline'}>
                            {apk.protected ? 'Protected' : 'Public'}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            SHA256: {apk.checksum.substring(0, 16)}...
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = apk.downloadUrl;
                              link.download = `${apk.productId}-v${apk.version}.apk`;
                              link.click();
                            }}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(apk.checksum);
                              toast.success('Checksum copied');
                            }}
                          >
                            <Link className="h-4 w-4 mr-2" />
                            Copy Checksum
                          </Button>
                        </div>
                      </div>
                    ))}
                    {storedAPKs.length === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No APKs stored yet
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
                        onClick={handleGenerateLicenseKey}
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

                  {/* Existing Keys */}
                  <div className="space-y-3">
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
                        No license keys generated yet
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* System Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Queue Length</span>
                <span>{buildQueue.filter(q => q.status === 'queued').length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Processing</span>
                <span>{buildQueue.filter(q => q.status === 'processing').length}</span>
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
                Pipeline Settings
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Database className="h-4 w-4 mr-2" />
                Storage Management
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

          {/* Test Results Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Test Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {testResults.slice(0, 3).map((result) => (
                <div key={result.id} className="text-sm">
                  <div className="flex justify-between">
                    <span>{result.buildId}</span>
                    <Badge variant={result.status === 'passed' ? 'default' : 'destructive'}>
                      {result.status}
                    </Badge>
                  </div>
                </div>
              ))}
              {testResults.length === 0 && (
                <p className="text-sm text-muted-foreground">No test results</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
