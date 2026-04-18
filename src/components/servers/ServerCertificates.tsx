import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  Loader2,
  Calendar,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Certificate {
  id: string;
  domain: string;
  issuer: string;
  validFrom: string;
  validUntil: string;
  status: 'valid' | 'expiring' | 'expired' | 'pending';
  daysRemaining?: number;
}

export function ServerCertificates() {
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [servers, setServers] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);

  useEffect(() => {
    fetchServers();
  }, []);

  useEffect(() => {
    if (selectedServerId) {
      fetchCertificates();
    }
  }, [selectedServerId]);

  const fetchServers = async () => {
    try {
      const { data, error } = await supabase
        .from('servers')
        .select('id, name, custom_domain, subdomain')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServers(data || []);
      if (data?.[0]) {
        setSelectedServerId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch servers:', err);
      toast.error('Failed to fetch servers');
    } finally {
      setLoading(false);
    }
  };

  const fetchCertificates = async () => {
    if (!selectedServerId) return;

    try {
      const { data, error } = await supabase.functions.invoke('server-agent', {
        body: {
          action: 'ssl_status',
          serverId: selectedServerId,
        },
      });

      if (error) throw error;

      if (data?.certificates) {
        setCertificates(data.certificates);
      }
    } catch (err) {
      console.error('Failed to fetch certificates:', err);
      toast.error('Failed to fetch SSL certificates');
    }
  };

  const provisionCertificate = async () => {
    if (!selectedServerId) {
      toast.error('Please select a server');
      return;
    }

    setProvisioning(true);
    try {
      const { data, error } = await supabase.functions.invoke('server-agent', {
        body: {
          action: 'provision_ssl',
          serverId: selectedServerId,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('SSL certificate provisioned successfully');
        fetchCertificates();
      }
    } catch (err: any) {
      console.error('Failed to provision certificate:', err);
      toast.error(`Provisioning failed: ${err.message}`);
    } finally {
      setProvisioning(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'valid') return 'bg-success text-success-foreground';
    if (status === 'expiring') return 'bg-warning text-warning-foreground';
    if (status === 'expired') return 'bg-destructive text-destructive-foreground';
    return 'bg-muted text-muted-foreground';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'valid') return <CheckCircle2 className="h-4 w-4" />;
    if (status === 'expiring' || status === 'expired') return <AlertTriangle className="h-4 w-4" />;
    return <Loader2 className="h-4 w-4 animate-spin" />;
  };

  if (loading) {
    return <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
  }

  const expiredCerts = certificates.filter((c) => c.status === 'expired');
  const expiringCerts = certificates.filter((c) => c.status === 'expiring');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-cyan" />
              SSL/TLS Certificates
            </CardTitle>
            <CardDescription>Manage and provision SSL certificates</CardDescription>
          </div>
          <Button onClick={provisionCertificate} disabled={provisioning} size="sm">
            {provisioning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Provisioning...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Provision
              </>
            )}
          </Button>
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
                {server.name} ({server.custom_domain || server.subdomain})
              </option>
            ))}
          </select>
        </div>

        {selectedServerId && (
          <>
            {/* Alerts */}
            {expiredCerts.length > 0 && (
              <Alert className="border-destructive bg-destructive/5">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  {expiredCerts.length} certificate(s) have expired. Renew immediately.
                </AlertDescription>
              </Alert>
            )}

            {expiringCerts.length > 0 && (
              <Alert className="border-warning bg-warning/5">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-warning">
                  {expiringCerts.length} certificate(s) expiring soon.
                </AlertDescription>
              </Alert>
            )}

            {/* Certificates List */}
            <div className="space-y-3">
              <h4 className="font-medium">Certificates ({certificates.length})</h4>
              {certificates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No certificates found</p>
              ) : (
                certificates.map((cert) => (
                  <div key={cert.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(cert.status)}
                        <div>
                          <p className="font-medium text-sm">{cert.domain}</p>
                          <p className="text-xs text-muted-foreground">{cert.issuer}</p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(cert.status)}>
                        {cert.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Valid From</p>
                        <p className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(cert.validFrom).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Valid Until</p>
                        <p className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(cert.validUntil).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {cert.daysRemaining !== undefined && (
                      <div className="bg-muted p-2 rounded text-xs">
                        <p className="font-medium">
                          {cert.daysRemaining} days remaining
                        </p>
                      </div>
                    )}

                    <Button variant="outline" size="sm" className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Download Certificate
                    </Button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
