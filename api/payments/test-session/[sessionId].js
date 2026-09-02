const { createApp } = require('../../../backend/server');
const app = createApp();
module.exports = (req, res) => {
  const sessionId = req.query?.sessionId || req.url.split('/').filter(Boolean).pop();
  const query = req.url && req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  req.url = `/api/payments/test-session/${encodeURIComponent(sessionId)}${query}`;
  return app.emit('request', req, res);
};
