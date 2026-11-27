const { randomUUID } = require('crypto');
module.exports = (req, res, next) => {
 const start = Date.now();
 req.id = randomUUID().slice(0, 8);
 res.setHeader('X-Request-Id', req.id);
 res.on('finish', () => console.log(JSON.stringify({
 level: 'info', requestId: req.id, method: req.method,
 path: req.originalUrl.split('?')[0], status: res.statusCode,
 ms: Date.now() - start, userId: req.user ? req.user.id : null
 })));
 next();
};
