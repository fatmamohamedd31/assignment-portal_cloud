require('dotenv').config();
const db = require('./pg');
async function reset() {
if (process.argv[2] !== '--yes') {
console.log('This DELETES ALL ROWS of the database named inDATABASE_URL.');
console.log('Run again with --yes to confirm: npm run db:reset -- --yes');
process.exit(1);
}
const who = await db.one('SELECT current_database() AS db, current_user ASusr');
console.log(`Emptying database "${who.db}" as "${who.usr}" ...`);
await db.query(`TRUNCATE notifications, grade_history, grade_scores,
grades, submissions,
rubric_criteria, assignments, enrollments,
courses, users RESTART IDENTITY CASCADE`);
console.log('All rows deleted, tables kept.');
console.log('Also empty the bucket: aws s3 rm s3://portal-submissions --recursive');
}
reset().then(() => process.exit(0)).catch((e) => { console.error('Resetfailed:', e.message); process.exit(1); });
