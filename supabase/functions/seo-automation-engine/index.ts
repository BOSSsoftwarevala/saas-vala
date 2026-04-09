import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

type Role = 'super_admin' | 'admin' | 'reseller';

interface RunRequest {
  product_id?: string;
  run_type?: string;
  trigger?: 'manual' | 'cron' | 'api';
  limit?: number;
  dry_run?: boolean;
}

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  meta: Record<string, unknown> | null;
}

function words(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !['with', 'that', 'this', 'from', 'software', 'vala'].includes(w));
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function buildKeywords(product: ProductRow): string[] {
  const base = [product.name, product.slug, product.description || ''].join(' ');
  const core = unique(words(base)).slice(0, 8);
  const expanded = core.flatMap((term) => [
    term,
    `${term} software`,
    `best ${term} solution`,
    `${term} india`,
  ]);
  return unique(expanded).slice(0, 16);
}

function buildMetaDescription(product: ProductRow): string {
  const raw = (product.description || `${product.name} for growing businesses.`).trim();
  const suffix = ' Trusted SaaS by SoftwareVala.';
  const normalized = raw.replace(/\s+/g, ' ');
  return `${normalized.slice(0, Math.max(0, 145 - suffix.length))}${suffix}`.slice(0, 160);
}

function calcSeoScore(entry: {
  title?: string | null;
  meta_description?: string | null;
  keywords?: string[] | null;
  structured_data?: unknown;
  updated_at?: string | null;
}) {
  const titleLen = (entry.title || '').trim().length;
  const descLen = (entry.meta_description || '').trim().length;
  const keywordCount = (entry.keywords || []).length;

  const titleScore = titleLen >= 30 && titleLen <= 60 ? 25 : titleLen > 0 ? 12 : 0;
  const descScore = descLen >= 80 && descLen <= 160 ? 25 : descLen > 0 ? 12 : 0;
  const keywordScore = Math.min(30, Math.round((keywordCount / 12) * 30));

  const updatedAt = entry.updated_at ? Date.parse(entry.updated_at) : 0;
  const ageDays = updatedAt ? (Date.now() - updatedAt) / (1000 * 60 * 60 * 24) : 365;
  const freshnessScore = ageDays <= 30 ? 10 : ageDays <= 90 ? 6 : 2;

  const structuredScore = entry.structured_data ? 10 : 0;
  const seoScore = Math.min(100, titleScore + descScore + keywordScore + freshnessScore + structuredScore);

  const keywordCoverage = Math.min(100, Number(((keywordCount / 12) * 100).toFixed(2)));
  const readabilityScore = Math.max(45, Math.min(95, 92 - Math.max(0, descLen - 125) * 0.25));
  const ctrEstimate = Number((Math.max(1.1, (seoScore / 100) * 5.2)).toFixed(2));

  const recommendations: string[] = [];
  if (titleLen < 30 || titleLen > 60) recommendations.push('Adjust title length to 30-60 characters.');
  if (descLen < 80 || descLen > 160) recommendations.push('Keep meta description between 80 and 160 characters.');
  if (keywordCount < 8) recommendations.push('Expand long-tail keyword set for stronger discovery.');
  if (!entry.structured_data) recommendations.push('Add SoftwareApplication JSON-LD schema markup.');

  return {
    seoScore,
    keywordCoverage,
    readabilityScore: Number(readabilityScore.toFixed(2)),
    ctrEstimate,
    recommendations,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    const body: RunRequest = await req.json().catch(() => ({}));
    const authHeader = req.headers.get('Authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const isServiceInvocation = bearerToken === serviceRoleKey;

    let actorId: string | null = null;
    let actorRoles: Role[] = [];

    if (!isServiceInvocation) {
      if (!authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }

      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }

      actorId = userData.user.id;
      const { data: roleRows } = await admin.from('user_roles').select('role').eq('user_id', actorId);
      actorRoles = (roleRows || []).map((r: { role: string }) => r.role as Role);

      if (!actorRoles.some((r) => r === 'super_admin' || r === 'admin' || r === 'reseller')) {
        return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403, headers: corsHeaders });
      }
    }

    const runType = (body.run_type || 'full_scan').slice(0, 40);
    const limit = Math.max(1, Math.min(500, Number(body.limit || 100)));
    const dryRun = Boolean(body.dry_run);

    const { data: runRow, error: runInsertError } = await admin
      .from('seo_automation_runs')
      .insert({
        run_type: runType,
        status: 'running',
        triggered_by: actorId,
        summary: {
          trigger: body.trigger || (isServiceInvocation ? 'cron' : 'manual'),
          dry_run: dryRun,
        },
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (runInsertError || !runRow) {
      throw new Error(runInsertError?.message || 'Failed to create run');
    }

    let productQuery = admin
      .from('products')
      .select('id,name,slug,description,meta,created_by')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (body.product_id) {
      productQuery = productQuery.eq('id', body.product_id);
    }

    if (!isServiceInvocation && actorRoles.includes('reseller') && actorId) {
      productQuery = productQuery.eq('created_by', actorId);
    }

    const { data: products, error: productsError } = await productQuery;
    if (productsError) throw productsError;

    const productList = (products || []) as ProductRow[];

    let optimizedCount = 0;
    let createdSeoRows = 0;
    let updatedMetricsRows = 0;

    for (const product of productList) {
      const { data: existingSeoRows, error: seoFetchError } = await admin
        .from('seo_data')
        .select('id,title,meta_description,keywords,structured_data,updated_at,url,robots')
        .eq('product_id', product.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (seoFetchError) {
        console.warn('[seo-automation-engine] Failed to fetch seo_data', product.id, seoFetchError.message);
        continue;
      }

      const existingSeo = existingSeoRows?.[0];

      const keywords = (existingSeo?.keywords as string[] | undefined)?.length
        ? (existingSeo?.keywords as string[])
        : buildKeywords(product);

      const desiredTitle = existingSeo?.title || `${product.name} | SoftwareVala`;
      const desiredDescription = existingSeo?.meta_description || buildMetaDescription(product);
      const desiredUrl = existingSeo?.url || `/marketplace/${product.slug}`;
      const desiredRobots = existingSeo?.robots || 'index, follow';
      const desiredStructured = existingSeo?.structured_data || {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: product.name,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
      };

      let seoDataId = existingSeo?.id as string | undefined;

      if (!dryRun && !existingSeo) {
        const { data: insertedSeo, error: insertSeoError } = await admin
          .from('seo_data')
          .insert({
            product_id: product.id,
            url: desiredUrl,
            title: desiredTitle,
            meta_description: desiredDescription,
            keywords,
            robots: desiredRobots,
            structured_data: desiredStructured,
            created_by: actorId,
          })
          .select('id')
          .single();

        if (insertSeoError) {
          console.warn('[seo-automation-engine] Failed to insert seo_data', product.id, insertSeoError.message);
          continue;
        }

        seoDataId = insertedSeo.id;
        createdSeoRows += 1;
      }

      const effectiveSeo = {
        title: desiredTitle,
        meta_description: desiredDescription,
        keywords,
        structured_data: desiredStructured,
        updated_at: existingSeo?.updated_at || new Date().toISOString(),
      };

      const score = calcSeoScore(effectiveSeo);

      if (!dryRun) {
        const { error: upsertMetricsError } = await admin.from('seo_product_metrics').upsert(
          {
            product_id: product.id,
            seo_data_id: seoDataId || null,
            seo_score: score.seoScore,
            keyword_coverage: score.keywordCoverage,
            readability_score: score.readabilityScore,
            ctr_estimate: score.ctrEstimate,
            ai_recommendations: score.recommendations,
            last_scanned_at: new Date().toISOString(),
            target_countries: ['IN', 'NG', 'KE', 'ZA', 'AE'],
            hashtags: keywords.slice(0, 8).map((kw) => `#${kw.replace(/\s+/g, '')}`),
          },
          { onConflict: 'product_id' },
        );

        if (upsertMetricsError) {
          console.warn('[seo-automation-engine] Failed to upsert metrics', product.id, upsertMetricsError.message);
          continue;
        }
      }

      optimizedCount += 1;
      updatedMetricsRows += 1;
    }

    const summary = {
      total_products_scanned: productList.length,
      optimized_products: optimizedCount,
      created_seo_rows: createdSeoRows,
      updated_metric_rows: updatedMetricsRows,
      dry_run: dryRun,
    };

    await admin.from('seo_automation_runs').update({
      status: 'completed',
      summary,
      completed_at: new Date().toISOString(),
    }).eq('id', runRow.id);

    return new Response(JSON.stringify({ success: true, run_id: runRow.id, summary }), { headers: corsHeaders });
  } catch (err: any) {
    console.error('[seo-automation-engine] Fatal error:', err);

    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Unknown error',
      }),
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});
