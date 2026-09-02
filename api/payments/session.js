const { createApp } = require('../../backend/server');
const app = createApp();
module.exports = (req, res) => {
  const sessionId = req.query?.session || '';
  req.url = `/api/payments/test-session/${encodeURIComponent(sessionId)}`;
  return app.emit('request', req, res);
};
