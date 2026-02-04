import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Github, 
  CheckCircle2, 
  RefreshCw, 
  Unlink, 
  ChevronRight,
  GitBranch,
  Lock,
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GitHubUser {
  id: number;
  login: string;
  name: string;
  avatar_url: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string;
  default_branch: string;
  updated_at: string;
  language: string;
}

interface GitConnection {
  connected: boolean;
  user?: GitHubUser;
  repository?: GitHubRepo;
  branch?: string;
  accessToken?: string;
}

const STORAGE_KEY = 'github_connection';

export function GitConnect() {
  const [connection, setConnection] = useState<GitConnection>({ connected: false });
  const [isConnecting, setIsConnecting] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [showRepos, setShowRepos] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);

  // Load saved connection on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConnection(parsed);
      } catch (e) {
        console.error('Failed to parse saved connection:', e);
      }
    }

    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (code && state) {
      handleOAuthCallback(code);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Save connection when it changes
  useEffect(() => {
    if (connection.connected) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(connection));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [connection]);

  const handleConnect = async () => {
    setIsConnecting(true);
    
    try {
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      
      const { data, error } = await supabase.functions.invoke('github-oauth', {
        body: { data: { redirectUri } },
        headers: { 'Content-Type': 'application/json' },
      });

      // Handle query param style
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-oauth?action=auth-url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ data: { redirectUri } }),
        }
      );

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.authUrl) {
        // Store state for verification
        sessionStorage.setItem('github_oauth_state', result.state);
        // Redirect to GitHub
        window.location.href = result.authUrl;
      }
    } catch (error) {
      console.error('GitHub OAuth error:', error);
      toast.error('Failed to connect to GitHub', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
      setIsConnecting(false);
    }
  };

  const handleOAuthCallback = async (code: string) => {
    setIsConnecting(true);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-oauth?action=callback`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ code }),
        }
      );

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setConnection({
        connected: true,
        user: result.user,
        accessToken: result.access_token,
      });

      toast.success('GitHub connected!', {
        description: `Connected as ${result.user.login}`,
      });

      // Automatically fetch repos
      fetchRepos(result.access_token);
    } catch (error) {
      console.error('OAuth callback error:', error);
      toast.error('Failed to complete GitHub connection', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const fetchRepos = async (token?: string) => {
    const accessToken = token || connection.accessToken;
    if (!accessToken) return;

    setLoadingRepos(true);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-oauth?action=repos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'x-github-token': accessToken,
          },
          body: JSON.stringify({}),
        }
      );

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setRepos(result.repos);
      setShowRepos(true);
    } catch (error) {
      console.error('Failed to fetch repos:', error);
      toast.error('Failed to fetch repositories');
    } finally {
      setLoadingRepos(false);
    }
  };

  const selectRepo = (repo: GitHubRepo) => {
    setConnection(prev => ({
      ...prev,
      repository: repo,
      branch: repo.default_branch,
    }));
    setShowRepos(false);
    toast.success('Repository selected!', {
      description: `${repo.full_name} (${repo.default_branch})`,
    });
  };

  const handleDisconnect = () => {
    setConnection({ connected: false });
    setRepos([]);
    setShowRepos(false);
    toast.success('GitHub disconnected');
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
                Connect your repository for automatic deployments
              </CardDescription>
            </div>
          </div>
          {connection.connected && (
            <Badge variant="outline" className="bg-success/20 text-success border-success/30 hidden sm:flex">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {connection.connected ? (
          <>
            {/* Connected User Info */}
            <div className="glass-card rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                {connection.user?.avatar_url && (
                  <img 
                    src={connection.user.avatar_url} 
                    alt={connection.user.login}
                    className="h-10 w-10 rounded-full"
                  />
                )}
                <div>
                  <p className="font-medium text-foreground">{connection.user?.name || connection.user?.login}</p>
                  <p className="text-xs text-muted-foreground">@{connection.user?.login}</p>
                </div>
              </div>

              {connection.repository ? (
                <>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-sm text-muted-foreground">Repository</span>
                    <div className="flex items-center gap-2">
                      {connection.repository.private ? (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <Globe className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium text-foreground">
                        {connection.repository.full_name}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Branch</span>
                    <Badge variant="outline" className="border-border text-foreground">
                      <GitBranch className="h-3 w-3 mr-1" />
                      {connection.branch}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <span className="text-sm text-success">Auto-sync enabled</span>
                  </div>
                </>
              ) : (
                <Button 
                  onClick={() => fetchRepos()}
                  disabled={loadingRepos}
                  className="w-full bg-orange-gradient hover:opacity-90 text-white gap-2"
                >
                  {loadingRepos ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  Select Repository
                </Button>
              )}
            </div>

            {/* Repository Selection */}
            {showRepos && repos.length > 0 && (
              <div className="glass-card rounded-lg overflow-hidden animate-fade-in">
                <div className="p-3 border-b border-border">
                  <p className="text-sm font-medium text-foreground">Select a Repository</p>
                </div>
                <ScrollArea className="h-[250px]">
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
                              <span className="font-medium text-foreground truncate">{repo.name}</span>
                            </div>
                            {repo.description && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">{repo.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {repo.language && (
                              <Badge variant="outline" className="text-xs border-border">
                                {repo.language}
                              </Badge>
                            )}
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2">
              {connection.repository && (
                <Button 
                  variant="outline" 
                  className="border-border gap-2 flex-1"
                  onClick={() => {
                    setConnection(prev => ({ ...prev, repository: undefined, branch: undefined }));
                    fetchRepos();
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  Change Repository
                </Button>
              )}
              <Button 
                variant="outline" 
                className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-2"
                onClick={handleDisconnect}
              >
                <Unlink className="h-4 w-4" />
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <Button 
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full bg-foreground text-background hover:bg-foreground/90 gap-2 h-12"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Github className="h-5 w-5" />
                Connect GitHub
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
