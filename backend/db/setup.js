require('dotenv').config();
const { CreateBucketCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { CreateLogGroupCommand } = require('@aws-sdk/client-cloudwatch-logs');
const { TOPICS, FANOUT, publishEvent, sendSubmissionEvent, ensureFanout } =
require('../lib/events');
const { s3, logs, BUCKET } = require('../lib/aws');
const applySchema = require('./applySchema');
const LOG_GROUPS = ['/portal/assignment-service', '/portal/submission-service', '/portal/grading-service'];
async function createFloci() {
try {
await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
} catch {
await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
console.log(`created bucket ${BUCKET}`);
}
// Topics and queues are created on first use by lib/events.js; touch them now.
for (const t of Object.keys(TOPICS)) await publishEvent(t, 'setup', {
setup: true });
console.log('SNS topics ready');
for (const g of LOG_GROUPS) {
try { await logs.send(new CreateLogGroupCommand({ logGroupName: g }));
console.log(`created log group ${g}`); }
catch (e) { if (e.name !== 'ResourceAlreadyExistsException') throw e; }
}
await sendSubmissionEvent({ type: 'SETUP' }); // creates the queue; the consumer ignores it
console.log('SQS queue ready');
if (FANOUT) {
const f = await ensureFanout(); // throws if the emulator did not create the subscription
console.log(`SNS to SQS fan-out ready (${f.queue})`);
}
}
// Safe to run many times. Neon first (once), then Floci (retried while Floci  finishes starting).
async function setup(tries = 20) {
await applySchema();
for (let i = 1; ; i++) {
try { return await createFloci(); }
catch (e) {
if (i >= tries) throw e;
console.log(`Floci not ready (${e.message}). Retry ${i}/${tries}`);
await new Promise((r) => setTimeout(r, 2000));
}
}
}
module.exports = setup;
if (require.main === module) {
setup().then(() => { console.log('Setup complete.'); process.exit(0); })
.catch((e) => { console.error(e); process.exit(1); });
}
