const { createApp } = require('../../../../backend/server');
const app = createApp();
module.exports = (req, res) => {
  const sessionId = req.query?.sessionId || req.url.split('/').filter(Boolean).slice(-2, -1)[0];
  req.url = `/api/payments/test-session/${encodeURIComponent(sessionId)}/complete`;
  return app.emit('request', req, res);
};
