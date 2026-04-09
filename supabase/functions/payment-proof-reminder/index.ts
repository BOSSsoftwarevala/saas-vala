import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

async function postWithRetry(url: string, init: RequestInit, retries = 3): Promise<Response> {
  let lastError: unknown = null;
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      const body = await res.text().catch(() => '');
      lastError = new Error(`HTTP ${res.status}: ${body}`);
    } catch (err) {
      lastError = err;
    }
    if (i < retries) await new Promise((r) => setTimeout(r, i * 600));
  }
  throw lastError ?? new Error('Request failed after retries');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const adminEmail = Deno.env.get('ADMIN_EMAIL') ?? 'admin@softwarevala.com';
    const webhookUrl = Deno.env.get('ADMIN_NOTIFICATION_WEBHOOK_URL') ?? '';

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const olderThanHours = Number(body?.older_than_hours ?? Deno.env.get('PROOF_REMINDER_HOURS') ?? '6');
    const cooldownHours = Number(body?.cooldown_hours ?? Deno.env.get('PROOF_REMINDER_COOLDOWN_HOURS') ?? '6');
    const limit = Math.min(200, Number(body?.limit ?? 120));

    const thresholdDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await (admin as any)
      .from('transactions')
      .select('id,type,amount,created_at,reference_id,reference_type,meta')
      .eq('status', 'pending')
      .in('reference_type', ['wise_transfer', 'bank_transfer', 'upi', 'crypto_transfer', 'remit_transfer'])
      .lte('created_at', thresholdDate)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    const now = Date.now();
    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    const due = (rows ?? []).filter((tx: any) => {
      const last = tx?.meta?.reminder_last_sent_at ? Date.parse(String(tx.meta.reminder_last_sent_at)) : 0;
      return !last || Number.isNaN(last) || (now - last) >= cooldownMs;
    });

    if (!due.length) {
      return new Response(JSON.stringify({ success: true, due: 0, notified: 0 }), { headers: corsHeaders });
    }

    const { data: adminRoles } = await admin
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'super_admin']);

    const adminUserIds: string[] = (adminRoles ?? []).map((r: { user_id: string }) => r.user_id);

    const notifications: any[] = [];
    for (const tx of due) {
      const hrsWaiting = Math.floor((now - Date.parse(String(tx.created_at))) / (60 * 60 * 1000));
      for (const uid of adminUserIds) {
        notifications.push({
          user_id: uid,
          title: 'Pending Payment Proof Reminder',
          message: `Tx ${tx.id.slice(0, 8)}... (${String(tx.reference_type || 'manual').replace(/_/g, ' ')}) is pending for ${hrsWaiting}h. Amount: ₹${Number(tx.amount || 0).toLocaleString('en-IN')}.`,
          type: 'warning',
          action_url: '/wallet',
          created_at: new Date().toISOString(),
        });
      }
    }

    if (notifications.length) {
      await (admin as any).from('notifications').insert(notifications);
    }

    let emailSent = false;
    let webhookSent = false;

    if (resendApiKey) {
      try {
        const rowsHtml = due.slice(0, 25).map((tx: any) => {
          const method = String(tx.reference_type || 'manual').replace(/_/g, ' ');
          return `<tr><td style="padding:6px 10px"><code>${tx.id}</code></td><td style="padding:6px 10px">${method}</td><td style="padding:6px 10px">₹${Number(tx.amount || 0).toLocaleString('en-IN')}</td><td style="padding:6px 10px">${tx.created_at}</td></tr>`;
        }).join('');

        const html = `
          <h2 style="color:#f97316">Pending Payment Proof Reminder</h2>
          <p><b>${due.length}</b> payment proof(s) are still pending verification.</p>
          <table style="border-collapse:collapse;font-family:sans-serif;font-size:13px">
            <thead><tr><th style="padding:6px 10px;text-align:left">Transaction</th><th style="padding:6px 10px;text-align:left">Method</th><th style="padding:6px 10px;text-align:left">Amount</th><th style="padding:6px 10px;text-align:left">Created</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <p style="margin-top:16px"><a href="https://softwarevala.com/wallet" style="background:#f97316;color:white;padding:10px 20px;border-radius:6px;text-decoration:none">Review Pending Proofs</a></p>
        `.trim();

        await postWithRetry('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'SoftwareVala <noreply@softwarevala.com>',
            to: [adminEmail],
            subject: `[Reminder] ${due.length} payment proof(s) pending review`,
            html,
          }),
        }, 3);
        emailSent = true;
      } catch (e) {
        console.warn('[payment-proof-reminder] Email failed:', e);
      }
    }

    if (webhookUrl && !emailSent) {
      try {
        await postWithRetry(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'payment_proof_reminder',
            pending_count: due.length,
            transaction_ids: due.map((tx: any) => tx.id),
            threshold_hours: olderThanHours,
            cooldown_hours: cooldownHours,
            sent_at: new Date().toISOString(),
          }),
        }, 3);
        webhookSent = true;
      } catch (e) {
        console.warn('[payment-proof-reminder] Webhook failed:', e);
      }
    }

    for (const tx of due) {
      const oldMeta = (tx.meta || {}) as Record<string, unknown>;
      const reminderCount = Number(oldMeta.reminder_count ?? 0) + 1;
      await (admin as any)
        .from('transactions')
        .update({
          meta: {
            ...oldMeta,
            reminder_count: reminderCount,
            reminder_last_sent_at: new Date().toISOString(),
          },
        })
        .eq('id', tx.id)
        .eq('status', 'pending');
    }

    return new Response(
      JSON.stringify({
        success: true,
        due: due.length,
        notified: notifications.length,
        email_sent: emailSent,
        webhook_sent: webhookSent,
      }),
      { headers: corsHeaders },
    );
  } catch (err: any) {
    console.error('[payment-proof-reminder] Fatal error:', err);
    return new Response(JSON.stringify({ success: false, error: err?.message ?? 'Unknown error' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
