const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { uuidParam, subIdParam } = require('../lib/http');
const svc = require('../services/gradingService');
const audit = require('../lib/audit');
router.use(auth);
router.get('/mine/:assignmentId', requireRole('student'), uuidParam('assignmentId'),
 async (req, res) => res.status(200).json(await svc.resultForStudent(req.user, req.params.assignmentId)));
router.post('/assignment/:assignmentId/publish-all', requireRole('instructor'),
 uuidParam('assignmentId'), async (req, res) => {
 const r = await svc.publishAll(req.user, req.params.assignmentId);
 audit('grading.publish_all', { assignmentId: req.params.assignmentId, by: req.user.id, count: r.published });
 res.status(200).json(r);
});
router.get('/:submissionId', requireRole('instructor'), subIdParam('submissionId'),
 async (req, res) => res.status(200).json(await svc.detail(req.user, req.params.submissionId)));
router.put('/:submissionId', requireRole('instructor'), subIdParam('submissionId'),
 async (req, res) => {
    const r = await svc.save(req.user, req.params.submissionId, req.body);
 audit('grading.save', { submissionId: req.params.submissionId, by: req.user.id, final: r.finalMarks });
 res.status(200).json(r);
});
router.post('/:submissionId/publish', requireRole('instructor'), subIdParam('submissionId'),
 async (req, res) => {
 const r = await svc.publishOne(req.user, req.params.submissionId);
 audit('grading.publish', { submissionId: req.params.submissionId, by: req.user.id });
 res.status(200).json(r);
});
router.get('/:submissionId/history', requireRole('instructor'), subIdParam('submissionId'),
 async (req, res) => res.status(200).json(await svc.history(req.user, req.params.submissionId)));
module.exports = router;