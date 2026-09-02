const { createApp } = require('../backend/server');

const app = createApp();

module.exports = (req, res) => app.emit('request', req, res);
