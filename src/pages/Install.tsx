import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Smartphone, CheckCircle2, Share2 } from 'lucide-react';

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Detect if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Detect iOS
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-border/50">
        <CardContent className="p-8 space-y-6 text-center">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Smartphone className="h-10 w-10 text-primary" />
          </div>

          <div>
            <h1 className="text-2xl font-bold">Install SaaS VALA</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Get the full offline marketplace experience on your device.
            </p>
          </div>

          <div className="space-y-2 text-left">
            {['Works offline', '2000+ software products', 'Key-based activation', 'Instant access'].map(f => (
              <div key={f} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>

          {isInstalled ? (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-sm py-2 px-4">
              <CheckCircle2 className="h-4 w-4 mr-1" /> Already Installed
            </Badge>
          ) : isIOS ? (
            <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
              <p className="text-sm font-medium">To install on iPhone/iPad:</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Share2 className="h-4 w-4 shrink-0" />
                <span>Tap <strong>Share</strong> → <strong>Add to Home Screen</strong></span>
              </div>
            </div>
          ) : deferredPrompt ? (
            <Button onClick={handleInstall} size="lg" className="w-full gap-2 text-base">
              <Download className="h-5 w-5" /> Install App
            </Button>
          ) : (
            <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
              <p className="text-sm font-medium">To install:</p>
              <p className="text-sm text-muted-foreground">
                Open in Chrome/Edge → Menu (⋮) → <strong>Install app</strong> or <strong>Add to Home Screen</strong>
              </p>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            Installs as a lightweight app. No app store required.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
