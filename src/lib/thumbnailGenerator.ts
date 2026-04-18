import { supabase } from '@/lib/supabase';

interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number;
  timeout?: number;
}

interface ThumbnailResult {
  success: boolean;
  thumbnailUrl?: string;
  error?: string;
  fallbackUsed?: boolean;
}

class ThumbnailGenerator {
  private readonly API_BASE = 'https://api.screenshotone.com/take';
  private readonly DEFAULT_OPTIONS: Required<ThumbnailOptions> = {
    width: 1200,
    height: 630,
    quality: 80,
    timeout: 15000,
  };

  private readonly FALLBACK_IMAGES = {
    general: '/softwarevala-logo.png',
    healthcare: '/softwarevala-logo.png',
    finance: '/softwarevala-logo.png',
    education: '/softwarevala-logo.png',
    retail: '/softwarevala-logo.png',
    food: '/softwarevala-logo.png',
    transport: '/softwarevala-logo.png',
    manufacturing: '/softwarevala-logo.png',
    realestate: '/softwarevala-logo.png',
    ecommerce: '/softwarevala-logo.png',
    hospitality: '/softwarevala-logo.png',
    logistics: '/softwarevala-logo.png',
    energy: '/softwarevala-logo.png',
    telecom: '/softwarevala-logo.png',
    agriculture: '/softwarevala-logo.png',
    construction: '/softwarevala-logo.png',
    automotive: '/softwarevala-logo.png',
    cybersecurity: '/softwarevala-logo.png',
    media: '/softwarevala-logo.png',
    social: '/softwarevala-logo.png',
    analytics: '/softwarevala-logo.png',
    productivity: '/softwarevala-logo.png',
    'ai-tools': '/softwarevala-logo.png',
    'dev-tools': '/softwarevala-logo.png',
    'cloud-devops': '/softwarevala-logo.png',
    'it-software': '/softwarevala-logo.png',
    'invest-finance': '/softwarevala-logo.png',
  };

  /**
   * Generate thumbnail from URL using multiple fallback methods
   */
  async generateThumbnail(
    url: string,
    category: string = 'general',
    options: ThumbnailOptions = {}
  ): Promise<ThumbnailResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    try {
      // Method 1: Try ScreenshotOne API
      const screenshotResult = await this.generateWithScreenshotOne(url, opts);
      if (screenshotResult.success) {
        return screenshotResult;
      }

      // Method 2: Try HTML/CSS to Image API
      const htmlToImageResult = await this.generateWithHtmlToImage(url, opts);
      if (htmlToImageResult.success) {
        return htmlToImageResult;
      }

      // Method 3: Try to fetch favicon as fallback
      const faviconResult = await this.generateWithFavicon(url);
      if (faviconResult.success) {
        return faviconResult;
      }

      // Method 4: Use category-based fallback
      return this.getFallbackThumbnail(category);
    } catch (error) {
      console.error('Thumbnail generation failed:', error);
      return this.getFallbackThumbnail(category);
    }
  }

  /**
   * Generate thumbnail using ScreenshotOne API
   */
  private async generateWithScreenshotOne(
    url: string,
    options: Required<ThumbnailOptions>
  ): Promise<ThumbnailResult> {
    try {
      const params = new URLSearchParams({
        access_key: import.meta.env.VITE_SCREENSHOTONE_ACCESS_KEY || '',
        url: encodeURIComponent(url),
        width: options.width.toString(),
        height: options.height.toString(),
        device_scale_factor: '2',
        format: 'png',
        quality: options.quality.toString(),
        block_ads: 'true',
        block_cookie_banners: 'true',
        block_trackers: 'true',
        delay: '2',
        element: 'body',
      });

      const response = await fetch(`${this.API_BASE}?${params}`, {
        signal: AbortSignal.timeout(options.timeout),
      });

      if (!response.ok) {
        throw new Error(`ScreenshotOne API failed: ${response.status}`);
      }

      const blob = await response.blob();
      const thumbnailUrl = await this.uploadThumbnailToStorage(blob, url);

      return {
        success: true,
        thumbnailUrl,
      };
    } catch (error) {
      console.error('ScreenshotOne failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Generate thumbnail using HTML/CSS to Image service
   */
  private async generateWithHtmlToImage(
    url: string,
    options: Required<ThumbnailOptions>
  ): Promise<ThumbnailResult> {
    try {
      // Using a simple HTML to Image API approach
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Preview</title>
            <style>
              body {
                margin: 0;
                padding: 20px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                text-align: center;
              }
              .container {
                max-width: 800px;
                padding: 40px;
                background: rgba(255,255,255,0.1);
                border-radius: 20px;
                backdrop-filter: blur(10px);
              }
              .url {
                font-size: 24px;
                margin-bottom: 20px;
                word-break: break-all;
              }
              .title {
                font-size: 48px;
                font-weight: bold;
                margin-bottom: 20px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="title">Demo Preview</div>
              <div class="url">${url}</div>
            </div>
          </body>
        </html>
      `;

      const formData = new FormData();
      formData.append('html', htmlContent);
      formData.append('width', options.width.toString());
      formData.append('height', options.height.toString());
      formData.append('quality', options.quality.toString());

      const response = await fetch('https://hcti.io/v1/image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_HCTI_API_KEY || ''}`,
        },
        body: formData,
        signal: AbortSignal.timeout(options.timeout),
      });

      if (!response.ok) {
        throw new Error(`HTML to Image API failed: ${response.status}`);
      }

      const result = await response.json();
      const blob = await fetch(result.url).then(r => r.blob());
      const thumbnailUrl = await this.uploadThumbnailToStorage(blob, url);

      return {
        success: true,
        thumbnailUrl,
      };
    } catch (error) {
      console.error('HTML to Image failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Try to fetch favicon as simple fallback
   */
  private async generateWithFavicon(url: string): Promise<ThumbnailResult> {
    try {
      const domain = new URL(url).origin;
      const faviconUrls = [
        `${domain}/favicon.ico`,
        `${domain}/favicon.png`,
        `${domain}/apple-touch-icon.png`,
        `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
      ];

      for (const faviconUrl of faviconUrls) {
        try {
          const response = await fetch(faviconUrl, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000),
          });

          if (response.ok) {
            const blob = await fetch(faviconUrl).then(r => r.blob());
            const thumbnailUrl = await this.uploadThumbnailToStorage(blob, url);
            return {
              success: true,
              thumbnailUrl,
            };
          }
        } catch {
          continue;
        }
      }

      return { success: false, error: 'No favicon found' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get fallback thumbnail based on category
   */
  private getFallbackThumbnail(category: string): ThumbnailResult {
    const fallbackUrl = this.FALLBACK_IMAGES[category as keyof typeof this.FALLBACK_IMAGES] || 
                       this.FALLBACK_IMAGES.general;

    return {
      success: true,
      thumbnailUrl: fallbackUrl,
      fallbackUsed: true,
    };
  }

  /**
   * Upload thumbnail blob to Supabase storage
   */
  private async uploadThumbnailToStorage(blob: Blob, originalUrl: string): Promise<string> {
    const timestamp = Date.now();
    const urlHash = btoa(originalUrl).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    const fileName = `thumbnail-${urlHash}-${timestamp}.png`;
    const filePath = `thumbnails/${fileName}`;

    const { data, error } = await supabase.storage
      .from('thumbnails')
      .upload(filePath, blob, {
        contentType: 'image/png',
        cacheControl: '31536000', // 1 year cache
      });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('thumbnails')
      .getPublicUrl(filePath);

    return publicUrl;
  }

  /**
   * Update product thumbnail in database
   */
  async updateProductThumbnail(productId: string, thumbnailUrl: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .update({ 
        thumbnail_url: thumbnailUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);

    if (error) {
      throw new Error(`Database update failed: ${error.message}`);
    }
  }

  /**
   * Generate and update thumbnail for a product
   */
  async generateAndUpdateThumbnail(
    productId: string,
    demoUrl: string,
    category: string = 'general'
  ): Promise<ThumbnailResult> {
    try {
      const result = await this.generateThumbnail(demoUrl, category);
      
      if (result.success && result.thumbnailUrl) {
        await this.updateProductThumbnail(productId, result.thumbnailUrl);
      }

      return result;
    } catch (error) {
      console.error('Failed to generate and update thumbnail:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Batch generate thumbnails for multiple products
   */
  async batchGenerateThumbnails(
    products: Array<{ id: string; demo_url: string; category?: string }>
  ): Promise<Array<{ productId: string; result: ThumbnailResult }>> {
    const results = await Promise.allSettled(
      products.map(async (product) => ({
        productId: product.id,
        result: await this.generateAndUpdateThumbnail(
          product.id,
          product.demo_url,
          product.category
        ),
      }))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          productId: products[index].id,
          result: {
            success: false,
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
          },
        };
      }
    });
  }
}

// Singleton instance
export const thumbnailGenerator = new ThumbnailGenerator();

// Utility function for easy usage
export async function generateProductThumbnail(
  productId: string,
  demoUrl: string,
  category?: string
): Promise<ThumbnailResult> {
  if (!demoUrl) {
    return {
      success: false,
      error: 'No demo URL provided',
    };
  }

  return thumbnailGenerator.generateAndUpdateThumbnail(productId, demoUrl, category);
}
