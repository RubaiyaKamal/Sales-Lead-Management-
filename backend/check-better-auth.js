const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://leadflow:dev_password_123@localhost:5432/leadflow_dev'
});

async function checkBetterAuthTables() {
  try {
    console.log('Connecting to database...');

    // Check if database is accessible
    const versionResult = await pool.query('SELECT version();');
    console.log('✓ Database connected:', versionResult.rows[0].version.split(' ')[0]);

    // Check for Better Auth tables
    const tablesResult = await pool.query(`
      SELECT tablename
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);

    console.log('\nExisting tables:');
    tablesResult.rows.forEach(row => {
      console.log('  -', row.tablename);
    });

    // Check specifically for Better Auth tables
    const requiredTables = ['user', 'session', 'account', 'verification'];
    console.log('\nBetter Auth table status:');

    const existingTableNames = tablesResult.rows.map(r => r.tablename);
    requiredTables.forEach(table => {
      const exists = existingTableNames.includes(table);
      console.log(`  ${exists ? '✓' : '✗'} ${table}: ${exists ? 'exists' : 'MISSING'}`);
    });

    // If user table exists, check its structure
    if (existingTableNames.includes('user')) {
      const columnsResult = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'user'
        ORDER BY ordinal_position;
      `);

      console.log('\nUser table structure:');
      columnsResult.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
      });
    }

  } catch (error) {
    console.error('ERROR:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n⚠ Database is not running or not accessible at localhost:5432');
      console.error('   Please start PostgreSQL with: docker-compose up -d postgres');
    }
  } finally {
    await pool.end();
  }
}

checkBetterAuthTables();
