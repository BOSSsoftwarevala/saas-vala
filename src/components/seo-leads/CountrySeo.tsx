import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  Search,
  Loader2,
  ExternalLink,
  MapPin,
  Eye,
  Zap,
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
  const [testCountry, setTestCountry] = useState('IN');
  const [testKeyword, setTestKeyword] = useState('software vala');
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<{
    position: number;
    impressions: number;
    clicks: number;
    ctr: string;
    competitors: { name: string; position: number }[];
  } | null>(null);

  const toggleCountry = (code: string) => {
    setCountryConfigs(prev => prev.map(c => 
      c.code === code ? { ...c, enabled: !c.enabled } : c
    ));
    toast.success('Country setting updated');
  };

  const runSeoTest = async () => {
    if (!testKeyword.trim()) {
      toast.error('Please enter a keyword to test');
      return;
    }
    setTesting(true);
    setTestResults(null);
    
    // Real SEO test would need Google Search Console API
    // For now, show that no live data is available
    await new Promise(r => setTimeout(r, 1500));
    
    toast.info('Live SEO testing requires Google Search Console API integration. Contact admin to enable.');
    setTesting(false);
  };

  const applyCountrySettings = () => {
    toast.success('Country-based SEO settings applied!', {
      description: `${countryConfigs.filter(c => c.enabled).length} countries configured`,
    });
  };

  return (
    <div className="space-y-6">
      {/* SEO Test Panel - India Focus */}
      <Card className="glass-card border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Test SEO Ranking
            <Badge className="ml-2 bg-success/20 text-success">Live Test</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Check how your website ranks for specific keywords in different countries. Perfect for testing India SEO performance.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={testCountry} onValueChange={setTestCountry}>
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
            
            <div className="space-y-2 md:col-span-2">
              <Label>Keyword to Test</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., software vala, best software company india"
                  value={testKeyword}
                  onChange={(e) => setTestKeyword(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  onClick={runSeoTest} 
                  disabled={testing}
                  className="gap-2"
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  Test Now
                </Button>
              </div>
            </div>
          </div>

          {/* Test Results */}
          {testResults && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <MapPin className="h-5 w-5 text-primary" />
                Results for "{testKeyword}" in {countryConfigs.find(c => c.code === testCountry)?.flag} {countryConfigs.find(c => c.code === testCountry)?.name}
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-lg bg-card border border-border text-center">
                  <p className="text-3xl font-bold text-primary">#{testResults.position}</p>
                  <p className="text-xs text-muted-foreground">Position</p>
                </div>
                <div className="p-4 rounded-lg bg-card border border-border text-center">
                  <p className="text-3xl font-bold text-foreground">{testResults.impressions.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Impressions</p>
                </div>
                <div className="p-4 rounded-lg bg-card border border-border text-center">
                  <p className="text-3xl font-bold text-success">{testResults.clicks}</p>
                  <p className="text-xs text-muted-foreground">Clicks</p>
                </div>
                <div className="p-4 rounded-lg bg-card border border-border text-center">
                  <p className="text-3xl font-bold text-accent">{testResults.ctr}</p>
                  <p className="text-xs text-muted-foreground">CTR</p>
                </div>
              </div>

              {/* Google Search Preview */}
              <div className="p-4 rounded-lg bg-card border border-border">
                <p className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
                  <Eye className="h-3 w-3" />
                  Google India Search Preview
                </p>
                <div className="space-y-4">
                  {testResults.competitors.map((comp, idx) => (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-lg ${comp.name === 'yourdomain.com' ? 'bg-primary/10 border border-primary/30' : 'bg-muted/30'}`}
                    >
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <span className="font-bold text-primary">#{comp.position}</span>
                        <span>{comp.name}</span>
                        {comp.name === 'yourdomain.com' && (
                          <Badge className="bg-primary/20 text-primary text-[10px]">Your Site</Badge>
                        )}
                      </div>
                      <p className="text-sm text-primary hover:underline cursor-pointer">
                        {comp.name === 'yourdomain.com' ? 'SoftwareVala - Best Software Solutions India' : `${comp.name.split('.')[0].charAt(0).toUpperCase() + comp.name.split('.')[0].slice(1)} - Software Services`}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {comp.name === 'yourdomain.com' 
                          ? 'Premium software solutions for businesses in India. Affordable pricing, 24/7 support, free trial available. Trusted by 10,000+ companies.'
                          : 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="h-3 w-3" />
                  View in Google India
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <TrendingUp className="h-3 w-3" />
                  Improve Ranking
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Search className="h-3 w-3" />
                  Analyze Competitors
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
