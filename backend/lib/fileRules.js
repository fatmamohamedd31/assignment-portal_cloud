const crypto = require('crypto');
const isZip = (b) => b.length > 3 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
const MAGIC = {
 pdf: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
 docx: isZip,
 zip: isZip,
 png: (b) => b.length > 7 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
 jpg: (b) => b.length > 2 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
 doc: (b) => b.length > 3 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0
};
// txt, py, js, java, cpp must be text: no NUL bytes in the first 2 KB
const isPlainText = (b) => !b.subarray(0, 2048).includes(0);
const safeName = (name) => name.replace(/[^A-Za-z0-9._ -]/g, '_').slice(-150);
const extOf = (name) => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
// Returns an error message, or null when the file is acceptable.
function validateFile(file, a) {
 if (!file) return 'A file is required (form field named file).';
 const ext = extOf(safeName(file.originalname));
 if (!a.allowedExtensions.includes(ext))
 return `Files of type .${ext || '?'} are not allowed. Allowed: ${a.allowedExtensions.join(', ')}.`;
 if (file.size === 0) return 'The file is empty.';
 if (file.size > a.maxFileMb * 1024 * 1024) return `The file is larger than ${a.maxFileMb} MB.`;
 const looksRight = MAGIC[ext] ? MAGIC[ext](file.buffer) : isPlainText(file.buffer);
 if (!looksRight) return `The content does not look like a real .${ext} file.`;
 return null;
}
module.exports = { validateFile, safeName, sha256 };
