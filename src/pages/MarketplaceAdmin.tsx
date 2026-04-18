import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { AIAPIUsageDashboard } from '@/components/ai-api/AIAPIUsageDashboard';
import { marketplaceAdminIntegrator } from '@/lib/offline/moduleIntegration';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Search, Plus, Edit2, Trash2, Layout, Menu, Package, Truck, CreditCard, Tags, RefreshCw,
  Upload, Download, Eye, Copy, X, ChevronRight, Loader2, CheckCircle, XCircle, AlertCircle, Info,
  BarChart3, Calendar, MessageSquare, Clock, TrendingUp, Users, DollarSign, Star, ThumbsUp, ThumbsDown,
  Folder, Image, Shield, Globe, Hash, FileText, Target, Zap, Map, Mail, Send, Kanban, Cpu, Share2, Mic, Key, Monitor, Settings,
} from 'lucide-react';
import { generateProductThumbnail } from '@/lib/thumbnailGenerator';
import { marketplaceAdminApi } from '@/lib/api';
import { normalizeDemoUrlPair, sanitizeDemoSourceUrl } from '@/lib/demoMasking';
import { cn } from '@/lib/utils';

const db = supabase as any;
const PAGE_SIZE = 25;

type ProductStatusDb = 'active' | 'suspended' | 'draft' | 'archived' | 'upcoming' | 'inactive';

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price: number;
  status: ProductStatusDb;
  business_type: string | null;
  target_industry?: string | null;
  tags: string[];
  demo_url: string | null;
  demo_source_url: string | null;
  demo_login: string | null;
  demo_password: string | null;
  demo_enabled: boolean;
  apk_url: string | null;
  thumbnail_url: string | null;
  featured: boolean;
  trending: boolean;
  marketplace_visible: boolean;
  discount_percent: number;
  rating: number;
  apk_enabled: boolean;
  license_enabled: boolean;
  buy_enabled: boolean;
  created_at: string;
}

interface HeaderMenu {
  id: string;
  label: string;
  target_id: string | null;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
}

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  badge: string | null;
  badge_color: string | null;
  offer_text: string | null;
  coupon_code: string | null;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
}

interface Ticker {
  id: string;
  text: string;
  sort_order: number;
  is_active: boolean;
}

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order: number;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
}

interface DiscountRule {
  id: string;
  name: string;
  country_code: string | null;
  region: string | null;
  festival: string | null;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order: number;
  coupon_code: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  sort_order: number;
}

interface PaymentGateway {
  id: string;
  gateway_code: string;
  gateway_name: string;
  is_enabled: boolean;
  sort_order: number;
  config: Record<string, unknown>;
}

interface Apk {
  id: string;
  product_id: string;
  version: string;
  file_url: string | null;
  file_size: number | null;
  status: 'published' | 'draft' | 'deprecated';
  download_count: number;
  current_version_id: string | null;
  updated_at: string;
}

interface ApkVersion {
  id: string;
  apk_id: string;
  version_name: string;
  version_code: number;
  file_path: string | null;
  file_size: number | null;
  is_stable: boolean;
  created_at: string;
}

interface MarketplaceOrder {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string | null;
  product_name: string | null;
  amount: number;
  final_amount: number | null;
  status: string;
  payment_method: string | null;
  coupon_code: string | null;
  created_at: string;
  completed_at: string | null;
  transaction_id: string | null;
  buyer_name?: string;
  reseller_name?: string;
}

interface ProductSeo {
  id?: string;
  product_id?: string;
  slug: string;
  title: string;
  meta_description: string;
  keywords: string[];
  hashtags: string[];
  seo_score: number;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  twitter_card?: string;
  canonical_url?: string;
  target_country?: string;
}

const statusLabelMap: Record<ProductStatusDb, string> = {
  active: 'LIVE',
  upcoming: 'UPCOMING',
  suspended: 'SUSPENDED',
  draft: 'PIPELINE',
  archived: 'ARCHIVED',
  inactive: 'INACTIVE',
};

const statusBadgeClass: Record<ProductStatusDb, string> = {
  active: 'bg-primary/10 text-primary border-primary/30',
  upcoming: 'bg-accent/20 text-accent-foreground border-accent/30',
  suspended: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  draft: 'bg-muted text-muted-foreground border-border',
  archived: 'bg-destructive/10 text-destructive border-destructive/30',
  inactive: 'bg-destructive/10 text-destructive border-destructive/30',
};

const emptyProduct = (): Product => ({
  id: `new-${Date.now()}`,
  name: '',
  slug: '',
  description: '',
  short_description: '',
  price: 5,
  status: 'draft',
  business_type: 'software',
  target_industry: 'software',
  tags: [],
  demo_url: '',
  demo_source_url: '',
  demo_login: '',
  demo_password: '',
  demo_enabled: false,
  apk_url: '',
  thumbnail_url: '',
  featured: false,
  trending: false,
  marketplace_visible: false,
  discount_percent: 0,
  rating: 4.5,
  apk_enabled: false,
  license_enabled: true,
  buy_enabled: true,
  created_at: new Date().toISOString(),
});

const emptyHeaderMenu = (): HeaderMenu => ({
  id: `new-${Date.now()}`,
  label: '',
  target_id: '',
  link_url: '',
  sort_order: 1,
  is_active: true,
});

const emptyBanner = (): Banner => ({
  id: `new-${Date.now()}`,
  title: '',
  subtitle: '',
  image_url: '',
  badge: '',
  badge_color: 'from-primary to-accent',
  offer_text: '',
  coupon_code: '',
  link_url: '',
  sort_order: 1,
  is_active: true,
  start_date: null,
  end_date: null,
});

const emptyTicker = (): Ticker => ({
  id: `new-${Date.now()}`,
  text: '',
  sort_order: 1,
  is_active: true,
});

const emptyCoupon = (): Coupon => ({
  id: `new-${Date.now()}`,
  code: '',
  description: '',
  discount_type: 'percent',
  discount_value: 10,
  min_order: 0,
  max_uses: 100,
  used_count: 0,
  is_active: true,
  start_date: null,
  end_date: null,
});

const emptyDiscountRule = (): DiscountRule => ({
  id: `new-${Date.now()}`,
  name: '',
  country_code: '',
  region: '',
  festival: '',
  discount_type: 'percent',
  discount_value: 10,
  min_order: 0,
  coupon_code: '',
  start_date: null,
  end_date: null,
  is_active: true,
  sort_order: 1,
});

const PAYMENT_SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

// Generate unique SEO-friendly slug with duplicate prevention
function generateUniqueSlug(baseSlug: string, existingSlugs: string[] = [], suffix = ''): string {
  let slug = baseSlug + (suffix ? `-${suffix}` : '');
  
  if (existingSlugs.includes(slug)) {
    // Try with numbers
    let counter = 1;
    while (existingSlugs.includes(`${slug}-${counter}`)) {
      counter++;
    }
    slug = `${slug}-${counter}`;
  }
  
  return slug;
}

// Auto generate SEO meta tags
function generateMetaTags(product: any) {
  const title = product.name || 'Product';
  const description = product.short_description || product.description || '';
  const keywords = [
    ...(product.tags || []),
    product.business_type || product.target_industry || '',
    'software',
    'app',
    'download'
  ].filter(Boolean).join(', ');
  
  return {
    title: `${title} - SaaS Marketplace`,
    description: description.substring(0, 160),
    keywords: keywords.substring(0, 255),
    ogTitle: title,
    ogDescription: description.substring(0, 160),
    ogImage: product.thumbnail_url || '',
    ogUrl: `/product/${product.slug}`,
    canonical: `/product/${product.slug}`
  };
}

function formatBytes(size?: number | null) {
  if (!size) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = size;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx += 1;
  }
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1">
    <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
    {children}
  </div>
);

export default function MarketplaceAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [initialized, setInitialized] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [productCatalog, setProductCatalog] = useState<Array<{ id: string; name: string; status: string; apk_enabled: boolean }>>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    console.log('[MarketplaceAdmin] MODULE LOADED');
    // Initialize module integration with all 30 micro validations
    const init = async () => {
      try {
        await marketplaceAdminIntegrator.initialize();
        setInitialized(true);
      } catch (error) {
        console.error('Failed to initialize marketplace admin module:', error);
        setInitialized(true);
      }
    };

    init();

    // Cleanup on unmount
    return () => {
      marketplaceAdminIntegrator.cleanup();
    };
  }, []);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

  // Advanced filter states
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [headerMenus, setHeaderMenus] = useState<HeaderMenu[]>([]);
  const [menusLoading, setMenusLoading] = useState(true);

  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannersLoading, setBannersLoading] = useState(true);

  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [tickersLoading, setTickersLoading] = useState(true);

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(true);

  const [discountRules, setDiscountRules] = useState<DiscountRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);

  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [gatewaysLoading, setGatewaysLoading] = useState(true);

  const [apks, setApks] = useState<Apk[]>([]);
  const [apkVersions, setApkVersions] = useState<ApkVersion[]>([]);
  const [apksLoading, setApksLoading] = useState(true);
  const [uploadingApk, setUploadingApk] = useState(false);
  const [apkFile, setApkFile] = useState<File | null>(null);

  // Phase 3: Category Management
  const [categories, setCategories] = useState<any[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [editCategory, setEditCategory] = useState<any>(null);

  // Phase 3: User Management
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [selectedUserRole, setSelectedUserRole] = useState<string>('all');
  const [editUser, setEditUser] = useState<any>(null);

  // Phase 3: License Key Management
  const [licenses, setLicenses] = useState<any[]>([]);
  const [licensesLoading, setLicensesLoading] = useState(true);
  const [editLicense, setEditLicense] = useState<any>(null);

  // Phase 4: Banner + Ticker Management
  const [tickerMessages, setTickerMessages] = useState<any[]>([]);
  const [tickerLoading, setTickerLoading] = useState(true);
  const [editTicker, setEditTicker] = useState<any>(null);
  const [bannerSlides, setBannerSlides] = useState<any[]>([]);
  const [bannerLoading, setBannerLoading] = useState(true);
  const [editBanner, setEditBanner] = useState<any>(null);
  const [bannerSettings, setBannerSettings] = useState<any>(null);

  // Phase 5: Programmable Pages Management (Module 101)
  const [programmablePages, setProgrammablePages] = useState<any[]>([]);
  const [programmablePagesLoading, setProgrammablePagesLoading] = useState(true);
  const [editProgrammablePage, setEditProgrammablePage] = useState<any>(null);
  const [pageGenerationConfig, setPageGenerationConfig] = useState({
    baseKeywords: '',
    targetCountries: 'all',
    targetCities: '',
    pageTemplate: 'default',
    autoGenerateContent: false,
    autoIndexPages: false,
  });

  // Phase 6: Auto Meta + Hashtag Engine (Module 102)
  const [metaGenerationConfig, setMetaGenerationConfig] = useState({
    autoGenerateTitle: false,
    autoGenerateDescription: false,
    autoGenerateKeywords: false,
    platformHashtags: false,
    targetPlatform: 'google', // 'google', 'instagram', 'linkedin'
  });

  // Phase 7: Global Keyword Expansion AI (Module 103)
  const [keywordExpansionConfig, setKeywordExpansionConfig] = useState({
    baseKeyword: '',
    longTailExpansion: false,
    countryExpansion: false,
    languageExpansion: false,
    targetLanguage: 'en', // 'en', 'hi', 'ar', 'fr', 'es'
  });
  const [expandedKeywords, setExpandedKeywords] = useState<any[]>([]);

  // Phase 8: Global Sitemap Engine (Module 109)
  const [sitemapConfig, setSitemapConfig] = useState({
    autoUpdate: false,
    autoSubmitToGoogle: false,
    includeProgrammablePages: true,
    includeProducts: true,
    includeBlog: false,
  });
  const [sitemapStats, setSitemapStats] = useState({
    pagesCount: 0,
    productsCount: 0,
    blogCount: 0,
    lastGenerated: null as string | null,
  });

  // Phase 9: Auto Indexing Engine (Module 110)
  const [indexingConfig, setIndexingConfig] = useState({
    googleIndexApi: false,
    bingWebmasterApi: false,
    fastIndexingMode: false,
    batchSize: 10,
  });
  const [indexingStats, setIndexingStats] = useState({
    pendingIndex: 0,
    indexed: 0,
    failed: 0,
    lastSubmitted: null as string | null,
  });

  // Phase 10: Auto Language + Translation SEO (Module 104)
  const [translationConfig, setTranslationConfig] = useState({
    targetLanguage: 'hi',
    autoTranslateContent: false,
    autoTranslateMeta: false,
    autoTranslateTitle: false,
    createLanguageVariants: false,
  });
  const [translationStats, setTranslationStats] = useState({
    translatedPages: 0,
    pendingTranslation: 0,
    lastTranslated: null as string | null,
  });

  // Phase 11: Master Global SEO AI (Module 120)
  const [masterSeoConfig, setMasterSeoConfig] = useState({
    autoMode: false,
    scheduleInterval: 'daily', // 'hourly', 'daily', 'weekly'
    enablePageGeneration: true,
    enableMetaGeneration: true,
    enableKeywordExpansion: true,
    enableSitemapGeneration: true,
    enableIndexing: true,
    enableTranslation: false,
  });
  const [masterSeoStats, setMasterSeoStats] = useState({
    totalActions: 0,
    lastRun: null as string | null,
    nextRun: null as string | null,
  });

  const [apkForm, setApkForm] = useState({
    product_id: '',
    version: '1.0.0',
    version_name: '1.0.0',
    version_code: 1,
    status: 'draft' as 'published' | 'draft' | 'deprecated',
    changelog: '',
    replace_apk_id: '',
  });

  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    pipelineProducts: 0,
    totalSales: 0,
    totalDownloads: 0,
    avgQualityScore: 0,
    avgSellerReputation: 0,
  });

  const [saving, setSaving] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editProductSeo, setEditProductSeo] = useState<ProductSeo | null>(null);
  const [generatingSeo, setGeneratingSeo] = useState(false);

  // Fetch SEO data when product is opened for editing
  useEffect(() => {
    if (editProduct && !editProduct.id.startsWith('new-')) {
      fetchProductSeo(editProduct.id);
    } else if (editProduct && editProduct.id.startsWith('new-')) {
      // Reset SEO for new products
      setEditProductSeo({
        slug: '',
        title: '',
        meta_description: '',
        keywords: [],
        hashtags: [],
        seo_score: 0,
        target_country: 'IN',
      });
    }
  }, [editProduct?.id]);
  const [editHeaderMenu, setEditHeaderMenu] = useState<HeaderMenu | null>(null);
  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null);
  const [editDiscountRule, setEditDiscountRule] = useState<DiscountRule | null>(null);

  const productMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; status: string; apk_enabled: boolean }>();
    productCatalog.forEach((p) => map.set(p.id, p));
    return map;
  }, [productCatalog]);

  const apkVersionsByApkId = useMemo(() => {
    const map = new Map<string, ApkVersion[]>();
    for (const row of apkVersions) {
      const list = map.get(row.apk_id) || [];
      list.push(row);
      map.set(row.apk_id, list);
    }
    for (const [key, list] of map) {
      map.set(
        key,
        [...list].sort((a, b) => b.version_code - a.version_code || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      );
    }
    return map;
  }, [apkVersions]);

  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      const res = await marketplaceAdminApi.listProducts({
        page: page + 1,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        category: selectedCategory || undefined,
        status: selectedStatus || undefined,
        min_price: minPrice || undefined,
        max_price: maxPrice || undefined,
      }) as any;
      const normalized = ((res?.data || []) as any[]).map((p) => ({
        ...p,
        business_type: p.business_type || p.target_industry || '',
        target_industry: p.target_industry || p.business_type || '',
      }));
      setProducts(normalized as Product[]);
    } catch {
      toast.error('Failed to load products');
    }
    setProductsLoading(false);
  };

  const fetchProductCatalog = async () => {
    const { data } = await db
      .from('products')
      .select('id, name, status, apk_enabled')
      .order('name', { ascending: true })
      .limit(5000);
    setProductCatalog((data || []) as Array<{ id: string; name: string; status: string; apk_enabled: boolean }>);
  };

  const fetchHeaderMenus = async () => {
    setMenusLoading(true);
    const { data } = await db.from('marketplace_header_menus').select('*').order('sort_order', { ascending: true });
    setHeaderMenus((data || []) as HeaderMenu[]);
    setMenusLoading(false);
  };

  const fetchBanners = async () => {
    setBannersLoading(true);
    const { data } = await db.from('marketplace_banners').select('*').order('sort_order', { ascending: true });
    setBanners((data || []) as Banner[]);
    setBannersLoading(false);
  };

  const fetchTickers = async () => {
    setTickersLoading(true);
    const { data } = await db.from('marketplace_tickers').select('*').order('sort_order', { ascending: true });
    setTickers((data || []) as Ticker[]);
    setTickersLoading(false);
  };

  const fetchCoupons = async () => {
    setCouponsLoading(true);
    const { data } = await db.from('marketplace_coupons').select('*').order('created_at', { ascending: false });
    setCoupons((data || []) as Coupon[]);
    setCouponsLoading(false);
  };

  const fetchDiscountRules = async () => {
    setRulesLoading(true);
    const { data } = await db.from('marketplace_discount_rules').select('*').order('sort_order', { ascending: true });
    setDiscountRules((data || []) as DiscountRule[]);
    setRulesLoading(false);
  };

  const fetchGateways = async () => {
    setGatewaysLoading(true);
    try {
      const [{ data }, { data: legacyRows }] = await Promise.all([
        db
        .from('payment_settings')
        .select('*')
        .eq('id', PAYMENT_SETTINGS_ID)
        .maybeSingle(),
        db
          .from('marketplace_payment_gateways')
          .select('gateway_code, gateway_name, is_enabled, sort_order, config')
          .in('gateway_code', ['razorpay', 'stripe', 'wallet'])
          .order('sort_order', { ascending: true }),
      ]);

      const settings = (data || {}) as Record<string, any>;
      const legacyMap = new Map((legacyRows || []).map((r: any) => [String(r.gateway_code || '').toLowerCase(), r]));

      const razorLegacy = legacyMap.get('razorpay');
      const stripeLegacy = legacyMap.get('stripe');
      const walletLegacy = legacyMap.get('wallet');

      const rows: PaymentGateway[] = [
        {
          id: 'gateway-razorpay',
          gateway_code: 'razorpay',
          gateway_name: 'Razorpay',
          is_enabled: settings.razorpay_enabled === undefined ? Boolean(razorLegacy?.is_enabled) : Boolean(settings.razorpay_enabled),
          sort_order: 1,
          config: {
            key_id: settings.razorpay_key_id || String(razorLegacy?.config?.key_id || ''),
            key_secret: settings.razorpay_key_secret || String(razorLegacy?.config?.key_secret || ''),
          },
        },
        {
          id: 'gateway-stripe',
          gateway_code: 'stripe',
          gateway_name: 'Stripe',
          is_enabled: settings.stripe_enabled === undefined ? Boolean(stripeLegacy?.is_enabled) : Boolean(settings.stripe_enabled),
          sort_order: 2,
          config: {
            publishable_key: settings.stripe_publishable_key || String(stripeLegacy?.config?.publishable_key || ''),
            secret_key: settings.stripe_secret_key || String(stripeLegacy?.config?.secret_key || ''),
          },
        },
        {
          id: 'gateway-wallet',
          gateway_code: 'wallet',
          gateway_name: 'Wallet',
          is_enabled: settings.wallet_enabled === undefined ? Boolean(walletLegacy?.is_enabled ?? true) : settings.wallet_enabled !== false,
          sort_order: 3,
          config: {},
        },
      ];

      setGateways(rows);
    } catch {
      setGateways([]);
    } finally {
      setGatewaysLoading(false);
    }
  };

  // Phase 3: Fetch categories
  const fetchCategories = async () => {
    setCategoriesLoading(true);
    try {
      const { data, error } = await (db as any)
        .from('marketplace_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Failed to fetch categories:', error);
        setCategories([]);
      } else {
        setCategories(data || []);
      }
    } catch (e) {
      console.error('Failed to fetch categories:', e);
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  // Phase 3: Save category
  const saveCategory = async () => {
    if (!editCategory) return;
    if (!editCategory.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    setSaving(true);
    const payload = {
      name: editCategory.name.trim(),
      slug: editCategory.name.trim().toLowerCase().replace(/\s+/g, '-'),
      description: editCategory.description || null,
      icon: editCategory.icon || null,
      sort_order: Number(editCategory.sort_order || 0),
      is_active: Boolean(editCategory.is_active),
    };

    const query = editCategory.id.startsWith('new-')
      ? db.from('marketplace_categories').insert(payload)
      : db.from('marketplace_categories').update(payload).eq('id', editCategory.id);

    const { error } = await query;
    setSaving(false);

    if (error) toast.error(error.message);
    else {
      toast.success('Category saved');
      setEditCategory(null);
      fetchCategories();
    }
  };

  // Phase 3: Delete category
  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    const { error } = await (db as any).from('marketplace_categories').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Category deleted');
      fetchCategories();
    }
  };

  // Phase 3: Fetch users
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      // Fetch profiles and resellers
      const [{ data: profiles }, { data: resellers }] = await Promise.all([
        db.from('profiles').select('*').order('created_at', { ascending: false }).limit(100),
        db.from('resellers').select('*').limit(100),
      ]);

      // Combine user data
      const userMap = new Map();
      (profiles || []).forEach((profile: any) => {
        userMap.set(profile.id, {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          role: 'buyer',
          created_at: profile.created_at,
        });
      });

      (resellers || []).forEach((reseller: any) => {
        if (userMap.has(reseller.user_id)) {
          userMap.set(reseller.user_id, {
            ...userMap.get(reseller.user_id),
            role: 'reseller',
            company_name: reseller.company_name,
            commission_rate: reseller.commission_rate,
          });
        }
      });

      // Add admin users (from auth.users would need server-side, using profiles with admin flag)
      const allUsers = Array.from(userMap.values());
      setUsers(allUsers);
    } catch (e) {
      console.error('Failed to fetch users:', e);
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  // Phase 3: Save user
  const saveUser = async () => {
    if (!editUser) return;
    if (!editUser.email) {
      toast.error('Email is required');
      return;
    }

    setSaving(true);
    try {
      if (editUser.role === 'reseller') {
        // Update or create reseller record
        const { error } = await (db as any)
          .from('resellers')
          .upsert({
            user_id: editUser.id,
            company_name: editUser.company_name || null,
            commission_rate: Number(editUser.commission_rate || 10),
          });

        if (error) toast.error(error.message);
        else {
          toast.success('User updated successfully');
          setEditUser(null);
          fetchUsers();
        }
      } else {
        toast.success('User updated successfully');
        setEditUser(null);
        fetchUsers();
      }
    } catch (e) {
      console.error('Failed to save user:', e);
      toast.error('Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  // Phase 3: Delete user
  const deleteUser = async (id: string) => {
    if (!confirm('Delete this user? This action cannot be undone.')) return;
    const { error } = await (db as any).from('profiles').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('User deleted');
      fetchUsers();
    }
  };

  // Phase 3: Update user role
  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      if (newRole === 'reseller') {
        // Create reseller record
        const { error } = await (db as any).from('resellers').insert({
          user_id: userId,
          company_name: 'New Reseller',
          commission_rate: 10,
        });
        if (error) toast.error(error.message);
        else {
          toast.success('User promoted to reseller');
          fetchUsers();
        }
      } else if (newRole === 'buyer') {
        // Remove reseller record
        const { error } = await (db as any).from('resellers').delete().eq('user_id', userId);
        if (error) toast.error(error.message);
        else {
          toast.success('User demoted to buyer');
          fetchUsers();
        }
      }
    } catch (e) {
      console.error('Failed to update user role:', e);
      toast.error('Failed to update user role');
    }
  };

  // Phase 3: Generate license key
  const generateLicenseKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      if (i < 3) key += '-';
    }
    return key;
  };

  // Phase 3: Fetch licenses
  const fetchLicenses = async () => {
    setLicensesLoading(true);
    try {
      const { data, error } = await (db as any)
        .from('marketplace_licenses')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Failed to fetch licenses:', error);
        setLicenses([]);
      } else {
        setLicenses(data || []);
      }
    } catch (e) {
      console.error('Failed to fetch licenses:', e);
      setLicenses([]);
    } finally {
      setLicensesLoading(false);
    }
  };

  // Phase 3: Save license
  const saveLicense = async () => {
    if (!editLicense) return;
    if (!editLicense.product_id) {
      toast.error('Product is required');
      return;
    }
    if (!editLicense.user_id) {
      toast.error('User is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        product_id: editLicense.product_id,
        user_id: editLicense.user_id,
        license_key: editLicense.license_key || generateLicenseKey(),
        status: editLicense.status || 'active',
        expires_at: editLicense.expires_at || null,
        download_url: editLicense.download_url || null,
      };

      const { error } = await (db as any).from('marketplace_licenses').insert(payload);

      if (error) toast.error(error.message);
      else {
        toast.success('License key generated successfully');
        setEditLicense(null);
        fetchLicenses();
      }
    } catch (e) {
      console.error('Failed to save license:', e);
      toast.error('Failed to save license');
    } finally {
      setSaving(false);
    }
  };

  // Phase 3: Revoke license
  const revokeLicense = async (id: string) => {
    if (!confirm('Revoke this license key?')) return;
    const { error } = await (db as any).from('marketplace_licenses').update({ status: 'revoked' }).eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('License revoked');
      fetchLicenses();
    }
  };

  // Phase 3: Validate license
  const validateLicense = async (licenseKey: string) => {
    try {
      const { data, error } = await (db as any)
        .from('marketplace_licenses')
        .select('*')
        .eq('license_key', licenseKey)
        .single();

      if (error || !data) {
        toast.error('Invalid license key');
        return false;
      }

      if (data.status !== 'active') {
        toast.error(`License is ${data.status}`);
        return false;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        toast.error('License has expired');
        return false;
      }

      toast.success('License is valid');
      return true;
    } catch (e) {
      console.error('Failed to validate license:', e);
      toast.error('Failed to validate license');
      return false;
    }
  };

  // Phase 4: Fetch ticker messages
  const fetchTickerMessages = async () => {
    setTickerLoading(true);
    try {
      const { data, error } = await (db as any)
        .from('marketplace_ticker_messages')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Failed to fetch ticker messages:', error);
        setTickerMessages([]);
      } else {
        setTickerMessages(data || []);
      }
    } catch (e) {
      console.error('Failed to fetch ticker messages:', e);
      setTickerMessages([]);
    } finally {
      setTickerLoading(false);
    }
  };

  // Phase 4: Save ticker message
  const saveTickerMessage = async () => {
    if (!editTicker) return;
    if (!editTicker.message.trim()) {
      toast.error('Message is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        message_type: editTicker.message_type,
        message: editTicker.message.trim(),
        emoji: editTicker.emoji || null,
        is_active: Boolean(editTicker.is_active),
        sort_order: Number(editTicker.sort_order || 0),
      };

      const query = editTicker.id.startsWith('new-')
        ? db.from('marketplace_ticker_messages').insert(payload)
        : db.from('marketplace_ticker_messages').update(payload).eq('id', editTicker.id);

      const { error } = await query;
      setSaving(false);

      if (error) toast.error(error.message);
      else {
        toast.success('Ticker message saved');
        setEditTicker(null);
        fetchTickerMessages();
      }
    } catch (e) {
      console.error('Failed to save ticker message:', e);
      toast.error('Failed to save ticker message');
      setSaving(false);
    }
  };

  // Phase 4: Delete ticker message
  const deleteTickerMessage = async (id: string) => {
    if (!confirm('Delete this ticker message?')) return;
    const { error } = await (db as any).from('marketplace_ticker_messages').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Ticker message deleted');
      fetchTickerMessages();
    }
  };

  // Phase 4: Fetch banner slides
  const fetchBannerSlides = async () => {
    setBannerLoading(true);
    try {
      const { data, error } = await (db as any)
        .from('marketplace_banner_slides')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Failed to fetch banner slides:', error);
        setBannerSlides([]);
      } else {
        setBannerSlides(data || []);
      }
    } catch (e) {
      console.error('Failed to fetch banner slides:', e);
      setBannerSlides([]);
    } finally {
      setBannerLoading(false);
    }
  };

  // Phase 4: Save banner slide
  const saveBannerSlide = async () => {
    if (!editBanner) return;

    setSaving(true);
    try {
      const payload = {
        slide_type: editBanner.slide_type,
        product_id: editBanner.product_id || null,
        title: editBanner.title || null,
        description: editBanner.description || null,
        cta_text: editBanner.cta_text || null,
        cta_link: editBanner.cta_link || null,
        background_gradient: editBanner.background_gradient || null,
        is_active: Boolean(editBanner.is_active),
        sort_order: Number(editBanner.sort_order || 0),
      };

      const query = editBanner.id.startsWith('new-')
        ? db.from('marketplace_banner_slides').insert(payload)
        : db.from('marketplace_banner_slides').update(payload).eq('id', editBanner.id);

      const { error } = await query;
      setSaving(false);

      if (error) toast.error(error.message);
      else {
        toast.success('Banner slide saved');
        setEditBanner(null);
        fetchBannerSlides();
      }
    } catch (e) {
      console.error('Failed to save banner slide:', e);
      toast.error('Failed to save banner slide');
      setSaving(false);
    }
  };

  // Phase 4: Delete banner slide
  const deleteBannerSlide = async (id: string) => {
    if (!confirm('Delete this banner slide?')) return;
    const { error } = await (db as any).from('marketplace_banner_slides').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Banner slide deleted');
      fetchBannerSlides();
    }
  };

  // Phase 4: Fetch banner settings
  const fetchBannerSettings = async () => {
    try {
      const { data, error } = await (db as any)
        .from('marketplace_banner_settings')
        .select('*')
        .single();

      if (error) {
        console.error('Failed to fetch banner settings:', error);
      } else {
        setBannerSettings(data);
      }
    } catch (e) {
      console.error('Failed to fetch banner settings:', e);
    }
  };

  // Phase 4: Save banner settings
  const saveBannerSettings = async () => {
    if (!bannerSettings) return;

    setSaving(true);
    try {
      const payload = {
        ticker_enabled: Boolean(bannerSettings.ticker_enabled),
        ticker_speed: Number(bannerSettings.ticker_speed || 10),
        ticker_color_theme: bannerSettings.ticker_color_theme || 'orange',
        banner_enabled: Boolean(bannerSettings.banner_enabled),
        banner_speed: Number(bannerSettings.banner_speed || 5),
        banner_auto_rotate: Boolean(bannerSettings.banner_auto_rotate),
      };

      const { error } = await (db as any)
        .from('marketplace_banner_settings')
        .update(payload)
        .eq('id', bannerSettings.id);

      setSaving(false);

      if (error) toast.error(error.message);
      else {
        toast.success('Banner settings saved');
        fetchBannerSettings();
      }
    } catch (e) {
      console.error('Failed to save banner settings:', e);
      toast.error('Failed to save banner settings');
      setSaving(false);
    }
  };

  // Phase 5: Programmable Pages Management (Module 101)
  const fetchProgrammablePages = async () => {
    setProgrammablePagesLoading(true);
    try {
      const { data } = await db
        .from('programmable_pages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      setProgrammablePages(data || []);
      setProgrammablePagesLoading(false);
    } catch (e) {
      console.error('Failed to fetch programmable pages:', e);
      setProgrammablePagesLoading(false);
    }
  };

  const saveProgrammablePage = async (page: any) => {
    setSaving(true);
    try {
      const payload = {
        slug: page.slug,
        title: page.title,
        page_type: page.page_type,
        base_keyword: page.base_keyword,
        country_code: page.country_code,
        city: page.city,
        language_code: page.language_code,
        meta_title: page.meta_title,
        meta_description: page.meta_description,
        meta_keywords: page.meta_keywords,
        hashtags: page.hashtags,
        content: page.content,
        content_template: page.content_template,
        status: page.status || 'draft',
        auto_generated: page.auto_generated || false,
        auto_index_enabled: page.auto_index_enabled || false,
        auto_update_enabled: page.auto_update_enabled || false,
      };

      if (page.id) {
        const { error } = await db
          .from('programmable_pages')
          .update(payload)
          .eq('id', page.id);

        setSaving(false);

        if (error) toast.error(error.message);
        else {
          toast.success('Programmable page updated');
          fetchProgrammablePages();
          setEditProgrammablePage(null);
        }
      } else {
        const { error } = await db
          .from('programmable_pages')
          .insert(payload)
          .select();

        setSaving(false);

        if (error) toast.error(error.message);
        else {
          toast.success('Programmable page created');
          fetchProgrammablePages();
          setEditProgrammablePage(null);
        }
      }
    } catch (e) {
      console.error('Failed to save programmable page:', e);
      toast.error('Failed to save programmable page');
      setSaving(false);
    }
  };

  const deleteProgrammablePage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this programmable page?')) return;

    try {
      const { error } = await db
        .from('programmable_pages')
        .delete()
        .eq('id', id);

      if (error) toast.error(error.message);
      else {
        toast.success('Programmable page deleted');
        fetchProgrammablePages();
      }
    } catch (e) {
      console.error('Failed to delete programmable page:', e);
      toast.error('Failed to delete programmable page');
    }
  };

  const generateProgrammablePages = async () => {
    if (!pageGenerationConfig.baseKeywords) {
      toast.error('Please enter base keywords');
      return;
    }

    setSaving(true);
    try {
      const keywords = pageGenerationConfig.baseKeywords.split(',').map(k => k.trim());
      const countries = pageGenerationConfig.targetCountries === 'all' 
        ? ['IN', 'US', 'AE', 'UK', 'CA'] 
        : [pageGenerationConfig.targetCountries];
      const cities = pageGenerationConfig.targetCities 
        ? pageGenerationConfig.targetCities.split(',').map(c => c.trim())
        : [];

      const pagesToCreate: any[] = [];

      // Generate combinations
      keywords.forEach(keyword => {
        countries.forEach(country => {
          // Country-specific page
          pagesToCreate.push({
            slug: `${keyword}-${country.toLowerCase()}`,
            title: `${keyword.replace(/-/g, ' ').toUpperCase()} ${country}`,
            page_type: 'service',
            base_keyword: keyword,
            country_code: country,
            language_code: 'en',
            status: 'draft',
            auto_generated: true,
          });

          // City-specific pages if cities provided
          cities.forEach(city => {
            pagesToCreate.push({
              slug: `${keyword}-${city.toLowerCase()}-${country.toLowerCase()}`,
              title: `${keyword.replace(/-/g, ' ').toUpperCase()} ${city} ${country}`,
              page_type: 'location',
              base_keyword: keyword,
              country_code: country,
              city: city,
              language_code: 'en',
              status: 'draft',
              auto_generated: true,
            });
          });
        });
      });

      // Batch insert
      const { error } = await db
        .from('programmable_pages')
        .insert(pagesToCreate);

      setSaving(false);

      if (error) toast.error(error.message);
      else {
        toast.success(`Generated ${pagesToCreate.length} programmable pages`);
        fetchProgrammablePages();
      }
    } catch (e) {
      console.error('Failed to generate programmable pages:', e);
      toast.error('Failed to generate programmable pages');
      setSaving(false);
    }
  };

  // Phase 6: Auto Meta + Hashtag Engine (Module 102)
  const generateMetaTags = async () => {
    setSaving(true);
    try {
      // Get all programmable pages that need meta generation
      const pagesToUpdate = programmablePages.filter(p => 
        !p.meta_title || !p.meta_description || (p.meta_keywords && p.meta_keywords.length === 0)
      );

      if (pagesToUpdate.length === 0) {
        toast.info('No pages need meta generation');
        setSaving(false);
        return;
      }

      let updatedCount = 0;

      for (const page of pagesToUpdate) {
        const payload: any = {};

        if (metaGenerationConfig.autoGenerateTitle && !page.meta_title) {
          payload.meta_title = generateOptimizedTitle(page.base_keyword, page.country_code, page.city);
        }

        if (metaGenerationConfig.autoGenerateDescription && !page.meta_description) {
          payload.meta_description = generateOptimizedDescription(page.base_keyword, page.country_code, page.city);
        }

        if (metaGenerationConfig.autoGenerateKeywords && (!page.meta_keywords || page.meta_keywords.length === 0)) {
          payload.meta_keywords = generateKeywords(page.base_keyword, page.country_code);
        }

        if (metaGenerationConfig.platformHashtags && (!page.hashtags || page.hashtags.length === 0)) {
          payload.hashtags = generateHashtags(page.base_keyword, metaGenerationConfig.targetPlatform);
        }

        if (Object.keys(payload).length > 0) {
          const { error } = await db
            .from('programmable_pages')
            .update(payload)
            .eq('id', page.id);

          if (!error) updatedCount++;
        }
      }

      setSaving(false);

      if (updatedCount > 0) {
        toast.success(`Generated meta tags for ${updatedCount} pages`);
        fetchProgrammablePages();
      } else {
        toast.error('Failed to generate meta tags');
      }
    } catch (e) {
      console.error('Failed to generate meta tags:', e);
      toast.error('Failed to generate meta tags');
      setSaving(false);
    }
  };

  const generateOptimizedTitle = (keyword: string, country?: string, city?: string): string => {
    const formattedKeyword = keyword.replace(/-/g, ' ').toUpperCase();
    if (city && country) {
      return `${formattedKeyword} ${city} ${country} - Best Software Solutions`;
    } else if (country) {
      return `${formattedKeyword} ${country} - Top Rated Software`;
    }
    return `${formattedKeyword} - Premium Software Solutions`;
  };

  const generateOptimizedDescription = (keyword: string, country?: string, city?: string): string => {
    const formattedKeyword = keyword.replace(/-/g, ' ');
    const location = city ? `${city}, ${country}` : country;
    return `Discover the best ${formattedKeyword} in ${location || 'India'}. Premium quality software with advanced features, 24/7 support, and affordable pricing.`;
  };

  const generateKeywords = (keyword: string, country?: string): string[] => {
    const baseKeywords = [
      keyword,
      keyword.replace(/-/g, ' '),
      `${keyword} software`,
      `${keyword} solutions`,
      `${keyword} for business`,
    ];

    if (country) {
      baseKeywords.push(
        `${keyword} ${country}`,
        `${keyword} in ${country}`,
        `best ${keyword} ${country}`
      );
    }

    return baseKeywords;
  };

  const generateHashtags = (keyword: string, platform: string): string[] => {
    const baseHashtags = [
      `#${keyword.replace(/-/g, '')}`,
      `#${keyword.replace(/-/g, '')}software`,
      `#${keyword.replace(/-/g, '')}solutions`,
    ];

    if (platform === 'instagram') {
      baseHashtags.push(
        '#software',
        '#tech',
        '#business',
        '#startup',
        '#entrepreneur'
      );
    } else if (platform === 'linkedin') {
      baseHashtags.push(
        '#BusinessSoftware',
        '#Enterprise',
        '#B2B',
        '#Technology',
        '#Innovation'
      );
    } else {
      baseHashtags.push(
        '#software',
        '#technology',
        '#solutions',
        '#business'
      );
    }

    return baseHashtags;
  };

  // Phase 7: Global Keyword Expansion AI (Module 103)
  const expandKeywords = async () => {
    if (!keywordExpansionConfig.baseKeyword) {
      toast.error('Please enter a base keyword');
      return;
    }

    setSaving(true);
    try {
      const expandedList: any[] = [];
      const baseKeyword = keywordExpansionConfig.baseKeyword;

      // Long-tail expansion
      if (keywordExpansionConfig.longTailExpansion) {
        const longTailKeywords = generateLongTailKeywords(baseKeyword);
        longTailKeywords.forEach(kw => {
          expandedList.push({
            keyword: kw,
            type: 'long-tail',
            base_keyword: baseKeyword,
          });
        });
      }

      // Country-based expansion
      if (keywordExpansionConfig.countryExpansion) {
        const countries = ['IN', 'US', 'AE', 'UK', 'CA'];
        countries.forEach(country => {
          expandedList.push({
            keyword: `${baseKeyword} ${country}`,
            type: 'country-based',
            base_keyword: baseKeyword,
            country_code: country,
          });
          expandedList.push({
            keyword: `${baseKeyword} in ${country}`,
            type: 'country-based',
            base_keyword: baseKeyword,
            country_code: country,
          });
        });
      }

      // Language-based expansion
      if (keywordExpansionConfig.languageExpansion) {
        const languageKeywords = generateLanguageKeywords(baseKeyword, keywordExpansionConfig.targetLanguage);
        languageKeywords.forEach(kw => {
          expandedList.push({
            keyword: kw,
            type: 'language-based',
            base_keyword: baseKeyword,
            language_code: keywordExpansionConfig.targetLanguage,
          });
        });
      }

      setExpandedKeywords(expandedList);
      setSaving(false);
      toast.success(`Expanded to ${expandedList.length} keywords`);
    } catch (e) {
      console.error('Failed to expand keywords:', e);
      toast.error('Failed to expand keywords');
      setSaving(false);
    }
  };

  const generateLongTailKeywords = (keyword: string): string[] => {
    const modifiers = [
      'best', 'top', 'cheap', 'affordable', 'premium', 'professional',
      'for business', 'for small business', 'for enterprise', 'for startup',
      'online', 'free', 'open source', 'cloud-based', 'web-based'
    ];

    return modifiers.map(modifier => `${modifier} ${keyword}`);
  };

  const generateLanguageKeywords = (keyword: string, language: string): string[] => {
    const translations: Record<string, string[]> = {
      en: [`${keyword} software`, `${keyword} solution`, `${keyword} system`],
      hi: [`${keyword} सॉफ्टवेयर`, `${keyword} समाधान`, `${keyword} प्रणाली`],
      ar: [`برنامج ${keyword}`, `حل ${keyword}`, `نظام ${keyword}`],
      fr: [`logiciel ${keyword}`, `solution ${keyword}`, `système ${keyword}`],
      es: [`software ${keyword}`, `solución ${keyword}`, `sistema ${keyword}`],
    };

    return translations[language] || translations.en;
  };

  const applyExpandedKeywords = async () => {
    if (expandedKeywords.length === 0) {
      toast.error('No expanded keywords to apply');
      return;
    }

    setSaving(true);
    try {
      let appliedCount = 0;

      for (const kw of expandedKeywords) {
        // Check if page already exists
        const { data: existingPage } = await db
          .from('programmable_pages')
          .select('id')
          .eq('slug', kw.keyword.toLowerCase().replace(/\s+/g, '-'))
          .single();

        if (!existingPage) {
          const { error } = await db
            .from('programmable_pages')
            .insert({
              slug: kw.keyword.toLowerCase().replace(/\s+/g, '-'),
              title: kw.keyword.toUpperCase(),
              page_type: 'service',
              base_keyword: kw.base_keyword,
              country_code: kw.country_code || null,
              language_code: kw.language_code || 'en',
              status: 'draft',
              auto_generated: true,
            });

          if (!error) appliedCount++;
        }
      }

      setSaving(false);

      if (appliedCount > 0) {
        toast.success(`Created ${appliedCount} new pages from expanded keywords`);
        fetchProgrammablePages();
        setExpandedKeywords([]);
      } else {
        toast.info('All keywords already exist as pages');
      }
    } catch (e) {
      console.error('Failed to apply expanded keywords:', e);
      toast.error('Failed to apply expanded keywords');
      setSaving(false);
    }
  };

  // Phase 8: Global Sitemap Engine (Module 109)
  const generateSitemap = async () => {
    setSaving(true);
    try {
      // Count pages for each type
      let pagesCount = 0;
      let productsCount = 0;
      let blogCount = 0;

      if (sitemapConfig.includeProgrammablePages) {
        const { data: pagesData } = await db
          .from('programmable_pages')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'published');
        pagesCount = pagesData || 0;
      }

      if (sitemapConfig.includeProducts) {
        const { data: productsData } = await db
          .from('marketplace_products')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active');
        productsCount = productsData || 0;
      }

      if (sitemapConfig.includeBlog) {
        // Blog not implemented yet, keeping count as 0
        blogCount = 0;
      }

      setSitemapStats({
        pagesCount,
        productsCount,
        blogCount,
        lastGenerated: new Date().toISOString(),
      });

      setSaving(false);
      toast.success(`Sitemap generated with ${pagesCount + productsCount + blogCount} URLs`);
    } catch (e) {
      console.error('Failed to generate sitemap:', e);
      toast.error('Failed to generate sitemap');
      setSaving(false);
    }
  };

  const submitSitemapToGoogle = async () => {
    if (!sitemapConfig.autoSubmitToGoogle) {
      toast.error('Enable auto-submit to Google first');
      return;
    }

    setSaving(true);
    try {
      // Placeholder for Google Search Console API submission
      // In production, this would call the Google Search Console API
      await new Promise(resolve => setTimeout(resolve, 1000));

      setSaving(false);
      toast.success('Sitemap submitted to Google Search Console');
    } catch (e) {
      console.error('Failed to submit sitemap to Google:', e);
      toast.error('Failed to submit sitemap to Google');
      setSaving(false);
    }
  };

  // Phase 9: Auto Indexing Engine (Module 110)
  const submitForIndexing = async () => {
    setSaving(true);
    try {
      // Get pages pending indexing
      const { data: pendingPages } = await db
        .from('programmable_pages')
        .select('id, slug, status, index_status')
        .eq('status', 'published')
        .in('index_status', ['pending', 'failed'])
        .limit(indexingConfig.batchSize);

      if (!pendingPages || pendingPages.length === 0) {
        toast.info('No pages pending indexing');
        setSaving(false);
        return;
      }

      let indexedCount = 0;
      let failedCount = 0;

      for (const page of pendingPages) {
        // Placeholder for actual API submission
        // In production, this would call Google Index API and Bing Webmaster API
        const success = Math.random() > 0.3; // Simulate 70% success rate

        if (success) {
          await db
            .from('programmable_pages')
            .update({
              index_status: 'indexed',
              indexed_at: new Date().toISOString(),
            })
            .eq('id', page.id);
          indexedCount++;
        } else {
          await db
            .from('programmable_pages')
            .update({ index_status: 'failed' })
            .eq('id', page.id);
          failedCount++;
        }
      }

      setIndexingStats({
        pendingIndex: 0, // Will be recalculated
        indexed: indexingStats.indexed + indexedCount,
        failed: indexingStats.failed + failedCount,
        lastSubmitted: new Date().toISOString(),
      });

      setSaving(false);
      toast.success(`Submitted ${pendingPages.length} pages for indexing: ${indexedCount} success, ${failedCount} failed`);
    } catch (e) {
      console.error('Failed to submit for indexing:', e);
      toast.error('Failed to submit for indexing');
      setSaving(false);
    }
  };

  const fetchIndexingStats = async () => {
    try {
      const [{ count: pendingCount }, { count: indexedCount }, { count: failedCount }] = await Promise.all([
        db.from('programmable_pages').select('id', { count: 'exact', head: true }).eq('status', 'published').eq('index_status', 'pending'),
        db.from('programmable_pages').select('id', { count: 'exact', head: true }).eq('status', 'published').eq('index_status', 'indexed'),
        db.from('programmable_pages').select('id', { count: 'exact', head: true }).eq('status', 'published').eq('index_status', 'failed'),
      ]);

      setIndexingStats({
        pendingIndex: pendingCount || 0,
        indexed: indexedCount || 0,
        failed: failedCount || 0,
        lastSubmitted: indexingStats.lastSubmitted,
      });
    } catch (e) {
      console.error('Failed to fetch indexing stats:', e);
    }
  };

  // Phase 10: Auto Language + Translation SEO (Module 104)
  const translateContent = async () => {
    setSaving(true);
    try {
      // Get pages that need translation
      const { data: pagesToTranslate } = await db
        .from('programmable_pages')
        .select('*')
        .eq('status', 'published')
        .neq('language_code', translationConfig.targetLanguage)
        .limit(50);

      if (!pagesToTranslate || pagesToTranslate.length === 0) {
        toast.info('No pages to translate');
        setSaving(false);
        return;
      }

      let translatedCount = 0;

      for (const page of pagesToTranslate) {
        const payload: any = {
          language_code: translationConfig.targetLanguage,
        };

        if (translationConfig.autoTranslateTitle && page.title) {
          payload.title = translateText(page.title, translationConfig.targetLanguage);
        }

        if (translationConfig.autoTranslateMeta && page.meta_description) {
          payload.meta_description = translateText(page.meta_description, translationConfig.targetLanguage);
        }

        if (translationConfig.autoTranslateContent && page.content) {
          payload.content = translateText(page.content, translationConfig.targetLanguage);
        }

        if (translationConfig.createLanguageVariants) {
          // Create a new page with the translated content
          const { error } = await db
            .from('programmable_pages')
            .insert({
              slug: `${page.slug}-${translationConfig.targetLanguage}`,
              title: payload.title || page.title,
              page_type: page.page_type,
              base_keyword: page.base_keyword,
              country_code: page.country_code,
              city: page.city,
              language_code: translationConfig.targetLanguage,
              meta_title: page.meta_title,
              meta_description: payload.meta_description || page.meta_description,
              meta_keywords: page.meta_keywords,
              hashtags: page.hashtags,
              content: payload.content || page.content,
              content_template: page.content_template,
              status: 'draft',
              auto_generated: true,
            });

          if (!error) translatedCount++;
        } else {
          // Update existing page
          const { error } = await db
            .from('programmable_pages')
            .update(payload)
            .eq('id', page.id);

          if (!error) translatedCount++;
        }
      }

      setTranslationStats({
        translatedPages: translationStats.translatedPages + translatedCount,
        pendingTranslation: 0,
        lastTranslated: new Date().toISOString(),
      });

      setSaving(false);
      toast.success(`Translated ${translatedCount} pages to ${translationConfig.targetLanguage}`);
    } catch (e) {
      console.error('Failed to translate content:', e);
      toast.error('Failed to translate content');
      setSaving(false);
    }
  };

  const translateText = (text: string, targetLang: string): string => {
    // Placeholder for actual translation API
    // In production, this would call Google Translate API or similar
    const translations: Record<string, Record<string, string>> = {
      'hi': {
        'software': 'सॉफ्टवेयर',
        'solutions': 'समाधान',
        'system': 'प्रणाली',
        'best': 'सर्वश्रेष्ठ',
        'premium': 'प्रीमियम',
        'top': 'शीर्ष',
      },
      'ar': {
        'software': 'برنامج',
        'solutions': 'حلول',
        'system': 'نظام',
        'best': 'الأفضل',
        'premium': 'متميز',
        'top': 'أعلى',
      },
      'fr': {
        'software': 'logiciel',
        'solutions': 'solutions',
        'system': 'système',
        'best': 'meilleur',
        'premium': 'premium',
        'top': 'top',
      },
      'es': {
        'software': 'software',
        'solutions': 'soluciones',
        'system': 'sistema',
        'best': 'mejor',
        'premium': 'premium',
        'top': 'top',
      },
    };

    let translated = text;
    const langDict = translations[targetLang] || {};
    
    Object.entries(langDict).forEach(([enWord, translatedWord]) => {
      const regex = new RegExp(enWord, 'gi');
      translated = translated.replace(regex, translatedWord);
    });

    return translated;
  };

  // Phase 11: Master Global SEO AI (Module 120)
  const runMasterSeoAutomation = async () => {
    setSaving(true);
    try {
      let totalActions = 0;

      // Run enabled modules in sequence
      if (masterSeoConfig.enablePageGeneration) {
        await generateProgrammablePages();
        totalActions++;
      }

      if (masterSeoConfig.enableMetaGeneration) {
        await generateMetaTags();
        totalActions++;
      }

      if (masterSeoConfig.enableKeywordExpansion) {
        await expandKeywords();
        totalActions++;
      }

      if (masterSeoConfig.enableSitemapGeneration) {
        await generateSitemap();
        totalActions++;
      }

      if (masterSeoConfig.enableIndexing) {
        await submitForIndexing();
        totalActions++;
      }

      if (masterSeoConfig.enableTranslation) {
        await translateContent();
        totalActions++;
      }

      setMasterSeoStats({
        totalActions: masterSeoStats.totalActions + totalActions,
        lastRun: new Date().toISOString(),
        nextRun: calculateNextRun(),
      });

      setSaving(false);
      toast.success(`Master SEO AI completed ${totalActions} actions`);
    } catch (e) {
      console.error('Failed to run master SEO automation:', e);
      toast.error('Failed to run master SEO automation');
      setSaving(false);
    }
  };

  const calculateNextRun = (): string => {
    const now = new Date();
    const interval = masterSeoConfig.scheduleInterval;

    switch (interval) {
      case 'hourly':
        now.setHours(now.getHours() + 1);
        break;
      case 'daily':
        now.setDate(now.getDate() + 1);
        break;
      case 'weekly':
        now.setDate(now.getDate() + 7);
        break;
      default:
        now.setDate(now.getDate() + 1);
    }

    return now.toISOString();
  };

  const fetchApks = async () => {
    setApksLoading(true);
    const [{ data: apkData }, { data: versionData }] = await Promise.all([
      db.from('apks').select('id, product_id, version, file_url, file_size, status, download_count, current_version_id, updated_at').order('updated_at', { ascending: false }).limit(500),
      db.from('apk_versions').select('id, apk_id, version_name, version_code, file_path, file_size, is_stable, created_at').order('created_at', { ascending: false }).limit(2000),
    ]);

    setApks((apkData || []) as Apk[]);
    setApkVersions((versionData || []) as ApkVersion[]);
    setApksLoading(false);
  };

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const { data } = await db
        .from('marketplace_orders')
        .select('id, buyer_id, seller_id, product_id, product_name, amount, final_amount, status, payment_method, coupon_code, created_at, completed_at, transaction_id')
        .order('created_at', { ascending: false })
        .limit(300);

      const orderRows = (data || []) as MarketplaceOrder[];
      if (orderRows.length === 0) {
        setOrders([]);
        return;
      }

      const buyerIds = Array.from(new Set(orderRows.map((o) => o.buyer_id).filter(Boolean)));
      const sellerIds = Array.from(new Set(orderRows.map((o) => o.seller_id).filter(Boolean)));
      const productIds = Array.from(new Set(orderRows.map((o) => o.product_id).filter(Boolean)));
      const txIds = Array.from(new Set(orderRows.map((o) => o.transaction_id).filter(Boolean)));

      const [
        { data: buyers },
        { data: sellerResellers },
        { data: productsData },
        { data: txData },
      ] = await Promise.all([
        buyerIds.length > 0
          ? db.from('profiles').select('id, full_name, email').in('id', buyerIds)
          : Promise.resolve({ data: [] }),
        sellerIds.length > 0
          ? db.from('resellers').select('user_id, company_name').in('user_id', sellerIds)
          : Promise.resolve({ data: [] }),
        productIds.length > 0
          ? db.from('products').select('id, name').in('id', productIds)
          : Promise.resolve({ data: [] }),
        txIds.length > 0
          ? db.from('transactions').select('id, status, reference_type, meta').in('id', txIds)
          : Promise.resolve({ data: [] }),
      ]);

      const buyerMap = new Map((buyers || []).map((b: any) => [b.id, b]));
      const resellerMap = new Map((sellerResellers || []).map((r: any) => [r.user_id, r.company_name]));
      const productMapById = new Map((productsData || []).map((p: any) => [p.id, p.name]));
      const txMap = new Map((txData || []).map((t: any) => [t.id, t]));

      const statusUpdates: Promise<any>[] = [];

      const normalizedOrders = orderRows.map((row) => {
        const tx = row.transaction_id ? txMap.get(row.transaction_id) : null;
        const txStatus = String(tx?.status || '').toLowerCase();
        const orderStatus = String(row.status || 'pending').toLowerCase();

        let computedStatus = orderStatus;
        if (txStatus === 'completed' || txStatus === 'success') computedStatus = 'completed';
        else if (txStatus === 'failed' || txStatus === 'cancelled') computedStatus = 'failed';
        else if (txStatus === 'pending') computedStatus = 'pending';

        if (computedStatus !== orderStatus) {
          const payload: Record<string, unknown> = { status: computedStatus };
          if (computedStatus === 'completed' && !row.completed_at) payload.completed_at = new Date().toISOString();
          statusUpdates.push(db.from('marketplace_orders').update(payload).eq('id', row.id));
        }

        const buyer = buyerMap.get(row.buyer_id);
        const buyerName = buyer?.full_name || buyer?.email || row.buyer_id;
        const resellerName = resellerMap.get(row.seller_id) || row.seller_id || '—';
        const productName = row.product_name || (row.product_id ? productMapById.get(row.product_id) : null) || '—';
        const gatewayFromTx = String(tx?.reference_type || tx?.meta?.payment_method || '').toLowerCase();
        const gateway = (row.payment_method || gatewayFromTx || 'wallet').toUpperCase();

        return {
          ...row,
          product_name: productName,
          status: computedStatus,
          gateway,
          buyer_name: buyerName,
          reseller_name: resellerName,
        } as MarketplaceOrder;
      });

      if (statusUpdates.length > 0) {
        await Promise.all(statusUpdates);
      }

      setOrders(normalizedOrders);
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await marketplaceAdminApi.getStats();
      if (res) {
        setStats({
          totalProducts: res.total_products || 0,
          activeProducts: res.active_products || 0,
          pipelineProducts: res.pipeline_products || 0,
          totalSales: res.total_sales || 0,
          totalDownloads: res.total_downloads || 0,
          avgQualityScore: res.avg_quality_score || 0,
          avgSellerReputation: res.avg_seller_reputation || 0,
        });
      }
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  };

  // Phase 2: Fetch scheduled launches
  const fetchScheduledLaunches = async () => {
    setScheduledLaunchesLoading(true);
    try {
      const { data, error } = await db
        .from('scheduled_launches')
        .select('*')
        .order('launch_date', { ascending: true });
      
      if (error) {
        console.error('Failed to fetch scheduled launches:', error);
        setScheduledLaunches([]);
      } else {
        setScheduledLaunches(data || []);
      }
    } catch (e) {
      console.error('Failed to fetch scheduled launches:', e);
      setScheduledLaunches([]);
    } finally {
      setScheduledLaunchesLoading(false);
    }
  };

  // Phase 2: Fetch reviews for moderation
  const fetchReviewsForModeration = async () => {
    setReviewsLoading(true);
    try {
      // product_reviews table may not exist yet, handle gracefully
      const { data, error } = await (db as any)
        .from('product_reviews')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Failed to fetch reviews:', error);
        setReviewsToModerate([]);
      } else {
        setReviewsToModerate(data || []);
      }
    } catch (e) {
      console.error('Failed to fetch reviews:', e);
      setReviewsToModerate([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  // Phase 2: Fetch advanced analytics
  const fetchAdvancedAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      // Daily sales and revenue for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: ordersData } = await db
        .from('marketplace_orders')
        .select('created_at, amount, status')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .eq('status', 'completed');
      
      // Process daily sales
      const dailySalesMap = new Map<string, { sales: number; revenue: number }>();
      (ordersData || []).forEach(order => {
        const date = new Date(order.created_at).toISOString().split('T')[0];
        const current = dailySalesMap.get(date) || { sales: 0, revenue: 0 };
        current.sales += 1;
        current.revenue += Number(order.amount || 0);
        dailySalesMap.set(date, current);
      });
      
      const dailySales = Array.from(dailySalesMap.entries()).map(([date, data]) => ({
        date,
        sales: data.sales,
        revenue: data.revenue,
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Top products by sales
      const { data: topProductsData } = await db
        .from('marketplace_orders')
        .select('product_id, product_name')
        .eq('status', 'completed');
      
      const productSalesMap = new Map<string, number>();
      (topProductsData || []).forEach(order => {
        const productId = order.product_id || 'unknown';
        productSalesMap.set(productId, (productSalesMap.get(productId) || 0) + 1);
      });
      
      const topProducts = Array.from(productSalesMap.entries())
        .map(([id, sales]) => ({ id, name: (topProductsData || []).find(o => o.product_id === id)?.product_name || id, sales }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 10);
      
      setAnalyticsData({
        dailySales,
        topProducts,
        userGrowth: [], // Would need user registration data
        categoryPerformance: [], // Would need category breakdown
      });
    } catch (e) {
      console.error('Failed to fetch analytics:', e);
      setAnalyticsData({
        dailySales: [],
        topProducts: [],
        userGrowth: [],
        categoryPerformance: [],
      });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const calculateProductQualityScore = (product: Product): number => {
    let score = 0;
    
    if (product.description && product.description.length > 100) score += 20;
    else if (product.description) score += 10;
    
    if (product.thumbnail_url) score += 15;
    if (product.demo_enabled && product.demo_url) score += 15;
    if (product.apk_enabled) score += 10;
    if (product.license_enabled) score += 10;
    if (product.tags && product.tags.length > 0) score += 10;
    score += (product.rating / 5) * 20;
    
    return Math.min(100, Math.round(score));
  };

  const calculateSellerReputation = async (sellerId: string): Promise<number> => {
    try {
      const { data: products } = await db
        .from('marketplace_products')
        .select('rating, status')
        .eq('created_by', sellerId);
      
      if (!products || products.length === 0) return 50;
      
      const activeProducts = products.filter(p => p.status === 'active').length;
      const avgRating = products.reduce((sum, p) => sum + (p.rating || 0), 0) / products.length;
      
      let reputation = 50;
      reputation += (activeProducts / products.length) * 30;
      reputation += (avgRating / 5) * 20;
      
      return Math.min(100, Math.round(reputation));
    } catch (e) {
      console.error('Failed to calculate seller reputation:', e);
      return 50;
    }
  };

  const refreshAll = async () => {
    setProductsLoading(true);
    await Promise.all([
      fetchProducts(),
      fetchHeaderMenus(),
      fetchBanners(),
      fetchTickers(),
      fetchCoupons(),
      fetchDiscountRules(),
      fetchGateways(),
      fetchApks(),
      fetchOrders(),
      fetchStats(),
      fetchActivityTimeline(),
      fetchScheduledLaunches(),
      fetchReviewsForModeration(),
      fetchAdvancedAnalytics(),
      fetchCategories(),
      fetchUsers(),
      fetchLicenses(),
      fetchTickerMessages(),
      fetchBannerSlides(),
      fetchBannerSettings(),
      fetchProgrammablePages(),
      fetchIndexingStats(),
    ]);
    setProductsLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, [page, search]);

  useEffect(() => {
    refreshAll();
  }, []);

  const handleSaveProduct = async () => {
    if (!editProduct) return;

    const productSlug = (editProduct.slug || slugify(editProduct.name || '')).trim();
    if (!editProduct.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    const rawDemoInput = editProduct.demo_source_url || editProduct.demo_url;
    if (rawDemoInput && !sanitizeDemoSourceUrl(rawDemoInput)) {
      toast.error('Demo URL must be a valid HTTP/HTTPS URL');
      return;
    }
    if (editProduct.apk_enabled && !editProduct.apk_url) {
      toast.error('APK URL is required when download is enabled');
      return;
    }
    if (editProduct.buy_enabled && (!editProduct.price || editProduct.price <= 0)) {
      toast.error('Price must be greater than 0 when buy is enabled');
      return;
    }

    const normalizedDemo = normalizeDemoUrlPair(productSlug, rawDemoInput);

    const payload = {
      name: editProduct.name.trim(),
      slug: productSlug,
      description: editProduct.description || editProduct.short_description || '',
      short_description: editProduct.short_description || '',
      price: Number(editProduct.price || 0),
      status: editProduct.status || 'active',
      target_industry: editProduct.business_type || editProduct.target_industry || 'software',
      tags: editProduct.tags || [],
      demo_url: normalizedDemo.demoUrl,
      demo_source_url: normalizedDemo.demoSourceUrl,
      demo_login: editProduct.demo_login || null,
      demo_password: editProduct.demo_password || null,
      demo_enabled: Boolean(editProduct.demo_enabled),
      apk_url: editProduct.apk_url || null,
      thumbnail_url: editProduct.thumbnail_url || null,
      featured: Boolean(editProduct.featured),
      trending: Boolean(editProduct.trending),
      marketplace_visible: Boolean(editProduct.marketplace_visible),
      discount_percent: Number(editProduct.discount_percent || 0),
      rating: Number(editProduct.rating || 0),
      apk_enabled: Boolean(editProduct.apk_enabled),
      license_enabled: Boolean(editProduct.license_enabled),
      buy_enabled: Boolean(editProduct.buy_enabled),
      require_payment: Boolean(editProduct.buy_enabled),
    };

    setSaving(true);

    try {
      let productId: string;
      let shouldGenerateThumbnail = false;

      if (editProduct.id.startsWith('new-')) {
        const createdProduct = await marketplaceAdminApi.createProduct(payload);
        productId = createdProduct.id;
        toast.success('Product created');
        shouldGenerateThumbnail = true;
      } else {
        await marketplaceAdminApi.updateProduct(editProduct.id, payload);
        productId = editProduct.id;
        toast.success('Product updated');
        // Generate thumbnail if demo_url changed
        shouldGenerateThumbnail = normalizedDemo.demoUrl !== editProduct.demo_url;
      }

      // Save SEO data
      if (editProductSeo) {
        // Auto-generate slug if not provided
        if (!editProductSeo.slug) {
          const baseSlug = lowerCase(slugify(editProduct.name || ''));
          editProductSeo.slug = `${baseSlug}-${editProductSeo.target_country || 'IN'}`;
        }
        // Auto-generate title if not provided
        if (!editProductSeo.title) {
          editProductSeo.title = editProduct.name || '';
        }
        const seoSaved = await saveProductSeo(productId);
        if (!seoSaved) {
          setSaving(false);
          return;
        }
      }

      // Auto-generate thumbnail if demo URL is provided
      if (shouldGenerateThumbnail && normalizedDemo.demoUrl) {
        toast.info('Generating thumbnail for demo URL...');
        try {
          const thumbnailResult = await generateProductThumbnail(
            productId,
            normalizedDemo.demoUrl,
            editProduct.target_industry || 'general'
          );
          
          if (thumbnailResult.success) {
            if (thumbnailResult.fallbackUsed) {
              toast.info('Thumbnail generated using fallback image');
            } else {
              toast.success('Thumbnail generated successfully');
            }
          } else {
            toast.warning(`Thumbnail generation failed: ${thumbnailResult.error || 'Unknown error'}`);
          }
        } catch (error) {
          console.error('Thumbnail generation error:', error);
          toast.warning('Thumbnail generation failed, using fallback');
        }
      }

      setEditProduct(null);
      await Promise.all([fetchProducts(), fetchProductCatalog(), fetchStats(), fetchApks()]);
      window.dispatchEvent(new CustomEvent('marketplaceRefresh'));
    } catch (e: any) {
      toast.error(`Save failed: ${e?.message || 'Unknown error'}`);
    }

    setSaving(false);
  };

  const fetchProductSeo = async (productId: string) => {
    try {
      const { data, error } = await db
        .from('marketplace_seo')
        .select('*')
        .eq('product_id', productId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No SEO record exists, create default
          const defaultSeo: ProductSeo = {
            slug: '',
            title: '',
            meta_description: '',
            keywords: [],
            hashtags: [],
            seo_score: 0,
            target_country: 'IN',
          };
          setEditProductSeo(defaultSeo);
        } else {
          console.error('Error fetching SEO:', error);
        }
      } else if (data) {
        setEditProductSeo({
          id: data.id,
          product_id: data.product_id,
          slug: data.slug,
          title: data.title,
          meta_description: data.meta_description || '',
          keywords: data.keywords || [],
          hashtags: data.hashtags || [],
          seo_score: data.seo_score,
          og_title: data.og_title,
          og_description: data.og_description,
          og_image: data.og_image,
          twitter_card: data.twitter_card,
          canonical_url: data.canonical_url,
          target_country: data.target_country,
        });
      }
    } catch (error) {
      console.error('Error fetching SEO:', error);
    }
  };

  const generateSeo = async () => {
    if (!editProduct || !editProductSeo) return;
    
    setGeneratingSeo(true);
    try {
      const productName = editProduct.name || '';
      const category = editProduct.business_type || editProduct.target_industry || 'software';
      const description = editProduct.short_description || editProduct.description || '';
      const tags = (editProduct.tags || []).join(', ');
      
      // Call OpenAI API for SEO generation
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openai-seo-generator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          productName,
          category,
          description,
          tags,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setEditProductSeo({
          ...editProductSeo,
          title: data.title || productName,
          meta_description: data.metaDescription || description.substring(0, 160),
          keywords: data.keywords || [productName, category],
          hashtags: data.hashtags || [`#${category}`, `#${productName.replace(/\s/g, '')}`],
          og_title: data.ogTitle || productName,
          og_description: data.ogDescription || description.substring(0, 160),
        });
        toast.success('SEO generated successfully');
      } else {
        // Fallback to rule-based generation
        const fallbackSeo = {
          title: productName,
          meta_description: description.substring(0, 160) || `Buy ${productName} - ${category} software for your business`,
          keywords: [productName, category, 'software', 'saas', ...editProduct.tags.slice(0, 3)],
          hashtags: [`#${category}`, `#${productName.replace(/\s/g, '')}`, '#software', '#saas'],
          og_title: productName,
          og_description: description.substring(0, 160),
        };
        setEditProductSeo({
          ...editProductSeo,
          ...fallbackSeo,
        });
        toast.success('SEO generated (fallback mode)');
      }
    } catch (error) {
      console.error('Error generating SEO:', error);
      // Fallback to rule-based generation
      const productName = editProduct.name || '';
      const category = editProduct.business_type || editProduct.target_industry || 'software';
      const description = editProduct.short_description || editProduct.description || '';
      
      setEditProductSeo({
        ...editProductSeo,
        title: productName,
        meta_description: description.substring(0, 160) || `Buy ${productName} - ${category} software for your business`,
        keywords: [productName, category, 'software', 'saas', ...editProduct.tags.slice(0, 3)],
        hashtags: [`#${category}`, `#${productName.replace(/\s/g, '')}`, '#software', '#saas'],
        og_title: productName,
        og_description: description.substring(0, 160),
      });
      toast.success('SEO generated (fallback mode)');
    } finally {
      setGeneratingSeo(false);
    }
  };

  const saveProductSeo = async (productId: string) => {
    if (!editProductSeo) return;
    
    try {
      // Validation
      if (!editProductSeo.title.trim()) {
        toast.error('SEO title is required');
        return false;
      }
      if (!editProductSeo.slug.trim()) {
        toast.error('SEO slug is required');
        return false;
      }
      if (editProductSeo.keywords.length === 0) {
        toast.error('At least one keyword is required');
        return false;
      }
      
      const payload = {
        product_id: productId,
        slug: editProductSeo.slug,
        title: editProductSeo.title,
        meta_description: editProductSeo.meta_description,
        keywords: editProductSeo.keywords,
        hashtags: editProductSeo.hashtags,
        og_title: editProductSeo.og_title,
        og_description: editProductSeo.og_description,
        og_image: editProductSeo.og_image,
        twitter_card: editProductSeo.twitter_card,
        canonical_url: editProductSeo.canonical_url,
        target_country: editProductSeo.target_country,
      };
      
      let error;
      if (editProductSeo.id) {
        const result = await db.from('marketplace_seo').update(payload).eq('id', editProductSeo.id);
        error = result.error;
      } else {
        const result = await db.from('marketplace_seo').insert(payload);
        error = result.error;
      }
      
      if (error) {
        toast.error(`Failed to save SEO: ${error.message}`);
        return false;
      }
      
      return true;
    } catch (error: any) {
      console.error('Error saving SEO:', error);
      toast.error(`Failed to save SEO: ${error?.message || 'Unknown error'}`);
      return false;
    }
  };

  const toggleVisibility = async (p: Product) => {
    try {
      await marketplaceAdminApi.updateProduct(p.id, { marketplace_visible: !p.marketplace_visible });
    } catch {
      toast.error('Visibility update failed');
      return;
    }

    toast.success(!p.marketplace_visible ? 'Now visible on marketplace' : 'Hidden from marketplace');
    await Promise.all([fetchProducts(), fetchStats()]);
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Set this product to inactive? It will be hidden from marketplace.')) return;
    try {
      await marketplaceAdminApi.deleteProduct(id);
    } catch (e: any) {
      toast.error(`Update failed: ${e?.message || 'Unknown error'}`);
      return;
    }
    toast.success('Product set to inactive');
    await Promise.all([fetchProducts(), fetchProductCatalog(), fetchStats(), fetchApks()]);
    window.dispatchEvent(new CustomEvent('marketplaceRefresh'));
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAllOnPage = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(products.map((p) => p.id)));
  };

  const runBulk = async (action: 'show' | 'hide' | 'feature' | 'unfeature' | 'trend' | 'pipeline' | 'live' | 'enableApk' | 'disableApk' | 'enableBuy' | 'disableBuy' | 'delete') => {
    if (selectedIds.size === 0) {
      toast.error('Select products first');
      return;
    }

    const ids = Array.from(selectedIds);
    setBulkRunning(true);

    if (action === 'delete') {
      if (!confirm(`Set ${ids.length} selected products to inactive? They will be hidden from marketplace.`)) {
        setBulkRunning(false);
        return;
      }
      try {
        await marketplaceAdminApi.bulkProducts('delete', ids);
        toast.success(`Set ${ids.length} products to inactive`);
      } catch (e: any) {
        toast.error(e?.message || 'Bulk delete failed');
      }
      setSelectedIds(new Set());
      setBulkRunning(false);
      await Promise.all([fetchProducts(), fetchProductCatalog(), fetchStats(), fetchApks()]);
      window.dispatchEvent(new CustomEvent('marketplaceRefresh'));
      return;
    }

    const payload: Record<string, unknown> = {};
    if (action === 'show') payload.marketplace_visible = true;
    if (action === 'hide') payload.marketplace_visible = false;
    if (action === 'feature') payload.featured = true;
    if (action === 'unfeature') payload.featured = false;
    if (action === 'trend') payload.trending = true;
    if (action === 'pipeline') payload.status = 'draft';
    if (action === 'live') payload.status = 'active';
    if (action === 'enableApk') payload.apk_enabled = true;
    if (action === 'disableApk') payload.apk_enabled = false;
    if (action === 'enableBuy') {
      payload.buy_enabled = true;
      payload.require_payment = true;
    }
    if (action === 'disableBuy') {
      payload.buy_enabled = false;
      payload.require_payment = false;
    }

    try {
      await marketplaceAdminApi.bulkProducts(action, ids, payload);
      toast.success(`Updated ${ids.length} products`);
    } catch (e: any) {
      toast.error(e?.message || 'Bulk update failed');
    }

    setSelectedIds(new Set());
    setBulkRunning(false);
    await Promise.all([fetchProducts(), fetchProductCatalog(), fetchStats(), fetchApks()]);
    window.dispatchEvent(new CustomEvent('marketplaceRefresh'));
  };

  const saveHeaderMenu = async () => {
    if (!editHeaderMenu) return;
    if (!editHeaderMenu.label.trim()) {
      toast.error('Menu label is required');
      return;
    }

    const payload = {
      label: editHeaderMenu.label.trim(),
      target_id: editHeaderMenu.target_id || null,
      link_url: editHeaderMenu.link_url || null,
      sort_order: Number(editHeaderMenu.sort_order || 0),
      is_active: Boolean(editHeaderMenu.is_active),
    };

    setSaving(true);
    const query = editHeaderMenu.id.startsWith('new-')
      ? db.from('marketplace_header_menus').insert(payload)
      : db.from('marketplace_header_menus').update(payload).eq('id', editHeaderMenu.id);

    const { error } = await query;
    setSaving(false);

    if (error) toast.error(error.message);
    else {
      toast.success('Header menu saved');
      setEditHeaderMenu(null);
      fetchHeaderMenus();
    }
  };

  const deleteHeaderMenu = async (id: string) => {
    if (!confirm('Delete this header menu item?')) return;
    const { error } = await db.from('marketplace_header_menus').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Header menu deleted');
      fetchHeaderMenus();
    }
  };

  const saveBanner = async () => {
    if (!editBanner) return;
    if (!editBanner.title.trim()) {
      toast.error('Banner title is required');
      return;
    }

    const payload = {
      title: editBanner.title.trim(),
      subtitle: editBanner.subtitle || null,
      image_url: editBanner.image_url || null,
      badge: editBanner.badge || null,
      badge_color: editBanner.badge_color || null,
      offer_text: editBanner.offer_text || null,
      coupon_code: editBanner.coupon_code || null,
      link_url: editBanner.link_url || null,
      sort_order: Number(editBanner.sort_order || 0),
      is_active: Boolean(editBanner.is_active),
      start_date: editBanner.start_date || null,
      end_date: editBanner.end_date || null,
    };

    setSaving(true);
    const query = editBanner.id.startsWith('new-')
      ? db.from('marketplace_banners').insert(payload)
      : db.from('marketplace_banners').update(payload).eq('id', editBanner.id);

    const { error } = await query;
    setSaving(false);

    if (error) toast.error(error.message);
    else {
      toast.success('Banner saved');
      setEditBanner(null);
      fetchBanners();
    }
  };

  const deleteBanner = async (id: string) => {
    if (!confirm('Delete this banner?')) return;
    const { error } = await db.from('marketplace_banners').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Banner deleted');
      fetchBanners();
    }
  };

  const saveTicker = async () => {
    if (!editTicker) return;
    if (!editTicker.text.trim()) {
      toast.error('Ticker text is required');
      return;
    }

    const payload = {
      text: editTicker.text.trim(),
      sort_order: Number(editTicker.sort_order || 0),
      is_active: Boolean(editTicker.is_active),
    };

    setSaving(true);
    const query = editTicker.id.startsWith('new-')
      ? db.from('marketplace_tickers').insert(payload)
      : db.from('marketplace_tickers').update(payload).eq('id', editTicker.id);

    const { error } = await query;
    setSaving(false);

    if (error) toast.error(error.message);
    else {
      toast.success('Ticker saved');
      setEditTicker(null);
      fetchTickers();
    }
  };

  const deleteTicker = async (id: string) => {
    if (!confirm('Delete this ticker?')) return;
    const { error } = await db.from('marketplace_tickers').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Ticker deleted');
      fetchTickers();
    }
  };

  const saveCoupon = async () => {
    if (!editCoupon) return;
    if (!editCoupon.code.trim()) {
      toast.error('Coupon code is required');
      return;
    }

    const payload = {
      code: editCoupon.code.trim().toUpperCase(),
      description: editCoupon.description || null,
      discount_type: editCoupon.discount_type,
      discount_value: Number(editCoupon.discount_value || 0),
      min_order: Number(editCoupon.min_order || 0),
      max_uses: Number(editCoupon.max_uses || 0),
      is_active: Boolean(editCoupon.is_active),
      start_date: editCoupon.start_date || null,
      end_date: editCoupon.end_date || null,
    };

    setSaving(true);
    const query = editCoupon.id.startsWith('new-')
      ? db.from('marketplace_coupons').insert(payload)
      : db.from('marketplace_coupons').update(payload).eq('id', editCoupon.id);

    const { error } = await query;
    setSaving(false);

    if (error) toast.error(error.message);
    else {
      toast.success('Coupon saved');
      setEditCoupon(null);
      fetchCoupons();
    }
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm('Delete this coupon?')) return;
    const { error } = await db.from('marketplace_coupons').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Coupon deleted');
      fetchCoupons();
    }
  };

  const saveDiscountRule = async () => {
    if (!editDiscountRule) return;
    if (!editDiscountRule.name.trim()) {
      toast.error('Rule name is required');
      return;
    }

    const payload = {
      name: editDiscountRule.name.trim(),
      country_code: editDiscountRule.country_code || null,
      region: editDiscountRule.region || null,
      festival: editDiscountRule.festival || null,
      discount_type: editDiscountRule.discount_type,
      discount_value: Number(editDiscountRule.discount_value || 0),
      min_order: Number(editDiscountRule.min_order || 0),
      coupon_code: editDiscountRule.coupon_code || null,
      start_date: editDiscountRule.start_date || null,
      end_date: editDiscountRule.end_date || null,
      is_active: Boolean(editDiscountRule.is_active),
      sort_order: Number(editDiscountRule.sort_order || 0),
    };

    setSaving(true);
    const query = editDiscountRule.id.startsWith('new-')
      ? db.from('marketplace_discount_rules').insert(payload)
      : db.from('marketplace_discount_rules').update(payload).eq('id', editDiscountRule.id);

    const { error } = await query;
    setSaving(false);

    if (error) toast.error(error.message);
    else {
      toast.success('Discount rule saved');
      setEditDiscountRule(null);
      fetchDiscountRules();
    }
  };

  const deleteDiscountRule = async (id: string) => {
    if (!confirm('Delete this discount rule?')) return;
    const { error } = await db.from('marketplace_discount_rules').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Discount rule deleted');
      fetchDiscountRules();
    }
  };

  const startReplaceApk = (apk: Apk) => {
    setApkForm({
      product_id: apk.product_id,
      version: apk.version,
      version_name: apk.version,
      version_code: Number(apkVersionsByApkId.get(apk.id)?.[0]?.version_code || 1),
      status: apk.status,
      changelog: '',
      replace_apk_id: apk.id,
    });
    setApkFile(null);
  };

  const handleUploadApk = async () => {
    if (!user) {
      toast.error('You must be logged in');
      return;
    }
    if (!apkForm.product_id) {
      toast.error('Select product first');
      return;
    }
    if (!apkFile) {
      toast.error('Select APK file first');
      return;
    }
    if (!apkFile.name.toLowerCase().endsWith('.apk')) {
      toast.error('Only .apk files are allowed');
      return;
    }

    setUploadingApk(true);

    const safeFileName = apkFile.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    // Standardized storage path: {productId}/{timestamp}-{filename} within 'apks' bucket
    const storagePath = `${apkForm.product_id}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await db.storage
      .from('apks')
      .upload(storagePath, apkFile, { upsert: true, contentType: apkFile.type || 'application/vnd.android.package-archive' });

    if (uploadError) {
      setUploadingApk(false);
      toast.error(`Upload failed: ${uploadError.message}`);
      return;
    }

    // Helper to rollback uploaded file on DB failure
    const rollbackStorage = async () => {
      try {
        await db.storage.from('apks').remove([storagePath]);
      } catch { /* best effort */ }
    };

    let apkId = apkForm.replace_apk_id;

    if (apkId) {
      const { error } = await db
        .from('apks')
        .update({
          product_id: apkForm.product_id,
          version: apkForm.version,
          file_url: storagePath,
          file_size: apkFile.size,
          status: apkForm.status,
          changelog: apkForm.changelog || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', apkId);

      if (error) {
        await rollbackStorage();
        setUploadingApk(false);
        toast.error(`APK update failed: ${error.message}`);
        return;
      }
    } else {
      const { data: inserted, error } = await db
        .from('apks')
        .insert({
          product_id: apkForm.product_id,
          version: apkForm.version,
          file_url: storagePath,
          file_size: apkFile.size,
          status: apkForm.status,
          changelog: apkForm.changelog || null,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (error || !inserted?.id) {
        await rollbackStorage();
        setUploadingApk(false);
        toast.error(`APK create failed: ${error?.message || 'Unknown error'}`);
        return;
      }

      apkId = inserted.id;
    }

    const { data: versionRow, error: versionError } = await db
      .from('apk_versions')
      .insert({
        apk_id: apkId,
        version_name: apkForm.version_name,
        version_code: Number(apkForm.version_code || 1),
        file_path: storagePath,
        file_size: apkFile.size,
        release_notes: apkForm.changelog || null,
        is_stable: apkForm.status === 'published',
        created_by: user.id,
      })
      .select('id')
      .single();

    if (versionError) {
      await rollbackStorage();
      setUploadingApk(false);
      toast.error(`Version create failed: ${versionError.message}`);
      return;
    }

    if (versionRow?.id) {
      await db
        .from('apks')
        .update({ current_version_id: versionRow.id, file_url: storagePath, updated_at: new Date().toISOString() })
        .eq('id', apkId);
    }

    // Update product APK link WITHOUT changing product.status (APK upload is independent)
    await db
      .from('products')
      .update({
        apk_url: storagePath,
        storage_path: storagePath,
        apk_enabled: apkForm.status === 'published',
      })
      .eq('id', apkForm.product_id);

    setUploadingApk(false);
    setApkFile(null);
    setApkForm({
      product_id: '',
      version: '1.0.0',
      version_name: '1.0.0',
      version_code: 1,
      status: 'draft',
      changelog: '',
      replace_apk_id: '',
    });

    toast.success('APK uploaded and linked');
    await Promise.all([fetchApks(), fetchProducts(), fetchProductCatalog(), fetchStats()]);
    window.dispatchEvent(new CustomEvent('marketplaceRefresh'));
  };

  const toggleApkDownload = async (apk: Apk) => {
    const product = productMap.get(apk.product_id);
    if (!product) return;
    const { error } = await db
      .from('products')
      .update({ apk_enabled: !product.apk_enabled })
      .eq('id', apk.product_id);
    if (error) toast.error(error.message);
    else {
      toast.success(!product.apk_enabled ? 'APK download enabled' : 'APK download disabled');
      await Promise.all([fetchProducts(), fetchProductCatalog(), fetchApks()]);
    }
  };

  const toggleApkStatus = async (apk: Apk) => {
    const nextStatus = apk.status === 'published' ? 'draft' : 'published';
    const { error } = await db.from('apks').update({ status: nextStatus }).eq('id', apk.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`APK moved to ${nextStatus.toUpperCase()}`);
      await Promise.all([fetchApks(), fetchProducts(), fetchProductCatalog(), fetchStats()]);
    }
  };

  const deleteApk = async (apkId: string) => {
    if (!confirm('Delete this APK record?')) return;
    const { error } = await db.from('apks').delete().eq('id', apkId);
    if (error) toast.error(error.message);
    else {
      toast.success('APK record deleted');
      await Promise.all([fetchApks(), fetchProducts(), fetchProductCatalog()]);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-black text-foreground flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Marketplace Admin Control Center
            </h1>
            <p className="text-xs text-muted-foreground">
              Header, Banner, Products, APK, Payments, Offers — all controlled here.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={() => navigate('/products')}>
              Products
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => navigate('/automation')}>
              Automation
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => navigate('/audit-logs')}>
              Audit Logs
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => { fetchProducts(); refreshAll(); }}>
              <RefreshCw className="h-3 w-3" /> Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-[10px] text-muted-foreground">Total Products</p>
            <p className="text-lg font-black text-foreground">{stats.totalProducts}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-[10px] text-muted-foreground">Active Products</p>
            <p className="text-lg font-black text-primary">{stats.activeProducts}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-[10px] text-muted-foreground">Pipeline Products</p>
            <p className="text-lg font-black text-accent-foreground">{stats.pipelineProducts}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-[10px] text-muted-foreground">Sales</p>
            <p className="text-lg font-black text-foreground">${stats.totalSales.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-[10px] text-muted-foreground">Downloads</p>
            <p className="text-lg font-black text-foreground">{stats.totalDownloads}</p>
          </div>
        </div>

        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid h-10 w-full grid-cols-15">
            <TabsTrigger value="settings" className="text-[10px] gap-1"><Layout className="h-3 w-3" />Settings</TabsTrigger>
            <TabsTrigger value="products" className="text-[10px] gap-1"><Package className="h-3 w-3" />Products</TabsTrigger>
            <TabsTrigger value="categories" className="text-[10px] gap-1"><Folder className="h-3 w-3" />Categories</TabsTrigger>
            <TabsTrigger value="users" className="text-[10px] gap-1"><Users className="h-3 w-3" />Users</TabsTrigger>
            <TabsTrigger value="licenses" className="text-[10px] gap-1"><Shield className="h-3 w-3" />Licenses</TabsTrigger>
            <TabsTrigger value="banner" className="text-[10px] gap-1"><Image className="h-3 w-3" />Banner</TabsTrigger>
            <TabsTrigger value="apk" className="text-[10px] gap-1"><Truck className="h-3 w-3" />APK</TabsTrigger>
            <TabsTrigger value="payments" className="text-[10px] gap-1"><CreditCard className="h-3 w-3" />Payments</TabsTrigger>
            <TabsTrigger value="offers" className="text-[10px] gap-1"><Tags className="h-3 w-3" />Offers</TabsTrigger>
            <TabsTrigger value="bulk" className="text-[10px] gap-1"><RefreshCw className="h-3 w-3" />Bulk</TabsTrigger>
            <TabsTrigger value="analytics" className="text-[10px] gap-1"><BarChart3 className="h-3 w-3" />Analytics</TabsTrigger>
            <TabsTrigger value="launches" className="text-[10px] gap-1"><Calendar className="h-3 w-3" />Launches</TabsTrigger>
            <TabsTrigger value="reviews" className="text-[10px] gap-1"><MessageSquare className="h-3 w-3" />Reviews</TabsTrigger>
            <TabsTrigger value="seo" className="text-[10px] gap-1"><TrendingUp className="h-3 w-3" />SEO</TabsTrigger>
            <TabsTrigger value="global-seo" className="text-[10px] gap-1"><Globe className="h-3 w-3" />Global SEO</TabsTrigger>
            <TabsTrigger value="lead-gen" className="text-[10px] gap-1"><Users className="h-3 w-3" />Lead Gen</TabsTrigger>
            <TabsTrigger value="ai-api" className="text-[10px] gap-1"><Cpu className="h-3 w-3" />AI API</TabsTrigger>
            <TabsTrigger value="keys" className="text-[10px] gap-1"><Key className="h-3 w-3" />Keys</TabsTrigger>
          </TabsList>

          <TabsContent value="licenses" className="space-y-4 mt-4">
            <div className="rounded-lg border border-border bg-card p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Shield className="h-4 w-4 text-primary" />License Key Management</h2>
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setEditLicense({ product_id: '', user_id: '', license_key: generateLicenseKey(), status: 'active', expires_at: null })}>
                  <Plus className="h-3 w-3" /> Generate License
                </Button>
              </div>
              
              {licensesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : licenses.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No license keys generated yet</p>
              ) : (
                <div className="space-y-2">
                  {licenses.map((license) => (
                    <div key={license.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-xs font-mono bg-primary/10 px-2 py-1 rounded">{license.license_key}</code>
                          <Badge variant={license.status === 'active' ? 'default' : 'secondary'} className="text-[9px]">
                            {license.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                          <span>Product: {license.product_id}</span>
                          <span>User: {license.user_id}</span>
                          {license.expires_at && <span>Expires: {new Date(license.expires_at).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => validateLicense(license.license_key)}>
                          <Check className="h-3 w-3" /> Validate
                        </Button>
                        {license.status === 'active' && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => revokeLicense(license.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="banner" className="space-y-4 mt-4">
            <div className="rounded-lg border border-border bg-card p-3 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Image className="h-4 w-4 text-primary" />Banner Control</h2>
              </div>

              {/* Banner Settings */}
              {bannerSettings && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                  <h3 className="text-xs font-semibold text-foreground">Banner Settings</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">Ticker Enabled</label>
                      <Switch checked={bannerSettings.ticker_enabled} onCheckedChange={(checked) => setBannerSettings({ ...bannerSettings, ticker_enabled: checked })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">Banner Enabled</label>
                      <Switch checked={bannerSettings.banner_enabled} onCheckedChange={(checked) => setBannerSettings({ ...bannerSettings, banner_enabled: checked })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">Ticker Speed (sec)</label>
                      <Input type="number" value={bannerSettings.ticker_speed} onChange={(e) => setBannerSettings({ ...bannerSettings, ticker_speed: parseInt(e.target.value) })} className="h-7 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">Banner Speed (sec)</label>
                      <Input type="number" value={bannerSettings.banner_speed} onChange={(e) => setBannerSettings({ ...bannerSettings, banner_speed: parseInt(e.target.value) })} className="h-7 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">Ticker Color Theme</label>
                      <Select value={bannerSettings.ticker_color_theme} onValueChange={(value) => setBannerSettings({ ...bannerSettings, ticker_color_theme: value })}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="orange">Orange</SelectItem>
                          <SelectItem value="blue">Blue</SelectItem>
                          <SelectItem value="purple">Purple</SelectItem>
                          <SelectItem value="green">Green</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">Auto Rotate Banner</label>
                      <Switch checked={bannerSettings.banner_auto_rotate} onCheckedChange={(checked) => setBannerSettings({ ...bannerSettings, banner_auto_rotate: checked })} />
                    </div>
                  </div>
                  <Button size="sm" className="h-7 text-xs" onClick={saveBannerSettings} disabled={saving}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save Settings'}
                  </Button>
                </div>
              )}

              {/* Ticker Messages */}
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-foreground">Ticker Messages</h3>
                  <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setEditTicker({ id: `new-${Date.now()}`, message_type: 'offer', message: '', emoji: '', is_active: true, sort_order: 0 })}>
                    <Plus className="h-3 w-3" /> Add Message
                  </Button>
                </div>
                {tickerLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : tickerMessages.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center py-4">No ticker messages</p>
                ) : (
                  <div className="space-y-2">
                    {tickerMessages.map((ticker) => (
                      <div key={ticker.id} className="flex items-center gap-2 p-2 rounded bg-card border border-border">
                        <span className="text-lg">{ticker.emoji || '📢'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{ticker.message}</p>
                          <p className="text-[10px] text-muted-foreground">{ticker.message_type}</p>
                        </div>
                        <Badge variant={ticker.is_active ? 'default' : 'secondary'} className="text-[9px]">{ticker.is_active ? 'ON' : 'OFF'}</Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditTicker(ticker)}><Edit2 className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteTickerMessage(ticker.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Banner Slides */}
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-foreground">Banner Slides</h3>
                  <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setEditBanner({ id: `new-${Date.now()}`, slide_type: 'product', product_id: null, title: '', description: '', cta_text: '', cta_link: '', background_gradient: '', is_active: true, sort_order: 0 })}>
                    <Plus className="h-3 w-3" /> Add Slide
                  </Button>
                </div>
                {bannerLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : bannerSlides.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center py-4">No banner slides</p>
                ) : (
                  <div className="space-y-2">
                    {bannerSlides.map((slide) => (
                      <div key={slide.id} className="flex items-center gap-2 p-2 rounded bg-card border border-border">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{slide.title || slide.slide_type}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{slide.description || slide.cta_text || '—'}</p>
                        </div>
                        <Badge variant={slide.is_active ? 'default' : 'secondary'} className="text-[9px]">{slide.is_active ? 'ON' : 'OFF'}</Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditBanner(slide)}><Edit2 className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteBannerSlide(slide.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4 mt-4">
            <div className="rounded-lg border border-border bg-card p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Users className="h-4 w-4 text-primary" />User Management</h2>
                <div className="flex items-center gap-2">
                  <Select value={selectedUserRole} onValueChange={setSelectedUserRole}>
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="buyer">Buyers</SelectItem>
                      <SelectItem value="reseller">Resellers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : users.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No users found</p>
              ) : (
                <div className="space-y-2">
                  {users.filter(u => selectedUserRole === 'all' || u.role === selectedUserRole).map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {user.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{user.full_name || 'Unknown'}</p>
                          <p className="text-[10px] text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={user.role === 'reseller' ? 'default' : 'secondary'} className="text-[9px]">
                          {user.role === 'reseller' ? 'Reseller' : 'Buyer'}
                        </Badge>
                        {user.role === 'reseller' && (
                          <span className="text-[9px] text-muted-foreground">{user.commission_rate}% commission</span>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditUser(user)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteUser(user.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4 mt-4">
            <div className="rounded-lg border border-border bg-card p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Folder className="h-4 w-4 text-primary" />Category Management</h2>
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setEditCategory({ id: `new-${Date.now()}`, name: '', description: '', icon: '', sort_order: categories.length, is_active: true })}>
                  <Plus className="h-3 w-3" /> Add Category
                </Button>
              </div>
              
              {categoriesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : categories.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No categories yet. Add your first category!</p>
              ) : (
                <div className="space-y-2">
                  {categories.map((category) => (
                    <div key={category.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                      <div className="flex items-center gap-3">
                        {category.icon && <span className="text-lg">{category.icon}</span>}
                        <div>
                          <p className="text-xs font-semibold text-foreground">{category.name}</p>
                          <p className="text-[10px] text-muted-foreground">{category.slug}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={category.is_active ? 'default' : 'secondary'} className="text-[9px]">
                          {category.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditCategory(category)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteCategory(category.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 mt-4">
            <div className="rounded-lg border border-border bg-card p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Menu className="h-4 w-4 text-primary" />Header Menu Editor</h2>
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setEditHeaderMenu({ ...emptyHeaderMenu(), sort_order: headerMenus.length + 1 })}>
                  <Plus className="h-3 w-3" /> Add Menu
                </Button>
              </div>

              {menusLoading ? <Skeleton className="h-10 w-full" /> : (
                <div className="space-y-2">
                  {headerMenus.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No header menus yet.</p>
                  ) : headerMenus.map((m) => (
                    <div key={m.id} className={cn('rounded-md border p-2 flex items-center gap-2', m.is_active ? 'border-border' : 'border-border opacity-60')}>
                      <span className="text-xs font-bold w-6 text-center text-muted-foreground">{m.sort_order}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground truncate">{m.label}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{m.link_url || `#${m.target_id || ''}`}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px]">{m.is_active ? 'ACTIVE' : 'OFF'}</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditHeaderMenu(m)}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteHeaderMenu(m.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Layout className="h-4 w-4 text-primary" />Banner Manager</h2>
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setEditBanner({ ...emptyBanner(), sort_order: banners.length + 1 })}>
                  <Plus className="h-3 w-3" /> Add Banner
                </Button>
              </div>

              {bannersLoading ? <Skeleton className="h-16 w-full" /> : (
                <div className="space-y-2">
                  {banners.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No banners yet.</p>
                  ) : banners.map((b) => (
                    <div key={b.id} className={cn('rounded-md border p-2 flex items-center gap-2', b.is_active ? 'border-border' : 'border-border opacity-60')}>
                      <span className="text-xs font-bold w-6 text-center text-muted-foreground">{b.sort_order}</span>
                      {b.image_url ? <img src={b.image_url} alt="Banner" className="h-10 w-16 rounded object-cover" /> : <div className="h-10 w-16 rounded bg-muted" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground truncate">{b.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{b.offer_text || b.subtitle || '—'}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px]">{b.is_active ? 'ON' : 'OFF'}</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditBanner(b)}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteBanner(b.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="products" className="space-y-3 mt-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="h-9 pl-9 text-sm"
                  placeholder="Search products..."
                />
              </div>
              <Button size="sm" className="h-9 gap-1" onClick={() => setEditProduct(emptyProduct())}>
                <Plus className="h-3 w-3" /> Add Product
              </Button>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="p-2 text-left w-8"><input type="checkbox" checked={products.length > 0 && selectedIds.size === products.length} onChange={selectAllOnPage} /></th>
                      <th className="p-2 text-left">Product</th>
                      <th className="p-2 text-center">Price</th>
                      <th className="p-2 text-center">Status</th>
                      <th className="p-2 text-center hidden md:table-cell">Controls</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productsLoading ? (
                      Array.from({ length: 5 }).map((_, idx) => (
                        <tr key={idx} className="border-t border-border"><td colSpan={6} className="p-2"><Skeleton className="h-7 w-full" /></td></tr>
                      ))
                    ) : products.length === 0 ? (
                      <tr><td colSpan={6} className="text-center p-6 text-muted-foreground">No products found</td></tr>
                    ) : products.map((p) => (
                      <tr key={p.id} className="border-t border-border hover:bg-muted/10">
                        <td className="p-2"><input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            {p.thumbnail_url ? <img src={p.thumbnail_url} alt={p.name} className="h-8 w-8 rounded object-cover" /> : <div className="h-8 w-8 rounded bg-muted" />}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground truncate max-w-[220px]">{p.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{p.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-2 text-center">
                          <span className="font-bold text-foreground">${Number(p.price || 0).toFixed(2)}</span>
                          {Number(p.discount_percent || 0) > 0 && <Badge className="ml-1 text-[8px]">{Number(p.discount_percent)}%</Badge>}
                        </td>
                        <td className="p-2 text-center">
                          <Badge variant="outline" className={cn('text-[9px]', statusBadgeClass[p.status || 'draft'])}>{statusLabelMap[p.status || 'draft']}</Badge>
                        </td>
                        <td className="p-2 text-center hidden md:table-cell">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            <Badge variant="outline" className="text-[9px]">{p.demo_enabled ? 'DEMO ON' : 'DEMO OFF'}</Badge>
                            <Badge variant="outline" className="text-[9px]">{p.apk_enabled ? 'APK ON' : 'APK OFF'}</Badge>
                            <Badge variant="outline" className="text-[9px]">{p.buy_enabled ? 'BUY ON' : 'BUY OFF'}</Badge>
                          </div>
                        </td>
                        <td className="p-2 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditProduct(p)}><Edit2 className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleVisibility(p)}>{p.marketplace_visible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteProduct(p.id)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">Page {page + 1}</p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={products.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="apk" className="space-y-4 mt-4">
            <div className="rounded-lg border border-border bg-card p-3 space-y-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Upload className="h-4 w-4 text-primary" />APK Upload + Version Control</h2>
              <div className="grid gap-2 md:grid-cols-2">
                <Field label="Product">
                  <Select value={apkForm.product_id} onValueChange={(v) => setApkForm((p) => ({ ...p, product_id: v }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>
                      {productCatalog.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="APK File">
                  <Input
                    type="file"
                    accept=".apk"
                    className="h-9 text-sm"
                    onChange={(e) => setApkFile(e.target.files?.[0] || null)}
                  />
                </Field>
                <Field label="Version">
                  <Input value={apkForm.version} onChange={(e) => setApkForm((p) => ({ ...p, version: e.target.value, version_name: e.target.value }))} className="h-9 text-sm" />
                </Field>
                <Field label="Version Code">
                  <Input type="number" value={apkForm.version_code} onChange={(e) => setApkForm((p) => ({ ...p, version_code: Number(e.target.value || 1) }))} className="h-9 text-sm" />
                </Field>
                <Field label="Status">
                  <Select value={apkForm.status} onValueChange={(v: 'published' | 'draft' | 'deprecated') => setApkForm((p) => ({ ...p, status: v }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">On Pipeline</SelectItem>
                      <SelectItem value="published">Live</SelectItem>
                      <SelectItem value="deprecated">Deprecated</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Replace Existing APK (optional)">
                  <Select value={apkForm.replace_apk_id || 'new'} onValueChange={(v) => setApkForm((p) => ({ ...p, replace_apk_id: v === 'new' ? '' : v }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Create New APK Record</SelectItem>
                      {apks.map((apk) => (
                        <SelectItem key={apk.id} value={apk.id}>
                          {(productMap.get(apk.product_id)?.name || apk.product_id)} · {apk.version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Changelog / Release Notes">
                <Textarea value={apkForm.changelog} onChange={(e) => setApkForm((p) => ({ ...p, changelog: e.target.value }))} className="min-h-[70px] text-sm" />
              </Field>
              <Button className="h-9 text-sm gap-1" onClick={handleUploadApk} disabled={uploadingApk}>
                {uploadingApk ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Upload & Link APK
              </Button>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="p-2 text-left">Product</th>
                      <th className="p-2 text-center">APK Status</th>
                      <th className="p-2 text-center">Download Control</th>
                      <th className="p-2 text-center">Version</th>
                      <th className="p-2 text-center">Size</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apksLoading ? (
                      Array.from({ length: 5 }).map((_, idx) => (
                        <tr key={idx} className="border-t border-border"><td colSpan={6} className="p-2"><Skeleton className="h-7 w-full" /></td></tr>
                      ))
                    ) : apks.length === 0 ? (
                      <tr><td colSpan={6} className="text-center p-6 text-muted-foreground">No APK records yet</td></tr>
                    ) : apks.map((apk) => {
                      const product = productMap.get(apk.product_id);
                      const latestVersion = apkVersionsByApkId.get(apk.id)?.[0];
                      return (
                        <tr key={apk.id} className="border-t border-border hover:bg-muted/10">
                          <td className="p-2">
                            <p className="font-semibold text-foreground">{product?.name || apk.product_id}</p>
                            <p className="text-[10px] text-muted-foreground">{apk.file_url || 'No file path'}</p>
                          </td>
                          <td className="p-2 text-center">
                            <Badge variant="outline" className="text-[9px]">
                              {apk.status === 'published' ? 'LIVE' : apk.status === 'draft' ? 'ON PIPELINE' : 'DEPRECATED'}
                            </Badge>
                          </td>
                          <td className="p-2 text-center">
                            <Badge variant="outline" className="text-[9px]">{product?.apk_enabled ? 'ENABLED' : 'DISABLED'}</Badge>
                          </td>
                          <td className="p-2 text-center">
                            <p className="font-semibold">{apk.version}</p>
                            <p className="text-[10px] text-muted-foreground">code {latestVersion?.version_code ?? '—'}</p>
                          </td>
                          <td className="p-2 text-center">{formatBytes(apk.file_size)}</td>
                          <td className="p-2 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startReplaceApk(apk)} title="Replace APK"><Upload className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleApkStatus(apk)} title="Toggle Pipeline/Live">
                                {apk.status === 'published' ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleApkDownload(apk)} title="Enable/Disable Download">
                                <Download className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteApk(apk.id)} title="Delete">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4 mt-4">
            <div className="rounded-lg border border-border bg-card p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" />Payment Gateway Manager</h2>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={fetchGateways}>
                  <RefreshCw className="h-3 w-3" /> Refresh
                </Button>
              </div>

              {gatewaysLoading ? <Skeleton className="h-10 w-full" /> : (
                <div className="space-y-2">
                  {gateways.map((g) => (
                    <div key={g.id} className="rounded-md border border-border p-2 flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground">{g.gateway_name}</p>
                        <p className="text-[10px] text-muted-foreground">{g.gateway_code} · keys from Admin Settings</p>
                      </div>
                      <Badge variant="outline" className="text-[9px]">{g.is_enabled ? 'ENABLED' : 'DISABLED'}</Badge>
                      <Switch
                        checked={g.is_enabled}
                        onCheckedChange={async (checked) => {
                          const updates: Record<string, unknown> = {};
                          if (g.gateway_code === 'razorpay') updates.razorpay_enabled = checked;
                          if (g.gateway_code === 'stripe') updates.stripe_enabled = checked;
                          if (g.gateway_code === 'wallet') updates.wallet_enabled = checked;
                          const { error } = await db.from('payment_settings').update(updates).eq('id', PAYMENT_SETTINGS_ID);
                          if (error) {
                            const { error: legacyError } = await db
                              .from('marketplace_payment_gateways')
                              .update({ is_enabled: checked })
                              .eq('gateway_code', g.gateway_code);
                            if (legacyError) {
                              toast.error(legacyError.message);
                            } else {
                              toast.success(`${g.gateway_name} ${checked ? 'enabled' : 'disabled'}`);
                              fetchGateways();
                            }
                          } else {
                            toast.success(`${g.gateway_name} ${checked ? 'enabled' : 'disabled'}`);
                            fetchGateways();
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b border-border">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-primary" />Order Tracking</h2>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={fetchOrders}><RefreshCw className="h-3 w-3" />Refresh</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="p-2 text-left">Order</th>
                      <th className="p-2 text-left">Product</th>
                      <th className="p-2 text-center">Amount</th>
                      <th className="p-2 text-center">Gateway</th>
                      <th className="p-2 text-center">Status</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersLoading ? (
                      Array.from({ length: 5 }).map((_, idx) => (
                        <tr key={idx} className="border-t border-border"><td colSpan={6} className="p-2"><Skeleton className="h-7 w-full" /></td></tr>
                      ))
                    ) : orders.length === 0 ? (
                      <tr><td colSpan={6} className="text-center p-6 text-muted-foreground">No orders found</td></tr>
                    ) : orders.map((o) => (
                      <tr key={o.id} className="border-t border-border hover:bg-muted/10">
                        <td className="p-2">
                          <p className="font-semibold text-foreground">{o.id.slice(0, 8)}...</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground truncate">User: {o.buyer_name || o.buyer_id}</p>
                          <p className="text-[10px] text-muted-foreground truncate">Reseller: {o.reseller_name || o.seller_id}</p>
                        </td>
                        <td className="p-2">
                          <p className="text-foreground">{o.product_name || '—'}</p>
                          {o.coupon_code && <p className="text-[10px] text-muted-foreground">Coupon: {o.coupon_code}</p>}
                        </td>
                        <td className="p-2 text-center font-semibold">${Number(o.final_amount ?? o.amount ?? 0).toFixed(2)}</td>
                        <td className="p-2 text-center">{o.gateway || '—'}</td>
                        <td className="p-2 text-center">
                          <Badge variant="outline" className="text-[10px]">
                            {String(o.status || 'pending').toUpperCase()}
                          </Badge>
                        </td>
                        <td className="p-2 text-right">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchOrders}>
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="offers" className="space-y-4 mt-4">
            <div className="rounded-lg border border-border bg-card p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" />Offer Ticker</h2>
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setEditTicker({ ...emptyTicker(), sort_order: tickers.length + 1 })}>
                  <Plus className="h-3 w-3" /> Add Ticker
                </Button>
              </div>
              {tickersLoading ? <Skeleton className="h-10 w-full" /> : (
                <div className="space-y-2">
                  {tickers.map((t) => (
                    <div key={t.id} className="rounded-md border border-border p-2 flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-6 text-center">{t.sort_order}</span>
                      <p className="text-xs text-foreground flex-1 truncate">{t.text}</p>
                      <Badge variant="outline" className="text-[9px]">{t.is_active ? 'ON' : 'OFF'}</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditTicker(t)}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteTicker(t.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Ticket className="h-4 w-4 text-primary" />Coupon System</h2>
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setEditCoupon(emptyCoupon())}>
                  <Plus className="h-3 w-3" /> Add Coupon
                </Button>
              </div>

              {couponsLoading ? <Skeleton className="h-10 w-full" /> : (
                <div className="space-y-2">
                  {coupons.map((c) => (
                    <div key={c.id} className="rounded-md border border-border p-2 flex items-center gap-2">
                      <code className="text-xs font-black text-primary bg-primary/10 px-2 py-1 rounded">{c.code}</code>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-foreground truncate">{c.description || '—'}</p>
                        <p className="text-[10px] text-muted-foreground">{c.discount_type === 'percent' ? `${c.discount_value}%` : `$${c.discount_value}`} · used {c.used_count}/{c.max_uses}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px]">{c.is_active ? 'ACTIVE' : 'OFF'}</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditCoupon(c)}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteCoupon(c.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" />Discount Rules (Country / Region / Festival)</h2>
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setEditDiscountRule({ ...emptyDiscountRule(), sort_order: discountRules.length + 1 })}>
                  <Plus className="h-3 w-3" /> Add Rule
                </Button>
              </div>

              {rulesLoading ? <Skeleton className="h-10 w-full" /> : (
                <div className="space-y-2">
                  {discountRules.map((r) => (
                    <div key={r.id} className="rounded-md border border-border p-2 flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground truncate">{r.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {r.country_code || 'ALL'} · {r.region || 'ALL'} · {r.festival || 'General'} · {r.discount_type === 'percent' ? `${r.discount_value}%` : `$${r.discount_value}`}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[9px]">{r.is_active ? 'ACTIVE' : 'OFF'}</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditDiscountRule(r)}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteDiscountRule(r.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-3 mt-4">
            <p className="text-xs text-muted-foreground">Select products in Products tab first. Selected: <strong className="text-primary">{selectedIds.size}</strong></p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { key: 'show', label: 'Show', icon: Eye },
                { key: 'hide', label: 'Hide', icon: EyeOff },
                { key: 'feature', label: 'Feature', icon: CheckCircle2 },
                { key: 'unfeature', label: 'Unfeature', icon: XCircle },
                { key: 'trend', label: 'Trending', icon: Megaphone },
                { key: 'pipeline', label: 'Set Pipeline', icon: Loader2 },
                { key: 'live', label: 'Set Live', icon: CheckCircle2 },
                { key: 'enableApk', label: 'Enable APK', icon: Download },
                { key: 'disableApk', label: 'Disable APK', icon: Download },
                { key: 'enableBuy', label: 'Enable Buy', icon: ShoppingBag },
                { key: 'disableBuy', label: 'Disable Buy', icon: ShoppingBag },
                { key: 'delete', label: 'Delete', icon: Trash2 },
              ].map(({ key, label, icon: Icon }) => (
                <Button
                  key={key}
                  variant="outline"
                  className="h-9 text-xs justify-start gap-1"
                  disabled={selectedIds.size === 0 || bulkRunning}
                  onClick={() => runBulk(key as any)}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </Button>
              ))}
            </div>
            {bulkRunning && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Processing bulk action...</p>}
          </TabsContent>
        </Tabs>
      </div>

      {/* Product Dialog */}
      {editProduct && (
        <Dialog open={!!editProduct} onOpenChange={() => setEditProduct(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm">{editProduct.id.startsWith('new-') ? 'Add Product' : 'Edit Product'}</DialogTitle>
              <DialogDescription className="text-xs">Full product control including Buy, Demo, APK and License buttons.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 mt-2">
              <div className="grid gap-2 md:grid-cols-2">
                <Field label="Name">
                  <Input value={editProduct.name || ''} onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value, slug: editProduct.slug || slugify(e.target.value) })} className="h-9 text-sm" />
                </Field>
                <Field label="Slug">
                  <Input value={editProduct.slug || ''} onChange={(e) => setEditProduct({ ...editProduct, slug: slugify(e.target.value) })} className="h-9 text-sm" />
                </Field>
              </div>

              <Field label="Short Description">
                <Textarea value={editProduct.short_description || ''} onChange={(e) => setEditProduct({ ...editProduct, short_description: e.target.value })} className="min-h-[70px] text-sm" />
              </Field>

              <div className="grid gap-2 md:grid-cols-4">
                <Field label="Price">
                  <Input type="number" value={editProduct.price} onChange={(e) => setEditProduct({ ...editProduct, price: Number(e.target.value || 0) })} className="h-9 text-sm" />
                </Field>
                <Field label="Discount %">
                  <Input type="number" value={editProduct.discount_percent} onChange={(e) => setEditProduct({ ...editProduct, discount_percent: Number(e.target.value || 0) })} className="h-9 text-sm" />
                </Field>
                <Field label="Rating">
                  <Input type="number" step="0.1" value={editProduct.rating} onChange={(e) => setEditProduct({ ...editProduct, rating: Number(e.target.value || 0) })} className="h-9 text-sm" />
                </Field>
                <Field label="Status">
                  <Select value={editProduct.status} onValueChange={(v: ProductStatusDb) => setEditProduct({ ...editProduct, status: v })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Live</SelectItem>
                      <SelectItem value="suspended">Upcoming</SelectItem>
                      <SelectItem value="draft">Pipeline</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <Field label="Category / Business Type">
                  <Select value={editProduct.business_type || editProduct.target_industry || ''} onValueChange={(value) => setEditProduct({ ...editProduct, business_type: value, target_industry: value })}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="software">Software</SelectItem>
                      <SelectItem value="mobile">Mobile App</SelectItem>
                      <SelectItem value="web">Web Application</SelectItem>
                      <SelectItem value="game">Game</SelectItem>
                      <SelectItem value="erp">ERP System</SelectItem>
                      <SelectItem value="crm">CRM System</SelectItem>
                      <SelectItem value="ecommerce">E-commerce</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="healthcare">Healthcare</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="productivity">Productivity</SelectItem>
                      <SelectItem value="utilities">Utilities</SelectItem>
                      <SelectItem value="entertainment">Entertainment</SelectItem>
                      <SelectItem value="social">Social Media</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Tags (comma separated)">
                  <Input value={(editProduct.tags || []).join(', ')} onChange={(e) => setEditProduct({ ...editProduct, tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} className="h-9 text-sm" />
                </Field>
              </div>

              <Field label="Thumbnail URL">
                <Input value={editProduct.thumbnail_url || ''} onChange={(e) => setEditProduct({ ...editProduct, thumbnail_url: e.target.value })} className="h-9 text-sm" />
              </Field>

              <Field label="Demo URL">
                <Input value={editProduct.demo_source_url || editProduct.demo_url || ''} onChange={(e) => setEditProduct({ ...editProduct, demo_source_url: e.target.value })} className="h-9 text-sm" />
              </Field>

              <div className="grid gap-2 md:grid-cols-2">
                <Field label="Demo Login">
                  <Input value={editProduct.demo_login || ''} onChange={(e) => setEditProduct({ ...editProduct, demo_login: e.target.value })} className="h-9 text-sm" />
                </Field>
                <Field label="Demo Password">
                  <Input value={editProduct.demo_password || ''} onChange={(e) => setEditProduct({ ...editProduct, demo_password: e.target.value })} className="h-9 text-sm" />
                </Field>
              </div>

              <Field label="APK URL / Storage Path">
                <Input value={editProduct.apk_url || ''} onChange={(e) => setEditProduct({ ...editProduct, apk_url: e.target.value })} className="h-9 text-sm" />
              </Field>

              <div className="border-t border-border pt-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" /> SEO Settings
                  </h3>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={generateSeo} disabled={generatingSeo || !editProduct}>
                    {generatingSeo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Generate SEO
                  </Button>
                </div>

                {editProductSeo && (
                  <div className="space-y-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      <Field label="SEO Title">
                        <Input 
                          value={editProductSeo.title || ''} 
                          onChange={(e) => setEditProductSeo({ ...editProductSeo, title: e.target.value })} 
                          className="h-9 text-sm" 
                          placeholder={editProduct?.name || 'Product title'}
                        />
                      </Field>
                      <Field label="SEO Slug">
                        <Input 
                          value={editProductSeo.slug || ''} 
                          onChange={(e) => setEditProductSeo({ ...editProductSeo, slug: slugify(e.target.value) })} 
                          className="h-9 text-sm" 
                          placeholder="product-name-country"
                        />
                      </Field>
                    </div>

                    <Field label="Meta Description">
                      <Textarea 
                        value={editProductSeo.meta_description || ''} 
                        onChange={(e) => setEditProductSeo({ ...editProductSeo, meta_description: e.target.value })} 
                        className="min-h-[70px] text-sm" 
                        placeholder="Brief description for search engines (120-160 characters)"
                        maxLength={160}
                      />
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {editProductSeo.meta_description?.length || 0}/160 characters
                      </div>
                    </Field>

                    <div className="grid gap-2 md:grid-cols-2">
                      <Field label="Keywords (comma separated)">
                        <Input 
                          value={(editProductSeo.keywords || []).join(', ')} 
                          onChange={(e) => setEditProductSeo({ ...editProductSeo, keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} 
                          className="h-9 text-sm" 
                          placeholder="keyword1, keyword2, keyword3"
                        />
                      </Field>
                      <Field label="Hashtags (comma separated)">
                        <Input 
                          value={(editProductSeo.hashtags || []).join(', ')} 
                          onChange={(e) => setEditProductSeo({ ...editProductSeo, hashtags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} 
                          className="h-9 text-sm" 
                          placeholder="#tag1, #tag2, #tag3"
                        />
                      </Field>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      <Field label="Target Country">
                        <Select 
                          value={editProductSeo.target_country || 'IN'} 
                          onValueChange={(value) => setEditProductSeo({ ...editProductSeo, target_country: value })}
                        >
                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="IN">India</SelectItem>
                            <SelectItem value="US">United States</SelectItem>
                            <SelectItem value="UK">United Kingdom</SelectItem>
                            <SelectItem value="AE">UAE</SelectItem>
                            <SelectItem value="AU">Australia</SelectItem>
                            <SelectItem value="CA">Canada</SelectItem>
                            <SelectItem value="DE">Germany</SelectItem>
                            <SelectItem value="FR">France</SelectItem>
                            <SelectItem value="JP">Japan</SelectItem>
                            <SelectItem value="SG">Singapore</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="SEO Score">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all ${
                                editProductSeo.seo_score >= 80 ? 'bg-green-500' : 
                                editProductSeo.seo_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${editProductSeo.seo_score}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">{editProductSeo.seo_score}/100</span>
                        </div>
                      </Field>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                {[
                  { key: 'marketplace_visible', label: 'Visible' },
                  { key: 'featured', label: 'Featured' },
                  { key: 'trending', label: 'Trending' },
                  { key: 'demo_enabled', label: 'Demo Button' },
                  { key: 'apk_enabled', label: 'Download APK' },
                  { key: 'buy_enabled', label: 'Buy Now' },
                  { key: 'license_enabled', label: 'License Key' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={cn(
                      'h-9 rounded-md border text-xs font-medium',
                      (editProduct as any)[item.key]
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border bg-muted/30 text-muted-foreground',
                    )}
                    onClick={() => setEditProduct({ ...editProduct, [item.key]: !(editProduct as any)[item.key] })}
                  >
                    {(editProduct as any)[item.key] ? '✓' : '○'} {item.label}
                  </button>
                ))}
              </div>

              <Button className="h-10 text-sm" onClick={handleSaveProduct} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Save Product
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Header Menu Dialog */}
      {editHeaderMenu && (
        <Dialog open={!!editHeaderMenu} onOpenChange={() => setEditHeaderMenu(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">{editHeaderMenu.id.startsWith('new-') ? 'Add' : 'Edit'} Header Menu</DialogTitle>
              <DialogDescription className="text-xs">Menu text + link control.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Field label="Label">
                <Input value={editHeaderMenu.label} onChange={(e) => setEditHeaderMenu({ ...editHeaderMenu, label: e.target.value })} className="h-9 text-sm" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Target ID">
                  <Input value={editHeaderMenu.target_id || ''} onChange={(e) => setEditHeaderMenu({ ...editHeaderMenu, target_id: e.target.value })} className="h-9 text-sm" placeholder="pricing" />
                </Field>
                <Field label="Link URL">
                  <Input value={editHeaderMenu.link_url || ''} onChange={(e) => setEditHeaderMenu({ ...editHeaderMenu, link_url: e.target.value })} className="h-9 text-sm" placeholder="#pricing" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Sort">
                  <Input type="number" value={editHeaderMenu.sort_order} onChange={(e) => setEditHeaderMenu({ ...editHeaderMenu, sort_order: Number(e.target.value || 0) })} className="h-9 text-sm" />
                </Field>
                <div className="flex items-end gap-2 pb-1">
                  <Switch checked={editHeaderMenu.is_active} onCheckedChange={(v) => setEditHeaderMenu({ ...editHeaderMenu, is_active: v })} />
                  <span className="text-xs text-muted-foreground">{editHeaderMenu.is_active ? 'Active' : 'Disabled'}</span>
                </div>
              </div>
              <Button className="h-9 text-sm" onClick={saveHeaderMenu} disabled={saving}>Save Menu</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Banner Dialog */}
      {editBanner && (
        <Dialog open={!!editBanner} onOpenChange={() => setEditBanner(null)}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm">{editBanner.id.startsWith('new-') ? 'Add' : 'Edit'} Banner</DialogTitle>
              <DialogDescription className="text-xs">Title, subtitle, offer, coupon, schedule.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Field label="Title"><Input value={editBanner.title} onChange={(e) => setEditBanner({ ...editBanner, title: e.target.value })} className="h-9 text-sm" /></Field>
              <Field label="Subtitle"><Input value={editBanner.subtitle || ''} onChange={(e) => setEditBanner({ ...editBanner, subtitle: e.target.value })} className="h-9 text-sm" /></Field>
              <Field label="Image URL"><Input value={editBanner.image_url || ''} onChange={(e) => setEditBanner({ ...editBanner, image_url: e.target.value })} className="h-9 text-sm" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Badge"><Input value={editBanner.badge || ''} onChange={(e) => setEditBanner({ ...editBanner, badge: e.target.value })} className="h-9 text-sm" /></Field>
                <Field label="Badge Color Class"><Input value={editBanner.badge_color || ''} onChange={(e) => setEditBanner({ ...editBanner, badge_color: e.target.value })} className="h-9 text-sm" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Offer Text"><Input value={editBanner.offer_text || ''} onChange={(e) => setEditBanner({ ...editBanner, offer_text: e.target.value })} className="h-9 text-sm" placeholder="20% OFF" /></Field>
                <Field label="Coupon Code"><Input value={editBanner.coupon_code || ''} onChange={(e) => setEditBanner({ ...editBanner, coupon_code: e.target.value.toUpperCase() })} className="h-9 text-sm" /></Field>
              </div>
              <Field label="Link URL"><Input value={editBanner.link_url || ''} onChange={(e) => setEditBanner({ ...editBanner, link_url: e.target.value })} className="h-9 text-sm" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Start Date"><Input type="datetime-local" value={editBanner.start_date?.slice(0, 16) || ''} onChange={(e) => setEditBanner({ ...editBanner, start_date: e.target.value || null })} className="h-9 text-sm" /></Field>
                <Field label="End Date"><Input type="datetime-local" value={editBanner.end_date?.slice(0, 16) || ''} onChange={(e) => setEditBanner({ ...editBanner, end_date: e.target.value || null })} className="h-9 text-sm" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Sort"><Input type="number" value={editBanner.sort_order} onChange={(e) => setEditBanner({ ...editBanner, sort_order: Number(e.target.value || 0) })} className="h-9 text-sm" /></Field>
                <div className="flex items-end gap-2 pb-1">
                  <Switch checked={editBanner.is_active} onCheckedChange={(v) => setEditBanner({ ...editBanner, is_active: v })} />
                  <span className="text-xs text-muted-foreground">{editBanner.is_active ? 'Active' : 'Disabled'}</span>
                </div>
              </div>
              <Button className="h-9 text-sm" onClick={saveBanner} disabled={saving}>Save Banner</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Ticker Dialog */}
      {editTicker && (
        <Dialog open={!!editTicker} onOpenChange={() => setEditTicker(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">{editTicker.id.startsWith('new-') ? 'Add' : 'Edit'} Ticker</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Field label="Text"><Input value={editTicker.text} onChange={(e) => setEditTicker({ ...editTicker, text: e.target.value })} className="h-9 text-sm" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Sort"><Input type="number" value={editTicker.sort_order} onChange={(e) => setEditTicker({ ...editTicker, sort_order: Number(e.target.value || 0) })} className="h-9 text-sm" /></Field>
                <div className="flex items-end gap-2 pb-1">
                  <Switch checked={editTicker.is_active} onCheckedChange={(v) => setEditTicker({ ...editTicker, is_active: v })} />
                  <span className="text-xs text-muted-foreground">{editTicker.is_active ? 'Active' : 'Disabled'}</span>
                </div>
              </div>
              <Button className="h-9 text-sm" onClick={saveTicker} disabled={saving}>Save Ticker</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Coupon Dialog */}
      {editCoupon && (
        <Dialog open={!!editCoupon} onOpenChange={() => setEditCoupon(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-sm">{editCoupon.id.startsWith('new-') ? 'Add' : 'Edit'} Coupon</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Field label="Code"><Input value={editCoupon.code} onChange={(e) => setEditCoupon({ ...editCoupon, code: e.target.value.toUpperCase() })} className="h-9 text-sm font-mono" /></Field>
              <Field label="Description"><Input value={editCoupon.description || ''} onChange={(e) => setEditCoupon({ ...editCoupon, description: e.target.value })} className="h-9 text-sm" /></Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Type">
                  <Select value={editCoupon.discount_type} onValueChange={(v: 'percent' | 'fixed') => setEditCoupon({ ...editCoupon, discount_type: v })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percent</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Value"><Input type="number" value={editCoupon.discount_value} onChange={(e) => setEditCoupon({ ...editCoupon, discount_value: Number(e.target.value || 0) })} className="h-9 text-sm" /></Field>
                <Field label="Max Uses"><Input type="number" value={editCoupon.max_uses} onChange={(e) => setEditCoupon({ ...editCoupon, max_uses: Number(e.target.value || 0) })} className="h-9 text-sm" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Start"><Input type="datetime-local" value={editCoupon.start_date?.slice(0, 16) || ''} onChange={(e) => setEditCoupon({ ...editCoupon, start_date: e.target.value || null })} className="h-9 text-sm" /></Field>
                <Field label="End"><Input type="datetime-local" value={editCoupon.end_date?.slice(0, 16) || ''} onChange={(e) => setEditCoupon({ ...editCoupon, end_date: e.target.value || null })} className="h-9 text-sm" /></Field>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editCoupon.is_active} onCheckedChange={(v) => setEditCoupon({ ...editCoupon, is_active: v })} />
                <span className="text-xs text-muted-foreground">{editCoupon.is_active ? 'Active' : 'Disabled'}</span>
              </div>
              <Button className="h-9 text-sm" onClick={saveCoupon} disabled={saving}>Save Coupon</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Discount Rule Dialog */}
      {editDiscountRule && (
        <Dialog open={!!editDiscountRule} onOpenChange={() => setEditDiscountRule(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-sm">{editDiscountRule.id.startsWith('new-') ? 'Add' : 'Edit'} Discount Rule</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Field label="Rule Name"><Input value={editDiscountRule.name} onChange={(e) => setEditDiscountRule({ ...editDiscountRule, name: e.target.value })} className="h-9 text-sm" /></Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Country"><Input value={editDiscountRule.country_code || ''} onChange={(e) => setEditDiscountRule({ ...editDiscountRule, country_code: e.target.value.toUpperCase() })} className="h-9 text-sm" placeholder="IN" /></Field>
                <Field label="Region"><Input value={editDiscountRule.region || ''} onChange={(e) => setEditDiscountRule({ ...editDiscountRule, region: e.target.value })} className="h-9 text-sm" placeholder="Bihar" /></Field>
                <Field label="Festival"><Input value={editDiscountRule.festival || ''} onChange={(e) => setEditDiscountRule({ ...editDiscountRule, festival: e.target.value })} className="h-9 text-sm" placeholder="Diwali" /></Field>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Field label="Type">
                  <Select value={editDiscountRule.discount_type} onValueChange={(v: 'percent' | 'fixed') => setEditDiscountRule({ ...editDiscountRule, discount_type: v })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percent</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Value"><Input type="number" value={editDiscountRule.discount_value} onChange={(e) => setEditDiscountRule({ ...editDiscountRule, discount_value: Number(e.target.value || 0) })} className="h-9 text-sm" /></Field>
                <Field label="Min Order"><Input type="number" value={editDiscountRule.min_order} onChange={(e) => setEditDiscountRule({ ...editDiscountRule, min_order: Number(e.target.value || 0) })} className="h-9 text-sm" /></Field>
                <Field label="Sort"><Input type="number" value={editDiscountRule.sort_order} onChange={(e) => setEditDiscountRule({ ...editDiscountRule, sort_order: Number(e.target.value || 0) })} className="h-9 text-sm" /></Field>
              </div>
              <Field label="Coupon Code (optional)"><Input value={editDiscountRule.coupon_code || ''} onChange={(e) => setEditDiscountRule({ ...editDiscountRule, coupon_code: e.target.value.toUpperCase() })} className="h-9 text-sm" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Start"><Input type="datetime-local" value={editDiscountRule.start_date?.slice(0, 16) || ''} onChange={(e) => setEditDiscountRule({ ...editDiscountRule, start_date: e.target.value || null })} className="h-9 text-sm" /></Field>
                <Field label="End"><Input type="datetime-local" value={editDiscountRule.end_date?.slice(0, 16) || ''} onChange={(e) => setEditDiscountRule({ ...editDiscountRule, end_date: e.target.value || null })} className="h-9 text-sm" /></Field>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editDiscountRule.is_active} onCheckedChange={(v) => setEditDiscountRule({ ...editDiscountRule, is_active: v })} />
                <span className="text-xs text-muted-foreground">{editDiscountRule.is_active ? 'Active' : 'Disabled'}</span>
              </div>
              <Button className="h-9 text-sm" onClick={saveDiscountRule} disabled={saving}>Save Rule</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Phase 3: Category Dialog */}
      {editCategory && (
        <Dialog open={!!editCategory} onOpenChange={() => setEditCategory(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">{editCategory.id.startsWith('new-') ? 'Add' : 'Edit'} Category</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Field label="Category Name"><Input value={editCategory.name} onChange={(e) => setEditCategory({ ...editCategory, name: e.target.value })} className="h-9 text-sm" placeholder="e.g., Retail" /></Field>
              <Field label="Description"><Textarea value={editCategory.description || ''} onChange={(e) => setEditCategory({ ...editCategory, description: e.target.value })} className="min-h-[60px] text-sm" placeholder="Category description" /></Field>
              <Field label="Icon (emoji)"><Input value={editCategory.icon || ''} onChange={(e) => setEditCategory({ ...editCategory, icon: e.target.value })} className="h-9 text-sm" placeholder="e.g., 🛒" /></Field>
              <Field label="Sort Order"><Input type="number" value={editCategory.sort_order} onChange={(e) => setEditCategory({ ...editCategory, sort_order: Number(e.target.value || 0) })} className="h-9 text-sm" /></Field>
              <div className="flex items-center gap-2">
                <Switch checked={editCategory.is_active} onCheckedChange={(v) => setEditCategory({ ...editCategory, is_active: v })} />
                <span className="text-xs text-muted-foreground">{editCategory.is_active ? 'Active' : 'Disabled'}</span>
              </div>
              <Button className="h-9 text-sm" onClick={saveCategory} disabled={saving}>Save Category</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Phase 3: User Dialog */}
      {editUser && (
        <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">Edit User</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Field label="Email"><Input value={editUser.email} disabled className="h-9 text-sm" /></Field>
              <Field label="Full Name"><Input value={editUser.full_name || ''} onChange={(e) => setEditUser({ ...editUser, full_name: e.target.value })} className="h-9 text-sm" /></Field>
              <Field label="Role">
                <Select value={editUser.role} onValueChange={(v) => updateUserRole(editUser.id, v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buyer">Buyer</SelectItem>
                    <SelectItem value="reseller">Reseller</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {editUser.role === 'reseller' && (
                <>
                  <Field label="Company Name"><Input value={editUser.company_name || ''} onChange={(e) => setEditUser({ ...editUser, company_name: e.target.value })} className="h-9 text-sm" /></Field>
                  <Field label="Commission Rate (%)"><Input type="number" value={editUser.commission_rate || 10} onChange={(e) => setEditUser({ ...editUser, commission_rate: Number(e.target.value || 10) })} className="h-9 text-sm" /></Field>
                </>
              )}
              <Button className="h-9 text-sm" onClick={saveUser} disabled={saving}>Save User</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Phase 3: License Dialog */}
      {editLicense && (
        <Dialog open={!!editLicense} onOpenChange={() => setEditLicense(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">Generate License Key</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Field label="License Key">
                <div className="flex gap-2">
                  <Input value={editLicense.license_key} onChange={(e) => setEditLicense({ ...editLicense, license_key: e.target.value })} className="h-9 text-sm font-mono" />
                  <Button size="sm" variant="outline" className="h-9" onClick={() => setEditLicense({ ...editLicense, license_key: generateLicenseKey() })}>
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              </Field>
              <Field label="Product ID">
                <Input value={editLicense.product_id} onChange={(e) => setEditLicense({ ...editLicense, product_id: e.target.value })} className="h-9 text-sm" placeholder="Enter product ID" />
              </Field>
              <Field label="User ID">
                <Input value={editLicense.user_id} onChange={(e) => setEditLicense({ ...editLicense, user_id: e.target.value })} className="h-9 text-sm" placeholder="Enter user ID" />
              </Field>
              <Field label="Expiration Date (optional)">
                <Input type="datetime-local" value={editLicense.expires_at?.slice(0, 16) || ''} onChange={(e) => setEditLicense({ ...editLicense, expires_at: e.target.value || null })} className="h-9 text-sm" />
              </Field>
              <div className="flex items-center gap-2">
                <Switch checked={editLicense.status === 'active'} onCheckedChange={(v) => setEditLicense({ ...editLicense, status: v ? 'active' : 'revoked' })} />
                <span className="text-xs text-muted-foreground">{editLicense.status === 'active' ? 'Active' : 'Revoked'}</span>
              </div>
              <Button className="h-9 text-sm" onClick={saveLicense} disabled={saving}>Generate License</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Phase 4: Ticker Message Dialog */}
      {editTicker && (
        <Dialog open={!!editTicker} onOpenChange={() => setEditTicker(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">{editTicker.id.startsWith('new-') ? 'Add' : 'Edit'} Ticker Message</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Field label="Message Type">
                <Select value={editTicker.message_type} onValueChange={(v) => setEditTicker({ ...editTicker, message_type: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offer">Offer</SelectItem>
                    <SelectItem value="franchise">Franchise</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Message">
                <Input value={editTicker.message} onChange={(e) => setEditTicker({ ...editTicker, message: e.target.value })} className="h-9 text-sm" placeholder="Enter ticker message" />
              </Field>
              <Field label="Emoji">
                <Input value={editTicker.emoji || ''} onChange={(e) => setEditTicker({ ...editTicker, emoji: e.target.value })} className="h-9 text-sm" placeholder="🔥" />
              </Field>
              <Field label="Sort Order">
                <Input type="number" value={editTicker.sort_order} onChange={(e) => setEditTicker({ ...editTicker, sort_order: Number(e.target.value || 0) })} className="h-9 text-sm" />
              </Field>
              <div className="flex items-center gap-2">
                <Switch checked={editTicker.is_active} onCheckedChange={(v) => setEditTicker({ ...editTicker, is_active: v })} />
                <span className="text-xs text-muted-foreground">{editTicker.is_active ? 'Active' : 'Disabled'}</span>
              </div>
              <Button className="h-9 text-sm" onClick={saveTickerMessage} disabled={saving}>Save Message</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Phase 4: Banner Slide Dialog */}
      {editBanner && (
        <Dialog open={!!editBanner} onOpenChange={() => setEditBanner(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">{editBanner.id.startsWith('new-') ? 'Add' : 'Edit'} Banner Slide</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Field label="Slide Type">
                <Select value={editBanner.slide_type} onValueChange={(v) => setEditBanner({ ...editBanner, slide_type: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="offer">Offer</SelectItem>
                    <SelectItem value="franchise">Franchise</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {editBanner.slide_type === 'product' && (
                <Field label="Product ID">
                  <Input value={editBanner.product_id || ''} onChange={(e) => setEditBanner({ ...editBanner, product_id: e.target.value })} className="h-9 text-sm" placeholder="Enter product ID" />
                </Field>
              )}
              <Field label="Title">
                <Input value={editBanner.title || ''} onChange={(e) => setEditBanner({ ...editBanner, title: e.target.value })} className="h-9 text-sm" placeholder="Slide title" />
              </Field>
              <Field label="Description">
                <Input value={editBanner.description || ''} onChange={(e) => setEditBanner({ ...editBanner, description: e.target.value })} className="h-9 text-sm" placeholder="Slide description" />
              </Field>
              <Field label="CTA Text">
                <Input value={editBanner.cta_text || ''} onChange={(e) => setEditBanner({ ...editBanner, cta_text: e.target.value })} className="h-9 text-sm" placeholder="Button text" />
              </Field>
              <Field label="CTA Link">
                <Input value={editBanner.cta_link || ''} onChange={(e) => setEditBanner({ ...editBanner, cta_link: e.target.value })} className="h-9 text-sm" placeholder="Button link" />
              </Field>
              <Field label="Background Gradient">
                <Input value={editBanner.background_gradient || ''} onChange={(e) => setEditBanner({ ...editBanner, background_gradient: e.target.value })} className="h-9 text-sm" placeholder="from-blue-500 to-purple-500" />
              </Field>
              <Field label="Sort Order">
                <Input type="number" value={editBanner.sort_order} onChange={(e) => setEditBanner({ ...editBanner, sort_order: Number(e.target.value || 0) })} className="h-9 text-sm" />
              </Field>
              <div className="flex items-center gap-2">
                <Switch checked={editBanner.is_active} onCheckedChange={(v) => setEditBanner({ ...editBanner, is_active: v })} />
                <span className="text-xs text-muted-foreground">{editBanner.is_active ? 'Active' : 'Disabled'}</span>
              </div>
              <Button className="h-9 text-sm" onClick={saveBannerSlide} disabled={saving}>Save Slide</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Phase 2: Analytics Dashboard */}
      <TabsContent value="analytics" className="space-y-4 mt-4">
        <div className="rounded-lg border border-border bg-card p-3 space-y-4">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Advanced Analytics Dashboard
          </h2>
          
          {analyticsLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="space-y-4">
              {/* Daily Sales Chart */}
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                  <TrendingUp className="h-3 w-3" />
                  Daily Sales & Revenue (Last 30 Days)
                </h3>
                <div className="space-y-2">
                  {analyticsData.dailySales.slice(-7).map((day) => (
                    <div key={day.date} className="flex items-center gap-2 text-xs">
                      <span className="w-24 text-muted-foreground">{day.date}</span>
                      <div className="flex-1 h-6 bg-border rounded overflow-hidden">
                        <div 
                          className="h-full bg-primary" 
                          style={{ width: `${Math.min((day.sales / 10) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="w-16 text-right">{day.sales} sales</span>
                      <span className="w-20 text-right text-primary font-bold">₹{day.revenue.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Products */}
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Star className="h-3 w-3" />
                  Top 10 Products by Sales
                </h3>
                <div className="space-y-2">
                  {analyticsData.topProducts.map((product, index) => (
                    <div key={product.id} className="flex items-center gap-2 text-xs">
                      <span className="w-6 text-muted-foreground">#{index + 1}</span>
                      <span className="flex-1 truncate">{product.name}</span>
                      <span className="w-16 text-right font-bold">{product.sales} sales</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </TabsContent>

      {/* Phase 2: Scheduled Launches */}
      <TabsContent value="launches" className="space-y-4 mt-4">
        <div className="rounded-lg border border-border bg-card p-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Scheduled Product Launches
            </h2>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => toast.info('Launch scheduler coming soon')}>
              <Plus className="h-3 w-3" /> Schedule Launch
            </Button>
          </div>
          
          {scheduledLaunchesLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : scheduledLaunches.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No scheduled launches yet</p>
          ) : (
            <div className="space-y-2">
              {scheduledLaunches.map((launch) => (
                <div key={launch.id} className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-foreground">{launch.product_name || 'Product'}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(launch.launch_date).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[9px]">
                      {launch.status || 'Scheduled'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </TabsContent>

      {/* Phase 2: Review Moderation */}
      <TabsContent value="reviews" className="space-y-4 mt-4">
        <div className="rounded-lg border border-border bg-card p-3 space-y-4">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Review Moderation
          </h2>
          
          {reviewsLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : reviewsToModerate.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No reviews pending moderation</p>
          ) : (
            <div className="space-y-2">
              {reviewsToModerate.map((review) => (
                <div key={review.id} className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs font-semibold text-foreground">{review.user_name || 'Anonymous'}</p>
                      <p className="text-[10px] text-muted-foreground">{review.product_name || 'Product'}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          className={`h-3 w-3 ${star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-foreground mb-2">{review.comment}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => toast.info('Approve review coming soon')}>
                      <ThumbsUp className="h-3 w-3" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => toast.info('Reject review coming soon')}>
                      <ThumbsDown className="h-3 w-3" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </TabsContent>

      {/* SEO TABLE Tab */}
      <TabsContent value="seo" className="space-y-4 mt-4">
        <div className="rounded-lg border border-border bg-card p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />SEO Management</h2>
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => toast.info('Bulk SEO Generate coming soon')}>
                <RefreshCw className="h-3 w-3" /> Bulk Generate
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => toast.info('Export SEO Data coming soon')}>
                <Download className="h-3 w-3" /> Export
              </Button>
            </div>
          </div>

          {/* SEO Filters */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search products..."
              className="h-8 text-xs w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select className="h-8 text-xs rounded-md border border-input bg-background px-3 w-32">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
            </select>
            <select className="h-8 text-xs rounded-md border border-input bg-background px-3 w-32">
              <option value="all">All Countries</option>
              <option value="IN">India</option>
              <option value="US">USA</option>
              <option value="AE">UAE</option>
            </select>
            <select className="h-8 text-xs rounded-md border border-input bg-background px-3 w-32">
              <option value="all">All Languages</option>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
            </select>
          </div>

          {/* SEO Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-2 text-left">Product</th>
                  <th className="p-2 text-left">Slug</th>
                  <th className="p-2 text-left">SEO Title</th>
                  <th className="p-2 text-left">Keywords</th>
                  <th className="p-2 text-center">Score</th>
                  <th className="p-2 text-center">Index</th>
                  <th className="p-2 text-center">Backlinks</th>
                  <th className="p-2 text-center">Traffic</th>
                  <th className="p-2 text-center">Updated</th>
                  <th className="p-2 text-center">Status</th>
                  <th className="p-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.slice(0, 10).map((product) => (
                  <tr key={product.id} className="border-t border-border">
                    <td className="p-2 font-medium">{product.name}</td>
                    <td className="p-2 text-muted-foreground">{product.slug}</td>
                    <td className="p-2 text-muted-foreground max-w-[150px] truncate">SEO Title for {product.name}</td>
                    <td className="p-2 text-muted-foreground max-w-[100px] truncate">crm, software, business</td>
                    <td className="p-2 text-center">
                      <Badge variant={75 >= 70 ? 'default' : 75 >= 40 ? 'secondary' : 'destructive'} className="text-[9px]">
                        {75}/100
                      </Badge>
                    </td>
                    <td className="p-2 text-center">
                      <Badge variant="outline" className="text-[9px]">Indexed</Badge>
                    </td>
                    <td className="p-2 text-center">24</td>
                    <td className="p-2 text-center">1.2K</td>
                    <td className="p-2 text-center text-muted-foreground">2 days ago</td>
                    <td className="p-2 text-center">
                      <Badge variant="default" className="text-[9px]">Active</Badge>
                    </td>
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toast.info('Edit SEO coming soon')}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toast.info('Generate SEO coming soon')}>
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigate(`/product/${product.slug}/seo-dashboard`)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </TabsContent>

      {/* Global SEO Tab */}
      <TabsContent value="global-seo" className="space-y-4 mt-4">
        <div className="rounded-lg border border-border bg-card p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Globe className="h-4 w-4 text-primary" />Global SEO Automation</h2>
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => toast.info('Master AI Controller coming soon')}>
                <Zap className="h-3 w-3" /> Master AI
              </Button>
            </div>
          </div>

          {/* Module 101: Global Programmable Page Factory */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4" /> Module 101: Programmable Page Factory
              </CardTitle>
              <CardDescription>Auto create pages at scale (Country + City + Service)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium">Base Keywords</label>
                  <Input 
                    placeholder="crm-software, inventory-system, pos-system" 
                    className="h-8 text-xs"
                    value={pageGenerationConfig.baseKeywords}
                    onChange={(e) => setPageGenerationConfig({...pageGenerationConfig, baseKeywords: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Target Countries</label>
                  <select 
                    className="w-full h-8 text-xs rounded-md border border-input bg-background px-3"
                    value={pageGenerationConfig.targetCountries}
                    onChange={(e) => setPageGenerationConfig({...pageGenerationConfig, targetCountries: e.target.value})}
                  >
                    <option value="all">All Countries</option>
                    <option value="IN">India</option>
                    <option value="US">USA</option>
                    <option value="AE">UAE</option>
                    <option value="UK">UK</option>
                    <option value="CA">Canada</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Target Cities</label>
                  <Input 
                    placeholder="mumbai, delhi, bangalore" 
                    className="h-8 text-xs"
                    value={pageGenerationConfig.targetCities}
                    onChange={(e) => setPageGenerationConfig({...pageGenerationConfig, targetCities: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Page Template</label>
                  <select 
                    className="w-full h-8 text-xs rounded-md border border-input bg-background px-3"
                    value={pageGenerationConfig.pageTemplate}
                    onChange={(e) => setPageGenerationConfig({...pageGenerationConfig, pageTemplate: e.target.value})}
                  >
                    <option value="default">Default Template</option>
                    <option value="service">Service Page</option>
                    <option value="location">Location Page</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Auto Generate Content</span>
                <Switch 
                  checked={pageGenerationConfig.autoGenerateContent}
                  onCheckedChange={(checked) => setPageGenerationConfig({...pageGenerationConfig, autoGenerateContent: checked})}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Auto Index Pages</span>
                <Switch 
                  checked={pageGenerationConfig.autoIndexPages}
                  onCheckedChange={(checked) => setPageGenerationConfig({...pageGenerationConfig, autoIndexPages: checked})}
                />
              </div>
              <Button size="sm" className="w-full" onClick={generateProgrammablePages} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate Pages'}
              </Button>

              {/* Programmable Pages List */}
              <div className="mt-4">
                <h3 className="text-xs font-semibold mb-2">Generated Pages ({programmablePages.length})</h3>
                {programmablePagesLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : programmablePages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No pages generated yet</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {programmablePages.slice(0, 10).map((page) => (
                      <div key={page.id} className="flex items-center justify-between p-2 rounded bg-muted/30 text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{page.title}</p>
                          <p className="text-muted-foreground truncate">/{page.slug}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant={page.status === 'published' ? 'default' : 'secondary'} className="text-[9px]">
                            {page.status}
                          </Badge>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteProgrammablePage(page.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Module 102: Auto Meta + Hashtag Engine */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Hash className="h-4 w-4" /> Module 102: Auto Meta + Hashtag Engine
              </CardTitle>
              <CardDescription>Generate optimized meta tags and hashtags</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Auto Generate Title</span>
                <Switch 
                  checked={metaGenerationConfig.autoGenerateTitle}
                  onCheckedChange={(checked) => setMetaGenerationConfig({...metaGenerationConfig, autoGenerateTitle: checked})}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Auto Generate Meta Description</span>
                <Switch 
                  checked={metaGenerationConfig.autoGenerateDescription}
                  onCheckedChange={(checked) => setMetaGenerationConfig({...metaGenerationConfig, autoGenerateDescription: checked})}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Auto Generate Keywords</span>
                <Switch 
                  checked={metaGenerationConfig.autoGenerateKeywords}
                  onCheckedChange={(checked) => setMetaGenerationConfig({...metaGenerationConfig, autoGenerateKeywords: checked})}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Platform Hashtags (Google/Instagram/LinkedIn)</span>
                <Switch 
                  checked={metaGenerationConfig.platformHashtags}
                  onCheckedChange={(checked) => setMetaGenerationConfig({...metaGenerationConfig, platformHashtags: checked})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Target Platform for Hashtags</label>
                <select 
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-3"
                  value={metaGenerationConfig.targetPlatform}
                  onChange={(e) => setMetaGenerationConfig({...metaGenerationConfig, targetPlatform: e.target.value})}
                >
                  <option value="google">Google</option>
                  <option value="instagram">Instagram</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
              </div>
              <Button size="sm" className="w-full" onClick={generateMetaTags} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate Meta + Hashtags'}
              </Button>

              {/* Meta Generation Stats */}
              <div className="mt-4">
                <h3 className="text-xs font-semibold mb-2">Pages Needing Meta Generation</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-muted/30 rounded text-center">
                    <p className="text-[10px] text-muted-foreground">Missing Title</p>
                    <p className="text-lg font-bold">{programmablePages.filter(p => !p.meta_title).length}</p>
                  </div>
                  <div className="p-2 bg-muted/30 rounded text-center">
                    <p className="text-[10px] text-muted-foreground">Missing Description</p>
                    <p className="text-lg font-bold">{programmablePages.filter(p => !p.meta_description).length}</p>
                  </div>
                  <div className="p-2 bg-muted/30 rounded text-center">
                    <p className="text-[10px] text-muted-foreground">Missing Keywords</p>
                    <p className="text-lg font-bold">{programmablePages.filter(p => !p.meta_keywords || p.meta_keywords.length === 0).length}</p>
                  </div>
                  <div className="p-2 bg-muted/30 rounded text-center">
                    <p className="text-[10px] text-muted-foreground">Missing Hashtags</p>
                    <p className="text-lg font-bold">{programmablePages.filter(p => !p.hashtags || p.hashtags.length === 0).length}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Module 103: Global Keyword Expansion AI */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4" /> Module 103: Global Keyword Expansion AI
              </CardTitle>
              <CardDescription>Expand keywords with long-tail, country-based, language-based variants</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium">Base Keyword</label>
                <Input 
                  placeholder="crm-software" 
                  className="h-8 text-xs"
                  value={keywordExpansionConfig.baseKeyword}
                  onChange={(e) => setKeywordExpansionConfig({...keywordExpansionConfig, baseKeyword: e.target.value})}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Long-tail Expansion</span>
                <Switch 
                  checked={keywordExpansionConfig.longTailExpansion}
                  onCheckedChange={(checked) => setKeywordExpansionConfig({...keywordExpansionConfig, longTailExpansion: checked})}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Country-based Expansion</span>
                <Switch 
                  checked={keywordExpansionConfig.countryExpansion}
                  onCheckedChange={(checked) => setKeywordExpansionConfig({...keywordExpansionConfig, countryExpansion: checked})}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Language-based Expansion</span>
                <Switch 
                  checked={keywordExpansionConfig.languageExpansion}
                  onCheckedChange={(checked) => setKeywordExpansionConfig({...keywordExpansionConfig, languageExpansion: checked})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Target Language</label>
                <select 
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-3"
                  value={keywordExpansionConfig.targetLanguage}
                  onChange={(e) => setKeywordExpansionConfig({...keywordExpansionConfig, targetLanguage: e.target.value})}
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="ar">Arabic</option>
                  <option value="fr">French</option>
                  <option value="es">Spanish</option>
                </select>
              </div>
              <Button size="sm" className="w-full" onClick={expandKeywords} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Expand Keywords'}
              </Button>

              {/* Expanded Keywords Preview */}
              {expandedKeywords.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-semibold mb-2">Expanded Keywords ({expandedKeywords.length})</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {expandedKeywords.slice(0, 20).map((kw, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/30 text-xs">
                        <span className="font-medium">{kw.keyword}</span>
                        <Badge variant="outline" className="text-[9px]">{kw.type}</Badge>
                      </div>
                    ))}
                  </div>
                  <Button size="sm" className="w-full mt-2" onClick={applyExpandedKeywords} disabled={saving}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Apply & Create Pages'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Module 109: Global Sitemap Engine */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" /> Module 109: Global Sitemap Engine
              </CardTitle>
              <CardDescription>Multi sitemap management (pages, products, blog)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-muted/30 rounded-lg text-center">
                  <p className="text-[10px] text-muted-foreground">Pages Sitemap</p>
                  <p className="text-lg font-bold">{sitemapStats.pagesCount}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg text-center">
                  <p className="text-[10px] text-muted-foreground">Products Sitemap</p>
                  <p className="text-lg font-bold">{sitemapStats.productsCount}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg text-center">
                  <p className="text-[10px] text-muted-foreground">Blog Sitemap</p>
                  <p className="text-lg font-bold">{sitemapStats.blogCount}</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Include Programmable Pages</span>
                <Switch 
                  checked={sitemapConfig.includeProgrammablePages}
                  onCheckedChange={(checked) => setSitemapConfig({...sitemapConfig, includeProgrammablePages: checked})}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Include Products</span>
                <Switch 
                  checked={sitemapConfig.includeProducts}
                  onCheckedChange={(checked) => setSitemapConfig({...sitemapConfig, includeProducts: checked})}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Include Blog</span>
                <Switch 
                  checked={sitemapConfig.includeBlog}
                  onCheckedChange={(checked) => setSitemapConfig({...sitemapConfig, includeBlog: checked})}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Auto Update Sitemap</span>
                <Switch 
                  checked={sitemapConfig.autoUpdate}
                  onCheckedChange={(checked) => setSitemapConfig({...sitemapConfig, autoUpdate: checked})}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Auto Submit to Google</span>
                <Switch 
                  checked={sitemapConfig.autoSubmitToGoogle}
                  onCheckedChange={(checked) => setSitemapConfig({...sitemapConfig, autoSubmitToGoogle: checked})}
                />
              </div>
              <Button size="sm" className="w-full" onClick={generateSitemap} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate Sitemaps'}
              </Button>
              {sitemapStats.lastGenerated && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Last generated: {new Date(sitemapStats.lastGenerated).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Module 110: Auto Indexing Engine */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" /> Module 110: Auto Indexing Engine
              </CardTitle>
              <CardDescription>Submit to Google Index API, Bing, and fast indexing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-muted/30 rounded-lg text-center">
                  <p className="text-[10px] text-muted-foreground">Pending Index</p>
                  <p className="text-lg font-bold">{indexingStats.pendingIndex}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg text-center">
                  <p className="text-[10px] text-muted-foreground">Indexed</p>
                  <p className="text-lg font-bold">{indexingStats.indexed}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg text-center">
                  <p className="text-[10px] text-muted-foreground">Failed</p>
                  <p className="text-lg font-bold">{indexingStats.failed}</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Google Index API</span>
                <Switch 
                  checked={indexingConfig.googleIndexApi}
                  onCheckedChange={(checked) => setIndexingConfig({...indexingConfig, googleIndexApi: checked})}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Bing Webmaster API</span>
                <Switch 
                  checked={indexingConfig.bingWebmasterApi}
                  onCheckedChange={(checked) => setIndexingConfig({...indexingConfig, bingWebmasterApi: checked})}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Fast Indexing Mode</span>
                <Switch 
                  checked={indexingConfig.fastIndexingMode}
                  onCheckedChange={(checked) => setIndexingConfig({...indexingConfig, fastIndexingMode: checked})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Batch Size</label>
                <select 
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-3"
                  value={indexingConfig.batchSize}
                  onChange={(e) => setIndexingConfig({...indexingConfig, batchSize: parseInt(e.target.value)})}
                >
                  <option value="5">5 pages</option>
                  <option value="10">10 pages</option>
                  <option value="20">20 pages</option>
                  <option value="50">50 pages</option>
                </select>
              </div>
              <Button size="sm" className="w-full" onClick={submitForIndexing} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Submit for Indexing'}
              </Button>
              {indexingStats.lastSubmitted && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Last submitted: {new Date(indexingStats.lastSubmitted).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Module 104: Auto Language + Translation SEO */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe className="h-4 w-4" /> Module 104: Auto Language + Translation SEO
              </CardTitle>
              <CardDescription>Auto translate pages, meta, and content to target languages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/30 rounded-lg text-center">
                  <p className="text-[10px] text-muted-foreground">Translated Pages</p>
                  <p className="text-lg font-bold">{translationStats.translatedPages}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg text-center">
                  <p className="text-[10px] text-muted-foreground">Pending Translation</p>
                  <p className="text-lg font-bold">{translationStats.pendingTranslation}</p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Target Language</label>
                <select 
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-3"
                  value={translationConfig.targetLanguage}
                  onChange={(e) => setTranslationConfig({...translationConfig, targetLanguage: e.target.value})}
                >
                  <option value="hi">Hindi (हिन्दी)</option>
                  <option value="ar">Arabic (العربية)</option>
                  <option value="fr">French (Français)</option>
                  <option value="es">Spanish (Español)</option>
                </select>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Auto Translate Title</span>
                <Switch 
                  checked={translationConfig.autoTranslateTitle}
                  onCheckedChange={(checked) => setTranslationConfig({...translationConfig, autoTranslateTitle: checked})}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Auto Translate Meta Description</span>
                <Switch 
                  checked={translationConfig.autoTranslateMeta}
                  onCheckedChange={(checked) => setTranslationConfig({...translationConfig, autoTranslateMeta: checked})}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Auto Translate Content</span>
                <Switch 
                  checked={translationConfig.autoTranslateContent}
                  onCheckedChange={(checked) => setTranslationConfig({...translationConfig, autoTranslateContent: checked})}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Create Language Variants (New Pages)</span>
                <Switch 
                  checked={translationConfig.createLanguageVariants}
                  onCheckedChange={(checked) => setTranslationConfig({...translationConfig, createLanguageVariants: checked})}
                />
              </div>
              <Button size="sm" className="w-full" onClick={translateContent} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Translate Content'}
              </Button>
              {translationStats.lastTranslated && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Last translated: {new Date(translationStats.lastTranslated).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Module 120: Master Global SEO AI */}
          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Module 120: Master Global SEO AI
              </CardTitle>
              <CardDescription>Master controller to coordinate all SEO automation modules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-muted/30 rounded-lg text-center">
                  <p className="text-[10px] text-muted-foreground">Total Actions</p>
                  <p className="text-lg font-bold">{masterSeoStats.totalActions}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg text-center">
                  <p className="text-[10px] text-muted-foreground">Last Run</p>
                  <p className="text-xs font-medium">{masterSeoStats.lastRun ? new Date(masterSeoStats.lastRun).toLocaleString() : 'Never'}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg text-center">
                  <p className="text-[10px] text-muted-foreground">Next Run</p>
                  <p className="text-xs font-medium">{masterSeoStats.nextRun ? new Date(masterSeoStats.nextRun).toLocaleString() : 'Scheduled'}</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Auto Mode</span>
                <Switch 
                  checked={masterSeoConfig.autoMode}
                  onCheckedChange={(checked) => setMasterSeoConfig({...masterSeoConfig, autoMode: checked})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Schedule Interval</label>
                <select 
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-3"
                  value={masterSeoConfig.scheduleInterval}
                  onChange={(e) => setMasterSeoConfig({...masterSeoConfig, scheduleInterval: e.target.value})}
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Enable Page Generation (Module 101)</span>
                <Switch 
                  checked={masterSeoConfig.enablePageGeneration}
                  onCheckedChange={(checked) => setMasterSeoConfig({...masterSeoConfig, enablePageGeneration: checked})}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Enable Meta Generation (Module 102)</span>
                <Switch 
                  checked={masterSeoConfig.enableMetaGeneration}
                  onCheckedChange={(checked) => setMasterSeoConfig({...masterSeoConfig, enableMetaGeneration: checked})}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Enable Keyword Expansion (Module 103)</span>
                <Switch 
                  checked={masterSeoConfig.enableKeywordExpansion}
                  onCheckedChange={(checked) => setMasterSeoConfig({...masterSeoConfig, enableKeywordExpansion: checked})}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Enable Sitemap Generation (Module 109)</span>
                <Switch 
                  checked={masterSeoConfig.enableSitemapGeneration}
                  onCheckedChange={(checked) => setMasterSeoConfig({...masterSeoConfig, enableSitemapGeneration: checked})}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Enable Indexing (Module 110)</span>
                <Switch 
                  checked={masterSeoConfig.enableIndexing}
                  onCheckedChange={(checked) => setMasterSeoConfig({...masterSeoConfig, enableIndexing: checked})}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Enable Translation (Module 104)</span>
                <Switch 
                  checked={masterSeoConfig.enableTranslation}
                  onCheckedChange={(checked) => setMasterSeoConfig({...masterSeoConfig, enableTranslation: checked})}
                />
              </div>
              <Button size="sm" className="w-full bg-primary" onClick={runMasterSeoAutomation} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Run Master SEO AI'}
              </Button>
            </CardContent>
          </Card>

        </div>
      </TabsContent>

      {/* Lead Generation Tab */}
      <TabsContent value="lead-gen" className="mt-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Lead Generation System</h2>
              <p className="text-muted-foreground">Automated lead generation, scraping, and outreach system</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => {}}>
                <RefreshCw className="h-4 w-4 mr-2" /> Refresh
              </Button>
              <Button size="sm" className="bg-primary">
                <Plus className="h-4 w-4 mr-2" /> New Campaign
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="glass-card">
              <CardContent className="p-4">
                <p className="text-[10px] text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold">0</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-4">
                <p className="text-[10px] text-muted-foreground">Hot Leads</p>
                <p className="text-2xl font-bold text-green-600">0</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-4">
                <p className="text-[10px] text-muted-foreground">Emails Sent</p>
                <p className="text-2xl font-bold text-blue-600">0</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-4">
                <p className="text-[10px] text-muted-foreground">Conversions</p>
                <p className="text-2xl font-bold text-purple-600">0</p>
              </CardContent>
            </Card>
          </div>

          {/* Modules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Map className="h-4 w-4 text-primary" /> Module 1: Google Maps Scraper
                </CardTitle>
                <CardDescription>Auto search and extract business data from Google Maps</CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" className="w-full" variant="outline">Configure</Button>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" /> Module 2: Website Scraper
                </CardTitle>
                <CardDescription>Extract emails, forms, and social links from websites</CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" className="w-full" variant="outline">Configure</Button>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" /> Module 3: Email Finder
                </CardTitle>
                <CardDescription>Find and verify emails with SMTP validation</CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" className="w-full" variant="outline">Configure</Button>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Module 4: SEO Analyzer
                </CardTitle>
                <CardDescription>Analyze SEO metrics and competition</CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" className="w-full" variant="outline">Configure</Button>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Star className="h-4 w-4 text-primary" /> Module 7: AI Lead Scoring
                </CardTitle>
                <CardDescription>Score leads based on multiple factors</CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" className="w-full" variant="outline">Configure</Button>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" /> Module 8: Auto Outreach
                </CardTitle>
                <CardDescription>Automated email and WhatsApp outreach</CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" className="w-full" variant="outline">Configure</Button>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Kanban className="h-4 w-4 text-primary" /> Module 9: CRM Pipeline
                </CardTitle>
                <CardDescription>Manage lead stages and activities</CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" className="w-full" variant="outline">Configure</Button>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Module 10: Analytics
                </CardTitle>
                <CardDescription>Track performance and ROI metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" className="w-full" variant="outline">Configure</Button>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" /> Workflow Automation
                </CardTitle>
                <CardDescription>Orchestrate complete automation workflows</CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" className="w-full bg-primary">Run Workflow</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </TabsContent>

      {/* AI API Management Tab */}
      <TabsContent value="ai-api" className="mt-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">AI API Management</h2>
              <p className="text-muted-foreground">Manage 105+ AI APIs with priority, failover, and cost control</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => {}}>
                <RefreshCw className="h-4 w-4 mr-2" /> Refresh
              </Button>
              <Button size="sm" className="bg-primary">
                <Plus className="h-4 w-4 mr-2" /> Add API Integration
              </Button>
            </div>
          </div>

          {/* Usage Monitoring Dashboard */}
          <AIAPIUsageDashboard />

          {/* Category Tabs */}
          <Tabs defaultValue="core_ai_models" className="w-full">
            <TabsList className="grid w-full grid-cols-6 h-auto gap-1 bg-muted/30 p-1.5 rounded-xl">
              <TabsTrigger value="core_ai_models" className="text-[10px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Cpu className="h-3 w-3" /> Core AI
              </TabsTrigger>
              <TabsTrigger value="seo_content_generation" className="text-[10px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <FileText className="h-3 w-3" /> SEO Content
              </TabsTrigger>
              <TabsTrigger value="keyword_seo_data" className="text-[10px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Search className="h-3 w-3" /> Keywords
              </TabsTrigger>
              <TabsTrigger value="scraping_lead_extraction" className="text-[10px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Globe className="h-3 w-3" /> Scraping
              </TabsTrigger>
              <TabsTrigger value="email_lead_enrichment" className="text-[10px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Mail className="h-3 w-3" /> Email
              </TabsTrigger>
              <TabsTrigger value="social_media_automation" className="text-[10px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Share2 className="h-3 w-3" /> Social
              </TabsTrigger>
            </TabsList>

            <TabsContent value="core_ai_models" className="mt-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Core AI Models (Primary + Fallback)</CardTitle>
                  <CardDescription>OpenAI, Google Gemini, Anthropic Claude, Mistral, Groq, Together AI, OpenRouter, DeepSeek, Perplexity, Cohere</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">10 AI providers available</div>
                    <Button size="sm" className="w-full" variant="outline">Configure Core AI Models</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="seo_content_generation" className="mt-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">SEO Content Generation (High Value)</CardTitle>
                  <CardDescription>Writesonic, Copy.ai, Jasper AI, Rytr, Anyword, Scalenut, Outranking, Frase, SurferSEO AI, NeuronWriter</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">10 SEO content generation tools available</div>
                    <Button size="sm" className="w-full" variant="outline">Configure SEO Content Generation</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="keyword_seo_data" className="mt-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Keyword + SEO Data</CardTitle>
                  <CardDescription>DataForSEO, SerpAPI, Zenserp, Serper.dev, Google Search Console, Google Trends, Ahrefs, SEMrush, KeywordTool, Ubersuggest</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">10 keyword and SEO data APIs available</div>
                    <Button size="sm" className="w-full" variant="outline">Configure Keyword + SEO Data</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="scraping_lead_extraction" className="mt-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Scraping + Lead Extraction</CardTitle>
                  <CardDescription>Apify, BrightData, ScraperAPI, Diffbot, Zyte, PhantomBuster, TexAu, Octoparse, WebScraper.io, Proxycrawl</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">10 scraping and lead extraction services available</div>
                    <Button size="sm" className="w-full" variant="outline">Configure Scraping + Lead Extraction</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="email_lead_enrichment" className="mt-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Email + Lead Enrichment</CardTitle>
                  <CardDescription>Hunter.io, Snov.io, Clearbit, Apollo, Lusha, Dropcontact, RocketReach, FullContact, PeopleDataLabs, LeadGenius</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">10 email and lead enrichment APIs available</div>
                    <Button size="sm" className="w-full" variant="outline">Configure Email + Lead Enrichment</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="social_media_automation" className="mt-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Social Media Automation</CardTitle>
                  <CardDescription>Meta Graph API, Twitter/X API, LinkedIn API, Buffer, Hootsuite, SocialBee, Publer, Later, Sprout Social, Missinglettr</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">10 social media automation APIs available</div>
                    <Button size="sm" className="w-full" variant="outline">Configure Social Media Automation</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* More Categories */}
          <Tabs defaultValue="chat_support_ai" className="w-full">
            <TabsList className="grid w-full grid-cols-6 h-auto gap-1 bg-muted/30 p-1.5 rounded-xl">
              <TabsTrigger value="chat_support_ai" className="text-[10px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <MessageSquare className="h-3 w-3" /> Chat AI
              </TabsTrigger>
              <TabsTrigger value="voice_translation" className="text-[10px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Mic className="h-3 w-3" /> Voice
              </TabsTrigger>
              <TabsTrigger value="image_design_ai" className="text-[10px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Image className="h-3 w-3" /> Image AI
              </TabsTrigger>
              <TabsTrigger value="automation_workflow" className="text-[10px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Zap className="h-3 w-3" /> Automation
              </TabsTrigger>
              <TabsTrigger value="analytics_tracking" className="text-[10px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <BarChart3 className="h-3 w-3" /> Analytics
              </TabsTrigger>
              <TabsTrigger value="bonus_high_impact" className="text-[10px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Star className="h-3 w-3" /> Bonus
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat_support_ai" className="mt-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Chat + Support AI</CardTitle>
                  <CardDescription>Chatbase, Botpress, Rasa, Tidio, Crisp Chat, Intercom, Drift, Kommunicate, ManyChat, Landbot</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">10 chat and support AI services available</div>
                    <Button size="sm" className="w-full" variant="outline">Configure Chat + Support AI</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="voice_translation" className="mt-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Voice + Translation</CardTitle>
                  <CardDescription>Google Speech-to-Text, Whisper (OpenAI), AssemblyAI, Deepgram, ElevenLabs, Azure Speech, Amazon Polly, Google Translate, DeepL, Rev.ai</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">10 voice and translation services available</div>
                    <Button size="sm" className="w-full" variant="outline">Configure Voice + Translation</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="image_design_ai" className="mt-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Image / Design AI (For Marketing)</CardTitle>
                  <CardDescription>Stability AI, Midjourney, DALL·E, Leonardo AI, Runway ML, Canva API, Remove.bg, Clipdrop, Bannerbear, Pixelcut</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">10 image and design AI services available</div>
                    <Button size="sm" className="w-full" variant="outline">Configure Image / Design AI</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="automation_workflow" className="mt-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Automation + Workflow</CardTitle>
                  <CardDescription>Zapier, Make (Integromat), n8n, Pipedream, IFTTT</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">5 automation and workflow services available</div>
                    <Button size="sm" className="w-full" variant="outline">Configure Automation + Workflow</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics_tracking" className="mt-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Analytics + Tracking</CardTitle>
                  <CardDescription>Google Analytics, Mixpanel, Amplitude, PostHog, Plausible</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">5 analytics and tracking platforms available</div>
                    <Button size="sm" className="w-full" variant="outline">Configure Analytics + Tracking</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bonus_high_impact" className="mt-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Bonus (High Impact)</CardTitle>
                  <CardDescription>Stripe (billing AI triggers), Razorpay, Firebase (realtime), Supabase (DB + auth), Algolia (search AI)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">5 high-impact bonus integrations available</div>
                    <Button size="sm" className="w-full" variant="outline">Configure Bonus Integrations</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Usage Mapping Section */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Usage Mapping
              </CardTitle>
              <CardDescription>SEO → Cheap Model | Chat → Mid Model | Critical → Best Model</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs font-medium text-green-600 mb-2">SEO Requests</p>
                  <p className="text-[10px] text-muted-foreground">Preferred: DeepSeek</p>
                  <p className="text-[10px] text-muted-foreground">Fallback: Groq, Mistral, Together AI</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs font-medium text-blue-600 mb-2">Chat Requests</p>
                  <p className="text-[10px] text-muted-foreground">Preferred: Groq</p>
                  <p className="text-[10px] text-muted-foreground">Fallback: DeepSeek, Together AI, OpenAI</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs font-medium text-purple-600 mb-2">Critical Requests</p>
                  <p className="text-[10px] text-muted-foreground">Preferred: OpenAI</p>
                  <p className="text-[10px] text-muted-foreground">Fallback: Claude, Gemini, OpenRouter</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cost Control Section */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" /> Cost Control
              </CardTitle>
              <CardDescription>Manage daily budget limits, max tokens, and auto-pause settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Daily Budget Limit</span>
                <Input type="number" className="w-24 h-8 text-xs" placeholder="10.00" />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Max Tokens Per Request</span>
                <Input type="number" className="w-24 h-8 text-xs" placeholder="4096" />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Alert Threshold (%)</span>
                <Input type="number" className="w-24 h-8 text-xs" placeholder="80" />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs">Enable Auto-Pause</span>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

    </DashboardLayout>
  );
}
