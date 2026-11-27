const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { fail, isUuid, isCode, uuidParam } = require('../lib/http');
const svc = require('../services/reportService');
router.use(auth, requireRole('instructor'));
router.get('/late', async (req, res) => {
 const { assignmentId, courseId } = req.query;
 if ((assignmentId && !isUuid(assignmentId)) || (courseId && !isCode(courseId)))
 return fail(res, 400, 'VALIDATION_ERROR', 'assignmentId and courseId must be valid ids.');
 res.status(200).json(await svc.lateReport(req.user,
 { assignmentId: assignmentId || null, courseId: courseId || null }));
});
router.get('/stats/:assignmentId', uuidParam('assignmentId'), async (req, res) => {
 const s = await svc.stats(req.user, req.params.assignmentId);
 if (!s) return fail(res, 404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
 res.status(200).json(s);
});
module.exports = router;
