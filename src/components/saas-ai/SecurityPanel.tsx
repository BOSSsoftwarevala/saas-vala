import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Shield, 
  Key, 
  LogOut, 
  Monitor, 
  FileText, 
  AlertTriangle,
  CheckCircle2,
  Smartphone,
  Laptop,
  Globe,
  Clock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface SecurityFeature {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
}

interface Session {
  id: string;
  device: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  location: string;
  ip: string;
  lastActive: string;
  isCurrent: boolean;
}

interface AuditLog {
  id: string;
  action: string;
  user: string;
  timestamp: string;
  details: string;
  status: 'success' | 'warning' | 'error';
}

const securityFeatures: SecurityFeature[] = [
  { id: '2fa', name: '2FA Authentication', description: 'Two-factor authentication', icon: Key, enabled: true },
  { id: 'force-logout', name: 'Force Logout', description: 'Logout all sessions', icon: LogOut, enabled: true },
  { id: 'session-monitor', name: 'Session Monitor', description: 'Track active sessions', icon: Monitor, enabled: true },
  { id: 'audit-logs', name: 'Full Audit Logs', description: 'Complete activity history', icon: FileText, enabled: true }
];

const activeSessions: Session[] = [
  { id: '1', device: 'Chrome on Windows', deviceType: 'desktop', location: 'Mumbai, India', ip: '192.168.1.xxx', lastActive: 'Now', isCurrent: true },
  { id: '2', device: 'Safari on iPhone', deviceType: 'mobile', location: 'Delhi, India', ip: '10.0.0.xxx', lastActive: '2 hours ago', isCurrent: false },
  { id: '3', device: 'Firefox on MacOS', deviceType: 'desktop', location: 'Bangalore, India', ip: '172.16.0.xxx', lastActive: '1 day ago', isCurrent: false }
];

const recentAuditLogs: AuditLog[] = [
  { id: '1', action: 'AI Model Enabled', user: 'admin@lovable.app', timestamp: '2 min ago', details: 'Enabled GPT-5 Nano', status: 'success' },
  { id: '2', action: 'Deployment Started', user: 'admin@lovable.app', timestamp: '15 min ago', details: 'Project: demo-app', status: 'success' },
  { id: '3', action: 'Security Scan', user: 'System', timestamp: '1 hour ago', details: 'No threats detected', status: 'success' },
  { id: '4', action: 'Failed Login Attempt', user: 'unknown', timestamp: '3 hours ago', details: 'IP: 203.xxx.xxx.xxx', status: 'warning' },
  { id: '5', action: 'API Key Rotated', user: 'admin@lovable.app', timestamp: '1 day ago', details: 'OpenAI API key', status: 'success' }
];

export function SecurityPanel() {
  const [features, setFeatures] = useState(securityFeatures);
  const [sessions, setSessions] = useState(activeSessions);

  const toggleFeature = (id: string) => {
    setFeatures(prev => prev.map(f => 
      f.id === id ? { ...f, enabled: !f.enabled } : f
    ));
    toast.success('Security setting updated');
  };

  const terminateSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    toast.success('Session terminated');
  };

  const terminateAllSessions = () => {
    setSessions(prev => prev.filter(s => s.isCurrent));
    toast.success('All other sessions terminated');
  };

  const getDeviceIcon = (type: Session['deviceType']) => {
    switch (type) {
      case 'desktop': return Laptop;
      case 'mobile': return Smartphone;
      case 'tablet': return Smartphone;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
      {/* Security Features */}
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Security Settings
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Super Admin Only
            </p>
          </div>
          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
            Protected
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {features.map((feature) => (
            <div
              key={feature.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${feature.enabled ? 'bg-primary/10' : 'bg-muted'}`}>
                  <feature.icon className={`h-4 w-4 ${feature.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium">{feature.name}</p>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              </div>
              <Switch
                checked={feature.enabled}
                onCheckedChange={() => toggleFeature(feature.id)}
              />
            </div>
          ))}

          <Button 
            variant="destructive" 
            className="w-full gap-2 mt-4"
            onClick={terminateAllSessions}
          >
            <LogOut className="h-4 w-4" />
            Force Logout All Sessions
          </Button>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Monitor className="h-5 w-5 text-secondary" />
              Active Sessions
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {sessions.length} active session(s)
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sessions.map((session) => {
              const DeviceIcon = getDeviceIcon(session.deviceType);
              return (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <DeviceIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{session.device}</p>
                        {session.isCurrent && (
                          <Badge variant="secondary" className="text-[10px]">Current</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Globe className="h-3 w-3" />
                        {session.location}
                        <span>•</span>
                        <Clock className="h-3 w-3" />
                        {session.lastActive}
                      </div>
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => terminateSession(session.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      Terminate
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs */}
      <Card className="border-border lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-accent" />
              Audit Logs
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Complete activity history
            </p>
          </div>
          <Button variant="outline" size="sm">
            Export Logs
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAuditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.action}</TableCell>
                    <TableCell className="text-muted-foreground">{log.user}</TableCell>
                    <TableCell className="text-muted-foreground">{log.details}</TableCell>
                    <TableCell className="text-muted-foreground">{log.timestamp}</TableCell>
                    <TableCell className="text-center">
                      {log.status === 'success' && (
                        <CheckCircle2 className="h-4 w-4 text-success mx-auto" />
                      )}
                      {log.status === 'warning' && (
                        <AlertTriangle className="h-4 w-4 text-warning mx-auto" />
                      )}
                      {log.status === 'error' && (
                        <AlertTriangle className="h-4 w-4 text-destructive mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
