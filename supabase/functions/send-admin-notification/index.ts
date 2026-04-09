/**
 * send-admin-notification edge function
 *
 * Called after a user submits a manual payment proof (Wise / UPI / Bank / etc.).
 * 1. Inserts in-app notifications for every admin/super_admin user.
 * 2. Sends an email via Resend (optional — only when RESEND_API_KEY is set).
 *
 * POST /functions/v1/send-admin-notification
 * Body: {
 *   transaction_id : string
 *   amount         : number
 *   payment_method : string  (e.g. "wise", "upi", "bank")
 *   reference_id   : string
 *   user_email     : string
 *   product_title? : string   (when payment is for a product, not wallet top-up)
 *   context?       : "wallet_topup" | "product_purchase"
 * }
 */

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
    if (i < retries) {
      await new Promise((r) => setTimeout(r, i * 600));
    }
  }
  throw lastError ?? new Error('Request failed after retries');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const adminEmail = Deno.env.get('ADMIN_EMAIL') ?? 'admin@softwarevala.com';
    const adminEmailBackup = Deno.env.get('ADMIN_EMAIL_BACKUP') ?? '';
    const notificationWebhookUrl = Deno.env.get('ADMIN_NOTIFICATION_WEBHOOK_URL') ?? '';
    const emailRetryMax = Number(Deno.env.get('EMAIL_RETRY_MAX') ?? '3');

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = await req.json();
    const {
      transaction_id,
      amount,
      payment_method = 'manual',
      reference_id = '',
      user_email = 'unknown',
      product_title = '',
      context = 'wallet_topup',
    } = body as {
      transaction_id: string;
      amount: number;
      payment_method: string;
      reference_id: string;
      user_email: string;
      product_title: string;
      context: string;
    };

    const amountStr = `₹${Number(amount || 0).toLocaleString('en-IN')}`;
    const methodLabel = payment_method.replace(/_/g, ' ').toUpperCase();
    const ctxLabel = context === 'product_purchase'
      ? `Product purchase: ${product_title || 'unknown'}`
      : 'Wallet top-up';

    const notificationTitle = `New ${methodLabel} Payment Proof`;
    const notificationMessage =
      `${user_email} submitted ${amountStr} via ${methodLabel} — ${ctxLabel}. ` +
      `Reference: ${reference_id || 'N/A'}. Please verify in Admin → Wallet.`;

    // ── 1. Fetch all admin / super_admin user IDs ────────────────────────────
    const { data: adminRoles } = await admin
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'super_admin']);

    const adminUserIds: string[] = (adminRoles ?? []).map((r: { user_id: string }) => r.user_id);

    // ── 2. Insert in-app notifications for each admin ────────────────────────
    if (adminUserIds.length > 0) {
      const notifications = adminUserIds.map((uid) => ({
        user_id: uid,
        title: notificationTitle,
        message: notificationMessage,
        type: 'warning',
        action_url: '/wallet',
        created_at: new Date().toISOString(),
      }));

      await (admin as any).from('notifications').insert(notifications);
    }

    // ── 3. Log to activity_logs ──────────────────────────────────────────────
    await (admin as any).from('activity_logs').insert({
      entity_type: 'transaction',
      entity_id: transaction_id,
      action: 'payment_proof_submitted',
      performed_by: null,
      details: {
        amount,
        payment_method,
        reference_id,
        user_email,
        context,
        product_title: product_title || null,
      },
    }).catch(() => { /* non-critical */ });

    // ── 4. Send email via Resend with retry (optional) ───────────────────────
    let emailSent = false;
    let emailError = '';
    if (resendApiKey) {
      try {
        const emailBody = `
<h2 style="color:#f97316">New Payment Proof Submitted</h2>
<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
  <tr><td style="padding:6px 12px;color:#666">User</td><td style="padding:6px 12px"><b>${user_email}</b></td></tr>
  <tr><td style="padding:6px 12px;color:#666">Amount</td><td style="padding:6px 12px"><b>${amountStr}</b></td></tr>
  <tr><td style="padding:6px 12px;color:#666">Method</td><td style="padding:6px 12px">${methodLabel}</td></tr>
  <tr><td style="padding:6px 12px;color:#666">Reference</td><td style="padding:6px 12px">${reference_id || 'N/A'}</td></tr>
  <tr><td style="padding:6px 12px;color:#666">Context</td><td style="padding:6px 12px">${ctxLabel}</td></tr>
  <tr><td style="padding:6px 12px;color:#666">Transaction ID</td><td style="padding:6px 12px"><code>${transaction_id}</code></td></tr>
</table>
<p style="margin-top:16px"><a href="https://softwarevala.com/wallet" style="background:#f97316;color:white;padding:10px 20px;border-radius:6px;text-decoration:none">Review in Admin Panel →</a></p>
        `.trim();

        const recipients = [adminEmail, adminEmailBackup].filter(Boolean);
        await postWithRetry(
          'https://api.resend.com/emails',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'SoftwareVala <noreply@softwarevala.com>',
              to: recipients,
              subject: `[Action Required] ${methodLabel} Payment — ${amountStr} from ${user_email}`,
              html: emailBody,
            }),
          },
          emailRetryMax,
        );
        emailSent = true;
      } catch (emailErr) {
        emailSent = false;
        emailError = String(emailErr ?? 'unknown email error');
        console.warn('[send-admin-notification] Email send failed (non-critical):', emailErr);
      }
    }

    // ── 5. Optional webhook fallback when email fails ────────────────────────
    let webhookSent = false;
    let webhookError = '';
    if (notificationWebhookUrl && !emailSent) {
      try {
        await postWithRetry(
          notificationWebhookUrl,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'payment_proof_submitted',
              transaction_id,
              amount,
              amount_label: amountStr,
              payment_method,
              reference_id,
              user_email,
              context,
              product_title,
              notification_title: notificationTitle,
              notification_message: notificationMessage,
              timestamp: new Date().toISOString(),
              fallback_reason: 'email_failed',
            }),
          },
          3,
        );
        webhookSent = true;
      } catch (err) {
        webhookError = String(err ?? 'webhook failure');
        console.warn('[send-admin-notification] Webhook fallback failed:', err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        admins_notified: adminUserIds.length,
        email_sent: emailSent,
        email_error: emailError || null,
        webhook_sent: webhookSent,
        webhook_error: webhookError || null,
      }),
      { headers: corsHeaders },
    );
  } catch (err: any) {
    console.error('[send-admin-notification] Fatal error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? 'Unknown error' }),
      { status: 500, headers: corsHeaders },
    );
  }
});
