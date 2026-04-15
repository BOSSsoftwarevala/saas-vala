// Search Index Service - Fast search queries with indexing
import { supabase } from '@/integrations/supabase/client';

interface SearchIndexEntry {
  id: string;
  type: string;
  title: string;
  description: string;
  keywords: string[];
  entity_id: string;
  created_at: string;
}

class SearchIndexService {
  private static instance: SearchIndexService;
  private index: Map<string, SearchIndexEntry[]> = new Map();
  private lastUpdated: Map<string, number> = new Map();

  private constructor() {
    this.initializeIndex();
  }

  static getInstance(): SearchIndexService {
    if (!SearchIndexService.instance) {
      SearchIndexService.instance = new SearchIndexService();
    }
    return SearchIndexService.instance;
  }

  private async initializeIndex(): Promise<void> {
    try {
      // Load products index
      await this.loadProductsIndex();
      
      // Load keys index
      await this.loadKeysIndex();
      
      // Load users index
      await this.loadUsersIndex();
      
      console.log('[SearchIndex] Search index initialized');
    } catch (error) {
      console.error('[SearchIndex] Failed to initialize index:', error);
    }
  }

  private async loadProductsIndex(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, description, category, slug')
        .eq('status', 'active');

      if (error) throw error;

      const entries: SearchIndexEntry[] = (data || []).map((product: any) => ({
        id: product.id,
        type: 'product',
        title: product.name,
        description: product.description || '',
        keywords: this.extractKeywords(product.name, product.description, product.category, product.slug),
        entity_id: product.id,
        created_at: product.created_at,
      }));

      this.index.set('products', entries);
      this.lastUpdated.set('products', Date.now());
    } catch (error) {
      console.error('[SearchIndex] Failed to load products index:', error);
    }
  }

  private async loadKeysIndex(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('keys')
        .select('id, key_value, type, status, product_id')
        .eq('status', 'active');

      if (error) throw error;

      const entries: SearchIndexEntry[] = (data || []).map((key: any) => ({
        id: key.id,
        type: 'key',
        title: key.key_value,
        description: `${key.type} key - ${key.status}`,
        keywords: this.extractKeywords(key.key_value, key.type, key.status),
        entity_id: key.id,
        created_at: key.created_at,
      }));

      this.index.set('keys', entries);
      this.lastUpdated.set('keys', Date.now());
    } catch (error) {
      console.error('[SearchIndex] Failed to load keys index:', error);
    }
  }

  private async loadUsersIndex(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role');

      if (error) throw error;

      const entries: SearchIndexEntry[] = (data || []).map((user: any) => ({
        id: user.id,
        type: 'user',
        title: user.full_name || user.email,
        description: `${user.role}`,
        keywords: this.extractKeywords(user.full_name, user.email, user.role),
        entity_id: user.id,
        created_at: user.created_at,
      }));

      this.index.set('users', entries);
      this.lastUpdated.set('users', Date.now());
    } catch (error) {
      console.error('[SearchIndex] Failed to load users index:', error);
    }
  }

  private extractKeywords(...texts: (string | undefined)[]): string[] {
    const keywords: Set<string> = new Set();
    
    texts.forEach(text => {
      if (!text) return;
      
      // Split into words and normalize
      const words = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2);
      
      words.forEach(word => keywords.add(word));
      
      // Add partial matches
      words.forEach(word => {
        for (let i = 3; i <= word.length; i++) {
          keywords.add(word.substring(0, i));
        }
      });
    });
    
    return Array.from(keywords);
  }

  search(query: string, types?: string[]): SearchIndexEntry[] {
    const searchTerms = this.extractKeywords(query);
    const results: Map<string, SearchIndexEntry> = new Map();

    const typesToSearch = types || ['products', 'keys', 'users'];

    typesToSearch.forEach(type => {
      const entries = this.index.get(type) || [];
      
      entries.forEach(entry => {
        const score = this.calculateScore(searchTerms, entry);
        
        if (score > 0) {
          results.set(entry.id, { ...entry, score } as any);
        }
      });
    });

    // Sort by score and return
    return Array.from(results.values())
      .sort((a, b) => (b as any).score - (a as any).score)
      .slice(0, 50) as SearchIndexEntry[];
  }

  private calculateScore(searchTerms: string[], entry: SearchIndexEntry): number {
    let score = 0;
    const entryKeywords = entry.keywords;

    searchTerms.forEach(term => {
      // Exact match in title
      if (entry.title.toLowerCase().includes(term)) {
        score += 10;
      }
      
      // Exact match in description
      if (entry.description.toLowerCase().includes(term)) {
        score += 5;
      }
      
      // Keyword match
      if (entryKeywords.includes(term)) {
        score += 3;
      }
      
      // Partial match in keywords
      entryKeywords.forEach(keyword => {
        if (keyword.includes(term) || term.includes(keyword)) {
          score += 1;
        }
      });
    });

    return score;
  }

  async refreshIndex(type?: string): Promise<void> {
    if (type) {
      if (type === 'products') await this.loadProductsIndex();
      if (type === 'keys') await this.loadKeysIndex();
      if (type === 'users') await this.loadUsersIndex();
    } else {
      await this.initializeIndex();
    }
  }

  getIndexStats(): {
    totalEntries: number;
    entriesByType: Record<string, number>;
    lastUpdated: Record<string, number>;
  } {
    const entriesByType: Record<string, number> = {};
    const lastUpdated: Record<string, number> = {};
    let totalEntries = 0;

    this.index.forEach((entries, type) => {
      entriesByType[type] = entries.length;
      totalEntries += entries.length;
    });

    this.lastUpdated.forEach((time, type) => {
      lastUpdated[type] = time;
    });

    return {
      totalEntries,
      entriesByType,
      lastUpdated,
    };
  }
}

export const searchIndex = SearchIndexService.getInstance();

// Convenience functions
export function search(query: string, types?: string[]) {
  return searchIndex.search(query, types);
}

export async function refreshSearchIndex(type?: string) {
  return searchIndex.refreshIndex(type);
}
