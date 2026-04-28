// =====================================================
// PRODUCT MANAGER HOOKS - UI INTEGRATION
// =====================================================
// STRICT MODE: NO UI CHANGE • ONLY BACKEND INTEGRATION
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { productManagerApi, Product, ProductFilters, PaginatedResponse } from '@/lib/productManagerApi';
import { generateProductSeo, ProductSeoData } from '@/lib/seoEngine';

// =====================================================
// MODULE 1: PRODUCT LISTING HOOK
// =====================================================

export function useProducts(page: number = 1, pageSize: number = 20, filters: ProductFilters = {}) {
  const [data, setData] = useState<Product[]>([]);
  const [count, setCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response: PaginatedResponse<Product> = await productManagerApi.product.getProducts(
        page,
        pageSize,
        filters
      );
      setData(response.data);
      setCount(response.count);
      setTotalPages(response.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, JSON.stringify(filters)]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { data, count, totalPages, loading, error, refetch: fetchProducts };
}

// =====================================================
// PRODUCT COUNTS HOOK
// =====================================================

export function useProductCounts() {
  const [counts, setCounts] = useState({ all: 0, active: 0, draft: 0, suspended: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCounts() {
      setLoading(true);
      try {
        const data = await productManagerApi.product.getProductCounts();
        setCounts(data);
      } catch (error) {
        console.error('Error fetching product counts:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchCounts();
  }, []);

  return { counts, loading };
}

// =====================================================
// SINGLE PRODUCT HOOK
// =====================================================

export function useProduct(id?: string, slug?: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProduct() {
      if (!id && !slug) return;
      
      setLoading(true);
      setError(null);
      try {
        let data: Product | null = null;
        if (slug) {
          data = await productManagerApi.product.getProductBySlug(slug);
        } else if (id) {
          data = await productManagerApi.product.getProductById(id);
        }
        setProduct(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch product');
        console.error('Error fetching product:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [id, slug]);

  return { product, loading, error };
}

// =====================================================
// MODULE 2: CREATE/UPDATE PRODUCT HOOK
// =====================================================

export function useProductMutation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProduct = useCallback(async (productData: Partial<Product>) => {
    setLoading(true);
    setError(null);
    try {
      // Auto-generate SEO if not provided
      if (!productData.seo_title || !productData.seo_description) {
        const seoData: ProductSeoData = {
          name: productData.name || '',
          slug: productData.slug || '',
          short_description: productData.short_description,
          full_description: productData.full_description,
          category: productData.business_type,
          tags: productData.tags,
          price: productData.price,
          rating: productData.rating,
          thumbnail_url: productData.thumbnail_url,
        };
        const seo = generateProductSeo(seoData);
        productData.seo_title = seo.title;
        productData.seo_description = seo.description;
        productData.seo_keywords = seo.keywords;
        productData.og_image = seo.ogImage;
        productData.canonical_url = seo.canonical;
      }

      const result = await productManagerApi.product.createProduct(productData as Product);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
      console.error('Error creating product:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProduct = useCallback(async (id: string, productData: Partial<Product>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await productManagerApi.product.updateProduct(id, productData);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
      console.error('Error updating product:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await productManagerApi.product.deleteProduct(id);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
      console.error('Error deleting product:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createProduct, updateProduct, deleteProduct, loading, error };
}

// =====================================================
// MODULE 3: FILE MANAGEMENT HOOK
// =====================================================

export function useProductFiles(productId: string) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFiles() {
      setLoading(true);
      try {
        const data = await productManagerApi.file.getProductFiles(productId);
        setFiles(data);
      } catch (error) {
        console.error('Error fetching product files:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchFiles();
  }, [productId]);

  const uploadFile = useCallback(async (
    file: File,
    fileType: 'main' | 'documentation' | 'extra' | 'apk',
    version?: string,
    changelog?: string
  ) => {
    try {
      const result = await productManagerApi.file.uploadFile(
        productId,
        file,
        fileType,
        version,
        changelog
      );
      if (result) {
        setFiles(prev => [result, ...prev]);
      }
      return result;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  }, [productId]);

  const deleteFile = useCallback(async (fileId: string) => {
    try {
      const result = await productManagerApi.file.deleteFile(fileId);
      if (result) {
        setFiles(prev => prev.filter(f => f.id !== fileId));
      }
      return result;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }, []);

  return { files, loading, uploadFile, deleteFile };
}

// =====================================================
// MODULE 8: LICENSE SYSTEM HOOK
// =====================================================

export function useLicenses() {
  const [licenses, setLicenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const generateLicense = useCallback(async (
    productId: string,
    userId: string,
    orderId?: string,
    expiresInDays?: number
  ) => {
    try {
      const result = await productManagerApi.license.generateLicense(
        productId,
        userId,
        orderId,
        expiresInDays
      );
      if (result) {
        setLicenses(prev => [result, ...prev]);
      }
      return result;
    } catch (error) {
      console.error('Error generating license:', error);
      return null;
    }
  }, []);

  const validateLicense = useCallback(async (licenseKey: string, deviceId?: string) => {
    try {
      const result = await productManagerApi.license.validateLicense(licenseKey, deviceId);
      return result;
    } catch (error) {
      console.error('Error validating license:', error);
      return null;
    }
  }, []);

  const getUserLicenses = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const data = await productManagerApi.license.getUserLicenses(userId);
      setLicenses(data);
    } catch (error) {
      console.error('Error fetching user licenses:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  return { licenses, loading, generateLicense, validateLicense, getUserLicenses };
}

// =====================================================
// MODULE 6: BLOG SYSTEM HOOK
// =====================================================

export function useBlogPosts(page: number = 1, pageSize: number = 10) {
  const [posts, setPosts] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPosts() {
      setLoading(true);
      try {
        const response = await productManagerApi.blog.getBlogPosts(page, pageSize);
        setPosts(response.data);
        setCount(response.count);
        setTotalPages(response.totalPages);
      } catch (error) {
        console.error('Error fetching blog posts:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchPosts();
  }, [page, pageSize]);

  return { posts, count, totalPages, loading };
}

export function useBlogPost(slug?: string) {
  const [post, setPost] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPost() {
      if (!slug) return;
      setLoading(true);
      try {
        const data = await productManagerApi.blog.getBlogPostBySlug(slug);
        setPost(data);
      } catch (error) {
        console.error('Error fetching blog post:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchPost();
  }, [slug]);

  return { post, loading };
}

// =====================================================
// MODULE 7: CATEGORY SYSTEM HOOK
// =====================================================

export function useCategories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCategories() {
      setLoading(true);
      try {
        const data = await productManagerApi.category.getCategories();
        setCategories(data);
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchCategories();
  }, []);

  return { categories, loading };
}

// =====================================================
// MODULE 10: GIT IMPORT HOOK
// =====================================================

export function useGitImport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importFromGitHub = useCallback(async (repoUrl: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await productManagerApi.git.importFromGitHub(repoUrl);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import from GitHub');
      console.error('Error importing from GitHub:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { importFromGitHub, loading, error };
}

// =====================================================
// SEO META TAGS HOOK
// =====================================================

export function useProductSEO(product: Product | null) {
  useEffect(() => {
    if (!product) return;

    // Update document title
    if (product.seo_title) {
      document.title = product.seo_title;
    }

    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription && product.seo_description) {
      metaDescription.setAttribute('content', product.seo_description);
    }

    // Update meta keywords
    const metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords && product.seo_keywords) {
      metaKeywords.setAttribute('content', product.seo_keywords.join(', '));
    }

    // Update canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    if (product.canonical_url) {
      canonical.setAttribute('href', product.canonical_url);
    }

    // Update OG tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && product.seo_title) {
      ogTitle.setAttribute('content', product.seo_title);
    }

    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription && product.seo_description) {
      ogDescription.setAttribute('content', product.seo_description);
    }

    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage && product.og_image) {
      ogImage.setAttribute('content', product.og_image);
    }

    // Add JSON-LD schema
    const seoData: ProductSeoData = {
      name: product.name,
      slug: product.slug,
      short_description: product.short_description,
      full_description: product.full_description,
      category: product.business_type,
      tags: product.tags,
      price: product.price,
      rating: product.rating,
      thumbnail_url: product.thumbnail_url,
    };
    const seo = generateProductSeo(seoData);

    let schemaScript = document.getElementById('product-schema') as HTMLScriptElement;
    if (!schemaScript) {
      schemaScript = document.createElement('script') as HTMLScriptElement;
      schemaScript.id = 'product-schema';
      schemaScript.type = 'application/ld+json';
      document.head.appendChild(schemaScript);
    }
    schemaScript.textContent = JSON.stringify(seo.schema);

  }, [product]);
}
