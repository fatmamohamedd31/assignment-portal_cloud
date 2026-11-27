const { S3Client } = require('@aws-sdk/client-s3');
const { SNSClient } = require('@aws-sdk/client-sns');
const { SQSClient } = require('@aws-sdk/client-sqs');
const { CloudWatchLogsClient } = require('@aws-sdk/client-cloudwatch-logs');
const cfg = {
region: process.env.AWS_REGION || 'us-east-1',
endpoint: process.env.AWS_ENDPOINT_URL || 'http://localhost:4566',
credentials: { accessKeyId: 'test', secretAccessKey: 'test' } // Floci accepts dummy keys
};
const s3 = new S3Client({ ...cfg, forcePathStyle: true });
const sns = new SNSClient(cfg);
const sqs = new SQSClient(cfg);
const logs = new CloudWatchLogsClient(cfg);
const BUCKET = process.env.S3_BUCKET || 'portal-submissions';
module.exports = { s3, sns, sqs, logs, BUCKET };