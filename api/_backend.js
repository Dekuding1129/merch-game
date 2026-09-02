const { createApp } = require('../backend/server');

function handlerFor(route) {
  const app = createApp();
  return (req, res) => {
    const query = req.url && req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    req.url = `${route}${query}`;
    return app.emit('request', req, res);
  };
}

module.exports = { handlerFor };
