import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Smartphone, 
  Monitor, 
  Tablet, 
  Loader2, 
  Trash2, 
  Shield,
  Clock,
  MapPin,
  Globe
} from 'lucide-react';
import { useUserSessions, UserSession } from '@/hooks/useUserSessions';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

function getDeviceIcon(deviceType: string | null) {
  switch (deviceType) {
    case 'mobile':
      return <Smartphone className="h-5 w-5" />;
    case 'tablet':
      return <Tablet className="h-5 w-5" />;
    default:
      return <Monitor className="h-5 w-5" />;
  }
}

function SessionItem({ 
  session, 
  isCurrent, 
  onRevoke 
}: { 
  session: UserSession; 
  isCurrent: boolean; 
  onRevoke: () => void;
}) {
  const [revoking, setRevoking] = useState(false);

  const handleRevoke = async () => {
    setRevoking(true);
    await onRevoke();
    setRevoking(false);
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
          {getDeviceIcon(session.device_type)}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-foreground">{session.device_name || 'Unknown Device'}</p>
            {isCurrent && (
              <Badge variant="outline" className="text-xs border-primary text-primary">
                Current
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {session.browser || 'Unknown'}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(session.last_active_at), { addSuffix: true })}
            </span>
            {session.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {session.location}
              </span>
            )}
          </div>
        </div>
      </div>
      
      {!isCurrent && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={revoking}
            >
              {revoking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke Device Access</AlertDialogTitle>
              <AlertDialogDescription>
                This will immediately sign out "{session.device_name}" and revoke its access. 
                The device will need to sign in again to access your account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRevoke} className="bg-destructive hover:bg-destructive/90">
                Revoke Access
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

export function DeviceBindingCard() {
  const { sessions, loading, currentSessionId, revokeSession, revokeAllOtherSessions } = useUserSessions();
  const [revokingAll, setRevokingAll] = useState(false);

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    await revokeAllOtherSessions();
    setRevokingAll(false);
  };

  const otherSessionsCount = sessions.filter(s => s.id !== currentSessionId).length;

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Active Devices</CardTitle>
          </div>
          {otherSessionsCount > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-destructive border-destructive/50 hover:bg-destructive/10"
                  disabled={revokingAll}
                >
                  {revokingAll ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Revoke All Others
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revoke All Other Sessions</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will immediately sign out all devices except your current one. 
                    {otherSessionsCount} device{otherSessionsCount > 1 ? 's' : ''} will be signed out.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRevokeAll} className="bg-destructive hover:bg-destructive/90">
                    Revoke All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <CardDescription>
          Manage devices that have access to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Monitor className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No active sessions found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isCurrent={session.id === currentSessionId}
                onRevoke={() => revokeSession(session.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
