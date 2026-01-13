const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://leadflow:dev_password_123@localhost:5432/leadflow_dev'
});

async function fixLeadAssignment() {
  try {
    const leadId = '4c5816d2-541f-4322-9cd1-3b08112aabd0';

    // Assign the lead to its creator
    const result = await pool.query(
      'UPDATE leads SET assigned_to = created_by WHERE id = $1 AND assigned_to IS NULL RETURNING id, name, assigned_to',
      [leadId]
    );

    if (result.rows.length > 0) {
      console.log('✓ Lead assigned to creator:');
      console.log('  Lead ID:', result.rows[0].id);
      console.log('  Name:', result.rows[0].name);
      console.log('  Assigned to:', result.rows[0].assigned_to);
      console.log('\n✓ Fix applied! Refresh the page - the lead should now appear.');
    } else {
      console.log('Lead not found or already assigned');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixLeadAssignment();
