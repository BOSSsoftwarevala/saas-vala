import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MarketplaceProduct {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  status: 'upcoming' | 'live' | 'bestseller';
  price: number;
  features: { icon: string; text: string }[];
  techStack: string[];
  gitRepoUrl?: string;
  apkUrl?: string;
}

// Business stock images for product cards
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
  { icon: 'Shield', text: 'Secure' },
];

const defaultTechStack = ['React', 'Node.js', 'PostgreSQL', 'AWS', 'SSL'];

function formatProductName(slug: string): string {
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .substring(0, 40);
}

function mapDbProduct(product: any, index: number): MarketplaceProduct {
  const features = Array.isArray(product.features) && product.features.length > 0
    ? product.features.slice(0, 5).map((f: any) => 
        typeof f === 'string' 
          ? { icon: 'CheckCircle2', text: f }
          : f
      )
    : defaultFeatures;

  return {
    id: product.id,
    title: formatProductName(product.name || product.slug),
    subtitle: product.description?.substring(0, 60) || 'Professional Software Solution',
    image: product.thumbnail_url || stockImages[index % stockImages.length],
    status: product.status === 'draft' ? 'upcoming' : 'live',
    price: Number(product.price) || 5,
    features,
    techStack: defaultTechStack,
    gitRepoUrl: product.git_repo_url,
    apkUrl: product.apk_url || undefined,
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
        .select('id, name, slug, description, price, status, features, thumbnail_url, git_repo_url, marketplace_visible, apk_url')
        .eq('marketplace_visible', true)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch marketplace products:', error);
        setProducts([]);
      } else {
        setProducts((data || []).map((p, i) => mapDbProduct(p, i)));
      }
      setLoading(false);
    };

    fetchProducts();
  }, []);

  // Split into rows of 30
  const dbRow1 = products.slice(0, 30);
  const dbRow2 = products.slice(30, 60);
  const dbRow3 = products.slice(60, 90);
  const dbRow4 = products.slice(90, 120);
  const dbRow5 = products.slice(120, 150);
  const dbRow6 = products.slice(150, 180);
  const dbRow7 = products.slice(180, 210);
  const dbRow8 = products.slice(210, 240);
  const dbRow9 = products.slice(240, 270);
  const dbRow10 = products.slice(270, 300);
  const remaining = products.slice(300);

  const allRows = [dbRow1, dbRow2, dbRow3, dbRow4, dbRow5, dbRow6, dbRow7, dbRow8, dbRow9, dbRow10];
  if (remaining.length > 0) allRows.push(remaining);

  return {
    products,
    allRows: allRows.filter(r => r.length > 0),
    loading,
    totalCount: products.length,
  };
}
