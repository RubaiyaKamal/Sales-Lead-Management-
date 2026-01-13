const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'leadflow_dev',
  user: 'leadflow',
  password: 'dev_password_123'
});

async function test() {
  try {
    // Check Better Auth user
    const userResult = await pool.query('SELECT * FROM "user" WHERE email = $1', ['affan10@gmail.com']);
    console.log('Better Auth User:', JSON.stringify(userResult.rows, null, 2));

    // Check session for that user
    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0].id;
      const sessionResult = await pool.query('SELECT * FROM "session" WHERE "userId" = $1', [userId]);
      console.log('\nSessions for user:', JSON.stringify(sessionResult.rows, null, 2));
    }

    // Check application users table
    const appUserResult = await pool.query('SELECT * FROM users WHERE email = $1', ['affan10@gmail.com']);
    console.log('\nApplication User:', JSON.stringify(appUserResult.rows, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

test();
