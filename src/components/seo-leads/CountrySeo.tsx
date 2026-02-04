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
  Globe2,
  CheckCircle2,
  Settings,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

interface CountryConfig {
  code: string;
  name: string;
  flag: string;
  language: string;
  intent: string;
  keywords: string[];
  enabled: boolean;
}

const countries: CountryConfig[] = [
  { code: 'IN', name: 'India', flag: '🇮🇳', language: 'Hindi/English', intent: 'Budget-friendly, Value', keywords: ['affordable', 'best price', 'free trial'], enabled: true },
  { code: 'US', name: 'USA', flag: '🇺🇸', language: 'English', intent: 'Premium SaaS', keywords: ['enterprise', 'professional', 'scalable'], enabled: true },
  { code: 'UK', name: 'United Kingdom', flag: '🇬🇧', language: 'English (UK)', intent: 'Business Solutions', keywords: ['business', 'corporate', 'uk based'], enabled: true },
  { code: 'AE', name: 'UAE', flag: '🇦🇪', language: 'English/Arabic', intent: 'Premium Business', keywords: ['dubai', 'enterprise', 'arabic support'], enabled: true },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', language: 'English/French', intent: 'Business Growth', keywords: ['canadian', 'bilingual', 'reliable'], enabled: false },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', language: 'English', intent: 'Enterprise Solutions', keywords: ['australian', 'local support', 'enterprise'], enabled: false },
];

export function CountrySeo() {
  const [countryConfigs, setCountryConfigs] = useState<CountryConfig[]>(countries);
  const [countrySeoEnabled, setCountrySeoEnabled] = useState(true);
  const [autoDetect, setAutoDetect] = useState(true);
  const [defaultCountry, setDefaultCountry] = useState('US');

  const toggleCountry = (code: string) => {
    setCountryConfigs(prev => prev.map(c => 
      c.code === code ? { ...c, enabled: !c.enabled } : c
    ));
    toast.success('Country setting updated');
  };

  const applyCountrySettings = () => {
    toast.success('Country-based SEO settings applied!', {
      description: `${countryConfigs.filter(c => c.enabled).length} countries configured`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Master Toggle */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe2 className="h-5 w-5 text-primary" />
              Country-Based SEO
            </CardTitle>
            <Switch
              checked={countrySeoEnabled}
              onCheckedChange={setCountrySeoEnabled}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enable localized SEO optimization based on visitor's country. AI will adjust keywords, language tone, and pricing intent automatically.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Auto-Detect Country</Label>
              <div className="flex items-center gap-3">
                <Switch checked={autoDetect} onCheckedChange={setAutoDetect} />
                <span className="text-sm text-muted-foreground">
                  Uses IP + Browser language
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Default Country (Fallback)</Label>
              <Select value={defaultCountry} onValueChange={setDefaultCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {countryConfigs.map(c => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Country Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {countryConfigs.map((country) => (
          <Card 
            key={country.code} 
            className={`glass-card transition-all ${country.enabled ? 'border-primary/30' : 'opacity-60'}`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{country.flag}</span>
                  <div>
                    <CardTitle className="text-base">{country.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{country.language}</p>
                  </div>
                </div>
                <Switch
                  checked={country.enabled}
                  onCheckedChange={() => toggleCountry(country.code)}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Intent:</span>
                <Badge variant="outline" className="text-xs">
                  {country.intent}
                </Badge>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground mb-2">AI Keywords:</p>
                <div className="flex flex-wrap gap-1">
                  {country.keywords.map((kw, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>

              {country.enabled && (
                <div className="flex items-center gap-2 text-success text-xs">
                  <CheckCircle2 className="h-3 w-3" />
                  Active
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Apply Button */}
      <div className="flex justify-end">
        <Button onClick={applyCountrySettings} className="gap-2">
          <Settings className="h-4 w-4" />
          Apply Country Settings
        </Button>
      </div>

      {/* Info Card */}
      <Card className="glass-card bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <h4 className="font-medium text-foreground mb-2">How Country SEO Works</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>India:</strong> Hindi/English mix, budget-focused keywords, free trial emphasis</li>
            <li>• <strong>USA:</strong> Premium SaaS terminology, enterprise features, scalability</li>
            <li>• <strong>UAE:</strong> Business solutions, Arabic support mention, premium pricing</li>
            <li>• <strong>Auto-Detect:</strong> AI adjusts based on visitor's IP and browser settings</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
