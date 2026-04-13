import React, { useState, useEffect } from 'react';
import { SimpleNetflixRow } from '@/components/marketplace/SimpleNetflixRow';
import { SimpleSoftwareCard } from '@/components/marketplace/SimpleSoftwareCard';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

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

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-gateway/marketplace/categories`, {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          }
        });
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch categories');
        }
        
        setCategories(data.categories || []);
      } catch (error) {
        console.error('Error fetching categories:', error);
        setError('Failed to load categories');
        toast.error('Failed to load categories');
      }
    };

    fetchCategories();
  }, []);

  // Fetch softwares for each category
  useEffect(() => {
    const fetchSoftwaresForCategories = async () => {
      if (categories.length === 0) return;

      setLoading(true);
      const newSoftwaresByCategory: Record<string, Software[]> = {};

      try {
        // Fetch softwares for each category
        const promises = categories.map(async (category) => {
          const response = await fetch(`/api/softwares?category=${category.slug}&limit=15`);
          const data = await response.json();
          
          if (response.ok) {
            return { category: category.slug, softwares: data.softwares };
          }
          return { category: category.slug, softwares: [] };
        });

        const results = await Promise.all(promises);
        
        results.forEach(({ category, softwares }) => {
          newSoftwaresByCategory[category] = softwares;
        });

        setSoftwaresByCategory(newSoftwaresByCategory);
      } catch (error) {
        console.error('Error fetching softwares:', error);
        setError('Failed to load softwares');
        toast.error('Failed to load softwares');
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
