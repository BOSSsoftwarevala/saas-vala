// =====================================================
// PRODUCT MANAGER SYSTEM API - CODECANYON LEVEL
// =====================================================
// STRICT MODE: NO UI CHANGE • ONLY BACKEND UPGRADE
// =====================================================

import { supabase } from './supabase';

// =====================================================
// TYPES
// =====================================================

export interface Product {
  id?: string;
  name: string;
  slug: string;
  short_description?: string;
  full_description?: string;
  description?: string;
  category_id?: string;
  tags?: string[];
  price?: number;
  status?: 'active' | 'draft' | 'suspended';
  business_type?: string;
  target_industry?: string;
  demo_url?: string;
  demo_enabled?: boolean;
  demo_credentials?: Record<string, any>;
  demo_video_url?: string;
  main_file_url?: string;
  documentation_url?: string;
  video_url?: string;
  apk_url?: string;
  apk_enabled?: boolean;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string[];
  og_image?: string;
  canonical_url?: string;
  thumbnail_url?: string;
  featured?: boolean;
  trending?: boolean;
  marketplace_visible?: boolean;
  discount_percent?: number;
  rating?: number;
  license_enabled?: boolean;
  buy_enabled?: boolean;
  git_repo_url?: string;
  git_repo_owner?: string;
  git_repo_name?: string;
  last_synced_at?: string;
  features?: string[];
  demo_login?: string;
  demo_password?: string;
  deploy_status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProductFile {
  id?: string;
  product_id: string;
  file_type: 'main' | 'documentation' | 'extra' | 'apk';
  file_name: string;
  file_url: string;
  file_size?: number;
  file_mime_type?: string;
  version?: string;
  changelog?: string;
  release_date?: string;
  download_count?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface License {
  id?: string;
  license_key: string;
  product_id: string;
  user_id?: string;
  order_id?: string;
  device_id?: string;
  device_info?: Record<string, any>;
  status?: 'active' | 'suspended' | 'expired' | 'revoked';
  expires_at?: string;
  max_activations?: number;
  current_activations?: number;
  last_validated_at?: string;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface DownloadLog {
  id?: string;
  file_id: string;
  license_id?: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  download_count?: number;
  created_at?: string;
}

export interface BlogPost {
  id?: string;
  title: string;
  slug: string;
  content?: string;
  excerpt?: string;
  thumbnail_url?: string;
  author_id?: string;
  status?: 'published' | 'draft' | 'archived';
  tags?: string[];
  category_id?: string;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string[];
  og_image?: string;
  canonical_url?: string;
  linked_product_ids?: string[];
  published_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProductCategory {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  parent_id?: string;
  sort_order?: number;
  is_active?: boolean;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface SitemapEntry {
  id?: string;
  url: string;
  type: 'product' | 'blog' | 'category' | 'static';
  resource_id?: string;
  priority?: number;
  change_frequency?: string;
  last_modified?: string;
  created_at?: string;
}

// =====================================================
// MODULE 1: PRODUCT API WITH PAGINATION & FILTERS
// =====================================================

export interface ProductFilters {
  status?: 'active' | 'draft' | 'suspended';
  category_id?: string;
  tags?: string[];
  search?: string;
  featured?: boolean;
  trending?: boolean;
  marketplace_visible?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const productApi = {
  // GET /products - Fetch products with pagination and filters
  async getProducts(
    page: number = 1,
    pageSize: number = 20,
    filters: ProductFilters = {}
  ): Promise<PaginatedResponse<Product>> {
    try {
      let query = supabase
        .from('products')
        .select('*', { count: 'exact' });

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.category_id) {
        query = query.eq('category_id', filters.category_id);
      }
      if (filters.featured !== undefined) {
        query = query.eq('featured', filters.featured);
      }
      if (filters.trending !== undefined) {
        query = query.eq('trending', filters.trending);
      }
      if (filters.marketplace_visible !== undefined) {
        query = query.eq('marketplace_visible', filters.marketplace_visible);
      }
      if (filters.tags && filters.tags.length > 0) {
        query = query.contains('tags', filters.tags);
      }
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,slug.ilike.%${filters.search}%,short_description.ilike.%${filters.search}%`);
      }

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      // Ordering
      query = query.order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: data || [],
        count: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    } catch (error) {
      console.error('Error fetching products:', error);
      return { data: [], count: 0, page, pageSize, totalPages: 0 };
    }
  },

  // GET /product/{slug} - Fetch product by slug
  async getProductBySlug(slug: string): Promise<Product | null> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching product by slug:', error);
      return null;
    }
  },

  // GET /product/{id} - Fetch product by ID
  async getProductById(id: string): Promise<Product | null> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching product by ID:', error);
      return null;
    }
  },

  // POST /product - Create product
  async createProduct(product: Product): Promise<Product | null> {
    try {
      // Auto-generate slug if not provided
      if (!product.slug) {
        product.slug = await this.generateSlug(product.name);
      }

      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single();

      if (error) throw error;
      
      // Add to sitemap
      if (data && data.marketplace_visible) {
        await sitemapApi.addEntry({
          url: `/product/${data.slug}`,
          type: 'product',
          resource_id: data.id,
          priority: 0.8,
          change_frequency: 'weekly',
        });
      }
      
      return data;
    } catch (error) {
      console.error('Error creating product:', error);
      return null;
    }
  },

  // PUT /product/{id} - Update product
  async updateProduct(id: string, product: Partial<Product>): Promise<Product | null> {
    try {
      const { data, error } = await supabase
        .from('products')
        .update(product)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      // Update sitemap
      if (data && data.marketplace_visible) {
        await sitemapApi.updateEntry(
          `/product/${data.slug}`,
          { last_modified: new Date().toISOString() }
        );
      }
      
      return data;
    } catch (error) {
      console.error('Error updating product:', error);
      return null;
    }
  },

  // DELETE /product/{id} - Delete product
  async deleteProduct(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Remove from sitemap
      await sitemapApi.removeEntry(`/product/${id}`);
      
      return true;
    } catch (error) {
      console.error('Error deleting product:', error);
      return false;
    }
  },

  // Helper: Generate unique slug
  async generateSlug(name: string): Promise<string> {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const { data } = await supabase
        .from('products')
        .select('slug')
        .eq('slug', slug)
        .single();

      if (!data) break;

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  },

  // Get product counts by status
  async getProductCounts(): Promise<{ all: number; active: number; draft: number; suspended: number }> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('status');

      if (error) throw error;

      const counts = {
        all: data?.length || 0,
        active: data?.filter(p => p.status === 'active').length || 0,
        draft: data?.filter(p => p.status === 'draft').length || 0,
        suspended: data?.filter(p => p.status === 'suspended').length || 0,
      };

      return counts;
    } catch (error) {
      console.error('Error fetching product counts:', error);
      return { all: 0, active: 0, draft: 0, suspended: 0 };
    }
  },
};

// =====================================================
// MODULE 3: FILE & VERSION SYSTEM API
// =====================================================

export const productFileApi = {
  // Get files for a product
  async getProductFiles(productId: string): Promise<ProductFile[]> {
    try {
      const { data, error } = await supabase
        .from('product_files')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching product files:', error);
      return [];
    }
  },

  // Upload file (placeholder - needs storage integration)
  async uploadFile(
    productId: string,
    file: File,
    fileType: 'main' | 'documentation' | 'extra' | 'apk',
    version?: string,
    changelog?: string
  ): Promise<ProductFile | null> {
    try {
      // TODO: Implement actual file upload to Supabase Storage
      // For now, return a placeholder
      const fileData: ProductFile = {
        product_id: productId,
        file_type: fileType,
        file_name: file.name,
        file_url: '', // Will be set after upload
        file_size: file.size,
        file_mime_type: file.type,
        version,
        changelog,
        is_active: true,
      };

      const { data, error } = await supabase
        .from('product_files')
        .insert(fileData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  },

  // Delete file
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('product_files')
        .delete()
        .eq('id', fileId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  },

  // Increment download count
  async incrementDownloadCount(fileId: string): Promise<void> {
    try {
      await supabase.rpc('increment_file_download_count', { file_id: fileId });
    } catch (error) {
      console.error('Error incrementing download count:', error);
    }
  },
};

// =====================================================
// MODULE 8: LICENSE SYSTEM API
// =====================================================

export const licenseApi = {
  // Generate license
  async generateLicense(
    productId: string,
    userId: string,
    orderId?: string,
    expiresInDays?: number
  ): Promise<License | null> {
    try {
      const { data, error } = await supabase.rpc('generate_license_key');
      if (error) throw error;

      const licenseData: License = {
        license_key: data,
        product_id: productId,
        user_id: userId,
        order_id: orderId,
        status: 'active',
        max_activations: 5,
        current_activations: 0,
        expires_at: expiresInDays
          ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
          : null,
      };

      const { data: license, error: insertError } = await supabase
        .from('licenses')
        .insert(licenseData)
        .select()
        .single();

      if (insertError) throw insertError;
      return license;
    } catch (error) {
      console.error('Error generating license:', error);
      return null;
    }
  },

  // Validate license
  async validateLicense(licenseKey: string, deviceId?: string): Promise<License | null> {
    try {
      const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .eq('license_key', licenseKey)
        .single();

      if (error) throw error;

      // Check if license is active
      if (data.status !== 'active') {
        throw new Error('License is not active');
      }

      // Check if expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        await this.updateLicenseStatus(data.id, 'expired');
        throw new Error('License has expired');
      }

      // Check activation limit
      if (deviceId && data.current_activations >= (data.max_activations || 5)) {
        throw new Error('License activation limit reached');
      }

      // Update last validated timestamp
      await supabase
        .from('licenses')
        .update({ last_validated_at: new Date().toISOString() })
        .eq('id', data.id);

      return data;
    } catch (error) {
      console.error('Error validating license:', error);
      return null;
    }
  },

  // Activate license on device
  async activateLicense(licenseId: string, deviceId: string, deviceInfo: Record<string, any>): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('licenses')
        .select('current_activations, max_activations')
        .eq('id', licenseId)
        .single();

      if (error) throw error;

      if (data.current_activations >= (data.max_activations || 5)) {
        throw new Error('Activation limit reached');
      }

      const { error: updateError } = await supabase
        .from('licenses')
        .update({
          device_id: deviceId,
          device_info: deviceInfo,
          current_activations: (data.current_activations || 0) + 1,
        })
        .eq('id', licenseId);

      if (updateError) throw updateError;
      return true;
    } catch (error) {
      console.error('Error activating license:', error);
      return false;
    }
  },

  // Deactivate license
  async deactivateLicense(licenseId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('licenses')
        .update({
          device_id: null,
          device_info: {},
          current_activations: 0,
        })
        .eq('id', licenseId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deactivating license:', error);
      return false;
    }
  },

  // Update license status
  async updateLicenseStatus(licenseId: string, status: 'active' | 'suspended' | 'expired' | 'revoked'): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('licenses')
        .update({ status })
        .eq('id', licenseId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating license status:', error);
      return false;
    }
  },

  // Get user licenses
  async getUserLicenses(userId: string): Promise<License[]> {
    try {
      const { data, error } = await supabase
        .from('licenses')
        .select('*, products(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user licenses:', error);
      return [];
    }
  },
};

// =====================================================
// MODULE 9: DOWNLOAD SYSTEM API
// =====================================================

export const downloadApi = {
  // Log download
  async logDownload(
    fileId: string,
    licenseId?: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<boolean> {
    try {
      const logData: DownloadLog = {
        file_id: fileId,
        license_id: licenseId,
        user_id: userId,
        ip_address: ipAddress,
        user_agent: userAgent,
      };

      const { error } = await supabase
        .from('download_logs')
        .insert(logData);

      if (error) throw error;

      // Increment file download count
      await productFileApi.incrementDownloadCount(fileId);

      return true;
    } catch (error) {
      console.error('Error logging download:', error);
      return false;
    }
  },

  // Get download logs for a file
  async getFileDownloadLogs(fileId: string): Promise<DownloadLog[]> {
    try {
      const { data, error } = await supabase
        .from('download_logs')
        .select('*')
        .eq('file_id', fileId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching download logs:', error);
      return [];
    }
  },

  // Get user download history
  async getUserDownloadHistory(userId: string): Promise<DownloadLog[]> {
    try {
      const { data, error } = await supabase
        .from('download_logs')
        .select('*, product_files(*, products(*))')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user download history:', error);
      return [];
    }
  },
};

// =====================================================
// MODULE 6: BLOG SYSTEM API
// =====================================================

export const blogApi = {
  // Get published blog posts
  async getBlogPosts(page: number = 1, pageSize: number = 10): Promise<PaginatedResponse<BlogPost>> {
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('blog_posts')
        .select('*', { count: 'exact' })
        .eq('status', 'published')
        .range(from, to)
        .order('published_at', { ascending: false });

      if (error) throw error;

      return {
        data: data || [],
        count: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    } catch (error) {
      console.error('Error fetching blog posts:', error);
      return { data: [], count: 0, page, pageSize, totalPages: 0 };
    }
  },

  // Get blog post by slug
  async getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching blog post by slug:', error);
      return null;
    }
  },

  // Create blog post
  async createBlogPost(post: BlogPost): Promise<BlogPost | null> {
    try {
      if (!post.slug) {
        post.slug = await this.generateSlug(post.title);
      }

      const { data, error } = await supabase
        .from('blog_posts')
        .insert(post)
        .select()
        .single();

      if (error) throw error;

      // Add to sitemap if published
      if (data && data.status === 'published') {
        await sitemapApi.addEntry({
          url: `/blog/${data.slug}`,
          type: 'blog',
          resource_id: data.id,
          priority: 0.6,
          change_frequency: 'weekly',
        });
      }

      return data;
    } catch (error) {
      console.error('Error creating blog post:', error);
      return null;
    }
  },

  // Update blog post
  async updateBlogPost(id: string, post: Partial<BlogPost>): Promise<BlogPost | null> {
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .update(post)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating blog post:', error);
      return null;
    }
  },

  // Delete blog post
  async deleteBlogPost(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting blog post:', error);
      return false;
    }
  },

  // Generate unique slug
  async generateSlug(title: string): Promise<string> {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const { data } = await supabase
        .from('blog_posts')
        .select('slug')
        .eq('slug', slug)
        .single();

      if (!data) break;

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  },
};

// =====================================================
// MODULE 7: CATEGORY SYSTEM API
// =====================================================

export const categoryApi = {
  // Get all categories
  async getCategories(): Promise<ProductCategory[]> {
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  },

  // Get category by slug
  async getCategoryBySlug(slug: string): Promise<ProductCategory | null> {
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching category by slug:', error);
      return null;
    }
  },

  // Create category
  async createCategory(category: ProductCategory): Promise<ProductCategory | null> {
    try {
      if (!category.slug) {
        category.slug = category.name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .trim();
      }

      const { data, error } = await supabase
        .from('product_categories')
        .insert(category)
        .select()
        .single();

      if (error) throw error;

      // Add to sitemap
      if (data) {
        await sitemapApi.addEntry({
          url: `/category/${data.slug}`,
          type: 'category',
          resource_id: data.id,
          priority: 0.5,
          change_frequency: 'weekly',
        });
      }

      return data;
    } catch (error) {
      console.error('Error creating category:', error);
      return null;
    }
  },

  // Update category
  async updateCategory(id: string, category: Partial<ProductCategory>): Promise<ProductCategory | null> {
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .update(category)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating category:', error);
      return null;
    }
  },

  // Delete category
  async deleteCategory(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('product_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting category:', error);
      return false;
    }
  },
};

// =====================================================
// MODULE 5: SEO ENGINE - SITEMAP API
// =====================================================

export const sitemapApi = {
  // Add entry to sitemap
  async addEntry(entry: SitemapEntry): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sitemap_entries')
        .insert(entry);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error adding sitemap entry:', error);
      return false;
    }
  },

  // Update sitemap entry
  async updateEntry(url: string, updates: Partial<SitemapEntry>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sitemap_entries')
        .update(updates)
        .eq('url', url);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating sitemap entry:', error);
      return false;
    }
  },

  // Remove sitemap entry
  async removeEntry(url: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sitemap_entries')
        .delete()
        .eq('url', url);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error removing sitemap entry:', error);
      return false;
    }
  },

  // Get all sitemap entries
  async getSitemapEntries(): Promise<SitemapEntry[]> {
    try {
      const { data, error } = await supabase
        .from('sitemap_entries')
        .select('*')
        .order('url', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching sitemap entries:', error);
      return [];
    }
  },

  // Generate sitemap XML
  async generateSitemapXML(): Promise<string> {
    try {
      const entries = await this.getSitemapEntries();
      
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(entry => `  <url>
    <loc>https://www.saasvala.com${entry.url}</loc>
    <lastmod>${entry.last_modified || entry.created_at}</lastmod>
    <changefreq>${entry.change_frequency || 'weekly'}</changefreq>
    <priority>${entry.priority || 0.5}</priority>
  </url>`).join('\n')}
</urlset>`;

      return xml;
    } catch (error) {
      console.error('Error generating sitemap XML:', error);
      return '';
    }
  },
};

// =====================================================
// MODULE 10: GIT IMPORT SYSTEM API (PLACEHOLDER)
// =====================================================

export const gitImportApi = {
  // Import from GitHub (placeholder - needs GitHub API integration)
  async importFromGitHub(repoUrl: string): Promise<Product | null> {
    try {
      // TODO: Implement GitHub API integration
      // 1. Parse repo URL to get owner and repo name
      // 2. Fetch README from GitHub API
      // 3. Fetch releases from GitHub API
      // 4. Auto-fill product data
      // 5. Create product with imported data

      console.log('GitHub import not yet implemented:', repoUrl);
      return null;
    } catch (error) {
      console.error('Error importing from GitHub:', error);
      return null;
    }
  },
};

// =====================================================
// EXPORT ALL APIS
// =====================================================

export const productManagerApi = {
  product: productApi,
  file: productFileApi,
  license: licenseApi,
  download: downloadApi,
  blog: blogApi,
  category: categoryApi,
  sitemap: sitemapApi,
  git: gitImportApi,
};
