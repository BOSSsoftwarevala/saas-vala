import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MarketplaceProduct {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  status: 'upcoming' | 'live' | 'bestseller' | 'draft';
  price: number;
  features: { icon: string; text: string }[];
  techStack: string[];
  category: string;
  businessType: string;
  gitRepoUrl?: string;
  apkUrl?: string;
  demoUrl?: string;
  demoLogin?: string;
  demoPassword?: string;
  demoEnabled?: boolean;
  featured: boolean;
  trending: boolean;
  isAvailable: boolean;
  discount_percent: number;
  rating: number;
  tags: string[];
  apk_enabled: boolean;
  license_enabled: boolean;
}

const stockImages = [
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop',
];

const defaultFeatures = [
  { icon: 'Download', text: 'APK Download' },
  { icon: 'Key', text: 'License Key' },
  { icon: 'RefreshCw', text: 'Auto Updates' },
  { icon: 'Headphones', text: '24/7 Support' },
];

const defaultTechStack = ['React', 'Node.js', 'PostgreSQL'];

// Category row mapping
export const CATEGORY_ROW_MAP: Record<string, string[]> = {
  upcoming: ['upcoming', 'coming_soon', 'pipeline'],
  ondemand: ['on_demand', 'on demand', 'ondemand', 'saas', 'cloud'],
  topselling: ['top_selling', 'bestseller', 'popular_category', 'retail', 'food', 'pos'],
  popular: ['popular', 'marketing', 'finance', 'hr', 'crm', 'accounting'],
  education: ['education', 'school', 'college', 'coaching', 'elearning', 'training', 'skill'],
};

function formatProductName(name: string): string {
  return (name || '').substring(0, 50).toUpperCase();
}

function getProductPriorityScore(product: MarketplaceProduct): number {
  const repoUrl = (product.gitRepoUrl || '').toLowerCase();
  const demoUrl = (product.demoUrl || '').toLowerCase();

  const hasLiveDemo = Boolean(demoUrl && demoUrl.startsWith('http') && !demoUrl.includes('github.com'));
  const hasRealRepo = repoUrl.includes('github.com/saasvala/') || repoUrl.includes('github.com/softwarevala/');
  const hasAnyRepo = Boolean(repoUrl);
  const isLive = product.status === 'live' || product.status === 'bestseller';
  const isAvailable = product.isAvailable !== false;

  return (
    (hasLiveDemo ? 500 : 0) +
    (hasRealRepo ? 300 : 0) +
    (!hasRealRepo && hasAnyRepo ? 120 : 0) +
    (isLive ? 80 : 0) +
    (isAvailable ? 40 : 0) +
    (product.featured ? 15 : 0) +
    (product.trending ? 10 : 0)
  );
}

function prioritizeProducts(products: MarketplaceProduct[]): MarketplaceProduct[] {
  return products
    .map((product, index) => ({ product, index, score: getProductPriorityScore(product) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ product }) => product);
}

function matchesCategory(product: MarketplaceProduct, categories: string[]) {
  const terms = categories.map(c => c.toLowerCase().trim());
  const haystack = [
    product.businessType || '',
    product.category || '',
    product.title || '',
    product.subtitle || '',
    product.gitRepoUrl || '',
    (product.tags || []).join(' '),
  ]
    .join(' ')
    .toLowerCase();

  return terms.some(term => haystack.includes(term));
}

function isSaasvalaRepo(product: MarketplaceProduct) {
  return (product.gitRepoUrl || '').toLowerCase().includes('github.com/saasvala/');
}

export function mapDbProduct(product: any, index: number): MarketplaceProduct {
  const features = Array.isArray(product.features) && product.features.length > 0
    ? product.features.slice(0, 4).map((f: any) =>
        typeof f === 'string' ? { icon: 'CheckCircle2', text: f } : f
      )
    : defaultFeatures;

  const isAvailable = product.status === 'active' && product.deploy_status !== 'failed';

  return {
    id: product.id,
    title: formatProductName(product.name || product.slug || 'Software Product'),
    subtitle: product.short_description || product.description?.substring(0, 80) || 'Professional Software Solution',
    image: product.thumbnail_url || stockImages[index % stockImages.length],
    status: product.status === 'draft' ? 'draft' : product.trending ? 'bestseller' : 'live',
    price: Number(product.price) || 5,
    features,
    techStack: defaultTechStack,
    category: product.business_type || 'Software',
    businessType: product.business_type || '',
    gitRepoUrl: product.git_repo_url,
    apkUrl: product.apk_url || undefined,
    demoUrl: product.demo_url || undefined,
    demoLogin: product.demo_login || undefined,
    demoPassword: product.demo_password || undefined,
    demoEnabled: Boolean(product.demo_enabled),
    featured: Boolean(product.featured),
    trending: Boolean(product.trending),
    isAvailable,
    discount_percent: Number(product.discount_percent) || 0,
    rating: Number(product.rating) || 4.5,
    tags: product.tags || [],
    apk_enabled: product.apk_enabled !== false,
    license_enabled: product.license_enabled !== false,
  };
}

export function useMarketplaceProducts() {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
  const { data, error } = await supabase
        .from('products')
        .select('id, name, slug, description, short_description, price, status, features, thumbnail_url, git_repo_url, marketplace_visible, apk_url, demo_url, demo_login, demo_password, demo_enabled, featured, trending, business_type, deploy_status, discount_percent, rating, tags, apk_enabled, license_enabled')
        .eq('marketplace_visible', true)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        console.error('Failed to fetch marketplace products:', error);
        setProducts([]);
      } else {
        const mapped = (data || []).map((p, i) => mapDbProduct(p, i));
        setProducts(prioritizeProducts(mapped));
      }
      setLoading(false);
    };

    fetchProducts();
  }, []);

  // Split into category rows for the "catalog" section
  const dbRow1 = products.slice(0, 30);
  const remaining = products.slice(30);
  const allRows = [dbRow1];
  if (remaining.length > 0) {
    for (let i = 0; i < remaining.length; i += 30) {
      allRows.push(remaining.slice(i, i + 30));
    }
  }

  // Category-specific row fetchers
  const getByCategory = (cats: string[]) => {
    const matched = products.filter(p => matchesCategory(p, cats));
    const fallbackReal = products.filter(isSaasvalaRepo);
    return prioritizeProducts(matched.length > 0 ? matched : fallbackReal);
  };

  return {
    products,
    allRows: allRows.filter(r => r.length > 0),
    loading,
    totalCount: products.length,
    getByCategory,
  };
}

// Separate lightweight hook that fetches by category from DB
export function useProductsByCategory(categories: string[]) {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      // Fetch all marketplace visible products and filter client-side by category
      const { data, error } = await supabase
        .from('products')
        .select('id, name, slug, description, short_description, price, status, features, thumbnail_url, git_repo_url, marketplace_visible, apk_url, demo_url, demo_login, demo_password, demo_enabled, featured, trending, business_type, deploy_status, discount_percent, rating, tags, apk_enabled, license_enabled')
        .eq('marketplace_visible', true)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        setProducts([]);
      } else {
        const mapped = (data || []).map((p, i) => mapDbProduct(p, i));
        // Filter by category keywords OR return all if no match
        const matched = mapped.filter(p => matchesCategory(p, categories));
        const fallbackReal = mapped.filter(isSaasvalaRepo);
        const filtered = prioritizeProducts(matched.length > 0 ? matched : fallbackReal);
        setProducts(filtered);
      }
      setLoading(false);
    };

    fetchProducts();
  }, [categories.join(',')]);

  return { products, loading };
}
