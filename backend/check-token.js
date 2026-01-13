const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://leadflow:dev_password_123@localhost:5432/leadflow_dev'
});

async function checkToken() {
  try {
    // Get active session for affan10@gmail.com
    const result = await pool.query(`
      SELECT s.token, s."expiresAt", s."userId", u.email
      FROM session s
      JOIN "user" u ON s."userId" = u.id
      WHERE u.email = 'affan10@gmail.com'
        AND s."expiresAt" > NOW()
      ORDER BY s."createdAt" DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('No active session found for affan10@gmail.com');
      return;
    }

    const session = result.rows[0];
    console.log('✓ Active session found for:', session.email);
    console.log('\nDatabase token:');
    console.log('  ', session.token);
    console.log('\nToken sent in Authorization header:');
    console.log('  ', 'TLfjrFHbfn4HwZH01q7YHUoZ9LCfdS2E');
    console.log('\nToken in cookie (URL-decoded):');
    console.log('  ', 'TLfjrFHbfn4HwZH01q7YHUoZ9LCfdS2E.gzlSINVIBdngqoQQaa8bXvtXQLr14FY99ifUKpqZr6Y=');

    console.log('\nExpires:', session.expiresAt);

    // Check matches
    const authHeaderToken = 'TLfjrFHbfn4HwZH01q7YHUoZ9LCfdS2E';
    const cookieToken = 'TLfjrFHbfn4HwZH01q7YHUoZ9LCfdS2E.gzlSINVIBdngqoQQaa8bXvtXQLr14FY99ifUKpqZr6Y=';

    console.log('\nToken matches:');
    console.log('  Authorization header:', session.token === authHeaderToken ? '✓ YES' : '✗ NO (partial)');
    console.log('  Cookie:', session.token === cookieToken ? '✓ YES' : '✗ NO');

    console.log('\nDiagnosis:');
    if (session.token === cookieToken) {
      console.log('  ✓ Backend should use token from cookie, not Authorization header');
    } else if (session.token === authHeaderToken) {
      console.log('  ✓ Token matches Authorization header (short form)');
    } else {
      console.log('  ✗ Token mismatch - frontend is not sending correct token format');
      console.log('  Expected:', session.token);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkToken();
