const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../backend/server');

function makeDb(seed = []) {
  const rows = new Map(seed.map(row => [row.id, structuredClone(row)]));
  return {
    rows,
    from(table) {
      assert.equal(table, 'orders');
      return {
        insert: (payload) => ({
          select: () => ({
            single: async () => {
              rows.set(payload.id, structuredClone(payload));
              return { data: payload, error: null };
            }
          }),
          then: (resolve) => { rows.set(payload.id, structuredClone(payload)); return resolve({ data: [payload], error: null }); }
        }),
        select: (columns) => {
          const state = { column: null, value: null };
          const builder = {
            eq: (column, value) => { state.column = column; state.value = value; return builder; },
            maybeSingle: async () => ({ data: [...rows.values()].find(row => row[state.column] === state.value) || null, error: null }),
            single: async () => ({ data: [...rows.values()].find(row => row[state.column] === state.value) || null, error: [...rows.values()].some(row => row[state.column] === state.value) ? null : { message: 'not found' } })
          };
          return builder;
        },
        update: (patch) => {
          const state = { column: null, value: null };
          const builder = {
            eq: (column, value) => { state.column = column; state.value = value; return builder; },
            select: () => ({ single: async () => {
              const current = [...rows.values()].find(row => row[state.column] === state.value);
              if (!current) return { data: null, error: { message: 'not found' } };
              const updated = { ...current, ...patch };
              rows.set(current.id, updated);
              return { data: updated, error: null };
            } })
          };
          return builder;
        }
      };
    }
  };
}

async function startApp(db) {
  const server = createApp({ supabase: db, orders: db.rows });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

async function request(base, method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  return { response, data: await response.json() };
}

function seededOrder(overrides = {}) {
  return {
    id: 'order-1', status: 'pending_payment', payment_status: 'pending', payment_provider: 'local_test',
    subtotal: 2617, currency: 'PHP', items: [{ sku: 'mizrach-pinaz-t-shirt', name: 'Mizrach Pinaz T-Shirt', option: 'M', quantity: 1, unitPrice: 2617 }],
    delivery_address: 'PRIVATE', customer_email: 'private@example.com', ...overrides
  };
}

test('creates a local payment session for a pending order', async t => {
  const db = makeDb([seededOrder()]);
  const { server, base } = await startApp(db); t.after(() => server.close());
  const { response, data } = await request(base, 'POST', '/api/payments/create-test-session', { orderId: 'order-1' });
  assert.equal(response.status, 201); assert.equal(data.ok, true);
  assert.match(data.paymentSessionId, /^local_/); assert.equal(data.paymentUrl, `/test-payment/${data.paymentSessionId}`);
  assert.equal(db.rows.get('order-1').payment_session_id, data.paymentSessionId);
});

test('successful payment changes the order to paid', async t => {
  const db = makeDb([seededOrder()]); const { server, base } = await startApp(db); t.after(() => server.close());
  const created = await request(base, 'POST', '/api/payments/create-test-session', { orderId: 'order-1' });
  const result = await request(base, 'POST', `/api/payments/test-session/${created.data.paymentSessionId}/complete`, { result: 'success' });
  assert.equal(result.response.status, 200); assert.equal(result.data.paymentStatus, 'paid');
  assert.equal(db.rows.get('order-1').status, 'paid'); assert.equal(db.rows.get('order-1').payment_status, 'paid');
  assert.ok(db.rows.get('order-1').paid_at);
});

test('successful payment sends a receipt through the injected email sender', async t => {
  const db = makeDb([seededOrder()]);
  const sent = [];
  const server = createApp({ supabase: db, orders: db.rows, sendEmail: async order => { sent.push(order); return true; } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const created = await request(base, 'POST', '/api/payments/create-test-session', { orderId: 'order-1' });
  const result = await request(base, 'POST', `/api/payments/test-session/${created.data.paymentSessionId}/complete`, { result: 'success' });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.emailSent, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].customer_email, 'private@example.com');
});

test('failed payment changes the order to payment_failed', async t => {
  const db = makeDb([seededOrder()]); const { server, base } = await startApp(db); t.after(() => server.close());
  const created = await request(base, 'POST', '/api/payments/create-test-session', { orderId: 'order-1' });
  const result = await request(base, 'POST', `/api/payments/test-session/${created.data.paymentSessionId}/complete`, { result: 'failed' });
  assert.equal(result.response.status, 200); assert.equal(db.rows.get('order-1').status, 'payment_failed'); assert.equal(db.rows.get('order-1').payment_status, 'failed');
});

test('cancelled payment changes the order to cancelled', async t => {
  const db = makeDb([seededOrder()]); const { server, base } = await startApp(db); t.after(() => server.close());
  const created = await request(base, 'POST', '/api/payments/create-test-session', { orderId: 'order-1' });
  const result = await request(base, 'POST', `/api/payments/test-session/${created.data.paymentSessionId}/complete`, { result: 'cancelled' });
  assert.equal(result.response.status, 200); assert.equal(db.rows.get('order-1').status, 'cancelled'); assert.equal(db.rows.get('order-1').payment_status, 'cancelled');
});

test('repeated payment completion is rejected without changing the result', async t => {
  const db = makeDb([seededOrder()]); const { server, base } = await startApp(db); t.after(() => server.close());
  const created = await request(base, 'POST', '/api/payments/create-test-session', { orderId: 'order-1' });
  await request(base, 'POST', `/api/payments/test-session/${created.data.paymentSessionId}/complete`, { result: 'success' });
  const repeated = await request(base, 'POST', `/api/payments/test-session/${created.data.paymentSessionId}/complete`, { result: 'failed' });
  assert.equal(repeated.response.status, 409); assert.equal(db.rows.get('order-1').payment_status, 'paid');
});

test('payment session lookup redacts delivery details', async t => {
  const db = makeDb([seededOrder()]); const { server, base } = await startApp(db); t.after(() => server.close());
  const created = await request(base, 'POST', '/api/payments/create-test-session', { orderId: 'order-1' });
  const result = await request(base, 'GET', `/api/payments/test-session/${created.data.paymentSessionId}`);
  assert.equal(result.response.status, 200); assert.deepEqual(Object.keys(result.data.session).sort(), ['currency', 'items', 'orderId', 'paymentStatus', 'subtotal']);
  assert.doesNotMatch(JSON.stringify(result.data), /PRIVATE|private@example/);
});

test('invalid payment result returns 400', async t => {
  const db = makeDb([seededOrder()]); const { server, base } = await startApp(db); t.after(() => server.close());
  const created = await request(base, 'POST', '/api/payments/create-test-session', { orderId: 'order-1' });
  const result = await request(base, 'POST', `/api/payments/test-session/${created.data.paymentSessionId}/complete`, { result: 'maybe' });
  assert.equal(result.response.status, 400);
});

test('unknown payment session returns 404', async t => {
  const db = makeDb([seededOrder()]); const { server, base } = await startApp(db); t.after(() => server.close());
  const result = await request(base, 'GET', '/api/payments/test-session/local_missing');
  assert.equal(result.response.status, 404);
});
