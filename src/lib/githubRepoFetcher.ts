import { supabase } from '@/lib/supabase';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  topics: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  default_branch: string;
}

export interface RepoProduct {
  slug: string;
  title: string;
  category: string;
  demoUrl: string;
  githubUrl: string;
  description?: string;
  stars?: number;
  language?: string;
  topics?: string[];
  updatedAt?: string;
}

class GitHubRepoFetcher {
  private readonly GITHUB_API_BASE = 'https://api.github.com';
  private readonly USERNAME = 'saasvala';
  private readonly CACHE_KEY = 'github_repos_cache';
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  // Category mapping based on repo names and topics
  private categoryMappings: Record<string, string[]> = {
    'Healthcare': ['hospital', 'medical', 'health', 'clinic', 'pharma', 'blood', 'ortho', 'derma', 'vaccine', 'dialysis'],
    'Education': ['school', 'edu', 'learn', 'tutor', 'academy', 'course', 'student', 'teacher', 'university', 'college'],
    'Finance': ['bank', 'finance', 'payment', 'wallet', 'crypto', 'investment', 'loan', 'credit', 'accounting', 'invoice'],
    'Retail': ['shop', 'store', 'retail', 'ecommerce', 'pos', 'inventory', 'product', 'cart', 'checkout', 'marketplace'],
    'Food': ['food', 'restaurant', 'cafe', 'kitchen', 'recipe', 'delivery', 'menu', 'order', 'dining', 'catering'],
    'Transport': ['transport', 'logistics', 'delivery', 'fleet', 'shipping', 'cargo', 'warehouse', 'route', 'tracking', 'dispatch'],
    'Real Estate': ['real-estate', 'property', 'rental', 'housing', 'apartment', 'building', 'construction', 'land', 'mortgage'],
    'IT': ['software', 'app', 'web', 'dev', 'code', 'tech', 'system', 'platform', 'tool', 'automation'],
    'Manufacturing': ['manufacturing', 'factory', 'production', 'industrial', 'machine', 'assembly', 'plant', 'workshop'],
    'Energy': ['energy', 'solar', 'power', 'electric', 'renewable', 'battery', 'grid', 'wind', 'sustainable'],
    'Agriculture': ['farm', 'agriculture', 'crop', 'harvest', 'irrigation', 'livestock', 'greenhouse', 'seed', 'tractor'],
    'Hospitality': ['hotel', 'travel', 'booking', 'reservation', 'tourism', 'resort', 'motel', 'hospitality', 'vacation'],
    'Sports': ['sport', 'fitness', 'gym', 'athlete', 'training', 'coach', 'game', 'competition', 'health', 'wellness'],
    'Legal': ['legal', 'law', 'court', 'attorney', 'lawyer', 'contract', 'case', 'justice', 'firm', 'advocate'],
    'HR': ['hr', 'human-resource', 'employee', 'payroll', 'recruitment', 'staff', 'personnel', 'workforce', 'talent'],
    'Government': ['government', 'gov', 'municipal', 'civic', 'public', 'administration', 'official', 'department'],
    'Insurance': ['insurance', 'claim', 'policy', 'coverage', 'risk', 'premium', 'underwrite', 'protect'],
    'Beauty': ['beauty', 'salon', 'spa', 'cosmetic', 'makeup', 'hair', 'wellness', 'grooming', 'skincare'],
    'Services': ['service', 'consulting', 'professional', 'business', 'agency', 'freelance', 'b2b', 'enterprise'],
  };

  private defaultCategory = 'IT';

  /**
   * Fetch ALL repositories from GitHub using pagination
   */
  async fetchAllRepos(): Promise<GitHubRepo[]> {
    try {
      const cached = this.getCachedRepos();
      if (cached) {
        console.log('Using cached GitHub repositories');
        return cached;
      }

      console.log('Fetching ALL repositories from GitHub...');
      const allRepos: GitHubRepo[] = [];
      let page = 1;
      const perPage = 100; // Maximum allowed by GitHub API

      while (true) {
        const url = `${this.GITHUB_API_BASE}/users/${this.USERNAME}/repos?page=${page}&per_page=${perPage}&type=all&sort=updated&direction=desc`;
        
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'SaaSVala-Marketplace',
            ...(process.env.GITHUB_TOKEN && { 'Authorization': `token ${process.env.GITHUB_TOKEN}` }),
          },
        });

        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }

        const repos: GitHubRepo[] = await response.json();
        
        if (repos.length === 0) {
          break; // No more repos
        }

        allRepos.push(...repos);
        console.log(`Fetched page ${page}: ${repos.length} repositories (Total: ${allRepos.length})`);
        
        page++;

        // Add small delay to respect rate limits
        if (repos.length === perPage) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`Total repositories fetched: ${allRepos.length}`);
      this.cacheRepos(allRepos);
      return allRepos;

    } catch (error) {
      console.error('Failed to fetch repositories from GitHub:', error);
      throw error;
    }
  }

  /**
   * Convert GitHub repos to marketplace products
   */
  convertToMarketplaceProducts(repos: GitHubRepo[]): RepoProduct[] {
    return repos.map(repo => {
      const category = this.categorizeRepo(repo);
      const title = this.generateTitle(repo);
      
      return {
        slug: repo.name,
        title,
        category,
        demoUrl: `https://${repo.name}.saasvala.com`,
        githubUrl: repo.html_url,
        description: repo.description || `${title} - Professional ${category.toLowerCase()} solution`,
        stars: repo.stargazers_count,
        language: repo.language || undefined,
        topics: repo.topics,
        updatedAt: repo.updated_at,
      };
    });
  }

  /**
   * Categorize repository based on name, description, topics, and language
   */
  private categorizeRepo(repo: GitHubRepo): string {
    const searchText = [
      repo.name.toLowerCase(),
      repo.description?.toLowerCase() || '',
      ...repo.topics.map(t => t.toLowerCase()),
      repo.language?.toLowerCase() || '',
    ].join(' ');

    // Check each category for keyword matches
    for (const [category, keywords] of Object.entries(this.categoryMappings)) {
      for (const keyword of keywords) {
        if (searchText.includes(keyword)) {
          return category;
        }
      }
    }

    return this.defaultCategory;
  }

  /**
   * Generate a readable title from repo name
   */
  private generateTitle(repo: GitHubRepo): string {
    // Convert kebab-case to readable title
    const title = repo.name
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace(/\b(And|Or|The|Of|In|To|For|With|By)\b/g, l => l.toUpperCase());

    // Add suffix if it's too short
    if (title.length < 10) {
      const category = this.categorizeRepo(repo);
      return `${title} - ${category}`;
    }

    return title;
  }

  /**
   * Cache repositories in localStorage
   */
  private cacheRepos(repos: GitHubRepo[]): void {
    try {
      const cacheData = {
        repos,
        timestamp: Date.now(),
      };
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache repositories:', error);
    }
  }

  /**
   * Get cached repositories if still valid
   */
  private getCachedRepos(): GitHubRepo[] | null {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      const now = Date.now();
      
      if (now - cacheData.timestamp > this.CACHE_DURATION) {
        localStorage.removeItem(this.CACHE_KEY);
        return null;
      }

      return cacheData.repos;
    } catch (error) {
      console.warn('Failed to get cached repositories:', error);
      return null;
    }
  }

  /**
   * Get repository statistics
   */
  async getRepoStats(): Promise<{
    total: number;
    byCategory: Record<string, number>;
    languages: Record<string, number>;
    totalStars: number;
  }> {
    const repos = await this.fetchAllRepos();
    const byCategory: Record<string, number> = {};
    const languages: Record<string, number> = {};

    repos.forEach(repo => {
      const category = this.categorizeRepo(repo);
      byCategory[category] = (byCategory[category] || 0) + 1;
      
      const lang = repo.language || 'Unknown';
      languages[lang] = (languages[lang] || 0) + 1;
    });

    const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);

    return {
      total: repos.length,
      byCategory,
      languages,
      totalStars,
    };
  }

  /**
   * Force refresh repository cache
   */
  async refreshCache(): Promise<GitHubRepo[]> {
    localStorage.removeItem(this.CACHE_KEY);
    return this.fetchAllRepos();
  }
}

// Singleton instance
export const githubRepoFetcher = new GitHubRepoFetcher();

// Utility function for easy usage
export async function getAllGitHubRepos(): Promise<RepoProduct[]> {
  const repos = await githubRepoFetcher.fetchAllRepos();
  return githubRepoFetcher.convertToMarketplaceProducts(repos);
}
