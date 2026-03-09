import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const VERCEL_TOKEN = Deno.env.get("VERCEL_TOKEN");
    if (!VERCEL_TOKEN) {
      return new Response(JSON.stringify({ success: false, error: "VERCEL_TOKEN not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action, batch_size = 10, offset = 0 } = body;

    const vercelHeaders = {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/json",
    };

    if (action === "deploy-batch") {
      // Get batch of repos not yet deployed
      const { data: repos, error: fetchErr } = await supabase
        .from("source_code_catalog")
        .select("id, slug, project_name, github_repo_url, github_account")
        .like("github_repo_url", "https://github.com/saasvala/%")
        .order("slug")
        .range(offset, offset + batch_size - 1);

      if (fetchErr) {
        return new Response(JSON.stringify({ success: false, error: fetchErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!repos || repos.length === 0) {
        return new Response(JSON.stringify({ success: true, message: "No more repos to deploy", deployed: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results: any[] = [];
      let successCount = 0;
      let failCount = 0;
      const domainSuffix = "saasvala.com";

      for (const repo of repos) {
        const match = repo.github_repo_url?.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
        if (!match) {
          results.push({ slug: repo.slug, success: false, error: "Invalid URL" });
          failCount++;
          continue;
        }

        const [, owner, repoName] = match;
        const projectName = slugify(repo.slug || repoName);
        const customDomain = `${projectName}.${domainSuffix}`;

        try {
          // 1. Create Vercel project
          const createRes = await fetch("https://api.vercel.com/v10/projects", {
            method: "POST",
            headers: vercelHeaders,
            body: JSON.stringify({
              name: projectName,
              framework: null,
              gitRepository: { type: "github", repo: `${owner}/${repoName}` },
            }),
          });
          const createData = await createRes.json();
          const pid = createData.id || createData.error?.projectId;

          if (!pid) {
            results.push({ slug: repo.slug, success: false, error: createData.error?.message || "Create failed" });
            failCount++;
            continue;
          }

          // 2. Add custom domain
          await fetch(`https://api.vercel.com/v10/projects/${pid}/domains`, {
            method: "POST",
            headers: vercelHeaders,
            body: JSON.stringify({ name: customDomain }),
          });

          // 3. Trigger deployment
          const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
            method: "POST",
            headers: vercelHeaders,
            body: JSON.stringify({
              name: projectName,
              gitSource: { type: "github", ref: "main", repoId: `${owner}/${repoName}` },
            }),
          });
          const deployData = await deployRes.json();

          const deployUrl = `https://${customDomain}`;
          const vercelUrl = `https://${projectName}.vercel.app`;

          // 4. Update product demo_url
          await supabase
            .from("products")
            .update({ demo_url: deployUrl })
            .eq("slug", repo.slug);

          results.push({
            slug: repo.slug,
            success: true,
            project_id: pid,
            custom_domain: customDomain,
            vercel_url: vercelUrl,
            deployment_id: deployData.id,
          });
          successCount++;

          // Small delay to avoid rate limiting
          await new Promise(r => setTimeout(r, 500));
        } catch (e: any) {
          results.push({ slug: repo.slug, success: false, error: e.message });
          failCount++;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        batch_offset: offset,
        batch_size: repos.length,
        deployed: successCount,
        failed: failCount,
        next_offset: offset + batch_size,
        has_more: repos.length === batch_size,
        results,
        message: `✅ Batch deployed ${successCount}/${repos.length} repos to Vercel`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      // Count deployed vs pending
      const { count: total } = await supabase
        .from("source_code_catalog")
        .select("*", { count: "exact", head: true })
        .like("github_repo_url", "https://github.com/saasvala/%");

      const { count: withDemo } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .like("demo_url", "%.saasvala.com%")
        .eq("status", "active");

      return new Response(JSON.stringify({
        success: true,
        total_repos: total || 0,
        deployed_with_subdomain: withDemo || 0,
        pending: (total || 0) - (withDemo || 0),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Unknown action. Use 'deploy-batch' or 'status'" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
