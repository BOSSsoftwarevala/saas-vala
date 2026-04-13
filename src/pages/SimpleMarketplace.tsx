import React, { useState, useEffect } from 'react';
import { SimpleNetflixRow } from '@/components/marketplace/SimpleNetflixRow';
import { SimpleSoftwareCard } from '@/components/marketplace/SimpleSoftwareCard';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
}

interface Software {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  icon: string;
  price: number;
  currency: string;
  status: string;
  demo_url: string;
  categories: {
    name: string;
    slug: string;
  };
}

const SimpleMarketplace: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [softwaresByCategory, setSoftwaresByCategory] = useState<Record<string, Software[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Define categories directly
  useEffect(() => {
    const categoryList: Category[] = [
      { id: '1', name: 'Software', slug: 'software', icon: '💻' },
      { id: '2', name: 'Mobile Apps', slug: 'mobile', icon: '📱' },
      { id: '3', name: 'Web Apps', slug: 'web', icon: '🌐' },
      { id: '4', name: 'ERP Systems', slug: 'erp', icon: '🏢' },
      { id: '5', name: 'CRM', slug: 'crm', icon: '👥' },
      { id: '6', name: 'E-commerce', slug: 'ecommerce', icon: '🛒' },
      { id: '7', name: 'Education', slug: 'education', icon: '📚' },
      { id: '8', name: 'Healthcare', slug: 'healthcare', icon: '🏥' },
      { id: '9', name: 'Finance', slug: 'finance', icon: '💰' },
      { id: '10', name: 'Productivity', slug: 'productivity', icon: '⚡' },
    ];
    setCategories(categoryList);
  }, []);

  // Fetch softwares for each category
  useEffect(() => {
    const fetchSoftwaresForCategories = async () => {
      if (categories.length === 0) return;

      setLoading(true);
      const newSoftwaresByCategory: Record<string, Software[]> = {};

      try {
        // Fetch softwares directly from products table (bypassing API gateway)
        const { data: products, error } = await supabase
          .from('products')
          .select('*')
          .eq('marketplace_visible', true)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Group products by category
        categories.forEach((category) => {
          const categoryProducts = (products || [])
            .filter((p: any) => 
              p.business_type === category.slug || 
              p.target_industry === category.slug ||
              category.slug === 'software'
            )
            .slice(0, 15)
            .map((p: any) => ({
              id: p.id,
              name: p.name,
              slug: p.slug,
              tagline: p.short_description || p.tagline || '',
              icon: p.thumbnail_url || '',
              price: p.price || 0,
              currency: p.currency || 'USD',
              status: p.status,
              demo_url: p.demo_url,
              categories: {
                name: category.name,
                slug: category.slug,
              },
            }));

          newSoftwaresByCategory[category.slug] = categoryProducts;
        });

        setSoftwaresByCategory(newSoftwaresByCategory);
      } catch (error) {
        console.error('Error fetching products:', error);
        setError('Failed to load products');
        toast.error('Failed to load products');
      } finally {
        setLoading(false);
      }
    };

    fetchSoftwaresForCategories();
  }, [categories]);

  const handleViewAll = (categorySlug: string) => {
    window.location.href = `/category/${categorySlug}`;
  };

  // Skeleton loading component
  const SkeletonRow = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4 px-4 md:px-0">
        <Skeleton className="h-6 w-48 bg-gray-800" />
        <Skeleton className="h-8 w-20 bg-gray-800" />
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 px-4 md:px-0">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex-shrink-0 w-64">
            <Skeleton className="h-64 w-full bg-gray-800 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
          <p className="text-gray-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gradient-to-b from-gray-900 to-black py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
            Software Marketplace
          </h1>
          <p className="text-gray-400 text-lg">
            Discover premium software solutions for your business
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto py-8 px-4 md:px-8">
        {loading ? (
          // Show skeleton rows while loading
          [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
        ) : (
          // Show category rows
          categories.map((category) => (
            <SimpleNetflixRow
              key={category.id}
              title={category.name}
              onViewAll={() => handleViewAll(category.slug)}
            >
              {softwaresByCategory[category.slug]?.map((software) => (
                <SimpleSoftwareCard
                  key={software.id}
                  software={{
                    ...software,
                    category: software.categories.name,
                  }}
                />
              ))}
              
              {/* Show empty state if no softwares in category */}
              {(!softwaresByCategory[category.slug] || 
                softwaresByCategory[category.slug].length === 0) && (
                <div className="flex-shrink-0 w-64 bg-gray-900 border border-gray-800 rounded-lg p-8 text-center" style={{ scrollSnapAlign: 'start' }}>
                  <div className="text-gray-500">No software available in this category</div>
                </div>
              )}
            </SimpleNetflixRow>
          ))
        )}

        {/* Show message if no categories */}
        {!loading && categories.length === 0 && (
          <div className="text-center py-16">
            <h2 className="text-2xl font-bold mb-4">No categories available</h2>
            <p className="text-gray-400">Please check back later for new software categories.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-900 py-8 px-4 md:px-8 mt-16">
        <div className="max-w-7xl mx-auto text-center text-gray-400">
          <p>&copy; 2024 SaaS Vala. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default SimpleMarketplace;
