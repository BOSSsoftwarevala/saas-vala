import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const repoCache = new Map<string, { expiresAt: number; payload: unknown }>();

interface GitHubAccount {
  name: string;
  email: string;
  token: string;
}

interface GitHubUserInfoResult {
  ok: boolean;
  status: number;
  user: any | null;
  error?: string;
  rateLimitRemaining?: number | null;
}

function getGitHubAccounts(): GitHubAccount[] {
  const accounts: GitHubAccount[] = [];

  const saasEmail = Deno.env.get("SAASVALA_GITHUB_EMAIL");
  const saasToken = Deno.env.get("SAASVALA_GITHUB_TOKEN");
  if (saasEmail && saasToken) {
    accounts.push({ name: "SaaSVala", email: saasEmail, token: saasToken });
  }

  const softEmail = Deno.env.get("SOFTWAREVALA_GITHUB_EMAIL");
  const softToken = Deno.env.get("SOFTWAREVALA_GITHUB_TOKEN");
  if (softEmail && softToken) {
    accounts.push({ name: "SoftwareVala", email: softEmail, token: softToken });
  }

  return accounts;
}

async function fetchUserInfo(token: string): Promise<GitHubUserInfoResult> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "SaaSVala-Platform",
    },
  });

  const rateLimitRemaining = Number(res.headers.get("x-ratelimit-remaining"));
  if (!res.ok) {
    const errorBody = await res.text().catch(() => "GitHub request failed");
    return {
      ok: false,
      status: res.status,
      user: null,
      error: errorBody.slice(0, 200),
      rateLimitRemaining: Number.isFinite(rateLimitRemaining) ? rateLimitRemaining : null,
    };
  }

  return {
    ok: true,
    status: res.status,
    user: await res.json(),
    rateLimitRemaining: Number.isFinite(rateLimitRemaining) ? rateLimitRemaining : null,
  };
}

async function fetchReposPage(token: string, page: number, perPage: number) {
  const res = await fetch(
    `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "SaaSVala-Platform",
      },
    }
  );

  if (!res.ok) {
    const msg = await res.text().catch(() => "GitHub request failed");
    throw new Error(msg.slice(0, 200));
  }

  const repos = await res.json();
  return Array.isArray(repos) ? repos : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, accountName, query, page: rawPage, pageSize: rawPageSize } = await req.json();
    const accounts = getGitHubAccounts();

    if (accounts.length === 0) {
      return new Response(
        JSON.stringify({ error: "No GitHub accounts configured. Contact admin." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: status - get connected accounts info
    if (action === "status") {
      const accountsInfo = [];
      for (const acc of accounts) {
        const result = await fetchUserInfo(acc.token);
        const user = result.user;
        accountsInfo.push({
          name: acc.name,
          email: acc.email,
          connected: result.ok,
          login: user?.login || null,
          avatar_url: user?.avatar_url || null,
          public_repos: user?.public_repos || 0,
          total_private_repos: user?.total_private_repos || 0,
          token_status: result.ok ? "active" : "invalid",
          token_error: result.ok ? null : result.error || `GitHub HTTP ${result.status}`,
          rate_limit_remaining: result.rateLimitRemaining ?? null,
        });
      }

      return new Response(
        JSON.stringify({ success: true, accounts: accountsInfo }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: repos - fetch all repos from one or all accounts
    if (action === "repos") {
      const page = Math.max(1, Number(rawPage || 1));
      const pageSize = Math.min(100, Math.max(1, Number(rawPageSize || 25)));
      const search = String(query || "").trim().toLowerCase();
      const targetAccounts = accountName
        ? accounts.filter((a) => a.name === accountName)
        : accounts;

      const cacheKey = JSON.stringify({
        accountName: accountName || "all",
        page,
        pageSize,
        search,
      });
      const cached = repoCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return new Response(
          JSON.stringify({ ...(cached.payload as object), cached: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const allRepos: any[] = [];
      const invalidAccounts: string[] = [];

      for (const acc of targetAccounts) {
        const accountStatus = await fetchUserInfo(acc.token);
        if (!accountStatus.ok) {
          invalidAccounts.push(acc.name);
          continue;
        }

        const repos = await fetchReposPage(acc.token, page, pageSize);
        for (const repo of repos) {
          const fullName = String(repo.full_name || "").toLowerCase();
          const repoName = String(repo.name || "").toLowerCase();
          if (search && !repoName.includes(search) && !fullName.includes(search)) {
            continue;
          }

          allRepos.push({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            private: repo.private,
            html_url: repo.html_url,
            description: repo.description,
            default_branch: repo.default_branch,
            updated_at: repo.updated_at,
            language: repo.language,
            stargazers_count: repo.stargazers_count,
            open_issues_count: repo.open_issues_count,
            account: acc.name,
          });
        }
      }

      // Sort by most recently updated
      allRepos.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      const payload = {
        success: true,
        totalRepos: allRepos.length,
        repos: allRepos,
        page,
        pageSize,
        hasMore: allRepos.length >= pageSize,
        invalidAccounts,
        cached: false,
      };

      repoCache.set(cacheKey, {
        payload,
        expiresAt: Date.now() + 60_000,
      });

      return new Response(JSON.stringify(payload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("github-connect error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
