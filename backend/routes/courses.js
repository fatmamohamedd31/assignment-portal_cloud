const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { fail, checkText, codeParam } = require('../lib/http');
const svc = require('../services/courseService');
router.use(auth);
router.get('/', async (req, res) => res.status(200).json(await svc.listForUser(req.user)));
router.post('/', requireRole('instructor'), async (req, res) => {
 const { code, title } = req.body || {};
 const c = typeof code === 'string' ? code.trim().toUpperCase() : '';
 if (!/^[A-Z0-9-]{3,20}$/.test(c))
 return fail(res, 400, 'VALIDATION_ERROR', 'Course code needs 3-20 letters, digits or dashes.');
 const problem = checkText(title, 'Title', 3, 120);
 if (problem) return fail(res, 400, 'VALIDATION_ERROR', problem);
 const course = await svc.create(req.user.id, c, title.trim());
 if (!course) return fail(res, 409, 'COURSE_CODE_TAKEN', 'This course code already exists.');
 res.status(201).json(course);
});
router.post('/enroll', requireRole('student'), async (req, res) => {
 const code = typeof (req.body || {}).code === 'string' ? req.body.code.trim().toUpperCase() : '';
 if (!code) return fail(res, 400, 'VALIDATION_ERROR', 'Course code is required.');
 const result = await svc.enroll(req.user.id, code);
 if (result.notFound) return fail(res, 404, 'COURSE_NOT_FOUND', 'No course has this code.');
 if (result.already) return fail(res, 409, 'ALREADY_ENROLLED', 'You are already enrolled in this course.');
 res.status(201).json(result.course);
});
router.get('/:id/students', requireRole('instructor'), codeParam(), async (req, res) => {
 const list = await svc.students(req.params.id, req.user.id);
 if (!list) return fail(res, 404, 'COURSE_NOT_FOUND', 'Course not found.');
 res.status(200).json(list);
});
module.exports = router;