class Rule extends Error {
 constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (res, status, code, message) =>
 res.status(status).json({ error: { code, message } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE = /^[A-Z0-9-]{3,20}$/; // a course code is the course id
const SUBID = /^[0-9a-f-]{36}_[0-9a-f-]{36}_[0-9]{1,3}$/i; // assignment_student_attempt
const isUuid = (v) => typeof v === 'string' && UUID.test(v);
const isCode = (v) => typeof v === 'string' && CODE.test(v);
const param = (name, re) => (req, res, next) =>
 re.test(String(req.params[name])) ? next() : fail(res, 404, 'NOT_FOUND', 'Resource not found.');
const uuidParam = (name = 'id') => param(name, UUID);
const codeParam = (name = 'id') => param(name, CODE);
const subIdParam = (name = 'id') => param(name, SUBID);
function checkText(value, label, min, max) {
 if (typeof value !== 'string') return `${label} is required.`;
 const n = value.trim().length;
 if (n < min || n > max) return `${label} must contain between ${min} and ${max} characters.`;
 return null;
}
module.exports = { Rule, fail, isUuid, isCode, uuidParam, codeParam, subIdParam, checkText };