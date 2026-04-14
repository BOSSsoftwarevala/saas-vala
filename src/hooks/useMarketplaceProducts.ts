import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolveMaskedDemoUrl } from '@/lib/demoMasking';
import { getAllGitHubRepos, type RepoProduct } from '@/lib/githubRepoFetcher';

export interface MarketplaceProduct {
  id: string;
  slug: string;
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
    buy_enabled: boolean;
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
  const demoUrl = (resolveMaskedDemoUrl({ slug: product.slug, demo_url: product.demoUrl || null, demo_enabled: product.demoEnabled }) || '').toLowerCase();
  const hasLiveDemo = Boolean(demoUrl);
  const hasRealRepo = repoUrl.includes('github.com/saasvala/') || repoUrl.includes('github.com/softwarevala/');
  const hasAnyRepo = Boolean(repoUrl);
  const isLive = product.status === 'live' || product.status === 'bestseller';
  const isAvailable = product.isAvailable !== false;
  return (
    (hasLiveDemo ? 500 : 0) + (hasRealRepo ? 300 : 0) + (!hasRealRepo && hasAnyRepo ? 120 : 0) +
    (isLive ? 80 : 0) + (isAvailable ? 40 : 0) + (product.featured ? 15 : 0) + (product.trending ? 10 : 0)
  );
}

function prioritizeProducts(products: MarketplaceProduct[]): MarketplaceProduct[] {
  return products
    .map((product, index) => ({ product, index, score: getProductPriorityScore(product) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ product }) => product);
}

export function mapDbProduct(product: any, index: number): MarketplaceProduct {
  const features = Array.isArray(product.features) && product.features.length > 0
    ? product.features.slice(0, 4).map((f: any) => typeof f === 'string' ? { icon: 'CheckCircle2', text: f } : f)
    : defaultFeatures;
  const isAvailable = product.status === 'active' && product.deploy_status !== 'failed';
  const businessType = product.business_type || product.target_industry || '';
  return {
    id: product.id,
    slug: product.slug,
    title: formatProductName(product.name || product.slug || 'Software Product'),
    subtitle: product.short_description || product.description?.substring(0, 80) || 'Professional Software Solution',
    image: product.thumbnail_url || stockImages[index % stockImages.length],
    status: product.status === 'active' ? 'live'
      : product.status === 'draft' ? 'draft'
      : product.status === 'suspended' || product.status === 'upcoming' ? 'upcoming'
      : 'upcoming',
    price: Number(product.price) || 0,
    features, techStack: defaultTechStack,
    category: businessType || 'Software',
    businessType,
    gitRepoUrl: product.git_repo_url, apkUrl: product.apk_url || undefined,
    demoUrl: product.demo_url || undefined, demoLogin: product.demo_login || undefined,
    demoPassword: product.demo_password || undefined, demoEnabled: Boolean(product.demo_enabled),
    featured: Boolean(product.featured), trending: Boolean(product.trending), isAvailable,
    discount_percent: Number(product.discount_percent) || 0, rating: Number(product.rating) || 0,
    tags: product.tags || [], apk_enabled: product.apk_enabled !== false, license_enabled: product.license_enabled !== false,
    buy_enabled: product.buy_enabled !== false,
  };
}

export function useMarketplaceProducts(category?: string, featured?: boolean, limit?: number) {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        console.log('🚀 Fetching ALL GitHub repositories for marketplace...');
        
        // Fetch ALL GitHub repositories
        const githubRepos = await getAllGitHubRepos();
        console.log(`✅ Fetched ${githubRepos.length} GitHub repositories`);
        
        // Convert to marketplace products
        let marketplaceProducts = githubRepos.map(repo => convertRepoToMarketplaceProduct(repo));
        
        // Apply filters
        if (category) {
          marketplaceProducts = marketplaceProducts.filter(p => p.category === category);
          console.log(`📂 Filtered by category "${category}": ${marketplaceProducts.length} products`);
        }
        
        if (featured) {
          marketplaceProducts = marketplaceProducts.filter(p => p.featured);
          console.log(`⭐ Filtered featured products: ${marketplaceProducts.length} products`);
        }
        
        // Apply limit only if specified (for backward compatibility)
        if (limit && limit > 0) {
          marketplaceProducts = marketplaceProducts.slice(0, limit);
          console.log(`📏 Applied limit ${limit}: ${marketplaceProducts.length} products`);
        }
        
        setTotalCount(githubRepos.length);
        setProducts(marketplaceProducts);
        console.log(`🎉 Displaying ${marketplaceProducts.length} products (Total available: ${githubRepos.length})`);
        
      } catch (error) {
        console.error('❌ Failed to fetch GitHub repositories:', error);
        
        // Fallback to database products
        const fallbackProducts = await fetchDatabaseProducts();
        setProducts(fallbackProducts);
        setTotalCount(fallbackProducts.length);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [category, featured, limit]);

  return { products, loading, totalCount };
}

// Helper function to fetch database products as fallback
async function fetchDatabaseProducts(): Promise<MarketplaceProduct[]> {
  const pageSize = 500;
  let from = 0;
  const all: any[] = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('products')
      .select('id, name, slug, description, short_description, price, status, features, thumbnail_url, git_repo_url, marketplace_visible, apk_url, demo_url, demo_login, demo_password, demo_enabled, featured, trending, target_industry, deploy_status, discount_percent, rating, tags, apk_enabled, license_enabled, buy_enabled, created_at')
      .eq('marketplace_visible', true)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    const rows = data || [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return all.map((p, i) => mapDbProduct(p, i));
}

/**
 * Convert GitHub repo to marketplace product
 */
function convertRepoToMarketplaceProduct(repo: RepoProduct): MarketplaceProduct {
  const randomStatus = (): 'upcoming' | 'live' | 'bestseller' | 'draft' => {
    const statuses: ('upcoming' | 'live' | 'bestseller' | 'draft')[] = ['live', 'upcoming', 'bestseller', 'draft'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  };

  const randomPrice = () => Math.floor(Math.random() * 50) + 5; // $5-$55
  const randomRating = () => Math.round((Math.random() * 2 + 3) * 10) / 10; // 3.0-5.0
  const randomDiscount = () => Math.floor(Math.random() * 30); // 0-30%

  return {
    id: repo.slug,
    slug: repo.slug,
    title: repo.title,
    subtitle: repo.description || `${repo.title} - Professional ${repo.category.toLowerCase()} solution`,
    image: `https://images.unsplash.com/photo-${Math.floor(Math.random() * 1000000000)}?w=400&h=300&fit=crop`,
    status: randomStatus(),
    price: randomPrice(),
    features: defaultFeatures,
    techStack: defaultTechStack,
    category: repo.category,
    businessType: repo.category,
    gitRepoUrl: repo.githubUrl,
    demoUrl: repo.demoUrl,
    demoEnabled: true,
    featured: Math.random() > 0.8, // 20% chance of being featured
    trending: Math.random() > 0.9, // 10% chance of being trending
    isAvailable: true,
    discount_percent: randomDiscount(),
    rating: randomRating(),
    tags: [repo.category, 'SaaS', 'Professional', 'Cloud-Based'],
    apk_enabled: true,
    license_enabled: true,
    buy_enabled: true,
  };
}


// Lightweight hook for category-specific fetching (still uses SDK for performance)
export function useProductsByCategory(categories: string[], options?: { enabled?: boolean }) {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const enabled = options?.enabled !== false;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const fetchProducts = async () => {
      setLoading(true);
      const pageSize = 500;
      let from = 0;
      const allRows: any[] = [];
      let error: any = null;

      while (true) {
        const to = from + pageSize - 1;
        const res = await supabase
          .from('products')
          .select('id, name, slug, description, short_description, price, status, features, thumbnail_url, git_repo_url, marketplace_visible, apk_url, demo_url, demo_login, demo_password, demo_enabled, featured, trending, target_industry, deploy_status, discount_percent, rating, tags, apk_enabled, license_enabled, buy_enabled, created_at')
          .eq('marketplace_visible', true)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (res.error) {
          error = res.error;
          break;
        }

        const rows = res.data || [];
        allRows.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }

      if (error) {
        setProducts([]);
      } else {
        const mapped = allRows.map((p, i) => mapDbProduct(p, i));
        const filtered = prioritizeProducts(
          mapped.filter(p => {
            const bt = (p.businessType || '').toLowerCase();
            const cat = (p.category || '').toLowerCase();
            return categories.some(c => bt.includes(c.toLowerCase()) || cat.includes(c.toLowerCase()));
          })
        );
        setProducts(filtered);
      }
      setLoading(false);
    };
    fetchProducts();
  }, [categories.join(','), enabled]);

  return { products, loading };
}
