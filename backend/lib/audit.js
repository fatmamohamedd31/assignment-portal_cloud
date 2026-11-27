const { PutLogEventsCommand, CreateLogStreamCommand } = require('@aws-sdk/client-cloudwatch-logs');
const { logs } = require('./aws');
// Each service writes to its own CloudWatch log group (created by db/setup.js).
const GROUPS = { assignment: '/portal/assignment-service', submission: '/portal/submission-service',
 grading: '/portal/grading-service' };
const groupFor = (event) => GROUPS[event.split('.')[0]] || GROUPS.assignment; // auth, cron -> assignment
const streams = new Set();
module.exports = (event, data = {}) => {
 const line = { level: 'audit', event, at: new Date().toISOString(), ...data };
 console.log(JSON.stringify(line));
 const group = groupFor(event);
 const stream = new Date().toISOString().slice(0, 10);
 (async () => {
 if (!streams.has(group + stream)) {
 try { await logs.send(new CreateLogStreamCommand({ logGroupName: group, logStreamName: stream })); }
 catch (e) { /* already exists */ }
 streams.add(group + stream);
 }
 await logs.send(new PutLogEventsCommand({ logGroupName: group, logStreamName: stream,
 logEvents: [{ timestamp: Date.now(), message: JSON.stringify(line) }] }));
 })().catch((e) => console.error(JSON.stringify({ level: 'error', where: 'cloudwatch', message: e.message })));
};
