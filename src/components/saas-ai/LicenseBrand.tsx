import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Shield, 
  CheckCircle2, 
  Lock, 
  Eye, 
  Fingerprint,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function LicenseBrand() {
  const [brandingEnabled, setBrandingEnabled] = useState(true);
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [checksumEnabled, setChecksumEnabled] = useState(true);

  const features = [
    {
      id: 'branding',
      icon: Sparkles,
      title: 'Powered by Software Vala™',
      description: 'Auto-injected branding in footer',
      enabled: brandingEnabled,
      onChange: setBrandingEnabled,
      locked: true
    },
    {
      id: 'watermark',
      icon: Eye,
      title: 'Hidden Watermark',
      description: 'Invisible ownership verification',
      enabled: watermarkEnabled,
      onChange: setWatermarkEnabled,
      locked: true
    },
    {
      id: 'checksum',
      icon: Fingerprint,
      title: 'License Checksum',
      description: 'Tamper-proof code verification',
      enabled: checksumEnabled,
      onChange: setChecksumEnabled,
      locked: false
    }
  ];

  return (
    <Card className="glass-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-warning/20 flex items-center justify-center">
              <Shield className="h-5 w-5 text-warning" />
            </div>
            <div>
              <CardTitle className="text-lg">License & Brand Lock</CardTitle>
              <CardDescription className="text-xs">
                Auto-embedded • Cannot be removed
              </CardDescription>
            </div>
          </div>
          <Badge className="bg-success/20 text-success border-success/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Protected
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {features.map((feature) => {
          const Icon = feature.icon;
          
          return (
            <div
              key={feature.id}
              className={cn(
                'flex items-center justify-between p-3 rounded-lg border transition-colors',
                feature.enabled 
                  ? 'bg-success/5 border-success/30' 
                  : 'bg-muted/20 border-border'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-2 rounded-lg',
                  feature.enabled ? 'bg-success/10' : 'bg-muted'
                )}>
                  <Icon className={cn(
                    'h-4 w-4',
                    feature.enabled ? 'text-success' : 'text-muted-foreground'
                  )} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{feature.title}</p>
                    {feature.locked && (
                      <Lock className="h-3 w-3 text-warning" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              </div>
              
              <Switch
                checked={feature.enabled}
                onCheckedChange={feature.onChange}
                disabled={feature.locked}
              />
            </div>
          );
        })}

        {/* Info Box */}
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
          <div className="flex items-start gap-2">
            <Lock className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-warning">Branding Protection Active</p>
              <p className="text-xs text-muted-foreground mt-1">
                Locked features cannot be disabled. All code is automatically verified for ownership on every deploy.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
