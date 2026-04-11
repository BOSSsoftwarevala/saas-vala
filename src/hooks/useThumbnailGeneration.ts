import { useState, useCallback } from 'react';
import { generateProductThumbnail, thumbnailGenerator } from '@/lib/thumbnailGenerator';
import { toast } from 'sonner';

interface ThumbnailGenerationOptions {
  onSuccess?: (thumbnailUrl: string) => void;
  onError?: (error: string) => void;
  showToasts?: boolean;
}

export function useThumbnailGeneration(options: ThumbnailGenerationOptions = {}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const generateThumbnail = useCallback(async (
    productId: string,
    demoUrl: string,
    category: string = 'general'
  ) => {
    if (!demoUrl) {
      const error = 'No demo URL provided';
      options.onError?.(error);
      if (options.showToasts !== false) {
        toast.error(error);
      }
      return { success: false, error };
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      if (options.showToasts !== false) {
        toast.info('Generating thumbnail...');
      }

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const result = await generateProductThumbnail(productId, demoUrl, category);
      
      clearInterval(progressInterval);
      setProgress(100);

      if (result.success) {
        options.onSuccess?.(result.thumbnailUrl || '');
        if (options.showToasts !== false) {
          if (result.fallbackUsed) {
            toast.info('Thumbnail generated using fallback image');
          } else {
            toast.success('Thumbnail generated successfully');
          }
        }
      } else {
        options.onError?.(result.error || 'Unknown error');
        if (options.showToasts !== false) {
          toast.warning(`Thumbnail generation failed: ${result.error || 'Unknown error'}`);
        }
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      options.onError?.(errorMessage);
      if (options.showToasts !== false) {
        toast.warning('Thumbnail generation failed, using fallback');
      }
      return { success: false, error: errorMessage };
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  }, [options]);

  const batchGenerateThumbnails = useCallback(async (
    products: Array<{ id: string; demo_url: string; category?: string }>
  ) => {
    setIsGenerating(true);
    setProgress(0);

    try {
      if (options.showToasts !== false) {
        toast.info(`Generating thumbnails for ${products.length} products...`);
      }

      const results = await thumbnailGenerator.batchGenerateThumbnails(products);
      
      const successful = results.filter(r => r.result.success).length;
      const failed = results.length - successful;

      if (options.showToasts !== false) {
        if (successful > 0) {
          toast.success(`Generated ${successful} thumbnail${successful > 1 ? 's' : ''}`);
        }
        if (failed > 0) {
          toast.warning(`Failed to generate ${failed} thumbnail${failed > 1 ? 's' : ''}`);
        }
      }

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      options.onError?.(errorMessage);
      if (options.showToasts !== false) {
        toast.error('Batch thumbnail generation failed');
      }
      return [];
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  }, [options]);

  return {
    generateThumbnail,
    batchGenerateThumbnails,
    isGenerating,
    progress,
  };
}

// Hook for automatic thumbnail generation when demo URL changes
export function useAutoThumbnailGeneration() {
  const [pendingGenerations, setPendingGenerations] = useState<Set<string>>(new Set());

  const queueThumbnailGeneration = useCallback((
    productId: string,
    demoUrl: string,
    category: string = 'general'
  ) => {
    if (!demoUrl || pendingGenerations.has(productId)) {
      return;
    }

    setPendingGenerations(prev => new Set(prev).add(productId));

    // Generate thumbnail asynchronously without blocking UI
    generateProductThumbnail(productId, demoUrl, category)
      .then((result) => {
        if (result.success) {
          console.log(`Thumbnail generated for product ${productId}`);
        } else {
          console.warn(`Thumbnail generation failed for product ${productId}:`, result.error);
        }
      })
      .catch((error) => {
        console.error(`Thumbnail generation error for product ${productId}:`, error);
      })
      .finally(() => {
        setPendingGenerations(prev => {
          const newSet = new Set(prev);
          newSet.delete(productId);
          return newSet;
        });
      });
  }, [pendingGenerations]);

  const isPending = useCallback((productId: string) => {
    return pendingGenerations.has(productId);
  }, [pendingGenerations]);

  return {
    queueThumbnailGeneration,
    isPending,
    pendingCount: pendingGenerations.size,
  };
}
