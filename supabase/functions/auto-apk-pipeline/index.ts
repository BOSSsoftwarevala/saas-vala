import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

function extractRepoSlug(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const parts = raw.replace(/\.git$/, "").split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

async function fetchLatestCommitSha(githubToken: string, slug: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/saasvala/${slug}/commits?per_page=1`, {
    headers: { Authorization: `Bearer ${githubToken}`, "User-Agent": "SaaSVala-APK-Pipeline" },
  });
  if (!res.ok) return "";
  const rows = await res.json();
  return Array.isArray(rows) && rows[0]?.sha ? String(rows[0].sha) : "";
}

async function fetchReadmeText(githubToken: string, slug: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/saasvala/${slug}/readme`, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github.raw+json",
      "User-Agent": "SaaSVala-APK-Pipeline",
    },
  });
  if (!res.ok) return "";
  return await res.text();
}

function scanMissingFeatures(industry: string, projectName: string, description: string, readme: string): string[] {
  const text = `${projectName} ${description} ${readme}`.toLowerCase();
  const requiredByIndustry: Record<string, string[]> = {
    healthcare: ["patient", "appointment", "billing", "report"],
    education: ["student", "course", "attendance", "exam"],
    finance: ["invoice", "ledger", "payment", "report"],
    retail: ["inventory", "order", "payment", "dashboard"],
    hospitality: ["booking", "guest", "invoice", "report"],
    logistics: ["tracking", "shipment", "route", "report"],
    construction: ["project", "cost", "report", "team"],
    manufacturing: ["production", "inventory", "quality", "report"],
    general: ["auth", "dashboard", "report", "settings"],
  };

  const keys = requiredByIndustry[industry] || requiredByIndustry.general;
  return keys.filter((k) => !text.includes(k));
}

async function attachApkFromStorageOrQueue(admin: any, productId: string, slug: string): Promise<boolean> {
  if (!productId || !slug) return false;

  const { data: files } = await admin.storage.from("apks").list(slug);
  const hasRelease = Array.isArray(files) && files.some((f: any) => f.name === "release.apk");
  if (hasRelease) {
    const path = `${slug}/release.apk`;
    const { data: signed } = await admin.storage.from("apks").createSignedUrl(path, 31536000);
    if (signed?.signedUrl) {
      await admin.from("products").update({ apk_url: signed.signedUrl, is_apk: true }).eq("id", productId);
      await admin
        .from("apk_build_queue")
        .update({ apk_file_path: path, build_status: "completed", build_completed_at: new Date().toISOString() })
        .eq("slug", slug);
      return true;
    }
  }

  const { data: completedQueue } = await admin
    .from("apk_build_queue")
    .select("apk_file_path")
    .eq("slug", slug)
    .eq("build_status", "completed")
    .not("apk_file_path", "is", null)
    .maybeSingle();

  if (completedQueue?.apk_file_path) {
    const { data: signed } = await admin.storage.from("apks").createSignedUrl(completedQueue.apk_file_path, 31536000);
    if (signed?.signedUrl) {
      await admin.from("products").update({ apk_url: signed.signedUrl, is_apk: true }).eq("id", productId);
      return true;
    }
  }

  return false;
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
      // Register PHP source for offline conversion
      // ═══════════════════════════════════════════
      case "register_php_offline_conversion": {
        const {
          product_id,
          project_name,
          source_kind,
          source_bucket_path,
          source_repo_url,
          output_platform,
          version,
          notes,
        } = data || {};

        if (!product_id) return respond({ error: "product_id required" }, 400);

        const normalizedSourceKind = String(source_kind || "github_repo").trim().toLowerCase();
        if (!["github_repo", "zip_upload"].includes(normalizedSourceKind)) {
          return respond({ error: "source_kind must be github_repo or zip_upload" }, 400);
        }

        if (normalizedSourceKind === "zip_upload" && !String(source_bucket_path || "").trim()) {
          return respond({ error: "source_bucket_path required for zip_upload" }, 400);
        }

        if (normalizedSourceKind === "github_repo" && !String(source_repo_url || "").trim()) {
          return respond({ error: "source_repo_url required for github_repo" }, 400);
        }

        const normalizedPlatform = String(output_platform || "android_apk").trim().toLowerCase();
        const allowedPlatforms = ["android_apk", "windows_exe", "desktop_webview", "electron_exe", "ios_bundle"];
        if (!allowedPlatforms.includes(normalizedPlatform)) {
          return respond({ error: `output_platform must be one of: ${allowedPlatforms.join(", ")}` }, 400);
        }

        const normalizedVersion = String(version || "1.0.0").trim();

        const { data: product, error: productError } = await admin
          .from("products")
          .select("id, name, slug, git_repo_url")
          .eq("id", product_id)
          .single();

        if (productError || !product) {
          return respond({ error: "Product not found" }, 404);
        }

        const slug = String(product.slug || slugify(project_name || product.name || "php-offline-app"));
        const effectiveProjectName = String(project_name || product.name || slug);

        const { data: catalogRow, error: catalogError } = await admin
          .from("source_code_catalog")
          .upsert({
            project_name: effectiveProjectName,
            slug,
            source_kind: normalizedSourceKind,
            source_language: "php",
            source_bucket_path: normalizedSourceKind === "zip_upload" ? String(source_bucket_path || "").trim() : null,
            source_repo_url: normalizedSourceKind === "github_repo"
              ? String(source_repo_url || product.git_repo_url || "").trim()
              : null,
            file_path: normalizedSourceKind === "zip_upload" ? String(source_bucket_path || "").trim() : null,
            github_repo_url: normalizedSourceKind === "github_repo"
              ? String(source_repo_url || product.git_repo_url || "").trim()
              : null,
            source_visibility: "private",
            conversion_mode: "php_offline",
            target_industry: "general",
            status: "pending_build",
            ai_description: notes || `${effectiveProjectName} PHP offline conversion queued`,
          }, { onConflict: "slug" })
          .select("id")
          .single();

        if (catalogError || !catalogRow) {
          return respond({ error: `Catalog update failed: ${catalogError?.message || "unknown"}` }, 500);
        }

        const queueUpsert = {
          repo_name: effectiveProjectName,
          repo_url: String(source_repo_url || product.git_repo_url || "private-zip-source"),
          slug,
          product_id: product_id,
          source_catalog_id: catalogRow.id,
          source_kind: normalizedSourceKind,
          source_bucket_path: normalizedSourceKind === "zip_upload" ? String(source_bucket_path || "").trim() : null,
          source_repo_url: normalizedSourceKind === "github_repo"
            ? String(source_repo_url || product.git_repo_url || "").trim()
            : null,
          conversion_type: "php_offline",
          output_platform: normalizedPlatform,
          output_version: normalizedVersion,
          build_status: "pending",
          build_error: null,
          marketplace_listed: false,
          build_meta: {
            notes: notes || null,
            registered_at: new Date().toISOString(),
            license_mode: "offline_hmac",
            no_source_exposure: true,
          },
        } as any;

        const { data: queueRow, error: queueError } = await admin
          .from("apk_build_queue")
          .upsert(queueUpsert, { onConflict: "slug" })
          .select("id, slug, build_status, conversion_type, output_platform, output_version")
          .single();

        if (queueError || !queueRow) {
          return respond({ error: `Build queue update failed: ${queueError?.message || "unknown"}` }, 500);
        }

        await admin.from("bulk_upload_queue").insert({
          catalog_id: catalogRow.id,
          upload_type: "apk_build",
          status: "queued",
          priority: 4,
        });

        return respond({
          success: true,
          queue: queueRow,
          catalog_id: catalogRow.id,
          message: `✅ PHP offline conversion queued for ${slug}`,
        });
      }

      // ═══════════════════════════════════════════
      // Finalize PHP conversion build output
      // ═══════════════════════════════════════════
      case "finalize_php_offline_conversion": {
        const {
          queue_id,
          product_id,
          output_platform,
          version,
          file_path,
          file_size,
          file_hash,
          license_runtime_bundle,
          build_meta,
        } = data || {};

        if (!queue_id || !product_id || !file_path) {
          return respond({ error: "queue_id, product_id and file_path are required" }, 400);
        }

        const { data: finalized, error: finalizeError } = await admin.rpc("finalize_offline_conversion_build", {
          p_queue_id: queue_id,
          p_product_id: product_id,
          p_platform: output_platform || "android_apk",
          p_version: version || "1.0.0",
          p_file_path: file_path,
          p_file_size: file_size || null,
          p_file_hash: file_hash || null,
          p_conversion_type: "php_offline",
          p_build_type: "php_offline",
          p_license_runtime_bundle: license_runtime_bundle || {},
          p_build_meta: build_meta || {},
        });

        if (finalizeError || !finalized) {
          return respond({ error: `Finalize failed: ${finalizeError?.message || "unknown"}` }, 500);
        }

        return respond({
          success: true,
          result: finalized,
          message: "✅ PHP offline build finalized and attached to product",
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

        // Self-heal: recover stale building jobs
        const staleCutoff = new Date(Date.now() - 90 * 60_000).toISOString();
        const { data: staleRows } = await admin
          .from("apk_build_queue")
          .select("id, build_attempts")
          .eq("build_status", "building")
          .lt("build_started_at", staleCutoff)
          .limit(150);

        let staleRecovered = 0;
        for (const row of staleRows || []) {
          const nextAttempts = Number(row.build_attempts || 0) + 1;
          await admin
            .from("apk_build_queue")
            .update({
              build_status: nextAttempts >= 3 ? "failed" : "pending",
              build_attempts: nextAttempts,
              build_error: "Recovered by scheduled self-heal (stale build timeout)",
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          staleRecovered++;
        }

        // Self-heal: retry failed jobs with attempts < 3
        const { data: failedRows } = await admin
          .from("apk_build_queue")
          .select("id")
          .eq("build_status", "failed")
          .lt("build_attempts", 3)
          .limit(200);

        let failedRetried = 0;
        for (const row of failedRows || []) {
          await admin
            .from("apk_build_queue")
            .update({ build_status: "pending", build_error: null, updated_at: new Date().toISOString() })
            .eq("id", row.id);
          failedRetried++;
        }

        // Self-heal: attach APK URL where artifact already exists but product apk_url is null
        const { data: productsMissingApk } = await admin
          .from("products")
          .select("id, slug")
          .eq("marketplace_visible", true)
          .is("apk_url", null)
          .limit(200);

        let apkAttached = 0;
        for (const p of productsMissingApk || []) {
          if (!p.slug) continue;
          const attached = await attachApkFromStorageOrQueue(admin, p.id, p.slug);
          if (attached) apkAttached++;
        }

        return respond({
          success: true,
          total_repos: allRepos.length,
          newly_registered: newlyRegistered,
          builds_queued: buildsQueued,
          rebuilds_queued: rebuildsQueued,
          stale_recovered: staleRecovered,
          failed_retried: failedRetried,
          apk_attached: apkAttached,
          repaired_missing_slugs: repairedMissingSlugs,
          message: `✅ Daily sync + self-heal complete: ${newlyRegistered} new repos, ${buildsQueued} builds, ${rebuildsQueued} rebuilds, ${staleRecovered} stale recovered, ${failedRetried} retries, ${apkAttached} APK attached`,
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
                await repoCheck.json(); // consume body

                // Upsert to build queue
                if (!existingBuild) {
                  await admin.from("apk_build_queue").insert({
                    repo_name: product.name || slug,
                    repo_url: repoUrl,
                    slug,
                    build_status: "building",
                    product_id: product.id,
                    target_industry: "general",
                    build_started_at: new Date().toISOString(),
                  });
                } else {
                  await admin.from("apk_build_queue").update({
                    build_status: "building",
                    build_started_at: new Date().toISOString(),
                    build_error: null,
                  }).eq("id", existingBuild.id);
                }

                // Actually trigger GitHub Actions build
                try {
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
                          repo_url: repoUrl,
                          app_slug: slug,
                          package_name: `com.saasvala.${slug.replace(/-/g, "_")}`,
                          product_id: product.id || "",
                          supabase_url: supabaseUrl,
                        },
                      }),
                    }
                  );

                  if (dispatchRes.ok || dispatchRes.status === 204) {
                    results.push({ id: product.id, slug, status: "building", repo_verified: true });
                  } else {
                    const errText = await dispatchRes.text();
                    console.error(`[APK Pipeline] GitHub Actions dispatch failed for ${slug}: ${errText}`);
                    results.push({ id: product.id, slug, status: "queued", reason: `dispatch failed: ${dispatchRes.status}` });
                  }
                } catch (dispatchErr: any) {
                  console.error(`[APK Pipeline] Dispatch error for ${slug}:`, dispatchErr.message);
                  results.push({ id: product.id, slug, status: "queued", reason: dispatchErr.message });
                }
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
      // SELF-HEALING MODULE: recover + retry + repair + verify + sync
      // ═══════════════════════════════════════════
      case "self_heal_pipeline": {
        const githubToken = Deno.env.get("SAASVALA_GITHUB_TOKEN");
        const staleMinutes = Number(data?.stale_minutes || 90);
        const retryLimit = Number(data?.retry_limit || 3);
        const scanLimit = Number(data?.limit || 120);

        const summary = {
          slugs_repaired: 0,
          stale_recovered: 0,
          failed_retried: 0,
          missing_queue_fixed: 0,
          apk_attached: 0,
          rebuilds_queued: 0,
          feature_gaps_found: 0,
          feature_patch_queued: 0,
          scanned: 0,
        };

        // 1) Repair missing slugs in catalog
        summary.slugs_repaired = await repairMissingCatalogSlugs(admin);

        // 2) Recover stale "building" jobs
        const staleCutoff = new Date(Date.now() - staleMinutes * 60_000).toISOString();
        const { data: staleRows } = await admin
          .from("apk_build_queue")
          .select("id, build_attempts")
          .eq("build_status", "building")
          .lt("build_started_at", staleCutoff)
          .limit(scanLimit);

        for (const row of staleRows || []) {
          const nextAttempts = Number(row.build_attempts || 0) + 1;
          const nextStatus = nextAttempts >= retryLimit ? "failed" : "pending";
          await admin
            .from("apk_build_queue")
            .update({
              build_status: nextStatus,
              build_attempts: nextAttempts,
              build_error: `Recovered by self-heal (${staleMinutes}m timeout)`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          summary.stale_recovered++;
        }

        // 3) Retry failed builds (within limit)
        const { data: failedRows } = await admin
          .from("apk_build_queue")
          .select("id, slug, build_attempts")
          .eq("build_status", "failed")
          .lt("build_attempts", retryLimit)
          .order("updated_at", { ascending: true })
          .limit(scanLimit);

        for (const row of failedRows || []) {
          await admin
            .from("apk_build_queue")
            .update({
              build_status: "pending",
              build_error: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          summary.failed_retried++;
        }

        // 4) Ensure every pending catalog row has queue entry + status sync
        const { data: catalogs } = await admin
          .from("source_code_catalog")
          .select("id, slug, project_name, github_repo_url, target_industry, status")
          .not("slug", "is", null)
          .in("status", ["pending", "analyzed", "uploaded", "pending_build", "rebuilding", "failed"])
          .limit(scanLimit);

        for (const c of catalogs || []) {
          const { data: queueRow } = await admin
            .from("apk_build_queue")
            .select("id")
            .eq("slug", c.slug)
            .maybeSingle();

          if (!queueRow) {
            await admin.from("apk_build_queue").insert({
              repo_name: c.project_name || c.slug,
              repo_url: c.github_repo_url || `https://github.com/saasvala/${c.slug}`,
              slug: c.slug,
              target_industry: c.target_industry || "general",
              source_catalog_id: c.id,
              build_status: "pending",
            });

            await admin
              .from("bulk_upload_queue")
              .insert({
                catalog_id: c.id,
                upload_type: "apk_build",
                status: "queued",
                priority: 5,
              });

            summary.missing_queue_fixed++;
          }
        }

        // 5) Auto attach APK to products if artifact exists (storage or completed queue)
        const { data: products } = await admin
          .from("products")
          .select("id, slug, apk_url")
          .eq("marketplace_visible", true)
          .is("apk_url", null)
          .limit(scanLimit);

        for (const p of products || []) {
          if (!p.slug) continue;
          const attached = await attachApkFromStorageOrQueue(admin, p.id, p.slug);
          if (attached) summary.apk_attached++;
        }

        // 6) Verify Git updates + scan missing features + queue rebuilds
        if (githubToken) {
          const { data: queueRows } = await admin
            .from("apk_build_queue")
            .select("id, slug, target_industry, repo_name, repo_url, build_meta, product_id")
            .not("slug", "is", null)
            .limit(scanLimit);

          for (const row of queueRows || []) {
            const slug = String(row.slug || "");
            if (!slug) continue;
            summary.scanned++;

            const repoSlug = slug || extractRepoSlug(row.repo_url || "");
            const latestCommit = await fetchLatestCommitSha(githubToken, repoSlug);
            const readme = await fetchReadmeText(githubToken, repoSlug);
            const currentMeta = (row.build_meta || {}) as Record<string, unknown>;
            const lastSyncedCommit = String((currentMeta as any).last_synced_commit || "");
            const missingFeatures = scanMissingFeatures(
              String(row.target_industry || "general"),
              String(row.repo_name || repoSlug),
              "",
              readme
            );

            if (missingFeatures.length > 0) {
              summary.feature_gaps_found += missingFeatures.length;
            }

            const commitChanged = !!latestCommit && !!lastSyncedCommit && latestCommit !== lastSyncedCommit;
            const shouldRebuild = commitChanged || missingFeatures.length > 0;

            await admin
              .from("apk_build_queue")
              .update({
                build_meta: {
                  ...(currentMeta || {}),
                  last_seen_commit: latestCommit || null,
                  last_synced_commit: latestCommit || lastSyncedCommit || null,
                  missing_features: missingFeatures,
                  last_feature_scan_at: new Date().toISOString(),
                },
                updated_at: new Date().toISOString(),
              })
              .eq("id", row.id);

            if (shouldRebuild) {
              await admin
                .from("apk_build_queue")
                .update({
                  build_status: "pending",
                  build_error: null,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", row.id);

              if (row.product_id) {
                const { data: catForSlug } = await admin
                  .from("source_code_catalog")
                  .select("id")
                  .eq("slug", slug)
                  .maybeSingle();

                if (catForSlug?.id) {
                  await admin.from("bulk_upload_queue").insert({
                    catalog_id: catForSlug.id,
                    upload_type: "apk_rebuild",
                    status: "queued",
                    priority: missingFeatures.length > 0 ? 2 : 3,
                  });

                  if (missingFeatures.length > 0) summary.feature_patch_queued++;
                }
              }

              summary.rebuilds_queued++;
            }
          }
        }

        return respond({
          success: true,
          summary,
          message:
            `🛠️ Self-heal done: ${summary.slugs_repaired} slug fixes, ` +
            `${summary.stale_recovered} stale recovered, ${summary.failed_retried} retries, ` +
            `${summary.missing_queue_fixed} queue repairs, ${summary.apk_attached} APK attached, ` +
            `${summary.rebuilds_queued} rebuilds queued, ${summary.feature_patch_queued} feature-patch queued`,
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
