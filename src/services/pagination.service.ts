// Pagination Service - Handle large datasets with pagination
import { supabase } from '@/lib/supabase';

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  ascending?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

class PaginationService {
  private static instance: PaginationService;
  private defaultPageSize = 20;
  private maxPageSize = 100;

  private constructor() {}

  static getInstance(): PaginationService {
    if (!PaginationService.instance) {
      PaginationService.instance = new PaginationService();
    }
    return PaginationService.instance;
  }

  async paginate<T>(
    table: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<T>> {
    const {
      page = 1,
      pageSize = this.defaultPageSize,
      orderBy = 'created_at',
      ascending = false,
    } = options;

    // Validate page size
    const validatedPageSize = Math.min(pageSize, this.maxPageSize);

    // Calculate offset
    const offset = (page - 1) * validatedPageSize;

    try {
      // Get total count
      const { count, error: countError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      const total = count || 0;
      const totalPages = Math.ceil(total / validatedPageSize);

      // Get paginated data
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order(orderBy, { ascending })
        .range(offset, offset + validatedPageSize - 1);

      if (error) throw error;

      return {
        data: (data as T[]) || [],
        pagination: {
          page,
          pageSize: validatedPageSize,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
        },
      };
    } catch (error) {
      console.error('[Pagination] Failed to paginate:', error);
      throw error;
    }
  }

  async paginateWithFilter<T>(
    table: string,
    filter: Record<string, unknown>,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<T>> {
    const {
      page = 1,
      pageSize = this.defaultPageSize,
      orderBy = 'created_at',
      ascending = false,
    } = options;

    const validatedPageSize = Math.min(pageSize, this.maxPageSize);
    const offset = (page - 1) * validatedPageSize;

    try {
      // Build query with filter
      let query = supabase.from(table).select('*', { count: 'exact' });
      
      for (const [key, value] of Object.entries(filter)) {
        query = query.eq(key, value);
      }

      const { count, error: countError } = await query;

      if (countError) throw countError;

      const total = count || 0;
      const totalPages = Math.ceil(total / validatedPageSize);

      // Get paginated data
      let dataQuery = supabase.from(table).select('*');
      
      for (const [key, value] of Object.entries(filter)) {
        dataQuery = dataQuery.eq(key, value);
      }

      const { data, error } = await dataQuery
        .order(orderBy, { ascending })
        .range(offset, offset + validatedPageSize - 1);

      if (error) throw error;

      return {
        data: (data as T[]) || [],
        pagination: {
          page,
          pageSize: validatedPageSize,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
        },
      };
    } catch (error) {
      console.error('[Pagination] Failed to paginate with filter:', error);
      throw error;
    }
  }

  async paginateWithSearch<T>(
    table: string,
    searchColumn: string,
    searchTerm: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<T>> {
    const {
      page = 1,
      pageSize = this.defaultPageSize,
      orderBy = 'created_at',
      ascending = false,
    } = options;

    const validatedPageSize = Math.min(pageSize, this.maxPageSize);
    const offset = (page - 1) * validatedPageSize;

    try {
      // Get total count with search
      const { count, error: countError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .ilike(searchColumn, `%${searchTerm}%`);

      if (countError) throw countError;

      const total = count || 0;
      const totalPages = Math.ceil(total / validatedPageSize);

      // Get paginated data with search
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .ilike(searchColumn, `%${searchTerm}%`)
        .order(orderBy, { ascending })
        .range(offset, offset + validatedPageSize - 1);

      if (error) throw error;

      return {
        data: (data as T[]) || [],
        pagination: {
          page,
          pageSize: validatedPageSize,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
        },
      };
    } catch (error) {
      console.error('[Pagination] Failed to paginate with search:', error);
      throw error;
    }
  }

  // Convenience methods for common tables
  async paginateProducts(options?: PaginationOptions): Promise<PaginatedResult<any>> {
    return this.paginate('products', options);
  }

  async paginateOrders(options?: PaginationOptions): Promise<PaginatedResult<any>> {
    return this.paginate('orders', options);
  }

  async paginateKeys(options?: PaginationOptions): Promise<PaginatedResult<any>> {
    return this.paginate('keys', options);
  }

  async paginateUsers(options?: PaginationOptions): Promise<PaginatedResult<any>> {
    return this.paginate('users', options);
  }

  async paginateTickets(options?: PaginationOptions): Promise<PaginatedResult<any>> {
    return this.paginate('support_tickets', options);
  }

  async paginateAuditLogs(options?: PaginationOptions): Promise<PaginatedResult<any>> {
    return this.paginate('activity_logs', options);
  }

  // Infinite scroll helpers
  async loadMore<T>(
    table: string,
    currentPage: number,
    currentData: T[],
    options?: PaginationOptions
  ): Promise<{ data: T[]; hasMore: boolean }> {
    const nextPage = currentPage + 1;
    const result = await this.paginate<T>(table, { ...options, page: nextPage });
    
    return {
      data: [...currentData, ...result.data],
      hasMore: result.pagination.hasNext,
    };
  }

  setDefaultPageSize(size: number): void {
    this.defaultPageSize = Math.min(size, this.maxPageSize);
  }

  setMaxPageSize(size: number): void {
    this.maxPageSize = size;
  }
}

export const pagination = PaginationService.getInstance();

// Convenience functions
export async function paginate<T>(table: string, options?: PaginationOptions) {
  return pagination.paginate<T>(table, options);
}

export async function paginateWithFilter<T>(
  table: string,
  filter: Record<string, unknown>,
  options?: PaginationOptions
) {
  return pagination.paginateWithFilter<T>(table, filter, options);
}
