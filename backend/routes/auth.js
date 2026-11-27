const router = require('express').Router();
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/pg');
const { fail, checkText } = require('../lib/http');
const turnstile = require('../middleware/turnstile');
const { auth } = require('../middleware/auth');
const audit = require('../lib/audit');
const EMAIL = /^[^ @]+@[^ @]+[.][^ @]{2,}$/;
const sign = (u) => jwt.sign({ id: u.id, role: u.role, name: u.fullName },
process.env.JWT_SECRET, { expiresIn: '8h' });
const publicUser = (u) => ({ id: u.id, fullName: u.fullName, email: u.email,
role: u.role });
router.post('/register', turnstile, async (req, res) => {
const { fullName, email, password, role, inviteCode } = req.body || {};
const nameProblem = checkText(fullName, 'Full name', 2, 80);
if (nameProblem) return fail(res, 400, 'VALIDATION_ERROR', nameProblem);
if (typeof email !== 'string' || email.length > 120 ||
!EMAIL.test(email.trim()))
return fail(res, 400, 'VALIDATION_ERROR', 'A valid email is required.');
if (typeof password !== 'string' || password.length < 8 || password.length
> 72 ||
!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
return fail(res, 400, 'VALIDATION_ERROR', 'Password needs 8-72 characters with a letter and a digit.');
if (!['student', 'instructor'].includes(role))
return fail(res, 400, 'VALIDATION_ERROR', 'Role must be student or instructor.');
if (role === 'instructor' &&
(!process.env.INSTRUCTOR_INVITE_CODE || inviteCode !==
process.env.INSTRUCTOR_INVITE_CODE))
return fail(res, 403, 'INVALID_INVITE', 'The instructor invite code is wrong.');
const id = randomUUID();
const mail = email.trim().toLowerCase();
const user = { id, fullName: fullName.trim(), email: mail, role };
const passwordHash = await bcrypt.hash(password, 10);
try {
await db.query(
'INSERT INTO users (id, full_name, email, role, password_hash) VALUES ($1, $2, $3, $4, $5)',
[id, user.fullName, mail, role, passwordHash]);
} catch (e) {
// The UNIQUE (email) constraint is the uniqueness lock even when registration requests race.
if (db.isUnique(e)) return fail(res, 409, 'EMAIL_TAKEN', 'An account with this email already exists.');
throw e;
}
audit('auth.register', { userId: id, role });
res.status(201).json({ token: sign(user), user: publicUser(user) });
});
router.post('/login', async (req, res) => {
const { email, password } = req.body || {};
if (typeof email !== 'string' || typeof password !== 'string')
return fail(res, 400, 'VALIDATION_ERROR', 'Email and password are required.');
const user = await db.one(
'SELECT id, full_name, email, role, password_hash FROM users WHERE email = $1',
[email.trim().toLowerCase()]);
const ok = user && await bcrypt.compare(password, user.passwordHash);
if (!ok) return fail(res, 401, 'INVALID_CREDENTIALS', 'Email or password is wrong.');
audit('auth.login', { userId: user.id });
res.status(200).json({ token: sign(user), user: publicUser(user) });
});
router.get('/me', auth, async (req, res) => {
const user = await db.one('SELECT id, full_name, email, role FROM users WHERE id = $1', [req.user.id]);
if (!user) return fail(res, 401, 'INVALID_TOKEN', 'Account no longer exists.');
res.status(200).json({ user: publicUser(user) });
});
module.exports = router;
