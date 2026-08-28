const http = require('node:http');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 8787);
const orders = new Map();

const products = {
  'mizrach-pinaz-t-shirt': { name: 'Mizrach Pinaz T-Shirt', price: 42, options: ['XS', 'S', 'M', 'L', 'XL', '2XL'] },
  'mizrach-pinaz-tumbler': { name: 'Mizrach Pinaz Tumbler', price: 28, options: ['One size'] },
  'mizrach-pinaz-hoodie': { name: 'Mizrach Pinaz Hoodie', price: 68, options: ['XS', 'S', 'M', 'L', 'XL', '2XL'] },
  'mizrach-pinaz-keychain': { name: 'Mizrach Pinaz Keychain', price: 18, options: ['One size'] }
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
  const required = ['name', 'email', 'phone', 'address', 'region', 'city', 'postal', 'country'];
  for (const field of required) {
    if (typeof delivery[field] !== 'string' || delivery[field].trim().length < 2) return `delivery.${field} is required`;
  }
  if (!/^\S+@\S+\.\S+$/.test(delivery.email.trim())) return 'delivery.email is invalid';
  return { items, delivery, subtotal, currency: 'USD' };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && req.url === '/api/health') return send(res, 200, { ok: true, mode: 'demo', persistence: 'memory-only', payments: 'disabled' });
  if (req.method === 'GET' && req.url === '/api/products') return send(res, 200, { products });
  if (req.method === 'POST' && req.url === '/api/checkout/quote') {
    try {
      const input = await readJson(req);
      const validated = validateOrder(input);
      if (typeof validated === 'string') return send(res, 400, { ok: false, error: validated });
      const id = `DEMO-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const order = { id, status: 'demo_pending', createdAt: new Date().toISOString(), ...validated };
      orders.set(id, order);
      return send(res, 201, { ok: true, checkout: { id, status: order.status, subtotal: order.subtotal, currency: order.currency, items: order.items } });
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
