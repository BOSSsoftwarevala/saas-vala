import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGitHubMultiAccount } from '@/hooks/useGitHubMultiAccount';
import { 
  GitBranch, 
  RefreshCw, 
  Rocket, 
  FileText, 
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Zap,
  BarChart3,
  FolderGit2,
  Eye
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';

export function GitHubMultiAccountPanel() {
  const {
    loading,
    accounts,
    repos,
    totalProjects,
    monitoring,
    report,
    getAccountStatus,
    listAllProjects,
    monitorProjects,
    autoDeploy,
    syncProjects,
    generateDailyReport,
    runFullAutomation,
    bulkSetVisibility,
  } = useGitHubMultiAccount();

  useEffect(() => {
    getAccountStatus();
  }, [getAccountStatus]);

  return (
    <div className="space-y-6">
      {/* Header with Quick Actions */}
      <Card className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-purple-500/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <FolderGit2 className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-xl">GitHub Multi-Account Manager</CardTitle>
                <p className="text-sm text-muted-foreground">
                  SaaSVala + SoftwareVala = {totalProjects}+ Projects
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => getAccountStatus()}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={() => bulkSetVisibility('public', 'SaaSVala')}
                disabled={loading}
                variant="outline"
                size="sm"
                className="border-green-500/30 text-green-400 hover:bg-green-500/10"
              >
                <Eye className="h-4 w-4 mr-1" />
                Make All Public
              </Button>
              <Button
                onClick={() => runFullAutomation()}
                disabled={loading}
                className="bg-gradient-to-r from-purple-600 to-blue-600"
              >
                <Zap className="h-4 w-4 mr-1" />
                Run Full Automation
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Connected Accounts */}
          <div className="flex flex-wrap gap-2 mt-2">
            {accounts.map((account) => (
              <Badge
                key={account.name}
                variant="outline"
                className="flex items-center gap-1 px-3 py-1 bg-green-500/10 border-green-500/30"
              >
                <CheckCircle className="h-3 w-3 text-green-500" />
                {account.name}
                <span className="text-xs text-muted-foreground">({account.email})</span>
              </Badge>
            ))}
            {accounts.length === 0 && !loading && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                No accounts connected
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:border-blue-500/50 transition-colors" onClick={() => listAllProjects()}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">List Projects</p>
                <p className="text-2xl font-bold">{totalProjects || '—'}</p>
              </div>
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <GitBranch className="h-5 w-5 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-green-500/50 transition-colors" onClick={() => syncProjects()}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sync Projects</p>
                <p className="text-2xl font-bold">🔄</p>
              </div>
              <div className="p-2 bg-green-500/20 rounded-lg">
                <RefreshCw className="h-5 w-5 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-orange-500/50 transition-colors" onClick={() => monitorProjects()}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monitor</p>
                <p className="text-2xl font-bold">
                  {monitoring.reduce((sum, m) => sum + m.activeToday, 0) || '—'}
                </p>
              </div>
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Activity className="h-5 w-5 text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-purple-500/50 transition-colors" onClick={() => autoDeploy()}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Auto Deploy</p>
                <p className="text-2xl font-bold">🚀</p>
              </div>
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Rocket className="h-5 w-5 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Repositories */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-blue-400" />
                Recent Repositories
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => listAllProjects()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {repos.length === 0 && !loading && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Click "List Projects" to load repositories
                  </p>
                )}
                {repos.map((repo, index) => (
                  <div
                    key={`${repo.account}-${repo.name}-${index}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-xs shrink-0">
                        {repo.account}
                      </Badge>
                      <span className="font-medium truncate">{repo.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {repo.language && (
                        <Badge variant="secondary" className="text-xs">
                          {repo.language}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">⭐ {repo.stars}</span>
                      <a href={repo.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Monitoring Status */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-orange-400" />
                Monitoring Status
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => monitorProjects()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-4">
                {monitoring.length === 0 && !loading && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Click "Monitor" to check project status
                  </p>
                )}
                {monitoring.map((m) => (
                  <div key={m.account} className="space-y-2 p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{m.account}</span>
                      <Badge variant="outline">{m.totalRepos} repos</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span>{m.activeToday} active</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {m.failedDeployments > 0 ? (
                          <XCircle className="h-3 w-3 text-red-500" />
                        ) : (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        )}
                        <span>{m.failedDeployments} failed</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-yellow-500" />
                        <span>{m.openIssues} issues</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Daily Report Section */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-400" />
              Daily Report
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => generateDailyReport()} disabled={loading}>
              <FileText className="h-4 w-4 mr-1" />
              Generate Report
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {report ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-muted-foreground">Total Projects</p>
                  <p className="text-2xl font-bold">{report.summary.totalProjects}</p>
                </div>
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-xs text-muted-foreground">Active Today</p>
                  <p className="text-2xl font-bold">{report.summary.totalActiveToday}</p>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <p className="text-xs text-muted-foreground">Deployments</p>
                  <p className="text-2xl font-bold">{report.summary.totalDeployments}</p>
                </div>
                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <p className="text-xs text-muted-foreground">Health Score</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold">{report.summary.healthScore}%</p>
                    <Progress value={report.summary.healthScore} className="h-2 flex-1" />
                  </div>
                </div>
              </div>

              {/* Per-Account Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.accounts.map((acc) => (
                  <div key={acc.name} className="p-3 rounded-lg bg-muted/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{acc.name}</span>
                      <Badge variant="outline">{acc.totalProjects} projects</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(acc.topLanguages).slice(0, 5).map(([lang, count]) => (
                        <Badge key={lang} variant="secondary" className="text-xs">
                          {lang}: {count}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-4 text-xs">
                      <span className="text-green-500">✓ {acc.deploymentStatus.success} success</span>
                      <span className="text-red-500">✗ {acc.deploymentStatus.failed} failed</span>
                      <span className="text-yellow-500">⏳ {acc.deploymentStatus.pending} pending</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Click "Generate Report" to create daily summary
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
