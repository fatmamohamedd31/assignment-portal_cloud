require('dotenv').config();
const { Pool, types } = require('pg');
// Keep API shapes identical to the DynamoDB version:
// timestamptz -> ISO string, numeric -> number, bigint (COUNT) -> number.
types.setTypeParser(1184, (v) => new Date(v).toISOString());
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(20, (v) => parseInt(v, 10));
if (!process.env.DATABASE_URL) {
throw new Error('DATABASE_URL is not set. Copy the connection string from the Neon console into backend/.env');
}
// One shared pool for the whole API. Neon needs TLS; the string from the
// console already says sslmode=require.
const pool = new Pool({
connectionString: process.env.DATABASE_URL,
max: 10,
idleTimeoutMillis: 30000,
connectionTimeoutMillis: 15000 // a suspended Neon compute can take a few
// seconds to wake
});
pool.on('error', (e) => console.error(JSON.stringify({ level: 'error', where:
'pg-pool', message: e.message })));
// full_name -> fullName, so route code and the React frontend see the same
// field names as before.
const camel = (row) => {
if (!row) return row;
const out = {};
for (const k of Object.keys(row)) out[k.replace(/_([a-z])/g, (m, c) =>
c.toUpperCase())] = row[k];
return out;
};
// exec is the pool or one checked-out client (inside a transaction).
function api(exec) {
return {
query: (text, params = []) => exec.query(text, params),
one: async (text, params = []) => camel((await exec.query(text,
params)).rows[0]) || null,
many: async (text, params = []) => (await exec.query(text,
params)).rows.map(camel)
};
}
// Runs fn inside BEGIN ... COMMIT. Any error rolls everything back.
async function tx(fn) {
const client = await pool.connect();
try {
await client.query('BEGIN');
const result = await fn(api(client));
await client.query('COMMIT');
return result;
} catch (e) {
try { await client.query('ROLLBACK'); } catch (_) { /* connection already
gone */ }
throw e;
} finally {
client.release();
}
}
// 23505 = unique_violation (duplicate email, duplicate course code,duplicate notification key ...)
const isUnique = (e) => Boolean(e) && e.code === '23505';
module.exports = { ...api(pool), tx, isUnique, pool };
