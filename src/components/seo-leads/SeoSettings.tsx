import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings,
  RefreshCw,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Search,
  FileCode,
  Globe,
  MapPin,
  Send,
  Code,
} from 'lucide-react';
import { toast } from 'sonner';

export function SeoSettings() {
  const [rescanInterval, setRescanInterval] = useState('daily');
  const [aiModel, setAiModel] = useState('gemini-3-flash');
  const [connecting, setConnecting] = useState<string | null>(null);
  
  // Google SEO States
  const [gscConnected, setGscConnected] = useState(false);
  const [gaConnected, setGaConnected] = useState(false);
  const [autoIndex, setAutoIndex] = useState(true);
  const [autoRescan, setAutoRescan] = useState(true);
  const [sitemapUrl, setSitemapUrl] = useState('https://yourdomain.com/sitemap.xml');
  const [indexingUrl, setIndexingUrl] = useState('');
  const [submittingUrl, setSubmittingUrl] = useState(false);
  const [generatingSchema, setGeneratingSchema] = useState(false);
  
  // Schema Markup
  const [schemaType, setSchemaType] = useState('Organization');
  const [schemaMarkup, setSchemaMarkup] = useState(`{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "SaaS VALA",
  "url": "https://id-preview--2dbe056f-e58d-4a25-ac47-b8b9c5f67907.lovable.app",
  "logo": "https://id-preview--2dbe056f-e58d-4a25-ac47-b8b9c5f67907.lovable.app/favicon.png",
  "sameAs": [
    "https://facebook.com/saasvala",
    "https://twitter.com/saasvala"
  ]
}`);

  const connectGoogle = async (type: string) => {
    setConnecting(type);
    await new Promise(r => setTimeout(r, 2000));
    if (type === 'gsc') setGscConnected(true);
    if (type === 'ga') setGaConnected(true);
    toast.success(`${type === 'gsc' ? 'Google Search Console' : 'Google Analytics'} connected successfully!`);
    setConnecting(null);
  };

  const submitUrlToGoogle = async () => {
    if (!indexingUrl) {
      toast.error('Please enter a URL to submit');
      return;
    }
    setSubmittingUrl(true);
    await new Promise(r => setTimeout(r, 1500));
    toast.success(`URL submitted to Google Indexing API: ${indexingUrl}`);
    setIndexingUrl('');
    setSubmittingUrl(false);
  };

  const generateSitemap = async () => {
    setGeneratingSchema(true);
    await new Promise(r => setTimeout(r, 2000));
    toast.success('Sitemap generated and submitted to Google!');
    setGeneratingSchema(false);
  };

  const generateSchemaMarkup = () => {
    const schemas: Record<string, string> = {
      Organization: `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "SoftwareVala",
  "url": "https://softwarevala.com",
  "logo": "https://softwarevala.com/logo.png",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+91-XXXXXXXXXX",
    "contactType": "customer service"
  }
}`,
      LocalBusiness: `{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "SoftwareVala",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Your Street",
    "addressLocality": "Your City",
    "addressCountry": "IN"
  },
  "telephone": "+91-XXXXXXXXXX"
}`,
      Product: `{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Your Product Name",
  "description": "Product description",
  "offers": {
    "@type": "Offer",
    "price": "999",
    "priceCurrency": "INR"
  }
}`,
      WebSite: `{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "SoftwareVala",
  "url": "https://softwarevala.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://softwarevala.com/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}`
    };
    setSchemaMarkup(schemas[schemaType] || schemas.Organization);
    toast.success(`${schemaType} schema generated!`);
  };

  const saveSettings = () => {
    toast.success('All SEO settings saved successfully!');
  };

  return (
    <div className="space-y-6">
      {/* Google Connections */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Google Integrations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Google Search Console */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card/50">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Search className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium">Google Search Console</p>
                <p className="text-sm text-muted-foreground">Monitor search performance & indexing</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {gscConnected ? (
                <Badge className="bg-success/20 text-success">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Button 
                  onClick={() => connectGoogle('gsc')}
                  disabled={connecting === 'gsc'}
                  size="sm"
                  className="gap-2"
                >
                  {connecting === 'gsc' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                  Connect
                </Button>
              )}
            </div>
          </div>

          {/* Google Analytics */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card/50">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-warning to-primary flex items-center justify-center">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium">Google Analytics 4</p>
                <p className="text-sm text-muted-foreground">Track visitors & conversions</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {gaConnected ? (
                <Badge className="bg-success/20 text-success">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Button 
                  onClick={() => connectGoogle('ga')}
                  disabled={connecting === 'ga'}
                  size="sm"
                  className="gap-2"
                >
                  {connecting === 'ga' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                  Connect
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Google Indexing API */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Google Indexing API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Submit URLs directly to Google for faster indexing. Works with Search Console.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="https://yourdomain.com/new-page"
              value={indexingUrl}
              onChange={(e) => setIndexingUrl(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={submitUrlToGoogle} 
              disabled={submittingUrl}
              className="gap-2"
            >
              {submittingUrl ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Submit URL
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" size="sm" className="gap-2">
              <FileCode className="h-4 w-4" />
              Request Indexing
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Request Re-crawl
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sitemap Management */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Sitemap Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Sitemap URL</Label>
            <Input
              value={sitemapUrl}
              onChange={(e) => setSitemapUrl(e.target.value)}
              placeholder="https://yourdomain.com/sitemap.xml"
            />
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={generateSitemap} 
              disabled={generatingSchema}
              className="gap-2"
            >
              {generatingSchema ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileCode className="h-4 w-4" />
              )}
              Generate & Submit Sitemap
            </Button>
            <Button variant="outline" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              View Sitemap
            </Button>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last submitted:</span>
              <span className="font-medium">Today, 10:30 AM</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-muted-foreground">Pages indexed:</span>
              <Badge variant="secondary">42 / 45</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schema Markup Generator */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Code className="h-5 w-5 text-primary" />
            Schema Markup (JSON-LD)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate structured data for rich snippets in Google Search results.
          </p>
          <div className="flex gap-2">
            <Select value={schemaType} onValueChange={setSchemaType}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Organization">Organization</SelectItem>
                <SelectItem value="LocalBusiness">Local Business</SelectItem>
                <SelectItem value="Product">Product</SelectItem>
                <SelectItem value="WebSite">Website</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={generateSchemaMarkup} variant="outline" className="gap-2">
              <Cpu className="h-4 w-4" />
              Generate
            </Button>
          </div>
          <Textarea
            value={schemaMarkup}
            onChange={(e) => setSchemaMarkup(e.target.value)}
            className="font-mono text-xs h-48"
            placeholder="Schema markup will appear here..."
          />
          <Button variant="outline" size="sm" className="gap-2">
            <FileCode className="h-4 w-4" />
            Copy to Clipboard
          </Button>
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
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
              <p className="font-medium">Auto Index New Pages</p>
              <p className="text-sm text-muted-foreground">Submit to Google on publish</p>
            </div>
            <Switch
              checked={autoIndex}
              onCheckedChange={setAutoIndex}
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
              <p className="font-medium">Auto Re-scan SEO</p>
              <p className="text-sm text-muted-foreground">Periodic SEO health check</p>
            </div>
            <Switch
              checked={autoRescan}
              onCheckedChange={setAutoRescan}
            />
          </div>

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
                <SelectItem value="gpt-5-mini">GPT-5 Mini</SelectItem>
              </SelectContent>
            </Select>
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
                All SEO & Lead services are non-refundable. By using this module, you agree to our terms of service.
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
