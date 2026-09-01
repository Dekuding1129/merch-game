require('dotenv').config();

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const PORT = Number(process.env.PORT || 8787);
const defaultOrders = new Map();
const defaultSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY)
  : null;
const geodataPath = path.join(__dirname, 'data', 'geodata.json');
let geodata = null;
try { geodata = JSON.parse(fs.readFileSync(geodataPath, 'utf8')); } catch { /* Optional generated location data. */ }

const products = {
  'mizrach-pinaz-t-shirt': { name: 'Mizrach Pinaz T-Shirt', price: 2617, options: ['XS', 'S', 'M', 'L', 'XL', '2XL'] },
  'mizrach-pinaz-tumbler': { name: 'Mizrach Pinaz Tumbler', price: 1745, options: ['One size'] },
  'mizrach-pinaz-hoodie': { name: 'Mizrach Pinaz Hoodie', price: 4237, options: ['XS', 'S', 'M', 'L', 'XL', '2XL'] },
  'mizrach-pinaz-keychain': { name: 'Mizrach Pinaz Keychain', price: 1121, options: ['One size'] }
};

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': process.env.FRONTEND_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 64 * 1024) { req.destroy(new Error('Request too large')); }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function validateOrder(input) {
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 20) return 'items must contain 1–20 products';
  const items = [];
  let subtotal = 0;
  for (const item of input.items) {
    const product = products[item.sku];
    const quantity = Number(item.quantity);
    if (!product) return `unknown SKU: ${item.sku}`;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return 'quantity must be an integer from 1 to 10';
    if (!product.options.includes(item.option)) return `${product.name} has an invalid option`;
    items.push({ sku: item.sku, name: product.name, option: item.option, quantity, unitPrice: product.price });
    subtotal += product.price * quantity;
  }
  const delivery = input.delivery || {};
  for (const field of ['name', 'email', 'phone', 'address', 'barangay', 'region', 'city', 'postal', 'country']) {
    if (typeof delivery[field] !== 'string' || delivery[field].trim().length < 2) return `delivery.${field} is required`;
  }
  if (!/^\S+@\S+\.\S+$/.test(delivery.email.trim())) return 'delivery.email is invalid';
  return { items, delivery, subtotal, currency: 'PHP' };
}

function displaySession(order) {
  return { orderId: order.id, items: order.items, subtotal: order.subtotal, currency: order.currency, paymentStatus: order.payment_status || order.paymentStatus || 'pending' };
}

function createApp({ supabase = defaultSupabase, orders = defaultOrders, sendEmail } = {}) {
  async function findOrderById(id) {
    if (supabase) {
      const { data, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error('Could not read the order');
      return data;
    }
    return orders.get(id) || null;
  }

  async function findOrderBySession(sessionId) {
    if (supabase) {
      const { data, error } = await supabase.from('orders').select('*').eq('payment_session_id', sessionId).maybeSingle();
      if (error) throw new Error('Could not read the payment session');
      return data;
    }
    return [...orders.values()].find(order => order.payment_session_id === sessionId || order.paymentSessionId === sessionId) || null;
  }

  async function saveOrderPatch(order, patch) {
    if (supabase) {
      const { data, error } = await supabase.from('orders').update(patch).eq('id', order.id).select('*').single();
      if (error) throw new Error('Could not update the order');
      return data;
    }
    const updated = { ...order, ...patch };
    orders.set(order.id, updated);
    return updated;
  }

  async function createPaymentSession(req, res) {
    const body = await readJson(req);
    if (typeof body.orderId !== 'string' || !body.orderId) return send(res, 400, { ok: false, error: 'orderId is required' });
    const order = await findOrderById(body.orderId);
    if (!order) return send(res, 404, { ok: false, error: 'order not found' });
    const paymentStatus = order.payment_status || order.paymentStatus;
    if (order.status !== 'pending_payment' || paymentStatus !== 'pending') return send(res, 409, { ok: false, error: 'order is not pending payment' });
    const paymentSessionId = order.payment_session_id || `local_${crypto.randomBytes(18).toString('hex')}`;
    if (!order.payment_session_id) await saveOrderPatch(order, { payment_session_id: paymentSessionId });
    return send(res, 201, { ok: true, paymentSessionId, paymentUrl: `/test-payment/${paymentSessionId}` });
  }

  async function getPaymentSession(req, res, sessionId) {
    const order = await findOrderBySession(sessionId);
    return order ? send(res, 200, { ok: true, session: displaySession(order) }) : send(res, 404, { ok: false, error: 'payment session not found' });
  }

  async function sendReceiptEmail(order) {
    if (process.env.EMAIL_ENABLED !== '1' || !order.customer_email) return false;
    const host = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER || process.env.BREVO_SMTP_USER;
    const pass = process.env.SMTP_PASSWORD || process.env.BREVO_SMTP_KEY;
    const from = process.env.EMAIL_FROM || process.env.BREVO_SENDER_EMAIL || user;
    if (!user || !pass || !from) return false;
    const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
    const itemRows = (order.items || []).map(item => `<tr><td>${escapeHtml(item.name)}<br><small>${escapeHtml(item.option)} · ×${escapeHtml(item.quantity)}</small></td><td>₱${Number(item.unitPrice * item.quantity).toLocaleString('en-PH')}</td></tr>`).join('');
    const html = `<!doctype html><html><body style="margin:0;background:#111319;color:#f5f6fa;font-family:Arial,sans-serif"><div style="max-width:620px;margin:0 auto;padding:32px 20px"><div style="border:1px solid #353943;background:#171a22;padding:32px"><p style="margin:0;color:#d7ff45;font-size:12px;font-weight:bold;letter-spacing:3px">LOOT / PAYMENT RECEIPT</p><h1 style="margin:18px 0 8px;font-size:32px;color:#fff">Payment received</h1><p style="margin:0 0 28px;color:#aeb2bc;line-height:1.6">Thank you for your order. Your local test payment was recorded successfully.</p><div style="border:1px solid #30343d;background:#0d0f14;padding:20px"><p style="margin:0 0 16px;color:#aeb2bc;font-size:12px;text-transform:uppercase;letter-spacing:1px">Order reference</p><p style="margin:0;color:#fff;font-family:monospace;word-break:break-all">${escapeHtml(order.id)}</p><table style="width:100%;margin-top:20px;border-collapse:collapse;color:#f5f6fa"><tbody>${itemRows}</tbody><tfoot><tr><td style="border-top:1px solid #30343d;padding-top:16px;color:#f0d6a0;font-weight:bold">Total</td><td style="border-top:1px solid #30343d;padding-top:16px;color:#f0d6a0;font-weight:bold;text-align:right">₱${Number(order.subtotal).toLocaleString('en-PH')} ${escapeHtml(order.currency)}</td></tr></tfoot></table></div><p style="margin:24px 0 0;color:#aeb2bc;font-size:12px;line-height:1.6">This is a local test receipt. No real money was charged and no order will be fulfilled.</p></div></div></body></html>`;
    const transporter = nodemailer.createTransport({ host, port, secure: port === 465, requireTLS: port === 587, auth: { user, pass }, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 5000 });
    try {
      await transporter.sendMail({ from: `LOOT <${from}>`, to: order.customer_email, subject: `LOOT payment receipt ${order.id}`, html });
      return true;
    } catch (error) {
      console.error('Receipt email failed:', error.message);
      return false;
    }
  }
  const emailSender = sendEmail || sendReceiptEmail;

  async function completePayment(req, res, sessionId) {
    const body = await readJson(req);
    if (!['success', 'failed', 'cancelled'].includes(body.result)) return send(res, 400, { ok: false, error: 'result must be success, failed, or cancelled' });
    const order = await findOrderBySession(sessionId);
    if (!order) return send(res, 404, { ok: false, error: 'payment session not found' });
    const currentPaymentStatus = order.payment_status || order.paymentStatus;
    if (order.status !== 'pending_payment' || currentPaymentStatus !== 'pending') return send(res, 409, { ok: false, error: 'payment session already completed' });
    const patch = body.result === 'success'
      ? { status: 'paid', payment_status: 'paid', paid_at: new Date().toISOString() }
      : { status: body.result === 'failed' ? 'payment_failed' : 'cancelled', payment_status: body.result === 'failed' ? 'failed' : 'cancelled' };
    const updated = await saveOrderPatch(order, patch);
    const emailSent = body.result === 'success' ? await emailSender(updated) : false;
    return send(res, 200, { ok: true, paymentStatus: updated.payment_status || patch.payment_status, status: updated.status || patch.status, emailSent });
  }

  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    try {
      if (req.method === 'GET' && req.url === '/api/health') return send(res, 200, { ok: true, mode: supabase ? 'supabase-demo' : 'demo', persistence: supabase ? 'supabase' : 'memory-only', payments: 'local-test-only' });
      if (req.method === 'GET' && req.url === '/api/products') return send(res, 200, { products });
      if (req.method === 'GET' && req.url === '/api/locations/status') return send(res, 200, { ok: true, source: geodata ? 'GeoNames' : 'not-built', countries: geodata?.countries.length || 0 });
      if (req.method === 'GET' && req.url === '/api/locations/countries') return send(res, 200, { countries: geodata?.countries || [] });
      if (req.method === 'GET' && req.url.startsWith('/api/locations/regions')) {
        const country = new URL(req.url, 'http://localhost').searchParams.get('country');
        return send(res, 200, { regions: geodata?.regions?.[country] || [] });
      }
      if (req.method === 'GET' && req.url.startsWith('/api/locations/cities')) {
        const query = new URL(req.url, 'http://localhost').searchParams;
        const cities = geodata?.cities?.[`${query.get('country')}.${query.get('region')}`] || [];
        const search = (query.get('q') || '').trim().toLocaleLowerCase();
        return send(res, 200, { cities: search ? cities.filter(city => city.name.toLocaleLowerCase().includes(search)).slice(0, 100) : cities.slice(0, 100) });
      }
      if (req.method === 'GET' && req.url.startsWith('/api/locations/postal-codes')) {
        const query = new URL(req.url, 'http://localhost').searchParams;
        const key = `${query.get('country')}.${query.get('region')}.${(query.get('city') || '').toLocaleLowerCase()}`;
        return send(res, 200, { postalCodes: geodata?.postal?.[key] || [] });
      }
      if (req.method === 'POST' && req.url === '/api/checkout/quote') {
        const validated = validateOrder(await readJson(req));
        if (typeof validated === 'string') return send(res, 400, { ok: false, error: validated });
        const id = crypto.randomUUID();
        const order = { id, status: 'pending_payment', createdAt: new Date().toISOString(), ...validated };
        const row = { id, status: order.status, payment_provider: 'local_test', payment_status: 'pending', paid_at: null, customer_name: order.delivery.name, customer_email: order.delivery.email, customer_phone: order.delivery.phone, delivery_address: order.delivery.address, delivery_barangay: order.delivery.barangay, delivery_city: order.delivery.city, delivery_region: order.delivery.region, delivery_postal: order.delivery.postal, delivery_country: order.delivery.country, subtotal: order.subtotal, currency: order.currency, items: order.items };
        if (supabase) {
          const { error } = await supabase.from('orders').insert(row);
          if (error) { console.error('Supabase order insert failed:', error.message); return send(res, 502, { ok: false, error: 'Could not save the order' }); }
        } else orders.set(id, { ...order, payment_provider: 'local_test', payment_status: 'pending' });
        return send(res, 201, { ok: true, checkout: { id, status: order.status, subtotal: order.subtotal, currency: order.currency, items: order.items } });
      }
      if (req.method === 'POST' && req.url === '/api/payments/create-test-session') return await createPaymentSession(req, res);
      const completeMatch = req.url.match(/^\/api\/payments\/test-session\/([^/]+)\/complete$/);
      if (completeMatch && req.method === 'POST') return await completePayment(req, res, completeMatch[1]);
      const lookup = req.url.match(/^\/api\/payments\/test-session\/([^/]+)$/);
      if (lookup && req.method === 'GET') return await getPaymentSession(req, res, lookup[1]);
      const orderMatch = req.method === 'GET' && req.url.match(/^\/api\/orders\/([^/]+)$/);
      if (orderMatch) {
        const order = await findOrderById(orderMatch[1]);
        if (!order) return send(res, 404, { ok: false, error: 'order not found' });
        return send(res, 200, { ok: true, order: { id: order.id, status: order.status, subtotal: order.subtotal, currency: order.currency, items: order.items, createdAt: order.created_at || order.createdAt, delivery: '[redacted in response]' } });
      }
      return send(res, 404, { ok: false, error: 'not found' });
    } catch (error) {
      return send(res, error.message.startsWith('Could not') ? 502 : 400, { ok: false, error: error.message });
    }
  });
}

if (require.main === module) {
  createApp().listen(PORT, '0.0.0.0', () => {
    console.log(`Demo backend listening on http://0.0.0.0:${PORT}`);
    console.log(`Persistence: ${defaultSupabase ? 'Supabase' : 'memory-only'}; payments: local test only.`);
  });
}

module.exports = { createApp, products, validateOrder };
