const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { fail, uuidParam } = require('../lib/http');
const db = require('../db/pg');
router.use(auth);
router.get('/', async (req, res) => {
const items = await db.many(
`SELECT id, type, message, assignment_id, is_read, created_at
FROM notifications WHERE user_id = $1
ORDER BY created_at DESC LIMIT 50`, [req.user.id]);
res.status(200).json({ unread: items.filter((n) => !n.isRead).length, items
});
});
router.post('/read-all', async (req, res) => {
await db.query(`UPDATE notifications SET is_read = true WHERE user_id = $1
AND NOT is_read`, [req.user.id]);
res.status(200).json({ ok: true });
});
// The WHERE clause includes user_id, so someone else's id looks exactly like
// a missing one (404).
router.patch('/:id/read', uuidParam(), async (req, res) => {
const r = await db.query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
[req.params.id, req.user.id]);
if (r.rowCount === 0) return fail(res, 404, 'NOTIFICATION_NOT_FOUND',
'Notification not found.');
res.status(200).json({ ok: true });
});
module.exports = router;