import { supabase } from '@/integrations/supabase/client';
import { thumbnailGenerator } from '@/lib/thumbnailGenerator';

/**
 * Utility to generate thumbnails for existing products that have demo URLs but no thumbnails
 */
export async function generateThumbnailsForExistingProducts() {
  try {
    console.log('Starting batch thumbnail generation for existing products...');

    // Fetch products that have demo_url but no thumbnail_url
    const { data: products, error } = await supabase
      .from('products')
      .select('id, demo_url, target_industry, name')
      .not('demo_url', 'is', null)
      .is('thumbnail_url', null)
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to fetch products: ${error.message}`);
    }

    if (!products || products.length === 0) {
      console.log('No products found that need thumbnail generation');
      return { success: true, processed: 0, results: [] };
    }

    console.log(`Found ${products.length} products needing thumbnails`);

    // Process in batches to avoid overwhelming APIs
    const batchSize = 5;
    const results = [];

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(products.length / batchSize)}`);

      const batchResults = await thumbnailGenerator.batchGenerateThumbnails(
        batch.map(p => ({
          id: p.id,
          demo_url: p.demo_url!,
          category: p.target_industry || 'general'
        }))
      );

      results.push(...batchResults);

      // Add delay between batches to respect rate limits
      if (i + batchSize < products.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const successful = results.filter(r => r.result.success).length;
    const failed = results.length - successful;

    console.log(`Batch generation complete: ${successful} successful, ${failed} failed`);

    return {
      success: true,
      processed: products.length,
      successful,
      failed,
      results
    };

  } catch (error) {
    console.error('Batch thumbnail generation failed:', error);
    return {
      success: false,
      processed: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Regenerate thumbnails for all products with demo URLs
 */
export async function regenerateAllThumbnails() {
  try {
    console.log('Starting full thumbnail regeneration...');

    const { data: products, error } = await supabase
      .from('products')
      .select('id, demo_url, target_industry, name')
      .not('demo_url', 'is', null)
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to fetch products: ${error.message}`);
    }

    if (!products || products.length === 0) {
      console.log('No products found with demo URLs');
      return { success: true, processed: 0, results: [] };
    }

    console.log(`Regenerating thumbnails for ${products.length} products`);

    const results = await thumbnailGenerator.batchGenerateThumbnails(
      products.map(p => ({
        id: p.id,
        demo_url: p.demo_url!,
        category: p.target_industry || 'general'
      }))
    );

    const successful = results.filter(r => r.result.success).length;
    const failed = results.length - successful;

    console.log(`Regeneration complete: ${successful} successful, ${failed} failed`);

    return {
      success: true,
      processed: products.length,
      successful,
      failed,
      results
    };

  } catch (error) {
    console.error('Thumbnail regeneration failed:', error);
    return {
      success: false,
      processed: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check thumbnail status for all products
 */
export async function checkThumbnailStatus() {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, demo_url, thumbnail_url, target_industry, status')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch products: ${error.message}`);
    }

    const stats = {
      total: products?.length || 0,
      withDemoUrl: 0,
      withThumbnail: 0,
      withDemoUrlAndThumbnail: 0,
      withDemoUrlNoThumbnail: 0,
      noDemoUrl: 0,
      byCategory: {} as Record<string, { total: number; withThumbnail: number; withoutThumbnail: number }>
    };

    products?.forEach(product => {
      const hasDemo = !!product.demo_url;
      const hasThumbnail = !!product.thumbnail_url;
      const category = product.target_industry || 'general';

      // Initialize category stats
      if (!stats.byCategory[category]) {
        stats.byCategory[category] = { total: 0, withThumbnail: 0, withoutThumbnail: 0 };
      }

      stats.byCategory[category].total++;

      if (hasDemo) {
        stats.withDemoUrl++;
        if (hasThumbnail) {
          stats.withDemoUrlAndThumbnail++;
          stats.byCategory[category].withThumbnail++;
        } else {
          stats.withDemoUrlNoThumbnail++;
          stats.byCategory[category].withoutThumbnail++;
        }
      } else {
        stats.noDemoUrl++;
      }

      if (hasThumbnail) {
        stats.withThumbnail++;
      }
    });

    return {
      success: true,
      stats,
      products: products || []
    };

  } catch (error) {
    console.error('Failed to check thumbnail status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Export for use in browser console or admin tools
if (typeof window !== 'undefined') {
  (window as any).thumbnailUtils = {
    generateThumbnailsForExistingProducts,
    regenerateAllThumbnails,
    checkThumbnailStatus
  };
}
