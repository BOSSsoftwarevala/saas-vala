import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Github, 
  CheckCircle2, 
  RefreshCw, 
  ChevronRight,
  GitBranch,
  Lock,
  Globe,
  Star,
  AlertCircle,
  Loader2,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface GitHubAccount {
  name: string;
  email: string;
  connected: boolean;
  login: string | null;
  avatar_url: string | null;
  public_repos: number;
  total_private_repos: number;
  token_status?: 'active' | 'invalid';
  token_error?: string | null;
  rate_limit_remaining?: number | null;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string;
  default_branch: string;
  updated_at: string;
  language: string;
  stargazers_count: number;
  open_issues_count: number;
  account: string;
}

const STORAGE_KEY = 'github_connection_v2';

export function GitConnect() {
  const [accounts, setAccounts] = useState<GitHubAccount[]>([]);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showRepos, setShowRepos] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [connected, setConnected] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [repoSearch, setRepoSearch] = useState('');
  const [repoPage, setRepoPage] = useState(1);
  const [hasMoreRepos, setHasMoreRepos] = useState(false);
  const [activeAccountName, setActiveAccountName] = useState<string | undefined>(undefined);
  const [brokenAvatars, setBrokenAvatars] = useState<Record<string, boolean>>({});

  // Load saved state
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConnected(parsed.connected || false);
        setAccounts(parsed.accounts || []);
        setSelectedRepo(parsed.selectedRepo || null);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Save state
  useEffect(() => {
    if (connected) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ connected, accounts, selectedRepo }));
    }
  }, [connected, accounts, selectedRepo]);

  const handleOneClickConnect = async () => {
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('github-connect', {
        body: { action: 'status' },
      });

      if (error) throw error;
      if (!data?.success) throw new Error('Failed to connect');

      const connectedAccounts = (data.accounts || []).filter((a: GitHubAccount) => a.connected);
      if (connectedAccounts.length === 0) {
        toast.error('No GitHub accounts configured', {
          description: (data.accounts || []).some((a: GitHubAccount) => a.token_status === 'invalid')
            ? 'Configured GitHub token is invalid or expired.'
            : 'Contact admin to set up GitHub tokens.',
        });
        return;
      }

      setAccounts(connectedAccounts);
      setConnected(true);
      
      const totalRepos = connectedAccounts.reduce(
        (sum: number, a: GitHubAccount) => sum + a.public_repos + a.total_private_repos, 0
      );
      
      toast.success(`✅ GitHub Connected!`, {
        description: `${connectedAccounts.length} account(s) • ${totalRepos} repositories`,
      });

      // Auto-fetch repos
      await fetchRepos(undefined, '', 1);
    } catch (error) {
      console.error('Connection failed:', error);
      toast.error('Connection failed', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const fetchRepos = async (accountName?: string, search = repoSearch, page = 1) => {
    setLoadingRepos(true);
    try {
      const { data, error } = await supabase.functions.invoke('github-connect', {
        body: { action: 'repos', accountName, query: search, page, pageSize: 25 },
      });

      if (error) throw error;

      setRepos(data.repos || []);
      setShowRepos(true);
      setRepoPage(Number(data.page || page));
      setHasMoreRepos(Boolean(data.hasMore));
      setActiveAccountName(accountName);
      if (Array.isArray(data.invalidAccounts) && data.invalidAccounts.length > 0) {
        toast.error(`Invalid GitHub token for: ${data.invalidAccounts.join(', ')}`);
      } else {
        toast.success(`📂 ${data.totalRepos} repositories loaded`);
      }
    } catch (error) {
      console.error('Failed to fetch repos:', error);
      toast.error('Failed to fetch repositories');
    } finally {
      setLoadingRepos(false);
    }
  };

  const selectRepo = (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setShowRepos(false);
    toast.success(`Repository selected: ${repo.full_name}`);
  };

  const handleDisconnect = () => {
    setConnected(false);
    setAccounts([]);
    setRepos([]);
    setSelectedRepo(null);
    setShowRepos(false);
    localStorage.removeItem(STORAGE_KEY);
    // Also clear old key
    localStorage.removeItem('github_connection');
    toast.success('GitHub disconnected');
  };

  const avatarFallback = (account: GitHubAccount) => {
    const initial = String(account.login || account.name || 'G').charAt(0).toUpperCase();
    return (
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-foreground">
        {initial}
      </div>
    );
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-foreground/10 flex items-center justify-center">
              <Github className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg">GitHub Connection</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                One-click connect • Auto-sync repositories
              </CardDescription>
            </div>
          </div>
          {connected && (
            <Badge variant="outline" className="bg-success/20 text-success border-success/30 hidden sm:flex">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {connected ? (
          <>
            {/* Connected Accounts */}
            <div className="space-y-2">
              {accounts.map((acc) => (
                <div key={acc.name} className="glass-card rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    {acc.avatar_url && !brokenAvatars[acc.name] ? (
                      <img
                        src={acc.avatar_url}
                        alt={acc.login || acc.name}
                        className="h-10 w-10 rounded-full"
                        onError={() => setBrokenAvatars((prev) => ({ ...prev, [acc.name]: true }))}
                      />
                    ) : avatarFallback(acc)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground text-sm">{acc.name}</p>
                        <Badge variant="outline" className={cn(
                          'text-[10px] border-success/20',
                          acc.token_status === 'active' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive border-destructive/20'
                        )}>
                          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                          {acc.token_status === 'active' ? 'Live' : 'Invalid'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">@{acc.login} • {acc.public_repos + acc.total_private_repos} repos</p>
                      {acc.token_error ? (
                        <p className="text-[10px] text-destructive mt-0.5 truncate">{acc.token_error}</p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground mt-0.5">Rate limit remaining: {acc.rate_limit_remaining ?? 'unknown'}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Repo */}
            {selectedRepo && (
              <div className="glass-card rounded-lg p-3 border border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedRepo.private ? <Lock className="h-3 w-3 text-muted-foreground" /> : <Globe className="h-3 w-3 text-muted-foreground" />}
                    <span className="text-sm font-medium text-foreground">{selectedRepo.full_name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs border-border">
                    <GitBranch className="h-3 w-3 mr-1" />
                    {selectedRepo.default_branch}
                  </Badge>
                </div>
                {selectedRepo.language && (
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                    <span>{selectedRepo.language}</span>
                    <span>•</span>
                    <span>{selectedRepo.account}</span>
                  </div>
                )}
              </div>
            )}

            {/* Repo List */}
            {showRepos && (
              <div className="glass-card rounded-lg overflow-hidden animate-fade-in">
                <div className="p-3 border-b border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">
                      {repos.length} Repositories
                    </p>
                    <div className="flex gap-1">
                      {accounts.map((acc) => (
                        <Button
                          key={acc.name}
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => fetchRepos(acc.name, repoSearch, 1)}
                        >
                          {acc.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Search repos..."
                    className="w-full h-8 px-3 text-sm rounded-md bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void fetchRepos(activeAccountName, repoSearch, 1);
                      }
                    }}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] text-muted-foreground">
                      Server-side search and pagination enabled
                    </p>
                    <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => fetchRepos(activeAccountName, repoSearch, 1)}>
                      Search
                    </Button>
                  </div>
                </div>
                <ScrollArea className="h-[300px]">
                  <div className="divide-y divide-border">
                    {repos.map((repo) => (
                      <button
                        key={repo.id}
                        onClick={() => selectRepo(repo)}
                        className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {repo.private ? (
                                <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                              ) : (
                                <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                              )}
                              <span className="font-medium text-foreground text-sm truncate">{repo.name}</span>
                              <Badge variant="outline" className="text-[10px] border-border shrink-0">
                                {repo.account}
                              </Badge>
                            </div>
                            {repo.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{repo.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {repo.language && (
                              <Badge variant="outline" className="text-[10px] border-border">{repo.language}</Badge>
                            )}
                            {repo.stargazers_count > 0 && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Star className="h-2.5 w-2.5" />{repo.stargazers_count}
                              </span>
                            )}
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
                <div className="flex items-center justify-between p-3 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingRepos || repoPage <= 1}
                    onClick={() => fetchRepos(activeAccountName, repoSearch, repoPage - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">Page {repoPage}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingRepos || !hasMoreRepos}
                    onClick={() => fetchRepos(activeAccountName, repoSearch, repoPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                className="border-border gap-2 flex-1"
                onClick={() => fetchRepos(activeAccountName, repoSearch, 1)}
                disabled={loadingRepos}
              >
                {loadingRepos ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {showRepos ? 'Refresh Repos' : 'Browse Repos'}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-2"
                  >
                    Disconnect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="glass-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect GitHub?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This only clears local connection state in the app. Server-side tokens remain configured by admin.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisconnect} className="bg-destructive text-destructive-foreground">
                      Disconnect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <Button
              onClick={handleOneClickConnect}
              disabled={isConnecting}
              className="w-full bg-foreground text-background hover:bg-foreground/90 gap-2 h-12"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Github className="h-5 w-5" />
                  One-Click Connect GitHub
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Instantly connects to all configured GitHub accounts • No OAuth needed
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
