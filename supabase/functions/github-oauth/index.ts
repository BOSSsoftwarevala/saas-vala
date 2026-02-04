import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    const GITHUB_CLIENT_ID = Deno.env.get('GITHUB_CLIENT_ID');
    const GITHUB_CLIENT_SECRET = Deno.env.get('GITHUB_CLIENT_SECRET');

    if (!GITHUB_CLIENT_ID) {
      console.error('GITHUB_CLIENT_ID is not configured');
      throw new Error('GitHub OAuth is not configured - missing client ID');
    }

    if (!GITHUB_CLIENT_SECRET) {
      console.error('GITHUB_CLIENT_SECRET is not configured');
      throw new Error('GitHub OAuth is not configured - missing client secret');
    }

    // Action 1: Get OAuth URL to redirect user
    if (action === 'auth-url') {
      const { data } = await req.json();
      const redirectUri = data?.redirectUri || '';
      
      const scope = 'repo read:user user:email';
      const state = crypto.randomUUID();
      
      const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;
      
      console.log('Generated GitHub OAuth URL');
      
      return new Response(
        JSON.stringify({ authUrl, state }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action 2: Exchange code for access token
    if (action === 'callback') {
      const { code } = await req.json();
      
      if (!code) {
        throw new Error('Authorization code is required');
      }

      console.log('Exchanging code for access token');

      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code: code,
        }),
      });

      const tokenData = await tokenResponse.json();
      
      if (tokenData.error) {
        console.error('GitHub token error:', tokenData.error_description);
        throw new Error(tokenData.error_description || 'Failed to get access token');
      }

      console.log('Successfully obtained GitHub access token');

      // Get user info
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      const userData = await userResponse.json();
      console.log('Retrieved GitHub user:', userData.login);

      return new Response(
        JSON.stringify({
          access_token: tokenData.access_token,
          user: {
            id: userData.id,
            login: userData.login,
            name: userData.name,
            avatar_url: userData.avatar_url,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action 3: List user repositories
    if (action === 'repos') {
      const authHeader = req.headers.get('x-github-token');
      
      if (!authHeader) {
        throw new Error('GitHub access token is required');
      }

      console.log('Fetching user repositories');

      const reposResponse = await fetch('https://api.github.com/user/repos?sort=updated&per_page=50', {
        headers: {
          'Authorization': `Bearer ${authHeader}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      const repos = await reposResponse.json();
      
      if (!Array.isArray(repos)) {
        console.error('Failed to fetch repos:', repos);
        throw new Error('Failed to fetch repositories');
      }

      console.log(`Found ${repos.length} repositories`);

      const formattedRepos = repos.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        html_url: repo.html_url,
        description: repo.description,
        default_branch: repo.default_branch,
        updated_at: repo.updated_at,
        language: repo.language,
      }));

      return new Response(
        JSON.stringify({ repos: formattedRepos }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action 4: Get repository branches
    if (action === 'branches') {
      const authHeader = req.headers.get('x-github-token');
      const { repo } = await req.json();
      
      if (!authHeader) {
        throw new Error('GitHub access token is required');
      }

      if (!repo) {
        throw new Error('Repository name is required');
      }

      console.log(`Fetching branches for ${repo}`);

      const branchesResponse = await fetch(`https://api.github.com/repos/${repo}/branches`, {
        headers: {
          'Authorization': `Bearer ${authHeader}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      const branches = await branchesResponse.json();
      
      if (!Array.isArray(branches)) {
        console.error('Failed to fetch branches:', branches);
        throw new Error('Failed to fetch branches');
      }

      console.log(`Found ${branches.length} branches`);

      return new Response(
        JSON.stringify({ branches: branches.map((b: any) => b.name) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: unknown) {
    console.error('GitHub OAuth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
