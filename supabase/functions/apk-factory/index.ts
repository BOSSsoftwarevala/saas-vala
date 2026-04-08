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
      // Setup: Create apk-factory repo + workflow + secrets
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

        // Step 1: Set GitHub repo secrets (so workflow never has hardcoded keys)
        const secretsToSet: Record<string, string> = {
          SUPABASE_URL: supabaseUrl,
          SUPABASE_SERVICE_ROLE_KEY: serviceKey,
          SUPABASE_ANON_KEY: supabaseAnonKey,
        };

        let secretsOk = 0;
        // Get repo public key for encryption
        const pubKeyRes = await gh("/repos/saasvala/apk-factory/actions/secrets/public-key");
        if (pubKeyRes.ok) {
          const pubKey = await pubKeyRes.json();

          for (const [name, value] of Object.entries(secretsToSet)) {
            try {
              const encrypted = await encryptSecret(value, pubKey.key);
              const setRes = await gh(`/repos/saasvala/apk-factory/actions/secrets/${name}`, {
                method: "PUT",
                body: JSON.stringify({
                  encrypted_value: encrypted,
                  key_id: pubKey.key_id,
                }),
              });
              if (setRes.ok || setRes.status === 201 || setRes.status === 204) {
                secretsOk++;
              }
              // consume body
              await setRes.text();
            } catch (e: any) {
              console.error(`Failed to set secret ${name}:`, e.message);
            }
          }
        } else {
          await pubKeyRes.text();
        }

        // Step 2: Create the workflow file (references secrets, not hardcoded values)
        const workflowContent = generateWorkflowYaml();
        const encodedContent = btoa(unescape(encodeURIComponent(workflowContent)));

        const workflowCheck = await gh(
          "/repos/saasvala/apk-factory/contents/.github/workflows/build-apk.yml"
        );

        const workflowBody: any = {
          message: "Update APK build workflow v3 - uses GitHub Secrets",
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
          secrets_configured: secretsOk,
          message: `✅ APK Factory v3 ready — ${secretsOk}/3 secrets configured, workflow updated`,
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
            if (pid) {
              await admin.from("products").update({
                apk_url: signedData.signedUrl,
                is_apk: true,
                apk_enabled: true,
              }).eq("id", pid);
            }

            await admin.from("products").update({
              apk_url: signedData.signedUrl,
              is_apk: true,
              apk_enabled: true,
            }).eq("slug", completeSlug);
          }

          await admin.from("source_code_catalog").update({ 
            status: "completed",
            is_on_marketplace: true,
          }).eq("slug", completeSlug);

          return respond({ success: true, message: `✅ APK for ${completeSlug} built and attached!`, apk_url: signedData?.signedUrl });
        } else {
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

// Encrypt a secret for GitHub Actions using libsodium sealed box
async function encryptSecret(secretValue: string, publicKeyB64: string): Promise<string> {
  // Decode the base64 public key
  const binaryKey = Uint8Array.from(atob(publicKeyB64), c => c.charCodeAt(0));
  const messageBytes = new TextEncoder().encode(secretValue);
  
  // Use libsodium via esm.sh
  const _sodium = await import("https://esm.sh/libsodium-wrappers@0.7.13");
  const sodium = _sodium.default || _sodium;
  await sodium.ready;
  
  const encrypted = sodium.crypto_box_seal(messageBytes, binaryKey);
  
  // Encode to base64
  return btoa(String.fromCharCode(...encrypted));
}

function generateWorkflowYaml(): string {
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
            npm install --legacy-peer-deps 2>/dev/null || npm install --force 2>/dev/null || echo "npm install done with warnings"
          fi

      - name: Build web app
        run: |
          cd target-app
          WEB_DIR="dist"
          if [ -f "package.json" ]; then
            npm run build 2>/dev/null || npx vite build 2>/dev/null || echo "No build step"
          fi
          if [ -d "dist" ]; then
            WEB_DIR="dist"
          elif [ -d "build" ]; then
            WEB_DIR="build"
          elif [ -d "public" ]; then
            WEB_DIR="public"
          else
            mkdir -p dist
            SLUG="\${{ github.event.inputs.app_slug }}"
            echo "<!DOCTYPE html><html><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>$SLUG</title></head><body><div id=app><h1>$SLUG</h1><p>Powered by Software Vala</p></div></body></html>" > dist/index.html
            WEB_DIR="dist"
          fi
          echo "WEB_DIR=$WEB_DIR" >> \$GITHUB_ENV

      - name: Setup Capacitor
        run: |
          cd target-app
          WEB_DIR="\${{ env.WEB_DIR }}"
          if [ -z "$WEB_DIR" ]; then WEB_DIR="dist"; fi
          
          npm install @capacitor/core@latest @capacitor/cli@latest @capacitor/android@latest --legacy-peer-deps 2>/dev/null || npm install @capacitor/core@latest @capacitor/cli@latest @capacitor/android@latest --force
          
          cat > capacitor.config.json << EOF
          {
            "appId": "\${{ github.event.inputs.package_name }}",
            "appName": "\${{ github.event.inputs.app_slug }}",
            "webDir": "$WEB_DIR",
            "server": { "androidScheme": "https" }
          }
          EOF
          
          npx cap add android 2>/dev/null || true
          npx cap sync android

      - name: Build APK
        run: |
          cd target-app/android
          chmod +x gradlew
          ./gradlew assembleDebug --no-daemon --stacktrace 2>&1 | tail -50
          
          APK_FILE=$(find . -name "*.apk" -type f | head -1)
          if [ -n "$APK_FILE" ]; then
            mkdir -p /tmp/apk-out
            cp "$APK_FILE" "/tmp/apk-out/\${{ github.event.inputs.app_slug }}.apk"
            APK_SIZE=$(stat -c%s "$APK_FILE" 2>/dev/null || echo "0")
            echo "APK_BUILT=true" >> \$GITHUB_ENV
            echo "APK_SIZE=$APK_SIZE" >> \$GITHUB_ENV
            echo "✅ APK built: $APK_SIZE bytes"
          else
            echo "APK_BUILT=false" >> \$GITHUB_ENV
            echo "❌ No APK found"
            exit 1
          fi

      - name: Upload APK to Storage
        if: env.APK_BUILT == 'true'
        env:
          SB_URL: \${{ secrets.SUPABASE_URL }}
          SB_KEY: \${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: |
          APK_FILE="/tmp/apk-out/\${{ github.event.inputs.app_slug }}.apk"
          STORAGE_PATH="\${{ github.event.inputs.app_slug }}/release.apk"
          
          echo "Uploading APK to storage bucket..."
          HTTP_CODE=$(curl -s -o /tmp/upload.txt -w "%{http_code}" \\
            -X POST "$SB_URL/storage/v1/object/apks/$STORAGE_PATH" \\
            -H "Authorization: Bearer $SB_KEY" \\
            -H "Content-Type: application/vnd.android.package-archive" \\
            -H "x-upsert: true" \\
            --data-binary @"$APK_FILE")
          
          echo "Upload HTTP: $HTTP_CODE"
          if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
            echo "UPLOAD_OK=true" >> \$GITHUB_ENV
            echo "✅ Uploaded to apks/$STORAGE_PATH"
          else
            cat /tmp/upload.txt
            echo "UPLOAD_OK=false" >> \$GITHUB_ENV
          fi

      - name: Save artifact backup
        if: env.APK_BUILT == 'true'
        uses: actions/upload-artifact@v4
        with:
          name: \${{ github.event.inputs.app_slug }}-apk
          path: /tmp/apk-out/\${{ github.event.inputs.app_slug }}.apk
          retention-days: 30

      - name: Callback to pipeline
        if: always()
        env:
          SB_URL: \${{ secrets.SUPABASE_URL }}
          SB_ANON: \${{ secrets.SUPABASE_ANON_KEY }}
        run: |
          if [ "\${{ env.APK_BUILT }}" = "true" ]; then
            STATUS="success"
          else
            STATUS="failed"
          fi
          
          SLUG="\${{ github.event.inputs.app_slug }}"
          PID="\${{ github.event.inputs.product_id }}"
          
          curl -s -X POST "$SB_URL/functions/v1/apk-factory" \\
            -H "Content-Type: application/json" \\
            -H "Authorization: Bearer $SB_ANON" \\
            -d "{\\"action\\":\\"build_complete\\",\\"data\\":{\\"slug\\":\\"$SLUG\\",\\"status\\":\\"$STATUS\\",\\"product_id\\":\\"$PID\\",\\"apk_path\\":\\"$SLUG/release.apk\\",\\"error\\":\\"\\"}}" \\
            || echo "Callback failed"
          
          echo "Callback sent: status=$STATUS"
`;
}
