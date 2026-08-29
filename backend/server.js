const http = require('node:http');
const crypto = require('node:crypto');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 8787);
const orders = new Map();
const geodataPath = path.join(__dirname, 'data', 'geodata.json');
let geodata = null;
try { geodata = JSON.parse(fs.readFileSync(geodataPath, 'utf8')); } catch { /* Run backend/setup-geodata.py first for worldwide data. */ }

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
      if (raw.length > 64 * 1024) req.destroy(new Error('Request too large'));
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
  const required = ['name', 'email', 'phone', 'address', 'barangay', 'region', 'city', 'postal', 'country'];
  for (const field of required) {
    if (typeof delivery[field] !== 'string' || delivery[field].trim().length < 2) return `delivery.${field} is required`;
  }
  if (!/^\S+@\S+\.\S+$/.test(delivery.email.trim())) return 'delivery.email is invalid';
  return { items, delivery, subtotal, currency: 'PHP' };
}

function sendConfirmationEmail(order) {
  if (process.env.EMAIL_ENABLED !== '1') return Promise.resolve(false);
  const host = process.env.SMTP_HOST || '127.0.0.1';
  const port = Number(process.env.SMTP_PORT || 1025);
  const delivery = order.delivery;
  const itemLines = order.items.map(item => `${item.quantity} x ${item.name} (${item.option}) — ₱${(item.unitPrice * item.quantity).toLocaleString('en-PH')}`).join('\n');
  const body = `Thank you for your order.\n\nOrder reference: ${order.id}\n\n${itemLines}\n\nSubtotal: ₱${order.subtotal.toLocaleString('en-PH')} ${order.currency}\n\nDelivery to:\n${delivery.name}\n${delivery.address}\n${delivery.barangay}, ${delivery.city}, ${delivery.region}\n${delivery.postal}, ${delivery.country}\n\nThis is a demo confirmation. No payment was taken.`;
  const message = `From: LOOT Demo <no-reply@loot.local>\r\nTo: ${delivery.email}\r\nSubject: LOOT demo order ${order.id}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body.replace(/^\./gm, '..')}\r\n.`;
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    let step = 0;
    const commands = [`EHLO loot.local`, `MAIL FROM:<no-reply@loot.local>`, `RCPT TO:<${delivery.email}>`, 'DATA', message, 'QUIT'];
    const finish = value => { socket.destroy(); resolve(value); };
    socket.setTimeout(5000, () => finish(false));
    socket.on('error', () => finish(false));
    socket.on('data', chunk => {
      if (step >= commands.length) return;
      const response = chunk.toString();
      if (!/^(?:220|235|250|354|221)/m.test(response)) return finish(false);
      const command = commands[step++];
      socket.write(`${command}\r\n`);
      if (step === commands.length) finish(true);
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && req.url === '/api/health') return send(res, 200, { ok: true, mode: 'demo', persistence: 'memory-only', payments: 'disabled' });
  if (req.method === 'GET' && req.url === '/api/products') return send(res, 200, { products });
  if (req.method === 'GET' && req.url === '/api/locations/status') return send(res, 200, { ok: true, source: geodata ? 'GeoNames' : 'not-built', countries: geodata?.countries.length || 0 });
  if (req.method === 'GET' && req.url === '/api/locations/countries') return send(res, 200, { countries: geodata?.countries || [] });
  if (req.method === 'GET' && req.url.startsWith('/api/locations/regions')) {
    const country = new URL(req.url, 'http://localhost').searchParams.get('country');
    return send(res, 200, { regions: geodata?.regions?.[country] || [] });
  }
  if (req.method === 'GET' && req.url.startsWith('/api/locations/cities')) {
    const query = new URL(req.url, 'http://localhost').searchParams;
    const country = query.get('country');
    const region = query.get('region');
    const search = (query.get('q') || '').trim().toLocaleLowerCase();
    const cities = geodata?.cities?.[`${country}.${region}`] || [];
    return send(res, 200, { cities: search ? cities.filter(city => city.name.toLocaleLowerCase().includes(search)).slice(0, 100) : cities.slice(0, 100) });
  }
  if (req.method === 'GET' && req.url.startsWith('/api/locations/postal-codes')) {
    const query = new URL(req.url, 'http://localhost').searchParams;
    const key = `${query.get('country')}.${query.get('region')}.${(query.get('city') || '').toLocaleLowerCase()}`;
    return send(res, 200, { postalCodes: geodata?.postal?.[key] || [] });
  }
  if (req.method === 'POST' && req.url === '/api/checkout/quote') {
    try {
      const input = await readJson(req);
      const validated = validateOrder(input);
      if (typeof validated === 'string') return send(res, 400, { ok: false, error: validated });
      const id = `DEMO-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const order = { id, status: 'demo_pending', createdAt: new Date().toISOString(), ...validated };
      orders.set(id, order);
      const emailSent = await sendConfirmationEmail(order);
      return send(res, 201, { ok: true, checkout: { id, status: order.status, subtotal: order.subtotal, currency: order.currency, items: order.items, emailSent } });
    } catch (error) {
      return send(res, 400, { ok: false, error: error.message });
    }
  }
  const match = req.method === 'GET' && req.url.match(/^\/api\/orders\/([^/]+)$/);
  if (match) {
    const order = orders.get(match[1]);
    return order ? send(res, 200, { ok: true, order: { ...order, delivery: '[redacted in response]' } }) : send(res, 404, { ok: false, error: 'order not found' });
  }
  return send(res, 404, { ok: false, error: 'not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Demo backend listening on http://0.0.0.0:${PORT}`);
  console.log('Payments disabled; order data is memory-only.');
});
