import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  Shield,
  Bell,
  CreditCard,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

interface AutoPaySettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AutoPaySettingsModal({ open, onOpenChange }: AutoPaySettingsModalProps) {
  const [autoRenew, setAutoRenew] = useState(() => {
    try { return JSON.parse(localStorage.getItem('autopay_autorenew') ?? 'true'); } catch { return true; }
  });
  const [lowBalanceAlert, setLowBalanceAlert] = useState(() => {
    try { return JSON.parse(localStorage.getItem('autopay_lowbalancealert') ?? 'true'); } catch { return true; }
  });
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState(
    () => localStorage.getItem('autopay_threshold') ?? '500'
  );
  const [gracePeriod, setGracePeriod] = useState(() => {
    try { return JSON.parse(localStorage.getItem('autopay_graceperiod') ?? 'true'); } catch { return true; }
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('autopay_autorenew', JSON.stringify(autoRenew));
    localStorage.setItem('autopay_lowbalancealert', JSON.stringify(lowBalanceAlert));
    localStorage.setItem('autopay_threshold', lowBalanceThreshold);
    localStorage.setItem('autopay_graceperiod', JSON.stringify(gracePeriod));
    setSaved(true);
    toast.success('Auto-pay settings saved');
    setTimeout(() => { setSaved(false); onOpenChange(false); }, 1200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Auto Pay Settings
          </DialogTitle>
          <DialogDescription>
            Configure automatic payments and alerts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Auto Renewal */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <Label htmlFor="auto-renew" className="font-medium">Auto Renew Licenses</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Automatically deduct from wallet when licenses expire
              </p>
            </div>
            <Switch
              id="auto-renew"
              checked={autoRenew}
              onCheckedChange={setAutoRenew}
            />
          </div>

          {/* Low Balance Alert */}
          <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-warning" />
                  <Label htmlFor="low-balance" className="font-medium">Low Balance Alert</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get notified when balance falls below threshold
                </p>
              </div>
              <Switch
                id="low-balance"
                checked={lowBalanceAlert}
                onCheckedChange={setLowBalanceAlert}
              />
            </div>
            {lowBalanceAlert && (
              <div className="pt-2 border-t border-border">
                <Label htmlFor="threshold" className="text-xs text-muted-foreground">
                  Alert threshold
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                  <Input
                    id="threshold"
                    value={lowBalanceThreshold}
                    onChange={(e) => setLowBalanceThreshold(e.target.value.replace(/\D/g, ''))}
                    className="pl-8 w-32"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Grace Period */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-success" />
                <Label htmlFor="grace-period" className="font-medium">Grace Period</Label>
                <Badge variant="outline" className="text-xs">Recommended</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                7-day grace period before license suspension
              </p>
            </div>
            <Switch
              id="grace-period"
              checked={gracePeriod}
              onCheckedChange={setGracePeriod}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || saved}
            className="bg-orange-gradient hover:opacity-90 text-white"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saved && <CheckCircle2 className="h-4 w-4 mr-2" />}
            {saved ? 'Saved!' : 'Save Settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
