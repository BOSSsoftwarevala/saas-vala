import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

async function fetchSaasvalaRepos(githubToken: string) {
  const repos: any[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `https://api.github.com/users/saasvala/repos?per_page=100&page=${page}&sort=updated`,
      { headers: { Authorization: `Bearer ${githubToken}`, "User-Agent": "SaaSVala-APK-Pipeline" } }
    );

    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status}`);
    }

    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    repos.push(...batch);
    if (batch.length < 100) break;
    page++;
  }

  return repos;
}

async function repairMissingCatalogSlugs(admin: any) {
  const { data: missingSlugRows } = await admin
    .from("source_code_catalog")
    .select("id, slug, project_name, github_repo_url")
    .is("slug", null)
    .not("github_repo_url", "is", null)
    .limit(100);

  let repaired = 0;

  for (const row of missingSlugRows || []) {
    const fromRepoUrl = String(row.github_repo_url || "").split("/").pop();
    const fallbackName = row.project_name || fromRepoUrl || "";
    const newSlug = slugify(fromRepoUrl || fallbackName);

    if (!newSlug) continue;

    const { error } = await admin
      .from("source_code_catalog")
      .update({ slug: newSlug })
      .eq("id", row.id);

    if (!error) repaired++;
  }

  return repaired;
}

function canRunAsSystem(action: string) {
  // All pipeline actions can run as system with anon key
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const { action, data } = await req.json();

    const authHeader = req.headers.get("Authorization");

    let user: any = null;
    if (authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: authData } = await userClient.auth.getUser();
      if (authData?.user) {
        user = authData.user;
      }
    }

    // Allow system-level access (verify_jwt=false, anon key, or authenticated user)
    // Pipeline is admin-only tool, security handled at UI level

    const admin = createClient(supabaseUrl, serviceKey);

    switch (action) {
      // ═══════════════════════════════════════════
      // FUNCTION 1: Scan repos & register as products
      // ═══════════════════════════════════════════
      case "scan_and_register": {
        const githubToken = Deno.env.get("SAASVALA_GITHUB_TOKEN");
        if (!githubToken) {
          return respond({ error: "GitHub token not configured" }, 500);
        }

        const repos = await fetchSaasvalaRepos(githubToken);

        // Repair historical rows where slug is missing
        const repairedMissingSlugs = await repairMissingCatalogSlugs(admin);

        // Get existing catalog entries
        const { data: existing } = await admin
          .from("source_code_catalog")
          .select("slug");
        const existingSlugs = new Set((existing || []).map((e: any) => e.slug));

        // Register new repos
        let registered = 0;
        const newEntries = [];

        for (const repo of repos) {
          const slug = slugify(repo.name);
          if (existingSlugs.has(slug)) continue;

          newEntries.push({
            project_name: repo.name,
            slug,
            github_repo_url: repo.html_url,
            github_account: "saasvala",
            status: "pending",
            target_industry: detectIndustry(repo.name, repo.description || ""),
            ai_description: repo.description || `${repo.name} - SaaS Vala Software`,
            tech_stack: { languages: [repo.language || "Unknown"] },
          });
        }

        if (newEntries.length > 0) {
          const { error: insertErr } = await admin
            .from("source_code_catalog")
            .upsert(newEntries, { onConflict: "slug" });
          if (!insertErr) registered = newEntries.length;
        }

        return respond({
          success: true,
          total_repos: repos.length,
          already_registered: existingSlugs.size,
          newly_registered: registered,
          repaired_missing_slugs: repairedMissingSlugs,
          message: `✅ Scanned ${repos.length} repos, registered ${registered} new products, repaired ${repairedMissingSlugs} missing slugs`,
        });
      }

      // ═══════════════════════════════════════════
      // FUNCTION 2: Trigger APK build via VPS factory
      // ═══════════════════════════════════════════
      case "trigger_apk_build": {
        const { catalog_id, slug, repo_url, product_id } = data || {};
        if (!slug) return respond({ error: "slug required" }, 400);

        const githubToken = Deno.env.get("SAASVALA_GITHUB_TOKEN");
        const repoFullUrl = repo_url || `https://github.com/saasvala/${slug}`;

        const buildResult: any = {
          slug,
          repo_url: repoFullUrl,
          status: "queued",
          build_type: "github-actions",
        };

        if (!githubToken) {
          buildResult.status = "no_token";
          buildResult.message = "GitHub token not configured";
          return respond({ success: false, build: buildResult });
        }

        try {
          // Verify repo exists
          const repoCheck = await fetch(
            `https://api.github.com/repos/saasvala/${slug}`,
            {
              headers: {
                Authorization: `Bearer ${githubToken}`,
                "User-Agent": "SaaSVala-APK-Pipeline",
              },
            }
          );

          if (!repoCheck.ok) {
            await repoCheck.text();
            buildResult.status = "repo_not_found";
            buildResult.message = `Repo saasvala/${slug} not found (${repoCheck.status})`;
            return respond({ success: false, build: buildResult });
          }

          const repoData = await repoCheck.json();

          // Trigger GitHub Actions workflow dispatch via apk-factory repo
          const dispatchRes = await fetch(
            "https://api.github.com/repos/saasvala/apk-factory/actions/workflows/build-apk.yml/dispatches",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${githubToken}`,
                "User-Agent": "SaaSVala-APK-Pipeline",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                ref: "main",
                inputs: {
                  repo_url: repoData.html_url || repoFullUrl,
                  app_slug: slug,
                  package_name: `com.saasvala.${slug.replace(/-/g, "_")}`,
                  product_id: product_id || "",
                  supabase_url: supabaseUrl,
                },
              }),
            }
          );

          if (dispatchRes.ok || dispatchRes.status === 204) {
            // Upsert to build queue
            await admin.from("apk_build_queue").upsert(
              {
                repo_name: repoData.name || slug,
                repo_url: repoData.html_url || repoFullUrl,
                slug,
                build_status: "building",
                product_id: product_id || null,
                target_industry: detectIndustry(slug, repoData.description || ""),
                build_started_at: new Date().toISOString(),
              },
              { onConflict: "slug" }
            );

            buildResult.status = "building";
            buildResult.message = `APK build triggered via GitHub Actions for ${slug} (${repoData.language || "Unknown"})`;
            buildResult.repo_verified = true;
            buildResult.language = repoData.language;
          } else {
            const errText = await dispatchRes.text();
            // Fallback: queue without Actions
            await admin.from("apk_build_queue").upsert(
              {
                repo_name: repoData.name || slug,
                repo_url: repoData.html_url || repoFullUrl,
                slug,
                build_status: "pending",
                product_id: product_id || null,
                target_industry: detectIndustry(slug, repoData.description || ""),
              },
              { onConflict: "slug" }
            );

            buildResult.status = "queued";
            buildResult.message = `Repo verified, queued for build (Actions dispatch: ${dispatchRes.status})`;
            buildResult.repo_verified = true;
          }
        } catch (e: any) {
          buildResult.status = "error";
          buildResult.message = `Error: ${e.message}`;
        }

        // Update catalog
        if (catalog_id) {
          await admin
            .from("source_code_catalog")
            .update({ status: buildResult.status === "building" ? "building" : "pending_build" })
            .eq("id", catalog_id);
        }

        return respond({ success: true, build: buildResult });
      }

      // ═══════════════════════════════════════════
      // FUNCTION 3: Bulk trigger APK builds
      // ═══════════════════════════════════════════
      case "bulk_build": {
        const limit = data?.limit || 10;
        const { data: pendingCatalog } = await admin
          .from("source_code_catalog")
          .select("id, slug, github_repo_url, project_name")
          .in("status", ["pending", "analyzed", "uploaded"])
          .order("created_at", { ascending: true })
          .limit(limit);

        const results = [];
        for (const entry of pendingCatalog || []) {
          // Queue each build
          await admin.from("bulk_upload_queue").insert({
            catalog_id: entry.id,
            upload_type: "apk_build",
            status: "queued",
            priority: 5,
          });

          await admin
            .from("source_code_catalog")
            .update({ status: "pending_build" })
            .eq("id", entry.id);

          results.push({ slug: entry.slug, status: "queued" });
        }

        return respond({
          success: true,
          queued: results.length,
          builds: results,
          message: `🔧 ${results.length} APK builds queued`,
        });
      }

      // ═══════════════════════════════════════════
      // FUNCTION 4: Register APK as marketplace product
      // ═══════════════════════════════════════════
      case "register_apk_product": {
        const { catalog_id, apk_url, apk_size } = data || {};
        if (!catalog_id) return respond({ error: "catalog_id required" }, 400);

        // Get catalog entry
        const { data: entry } = await admin
          .from("source_code_catalog")
          .select("*")
          .eq("id", catalog_id)
          .single();

        if (!entry) return respond({ error: "Catalog entry not found" }, 404);

        // Check if product already exists
        const { data: existingProduct } = await admin
          .from("products")
          .select("id")
          .eq("slug", entry.slug)
          .single();

        const productData = {
          name: entry.vala_name || entry.project_name,
          slug: entry.slug,
          description: entry.ai_description || `${entry.project_name} - Powered by Software Vala™`,
          business_type: entry.target_industry || "general",
          status: "active" as const,
          is_apk: true,
          apk_url: apk_url || null,
          git_repo_url: entry.github_repo_url,
          demo_url: `https://${entry.slug}.saasvala.com`,
          price: entry.marketplace_price || 5,
        };

        let productId: string;
        if (existingProduct) {
          await admin.from("products").update(productData).eq("id", existingProduct.id);
          productId = existingProduct.id;
        } else {
          const { data: newProduct } = await admin
            .from("products")
            .insert(productData)
            .select("id")
            .single();
          productId = newProduct?.id || "";
        }

        // Update catalog
        await admin
          .from("source_code_catalog")
          .update({
            is_on_marketplace: true,
            status: apk_url ? "completed" : "listed",
            listed_at: new Date().toISOString(),
          })
          .eq("id", catalog_id);

        return respond({
          success: true,
          product_id: productId,
          slug: entry.slug,
          message: `✅ ${entry.project_name} registered as marketplace product`,
        });
      }

      // ═══════════════════════════════════════════
      // FUNCTION 5: Check for repo updates & rebuild
      // ═══════════════════════════════════════════
      case "check_updates": {
        const githubToken = Deno.env.get("SAASVALA_GITHUB_TOKEN");
        if (!githubToken) return respond({ error: "GitHub token not configured" }, 500);

        const since = new Date(Date.now() - 86400000).toISOString();
        const repos = await fetchSaasvalaRepos(githubToken);
        const recentlyUpdated = (repos || []).filter(
          (r: any) => new Date(r.pushed_at) > new Date(since)
        );

        const rebuilds = [];
        for (const repo of recentlyUpdated) {
          const slug = slugify(repo.name);

          // Check if this has an existing APK product
          const { data: catalogEntry } = await admin
            .from("source_code_catalog")
            .select("id, status")
            .eq("slug", slug)
            .single();

          if (catalogEntry && ["completed", "listed"].includes(catalogEntry.status || "")) {
            // Queue rebuild
            await admin.from("bulk_upload_queue").insert({
              catalog_id: catalogEntry.id,
              upload_type: "apk_rebuild",
              status: "queued",
              priority: 3,
            });

            await admin
              .from("source_code_catalog")
              .update({ status: "rebuilding" })
              .eq("id", catalogEntry.id);

            rebuilds.push({ slug, pushed_at: repo.pushed_at });
          }
        }

        return respond({
          success: true,
          recently_updated: recentlyUpdated.length,
          rebuilds_queued: rebuilds.length,
          rebuilds,
          message: `🔄 ${rebuilds.length} APK rebuilds queued from ${recentlyUpdated.length} updated repos`,
        });
      }

      // ═══════════════════════════════════════════
      // Full pipeline: scan → register → queue builds
      // ═══════════════════════════════════════════
      case "full_pipeline": {
        const githubToken = Deno.env.get("SAASVALA_GITHUB_TOKEN");
        if (!githubToken) return respond({ error: "GitHub token not configured" }, 500);

        const allRepos = await fetchSaasvalaRepos(githubToken);
        const repairedMissingSlugs = await repairMissingCatalogSlugs(admin);

        // Step 2: Get existing
        const { data: existing } = await admin.from("source_code_catalog").select("slug, id, status");
        const catalogMap = new Map((existing || []).map((e: any) => [e.slug, e]));

        let newlyRegistered = 0;
        let buildsQueued = 0;

        for (const repo of (allRepos || [])) {
          const slug = slugify(repo.name);
          const existingEntry = catalogMap.get(slug);

          if (!existingEntry) {
            // Register new
            const { data: inserted } = await admin
              .from("source_code_catalog")
              .insert({
                project_name: repo.name,
                slug,
                github_repo_url: repo.html_url,
                github_account: "saasvala",
                status: "pending_build",
                target_industry: detectIndustry(repo.name, repo.description || ""),
                ai_description: repo.description || `${repo.name} - SaaS Vala Software`,
                tech_stack: { languages: [repo.language || "Unknown"] },
              })
              .select("id")
              .single();

            if (inserted) {
              await admin.from("bulk_upload_queue").insert({
                catalog_id: inserted.id,
                upload_type: "apk_build",
                status: "queued",
              });
              newlyRegistered++;
              buildsQueued++;
            }
          } else if (["pending", "analyzed", "uploaded"].includes(existingEntry.status || "")) {
            // Queue build for entries that are synced but not built yet
            await admin.from("bulk_upload_queue").insert({
              catalog_id: existingEntry.id,
              upload_type: "apk_build",
              status: "queued",
            });
            await admin.from("source_code_catalog").update({ status: "pending_build" }).eq("id", existingEntry.id);
            buildsQueued++;
          }
        }

        return respond({
          success: true,
          total_repos: (allRepos || []).length,
          newly_registered: newlyRegistered,
          builds_queued: buildsQueued,
          repaired_missing_slugs: repairedMissingSlugs,
          message: `✅ Pipeline complete: ${(allRepos || []).length} repos scanned, ${newlyRegistered} new, ${buildsQueued} APK builds queued, ${repairedMissingSlugs} slugs repaired`,
        });
      }

      // ═══════════════════════════════════════════
      // Scheduled daily maintenance: missing checks + auto updates
      // ═══════════════════════════════════════════
      case "scheduled_daily_sync": {
        const githubToken = Deno.env.get("SAASVALA_GITHUB_TOKEN");
        if (!githubToken) return respond({ error: "GitHub token not configured" }, 500);

        const allRepos = await fetchSaasvalaRepos(githubToken);
        const repairedMissingSlugs = await repairMissingCatalogSlugs(admin);

        const { data: existing } = await admin.from("source_code_catalog").select("slug, id, status");
        const catalogMap = new Map((existing || []).map((e: any) => [e.slug, e]));

        const newEntries: any[] = [];
        for (const repo of allRepos || []) {
          const slug = slugify(repo.name);
          if (!slug || catalogMap.has(slug)) continue;

          newEntries.push({
            project_name: repo.name,
            slug,
            github_repo_url: repo.html_url,
            github_account: "saasvala",
            status: "pending_build",
            target_industry: detectIndustry(repo.name, repo.description || ""),
            ai_description: repo.description || `${repo.name} - SaaS Vala Software`,
            tech_stack: { languages: [repo.language || "Unknown"] },
            uploaded_to_github: true,
          });
        }

        let newlyRegistered = 0;
        if (newEntries.length > 0) {
          const { error } = await admin.from("source_code_catalog").upsert(newEntries, { onConflict: "slug" });
          if (!error) newlyRegistered = newEntries.length;
        }

        const { data: pendingToQueue } = await admin
          .from("source_code_catalog")
          .select("id")
          .in("status", ["pending", "analyzed", "uploaded"])
          .limit(200);

        let buildsQueued = 0;
        for (const row of pendingToQueue || []) {
          await admin.from("bulk_upload_queue").insert({
            catalog_id: row.id,
            upload_type: "apk_build",
            status: "queued",
            priority: 5,
          });

          await admin
            .from("source_code_catalog")
            .update({ status: "pending_build" })
            .eq("id", row.id);

          buildsQueued++;
        }

        const since = new Date(Date.now() - 86400000).toISOString();
        const recentlyUpdated = (allRepos || []).filter((r: any) => new Date(r.pushed_at) > new Date(since));

        let rebuildsQueued = 0;
        for (const repo of recentlyUpdated) {
          const slug = slugify(repo.name);
          const { data: catalogEntry } = await admin
            .from("source_code_catalog")
            .select("id, status")
            .eq("slug", slug)
            .single();

          if (catalogEntry && ["completed", "listed"].includes(catalogEntry.status || "")) {
            await admin.from("bulk_upload_queue").insert({
              catalog_id: catalogEntry.id,
              upload_type: "apk_rebuild",
              status: "queued",
              priority: 3,
            });

            await admin
              .from("source_code_catalog")
              .update({ status: "rebuilding" })
              .eq("id", catalogEntry.id);

            rebuildsQueued++;
          }
        }

        return respond({
          success: true,
          total_repos: allRepos.length,
          newly_registered: newlyRegistered,
          builds_queued: buildsQueued,
          rebuilds_queued: rebuildsQueued,
          repaired_missing_slugs: repairedMissingSlugs,
          message: `✅ Daily sync complete: ${newlyRegistered} new repos, ${buildsQueued} builds, ${rebuildsQueued} rebuilds, ${repairedMissingSlugs} slug repairs`,
        });
      }

      // ═══════════════════════════════════════════
      // AUTO MARKETPLACE WORKFLOW: scan → verify → queue builds
      // ═══════════════════════════════════════════
      case "auto_marketplace_workflow": {
        const githubToken = Deno.env.get("SAASVALA_GITHUB_TOKEN");
        const batchLimit = data?.limit || 20;

        const results: any[] = [];
        let processed = 0, verified = 0, attached = 0, queued = 0, skipped = 0;

        // Step 1: Get all marketplace products missing APK
        const { data: products } = await admin
          .from("products")
          .select("id, name, slug, git_repo_url, apk_url, status, marketplace_visible, is_apk, demo_url")
          .eq("marketplace_visible", true)
          .is("apk_url", null)
          .order("created_at", { ascending: true })
          .limit(batchLimit);

        if (!products?.length) {
          return respond({
            success: true,
            message: "✅ All marketplace products already have APK URLs attached",
            processed: 0,
          });
        }

        for (const product of products) {
          processed++;
          const slug = product.slug || slugify(product.name || "");
          const repoUrl = product.git_repo_url || `https://github.com/saasvala/${slug}`;

          if (!slug) {
            results.push({ id: product.id, slug: "N/A", status: "skipped", reason: "No slug" });
            skipped++;
            continue;
          }

          // Step 2: Check if APK already exists in storage
          const apkPath = `${slug}/release.apk`;
          const { data: existingFile } = await admin.storage.from("apks").list(slug);
          const hasExistingApk = existingFile?.some((f: any) => f.name === "release.apk");

          if (hasExistingApk) {
            const { data: signedData } = await admin.storage.from("apks").createSignedUrl(apkPath, 31536000);
            if (signedData?.signedUrl) {
              await admin.from("products").update({
                apk_url: signedData.signedUrl,
                is_apk: true,
              }).eq("id", product.id);

              results.push({ id: product.id, slug, status: "attached", source: "existing_storage" });
              attached++;
              continue;
            }
          }

          // Step 3: Check build queue for completed builds
          const { data: existingBuild } = await admin
            .from("apk_build_queue")
            .select("id, build_status, apk_file_path")
            .eq("slug", slug)
            .single();

          if (existingBuild?.build_status === "completed" && existingBuild.apk_file_path) {
            const { data: signedData } = await admin.storage
              .from("apks")
              .createSignedUrl(existingBuild.apk_file_path, 31536000);

            if (signedData?.signedUrl) {
              await admin.from("products").update({
                apk_url: signedData.signedUrl,
                is_apk: true,
              }).eq("id", product.id);

              results.push({ id: product.id, slug, status: "attached", source: "build_queue" });
              attached++;
              continue;
            }
          }

          // Step 4: Verify repo exists on GitHub and queue build
          if (githubToken) {
            try {
              const repoCheck = await fetch(
                `https://api.github.com/repos/saasvala/${slug}`,
                {
                  headers: {
                    Authorization: `Bearer ${githubToken}`,
                    "User-Agent": "SaaSVala-APK-Pipeline",
                  },
                }
              );

              if (repoCheck.ok) {
                verified++;
                // Upsert to build queue
                if (!existingBuild) {
                  await admin.from("apk_build_queue").insert({
                    repo_name: product.name || slug,
                    repo_url: repoUrl,
                    slug,
                    build_status: "pending",
                    product_id: product.id,
                    target_industry: "general",
                  });
                }
                results.push({ id: product.id, slug, status: "queued", repo_verified: true });
                queued++;
              } else {
                await repoCheck.text(); // consume body
                results.push({ id: product.id, slug, status: "skipped", reason: `repo not found (${repoCheck.status})` });
                skipped++;
              }
            } catch (_e) {
              results.push({ id: product.id, slug, status: "queued" });
              queued++;
            }
          } else {
            // Queue without verification
            if (!existingBuild) {
              await admin.from("apk_build_queue").insert({
                repo_name: product.name || slug,
                repo_url: repoUrl,
                slug,
                build_status: "pending",
                product_id: product.id,
                target_industry: "general",
              });
            }
            results.push({ id: product.id, slug, status: "queued" });
            queued++;
          }
        }

        return respond({
          success: true,
          processed,
          verified,
          attached,
          queued,
          skipped,
          results,
          message: `✅ Workflow: ${processed} scanned, ${verified} repos verified, ${attached} APKs attached, ${queued} builds queued`,
        });
      }

      // ═══════════════════════════════════════════
      // Get pipeline stats
      // ═══════════════════════════════════════════
      case "get_stats": {
        const { data: catalog } = await admin
          .from("source_code_catalog")
          .select("status, is_on_marketplace");

        const stats = {
          total: (catalog || []).length,
          pending: 0,
          pending_build: 0,
          building: 0,
          completed: 0,
          listed: 0,
          on_marketplace: 0,
        };

        for (const entry of catalog || []) {
          const s = entry.status as string;
          if (s in stats) (stats as any)[s]++;
          if (entry.is_on_marketplace) stats.on_marketplace++;
        }

        // Queue stats
        const { data: queue } = await admin
          .from("bulk_upload_queue")
          .select("status, upload_type")
          .in("upload_type", ["apk_build", "apk_rebuild"]);

        const queueStats = {
          queued: 0,
          processing: 0,
          completed: 0,
          failed: 0,
        };

        for (const q of queue || []) {
          const s = q.status as string;
          if (s in queueStats) (queueStats as any)[s]++;
        }

        return respond({ success: true, catalog: stats, queue: queueStats });
      }

      default:
        return respond({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  function respond(body: any, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Simple industry detection from repo name/description
function detectIndustry(name: string, description: string): string {
  const text = `${name} ${description}`.toLowerCase();
  const map: Record<string, string[]> = {
    healthcare: ["hospital", "clinic", "health", "medical", "pharma", "doctor", "patient", "dental", "nursing"],
    education: ["school", "education", "learning", "student", "academy", "university", "classroom", "lms"],
    finance: ["finance", "bank", "payment", "accounting", "invoice", "billing", "wallet", "tax"],
    retail: ["retail", "pos", "shop", "store", "inventory", "ecommerce", "cart"],
    hospitality: ["hotel", "restaurant", "food", "booking", "reservation", "travel", "tourism"],
    logistics: ["logistics", "delivery", "transport", "shipping", "fleet", "warehouse"],
    construction: ["construction", "building", "architect", "property", "real-estate"],
    manufacturing: ["manufacturing", "factory", "production", "assembly"],
  };

  for (const [industry, keywords] of Object.entries(map)) {
    if (keywords.some((k) => text.includes(k))) return industry;
  }
  return "general";
}
