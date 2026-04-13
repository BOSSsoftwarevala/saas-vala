import React, { useState, useEffect } from 'react';
import { SimpleNetflixRow } from '@/components/marketplace/SimpleNetflixRow';
import { SimpleSoftwareCard } from '@/components/marketplace/SimpleSoftwareCard';
import { Skeleton } from '@/components/ui/skeleton';
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
  category: string;
}

const CATEGORIES: Category[] = [
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

const SimpleMarketplace: React.FC = () => {
  const [softwaresByCategory, setSoftwaresByCategory] = useState<Record<string, Software[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, slug, short_description, thumbnail_url, price, currency, status, demo_url, business_type, tags')
          .eq('marketplace_visible', true)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;

        const grouped: Record<string, Software[]> = {};
        CATEGORIES.forEach(cat => { grouped[cat.slug] = []; });

        (data || []).forEach((p: any) => {
          const sw: Software = {
            id: p.id,
            name: p.name,
            slug: p.slug || p.id,
            tagline: p.short_description || '',
            icon: p.thumbnail_url || '📦',
            price: p.price || 0,
            currency: p.currency || 'USD',
            status: p.status,
            demo_url: p.demo_url || '',
            category: p.business_type || 'software',
          };

          const cat = CATEGORIES.find(c => c.slug === p.business_type);
          if (cat) {
            grouped[cat.slug].push(sw);
          } else {
            grouped['software'].push(sw);
          }
        });

        setSoftwaresByCategory(grouped);
      } catch (err) {
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const handleViewAll = (categorySlug: string) => {
    window.location.href = `/marketplace/category/${categorySlug}`;
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
          CATEGORIES.map((category) => (
            <SimpleNetflixRow
              key={category.id}
              title={`${category.icon} ${category.name}`}
              onViewAll={() => handleViewAll(category.slug)}
            >
              {softwaresByCategory[category.slug]?.map((software) => (
                <SimpleSoftwareCard
                  key={software.id}
                  software={software}
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
