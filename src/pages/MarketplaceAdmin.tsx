import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
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
  Plus,
  Search,
  RefreshCw,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  Upload,
  Package,
  Download,
  Ticket,
  Megaphone,
  Layout,
  Link2,
  CreditCard,
  Truck,
  DollarSign,
  Loader2,
  CheckCircle2,
  XCircle,
  Tags,
  ShoppingBag,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const db = supabase as any;
const PAGE_SIZE = 25;

type ProductStatusDb = 'active' | 'suspended' | 'draft' | 'archived';

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price: number;
  status: ProductStatusDb;
  business_type: string | null;
  tags: string[];
  demo_url: string | null;
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
}

const statusLabelMap: Record<ProductStatusDb, string> = {
  active: 'LIVE',
  suspended: 'UPCOMING',
  draft: 'PIPELINE',
  archived: 'ARCHIVED',
};

const statusBadgeClass: Record<ProductStatusDb, string> = {
  active: 'bg-primary/10 text-primary border-primary/30',
  suspended: 'bg-accent/20 text-accent-foreground border-accent/30',
  draft: 'bg-muted text-muted-foreground border-border',
  archived: 'bg-destructive/10 text-destructive border-destructive/30',
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
  tags: [],
  demo_url: '',
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

const emptyGateway = (): PaymentGateway => ({
  id: `new-${Date.now()}`,
  gateway_code: '',
  gateway_name: '',
  is_enabled: false,
  sort_order: 1,
  config: {},
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
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

  const [products, setProducts] = useState<Product[]>([]);
  const [productCatalog, setProductCatalog] = useState<Array<{ id: string; name: string; status: string; apk_enabled: boolean }>>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

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
  });

  const [saving, setSaving] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editHeaderMenu, setEditHeaderMenu] = useState<HeaderMenu | null>(null);
  const [editBanner, setEditBanner] = useState<Banner | null>(null);
  const [editTicker, setEditTicker] = useState<Ticker | null>(null);
  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null);
  const [editDiscountRule, setEditDiscountRule] = useState<DiscountRule | null>(null);
  const [editGateway, setEditGateway] = useState<PaymentGateway | null>(null);
  const [gatewayConfigText, setGatewayConfigText] = useState('{}');

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
    let query = db
      .from('products')
      .select('id, name, slug, description, short_description, price, status, business_type, tags, demo_url, demo_login, demo_password, demo_enabled, apk_url, thumbnail_url, featured, trending, marketplace_visible, discount_percent, rating, apk_enabled, license_enabled, buy_enabled, created_at')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (search.trim()) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,business_type.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
      toast.error('Failed to load products');
    } else {
      setProducts((data || []) as Product[]);
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
    const { data } = await db.from('marketplace_payment_gateways').select('*').order('sort_order', { ascending: true });
    setGateways((data || []) as PaymentGateway[]);
    setGatewaysLoading(false);
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
    const { data } = await db
      .from('marketplace_orders')
      .select('id, buyer_id, seller_id, product_id, product_name, amount, final_amount, status, payment_method, coupon_code, created_at, completed_at')
      .order('created_at', { ascending: false })
      .limit(300);
    setOrders((data || []) as MarketplaceOrder[]);
    setOrdersLoading(false);
  };

  const fetchStats = async () => {
    const [
      { count: totalProducts },
      { count: activeProducts },
      { count: pipelineProducts },
      { count: totalDownloads },
      { data: salesRows },
    ] = await Promise.all([
      db.from('products').select('id', { head: true, count: 'exact' }),
      db.from('products').select('id', { head: true, count: 'exact' }).eq('status', 'active'),
      db.from('products').select('id', { head: true, count: 'exact' }).eq('status', 'draft'),
      db.from('apk_download_logs').select('id', { head: true, count: 'exact' }),
      db.from('marketplace_orders').select('amount, final_amount').eq('status', 'completed').limit(100000),
    ]);

    const totalSales = (salesRows || []).reduce((sum: number, row: any) => {
      const value = Number(row.final_amount ?? row.amount ?? 0);
      return sum + (Number.isNaN(value) ? 0 : value);
    }, 0);

    setStats({
      totalProducts: totalProducts || 0,
      activeProducts: activeProducts || 0,
      pipelineProducts: pipelineProducts || 0,
      totalSales,
      totalDownloads: totalDownloads || 0,
    });
  };

  const refreshAll = async () => {
    await Promise.all([
      fetchProductCatalog(),
      fetchHeaderMenus(),
      fetchBanners(),
      fetchTickers(),
      fetchCoupons(),
      fetchDiscountRules(),
      fetchGateways(),
      fetchApks(),
      fetchOrders(),
      fetchStats(),
    ]);
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
    if (!productSlug) {
      toast.error('Slug is required');
      return;
    }

    const payload = {
      name: editProduct.name.trim(),
      slug: productSlug,
      description: editProduct.description || editProduct.short_description || '',
      short_description: editProduct.short_description || '',
      price: Number(editProduct.price || 0),
      status: editProduct.status,
      business_type: editProduct.business_type || 'software',
      tags: editProduct.tags || [],
      demo_url: editProduct.demo_url || null,
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

    if (editProduct.id.startsWith('new-')) {
      const { error } = await db.from('products').insert(payload);
      if (error) {
        toast.error(`Create failed: ${error.message}`);
      } else {
        toast.success('Product created');
        setEditProduct(null);
        await Promise.all([fetchProducts(), fetchProductCatalog(), fetchStats()]);
      }
    } else {
      const { error } = await db.from('products').update(payload).eq('id', editProduct.id);
      if (error) {
        toast.error(`Update failed: ${error.message}`);
      } else {
        toast.success('Product updated');
        setEditProduct(null);
        await Promise.all([fetchProducts(), fetchProductCatalog(), fetchStats(), fetchApks()]);
      }
    }

    setSaving(false);
  };

  const toggleVisibility = async (p: Product) => {
    const { error } = await db
      .from('products')
      .update({ marketplace_visible: !p.marketplace_visible })
      .eq('id', p.id);

    if (error) {
      toast.error('Visibility update failed');
      return;
    }

    toast.success(!p.marketplace_visible ? 'Now visible on marketplace' : 'Hidden from marketplace');
    await Promise.all([fetchProducts(), fetchStats()]);
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Delete this product permanently?')) return;
    const { error } = await db.from('products').delete().eq('id', id);
    if (error) {
      toast.error(`Delete failed: ${error.message}`);
      return;
    }
    toast.success('Product deleted');
    await Promise.all([fetchProducts(), fetchProductCatalog(), fetchStats(), fetchApks()]);
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
      if (!confirm(`Delete ${ids.length} selected products?`)) {
        setBulkRunning(false);
        return;
      }
      const { error } = await db.from('products').delete().in('id', ids);
      if (error) toast.error(error.message);
      else toast.success(`Deleted ${ids.length} products`);
      setSelectedIds(new Set());
      setBulkRunning(false);
      await Promise.all([fetchProducts(), fetchProductCatalog(), fetchStats(), fetchApks()]);
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

    const { error } = await db.from('products').update(payload).in('id', ids);
    if (error) toast.error(error.message);
    else toast.success(`Updated ${ids.length} products`);

    setSelectedIds(new Set());
    setBulkRunning(false);
    await Promise.all([fetchProducts(), fetchProductCatalog(), fetchStats(), fetchApks()]);
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

  const saveGateway = async () => {
    if (!editGateway) return;
    if (!editGateway.gateway_code.trim() || !editGateway.gateway_name.trim()) {
      toast.error('Gateway code and name are required');
      return;
    }

    let parsedConfig: Record<string, unknown> = {};
    try {
      parsedConfig = gatewayConfigText?.trim() ? JSON.parse(gatewayConfigText) : {};
    } catch {
      toast.error('Config JSON is invalid');
      return;
    }

    const payload = {
      gateway_code: editGateway.gateway_code.trim().toLowerCase(),
      gateway_name: editGateway.gateway_name.trim(),
      is_enabled: Boolean(editGateway.is_enabled),
      sort_order: Number(editGateway.sort_order || 0),
      config: parsedConfig,
    };

    setSaving(true);
    const query = editGateway.id.startsWith('new-')
      ? db.from('marketplace_payment_gateways').insert(payload)
      : db.from('marketplace_payment_gateways').update(payload).eq('id', editGateway.id);

    const { error } = await query;
    setSaving(false);

    if (error) toast.error(error.message);
    else {
      toast.success('Gateway saved');
      setEditGateway(null);
      setGatewayConfigText('{}');
      fetchGateways();
    }
  };

  const deleteGateway = async (id: string) => {
    if (!confirm('Delete this payment gateway?')) return;
    const { error } = await db.from('marketplace_payment_gateways').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Gateway deleted');
      fetchGateways();
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    const payload: Record<string, unknown> = { status };
    if (status === 'completed') payload.completed_at = new Date().toISOString();

    const { error } = await db.from('marketplace_orders').update(payload).eq('id', orderId);
    if (error) toast.error(error.message);
    else {
      toast.success('Order updated');
      Promise.all([fetchOrders(), fetchStats()]);
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!confirm('Delete this order?')) return;
    const { error } = await db.from('marketplace_orders').delete().eq('id', orderId);
    if (error) toast.error(error.message);
    else {
      toast.success('Order deleted');
      Promise.all([fetchOrders(), fetchStats()]);
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

    setUploadingApk(true);

    const safeFileName = apkFile.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${apkForm.product_id}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await db.storage
      .from('apks')
      .upload(path, apkFile, { upsert: true, contentType: apkFile.type || 'application/vnd.android.package-archive' });

    if (uploadError) {
      setUploadingApk(false);
      toast.error(`Upload failed: ${uploadError.message}`);
      return;
    }

    let apkId = apkForm.replace_apk_id;

    if (apkId) {
      const { error } = await db
        .from('apks')
        .update({
          product_id: apkForm.product_id,
          version: apkForm.version,
          file_url: path,
          file_size: apkFile.size,
          status: apkForm.status,
          changelog: apkForm.changelog || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', apkId);

      if (error) {
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
          file_url: path,
          file_size: apkFile.size,
          status: apkForm.status,
          changelog: apkForm.changelog || null,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (error || !inserted?.id) {
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
        file_path: path,
        file_size: apkFile.size,
        release_notes: apkForm.changelog || null,
        is_stable: apkForm.status === 'published',
        created_by: user.id,
      })
      .select('id')
      .single();

    if (versionError) {
      setUploadingApk(false);
      toast.error(`Version create failed: ${versionError.message}`);
      return;
    }

    if (versionRow?.id) {
      await db
        .from('apks')
        .update({ current_version_id: versionRow.id, file_url: path, updated_at: new Date().toISOString() })
        .eq('id', apkId);
    }

    await db
      .from('products')
      .update({
        apk_url: path,
        storage_path: path,
        apk_enabled: apkForm.status === 'published',
        status: apkForm.status === 'published' ? 'active' : 'draft',
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

          <Button size="sm" variant="outline" className="gap-1" onClick={() => { fetchProducts(); refreshAll(); }}>
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
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
          <TabsList className="grid h-10 w-full grid-cols-6">
            <TabsTrigger value="settings" className="text-[10px] gap-1"><Layout className="h-3 w-3" />Settings</TabsTrigger>
            <TabsTrigger value="products" className="text-[10px] gap-1"><Package className="h-3 w-3" />Products</TabsTrigger>
            <TabsTrigger value="apk" className="text-[10px] gap-1"><Truck className="h-3 w-3" />APK</TabsTrigger>
            <TabsTrigger value="payments" className="text-[10px] gap-1"><CreditCard className="h-3 w-3" />Payments</TabsTrigger>
            <TabsTrigger value="offers" className="text-[10px] gap-1"><Tags className="h-3 w-3" />Offers</TabsTrigger>
            <TabsTrigger value="bulk" className="text-[10px] gap-1"><RefreshCw className="h-3 w-3" />Bulk</TabsTrigger>
          </TabsList>

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
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { setEditGateway(emptyGateway()); setGatewayConfigText('{}'); }}>
                  <Plus className="h-3 w-3" /> Add Gateway
                </Button>
              </div>

              {gatewaysLoading ? <Skeleton className="h-10 w-full" /> : (
                <div className="space-y-2">
                  {gateways.map((g) => (
                    <div key={g.id} className="rounded-md border border-border p-2 flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground">{g.gateway_name}</p>
                        <p className="text-[10px] text-muted-foreground">{g.gateway_code}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px]">{g.is_enabled ? 'ENABLED' : 'DISABLED'}</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditGateway(g); setGatewayConfigText(JSON.stringify(g.config || {}, null, 2)); }}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteGateway(g.id)}><Trash2 className="h-3 w-3" /></Button>
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
                        </td>
                        <td className="p-2">
                          <p className="text-foreground">{o.product_name || '—'}</p>
                          {o.coupon_code && <p className="text-[10px] text-muted-foreground">Coupon: {o.coupon_code}</p>}
                        </td>
                        <td className="p-2 text-center font-semibold">${Number(o.final_amount ?? o.amount ?? 0).toFixed(2)}</td>
                        <td className="p-2 text-center">{o.payment_method || '—'}</td>
                        <td className="p-2 text-center">
                          <Select value={o.status} onValueChange={(v) => updateOrderStatus(o.id, v)}>
                            <SelectTrigger className="h-7 text-[11px] w-[120px] mx-auto"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="failed">Failed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2 text-right">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteOrder(o.id)}>
                            <Trash2 className="h-3 w-3" />
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
                  <Input value={editProduct.business_type || ''} onChange={(e) => setEditProduct({ ...editProduct, business_type: e.target.value })} className="h-9 text-sm" />
                </Field>
                <Field label="Tags (comma separated)">
                  <Input value={(editProduct.tags || []).join(', ')} onChange={(e) => setEditProduct({ ...editProduct, tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} className="h-9 text-sm" />
                </Field>
              </div>

              <Field label="Thumbnail URL">
                <Input value={editProduct.thumbnail_url || ''} onChange={(e) => setEditProduct({ ...editProduct, thumbnail_url: e.target.value })} className="h-9 text-sm" />
              </Field>

              <Field label="Demo URL">
                <Input value={editProduct.demo_url || ''} onChange={(e) => setEditProduct({ ...editProduct, demo_url: e.target.value })} className="h-9 text-sm" />
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

      {/* Gateway Dialog */}
      {editGateway && (
        <Dialog open={!!editGateway} onOpenChange={() => setEditGateway(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-sm">{editGateway.id.startsWith('new-') ? 'Add' : 'Edit'} Payment Gateway</DialogTitle>
              <DialogDescription className="text-xs">Razorpay / Stripe / Wallet toggles and config.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Gateway Code"><Input value={editGateway.gateway_code} onChange={(e) => setEditGateway({ ...editGateway, gateway_code: e.target.value.toLowerCase() })} className="h-9 text-sm" placeholder="razorpay" /></Field>
                <Field label="Gateway Name"><Input value={editGateway.gateway_name} onChange={(e) => setEditGateway({ ...editGateway, gateway_name: e.target.value })} className="h-9 text-sm" placeholder="Razorpay" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Sort"><Input type="number" value={editGateway.sort_order} onChange={(e) => setEditGateway({ ...editGateway, sort_order: Number(e.target.value || 0) })} className="h-9 text-sm" /></Field>
                <div className="flex items-end gap-2 pb-1">
                  <Switch checked={editGateway.is_enabled} onCheckedChange={(v) => setEditGateway({ ...editGateway, is_enabled: v })} />
                  <span className="text-xs text-muted-foreground">{editGateway.is_enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
              <Field label="Config JSON">
                <Textarea value={gatewayConfigText} onChange={(e) => setGatewayConfigText(e.target.value)} className="min-h-[120px] font-mono text-xs" />
              </Field>
              <Button className="h-9 text-sm" onClick={saveGateway} disabled={saving}>Save Gateway</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
