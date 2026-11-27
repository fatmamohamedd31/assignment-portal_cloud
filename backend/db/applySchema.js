require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./pg');

// Applies schema.sql. Every statement uses IF NOT EXISTS, so it is safe to
// run again and again.
async function applySchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db.pool.query(sql); // no parameters: PostgreSQL accepts many statements in one call
  const t = await db.many("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  console.log('Schema applied. Tables: ' + t.map((r) => r.tableName).join(','));
}
module.exports = applySchema;
if (require.main === module) {
applySchema().then(() => process.exit(0))
.catch((e) => { console.error('Schema failed:', e.message);
process.exit(1); });
}
