import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Server, Globe, FolderUp, Rocket, Shield } from 'lucide-react';

export interface HostingCredentials {
  type: 'ftp' | 'sftp' | 'ssh';
  host: string;
  username: string;
  password: string;
  port: string;
  path: string;
  domain?: string;
}

interface HostingCredentialsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (credentials: HostingCredentials) => void;
  fileName?: string;
}

export function HostingCredentialsModal({ 
  open, 
  onOpenChange, 
  onSubmit,
  fileName 
}: HostingCredentialsModalProps) {
  const [type, setType] = useState<'ftp' | 'sftp' | 'ssh'>('ftp');
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [port, setPort] = useState('21');
  const [path, setPath] = useState('/public_html');
  const [domain, setDomain] = useState('');

  const handleSubmit = () => {
    if (!host || !username || !password) {
      return;
    }
    onSubmit({ type, host, username, password, port, path, domain });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Deploy to Your Server
          </DialogTitle>
          <DialogDescription asChild>
            <div>
              {fileName && (
                <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-md border text-xs font-medium">
                  {fileName}
                </span>
              )}
              <span className="block mt-2">
                Enter your hosting credentials to auto-deploy
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Tabs value={type} onValueChange={(v) => {
            setType(v as 'ftp' | 'sftp' | 'ssh');
            setPort(v === 'ftp' ? '21' : v === 'sftp' ? '22' : '22');
          }}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ftp">FTP</TabsTrigger>
              <TabsTrigger value="sftp">SFTP</TabsTrigger>
              <TabsTrigger value="ssh">SSH</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">Server IP / Host *</Label>
              <div className="relative">
                <Server className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="192.168.1.1 or ftp.example.com"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Username *</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ftp_user"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Password *</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Port</Label>
                <Input
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="21"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Remote Path</Label>
                <div className="relative">
                  <FolderUp className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    placeholder="/public_html"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Domain (optional)</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="https://example.com"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
            <Shield className="h-4 w-4 text-success" />
            <span className="text-xs text-muted-foreground">
              Credentials are encrypted and never stored
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!host || !username || !password}
            className="flex-1 gap-2"
          >
            <Rocket className="h-4 w-4" />
            Deploy Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
