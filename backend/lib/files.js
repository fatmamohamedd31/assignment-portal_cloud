const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { s3, BUCKET } = require('./aws');
const putFile = (key, body, type) =>
 s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: type }));
async function getFile(key) {
 const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
 return Buffer.from(await r.Body.transformToByteArray());
}
const deleteFile = (key) => s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
module.exports = { putFile, getFile, deleteFile };