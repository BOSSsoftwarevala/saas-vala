import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CatalogEntry {
  project_name: string;
  file_path?: string;
  file_size?: number;
  github_account?: string;
}

// Get GitHub account credentials
function getGitHubAccount(accountName: string) {
  if (accountName === "SoftwareVala") {
    return {
      email: Deno.env.get("SOFTWAREVALA_GITHUB_EMAIL"),
      token: Deno.env.get("SOFTWAREVALA_GITHUB_TOKEN"),
    };
  }
  return {
    email: Deno.env.get("SAASVALA_GITHUB_EMAIL"),
    token: Deno.env.get("SAASVALA_GITHUB_TOKEN"),
  };
}

// AI analyze project and generate Vala branded name
async function analyzeProject(projectName: string, fileStructure?: string[], existingNames?: string[]) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return {
      tech_stack: { languages: ["Unknown"] },
      project_type: "custom",
      target_industry: "general",
      description: `${projectName} - Custom software solution`,
      features: [],
      complexity: 5,
      vala_name: `Vala ${projectName} Pro`,
    };
  }

  const existingList = existingNames?.length ? `\nExisting names to avoid duplicates: ${existingNames.slice(0, 50).join(", ")}` : "";

  const prompt = `Analyze this software project and generate a professional "Vala" branded name.

Project Name: ${projectName}
${fileStructure ? `File Structure: ${fileStructure.slice(0, 50).join(", ")}` : ""}
${existingList}

NAMING RULES:
1. Format: "Vala [Industry] [Type] [Tier]"
2. Tiers: Pro (full-featured), Lite (basic), Enterprise (complex/large-scale)
3. Examples: "Vala Retail POS Pro", "Vala Hotel Booking Lite", "Vala Hospital ERP Enterprise"
4. If similar name exists, add industry context or change tier
5. Keep it SHORT (max 5 words)

Respond with JSON only:
{
  "vala_name": "Vala Industry Type Tier",
  "tech_stack": {
    "frontend": ["React/Vue/Angular/Flutter/etc"],
    "backend": ["Node/PHP/Python/Java/etc"],
    "database": ["MySQL/PostgreSQL/MongoDB/etc"],
    "languages": ["JavaScript/TypeScript/PHP/Python/etc"]
  },
  "project_type": "billing/crm/pos/ecommerce/inventory/booking/cms/erp/etc",
  "target_industry": "retail/healthcare/education/food/transport/hotel/pharmacy/school/etc",
  "description": "2-3 sentence description for marketplace",
  "features": [
    {"name": "Feature Name", "description": "Brief description", "icon": "IconName"}
  ],
  "complexity": 5
}`;

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4096,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("AI analysis error:", error);
  }

  return {
    tech_stack: { languages: ["Unknown"] },
    project_type: "custom",
    target_industry: "general",
    description: projectName,
    features: [],
    complexity: 5,
    vala_name: `Vala ${projectName} Pro`,
  };
}

// Create GitHub repository
async function createGitHubRepo(accountName: string, repoName: string, description: string) {
  const account = getGitHubAccount(accountName);
  if (!account.token) {
    throw new Error(`GitHub account ${accountName} not configured`);
  }

  const response = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "SoftwareVala-Manager",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: repoName,
      description: description.substring(0, 350),
      private: false,
      auto_init: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${error}`);
  }

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

    switch (action) {
      // ============= ADD PROJECTS TO CATALOG =============
      case "add_to_catalog": {
        const { projects } = data as { projects: CatalogEntry[] };
        const results: { name: string; status: string }[] = [];

        for (const project of projects) {
          const slug = project.project_name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

          const { error } = await supabase.from("source_code_catalog").insert({
            project_name: project.project_name,
            slug,
            file_path: project.file_path,
            file_size: project.file_size,
            github_account: project.github_account || "SaaSVala",
            status: "pending",
          });

          if (error) {
            results.push({ name: project.project_name, status: `error: ${error.message}` });
          } else {
            results.push({ name: project.project_name, status: "added" });
          }
        }

        return new Response(
          JSON.stringify({ success: true, added: results.filter(r => r.status === "added").length, results }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============= AI ANALYZE PROJECT =============
      case "analyze_project": {
        const { catalogId, projectName, fileStructure } = data;

        // Update status to analyzing
        await supabase
          .from("source_code_catalog")
          .update({ status: "analyzing" })
          .eq("id", catalogId);

        // Get existing vala names to avoid duplicates
        const { data: existingNames } = await supabase
          .from("source_code_catalog")
          .select("vala_name")
          .not("vala_name", "is", null);

        const existingNamesList = existingNames?.map(n => n.vala_name).filter(Boolean) as string[] || [];
        const analysis = await analyzeProject(projectName, fileStructure, existingNamesList);

        // Update with analysis results including vala_name
        const { error } = await supabase
          .from("source_code_catalog")
          .update({
            vala_name: analysis.vala_name,
            tech_stack: analysis.tech_stack,
            detected_features: analysis.features,
            project_type: analysis.project_type,
            target_industry: analysis.target_industry,
            ai_description: analysis.description,
            complexity_score: analysis.complexity,
            status: "analyzed",
            analyzed_at: new Date().toISOString(),
          })
          .eq("id", catalogId);

        if (error) {
          throw new Error(`Update error: ${error.message}`);
        }

        return new Response(
          JSON.stringify({ success: true, analysis }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============= BULK ANALYZE ALL PENDING =============
      case "bulk_analyze": {
        const { data: pending } = await supabase
          .from("source_code_catalog")
          .select("id, project_name")
          .eq("status", "pending")
          .limit(50);

        if (!pending || pending.length === 0) {
          return new Response(
            JSON.stringify({ success: true, analyzed: 0, message: "No pending projects" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const results: { name: string; status: string }[] = [];

        // Get all existing vala names for duplicate prevention
        const { data: existingNames } = await supabase
          .from("source_code_catalog")
          .select("vala_name")
          .not("vala_name", "is", null);

        const existingNamesList = existingNames?.map(n => n.vala_name).filter(Boolean) as string[] || [];

        for (const project of pending) {
          try {
            await supabase
              .from("source_code_catalog")
              .update({ status: "analyzing" })
              .eq("id", project.id);

            const analysis = await analyzeProject(project.project_name, undefined, existingNamesList);

            // Add new vala_name to list to prevent duplicates in same batch
            if (analysis.vala_name) {
              existingNamesList.push(analysis.vala_name);
            }

            await supabase
              .from("source_code_catalog")
              .update({
                vala_name: analysis.vala_name,
                tech_stack: analysis.tech_stack,
                detected_features: analysis.features,
                project_type: analysis.project_type,
                target_industry: analysis.target_industry,
                ai_description: analysis.description,
                complexity_score: analysis.complexity,
                status: "analyzed",
                analyzed_at: new Date().toISOString(),
              })
              .eq("id", project.id);

            results.push({ name: project.project_name, status: "analyzed", vala_name: (analysis as any).vala_name });
          } catch (error) {
            results.push({ name: project.project_name, status: `error: ${error}` });
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            analyzed: results.filter(r => r.status === "analyzed").length, 
            results 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============= UPLOAD TO GITHUB =============
      case "upload_to_github": {
        const { catalogId, projectName, description, accountName } = data;

        const repoName = projectName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        try {
          const repo = await createGitHubRepo(accountName || "SaaSVala", repoName, description || projectName);

          await supabase
            .from("source_code_catalog")
            .update({
              uploaded_to_github: true,
              github_repo_url: repo.html_url,
              github_account: accountName || "SaaSVala",
              status: "uploaded",
              uploaded_at: new Date().toISOString(),
            })
            .eq("id", catalogId);

          return new Response(
            JSON.stringify({ success: true, repo_url: repo.html_url, repo }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          return new Response(
            JSON.stringify({ success: false, error: errorMessage }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // ============= BULK UPLOAD TO GITHUB =============
      case "bulk_upload_github": {
        const { accountName, limit = 10 } = data || {};

        const { data: analyzed } = await supabase
          .from("source_code_catalog")
          .select("id, project_name, vala_name, ai_description")
          .eq("status", "analyzed")
          .eq("uploaded_to_github", false)
          .limit(limit);

        if (!analyzed || analyzed.length === 0) {
          return new Response(
            JSON.stringify({ success: true, uploaded: 0, message: "No projects to upload" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const results: { name: string; vala_name?: string; status: string; url?: string }[] = [];

        for (const project of analyzed) {
          try {
            // Use vala_name for repo, fallback to project_name
            const displayName = project.vala_name || project.project_name;
            const repoName = displayName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");

            const repo = await createGitHubRepo(
              accountName || "SaaSVala",
              repoName,
              project.ai_description || displayName
            );

            await supabase
              .from("source_code_catalog")
              .update({
                uploaded_to_github: true,
                github_repo_url: repo.html_url,
                github_account: accountName || "SaaSVala",
                status: "uploaded",
                uploaded_at: new Date().toISOString(),
              })
              .eq("id", project.id);

            results.push({ 
              name: project.project_name, 
              vala_name: project.vala_name,
              status: "uploaded", 
              url: repo.html_url 
            });
          } catch (error) {
            results.push({ name: project.project_name, status: `error: ${error}` });
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            uploaded: results.filter(r => r.status === "uploaded").length,
            results,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============= LIST TO MARKETPLACE =============
      case "list_on_marketplace": {
        const { catalogId, price = 5 } = data;

        const { data: project } = await supabase
          .from("source_code_catalog")
          .select("*")
          .eq("id", catalogId)
          .single();

        if (!project) {
          throw new Error("Project not found");
        }

        // Create product in products table
        const { data: productData, error: productError } = await supabase
          .from("products")
          .insert({
            name: project.project_name,
            description: project.ai_description || project.project_name,
            base_price: price,
            currency: "USD",
            product_type: "software",
            status: "active",
            meta: {
              tech_stack: project.tech_stack,
              features: project.detected_features,
              industry: project.target_industry,
              project_type: project.project_type,
              github_url: project.github_repo_url,
            },
          })
          .select()
          .single();

        if (productError) {
          throw new Error(`Product creation error: ${productError.message}`);
        }

        // Create marketplace listing
        const { data: listing, error: listingError } = await supabase
          .from("marketplace_listings")
          .insert({
            product_id: productData.id,
            seller_id: data.sellerId || "system",
            title: project.project_name,
            description: project.ai_description,
            price: price,
            status: "active",
          })
          .select()
          .single();

        if (listingError) {
          throw new Error(`Listing error: ${listingError.message}`);
        }

        // Update catalog entry
        await supabase
          .from("source_code_catalog")
          .update({
            is_on_marketplace: true,
            marketplace_price: price,
            marketplace_listing_id: listing.id,
            status: "listed",
            listed_at: new Date().toISOString(),
          })
          .eq("id", catalogId);

        return new Response(
          JSON.stringify({ success: true, listing_id: listing.id, product_id: productData.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============= GET CATALOG STATS =============
      case "get_catalog_stats": {
        const [totalRes, pendingRes, analyzedRes, uploadedRes, listedRes] = await Promise.all([
          supabase.from("source_code_catalog").select("id", { count: "exact", head: true }),
          supabase.from("source_code_catalog").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("source_code_catalog").select("id", { count: "exact", head: true }).eq("status", "analyzed"),
          supabase.from("source_code_catalog").select("id", { count: "exact", head: true }).eq("uploaded_to_github", true),
          supabase.from("source_code_catalog").select("id", { count: "exact", head: true }).eq("is_on_marketplace", true),
        ]);

        // Get industry breakdown
        const { data: industries } = await supabase
          .from("source_code_catalog")
          .select("target_industry")
          .not("target_industry", "is", null);

        const industryCount: { [key: string]: number } = {};
        industries?.forEach((p) => {
          if (p.target_industry) {
            industryCount[p.target_industry] = (industryCount[p.target_industry] || 0) + 1;
          }
        });

        return new Response(
          JSON.stringify({
            success: true,
            stats: {
              total: totalRes.count || 0,
              pending: pendingRes.count || 0,
              analyzed: analyzedRes.count || 0,
              uploaded_to_github: uploadedRes.count || 0,
              on_marketplace: listedRes.count || 0,
              industries: industryCount,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============= SEARCH CATALOG =============
      case "search_catalog": {
        const { query, industry, status, limit = 50 } = data || {};

        let queryBuilder = supabase.from("source_code_catalog").select("*");

        if (query) {
          queryBuilder = queryBuilder.or(
            `project_name.ilike.%${query}%,ai_description.ilike.%${query}%,project_type.ilike.%${query}%`
          );
        }
        if (industry) {
          queryBuilder = queryBuilder.eq("target_industry", industry);
        }
        if (status) {
          queryBuilder = queryBuilder.eq("status", status);
        }

        const { data: results, error } = await queryBuilder.order("created_at", { ascending: false }).limit(limit);

        if (error) {
          throw new Error(`Search error: ${error.message}`);
        }

        return new Response(
          JSON.stringify({ success: true, count: results?.length || 0, results }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============= AUTO-SYNC GITHUB REPOS =============
      case "sync_github_repos": {
        const { accountName = "SaaSVala" } = data || {};
        const account = getGitHubAccount(accountName);
        if (!account.token) {
          throw new Error(`GitHub token not configured for ${accountName}`);
        }

        // Fetch all repos with pagination
        const allRepos: any[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const res = await fetch(
            `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated&type=owner`,
            {
              headers: {
                Authorization: `Bearer ${account.token}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "SoftwareVala-Sync",
              },
            }
          );
          if (!res.ok) break;
          const repos = await res.json();
          if (!repos.length) break;
          allRepos.push(...repos);
          hasMore = repos.length === 100;
          page++;
        }

        // Upsert each repo into source_code_catalog
        let added = 0;
        let skipped = 0;
        for (const repo of allRepos) {
          const slug = repo.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

          const { error } = await supabase.from("source_code_catalog").upsert(
            {
              project_name: repo.name,
              slug,
              github_repo_url: repo.html_url,
              github_account: accountName,
              status: "uploaded",
              uploaded_to_github: true,
              uploaded_at: repo.pushed_at || new Date().toISOString(),
              target_industry: "general",
            },
            { onConflict: "slug" }
          );

          if (error) {
            skipped++;
          } else {
            added++;
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Synced ${added} repos from ${accountName} (${skipped} skipped)`,
            total_fetched: allRepos.length,
            added,
            skipped,
          }),
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
    console.error("Source Code Manager error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
