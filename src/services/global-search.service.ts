// Global Search Service - Search across all entities
import { supabase } from '@/integrations/supabase/client';

export interface SearchResult {
  id: string;
  type: 'product' | 'key' | 'server' | 'user' | 'order' | 'ticket' | 'apk';
  title: string;
  description: string;
  url: string;
  metadata?: Record<string, unknown>;
  relevance: number;
}

class GlobalSearchService {
  private searchHistory: string[] = [];
  private readonly HISTORY_KEY = 'search_history';
  private readonly MAX_HISTORY = 10;

  constructor() {
    this.loadHistory();
  }

  private loadHistory(): void {
    try {
      const history = localStorage.getItem(this.HISTORY_KEY);
      if (history) {
        this.searchHistory = JSON.parse(history);
      }
    } catch (error) {
      console.error('Error loading search history:', error);
    }
  }

  private saveHistory(): void {
    try {
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(this.searchHistory));
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  }

  addToHistory(query: string): void {
    if (!query.trim()) return;

    // Remove if already exists
    this.searchHistory = this.searchHistory.filter(h => h !== query);
    
    // Add to beginning
    this.searchHistory.unshift(query);
    
    // Keep only recent searches
    this.searchHistory = this.searchHistory.slice(0, this.MAX_HISTORY);
    
    this.saveHistory();
  }

  getHistory(): string[] {
    return this.searchHistory;
  }

  clearHistory(): void {
    this.searchHistory = [];
    this.saveHistory();
  }

  async search(query: string, filters?: {
    type?: SearchResult['type'];
    limit?: number;
  }): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    const results: SearchResult[] = [];
    const limit = filters?.limit || 20;
    const typeFilter = filters?.type;

    // Search products
    if (!typeFilter || typeFilter === 'product') {
      const products = await this.searchProducts(query, limit);
      results.push(...products);
    }

    // Search keys
    if (!typeFilter || typeFilter === 'key') {
      const keys = await this.searchKeys(query, limit);
      results.push(...keys);
    }

    // Search servers
    if (!typeFilter || typeFilter === 'server') {
      const servers = await this.searchServers(query, limit);
      results.push(...servers);
    }

    // Search users
    if (!typeFilter || typeFilter === 'user') {
      const users = await this.searchUsers(query, limit);
      results.push(...users);
    }

    // Search orders
    if (!typeFilter || typeFilter === 'order') {
      const orders = await this.searchOrders(query, limit);
      results.push(...orders);
    }

    // Search tickets
    if (!typeFilter || typeFilter === 'ticket') {
      const tickets = await this.searchTickets(query, limit);
      results.push(...tickets);
    }

    // Search APKs
    if (!typeFilter || typeFilter === 'apk') {
      const apks = await this.searchAPKs(query, limit);
      results.push(...apks);
    }

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);

    // Return limited results
    return results.slice(0, limit);
  }

  private async searchProducts(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, description, slug, category')
        .or(`name.ilike.%${query}%,description.ilike.%${query}%,slug.ilike.%${query}%`)
        .limit(limit);

      if (error) throw error;

      return (data || []).map((product: any) => ({
        id: product.id,
        type: 'product' as const,
        title: product.name,
        description: product.description || '',
        url: `/marketplace/product/${product.id}`,
        metadata: { category: product.category, slug: product.slug },
        relevance: this.calculateRelevance(query, product.name, product.description),
      }));
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  }

  private async searchKeys(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const { data, error } = await supabase
        .from('keys')
        .select('id, key_value, type, status, product_id')
        .or(`key_value.ilike.%${query}%`)
        .limit(limit);

      if (error) throw error;

      return (data || []).map((key: any) => ({
        id: key.id,
        type: 'key' as const,
        title: key.key_value,
        description: `${key.type} key - ${key.status}`,
        url: `/keys`,
        metadata: { type: key.type, status: key.status },
        relevance: this.calculateRelevance(query, key.key_value, ''),
      }));
    } catch (error) {
      console.error('Error searching keys:', error);
      return [];
    }
  }

  private async searchServers(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const { data, error } = await supabase
        .from('servers')
        .select('id, name, ip_address, type, status')
        .or(`name.ilike.%${query}%,ip_address.ilike.%${query}%`)
        .limit(limit);

      if (error) throw error;

      return (data || []).map((server: any) => ({
        id: server.id,
        type: 'server' as const,
        title: server.name,
        description: `${server.ip_address} - ${server.type} - ${server.status}`,
        url: `/servers`,
        metadata: { ip: server.ip_address, type: server.type, status: server.status },
        relevance: this.calculateRelevance(query, server.name, server.ip_address),
      }));
    } catch (error) {
      console.error('Error searching servers:', error);
      return [];
    }
  }

  private async searchUsers(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(limit);

      if (error) throw error;

      return (data || []).map((user: any) => ({
        id: user.id,
        type: 'user' as const,
        title: user.full_name || user.email,
        description: `${user.email} - ${user.role}`,
        url: `/dashboard`,
        metadata: { email: user.email, role: user.role },
        relevance: this.calculateRelevance(query, user.full_name, user.email),
      }));
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }

  private async searchOrders(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, user_id, total_amount, status, created_at')
        .or(`id.ilike.%${query}%`)
        .limit(limit);

      if (error) throw error;

      return (data || []).map((order: any) => ({
        id: order.id,
        type: 'order' as const,
        title: `Order #${order.id.slice(0, 8)}`,
        description: `$${order.total_amount} - ${order.status}`,
        url: `/orders`,
        metadata: { status: order.status, amount: order.total_amount, date: order.created_at },
        relevance: this.calculateRelevance(query, order.id, ''),
      }));
    } catch (error) {
      console.error('Error searching orders:', error);
      return [];
    }
  }

  private async searchTickets(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('id, subject, description, status, priority')
        .or(`subject.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(limit);

      if (error) throw error;

      return (data || []).map((ticket: any) => ({
        id: ticket.id,
        type: 'ticket' as const,
        title: ticket.subject,
        description: `${ticket.priority} priority - ${ticket.status}`,
        url: `/support`,
        metadata: { status: ticket.status, priority: ticket.priority },
        relevance: this.calculateRelevance(query, ticket.subject, ticket.description),
      }));
    } catch (error) {
      console.error('Error searching tickets:', error);
      return [];
    }
  }

  private async searchAPKs(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const { data, error } = await supabase
        .from('apks')
        .select('id, version, file_url, is_active')
        .or(`version.ilike.%${query}%,file_url.ilike.%${query}%`)
        .limit(limit);

      if (error) throw error;

      return (data || []).map((apk: any) => ({
        id: apk.id,
        type: 'apk' as const,
        title: `APK ${apk.version}`,
        description: apk.is_active ? 'Active' : 'Inactive',
        url: `/apk-pipeline`,
        metadata: { version: apk.version, active: apk.is_active },
        relevance: this.calculateRelevance(query, apk.version, apk.file_url),
      }));
    } catch (error) {
      console.error('Error searching APKs:', error);
      return [];
    }
  }

  private calculateRelevance(query: string, title: string, description: string): number {
    const lowerQuery = query.toLowerCase();
    const lowerTitle = title.toLowerCase();
    const lowerDesc = description?.toLowerCase() || '';

    let score = 0;

    // Exact match in title
    if (lowerTitle === lowerQuery) score += 100;
    // Title starts with query
    else if (lowerTitle.startsWith(lowerQuery)) score += 80;
    // Title contains query
    else if (lowerTitle.includes(lowerQuery)) score += 60;

    // Exact match in description
    if (lowerDesc === lowerQuery) score += 50;
    // Description starts with query
    else if (lowerDesc.startsWith(lowerQuery)) score += 40;
    // Description contains query
    else if (lowerDesc.includes(lowerQuery)) score += 30;

    return score;
  }
}

export const globalSearchService = new GlobalSearchService();
