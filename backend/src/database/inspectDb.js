const db = require('../config/database');

async function inspectDatabase() {
  try {
    console.log('\n======================================================');
    console.log('       📊 POSTGRESQL DATABASE INSPECTOR');
    console.log('======================================================\n');

    const tablesRes = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    const tables = tablesRes.rows.map(r => r.table_name);
    console.log(`📌 Found ${tables.length} tables:`, tables.join(', '));
    console.log('------------------------------------------------------\n');

    for (const table of tables) {
      const countRes = await db.query(`SELECT COUNT(*) as count FROM ${table};`);
      const totalCount = countRes.rows[0].count;

      console.log(`📁 TABLE: "${table}" (Total Rows: ${totalCount})`);

      const rowsRes = await db.query(`SELECT * FROM ${table} ORDER BY 1 DESC LIMIT 10;`);
      if (rowsRes.rows.length === 0) {
        console.log('   (No rows found)\n');
      } else {
        console.table(rowsRes.rows);
        console.log('');
      }
    }

    console.log('✅ Inspection finished successfully.\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database inspection failed:', error.message);
    process.exit(1);
  }
}

inspectDatabase();
