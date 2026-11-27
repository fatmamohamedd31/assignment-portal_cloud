const { CreateTopicCommand, PublishCommand, SubscribeCommand,
ListSubscriptionsByTopicCommand }
= require('@aws-sdk/client-sns');
const { CreateQueueCommand, GetQueueAttributesCommand,
SetQueueAttributesCommand, SendMessageCommand,
ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const { sns, sqs } = require('./aws');
const TOPICS = { assignment: 'portal-assignment-events', result: 'portal-result-events' };
const SUBMISSION_QUEUE = 'portal-submission-events'; // Submission
// Service -> Grading Service
const ASSIGNMENT_QUEUE = 'portal-assignment-notifications'; // SNS topic ->
// queue -> notification consumer
const QUEUE = SUBMISSION_QUEUE; // old name,
// kept so old imports still work
const FANOUT = process.env.ASSIGNMENT_FANOUT === 'true';
const cache = {};
// CreateTopic / CreateQueue are idempotent: they return the existing resource.
async function topicArn(name) {
if (!cache[name]) cache[name] = (await sns.send(new CreateTopicCommand({
Name: name }))).TopicArn;
return cache[name];
}
async function queueUrl(name) {
if (!cache[name]) {
const url = (await sqs.send(new CreateQueueCommand({ QueueName: name
}))).QueueUrl;
// Floci may return a URL with the host "floci". From your PC,
// that name does not exist outside its container, so always talk to
// the endpoint we were configured with.
cache[name] = url.replace(/^https?:\/\/[^/]+/,
process.env.AWS_ENDPOINT_URL || 'http://localhost:4566');
}
return cache[name];
}
// SNS: announce an event. Best effort: a failure is logged and the function
// returns false.
async function publishEvent(topic, subject, payload) {
try {
await sns.send(new PublishCommand({ TopicArn: await
topicArn(TOPICS[topic]),
Subject: subject.slice(0, 90), Message: JSON.stringify(payload) }));
return true;
} catch (e) {
console.error(JSON.stringify({ level: 'error', where: 'sns', message:
e.message }));
return false;
}
}
// SQS: Submission Service -> Grading Service message.
async function sendSubmissionEvent(payload) {
try {
await sqs.send(new SendMessageCommand({ QueueUrl: await
queueUrl(SUBMISSION_QUEUE),
MessageBody: JSON.stringify(payload) }));
} catch (e) { console.error(JSON.stringify({ level: 'error', where: 'sqs',
message: e.message })); }
}
// Subscribe the notification queue to the assignment topic. Throws if the
// emulator did not create the subscription, so the setup step fails loudly
// instead of silently losing notifications.
async function ensureFanout() {
const arn = await topicArn(TOPICS.assignment);
const url = await queueUrl(ASSIGNMENT_QUEUE);
const qArn = (await sqs.send(new GetQueueAttributesCommand({ QueueUrl: url,
AttributeNames: ['QueueArn'] })))
.Attributes.QueueArn;
try { // real AWS needs this policy; Floci may ignore it
await sqs.send(new SetQueueAttributesCommand({ QueueUrl: url, Attributes:
{ Policy: JSON.stringify({
Version: '2012-10-17',
Statement: [{ Effect: 'Allow', Principal: { Service:
'sns.amazonaws.com' }, Action: 'sqs:SendMessage',
Resource: qArn, Condition: { ArnEquals: { 'aws:SourceArn': arn } } }]
}) } }));
} catch (e) { console.warn('Queue policy not applied: ' + e.message); }
await sns.send(new SubscribeCommand({ TopicArn: arn, Protocol: 'sqs',
Endpoint: qArn,
Attributes: { RawMessageDelivery: 'true' } }));
const subs = (await sns.send(new ListSubscriptionsByTopicCommand({
TopicArn: arn }))).Subscriptions || [];
if (!subs.some((s) => s.Endpoint === qArn))
throw new Error('The SNS to SQS subscription was not created. Your Floci ' +
'version may not support it: ' +
'set ASSIGNMENT_FANOUT=false and choose Option B or C (Part 2.2).');
return { topic: arn, queue: qArn };
}
// SNS wraps a message in an envelope unless raw delivery is on; accept both shapes.
function unwrap(body) {
const m = JSON.parse(body);
return m && m.Type === 'Notification' && typeof m.Message === 'string' ?
JSON.parse(m.Message) : m;
}
// Poll a queue forever; handler(message) must be idempotent (SQS can deliver twice).
async function consume(queueName, handler) {
for (;;) {
try {
const url = await queueUrl(queueName);
const r = await sqs.send(new ReceiveMessageCommand({ QueueUrl: url,
MaxNumberOfMessages: 10,
WaitTimeSeconds: 5 }));
for (const m of r.Messages || []) {
await handler(unwrap(m.Body));
await sqs.send(new DeleteMessageCommand({ QueueUrl: url,
ReceiptHandle: m.ReceiptHandle }));
}
} catch (e) {
console.error(JSON.stringify({ level: 'error', where: 'sqs-consumer',
queue: queueName, message: e.message }));
await new Promise((r) => setTimeout(r, 5000));
}
}
}
module.exports = { publishEvent, sendSubmissionEvent, ensureFanout, consume,
TOPICS, QUEUE,
SUBMISSION_QUEUE, ASSIGNMENT_QUEUE, FANOUT };