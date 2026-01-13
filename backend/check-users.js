const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://leadflow:dev_password_123@localhost:5432/leadflow_dev'
});

async function checkUsers() {
  try {
    console.log('\n=== Better Auth Users ===');
    const authUsers = await pool.query('SELECT id, email, name, role, "createdAt" FROM "user" ORDER BY "createdAt" DESC');

    if (authUsers.rows.length === 0) {
      console.log('No users found in Better Auth table');
    } else {
      authUsers.rows.forEach(user => {
        console.log(`\nEmail: ${user.email}`);
        console.log(`  Name: ${user.name}`);
        console.log(`  Role: ${user.role || 'sales_rep'}`);
        console.log(`  ID: ${user.id}`);
        console.log(`  Created: ${user.createdAt}`);
      });
    }

    console.log('\n=== Application Users ===');
    const appUsers = await pool.query('SELECT id, email, name, role, cognito_sub FROM users ORDER BY created_at DESC');

    if (appUsers.rows.length === 0) {
      console.log('No users found in application users table');
    } else {
      appUsers.rows.forEach(user => {
        console.log(`\nEmail: ${user.email}`);
        console.log(`  Name: ${user.name}`);
        console.log(`  Role: ${user.role}`);
        console.log(`  Cognito Sub: ${user.cognito_sub}`);
      });
    }

    console.log('\n=== Active Sessions ===');
    const sessions = await pool.query(`
      SELECT s.id, s.token, s."userId", s."expiresAt", u.email, u.name
      FROM session s
      JOIN "user" u ON u.id = s."userId"
      WHERE s."expiresAt" > NOW()
      ORDER BY s."createdAt" DESC
    `);

    if (sessions.rows.length === 0) {
      console.log('No active sessions found');
    } else {
      sessions.rows.forEach(session => {
        console.log(`\nUser: ${session.email} (${session.name})`);
        console.log(`  Token: ${session.token.substring(0, 20)}...`);
        console.log(`  Expires: ${session.expiresAt}`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUsers();
