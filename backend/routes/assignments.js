const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { fail, isCode, uuidParam } = require('../lib/http');
const svc = require('../services/assignmentService');
const courses = require('../services/courseService');
const { sendReminders } = require('../services/reminderService');
const audit = require('../lib/audit');
router.use(auth);
router.get('/', async (req, res) => {
 const { category, courseId } = req.query;
 if (category && !['draft', 'upcoming', 'active', 'past'].includes(category))
 return fail(res, 400, 'VALIDATION_ERROR', 'category must be draft, upcoming, active or past.');
 if (courseId && !isCode(courseId)) return fail(res, 400, 'VALIDATION_ERROR', 'courseId is not valid.');
 res.status(200).json(await svc.list(req.user, { category: category || null, courseId: courseId || null }));
});
router.post('/', requireRole('instructor'), async (req, res) => {
 const b = req.body || {};
 if (!isCode(b.courseId)) return fail(res, 400, 'VALIDATION_ERROR', 'courseId is required.');
 const course = await courses.getOwned(b.courseId, req.user.id);
 if (!course) return fail(res, 404, 'COURSE_NOT_FOUND', 'Course not found.');
 const { error, value } = svc.validate(b, false);
 if (error) return fail(res, 400, 'VALIDATION_ERROR', error);
 const id = await svc.create(req.user, course, value, b.publish === true);
 audit('assignment.create', { id, by: req.user.id, published: b.publish === true });
 res.status(201).json(await svc.get(req.user, id));
});
router.get('/:id', uuidParam(), async (req, res) => {
 const a = await svc.get(req.user, req.params.id);
 if (!a) return fail(res, 404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
 res.status(200).json(a);
});
router.put('/:id', requireRole('instructor'), uuidParam(), async (req, res) => {
 const existing = await svc.get(req.user, req.params.id);
 if (!existing) return fail(res, 404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
 const { error, value } = svc.validate({ openAt: existing.openAt, ...(req.body || {}) }, true);
 if (error) return fail(res, 400, 'VALIDATION_ERROR', error);
 const result = await svc.update(existing, value);
 if (result.locked) return fail(res, 409, 'RUBRIC_LOCKED',
 'Grading has started: the rubric and maximum marks can no longer change.');
 if (result.conflict) return fail(res, 409, 'CONFLICT', 'The assignment changed while you edited it. Reload.');
 audit('assignment.update', { id: existing.id, by: req.user.id, changes: result.changes });
 res.status(200).json({ ...(await svc.get(req.user, existing.id)), changes: result.changes });
});
router.post('/:id/publish', requireRole('instructor'), uuidParam(), async (req, res) => {
 const a = await svc.get(req.user, req.params.id);
 if (!a) return fail(res, 404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
 if (a.status === 'published')
 return fail(res, 409, 'ALREADY_PUBLISHED', 'This assignment is already published.');
 if (new Date(a.deadline) <= new Date())
 return fail(res, 409, 'DEADLINE_PASSED', 'Edit the deadline before publishing.');
 await svc.publish(a);
 audit('assignment.publish', { id: a.id, by: req.user.id });
 res.status(200).json(await svc.get(req.user, a.id));
});
router.post('/:id/remind', requireRole('instructor'), uuidParam(), async (req, res) => {
 const a = await svc.get(req.user, req.params.id);
 if (!a) return fail(res, 404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
 if (a.status !== 'published') return fail(res, 409, 'NOT_PUBLISHED', 'Publish the assignment first.');
 res.status(200).json({ notified: await sendReminders(a.id, null) });
});
router.delete('/:id', requireRole('instructor'), uuidParam(), async (req, res) => {
 const a = await svc.get(req.user, req.params.id);
 if (!a) return fail(res, 404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
 const result = await svc.remove(a.id, req.query.force === 'true');
 if (result.blocked)
 return fail(res, 409, 'HAS_SUBMISSIONS',
 `${result.blocked} submission(s) exist. Repeat with ?force=true to delete everything.`);
 audit('assignment.delete', { id: a.id, by: req.user.id });
 res.status(204).end();
});
module.exports = router;
