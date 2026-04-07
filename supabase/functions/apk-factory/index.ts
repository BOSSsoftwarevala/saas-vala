import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function respond(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();
    const githubToken = Deno.env.get("SAASVALA_GITHUB_TOKEN")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!githubToken) {
      return respond({ error: "GitHub token not configured" }, 500);
    }

    const gh = (path: string, options: RequestInit = {}) =>
      fetch(`https://api.github.com${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${githubToken}`,
          "User-Agent": "SaaSVala-APK-Factory",
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });

    switch (action) {
      // ═══════════════════════════════════════
      // Setup: Create apk-factory repo + workflow
      // ═══════════════════════════════════════
      case "setup_factory": {
        const repoCheck = await gh("/repos/saasvala/apk-factory");

        if (repoCheck.status === 404) {
          const createRes = await gh("/user/repos", {
            method: "POST",
            body: JSON.stringify({
              name: "apk-factory",
              description: "Automated APK build factory using GitHub Actions - Software Vala",
              private: false,
              auto_init: true,
            }),
          });

          if (!createRes.ok) {
            const err = await createRes.text();
            return respond({ error: `Failed to create repo: ${err}` }, 500);
          }
          await createRes.json();
          await new Promise((r) => setTimeout(r, 3000));
        } else {
          await repoCheck.json();
        }

        // Create the GitHub Actions workflow
        const workflowContent = generateWorkflowYaml(supabaseUrl, supabaseAnonKey, serviceKey);
        const encodedContent = btoa(unescape(encodeURIComponent(workflowContent)));

        const workflowCheck = await gh(
          "/repos/saasvala/apk-factory/contents/.github/workflows/build-apk.yml"
        );

        const workflowBody: any = {
          message: "Update APK build workflow v2 - with Supabase upload",
          content: encodedContent,
        };

        if (workflowCheck.ok) {
          const existing = await workflowCheck.json();
          workflowBody.sha = existing.sha;
        } else {
          await workflowCheck.text();
        }

        const putRes = await gh(
          "/repos/saasvala/apk-factory/contents/.github/workflows/build-apk.yml",
          { method: "PUT", body: JSON.stringify(workflowBody) }
        );

        if (!putRes.ok) {
          const err = await putRes.text();
          return respond({ error: `Failed to create workflow: ${err}` }, 500);
        }
        await putRes.json();

        return respond({
          success: true,
          message: "✅ APK Factory repo updated with v2 workflow (includes Supabase storage upload)",
          repo_url: "https://github.com/saasvala/apk-factory",
        });
      }

      // ═══════════════════════════════════════
      // Trigger: Dispatch APK build for a repo
      // ═══════════════════════════════════════
      case "trigger_build": {
        const { slug, repo_url, product_id } = data || {};
        if (!slug) return respond({ error: "slug required" }, 400);

        const targetRepo = repo_url || `https://github.com/saasvala/${slug}`;

        // Verify repo exists first
        const repoCheck = await gh(`/repos/saasvala/${slug}`);
        if (!repoCheck.ok) {
          await repoCheck.text();
          return respond({ 
            success: false, 
            slug, 
            status: "repo_not_found",
            message: `Repo saasvala/${slug} not found` 
          });
        }
        await repoCheck.json();

        const dispatchRes = await gh(
          "/repos/saasvala/apk-factory/actions/workflows/build-apk.yml/dispatches",
          {
            method: "POST",
            body: JSON.stringify({
              ref: "main",
              inputs: {
                repo_url: targetRepo,
                app_slug: slug,
                package_name: `com.saasvala.${slug.replace(/-/g, "_")}`,
                product_id: product_id || "",
                supabase_url: supabaseUrl,
              },
            }),
          }
        );

        if (!dispatchRes.ok && dispatchRes.status !== 204) {
          const err = await dispatchRes.text();
          return respond({ error: `Failed to trigger build: ${err}`, status: dispatchRes.status }, 500);
        }

        // Update build queue
        const admin = createClient(supabaseUrl, serviceKey);
        await admin.from("apk_build_queue").upsert(
          {
            repo_name: slug,
            repo_url: targetRepo,
            slug,
            build_status: "building",
            product_id: product_id || null,
            target_industry: "general",
            build_started_at: new Date().toISOString(),
            build_error: null,
          },
          { onConflict: "slug" }
        );

        return respond({
          success: true,
          slug,
          repo_url: targetRepo,
          status: "building",
          message: `🔧 APK build triggered via GitHub Actions for ${slug}`,
        });
      }

      // ═══════════════════════════════════════
      // Check build status
      // ═══════════════════════════════════════
      case "check_build_status": {
        const { slug } = data || {};

        const runsRes = await gh(
          `/repos/saasvala/apk-factory/actions/workflows/build-apk.yml/runs?per_page=20`
        );

        if (!runsRes.ok) {
          const err = await runsRes.text();
          return respond({ error: `Failed to check status: ${err}` }, 500);
        }

        const runsData = await runsRes.json();
        const runs = (runsData.workflow_runs || []).map((r: any) => ({
          id: r.id,
          status: r.status,
          conclusion: r.conclusion,
          created_at: r.created_at,
          updated_at: r.updated_at,
          display_title: r.display_title,
        }));

        let matchedRun = null;
        if (slug) {
          matchedRun = runs.find((r: any) => r.display_title?.includes(slug));
        }

        return respond({ success: true, runs, matched_run: matchedRun, total_runs: runsData.total_count });
      }

      // ═══════════════════════════════════════
      // Callback: APK build complete (called by GitHub Actions workflow)
      // ═══════════════════════════════════════
      case "build_complete": {
        const { slug: completeSlug, apk_path, status: buildStatus, error: buildError, product_id: pid } = data || {};
        if (!completeSlug) return respond({ error: "slug required" }, 400);

        const admin = createClient(supabaseUrl, serviceKey);

        if (buildStatus === "success" && apk_path) {
          // Update build queue
          await admin.from("apk_build_queue").update({
            build_status: "completed",
            apk_file_path: apk_path,
            build_completed_at: new Date().toISOString(),
            build_error: null,
            marketplace_listed: true,
          }).eq("slug", completeSlug);

          // Create signed URL (1 year) and attach to product
          const { data: signedData } = await admin.storage
            .from("apks")
            .createSignedUrl(apk_path, 31536000);

          if (signedData?.signedUrl) {
            // Update product by ID or by slug
            if (pid) {
              await admin.from("products").update({
                apk_url: signedData.signedUrl,
                is_apk: true,
                apk_enabled: true,
              }).eq("id", pid);
            }

            // Also try matching by slug
            await admin.from("products").update({
              apk_url: signedData.signedUrl,
              is_apk: true,
              apk_enabled: true,
            }).eq("slug", completeSlug);
          }

          // Update catalog
          await admin.from("source_code_catalog").update({ 
            status: "completed",
            is_on_marketplace: true,
          }).eq("slug", completeSlug);

          return respond({ success: true, message: `✅ APK for ${completeSlug} built and attached!`, apk_url: signedData?.signedUrl });
        } else {
          // Build failed
          await admin.from("apk_build_queue").update({
            build_status: "failed",
            build_error: buildError || "Build failed - check GitHub Actions logs",
            build_completed_at: new Date().toISOString(),
            build_attempts: 1,
          }).eq("slug", completeSlug);

          return respond({ success: false, message: `❌ APK build failed for ${completeSlug}: ${buildError}` });
        }
      }

      // ═══════════════════════════════════════
      // Bulk trigger: Build multiple repos at once
      // ═══════════════════════════════════════
      case "bulk_trigger": {
        const { slugs, limit } = data || {};
        const admin = createClient(supabaseUrl, serviceKey);

        let targetSlugs = slugs || [];
        
        if (!targetSlugs.length) {
          // Get pending builds from queue
          const { data: pending } = await admin
            .from("apk_build_queue")
            .select("slug, repo_url, product_id")
            .eq("build_status", "pending")
            .order("created_at", { ascending: true })
            .limit(limit || 5);

          targetSlugs = (pending || []).map((p: any) => ({
            slug: p.slug,
            repo_url: p.repo_url,
            product_id: p.product_id,
          }));
        }

        const results: any[] = [];
        let triggered = 0;

        for (const item of targetSlugs) {
          const slug = typeof item === "string" ? item : item.slug;
          const repoUrl = typeof item === "string" ? `https://github.com/saasvala/${item}` : item.repo_url;
          const productId = typeof item === "string" ? "" : item.product_id || "";

          try {
            const dispatchRes = await gh(
              "/repos/saasvala/apk-factory/actions/workflows/build-apk.yml/dispatches",
              {
                method: "POST",
                body: JSON.stringify({
                  ref: "main",
                  inputs: {
                    repo_url: repoUrl,
                    app_slug: slug,
                    package_name: `com.saasvala.${slug.replace(/-/g, "_")}`,
                    product_id: productId,
                    supabase_url: supabaseUrl,
                  },
                }),
              }
            );

            if (dispatchRes.ok || dispatchRes.status === 204) {
              await admin.from("apk_build_queue").update({
                build_status: "building",
                build_started_at: new Date().toISOString(),
                build_error: null,
              }).eq("slug", slug);

              results.push({ slug, status: "triggered" });
              triggered++;
            } else {
              const err = await dispatchRes.text();
              results.push({ slug, status: "failed", error: err });
            }

            // Rate limit: 1 dispatch per second
            await new Promise(r => setTimeout(r, 1500));
          } catch (e: any) {
            results.push({ slug, status: "error", error: e.message });
          }
        }

        return respond({
          success: true,
          triggered,
          total: targetSlugs.length,
          results,
          message: `🔧 ${triggered}/${targetSlugs.length} APK builds triggered`,
        });
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
});

function generateWorkflowYaml(supabaseUrl: string, supabaseAnonKey: string, serviceKey: string): string {
  return `name: Build APK
on:
  workflow_dispatch:
    inputs:
      repo_url:
        description: 'GitHub repo URL to build'
        required: true
      app_slug:
        description: 'App slug name'
        required: true
      package_name:
        description: 'Android package name'
        required: true
        default: 'com.saasvala.app'
      product_id:
        description: 'Product ID in database'
        required: false
        default: ''
      supabase_url:
        description: 'Supabase URL for callback'
        required: false
        default: '${supabaseUrl}'

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    
    steps:
      - name: Checkout factory
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup Java 17
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Clone target repo
        run: |
          git clone \${{ github.event.inputs.repo_url }} target-app
          cd target-app
          echo "=== Repo cloned: \${{ github.event.inputs.app_slug }} ==="
          ls -la

      - name: Install dependencies
        run: |
          cd target-app
          if [ -f "package.json" ]; then
            npm install --legacy-peer-deps 2>/dev/null || npm install --force 2>/dev/null || echo "Install completed with warnings"
          fi

      - name: Build web app
        run: |
          cd target-app
          if [ -f "package.json" ]; then
            # Try different build commands
            npm run build 2>/dev/null || npx vite build 2>/dev/null || echo "No build step needed"
          fi
          
          # Ensure a web output directory exists
          if [ -d "dist" ]; then
            WEB_DIR="dist"
          elif [ -d "build" ]; then
            WEB_DIR="build"
          elif [ -d "public" ]; then
            WEB_DIR="public"
          else
            mkdir -p dist
            echo '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'\${{ github.event.inputs.app_slug }}'</title></head><body><div id="app"><h1>'\${{ github.event.inputs.app_slug }}'</h1><p>Powered by Software Vala</p></div></body></html>' > dist/index.html
            WEB_DIR="dist"
          fi
          echo "WEB_DIR=$WEB_DIR" >> $GITHUB_ENV

      - name: Setup Capacitor & Android
        run: |
          cd target-app
          WEB_DIR=\${{ env.WEB_DIR || 'dist' }}
          
          npm install @capacitor/core @capacitor/cli @capacitor/android --legacy-peer-deps 2>/dev/null || npm install @capacitor/core @capacitor/cli @capacitor/android --force
          
          # Create capacitor config
          cat > capacitor.config.json << CAPEOF
          {
            "appId": "\${{ github.event.inputs.package_name }}",
            "appName": "\${{ github.event.inputs.app_slug }}",
            "webDir": "$WEB_DIR",
            "server": {
              "androidScheme": "https"
            }
          }
          CAPEOF
          
          npx cap add android 2>/dev/null || echo "Android platform may already exist"
          npx cap sync

      - name: Build debug APK
        run: |
          cd target-app/android
          chmod +x gradlew
          ./gradlew assembleDebug --no-daemon --stacktrace
          
          APK_PATH=$(find . -name "*.apk" -type f | head -1)
          if [ -n "$APK_PATH" ]; then
            mkdir -p /tmp/apk-output
            cp "$APK_PATH" "/tmp/apk-output/\${{ github.event.inputs.app_slug }}.apk"
            APK_SIZE=$(stat -f%z "$APK_PATH" 2>/dev/null || stat -c%s "$APK_PATH" 2>/dev/null || echo "unknown")
            echo "APK_BUILT=true" >> $GITHUB_ENV
            echo "APK_SIZE=$APK_SIZE" >> $GITHUB_ENV
            echo "✅ APK built successfully: $APK_SIZE bytes"
          else
            echo "APK_BUILT=false" >> $GITHUB_ENV
            echo "❌ No APK found after build"
            exit 1
          fi

      - name: Upload APK to Supabase Storage
        if: env.APK_BUILT == 'true'
        run: |
          APK_FILE="/tmp/apk-output/\${{ github.event.inputs.app_slug }}.apk"
          STORAGE_PATH="\${{ github.event.inputs.app_slug }}/release.apk"
          SUPABASE_URL="\${{ github.event.inputs.supabase_url || '${supabaseUrl}' }}"
          
          echo "Uploading APK to Supabase Storage..."
          
          HTTP_STATUS=$(curl -s -o /tmp/upload-response.txt -w "%{http_code}" \\
            -X POST "$SUPABASE_URL/storage/v1/object/apks/$STORAGE_PATH" \\
            -H "Authorization: Bearer ${serviceKey}" \\
            -H "Content-Type: application/vnd.android.package-archive" \\
            -H "x-upsert: true" \\
            --data-binary @"$APK_FILE")
          
          echo "Upload status: $HTTP_STATUS"
          cat /tmp/upload-response.txt
          
          if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
            echo "UPLOAD_OK=true" >> $GITHUB_ENV
            echo "✅ APK uploaded to storage: $STORAGE_PATH"
          else
            echo "UPLOAD_OK=false" >> $GITHUB_ENV
            echo "⚠️ Upload returned $HTTP_STATUS, will retry..."
            
            # Retry once
            sleep 2
            HTTP_STATUS2=$(curl -s -o /dev/null -w "%{http_code}" \\
              -X POST "$SUPABASE_URL/storage/v1/object/apks/$STORAGE_PATH" \\
              -H "Authorization: Bearer ${serviceKey}" \\
              -H "Content-Type: application/vnd.android.package-archive" \\
              -H "x-upsert: true" \\
              --data-binary @"$APK_FILE")
            
            if [ "$HTTP_STATUS2" = "200" ] || [ "$HTTP_STATUS2" = "201" ]; then
              echo "UPLOAD_OK=true" >> $GITHUB_ENV
              echo "✅ APK uploaded on retry"
            fi
          fi

      - name: Upload as GitHub Artifact (backup)
        if: env.APK_BUILT == 'true'
        uses: actions/upload-artifact@v4
        with:
          name: \${{ github.event.inputs.app_slug }}-apk
          path: /tmp/apk-output/\${{ github.event.inputs.app_slug }}.apk
          retention-days: 30

      - name: Notify build complete
        if: always()
        run: |
          SUPABASE_URL="\${{ github.event.inputs.supabase_url || '${supabaseUrl}' }}"
          
          if [ "\${{ env.APK_BUILT }}" = "true" ]; then
            BUILD_STATUS="success"
          else
            BUILD_STATUS="failed"
          fi
          
          curl -s -X POST "$SUPABASE_URL/functions/v1/apk-factory" \\
            -H "Content-Type: application/json" \\
            -H "Authorization: Bearer ${supabaseAnonKey}" \\
            -d '{
              "action": "build_complete",
              "data": {
                "slug": "'\${{ github.event.inputs.app_slug }}'",
                "status": "'$BUILD_STATUS'",
                "product_id": "'\${{ github.event.inputs.product_id }}'",
                "apk_path": "'\${{ github.event.inputs.app_slug }}'/release.apk",
                "error": ""
              }
            }' || echo "Callback failed but APK was built"
          
          echo "Build callback sent with status: $BUILD_STATUS"
`;
}
