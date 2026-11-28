require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { fail, Rule } = require('./lib/http');
const logger = require('./middleware/logger');
const setup = require('./db/setup');
const { FANOUT } = require('./lib/events');
const app = express();
app.use(logger);
const origins = (process.env.CORS_ORIGINS ||
'http://localhost:5173').split(',').map((o) => o.trim());
app.use(cors({
origin: origins,
methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
allowedHeaders: ['Content-Type', 'Authorization', 'X-Turnstile-Token']
}));
app.use(express.json({ limit: '100kb' }));
app.get('/', (req, res) => res.status(200).json({ name: 'AssignmentSubmission Portal API' }));
app.get('/api/health', (req, res) =>
res.status(200).json({ status: 'ok', environment: process.env.NODE_ENV ||
'development' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/cron', require('./routes/cron'));
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/grading', require('./routes/grading'));
app.use('/api/reports', require('./routes/reports'));
app.use((req, res) => fail(res, 404, 'ROUTE_NOT_FOUND', 'No such route.'));
app.use((err, req, res, next) => {
if (err instanceof Rule) return fail(res, err.status, err.code,
err.message);
if (err.type === 'entity.parse.failed')
return fail(res, 400, 'INVALID_JSON', 'The request body is not validJSON.');
if (err.code === 'LIMIT_FILE_SIZE')
return fail(res, 413, 'FILE_TOO_LARGE', 'The file is larger than the 3 MBplatform limit.');
console.error(JSON.stringify({ level: 'error', requestId: req.id, message:
err.message }));
return fail(res, 500, 'INTERNAL_ERROR', 'Unexpected server error.');
});
if (require.main === module) {
const port = Number(process.env.PORT) || 3000;
setup() // applies the Neon schema, then creates the bucket, topics, queuesand log groups if missing
.then(() => {
require('./services/gradingService').startConsumer();
// SQS: submission events
if (FANOUT)
require('./services/assignmentService').startFanoutConsumer(); // SQS:assignment events
})
.then(() => app.listen(port, () => console.log(`API listening on
http://localhost:${port}`)))
.catch((e) => { console.error('Startup failed:', e.message);
process.exit(1); });
}
module.exports = app;