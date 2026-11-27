const router = require('express').Router();
const multer = require('multer');
const { auth, requireRole } = require('../middleware/auth');
const turnstile = require('../middleware/turnstile');
const { fail, isUuid, uuidParam, subIdParam } = require('../lib/http');
const svc = require('../services/submissionService');
const audit = require('../lib/audit');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024, files: 1 } });
router.use(auth);
// Upload (students only). Order matters: role, bot check, then file parsing.
router.post('/', requireRole('student'), turnstile, upload.single('file'), async (req, res) => {
 const { assignmentId, comment } = req.body || {};
 if (!isUuid(assignmentId)) return fail(res, 400, 'VALIDATION_ERROR', 'assignmentId is required.');
 const result = await svc.submit(req.user, assignmentId, req.file, comment);
 audit('submission.create', { submissionId: result.id, by: req.user.id,
 late: result.isLate, attempt: result.attemptNo });
 res.status(201).json(result);
});
router.get('/status', requireRole('student'), async (req, res) =>
 res.status(200).json(await svc.statusForStudent(req.user)));
router.get('/history/:assignmentId', requireRole('student'), uuidParam('assignmentId'),
 async (req, res) => res.status(200).json(await svc.history(req.user, req.params.assignmentId)));
router.get('/assignment/:assignmentId', requireRole('instructor'), uuidParam('assignmentId'),
 async (req, res) => {
 const data = await svc.overview(req.user, req.params.assignmentId);
 if (!data) return fail(res, 404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
 res.status(200).json(data);
});
router.get('/:id/download', subIdParam(), async (req, res) => {
 const f = await svc.fileFor(req.user, req.params.id);
 if (!f) return fail(res, 404, 'SUBMISSION_NOT_FOUND', 'Submission not found.');
 audit('submission.download', { submissionId: req.params.id, by: req.user.id });
 res.set({
 'Content-Type': f.mimeType || 'application/octet-stream',
 'Content-Disposition': `attachment; filename="${f.fileName}"`,
 'X-Content-Type-Options': 'nosniff'
 });
 res.status(200).send(f.body);
});
module.exports = router;