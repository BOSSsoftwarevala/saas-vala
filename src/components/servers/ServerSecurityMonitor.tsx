import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Zap,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { serversApi } from '@/lib/api';
import { toast } from 'sonner';

interface SecurityIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendation: string;
  fixed: boolean;
}

interface SecurityStatus {
  score: number;
  lastScan: string | null;
  issuesCount: number;
  criticalCount: number;
  vulnerabilities: SecurityIssue[];
}

export function ServerSecurityMonitor() {
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [servers, setServers] = useState<any[]>([]);
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus>({
    score: 0,
    lastScan: null,
    issuesCount: 0,
    criticalCount: 0,
    vulnerabilities: [],
  });
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServers();
  }, []);

  useEffect(() => {
    if (selectedServerId) {
      fetchSecurityStatus();
    }
  }, [selectedServerId]);

  const fetchServers = async () => {
    try {
      const data = await serversApi.list();
      setServers(data?.data || []);
      if (data?.data?.[0]) {
        setSelectedServerId(data.data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch servers:', err);
      toast.error('Failed to fetch servers');
    } finally {
      setLoading(false);
    }
  };

  const fetchSecurityStatus = async () => {
    if (!selectedServerId) return;

    try {
      const { data, error } = await supabase
        .from('servers')
        .select('last_security_scan, security_score')
        .eq('id', selectedServerId)
        .maybeSingle();

      if (!error && data) {
        const { data: issues } = await supabase
          .from('server_security_issues')
          .select('*')
          .eq('server_id', selectedServerId)
          .eq('fixed', false);

        setSecurityStatus({
          score: data.security_score || 0,
          lastScan: data.last_security_scan,
          issuesCount: issues?.length || 0,
          criticalCount: issues?.filter(i => i.severity === 'critical').length || 0,
          vulnerabilities: issues || [],
        });
      }
    } catch (err) {
      console.error('Failed to fetch security status:', err);
    }
  };

  const runSecurityScan = async () => {
    if (!selectedServerId) {
      toast.error('Please select a server');
      return;
    }

    setScanning(true);
    try {
      const result = await serversApi.securityScan(selectedServerId);

      if (result.success) {
        setSecurityStatus({
          score: result.score || 0,
          lastScan: new Date().toISOString(),
          issuesCount: result.issues?.length || 0,
          criticalCount: result.issues?.filter((i: any) => i.severity === 'critical').length || 0,
          vulnerabilities: result.issues || [],
        });
        toast.success('Security scan completed');
      }
    } catch (err: any) {
      console.error('Security scan failed:', err);
      toast.error(`Scan failed: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-destructive text-destructive-foreground',
      high: 'bg-warning text-warning-foreground',
      medium: 'bg-yellow-500 text-white',
      low: 'bg-blue-500 text-white',
    };
    return colors[severity] || 'bg-muted text-muted-foreground';
  };

  const getSeverityIcon = (severity: string) => {
    if (severity === 'critical') return <AlertTriangle className="h-4 w-4" />;
    if (severity === 'high') return <AlertCircle className="h-4 w-4" />;
    return <CheckCircle2 className="h-4 w-4" />;
  };

  if (loading) {
    return <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-cyan" />
              Server Security Monitor
            </CardTitle>
            <CardDescription>AI-powered security scanning and threat detection</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Server Selection */}
        <div>
          <label className="text-sm font-medium">Select Server</label>
          <select
            value={selectedServerId || ''}
            onChange={(e) => setSelectedServerId(e.target.value)}
            className="w-full mt-2 px-3 py-2 bg-background border border-input rounded-md"
          >
            {servers.map((server) => (
              <option key={server.id} value={server.id}>
                {server.name} ({server.status})
              </option>
            ))}
          </select>
        </div>

        {/* Security Score */}
        {selectedServerId && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Security Score</p>
                <div className="text-3xl font-bold text-success">{securityStatus.score}/100</div>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Last Scan</p>
                <p className="text-sm">
                  {securityStatus.lastScan
                    ? new Date(securityStatus.lastScan).toLocaleDateString()
                    : 'Never'}
                </p>
              </div>
            </div>

            {/* Critical Issues Alert */}
            {securityStatus.criticalCount > 0 && (
              <Alert className="border-destructive bg-destructive/5">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  {securityStatus.criticalCount} critical issue(s) found. Immediate action required.
                </AlertDescription>
              </Alert>
            )}

            {/* Issues List */}
            <div className="space-y-3">
              <h4 className="font-medium">Detected Issues ({securityStatus.issuesCount})</h4>
              {securityStatus.vulnerabilities.length === 0 ? (
                <p className="text-sm text-muted-foreground">✓ No security issues detected</p>
              ) : (
                securityStatus.vulnerabilities.map((issue) => (
                  <div key={issue.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(issue.severity)}
                        <span className="font-medium text-sm">{issue.title}</span>
                      </div>
                      <Badge className={getSeverityColor(issue.severity)}>
                        {issue.severity.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{issue.description}</p>
                    <div className="bg-muted p-2 rounded text-xs">
                      <p className="font-medium mb-1">Recommendation:</p>
                      <p>{issue.recommendation}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Scan Button */}
            <Button
              onClick={runSecurityScan}
              disabled={scanning}
              className="w-full"
              variant="default"
            >
              {scanning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Run Security Scan
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
