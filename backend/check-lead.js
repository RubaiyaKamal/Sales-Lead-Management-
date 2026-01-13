const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://leadflow:dev_password_123@localhost:5432/leadflow_dev'
});

async function checkLead() {
  try {
    const leadId = '4c5816d2-541f-4322-9cd1-3b08112aabd0';

    const result = await pool.query(
      'SELECT id, name, email, assigned_to, created_by FROM leads WHERE id = $1',
      [leadId]
    );

    if (result.rows.length > 0) {
      console.log('✓ Lead found in database:');
      console.log('  ID:', result.rows[0].id);
      console.log('  Name:', result.rows[0].name);
      console.log('  Email:', result.rows[0].email);
      console.log('  Created by:', result.rows[0].created_by);
      console.log('  Assigned to:', result.rows[0].assigned_to || 'NULL (NOT ASSIGNED)');

      if (!result.rows[0].assigned_to) {
        console.log('\n✗ PROBLEM: Lead is not assigned to anyone!');
        console.log('  Sales reps can only see leads assigned to them.');
        console.log('  Fix: Assign lead to creator:', result.rows[0].created_by);
      }
    } else {
      console.log('✗ Lead NOT found in database');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkLead();
