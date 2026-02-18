import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GitHubAccount {
  name: string;
  email: string;
  token: string;
}

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  default_branch: string;
  updated_at: string;
  pushed_at: string;
  language: string | null;
  stargazers_count: number;
  open_issues_count: number;
  private: boolean;
}

// Get all configured GitHub accounts
function getGitHubAccounts(): GitHubAccount[] {
  const accounts: GitHubAccount[] = [];

  // SaaSVala account
  const saasEmail = Deno.env.get("SAASVALA_GITHUB_EMAIL");
  const saasToken = Deno.env.get("SAASVALA_GITHUB_TOKEN");
  if (saasEmail && saasToken) {
    accounts.push({ name: "SaaSVala", email: saasEmail, token: saasToken });
  }

  // SoftwareVala account
  const softEmail = Deno.env.get("SOFTWAREVALA_GITHUB_EMAIL");
  const softToken = Deno.env.get("SOFTWAREVALA_GITHUB_TOKEN");
  if (softEmail && softToken) {
    accounts.push({ name: "SoftwareVala", email: softEmail, token: softToken });
  }

  return accounts;
}

// Fetch all repos for an account
async function fetchAllRepos(account: GitHubAccount): Promise<Repository[]> {
  const allRepos: Repository[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await fetch(
      `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated`,
      {
        headers: {
          Authorization: `Bearer ${account.token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "SoftwareVala-AutoPilot",
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch repos for ${account.name}:`, await response.text());
      break;
    }

    const repos: Repository[] = await response.json();
    if (repos.length === 0) break;

    allRepos.push(...repos);
    if (repos.length < perPage) break;
    page++;
  }

  return allRepos;
}

// Get latest commit for a repo
async function getLatestCommit(account: GitHubAccount, repoFullName: string, branch: string) {
  const response = await fetch(
    `https://api.github.com/repos/${repoFullName}/commits/${branch}`,
    {
      headers: {
        Authorization: `Bearer ${account.token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "SoftwareVala-AutoPilot",
      },
    }
  );

  if (!response.ok) return null;
  return response.json();
}

// Get repo activity (commits in last 24h)
async function getRepoActivity(account: GitHubAccount, repoFullName: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const response = await fetch(
    `https://api.github.com/repos/${repoFullName}/commits?since=${since}&per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${account.token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "SoftwareVala-AutoPilot",
      },
    }
  );

  if (!response.ok) return [];
  return response.json();
}

// Trigger workflow dispatch for auto-deploy
async function triggerWorkflow(account: GitHubAccount, repoFullName: string, workflowFile: string) {
  const response = await fetch(
    `https://api.github.com/repos/${repoFullName}/actions/workflows/${workflowFile}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "SoftwareVala-AutoPilot",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    }
  );

  return response.ok;
}

// Check workflow runs
async function getWorkflowRuns(account: GitHubAccount, repoFullName: string) {
  const response = await fetch(
    `https://api.github.com/repos/${repoFullName}/actions/runs?per_page=5`,
    {
      headers: {
        Authorization: `Bearer ${account.token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "SoftwareVala-AutoPilot",
      },
    }
  );

  if (!response.ok) return { workflow_runs: [] };
  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const accounts = getGitHubAccounts();

    switch (action) {
      // ============= LIST ALL PROJECTS =============
      case "list_all_projects": {
        const results: { account: string; repos: Repository[]; total: number }[] = [];

        for (const account of accounts) {
          const repos = await fetchAllRepos(account);
          results.push({
            account: account.name,
            repos: repos.slice(0, 50), // Limit for response size
            total: repos.length,
          });
        }

        const totalProjects = results.reduce((sum, r) => sum + r.total, 0);

        return new Response(
          JSON.stringify({
            success: true,
            accounts: results.map(r => ({ name: r.account, projectCount: r.total })),
            totalProjects,
            recentRepos: results.flatMap(r => 
              r.repos.slice(0, 10).map(repo => ({
                account: r.account,
                name: repo.name,
                fullName: repo.full_name,
                url: repo.html_url,
                language: repo.language,
                updatedAt: repo.updated_at,
                stars: repo.stargazers_count,
                issues: repo.open_issues_count,
              }))
            ),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============= MONITOR ALL PROJECTS =============
      case "monitor_projects": {
        const monitoringData: {
          account: string;
          totalRepos: number;
          activeToday: number;
          failedDeployments: number;
          openIssues: number;
          recentActivity: unknown[];
        }[] = [];

        for (const account of accounts) {
          const repos = await fetchAllRepos(account);
          let activeToday = 0;
          let failedDeployments = 0;
          let openIssues = 0;
          const recentActivity: unknown[] = [];

          // Check each repo (limit to recent 50 for performance)
          for (const repo of repos.slice(0, 50)) {
            openIssues += repo.open_issues_count;

            // Check for recent commits
            const activity = await getRepoActivity(account, repo.full_name);
            if (activity.length > 0) {
              activeToday++;
              recentActivity.push({
                repo: repo.name,
                commits: activity.length,
                lastCommit: activity[0]?.commit?.message?.substring(0, 100),
              });
            }

            // Check workflow status
            const workflows = await getWorkflowRuns(account, repo.full_name);
            const failedRuns = workflows.workflow_runs?.filter(
              (run: { conclusion: string }) => run.conclusion === "failure"
            );
            if (failedRuns?.length > 0) {
              failedDeployments++;
            }
          }

          monitoringData.push({
            account: account.name,
            totalRepos: repos.length,
            activeToday,
            failedDeployments,
            openIssues,
            recentActivity: recentActivity.slice(0, 10),
          });
        }

        // Store monitoring snapshot
        await supabase.from("activity_logs").insert({
          entity_type: "github_monitoring",
          entity_id: crypto.randomUUID(),
          action: "daily_monitoring",
          details: { monitoringData, timestamp: new Date().toISOString() },
        });

        return new Response(
          JSON.stringify({ success: true, monitoring: monitoringData }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============= AUTO-DEPLOY UPDATES =============
      case "auto_deploy": {
        const { repoFullName, accountName } = data || {};
        const deployResults: {
          account: string;
          repo: string;
          status: string;
          message: string;
        }[] = [];

        // If specific repo provided, deploy that
        if (repoFullName && accountName) {
          const account = accounts.find(a => a.name === accountName);
          if (account) {
            const success = await triggerWorkflow(account, repoFullName, "deploy.yml");
            deployResults.push({
              account: accountName,
              repo: repoFullName,
              status: success ? "triggered" : "no_workflow",
              message: success ? "Deployment workflow triggered" : "No deploy.yml workflow found",
            });
          }
        } else {
          // Auto-deploy all repos with recent changes
          for (const account of accounts) {
            const repos = await fetchAllRepos(account);
            
            for (const repo of repos.slice(0, 20)) {
              const activity = await getRepoActivity(account, repo.full_name);
              
              if (activity.length > 0) {
                const success = await triggerWorkflow(account, repo.full_name, "deploy.yml");
                deployResults.push({
                  account: account.name,
                  repo: repo.name,
                  status: success ? "triggered" : "no_workflow",
                  message: success 
                    ? `Deployment triggered (${activity.length} new commits)` 
                    : "No deploy workflow configured",
                });
              }
            }
          }
        }

        // Log deployment actions
        await supabase.from("activity_logs").insert({
          entity_type: "github_deploy",
          entity_id: crypto.randomUUID(),
          action: "auto_deploy",
          details: { deployments: deployResults, timestamp: new Date().toISOString() },
        });

        return new Response(
          JSON.stringify({ success: true, deployments: deployResults }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============= SYNC PROJECTS =============
      case "sync_projects": {
        const syncResults: {
          account: string;
          totalRepos: number;
          synced: number;
          updated: string[];
        }[] = [];

        for (const account of accounts) {
          const repos = await fetchAllRepos(account);
          const updated: string[] = [];

          // Sync repos to our database
          for (const repo of repos) {
            const latestCommit = await getLatestCommit(account, repo.full_name, repo.default_branch);
            
            // Upsert to git_connections table
            const { error } = await supabase
              .from("git_connections")
              .upsert({
                repository_url: repo.clone_url,
                repository_name: repo.full_name,
                branch: repo.default_branch,
                provider: "github",
                last_commit_sha: latestCommit?.sha || null,
                last_commit_message: latestCommit?.commit?.message?.substring(0, 500) || null,
                last_sync_at: new Date().toISOString(),
                status: "connected",
              }, {
                onConflict: "repository_url",
              });

            if (!error) {
              updated.push(repo.name);
            }
          }

          syncResults.push({
            account: account.name,
            totalRepos: repos.length,
            synced: updated.length,
            updated: updated.slice(0, 20),
          });
        }

        return new Response(
          JSON.stringify({ success: true, sync: syncResults }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============= GENERATE DAILY REPORT =============
      case "generate_daily_report": {
        const report: {
          date: string;
          accounts: {
            name: string;
            totalProjects: number;
            activeToday: number;
            topLanguages: { [key: string]: number };
            recentActivity: unknown[];
            deploymentStatus: { success: number; failed: number; pending: number };
          }[];
          summary: {
            totalProjects: number;
            totalActiveToday: number;
            totalDeployments: number;
            healthScore: number;
          };
        } = {
          date: new Date().toISOString().split("T")[0],
          accounts: [],
          summary: {
            totalProjects: 0,
            totalActiveToday: 0,
            totalDeployments: 0,
            healthScore: 100,
          },
        };

        for (const account of accounts) {
          const repos = await fetchAllRepos(account);
          const languageCount: { [key: string]: number } = {};
          let activeToday = 0;
          const recentActivity: unknown[] = [];
          const deploymentStatus = { success: 0, failed: 0, pending: 0 };

          for (const repo of repos.slice(0, 50)) {
            // Count languages
            if (repo.language) {
              languageCount[repo.language] = (languageCount[repo.language] || 0) + 1;
            }

            // Check activity
            const activity = await getRepoActivity(account, repo.full_name);
            if (activity.length > 0) {
              activeToday++;
              recentActivity.push({
                repo: repo.name,
                commits: activity.length,
                authors: [...new Set(activity.map((c: { author?: { login?: string } }) => c.author?.login))],
              });
            }

            // Check deployments
            const workflows = await getWorkflowRuns(account, repo.full_name);
            for (const run of workflows.workflow_runs || []) {
              if (run.conclusion === "success") deploymentStatus.success++;
              else if (run.conclusion === "failure") deploymentStatus.failed++;
              else if (run.status === "in_progress" || run.status === "queued") deploymentStatus.pending++;
            }
          }

          report.accounts.push({
            name: account.name,
            totalProjects: repos.length,
            activeToday,
            topLanguages: Object.fromEntries(
              Object.entries(languageCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
            ),
            recentActivity: recentActivity.slice(0, 10),
            deploymentStatus,
          });

          report.summary.totalProjects += repos.length;
          report.summary.totalActiveToday += activeToday;
          report.summary.totalDeployments += deploymentStatus.success + deploymentStatus.failed;
        }

        // Calculate health score
        const failedDeployments = report.accounts.reduce(
          (sum, a) => sum + a.deploymentStatus.failed, 0
        );
        const totalDeployments = report.summary.totalDeployments;
        if (totalDeployments > 0) {
          report.summary.healthScore = Math.round(
            ((totalDeployments - failedDeployments) / totalDeployments) * 100
          );
        }

        // Store report
        await supabase.from("activity_logs").insert({
          entity_type: "github_report",
          entity_id: crypto.randomUUID(),
          action: "daily_report",
          details: report,
        });

        // Create notification
        await supabase.from("notifications").insert({
          user_id: data?.userId || "system",
          title: "📊 Daily GitHub Report Ready",
          message: `${report.summary.totalProjects} projects monitored. ${report.summary.totalActiveToday} active today. Health: ${report.summary.healthScore}%`,
          type: "info",
        });

        return new Response(
          JSON.stringify({ success: true, report }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============= GET ACCOUNT STATUS =============
      case "get_account_status": {
        const status = accounts.map(a => ({
          name: a.name,
          email: a.email,
          connected: true,
        }));

        // Check which accounts are missing
        const missing: string[] = [];
        if (!Deno.env.get("SAASVALA_GITHUB_TOKEN")) missing.push("SaaSVala");
        if (!Deno.env.get("SOFTWAREVALA_GITHUB_TOKEN")) missing.push("SoftwareVala");

        return new Response(
          JSON.stringify({
            success: true,
            connected: status,
            missing,
            totalAccounts: accounts.length,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============= SYNC REAL REPOS → PRODUCTS =============
      case "sync_to_products": {
        const results: { name: string; account: string; status: string; id?: string }[] = [];

        for (const account of accounts) {
          const repos = await fetchAllRepos(account);

          for (const repo of repos) {
            const slug = repo.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");

            const productName = repo.name
              .replace(/[-_]/g, " ")
              .replace(/\b\w/g, (c: string) => c.toUpperCase());

            const { data: existing } = await supabase
              .from("products")
              .select("id")
              .eq("slug", slug)
              .maybeSingle();

            if (existing) {
              // Update git_repo_url if changed
              await supabase
                .from("products")
                .update({
                  git_repo_url: repo.html_url,
                  description: repo.description || productName,
                })
                .eq("id", existing.id);
              results.push({ name: repo.name, account: account.name, status: "updated", id: existing.id });
            } else {
              const { data: inserted, error } = await supabase
                .from("products")
                .insert({
                  name: productName,
                  slug,
                  description: repo.description || `${productName} - ${account.name}`,
                  base_price: 5,
                  price: 5,
                  currency: "USD",
                  product_type: "software",
                  status: "active",
                  marketplace_visible: true,
                  git_repo_url: repo.html_url,
                  features: [
                    { icon: "Code2", text: repo.language || "Custom" },
                    { icon: "GitBranch", text: `Branch: ${repo.default_branch}` },
                    { icon: "Star", text: `Stars: ${repo.stargazers_count}` },
                    { icon: "Key", text: "License Key Included" },
                    { icon: "Download", text: "APK Available" },
                  ],
                })
                .select("id")
                .single();

              if (error) {
                results.push({ name: repo.name, account: account.name, status: `error: ${error.message}` });
              } else {
                results.push({ name: repo.name, account: account.name, status: "inserted", id: inserted?.id });
              }
            }
          }
        }

        const inserted = results.filter(r => r.status === "inserted").length;
        const updated = results.filter(r => r.status === "updated").length;
        const errors = results.filter(r => r.status.startsWith("error")).length;

        return new Response(
          JSON.stringify({ success: true, inserted, updated, errors, total: results.length, results: results.slice(0, 50) }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============= ADD SINGLE PRODUCT MANUALLY =============
      case "add_manual_product": {
        const { name, description, gitUrl, apkUrl, price = 5, language } = data || {};

        if (!name) {
          return new Response(
            JSON.stringify({ success: false, error: "Product name required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        const { data: inserted, error } = await supabase
          .from("products")
          .insert({
            name,
            slug,
            description: description || name,
            base_price: Number(price),
            price: Number(price),
            currency: "USD",
            product_type: "software",
            status: "active",
            marketplace_visible: true,
            git_repo_url: gitUrl || null,
            apk_url: apkUrl || null,
            features: [
              { icon: "Code2", text: language || "Custom" },
              { icon: "Key", text: "License Key Included" },
              { icon: "Download", text: "APK Available" },
            ],
          })
          .select("id, name, slug")
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, product: inserted }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("GitHub Multi-Account error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
