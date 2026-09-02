const { createApp } = require('../backend/server');

const app = createApp();

module.exports = (req, res) => {
  // Vercel may pass the catch-all function a path without the /api prefix.
  // The existing backend routes intentionally keep their /api prefix.
  if (req.url && !req.url.startsWith('/api/')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }
  return app.emit('request', req, res);
};
