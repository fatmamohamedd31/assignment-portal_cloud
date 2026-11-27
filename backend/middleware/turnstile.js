const { fail } = require('../lib/http');
module.exports = async function turnstile(req, res, next) {
 const token = req.get('X-Turnstile-Token');
 if (!token) return fail(res, 403, 'BOT_CHECK_FAILED', 'Bot check token is missing.');
 const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY || '', response: token });
 const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',
 { method: 'POST', body });
 const data = await r.json();
 if (!data.success) {
 console.error(JSON.stringify({ level: 'warn', where: 'turnstile', errorCodes: data['error-codes'] || [] }));
 return fail(res, 403, 'BOT_CHECK_FAILED', 'Bot check failed. Please retry.');
 }
 next();
};
