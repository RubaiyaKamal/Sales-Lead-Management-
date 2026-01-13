const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'leadflow_dev',
  user: 'leadflow',
  password: 'dev_password_123'
});

async function provisionUser() {
  try {
    // Check if user exists in Better Auth
    const betterAuthUser = await pool.query(
      'SELECT * FROM "user" WHERE email = $1',
      ['affan10@gmail.com']
    );

    if (betterAuthUser.rows.length === 0) {
      console.log('User not found in Better Auth');
      return;
    }

    const user = betterAuthUser.rows[0];
    console.log('Better Auth User found:', user.email);

    // Check if user already exists in application users table
    const appUser = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [user.email]
    );

    if (appUser.rows.length > 0) {
      console.log('User already exists in application users table');
      return;
    }

    // Provision user in application users table
    // Use Better Auth user ID as cognito_sub for compatibility
    const result = await pool.query(
      `INSERT INTO users (id, email, name, role, cognito_sub)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)
       RETURNING id, email, name, role`,
      [user.email, user.name, user.role || 'sales_rep', `better-auth-${user.id}`]
    );

    console.log('User provisioned successfully:', result.rows[0]);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

provisionUser();
