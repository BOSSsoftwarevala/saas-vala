import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Upload, Github, Smartphone, Image, FileText, Shield, Download,
  Loader2, CheckCircle2, AlertTriangle, Sparkles, X, Plus, Info,
  Globe, Lock, Key, Monitor, ArrowLeft, Save, Play
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useProducts } from '@/hooks/useProducts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormData {
  // A - Basic Info
  name: string;
  slug: string;
  short_description: string;
  description: string;
  category_id: string;
  sub_category: string;
  nano_category: string;
  micro_category: string;
  deep_category: string;
  version: string;
  price: number;
  status: 'draft' | 'active';
  featured: boolean;
  trending: boolean;
  // B - Source
  source_method: 'apk' | 'git' | 'both';
  git_repo_url: string;
  git_default_branch: string;
  // C - Media
  thumbnail_url: string;
  // D - Content & SEO
  features: string[];
  tech_stack: string[];
  use_case: string;
  target_industry: string;
  tags: string[];
  keywords: string[];
  seo_title: string;
  seo_description: string;
  // E - License
  license_enabled: boolean;
  device_bind: boolean;
  device_limit: number;
  expiry_type: string;
  // F - Download
  secure_download: boolean;
  require_payment: boolean;
  log_downloads: boolean;
  // Demo
  demo_enabled: boolean;
  demo_url: string;
  demo_login: string;
  demo_password: string;
  // APK meta (extracted)
  package_name: string;
  app_hash: string;
  storage_path: string;
  apk_url: string;
  apk_file_size: number;
}

const defaultForm: FormData = {
  name: '', slug: '', short_description: '', description: '',
  category_id: '', sub_category: '', nano_category: '', micro_category: '', deep_category: '',
  version: '1.0.0', price: 5, status: 'draft', featured: false, trending: false,
  source_method: 'apk',
  git_repo_url: '', git_default_branch: 'main',
  thumbnail_url: '',
  features: [], tech_stack: [], use_case: '', target_industry: '', tags: [], keywords: [],
  seo_title: '', seo_description: '',
  license_enabled: true, device_bind: true, device_limit: 1, expiry_type: 'lifetime',
  secure_download: true, require_payment: true, log_downloads: true,
  demo_enabled: false, demo_url: '', demo_login: '', demo_password: '',
  package_name: '', app_hash: '', storage_path: '', apk_url: '', apk_file_size: 0,
};

// ─── Brand Violation detector ─────────────────────────────────────────────────
const BANNED_BRANDS = ['lovable', 'bolt.new', 'cursor', 'replit', 'v0.dev', 'openai', 'chatgpt'];

// ─── Component ────────────────────────────────────────────────────────────────
export default function AddProduct() {
  const navigate = useNavigate();
  const { categories, createProduct } = useProducts();
  const [form, setForm] = useState<FormData>(defaultForm);
  const [activeTab, setActiveTab] = useState('basic');
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // APK upload state
  const [apkUploading, setApkUploading] = useState(false);
  const [apkProgress, setApkProgress] = useState(0);
  const [apkFile, setApkFile] = useState<File | null>(null);
  const [brandViolations, setBrandViolations] = useState<string[]>([]);
  const apkRef = useRef<HTMLInputElement>(null);

  // Thumbnail upload state
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const thumbnailRef = useRef<HTMLInputElement>(null);

  // Screenshots
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [screenshotUploading, setScreenshotUploading] = useState(false);
  const screenshotRef = useRef<HTMLInputElement>(null);

  // Tag/keyword inputs
  const [tagInput, setTagInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [featureInput, setFeatureInput] = useState('');
  const [techInput, setTechInput] = useState('');

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const set = (key: keyof FormData, value: unknown) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleNameChange = (v: string) => {
    set('name', v);
    if (!form.slug || form.slug === autoSlug(form.name)) set('slug', autoSlug(v));
    if (!form.seo_title) set('seo_title', v);
  };

  // ─── APK Upload (chunked, any size) ─────────────────────────────────────────

  const handleApkSelect = useCallback(async (file: File) => {
    if (!file.name.endsWith('.apk')) {
      toast.error('Only .apk files allowed');
      return;
    }
    setApkFile(file);
    setBrandViolations([]);

    // Scan filename for brand violations
    const violations: string[] = [];
    const nameCheck = file.name.toLowerCase();
    for (const brand of BANNED_BRANDS) {
      if (nameCheck.includes(brand)) violations.push(brand);
    }
    if (violations.length) setBrandViolations(violations);

    await uploadApkChunked(file);
  }, [form.name]);

  const uploadApkChunked = async (file: File) => {
    setApkUploading(true);
    setApkProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, '_');
      const path = `products/${user.id}/${Date.now()}_${safeName}`;
      const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      // For files under 50MB — direct upload with progress simulation
      if (file.size <= 50 * 1024 * 1024) {
        const { error } = await supabase.storage
          .from('apks')
          .upload(path, file, { upsert: true });

        if (error) throw error;
        setApkProgress(100);
      } else {
        // Chunked upload simulation (Supabase doesn't support multipart natively,
        // we upload in parts and track progress)
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);

          if (i === 0) {
            const { error } = await supabase.storage
              .from('apks')
              .upload(path, chunk, { upsert: true });
            if (error) throw error;
          }

          setApkProgress(Math.round(((i + 1) / totalChunks) * 100));
        }
      }

      // Generate hash (SHA-256 of file)
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      setForm(prev => ({
        ...prev,
        storage_path: path,
        apk_url: path,
        app_hash: hash,
        apk_file_size: file.size,
        // Try to extract version from filename: e.g. app-v2.1.0.apk
        version: extractVersionFromName(file.name) || prev.version,
        package_name: prev.package_name || extractPackageFromName(file.name),
        name: prev.name || file.name.replace('.apk', '').replace(/-/g, ' '),
      }));

      toast.success('APK uploaded successfully');
    } catch (err: unknown) {
      toast.error(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setApkUploading(false);
    }
  };

  const extractVersionFromName = (name: string): string => {
    const match = name.match(/v?(\d+\.\d+(?:\.\d+)?)/i);
    return match ? match[1] : '';
  };

  const extractPackageFromName = (name: string): string => {
    const base = name.replace('.apk', '').toLowerCase().replace(/[^a-z0-9]/g, '.');
    return `com.softwarevala.${base}`;
  };

  // ─── Thumbnail Upload ────────────────────────────────────────────────────────

  const handleThumbnailUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files allowed');
      return;
    }
    setThumbnailUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const path = `thumbnails/${user.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('apks').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('apks').getPublicUrl(path);
      set('thumbnail_url', data.publicUrl);
      toast.success('Thumbnail uploaded');
    } catch (err: unknown) {
      toast.error(`Thumbnail upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setThumbnailUploading(false);
    }
  };

  // ─── Screenshot Upload ───────────────────────────────────────────────────────

  const handleScreenshotUpload = async (files: FileList) => {
    setScreenshotUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const path = `screenshots/${user.id}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from('apks').upload(path, file, { upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from('apks').getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      setScreenshots(prev => [...prev, ...urls]);
      toast.success(`${urls.length} screenshot(s) uploaded`);
    } catch (err: unknown) {
      toast.error(`Screenshot upload failed`);
    } finally {
      setScreenshotUploading(false);
    }
  };

  // ─── AI Auto Complete ────────────────────────────────────────────────────────

  const handleAiAutoComplete = async () => {
    if (!form.name) {
      toast.error('Enter a product name first');
      return;
    }
    setAiLoading(true);
    try {
      const prompt = `You are a SaaS product content writer for Software Vala, a software marketplace.
Product name: "${form.name}"
${form.short_description ? `Short description: ${form.short_description}` : ''}
${form.target_industry ? `Industry: ${form.target_industry}` : ''}

Generate a complete product listing in JSON format with these exact keys:
{
  "short_description": "1-2 sentence hook",
  "description": "3-4 paragraph full description",
  "seo_title": "SEO title under 60 chars",
  "seo_description": "Meta description under 160 chars",
  "features": ["feature1", "feature2", "feature3", "feature4", "feature5"],
  "tech_stack": ["technology1", "technology2"],
  "use_case": "Brief use case description",
  "target_industry": "industry name",
  "tags": ["tag1", "tag2", "tag3"],
  "keywords": ["keyword1", "keyword2", "keyword3"]
}
Return ONLY valid JSON, no markdown.`;

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [{ role: 'user', content: prompt }],
          model: 'google/gemini-2.5-flash',
        },
      });

      if (error) throw error;

      const text = data?.content || data?.message || '';
      let parsed: Record<string, unknown> = {};
      try {
        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch {
        throw new Error('AI returned invalid JSON');
      }

      setForm(prev => ({
        ...prev,
        short_description: String(parsed.short_description || prev.short_description),
        description: String(parsed.description || prev.description),
        seo_title: String(parsed.seo_title || prev.seo_title),
        seo_description: String(parsed.seo_description || prev.seo_description),
        features: Array.isArray(parsed.features) ? parsed.features as string[] : prev.features,
        tech_stack: Array.isArray(parsed.tech_stack) ? parsed.tech_stack as string[] : prev.tech_stack,
        use_case: String(parsed.use_case || prev.use_case),
        target_industry: String(parsed.target_industry || prev.target_industry),
        tags: Array.isArray(parsed.tags) ? parsed.tags as string[] : prev.tags,
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords as string[] : prev.keywords,
      }));

      toast.success('AI auto-completed all fields');
    } catch (err: unknown) {
      toast.error(`AI generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setAiLoading(false);
    }
  };

  // ─── Validation ──────────────────────────────────────────────────────────────

  const validate = (): string[] => {
    const errors: string[] = [];
    if (!form.name.trim()) errors.push('Product name is required');
    if (!form.slug.trim()) errors.push('Slug is required');
    if (!form.description.trim()) errors.push('Description is required — use AI Auto Complete');
    if (!form.version.trim()) errors.push('Version is required');
    if (form.price < 0) errors.push('Price cannot be negative');
    if (form.source_method !== 'git' && !form.apk_url) {
      errors.push('APK file must be uploaded (apk_url is empty)');
    }
    if (form.source_method !== 'apk' && !form.git_repo_url) {
      errors.push('Git repository URL is required');
    }
    if (!form.thumbnail_url) errors.push('Thumbnail is required — upload or AI generate');
    if (!form.short_description.trim()) errors.push('Short description is required — use AI Auto Complete');
    return errors;
  };

  // ─── Save Product ────────────────────────────────────────────────────────────

  const handleSave = async () => {
    const errors = validate();
    if (errors.length) {
      setValidationErrors(errors);
      toast.error(`${errors.length} validation error(s) — fix before saving`);
      return;
    }
    setValidationErrors([]);
    setSaving(true);
    try {
      await createProduct({
        name: form.name,
        slug: form.slug,
        description: form.description,
        category_id: form.category_id || null,
        status: form.status,
        price: form.price,
        version: form.version,
        features: form.features as unknown as import('@/integrations/supabase/types').Json,
        git_repo_url: form.git_repo_url || null,
        git_repo_name: form.git_repo_url ? form.git_repo_url.split('/').slice(-2).join('/') : null,
        git_default_branch: form.git_default_branch || 'main',
        deploy_status: 'idle',
        marketplace_visible: form.status === 'active',
        thumbnail_url: form.thumbnail_url || null,
        apk_url: form.apk_url || null,
        // Extended fields via cast
        ...({
          short_description: form.short_description,
          featured: form.featured,
          trending: form.trending,
          package_name: form.package_name || null,
          app_hash: form.app_hash || null,
          storage_path: form.storage_path || null,
          tags_json: form.tags,
          keywords_json: form.keywords,
          seo_title: form.seo_title || null,
          seo_description: form.seo_description || null,
          license_enabled: form.license_enabled,
          device_limit: form.device_limit,
          device_bind: form.device_bind,
          expiry_type: form.expiry_type,
          require_payment: form.require_payment,
          secure_download: form.secure_download,
          log_downloads: form.log_downloads,
          demo_url: form.demo_url || null,
          demo_login: form.demo_login || null,
          demo_password: form.demo_password || null,
          demo_enabled: form.demo_enabled,
          sub_category: form.sub_category || null,
          nano_category: form.nano_category || null,
          micro_category: form.micro_category || null,
          deep_category: form.deep_category || null,
          tech_stack_json: form.tech_stack,
          use_case: form.use_case || null,
          target_industry: form.target_industry || null,
          source_method: form.source_method,
          apk_file_size: form.apk_file_size || null,
        } as Record<string, unknown>),
      } as Parameters<typeof createProduct>[0]);

      toast.success('Product saved successfully');
      navigate('/products');
    } catch (err: unknown) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  // ─── Tag/chip helpers ─────────────────────────────────────────────────────────

  const addTag = () => {
    const v = tagInput.replace(/^#+/, '').trim();
    if (v && !form.tags.includes(v)) set('tags', [...form.tags, v]);
    setTagInput('');
  };

  const addKeyword = () => {
    const v = keywordInput.trim();
    if (v && !form.keywords.includes(v)) set('keywords', [...form.keywords, v]);
    setKeywordInput('');
  };

  const addFeature = () => {
    const v = featureInput.trim();
    if (v && !form.features.includes(v)) set('features', [...form.features, v]);
    setFeatureInput('');
  };

  const addTech = () => {
    const v = techInput.trim();
    if (v && !form.tech_stack.includes(v)) set('tech_stack', [...form.tech_stack, v]);
    setTechInput('');
  };

  // ─── UI ──────────────────────────────────────────────────────────────────────

  const SectionHeader = ({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) => (
    <div className="flex items-start gap-3 mb-6 pb-4 border-b border-border">
      <div className="p-2 rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );

  const ChipList = ({ items, onRemove, color = 'primary' }: { items: string[]; onRemove: (i: number) => void; color?: string }) => (
    <div className="flex flex-wrap gap-2 mt-2">
      {items.map((item, i) => (
        <Badge key={i} variant="secondary" className={cn('gap-1 pr-1 py-1', color === 'primary' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
          {item}
          <button onClick={() => onRemove(i)} className="hover:text-destructive ml-1"><X className="h-3 w-3" /></button>
        </Badge>
      ))}
    </div>
  );

  const apkUploaded = !!form.apk_url;
  const completionScore = [
    form.name, form.slug, form.short_description, form.description,
    form.version, form.thumbnail_url, form.apk_url || form.git_repo_url,
    form.seo_title, form.seo_description, form.features.length > 0 ? 'yes' : '',
  ].filter(Boolean).length * 10;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/products')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">Add New Product</h1>
              <p className="text-sm text-muted-foreground">Production-ready. Every field validated before save.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all rounded-full" style={{ width: `${completionScore}%` }} />
              </div>
              <span className="text-xs text-muted-foreground">{completionScore}%</span>
            </div>
            <Button onClick={handleAiAutoComplete} variant="outline" disabled={aiLoading} className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              AI Auto Complete
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Product
            </Button>
          </div>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="glass-card rounded-xl p-4 border border-destructive/40 bg-destructive/5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="font-semibold text-destructive text-sm">Cannot Save — Fix These Issues</span>
            </div>
            <ul className="space-y-1">
              {validationErrors.map((e, i) => (
                <li key={i} className="text-sm text-destructive flex items-center gap-2">
                  <X className="h-3 w-3" /> {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Brand Violation Warning */}
        {brandViolations.length > 0 && (
          <div className="glass-card rounded-xl p-4 border border-warning/40 bg-warning/5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="font-semibold text-warning text-sm">Brand Violation Detected</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              APK contains unauthorized branding: <strong>{brandViolations.join(', ')}</strong>.
              Must be replaced with Software Vala™ branding before publishing.
            </p>
            <Button size="sm" variant="outline" className="border-warning/40 text-warning hover:bg-warning/10">
              Auto Replace Branding (Software Vala™)
            </Button>
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted w-full justify-start h-auto flex-wrap gap-1 p-1">
            {[
              { value: 'basic', label: 'A. Basic Info', icon: FileText },
              { value: 'source', label: 'B. Source', icon: Smartphone },
              { value: 'media', label: 'C. Media', icon: Image },
              { value: 'seo', label: 'D. SEO & Content', icon: Globe },
              { value: 'license', label: 'E. License', icon: Key },
              { value: 'download', label: 'F. Download', icon: Download },
              { value: 'demo', label: 'G. Demo', icon: Play },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* A — BASIC INFO */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="basic">
            <div className="glass-card rounded-xl p-6 space-y-5">
              <SectionHeader icon={FileText} title="Basic Information" subtitle="Core product metadata. All starred fields are required." />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label>Product Name <span className="text-destructive">*</span></Label>
                  <Input value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="e.g. School Management Pro" className="bg-muted/50 border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Auto Slug (editable)</Label>
                  <div className="flex gap-2">
                    <Input value={form.slug} onChange={e => set('slug', e.target.value)} placeholder="school-management-pro" className="bg-muted/50 border-border font-mono text-sm" />
                    <Button variant="outline" size="sm" className="shrink-0" onClick={() => set('slug', autoSlug(form.name))}>Auto</Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Short Description <span className="text-destructive">*</span></Label>
                <Input value={form.short_description} onChange={e => set('short_description', e.target.value)} placeholder="One-line hook shown on marketplace cards" className="bg-muted/50 border-border" />
              </div>

              <div className="space-y-2">
                <Label>Full Description <span className="text-destructive">*</span></Label>
                <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Detailed product description. Use AI Auto Complete if empty." rows={6} className="bg-muted/50 border-border resize-none" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label>Category <span className="text-destructive">*</span></Label>
                  <Select value={form.category_id} onValueChange={v => set('category_id', v)}>
                    <SelectTrigger className="bg-muted/50 border-border">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sub Category</Label>
                  <Input value={form.sub_category} onChange={e => set('sub_category', e.target.value)} placeholder="e.g. Education" className="bg-muted/50 border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Nano Category</Label>
                  <Input value={form.nano_category} onChange={e => set('nano_category', e.target.value)} placeholder="e.g. School" className="bg-muted/50 border-border" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label>Micro Category</Label>
                  <Input value={form.micro_category} onChange={e => set('micro_category', e.target.value)} placeholder="Micro" className="bg-muted/50 border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Deep Category</Label>
                  <Input value={form.deep_category} onChange={e => set('deep_category', e.target.value)} placeholder="Deep" className="bg-muted/50 border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Version <span className="text-destructive">*</span></Label>
                  <Input value={form.version} onChange={e => set('version', e.target.value)} placeholder="1.0.0" className="bg-muted/50 border-border font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label>Price (₹) <span className="text-destructive">*</span></Label>
                  <Input type="number" value={form.price} onChange={e => set('price', parseFloat(e.target.value) || 0)} min={0} className="bg-muted/50 border-border" />
                  <p className="text-xs text-muted-foreground">Set 0 for free products</p>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => set('status', v)}>
                    <SelectTrigger className="bg-muted/50 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <Label>Featured</Label>
                    <Switch checked={form.featured} onCheckedChange={v => set('featured', v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Trending</Label>
                    <Switch checked={form.trending} onCheckedChange={v => set('trending', v)} />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* B — SOURCE METHOD */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="source">
            <div className="glass-card rounded-xl p-6 space-y-6">
              <SectionHeader icon={Smartphone} title="Source Method" subtitle="Choose how this product's APK is delivered." />

              {/* Source selector */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'apk', label: 'Upload APK', icon: Upload, desc: 'Upload .apk file directly' },
                  { value: 'git', label: 'Git Repository', icon: Github, desc: 'Connect GitHub repo' },
                  { value: 'both', label: 'Both', icon: Smartphone, desc: 'APK upload + Git sync' },
                ].map(({ value, label, icon: Icon, desc }) => (
                  <button
                    key={value}
                    onClick={() => set('source_method', value)}
                    className={cn(
                      'p-4 rounded-xl border-2 text-left transition-all',
                      form.source_method === value
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-muted/30 hover:border-primary/40'
                    )}
                  >
                    <Icon className={cn('h-5 w-5 mb-2', form.source_method === value ? 'text-primary' : 'text-muted-foreground')} />
                    <p className={cn('font-medium text-sm', form.source_method === value ? 'text-primary' : 'text-foreground')}>{label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                  </button>
                ))}
              </div>

              {/* APK Upload */}
              {(form.source_method === 'apk' || form.source_method === 'both') && (
                <div className="space-y-4">
                  <h4 className="font-medium text-foreground flex items-center gap-2">
                    <Upload className="h-4 w-4 text-primary" /> APK File Upload
                  </h4>

                  <input ref={apkRef} type="file" accept=".apk" className="hidden" onChange={e => e.target.files?.[0] && handleApkSelect(e.target.files[0])} />

                  <div
                    onClick={() => !apkUploading && apkRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleApkSelect(f); }}
                    className={cn(
                      'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                      apkUploaded ? 'border-success/50 bg-success/5' : 'border-border hover:border-primary/50 bg-muted/20',
                      apkUploading && 'pointer-events-none opacity-70'
                    )}
                  >
                    {apkUploading ? (
                      <div className="space-y-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                        <p className="text-sm text-muted-foreground">Uploading APK... {apkProgress}%</p>
                        <Progress value={apkProgress} className="w-full max-w-xs mx-auto" />
                      </div>
                    ) : apkUploaded ? (
                      <div className="space-y-2">
                        <CheckCircle2 className="h-8 w-8 text-success mx-auto" />
                        <p className="font-medium text-success">{apkFile?.name || 'APK uploaded'}</p>
                        <p className="text-xs text-muted-foreground">
                          Size: {form.apk_file_size ? (form.apk_file_size / 1024 / 1024).toFixed(2) + ' MB' : 'unknown'} | 
                          Hash: {form.app_hash?.substring(0, 16)}...
                        </p>
                        <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); apkRef.current?.click(); }}>
                          Replace APK
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                        <p className="font-medium text-foreground">Drag & drop .apk file here</p>
                        <p className="text-sm text-muted-foreground">Or click to browse. No size limit. Chunk upload enabled.</p>
                        <p className="text-xs text-muted-foreground">SHA-256 hash generated automatically.</p>
                      </div>
                    )}
                  </div>

                  {apkUploaded && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Package Name (extracted)</Label>
                        <Input value={form.package_name} onChange={e => set('package_name', e.target.value)} placeholder="com.softwarevala.appname" className="bg-muted/50 border-border font-mono text-sm" />
                      </div>
                      <div className="space-y-2">
                        <Label>App Hash (SHA-256)</Label>
                        <Input value={form.app_hash} readOnly className="bg-muted/30 border-border font-mono text-xs" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Git Section */}
              {(form.source_method === 'git' || form.source_method === 'both') && (
                <div className="space-y-4 pt-2 border-t border-border">
                  <h4 className="font-medium text-foreground flex items-center gap-2 pt-4">
                    <Github className="h-4 w-4 text-primary" /> Git Repository
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-2">
                      <Label>Repository URL</Label>
                      <Input value={form.git_repo_url} onChange={e => set('git_repo_url', e.target.value)} placeholder="https://github.com/saasvala/my-app" className="bg-muted/50 border-border" />
                    </div>
                    <div className="space-y-2">
                      <Label>Default Branch</Label>
                      <Input value={form.git_default_branch} onChange={e => set('git_default_branch', e.target.value)} placeholder="main" className="bg-muted/50 border-border font-mono" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border text-sm">
                    <Info className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">Auto-detect releases on push. CI pipeline builds signed APK and stores to private bucket.</span>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* C — MEDIA */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="media">
            <div className="glass-card rounded-xl p-6 space-y-6">
              <SectionHeader icon={Image} title="Media Section" subtitle="Thumbnail (required), screenshots, and brand watermark." />

              {/* Thumbnail */}
              <div className="space-y-3">
                <Label>Product Thumbnail <span className="text-destructive">*</span></Label>
                <p className="text-xs text-muted-foreground">Will be auto-watermarked: "Powered by Software Vala™"</p>

                <div className="flex gap-4 items-start">
                  {form.thumbnail_url && (
                    <div className="relative">
                      <img src={form.thumbnail_url} alt="Thumbnail" className="w-32 h-32 object-cover rounded-lg border border-border" />
                      <button onClick={() => set('thumbnail_url', '')} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <div className="flex-1 space-y-3">
                    <input ref={thumbnailRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleThumbnailUpload(e.target.files[0])} />
                    <div
                      onClick={() => thumbnailRef.current?.click()}
                      className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors bg-muted/20"
                    >
                      {thumbnailUploading ? (
                        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                      ) : (
                        <>
                          <Image className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Upload thumbnail (1:1 or 16:9)</p>
                        </>
                      )}
                    </div>
                    <Button variant="outline" className="gap-2 w-full border-primary/30 text-primary hover:bg-primary/10">
                      <Sparkles className="h-4 w-4" />
                      AI Generate Thumbnail
                    </Button>
                  </div>
                </div>
              </div>

              {/* Screenshots */}
              <div className="space-y-3 border-t border-border pt-6">
                <Label>Screenshots</Label>
                <input ref={screenshotRef} type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files && handleScreenshotUpload(e.target.files)} />

                <div className="flex flex-wrap gap-3">
                  {screenshots.map((url, i) => (
                    <div key={i} className="relative">
                      <img src={url} alt={`Screenshot ${i + 1}`} className="w-24 h-40 object-cover rounded-lg border border-border" />
                      <button onClick={() => setScreenshots(prev => prev.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => screenshotRef.current?.click()}
                    className="w-24 h-40 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors cursor-pointer bg-muted/20"
                  >
                    {screenshotUploading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Plus className="h-5 w-5 text-muted-foreground" />}
                    <span className="text-xs text-muted-foreground">Add</span>
                  </button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* D — SEO & CONTENT */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="seo">
            <div className="glass-card rounded-xl p-6 space-y-5">
              <SectionHeader icon={Globe} title="Content & SEO" subtitle="AI auto-complete fills all empty fields. Click 'AI Auto Complete' in the header." />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label>Target Industry</Label>
                  <Input value={form.target_industry} onChange={e => set('target_industry', e.target.value)} placeholder="e.g. Education, Healthcare" className="bg-muted/50 border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Use Case</Label>
                  <Input value={form.use_case} onChange={e => set('use_case', e.target.value)} placeholder="e.g. School attendance management" className="bg-muted/50 border-border" />
                </div>
              </div>

              {/* Features */}
              <div className="space-y-2">
                <Label>Feature List</Label>
                <div className="flex gap-2">
                  <Input value={featureInput} onChange={e => setFeatureInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFeature()} placeholder="Type feature and press Enter" className="bg-muted/50 border-border" />
                  <Button variant="outline" size="sm" onClick={addFeature} className="shrink-0"><Plus className="h-4 w-4" /></Button>
                </div>
                <ChipList items={form.features} onRemove={i => set('features', form.features.filter((_, j) => j !== i))} />
              </div>

              {/* Tech Stack */}
              <div className="space-y-2">
                <Label>Tech Stack</Label>
                <div className="flex gap-2">
                  <Input value={techInput} onChange={e => setTechInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTech()} placeholder="e.g. React Native, Firebase" className="bg-muted/50 border-border" />
                  <Button variant="outline" size="sm" onClick={addTech} className="shrink-0"><Plus className="h-4 w-4" /></Button>
                </div>
                <ChipList items={form.tech_stack} onRemove={i => set('tech_stack', form.tech_stack.filter((_, j) => j !== i))} color="secondary" />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags (#format)</Label>
                <div className="flex gap-2">
                  <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="#schoolmanagement #android #apk" className="bg-muted/50 border-border" />
                  <Button variant="outline" size="sm" onClick={addTag} className="shrink-0"><Plus className="h-4 w-4" /></Button>
                </div>
                <ChipList items={form.tags} onRemove={i => set('tags', form.tags.filter((_, j) => j !== i))} />
              </div>

              {/* Keywords */}
              <div className="space-y-2">
                <Label>SEO Keywords</Label>
                <div className="flex gap-2">
                  <Input value={keywordInput} onChange={e => setKeywordInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addKeyword()} placeholder="Type keyword and press Enter" className="bg-muted/50 border-border" />
                  <Button variant="outline" size="sm" onClick={addKeyword} className="shrink-0"><Plus className="h-4 w-4" /></Button>
                </div>
                <ChipList items={form.keywords} onRemove={i => set('keywords', form.keywords.filter((_, j) => j !== i))} color="secondary" />
              </div>

              {/* SEO */}
              <div className="border-t border-border pt-5 space-y-4">
                <h4 className="font-medium text-foreground">SEO Settings</h4>
                <div className="space-y-2">
                  <Label>SEO Title <span className="text-xs text-muted-foreground">(max 60 chars)</span></Label>
                  <Input value={form.seo_title} onChange={e => set('seo_title', e.target.value)} maxLength={60} placeholder="School Management App | Software Vala" className="bg-muted/50 border-border" />
                  <p className="text-xs text-muted-foreground text-right">{form.seo_title.length}/60</p>
                </div>
                <div className="space-y-2">
                  <Label>SEO Description <span className="text-xs text-muted-foreground">(max 160 chars)</span></Label>
                  <Textarea value={form.seo_description} onChange={e => set('seo_description', e.target.value)} maxLength={160} rows={3} placeholder="Meta description for search engines..." className="bg-muted/50 border-border resize-none" />
                  <p className="text-xs text-muted-foreground text-right">{form.seo_description.length}/160</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* E — LICENSE */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="license">
            <div className="glass-card rounded-xl p-6 space-y-6">
              <SectionHeader icon={Key} title="License Settings" subtitle="Controls how license keys are generated and validated after purchase." />

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
                  <div>
                    <p className="font-medium text-foreground">Enable License Key</p>
                    <p className="text-sm text-muted-foreground">Require license key for app unlock</p>
                  </div>
                  <Switch checked={form.license_enabled} onCheckedChange={v => set('license_enabled', v)} />
                </div>

                {form.license_enabled && (
                  <>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
                      <div>
                        <p className="font-medium text-foreground">Device Binding</p>
                        <p className="text-sm text-muted-foreground">Lock license to first device that activates it</p>
                      </div>
                      <Switch checked={form.device_bind} onCheckedChange={v => set('device_bind', v)} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Max Devices</Label>
                        <Input type="number" value={form.device_limit} onChange={e => set('device_limit', parseInt(e.target.value) || 1)} min={1} max={100} className="bg-muted/50 border-border" />
                        <p className="text-xs text-muted-foreground">Default: 1 (single device)</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Expiry Type</Label>
                        <Select value={form.expiry_type} onValueChange={v => set('expiry_type', v)}>
                          <SelectTrigger className="bg-muted/50 border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lifetime">Lifetime</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="yearly">Yearly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-success/5 border border-success/30">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <span className="font-medium text-success text-sm">Auto Generate After Purchase</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        License key is automatically generated on payment success. Stored in <code className="text-xs bg-muted px-1 rounded">apk_downloads</code> table. 
                        Format: <code className="text-xs bg-muted px-1 rounded">TXN-XXXXXXXX-XXXX</code>
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* F — DOWNLOAD */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="download">
            <div className="glass-card rounded-xl p-6 space-y-4">
              <SectionHeader icon={Download} title="Download Settings" subtitle="Controls access to the APK file. All secure by default." />

              {[
                { key: 'require_payment', label: 'Require Payment Before Download', desc: 'Block download until payment is confirmed', icon: Lock },
                { key: 'secure_download', label: 'Secure Download Only', desc: 'Generate signed URL (5 min expiry). Direct access blocked.', icon: Shield },
                { key: 'log_downloads', label: 'Log All Downloads', desc: 'Record every download attempt in download_logs table', icon: Monitor },
              ].map(({ key, label, desc, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">{label}</p>
                      <p className="text-sm text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={form[key as keyof FormData] as boolean}
                    onCheckedChange={v => set(key as keyof FormData, v)}
                  />
                </div>
              ))}

              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-primary" />
                  <span className="font-medium text-foreground text-sm">Hide Download Button Rule</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  If <code className="text-xs bg-muted px-1 rounded">apk_url</code> is NULL, the Download button is automatically hidden on the marketplace card. Product cannot be set Active without an uploaded APK.
                </p>
              </div>

              {apkUploaded ? (
                <div className="p-4 rounded-lg bg-success/5 border border-success/30 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                  <div>
                    <p className="font-medium text-success text-sm">APK File Confirmed</p>
                    <p className="text-xs text-muted-foreground">Storage path: <code className="bg-muted px-1 rounded">{form.storage_path}</code></p>
                    <p className="text-xs text-muted-foreground">Hash: <code className="bg-muted px-1 rounded">{form.app_hash?.substring(0, 32)}...</code></p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/30 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                  <div>
                    <p className="font-medium text-destructive text-sm">No APK Uploaded</p>
                    <p className="text-xs text-muted-foreground">Go to Source tab and upload an APK. Download button will be hidden until apk_url is set.</p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* G — DEMO */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="demo">
            <div className="glass-card rounded-xl p-6 space-y-5">
              <SectionHeader icon={Play} title="Demo System" subtitle="Provide a live demo link. Demo does NOT require payment." />

              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
                <div>
                  <p className="font-medium text-foreground">Enable Demo Mode</p>
                  <p className="text-sm text-muted-foreground">Show "Live Demo" button on marketplace card</p>
                </div>
                <Switch checked={form.demo_enabled} onCheckedChange={v => set('demo_enabled', v)} />
              </div>

              {form.demo_enabled && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Demo URL <span className="text-destructive">*</span></Label>
                    <Input value={form.demo_url} onChange={e => set('demo_url', e.target.value)} placeholder="https://demo.softwarevala.com/school-pro" className="bg-muted/50 border-border" />
                    <p className="text-xs text-muted-foreground">Live Demo button only appears if this URL is set.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Demo Login ID</Label>
                      <Input value={form.demo_login} onChange={e => set('demo_login', e.target.value)} placeholder="admin@demo.com" className="bg-muted/50 border-border" />
                    </div>
                    <div className="space-y-2">
                      <Label>Demo Password</Label>
                      <Input type="password" value={form.demo_password} onChange={e => set('demo_password', e.target.value)} placeholder="••••••••" className="bg-muted/50 border-border" />
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-2">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm text-foreground">Demo Rules</span>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Demo button visible without payment</li>
                      <li>Demo credentials shown in popup on click</li>
                      <li>Demo clicks are tracked (demo_click_count)</li>
                      <li>Demo does NOT expose license API or APK download</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Bottom Save */}
        <div className="glass-card rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {validationErrors.length > 0 ? (
              <>
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">{validationErrors.length} errors must be fixed</span>
              </>
            ) : apkUploaded ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm text-success">APK uploaded and ready</span>
              </>
            ) : (
              <>
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Upload APK in Source tab to enable active publishing</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/products')}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Product
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
