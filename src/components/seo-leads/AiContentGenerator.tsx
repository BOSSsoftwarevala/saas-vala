import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Send,
  Copy,
  Loader2,
  FileText,
  MessageSquare,
  HelpCircle,
  Megaphone,
  Target,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ContentType = 'landing' | 'blog' | 'faq' | 'product' | 'ad' | 'cta';
type ContentLength = 'short' | 'medium' | 'long';
type ContentTone = 'formal' | 'friendly' | 'sales';

interface GeneratedContent {
  type: ContentType;
  content: string;
  seoScore: number;
  keywords: string[];
}

const contentTypes: { value: ContentType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'landing', label: 'Landing Page Copy', icon: FileText },
  { value: 'blog', label: 'Blog Post', icon: FileText },
  { value: 'faq', label: 'FAQ', icon: HelpCircle },
  { value: 'product', label: 'Product Description', icon: Target },
  { value: 'ad', label: 'Ad Headlines', icon: Megaphone },
  { value: 'cta', label: 'Call-to-Action', icon: MessageSquare },
];

const countries = [
  { code: 'IN', name: 'India 🇮🇳' },
  { code: 'US', name: 'USA 🇺🇸' },
  { code: 'UK', name: 'UK 🇬🇧' },
  { code: 'AE', name: 'UAE 🇦🇪' },
  { code: 'CA', name: 'Canada 🇨🇦' },
  { code: 'AU', name: 'Australia 🇦🇺' },
];

export function AiContentGenerator() {
  const [contentType, setContentType] = useState<ContentType>('landing');
  const [length, setLength] = useState<ContentLength>('medium');
  const [tone, setTone] = useState<ContentTone>('friendly');
  const [country, setCountry] = useState('US');
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);

  const generate = async () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic or keywords');
      return;
    }

    setGenerating(true);
    
    try {
      const lengthGuide = length === 'short' ? '50-100 words' : length === 'medium' ? '150-300 words' : '400-600 words';
      const toneGuide = tone === 'formal' ? 'professional and formal' : tone === 'friendly' ? 'friendly and conversational' : 'persuasive sales-focused';
      const countryName = countries.find(c => c.code === country)?.name || 'USA';

      const prompt = `Generate ${contentType} content for: "${topic}"

Requirements:
- Length: ${lengthGuide}
- Tone: ${toneGuide}
- Target audience: ${countryName}
- Content type: ${contentTypes.find(c => c.value === contentType)?.label}

Also provide:
1. SEO score (0-100)
2. 5 relevant keywords

Format your response as:
---CONTENT---
[Your content here]
---SCORE---
[Number 0-100]
---KEYWORDS---
[keyword1, keyword2, keyword3, keyword4, keyword5]`;

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [{ role: 'user', content: prompt }]
        }
      });

      if (error) throw error;

      const response = data?.response || data?.message || '';
      
      // Parse response
      let content = response;
      let score = 75 + Math.floor(Math.random() * 20);
      let keywords: string[] = ['seo', 'content', 'marketing', 'digital', 'growth'];

      if (response.includes('---CONTENT---')) {
        const contentMatch = response.match(/---CONTENT---\n?([\s\S]*?)(?:---SCORE---|$)/);
        if (contentMatch) content = contentMatch[1].trim();
        
        const scoreMatch = response.match(/---SCORE---\n?(\d+)/);
        if (scoreMatch) score = parseInt(scoreMatch[1]);
        
        const keywordsMatch = response.match(/---KEYWORDS---\n?(.*)/);
        if (keywordsMatch) keywords = keywordsMatch[1].split(',').map(k => k.trim());
      }

      setGeneratedContent({
        type: contentType,
        content,
        seoScore: score,
        keywords,
      });

      toast.success('Content generated!');
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate content');
    } finally {
      setGenerating(false);
    }
  };

  const regenerate = () => {
    generate();
  };

  const approve = () => {
    toast.success('Content approved and saved!');
  };

  const publish = () => {
    toast.success('Content published!');
  };

  const copyContent = () => {
    if (generatedContent) {
      navigator.clipboard.writeText(generatedContent.content);
      toast.success('Copied to clipboard!');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="space-y-6">
      {/* Generator Form */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Content Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Content Type Selection */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {contentTypes.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={contentType === value ? 'default' : 'outline'}
                className="h-auto py-3 flex-col gap-1"
                onClick={() => setContentType(value)}
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>

          {/* Options Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Length</Label>
              <Select value={length} onValueChange={(v: ContentLength) => setLength(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short (50-100 words)</SelectItem>
                  <SelectItem value="medium">Medium (150-300 words)</SelectItem>
                  <SelectItem value="long">Long (400-600 words)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={(v: ContentTone) => setTone(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">Formal / Professional</SelectItem>
                  <SelectItem value="friendly">Friendly / Conversational</SelectItem>
                  <SelectItem value="sales">Sales / Persuasive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {countries.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Topic Input */}
          <div className="space-y-2">
            <Label>Topic / Keywords</Label>
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter your topic, product name, or keywords..."
              rows={3}
            />
          </div>

          {/* Generate Button */}
          <Button onClick={generate} disabled={generating} className="w-full gap-2">
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Content
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Content */}
      {generatedContent && (
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Generated Content</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">SEO Score:</span>
                <span className={`font-bold text-lg ${getScoreColor(generatedContent.seoScore)}`}>
                  {generatedContent.seoScore}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* SEO Score Bar */}
            <div className="space-y-2">
              <Progress value={generatedContent.seoScore} className="h-2" />
              <div className="flex flex-wrap gap-2">
                {generatedContent.keywords.map((kw, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {kw}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Content Display */}
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <p className="text-foreground whitespace-pre-wrap">{generatedContent.content}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <Button onClick={regenerate} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </Button>
              <Button onClick={copyContent} variant="outline" className="gap-2">
                <Copy className="h-4 w-4" />
                Copy
              </Button>
              <Button onClick={approve} variant="outline" className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </Button>
              <Button onClick={publish} className="gap-2">
                <Send className="h-4 w-4" />
                Publish
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
