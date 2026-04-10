const base = 'https://fufriwpzypqzangcfmqu.supabase.co';
const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1ZnJpd3B6eXBxemFuZ2NmbXF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjcwMDMsImV4cCI6MjA5MTMwMzAwM30.sbWOvxdH3qvhfwE9IxuSsuoo66MXPEfjUUr1Ifm_JIA';
const service = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1ZnJpd3B6eXBxemFuZ2NmbXF1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTcyNzAwMywiZXhwIjoyMDkxMzAzMDAzfQ.uZtkDBpOvfBzi64Q8nLiw47mqcPwGmyMU1psCtMdA-4';
const productId = 'b002ce0a-866b-4ddb-a0b6-bc4439c6795e';

async function post(url, headers, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

async function get(url, headers) {
  const res = await fetch(url, { headers });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

const signin = await post(`${base}/auth/v1/token?grant_type=password`, { apikey: anon }, {
  email: 'flowtester@softwarevala.com',
  password: 'Flow@Test#2026',
});

console.log('SIGNIN', signin.status, signin.data.error || 'ok');
if (!signin.ok) process.exit(1);

const access = signin.data.access_token;
const idem = crypto.randomUUID();

const init = await post(
  `${base}/functions/v1/api-gateway/marketplace/payments/initiate`,
  { apikey: anon, authorization: `Bearer ${access}`, 'x-idempotency-key': idem },
  { product_id: productId, duration_days: 30, payment_method: 'wise', amount: 5, idempotency_key: idem },
);
console.log('INIT', init.status, init.data);
if (!init.ok) process.exit(1);

const txRef = `E2E-${Date.now()}`;
const verify = await post(
  `${base}/functions/v1/api-gateway/marketplace/payments/verify`,
  { apikey: anon, authorization: `Bearer ${access}` },
  { order_id: init.data.order_id, transaction_ref: txRef, provider: 'wise' },
);
console.log('VERIFY', verify.status, verify.data);
if (!verify.ok) process.exit(1);

const verify2 = await post(
  `${base}/functions/v1/api-gateway/marketplace/payments/verify`,
  { apikey: anon, authorization: `Bearer ${access}` },
  { order_id: init.data.order_id, transaction_ref: txRef, provider: 'wise' },
);
console.log('VERIFY2', verify2.status, verify2.data);

const download = await post(
  `${base}/functions/v1/api-gateway/marketplace/download-apk`,
  { apikey: anon, authorization: `Bearer ${access}` },
  { product_id: productId },
);
console.log('DOWNLOAD', download.status, download.data);

const order = await get(
  `${base}/rest/v1/orders?id=eq.${init.data.order_id}&select=id,payment_status,license_key_id,completed_at,user_id`,
  { apikey: service, authorization: `Bearer ${service}` },
);
console.log('ORDER', order.status, order.data);

if (order.ok && Array.isArray(order.data) && order.data[0]?.license_key_id) {
  const license = await get(
    `${base}/rest/v1/license_keys?id=eq.${order.data[0].license_key_id}&select=id,license_key,status,expires_at,product_id,created_by`,
    { apikey: service, authorization: `Bearer ${service}` },
  );
  console.log('LICENSE', license.status, license.data);
}
