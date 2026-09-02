const { createApp } = require('../../backend/server');
const app = createApp();
module.exports = (req, res) => {
  const query = req.url && req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  req.url = `/api/checkout/quote${query}`;
  return app.emit('request', req, res);
};
