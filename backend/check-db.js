const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://leadflow:dev_password_123@localhost:5432/leadflow_dev'
});

async function check() {
    try {
        const userCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'user'");
        console.log('User columns:', userCols.rows.map(r => r.column_name));

        const sessionCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'session'");
        console.log('Session columns:', sessionCols.rows.map(r => r.column_name));

        const accountCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'account'");
        console.log('Account columns:', accountCols.rows.map(r => r.column_name));

        const sessions = await pool.query('SELECT count(*) FROM "session"');
        console.log('Session count:', sessions.rows[0].count);

        const users = await pool.query('SELECT count(*) FROM "user"');
        console.log('Better Auth User count:', users.rows[0].count);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
