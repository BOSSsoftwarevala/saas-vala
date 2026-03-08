import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getHeaders(token: string) {
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

async function createVercelProject(headers: Record<string, string>, repoOwner: string, repoName: string, projectName: string) {
  const res = await fetch("https://api.vercel.com/v10/projects", {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: projectName,
      framework: null,
      gitRepository: { type: "github", repo: `${repoOwner}/${repoName}` },
    }),
  });
  return res.json();
}

async function addCustomDomain(headers: Record<string, string>, projectId: string, domain: string) {
  const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/domains`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: domain }),
  });
  return res.json();
}

async function triggerDeployment(headers: Record<string, string>, projectName: string, repoOwner: string, repoName: string) {
  const res = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: projectName,
      gitSource: { type: "github", ref: "main", repoId: `${repoOwner}/${repoName}` },
    }),
  });
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, app_name, repo_url, project_id, repos, domain_suffix } = body;

    const VERCEL_TOKEN = Deno.env.get("VERCEL_TOKEN");
    if (!VERCEL_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, error: "VERCEL_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const headers = getHeaders(VERCEL_TOKEN);

    switch (action) {
      // ─── Single Deploy ───
      case "deploy": {
        if (!repo_url) {
          return new Response(
            JSON.stringify({ success: false, error: "repo_url required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const match = repo_url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
        if (!match) {
          return new Response(
            JSON.stringify({ success: false, error: "Invalid GitHub URL" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const [, owner, repo] = match;
        const projectName = slugify(app_name || repo);

        const createData = await createVercelProject(headers, owner, repo, projectName);
        if (!createData.id && createData.error?.code !== "project_already_exists") {
          return new Response(
            JSON.stringify({ success: false, error: createData.error?.message || "Failed to create project", details: createData }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const vercelProjectId = createData.id || createData.error?.projectId;
        const deployData = await triggerDeployment(headers, projectName, owner, repo);
        const deployUrl = deployData.url ? `https://${deployData.url}` : `https://${projectName}.vercel.app`;

        return new Response(
          JSON.stringify({
            success: true, method: "vercel", project_name: projectName,
            project_id: vercelProjectId, deploy_url: deployUrl,
            deployment_id: deployData.id, status: deployData.readyState || "queued",
            message: `✅ Deployed ${projectName} → ${deployUrl}`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ─── Auto Subdomain (single repo) ───
      case "auto-subdomain": {
        if (!repo_url) {
          return new Response(
            JSON.stringify({ success: false, error: "repo_url required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const match = repo_url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
        if (!match) {
          return new Response(
            JSON.stringify({ success: false, error: "Invalid GitHub URL" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const [, owner, repo] = match;
        const projectName = slugify(app_name || repo);
        const suffix = domain_suffix || "saasvala.com";
        const customDomain = `${projectName}.${suffix}`;

        // Step 1: Create project
        const createData = await createVercelProject(headers, owner, repo, projectName);
        const vercelProjectId = createData.id || createData.error?.projectId;

        if (!vercelProjectId) {
          return new Response(
            JSON.stringify({ success: false, error: "Could not create/find project", details: createData }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Step 2: Add custom domain
        const domainResult = await addCustomDomain(headers, vercelProjectId, customDomain);

        // Step 3: Trigger deployment
        const deployData = await triggerDeployment(headers, projectName, owner, repo);

        return new Response(
          JSON.stringify({
            success: true,
            project_name: projectName,
            project_id: vercelProjectId,
            custom_domain: customDomain,
            domain_status: domainResult.error ? "failed" : "configured",
            domain_details: domainResult,
            deploy_url: `https://${customDomain}`,
            vercel_url: `https://${projectName}.vercel.app`,
            deployment_id: deployData.id,
            message: `✅ ${customDomain} → Vercel project created & domain assigned`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ─── Bulk Auto Subdomain (multiple repos) ───
      case "bulk-subdomain": {
        const repoList: { slug: string; owner?: string }[] = repos || [];
        if (!repoList.length) {
          return new Response(
            JSON.stringify({ success: false, error: "repos array required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const suffix = domain_suffix || "saasvala.com";
        const defaultOwner = "saasvala";
        const results: any[] = [];
        let successCount = 0;
        let failCount = 0;

        for (const r of repoList) {
          const owner = r.owner || defaultOwner;
          const projectName = slugify(r.slug);
          const customDomain = `${projectName}.${suffix}`;

          try {
            // Create project
            const createData = await createVercelProject(headers, owner, r.slug, projectName);
            const pid = createData.id || createData.error?.projectId;

            if (!pid) {
              results.push({ slug: r.slug, success: false, error: createData.error?.message || "Failed" });
              failCount++;
              continue;
            }

            // Add domain
            const domainResult = await addCustomDomain(headers, pid, customDomain);

            // Trigger deploy
            const deployData = await triggerDeployment(headers, projectName, owner, r.slug);

            results.push({
              slug: r.slug, success: true, project_id: pid,
              custom_domain: customDomain, vercel_url: `https://${projectName}.vercel.app`,
              deployment_id: deployData.id,
              domain_ok: !domainResult.error,
            });
            successCount++;
          } catch (e) {
            results.push({ slug: r.slug, success: false, error: e.message });
            failCount++;
          }
        }

        return new Response(
          JSON.stringify({
            success: true, total: repoList.length,
            created: successCount, failed: failCount,
            results,
            message: `✅ ${successCount}/${repoList.length} repos deployed with .${suffix} subdomains`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ─── List Projects ───
      case "list": {
        const res = await fetch("https://api.vercel.com/v9/projects?limit=50", { headers });
        const data = await res.json();
        const projects = (data.projects || []).map((p: any) => ({
          name: p.name, id: p.id, url: `https://${p.name}.vercel.app`,
          framework: p.framework, updated: p.updatedAt, repo: p.link?.repo,
          domains: p.alias || [],
        }));
        return new Response(
          JSON.stringify({ success: true, projects, total: projects.length }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ─── Project Status ───
      case "status": {
        const pid = project_id || app_name;
        if (!pid) {
          return new Response(
            JSON.stringify({ success: false, error: "project_id or app_name required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const res = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(pid)}`, { headers });
        const data = await res.json();
        return new Response(
          JSON.stringify({
            success: res.ok,
            project: res.ok ? {
              name: data.name, id: data.id, url: `https://${data.name}.vercel.app`,
              framework: data.framework,
              latest_deployment: data.latestDeployments?.[0]?.url,
              status: data.latestDeployments?.[0]?.readyState,
              domains: data.alias || [],
            } : data,
          }),
          { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ─── Delete Project ───
      case "delete": {
        const pid = project_id || app_name;
        if (!pid) {
          return new Response(
            JSON.stringify({ success: false, error: "project_id or app_name required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const res = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(pid)}`, {
          method: "DELETE", headers,
        });
        return new Response(
          JSON.stringify({ success: res.ok, message: res.ok ? `Deleted ${pid}` : "Delete failed" }),
          { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ─── Deployment Logs ───
      case "logs": {
        const pid = project_id || app_name;
        if (!pid) {
          return new Response(
            JSON.stringify({ success: false, error: "project_id or app_name required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const res = await fetch(`https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(pid)}&limit=5`, { headers });
        const data = await res.json();
        return new Response(
          JSON.stringify({
            success: res.ok,
            deployments: (data.deployments || []).map((d: any) => ({
              id: d.uid, url: `https://${d.url}`, state: d.readyState || d.state,
              created: d.created, meta: d.meta,
            })),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ─── Health Check ───
      case "health": {
        const res = await fetch("https://api.vercel.com/v9/projects?limit=1", { headers });
        return new Response(
          JSON.stringify({ success: res.ok, platform: "vercel", status: res.ok ? "connected" : "error" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
