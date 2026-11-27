const jwt = require('jsonwebtoken');
const { fail } = require('../lib/http');
function auth(req, res, next) {
 const header = req.get('authorization') || '';
 if (!header.startsWith('Bearer ')) return fail(res, 401, 'UNAUTHENTICATED', 'Please log in.');
 try {
 req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
 next();
 } catch (e) {
 return fail(res, 401, 'INVALID_TOKEN', 'Your session is invalid or expired.');
 }
}
const requireRole = (...roles) => (req, res, next) =>
 roles.includes(req.user.role) ? next()
 : fail(res, 403, 'FORBIDDEN', 'Your role is not allowed to do this.');
module.exports = { auth, requireRole };
