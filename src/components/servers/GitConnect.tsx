import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Github, CheckCircle2, RefreshCw, Unlink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GitConnection {
  connected: boolean;
  username?: string;
  repository?: string;
  branch?: string;
}

export function GitConnect() {
  const [connection, setConnection] = useState<GitConnection>({
    connected: true,
    username: 'saas-vala',
    repository: 'web-app',
    branch: 'main',
  });
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    setIsConnecting(true);
    // Simulate OAuth flow
    setTimeout(() => {
      setConnection({
        connected: true,
        username: 'saas-vala',
        repository: 'new-project',
        branch: 'main',
      });
      setIsConnecting(false);
    }, 2000);
  };

  const handleDisconnect = () => {
    setConnection({ connected: false });
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-foreground/10 flex items-center justify-center">
              <Github className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg">GitHub Connection</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Connect your repository for automatic deployments
              </CardDescription>
            </div>
          </div>
          {connection.connected && (
            <Badge variant="outline" className="bg-success/20 text-success border-success/30 hidden sm:flex">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {connection.connected ? (
          <>
            <div className="glass-card rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Repository</span>
                <span className="text-sm font-medium text-foreground">
                  {connection.username}/{connection.repository}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Branch</span>
                <Badge variant="outline" className="border-border text-foreground">
                  {connection.branch}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="outline" className="bg-success/20 text-success border-success/30 sm:hidden">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
                <span className="text-sm text-success hidden sm:block">Auto-sync enabled</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" className="border-border gap-2 flex-1">
                <RefreshCw className="h-4 w-4" />
                Change Repository
              </Button>
              <Button 
                variant="outline" 
                className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-2"
                onClick={handleDisconnect}
              >
                <Unlink className="h-4 w-4" />
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <Button 
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full bg-foreground text-background hover:bg-foreground/90 gap-2 h-12"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Github className="h-5 w-5" />
                Connect GitHub
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
