import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { action, data } = await req.json();

    // ============================================
    // ACTION: Full System Health Check
    // ============================================
    if (action === 'health_check') {
      const issues: any[] = [];
      const autoActions: any[] = [];
      const approvals: any[] = [];

      // 1. Check server health
      const { data: servers } = await supabase.from('servers').select('id, name, status, updated_at').limit(100);
      const staleServers = (servers || []).filter((s: any) => {
        const lastUpdate = new Date(s.updated_at);
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return lastUpdate < hourAgo && s.status === 'live';
      });

      for (const server of staleServers) {
        issues.push({
          type: 'server_stale',
          entity: server.name,
          severity: 'medium'
        });
      }

      // 2. Check edge function errors
      const { data: recentErrors } = await supabase
        .from('error_logs')
        .select('*')
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(20);

      const criticalErrors = (recentErrors || []).filter((e: any) => e.severity === 'critical');
      
      for (const error of criticalErrors) {
        approvals.push({
          monitor_type: 'error_fix',
          title: `Critical Error: ${error.error_type}`,
          reason: `Unresolved critical error detected: ${error.error_message.substring(0, 100)}`,
          effect: 'Auto-restart affected service and clear error state',
          risk_level: 'high',
          source_module: 'server',
          ai_confidence: 75,
          action_payload: { error_id: error.id, error_type: error.error_type }
        });
      }

      // 3. Check billing due dates
      const today = new Date();
      const fourDays = new Date(today);
      fourDays.setDate(today.getDate() + 4);

      const { data: upcomingBills } = await supabase
        .from('billing_tracker')
        .select('*')
        .eq('status', 'active')
        .lte('next_due_date', fourDays.toISOString().split('T')[0])
        .gte('next_due_date', today.toISOString().split('T')[0]);

      for (const bill of (upcomingBills || [])) {
        const daysUntil = Math.ceil((new Date(bill.next_due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const riskLevel = daysUntil <= 1 ? 'critical' : daysUntil <= 2 ? 'high' : 'medium';

        if (bill.auto_pay) {
          autoActions.push({
            monitor_type: 'config_change',
            title: `Auto-pay: ${bill.service_name} - $${bill.amount}`,
            reason: `Bill due in ${daysUntil} day(s), auto-pay enabled`,
            effect: 'Payment will be processed automatically',
            risk_level: 'low',
            auto_approved: true,
            status: 'auto_approved',
            source_module: 'billing',
            ai_confidence: 95,
            action_payload: { billing_id: bill.id, amount: bill.amount }
          });
        } else {
          approvals.push({
            monitor_type: 'config_change',
            title: `Payment Due: ${bill.service_name} - $${bill.amount}`,
            reason: `Bill due in ${daysUntil} day(s), requires manual payment`,
            effect: `Service may be interrupted if not paid by ${bill.next_due_date}`,
            risk_level: riskLevel,
            source_module: 'billing',
            ai_confidence: 90,
            action_payload: { billing_id: bill.id, amount: bill.amount }
          });
        }
      }

      // 4. Check Git repos for updates
      const githubToken = Deno.env.get('SAASVALA_GITHUB_TOKEN');
      if (githubToken) {
        try {
          const reposRes = await fetch('https://api.github.com/user/repos?per_page=10&sort=updated', {
            headers: { 'Authorization': `token ${githubToken}`, 'Accept': 'application/vnd.github.v3+json' }
          });

          if (reposRes.ok) {
            const repos = await reposRes.json();
            const { data: products } = await supabase
              .from('products')
              .select('id, name, git_repo_url, updated_at')
              .not('git_repo_url', 'is', null);

            for (const repo of repos) {
              const linkedProduct = (products || []).find((p: any) => 
                p.git_repo_url && p.git_repo_url.includes(repo.full_name)
              );

              if (linkedProduct) {
                const repoUpdated = new Date(repo.pushed_at);
                const productUpdated = new Date(linkedProduct.updated_at);

                if (repoUpdated > productUpdated) {
                  approvals.push({
                    monitor_type: 'deploy',
                    title: `Code Update: ${repo.name}`,
                    reason: `New commit pushed to ${repo.default_branch} branch since last sync`,
                    effect: 'Redeploy product with latest code changes',
                    risk_level: 'medium',
                    source_module: 'git',
                    target_entity_id: linkedProduct.id,
                    target_entity_type: 'product',
                    ai_confidence: 85,
                    action_payload: { repo_name: repo.full_name, branch: repo.default_branch }
                  });
                }
              }
            }
          }
        } catch (e) {
          console.error('Git check error:', e);
        }
      }

      // 5. Check product health
      const { data: unhealthyProducts } = await supabase
        .from('health_checks')
        .select('*, products:product_id(name)')
        .in('overall_status', ['error', 'warning']);

      for (const hc of (unhealthyProducts || [])) {
        const productName = (hc as any).products?.name || 'Unknown';
        if (hc.overall_status === 'error') {
          approvals.push({
            monitor_type: 'error_fix',
            title: `Product Health Critical: ${productName}`,
            reason: `Product health check failed - ${hc.demo_status === 'error' ? 'Demo down' : hc.server_status === 'error' ? 'Server issue' : 'Multiple issues'}`,
            effect: 'Run diagnostic and attempt auto-recovery',
            risk_level: 'high',
            source_module: 'server',
            target_entity_id: hc.product_id,
            target_entity_type: 'product',
            ai_confidence: 70,
            action_payload: { health_check_id: hc.id, statuses: { demo: hc.demo_status, apk: hc.apk_status, server: hc.server_status, license: hc.license_status } }
          });
        }
      }

      // 6. Check AI quota usage
      const { data: quotas } = await supabase
        .from('ai_quotas')
        .select('*')
        .gt('daily_used', 80); // Over 80% of default 100

      for (const quota of (quotas || [])) {
        const usagePercent = Math.round((quota.daily_used! / (quota.daily_limit || 100)) * 100);
        if (usagePercent >= 90) {
          approvals.push({
            monitor_type: 'performance',
            title: `AI Quota ${usagePercent}% Used`,
            reason: `User AI quota at ${usagePercent}%, may hit limit soon`,
            effect: 'Increase daily limit by 50% to prevent service interruption',
            risk_level: usagePercent >= 100 ? 'critical' : 'medium',
            source_module: 'ai',
            ai_confidence: 88,
            action_payload: { user_id: quota.user_id, current_limit: quota.daily_limit, suggested_limit: Math.round((quota.daily_limit || 100) * 1.5) }
          });
        }
      }

      // Insert auto-approved items
      if (autoActions.length > 0) {
        await supabase.from('system_monitor_queue').insert(autoActions);
      }

      // Insert items needing approval (deduplicate by title)
      if (approvals.length > 0) {
        const { data: existing } = await supabase
          .from('system_monitor_queue')
          .select('title')
          .in('status', ['pending', 'approved'])
          .in('title', approvals.map(a => a.title));

        const existingTitles = new Set((existing || []).map((e: any) => e.title));
        const newApprovals = approvals.filter(a => !existingTitles.has(a.title));

        if (newApprovals.length > 0) {
          await supabase.from('system_monitor_queue').insert(newApprovals);
        }
      }

      // Save health snapshot
      const overallStatus = criticalErrors.length > 0 ? 'critical' : 
                            issues.length > 0 ? 'degraded' : 'healthy';

      await supabase.from('system_health_snapshots').insert({
        snapshot_type: 'full_system',
        status: overallStatus,
        metrics: {
          total_servers: servers?.length || 0,
          stale_servers: staleServers.length,
          unresolved_errors: recentErrors?.length || 0,
          critical_errors: criticalErrors.length,
          upcoming_bills: upcomingBills?.length || 0,
          unhealthy_products: unhealthyProducts?.length || 0,
        },
        issues_detected: issues.length + approvals.length,
        auto_actions_taken: autoActions.length,
        approvals_queued: approvals.length,
        details: { issues, autoActions: autoActions.length, approvals: approvals.length }
      });

      return new Response(JSON.stringify({
        status: overallStatus,
        issues_detected: issues.length,
        auto_actions: autoActions.length,
        approvals_queued: approvals.length,
        snapshot_saved: true
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============================================
    // ACTION: Approve Item
    // ============================================
    if (action === 'approve') {
      const { id, user_id } = data;
      const { error } = await supabase
        .from('system_monitor_queue')
        .update({ status: 'approved', approved_by: user_id, approved_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============================================
    // ACTION: Reject Item
    // ============================================
    if (action === 'reject') {
      const { id } = data;
      const { error } = await supabase
        .from('system_monitor_queue')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============================================
    // ACTION: Get Queue
    // ============================================
    if (action === 'get_queue') {
      const status = data?.status || 'pending';
      const limit = data?.limit || 50;

      const { data: queue, error } = await supabase
        .from('system_monitor_queue')
        .select('*')
        .eq('status', status)
        .order('risk_level', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return new Response(JSON.stringify({ queue }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============================================
    // ACTION: Get Stats
    // ============================================
    if (action === 'get_stats') {
      const [pending, approved, rejected, autoApproved, snapshots] = await Promise.all([
        supabase.from('system_monitor_queue').select('id', { count: 'exact' }).eq('status', 'pending'),
        supabase.from('system_monitor_queue').select('id', { count: 'exact' }).eq('status', 'approved'),
        supabase.from('system_monitor_queue').select('id', { count: 'exact' }).eq('status', 'rejected'),
        supabase.from('system_monitor_queue').select('id', { count: 'exact' }).eq('status', 'auto_approved'),
        supabase.from('system_health_snapshots').select('*').order('created_at', { ascending: false }).limit(1),
      ]);

      return new Response(JSON.stringify({
        stats: {
          pending: pending.count || 0,
          approved: approved.count || 0,
          rejected: rejected.count || 0,
          auto_approved: autoApproved.count || 0,
          last_health: snapshots.data?.[0] || null
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Auto-monitor error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
