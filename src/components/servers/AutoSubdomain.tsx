import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, CheckCircle2, Shield, Copy, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export function AutoSubdomain() {
  const [copied, setCopied] = useState(false);

  const subdomain = 'my-project';
  const fullUrl = `${subdomain}.lovable.app`;

  const copyUrl = () => {
    navigator.clipboard.writeText(`https://${fullUrl}`);
    setCopied(true);
    toast.success('URL copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cyan/20 flex items-center justify-center">
              <Globe className="h-5 w-5 text-cyan" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg">Auto Subdomain</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Automatically generated • Always live
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-success/20 text-success border-success/30 hidden sm:flex">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* URL Display */}
        <div className="glass-card rounded-lg p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3 w-3 text-success" />
              <span>SSL Enabled • Auto-Renewed</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold text-foreground truncate">
                  https://{fullUrl}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" className="border-border gap-2" onClick={copyUrl}>
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button variant="outline" size="sm" className="border-border gap-2" asChild>
                  <a href={`https://${fullUrl}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                    Visit
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-muted/30 text-center">
            <CheckCircle2 className="h-5 w-5 text-success mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Auto Created</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 text-center">
            <Shield className="h-5 w-5 text-success mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">SSL Secured</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 text-center">
            <Globe className="h-5 w-5 text-cyan mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Always Online</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          This subdomain is automatically generated and will always stay live.
          <br />No DNS configuration needed.
        </p>
      </CardContent>
    </Card>
  );
}
