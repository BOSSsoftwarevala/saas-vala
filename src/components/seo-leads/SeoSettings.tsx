import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings,
  Link2,
  RefreshCw,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

interface SettingItem {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  status: 'connected' | 'pending' | 'error';
}

const initialSettings: SettingItem[] = [
  { id: 'gsc', name: 'Google Search Console', description: 'Auto-connect for indexing', enabled: false, status: 'pending' },
  { id: 'ga', name: 'Google Analytics', description: 'Traffic tracking', enabled: false, status: 'pending' },
  { id: 'auto-index', name: 'Auto Index New Pages', description: 'Submit to Google on publish', enabled: true, status: 'connected' },
  { id: 'auto-rescan', name: 'Auto Re-scan', description: 'Periodic SEO health check', enabled: true, status: 'connected' },
];

export function SeoSettings() {
  const [settings, setSettings] = useState<SettingItem[]>(initialSettings);
  const [rescanInterval, setRescanInterval] = useState('daily');
  const [aiModel, setAiModel] = useState('gemini-3-flash');
  const [connecting, setConnecting] = useState<string | null>(null);

  const toggleSetting = (id: string) => {
    setSettings(prev => prev.map(s => 
      s.id === id ? { ...s, enabled: !s.enabled } : s
    ));
    toast.success('Setting updated');
  };

  const connectGoogle = async (type: 'gsc' | 'ga') => {
    setConnecting(type);
    
    // Simulate OAuth flow
    await new Promise(r => setTimeout(r, 2000));
    
    setSettings(prev => prev.map(s => 
      s.id === type ? { ...s, enabled: true, status: 'connected' } : s
    ));
    
    toast.success(`${type === 'gsc' ? 'Google Search Console' : 'Google Analytics'} connected!`);
    setConnecting(null);
  };

  const saveSettings = () => {
    toast.success('Settings saved!');
  };

  return (
    <div className="space-y-6">
      {/* Google Connections */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Google Integrations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.filter(s => s.id === 'gsc' || s.id === 'ga').map((setting) => (
            <div
              key={setting.id}
              className="flex items-center justify-between p-4 rounded-lg border border-border"
            >
              <div className="flex items-center gap-4">
                <img 
                  src="https://www.google.com/favicon.ico" 
                  alt="Google" 
                  className="h-8 w-8"
                />
                <div>
                  <p className="font-medium">{setting.name}</p>
                  <p className="text-sm text-muted-foreground">{setting.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {setting.status === 'connected' ? (
                  <Badge className="bg-success/20 text-success">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Button 
                    onClick={() => connectGoogle(setting.id as 'gsc' | 'ga')}
                    disabled={connecting === setting.id}
                    size="sm"
                    className="gap-2"
                  >
                    {connecting === setting.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                    Connect
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Auto Settings */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Automation Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.filter(s => s.id !== 'gsc' && s.id !== 'ga').map((setting) => (
            <div
              key={setting.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border"
            >
              <div>
                <p className="font-medium">{setting.name}</p>
                <p className="text-sm text-muted-foreground">{setting.description}</p>
              </div>
              <Switch
                checked={setting.enabled}
                onCheckedChange={() => toggleSetting(setting.id)}
              />
            </div>
          ))}

          <div className="space-y-2 pt-4 border-t border-border">
            <Label>Auto Re-scan Interval</Label>
            <Select value={rescanInterval} onValueChange={setRescanInterval}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Every Hour</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* AI Model Selection */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            AI Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>AI Model for Content Generation</Label>
            <Select value={aiModel} onValueChange={setAiModel}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini-3-flash">Gemini 3 Flash (Fast)</SelectItem>
                <SelectItem value="gemini-3-pro">Gemini 3 Pro (Quality)</SelectItem>
                <SelectItem value="gpt-5-mini">GPT-5 Mini (Balanced)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Best available model for SEO content generation
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <Card className="glass-card border-warning/30 bg-warning/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">No-Refund Policy</p>
              <p className="text-sm text-muted-foreground">
                All SEO & Lead services are non-refundable. This disclaimer is visible on all lead forms. 
                By using this module, you agree to our terms of service.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={saveSettings} className="gap-2">
          <Settings className="h-4 w-4" />
          Save All Settings
        </Button>
      </div>
    </div>
  );
}
