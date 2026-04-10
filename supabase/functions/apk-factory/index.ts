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
      case "setup_factory": {
        const repoCheck = await gh("/repos/saasvala/apk-factory");

        if (repoCheck.status === 404) {
          const createRes = await gh("/user/repos", {
            method: "POST",
            body: JSON.stringify({
              name: "apk-factory",
              description: "Automated APK build factory - Software Vala",
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

        // Set GitHub repo secrets
        const secretsToSet: Record<string, string> = {
          SUPABASE_URL: supabaseUrl,
          SUPABASE_SERVICE_ROLE_KEY: serviceKey,
          SUPABASE_ANON_KEY: supabaseAnonKey,
        };

        let secretsOk = 0;
        const pubKeyRes = await gh("/repos/saasvala/apk-factory/actions/secrets/public-key");
        if (pubKeyRes.ok) {
          const pubKey = await pubKeyRes.json();
          for (const [name, value] of Object.entries(secretsToSet)) {
            try {
              const encrypted = await encryptSecret(value, pubKey.key);
              const setRes = await gh(`/repos/saasvala/apk-factory/actions/secrets/${name}`, {
                method: "PUT",
                body: JSON.stringify({ encrypted_value: encrypted, key_id: pubKey.key_id }),
              });
              if (setRes.ok || setRes.status === 201 || setRes.status === 204) secretsOk++;
              await setRes.text();
            } catch (e: any) {
              console.error(`Failed to set secret ${name}:`, e.message);
            }
          }
        } else {
          await pubKeyRes.text();
        }

        // Create workflow file
        const workflowContent = getWorkflowYaml();
        const encodedContent = btoa(unescape(encodeURIComponent(workflowContent)));

        const workflowCheck = await gh("/repos/saasvala/apk-factory/contents/.github/workflows/build-apk.yml");
        const workflowBody: any = { message: "Update APK build workflow v4", content: encodedContent };

        if (workflowCheck.ok) {
          const existing = await workflowCheck.json();
          workflowBody.sha = existing.sha;
        } else {
          await workflowCheck.text();
        }

        const putRes = await gh("/repos/saasvala/apk-factory/contents/.github/workflows/build-apk.yml", {
          method: "PUT",
          body: JSON.stringify(workflowBody),
        });

        if (!putRes.ok) {
          const err = await putRes.text();
          return respond({ error: `Failed to create workflow: ${err}` }, 500);
        }
        await putRes.json();

        return respond({
          success: true,
          secrets_configured: secretsOk,
          message: `APK Factory v4 ready - ${secretsOk}/3 secrets configured, workflow updated`,
          repo_url: "https://github.com/saasvala/apk-factory",
        });
      }

      case "trigger_build": {
        const { slug, repo_url, product_id, conversion_type, output_platform, source_kind, source_bucket_path, source_repo_url, output_version, version_code } = data || {};
        if (!slug) return respond({ error: "slug required" }, 400);

        const targetRepo = repo_url || `https://github.com/saasvala/${slug}`;

        // Verify repo exists
        const repoCheck = await gh(`/repos/saasvala/${slug}`);
        if (!repoCheck.ok) {
          await repoCheck.text();
          return respond({ success: false, slug, status: "repo_not_found", message: `Repo saasvala/${slug} not found` });
        }
        await repoCheck.json();

        const dispatchRes = await gh("/repos/saasvala/apk-factory/actions/workflows/build-apk.yml/dispatches", {
          method: "POST",
          body: JSON.stringify({
            ref: "main",
            inputs: {
              repo_url: targetRepo,
              app_slug: slug,
              package_name: `com.saasvala.${slug.replace(/-/g, "_")}`,
              product_id: product_id || "",
                  conversion_type: conversion_type || "web_to_apk",
                  output_platform: output_platform || "android_apk",
                  source_kind: source_kind || "github_repo",
                  source_bucket_path: source_bucket_path || "",
                  source_repo_url: source_repo_url || targetRepo,
                  output_version: output_version || "1.0.0",
                  version_code: version_code || "1",
            },
          }),
        });

        if (!dispatchRes.ok && dispatchRes.status !== 204) {
          const err = await dispatchRes.text();
          return respond({ error: `Failed to trigger build: ${err}`, status: dispatchRes.status }, 500);
        }

        const admin = createClient(supabaseUrl, serviceKey);
        await admin.from("apk_build_queue").upsert({
          repo_name: slug,
          repo_url: targetRepo,
          slug,
          build_status: "building",
          product_id: product_id || null,
          source_kind: source_kind || null,
          source_bucket_path: source_bucket_path || null,
          source_repo_url: source_repo_url || targetRepo,
          conversion_type: conversion_type || "web_to_apk",
          output_platform: output_platform || "android_apk",
          output_version: output_version || "1.0.0",
          target_industry: "general",
          build_started_at: new Date().toISOString(),
          build_error: null,
        }, { onConflict: "slug" });

        return respond({
          success: true,
          slug,
          repo_url: targetRepo,
          status: "building",
          message: `APK build triggered for ${slug}`,
        });
      }

      case "check_build_status": {
        const { slug } = data || {};
        const runsRes = await gh(`/repos/saasvala/apk-factory/actions/workflows/build-apk.yml/runs?per_page=20`);
        if (!runsRes.ok) {
          const err = await runsRes.text();
          return respond({ error: `Failed to check status: ${err}` }, 500);
        }
        const runsData = await runsRes.json();
        const runs = (runsData.workflow_runs || []).map((r: any) => ({
          id: r.id, status: r.status, conclusion: r.conclusion,
          created_at: r.created_at, updated_at: r.updated_at, display_title: r.display_title,
        }));
        let matchedRun = null;
        if (slug) matchedRun = runs.find((r: any) => r.display_title?.includes(slug));
        return respond({ success: true, runs, matched_run: matchedRun, total_runs: runsData.total_count });
      }

      case "build_complete": {
        const {
          slug: completeSlug,
          apk_path,
          status: buildStatus,
          error: buildError,
          product_id: pid,
          conversion_type,
          output_platform,
          output_version,
          file_hash,
          license_runtime_bundle,
          build_meta,
        } = data || {};
        if (!completeSlug) return respond({ error: "slug required" }, 400);

        const admin = createClient(supabaseUrl, serviceKey);

        const { data: queueRow } = await admin
          .from("apk_build_queue")
          .select("id, product_id, conversion_type, output_platform, output_version")
          .eq("slug", completeSlug)
          .maybeSingle();

        if (buildStatus === "success" && apk_path) {
          const effectiveProductId = pid || queueRow?.product_id || null;
          const effectiveConversionType = conversion_type || queueRow?.conversion_type || "web_to_apk";
          const effectivePlatform = output_platform || queueRow?.output_platform || "android_apk";
          const effectiveVersion = output_version || queueRow?.output_version || "1.0.0";

          if (effectiveProductId) {
            await admin.rpc("finalize_offline_conversion_build", {
              p_queue_id: queueRow?.id || null,
              p_product_id: effectiveProductId,
              p_platform: effectivePlatform,
              p_version: effectiveVersion,
              p_file_path: apk_path,
              p_file_size: null,
              p_file_hash: file_hash || null,
              p_conversion_type: effectiveConversionType,
              p_build_type: effectiveConversionType === "php_offline" ? "php_offline" : "web_apk",
              p_license_runtime_bundle: license_runtime_bundle || {},
              p_build_meta: build_meta || {},
            });
          } else {
            await admin.from("apk_build_queue").update({
              build_status: "completed",
              apk_file_path: apk_path,
              build_completed_at: new Date().toISOString(),
              build_error: null,
              marketplace_listed: true,
            }).eq("slug", completeSlug);
          }

          const { data: signedData } = await admin.storage.from("apks").createSignedUrl(apk_path, 31536000);

          if (signedData?.signedUrl && effectiveProductId) {
            await admin.from("products").update({
              apk_url: signedData.signedUrl,
              is_apk: true,
              apk_enabled: true,
            }).eq("id", effectiveProductId);
          }

          await admin.from("source_code_catalog").update({
            status: "completed", is_on_marketplace: true,
          }).eq("slug", completeSlug);

          return respond({ success: true, message: `APK for ${completeSlug} built and attached!`, apk_url: signedData?.signedUrl });
        } else {
          await admin.from("apk_build_queue").update({
            build_status: "failed",
            build_error: buildError || "Build failed",
            build_completed_at: new Date().toISOString(),
            build_attempts: 1,
          }).eq("slug", completeSlug);

          return respond({ success: false, message: `APK build failed for ${completeSlug}: ${buildError}` });
        }
      }

      case "bulk_trigger": {
        const { slugs, limit } = data || {};
        const admin = createClient(supabaseUrl, serviceKey);

        let targetSlugs = slugs || [];
        if (!targetSlugs.length) {
          const requestedLimit = Number(limit ?? 0);
          if (requestedLimit > 0) {
            const { data: pending } = await admin
              .from("apk_build_queue")
              .select("slug, repo_url, product_id, output_version")
              .eq("build_status", "pending")
              .order("created_at", { ascending: true })
              .limit(requestedLimit);
            targetSlugs = (pending || []).map((p: any) => ({ slug: p.slug, repo_url: p.repo_url, product_id: p.product_id, output_version: p.output_version }));
          } else {
            const pageSize = 200;
            let from = 0;
            const allPending: any[] = [];
            while (true) {
              const to = from + pageSize - 1;
              const { data: page } = await admin
                .from("apk_build_queue")
                .select("slug, repo_url, product_id, output_version")
                .eq("build_status", "pending")
                .order("created_at", { ascending: true })
                .range(from, to);

              const rows = page || [];
              allPending.push(...rows);
              if (rows.length < pageSize) break;
              from += pageSize;
            }
            targetSlugs = allPending.map((p: any) => ({ slug: p.slug, repo_url: p.repo_url, product_id: p.product_id, output_version: p.output_version }));
          }
        }

        const results: any[] = [];
        let triggered = 0;

        for (const item of targetSlugs) {
          const slug = typeof item === "string" ? item : item.slug;
          const repoUrl = typeof item === "string" ? `https://github.com/saasvala/${item}` : item.repo_url;
          const productId = typeof item === "string" ? "" : item.product_id || "";
          const outputVersion = typeof item === "string" ? "1.0.0" : item.output_version || "1.0.0";
          const parts = String(outputVersion).split('.').map((p: string) => Number(p.replace(/[^0-9]/g, '') || 0));
          const versionCode = String((Math.min(999, parts[0] || 1) * 10000) + (Math.min(99, parts[1] || 0) * 100) + Math.min(99, parts[2] || 0));

          try {
            const dispatchRes = await gh("/repos/saasvala/apk-factory/actions/workflows/build-apk.yml/dispatches", {
              method: "POST",
              body: JSON.stringify({
                ref: "main",
                inputs: {
                  repo_url: repoUrl,
                  app_slug: slug,
                  package_name: `com.saasvala.${slug.replace(/-/g, "_")}`,
                  product_id: productId,
                  output_version: outputVersion,
                  version_code: versionCode,
                },
              }),
            });

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
          success: true, triggered, total: targetSlugs.length, results,
          message: `${triggered}/${targetSlugs.length} APK builds triggered`,
        });
      }

      case "get_job_logs": {
        const { run_id } = data || {};
        if (!run_id) return respond({ error: "run_id required" }, 400);
        const jobsRes = await gh(`/repos/saasvala/apk-factory/actions/runs/${run_id}/jobs`);
        if (!jobsRes.ok) {
          const err = await jobsRes.text();
          return respond({ error: err }, 500);
        }
        const jobsData = await jobsRes.json();
        const jobs = (jobsData.jobs || []).map((j: any) => ({
          id: j.id, name: j.name, status: j.status, conclusion: j.conclusion,
          steps: (j.steps || []).map((s: any) => ({
            name: s.name, status: s.status, conclusion: s.conclusion,
            number: s.number,
          })),
        }));
        // Also try to get logs
        let logSnippet = "";
        try {
          const logsRes = await gh(`/repos/saasvala/apk-factory/actions/runs/${run_id}/logs`, {
            headers: { Accept: "application/vnd.github.v3+json" } as any,
          });
          if (logsRes.status === 302) {
            const logUrl = logsRes.headers.get("Location");
            if (logUrl) logSnippet = `Log download URL: ${logUrl}`;
          }
          await logsRes.text();
        } catch (_e) { /* ignore */ }
        return respond({ success: true, jobs, log_snippet: logSnippet });
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

async function encryptSecret(secretValue: string, publicKeyB64: string): Promise<string> {
  const binaryKey = Uint8Array.from(atob(publicKeyB64), c => c.charCodeAt(0));
  const messageBytes = new TextEncoder().encode(secretValue);
  const _sodium = await import("https://esm.sh/libsodium-wrappers@0.7.13");
  const sodium = _sodium.default || _sodium;
  await sodium.ready;
  const encrypted = sodium.crypto_box_seal(messageBytes, binaryKey);
  return btoa(String.fromCharCode(...encrypted));
}

function getWorkflowYaml(): string {
  // Using an array join to avoid all heredoc/template escaping issues
  const lines = [
    'name: Build APK',
    'on:',
    '  workflow_dispatch:',
    '    inputs:',
    '      repo_url:',
    "        description: 'GitHub repo URL to build'",
    '        required: true',
    '      app_slug:',
    "        description: 'App slug name'",
    '        required: true',
    '      package_name:',
    "        description: 'Android package name'",
    '        required: true',
    "        default: 'com.saasvala.app'",
    '      product_id:',
    "        description: 'Product ID in database'",
    '        required: false',
    "        default: ''",
    '      output_version:',
    "        description: 'Release version name (e.g. 1.2.3)'",
    '        required: false',
    "        default: '1.0.0'",
    '      version_code:',
    "        description: 'Android versionCode (integer)'",
    '        required: false',
    "        default: '1'",
    '',
    'jobs:',
    '  build:',
    '    runs-on: ubuntu-latest',
    '    timeout-minutes: 30',
    '',
    '    steps:',
    '      - name: Checkout factory',
    '        uses: actions/checkout@v4',
    '',
    '      - name: Setup Node.js',
    '        uses: actions/setup-node@v4',
    '        with:',
    "          node-version: '20'",
    '',
    '      - name: Setup Java 17',
    '        uses: actions/setup-java@v4',
    '        with:',
    "          distribution: 'temurin'",
    "          java-version: '17'",
    '',
    '      - name: Setup Android SDK',
    '        uses: android-actions/setup-android@v3',
    '',
    '      - name: Clone target repo',
    '        run: |',
    '          git clone ${{ github.event.inputs.repo_url }} target-app',
    '          cd target-app',
    '          echo "Repo cloned: ${{ github.event.inputs.app_slug }}"',
    '          ls -la',
    '',
    '      - name: Install and build web app',
    '        run: |',
    '          cd target-app',
    '          if [ -f "package.json" ]; then',
    '            npm install --legacy-peer-deps 2>/dev/null || npm install --force 2>/dev/null || echo "install done"',
    '            npm run build 2>/dev/null || npx vite build 2>/dev/null',
    '          else',
    '            echo "package.json missing - cannot build real app"',
    '            exit 1',
    '          fi',
    '          if [ -d "dist" ]; then',
    '            echo "WEBDIR=dist" >> $GITHUB_ENV',
    '          elif [ -d "build" ]; then',
    '            echo "WEBDIR=build" >> $GITHUB_ENV',
    '          elif [ -d "public" ]; then',
    '            echo "WEBDIR=public" >> $GITHUB_ENV',
    '          else',
    '            echo "No real web build output found (dist/build/public missing)"',
    '            exit 1',
    '          fi',
    '',
    '      - name: Setup Capacitor',
    '        env:',
    '          CAP_APP_ID: ${{ github.event.inputs.package_name }}',
    '          CAP_APP_NAME: ${{ github.event.inputs.app_slug }}',
    '          CAP_WEBDIR: ${{ env.WEBDIR }}',
    '        run: |',
    '          cd target-app',
    '          npm install @capacitor/core@latest @capacitor/cli@latest @capacitor/android@latest --legacy-peer-deps 2>/dev/null || npm install @capacitor/core@latest @capacitor/cli@latest @capacitor/android@latest --force',
    '          WDIR="${CAP_WEBDIR:-dist}"',
    '          printf \'{"appId":"%s","appName":"%s","webDir":"%s","server":{"androidScheme":"https"}}\\n\' "$CAP_APP_ID" "$CAP_APP_NAME" "$WDIR" > capacitor.config.json',
    '          cat capacitor.config.json',
    '          npx cap add android 2>/dev/null || true',
    '          npx cap sync android',

    '      - name: Configure release signing and versioning',
    '        env:',
    '          ANDROID_KEYSTORE_BASE64: ${{ secrets.ANDROID_KEYSTORE_BASE64 }}',
    '          ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}',
    '          ANDROID_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}',
    '          ANDROID_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}',
    '        run: |',
    '          cd target-app/android',
    '          if [ -z "${ANDROID_KEYSTORE_BASE64}" ] || [ -z "${ANDROID_KEYSTORE_PASSWORD}" ] || [ -z "${ANDROID_KEY_ALIAS}" ] || [ -z "${ANDROID_KEY_PASSWORD}" ]; then',
    '            echo "Signing secrets missing. Configure ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD"',
    '            exit 1',
    '          fi',
    '          echo "${ANDROID_KEYSTORE_BASE64}" | base64 -d > "$RUNNER_TEMP/release.keystore"',
    '          echo "KEYSTORE_PATH=$RUNNER_TEMP/release.keystore" >> $GITHUB_ENV',
    '          echo "KEYSTORE_PASSWORD=${ANDROID_KEYSTORE_PASSWORD}" >> $GITHUB_ENV',
    '          echo "KEY_ALIAS=${ANDROID_KEY_ALIAS}" >> $GITHUB_ENV',
    '          echo "KEY_PASSWORD=${ANDROID_KEY_PASSWORD}" >> $GITHUB_ENV',
    '          if [ -f "app/build.gradle" ]; then',
    '            sed -i "s/versionCode [0-9]\+/versionCode ${{ github.event.inputs.version_code }}/" app/build.gradle || true',
    '            sed -i "s/versionName \"[^\"]*\"/versionName \"${{ github.event.inputs.output_version }}\"/" app/build.gradle || true',
    '          elif [ -f "app/build.gradle.kts" ]; then',
    '            sed -i "s/versionCode = [0-9]\+/versionCode = ${{ github.event.inputs.version_code }}/" app/build.gradle.kts || true',
    '            sed -i "s/versionName = \"[^\"]*\"/versionName = \"${{ github.event.inputs.output_version }}\"/" app/build.gradle.kts || true',
    '          fi',
    '',
    '      - name: Build APK',
    '        run: |',
    '          cd target-app/android',
    '          chmod +x gradlew',
    '          ./gradlew assembleRelease --no-daemon --stacktrace \\',
    '            -Pandroid.injected.signing.store.file="$KEYSTORE_PATH" \\',
    '            -Pandroid.injected.signing.store.password="$KEYSTORE_PASSWORD" \\',
    '            -Pandroid.injected.signing.key.alias="$KEY_ALIAS" \\',
    '            -Pandroid.injected.signing.key.password="$KEY_PASSWORD" \\',
    '            2>&1 | tail -80',
    '          APK_FILE=$(find app/build/outputs/apk/release -name "*.apk" -type f | head -1)',
    '          if [ -n "$APK_FILE" ]; then',
    '            mkdir -p /tmp/apk-out',
    '            cp "$APK_FILE" "/tmp/apk-out/${{ github.event.inputs.app_slug }}.apk"',
    '            APK_SIZE=$(stat -c%s "$APK_FILE" 2>/dev/null || echo "0")',
    '            echo "APK_BUILT=true" >> $GITHUB_ENV',
    '            echo "APK built: $APK_SIZE bytes"',
    '          else',
    '            echo "APK_BUILT=false" >> $GITHUB_ENV',
    '            echo "No APK found"',
    '            exit 1',
    '          fi',
    '',
    '      - name: Upload APK to Storage',
    '        if: env.APK_BUILT == \'true\'',
    '        env:',
    '          SB_URL: ${{ secrets.SUPABASE_URL }}',
    '          SB_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}',
    '        run: |',
    '          APK_FILE="/tmp/apk-out/${{ github.event.inputs.app_slug }}.apk"',
    '          STORAGE_PATH="${{ github.event.inputs.app_slug }}/release.apk"',
    '          HTTP_CODE=$(curl -s -o /tmp/upload.txt -w "%{http_code}" \\',
    '            -X POST "${SB_URL}/storage/v1/object/apks/${STORAGE_PATH}" \\',
    '            -H "Authorization: Bearer ${SB_KEY}" \\',
    '            -H "Content-Type: application/vnd.android.package-archive" \\',
    '            -H "x-upsert: true" \\',
    '            --data-binary @"${APK_FILE}")',
    '          echo "Upload HTTP: ${HTTP_CODE}"',
    '          if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then',
    '            echo "UPLOAD_OK=true" >> $GITHUB_ENV',
    '          else',
    '            cat /tmp/upload.txt',
    '            echo "UPLOAD_OK=false" >> $GITHUB_ENV',
    '          fi',
    '',
    '      - name: Save artifact',
    '        if: env.APK_BUILT == \'true\'',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ${{ github.event.inputs.app_slug }}-apk',
    '          path: /tmp/apk-out/${{ github.event.inputs.app_slug }}.apk',
    '          retention-days: 30',
    '',
    '      - name: Callback',
    '        if: always()',
    '        env:',
    '          SB_URL: ${{ secrets.SUPABASE_URL }}',
    '          SB_ANON: ${{ secrets.SUPABASE_ANON_KEY }}',
    '        run: |',
    '          if [ "${{ env.APK_BUILT }}" = "true" ] && [ "${{ env.UPLOAD_OK }}" = "true" ]; then',
    '            STATUS="success"',
    '          else',
    '            STATUS="failed"',
    '          fi',
    '          SLUG="${{ github.event.inputs.app_slug }}"',
    '          PID="${{ github.event.inputs.product_id }}"',
    '          curl -s -X POST "${SB_URL}/functions/v1/apk-factory" \\',
    '            -H "Content-Type: application/json" \\',
    '            -H "Authorization: Bearer ${SB_ANON}" \\',
    '            -d "{\\\"action\\\":\\\"build_complete\\\",\\\"data\\\":{\\\"slug\\\":\\\"${SLUG}\\\",\\\"status\\\":\\\"${STATUS}\\\",\\\"product_id\\\":\\\"${PID}\\\",\\\"apk_path\\\":\\\"${SLUG}/release.apk\\\",\\\"error\\\":\\\"\\\"}}" \\',
    '            || echo "Callback failed"',
  ];
  return lines.join('\n') + '\n';
}
