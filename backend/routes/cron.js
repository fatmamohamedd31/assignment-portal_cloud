const router = require('express').Router();
const { fail } = require('../lib/http');
const { sendReminders } = require('../services/reminderService');
const audit = require('../lib/audit');
// Called every hour by the "scheduler" container. Safe to repeat: reminders are de-duplicated per day.
router.get('/reminders', async (req, res) => {
 const secret = process.env.CRON_SECRET;
 if (!secret || req.get('authorization') !== `Bearer ${secret}`)
 return fail(res, 401, 'UNAUTHORIZED', 'Invalid cron secret.');
 const notified = await sendReminders(null, 48);
 audit('cron.reminders', { notified });
 res.status(200).json({ notified });
});
module.exports = router;