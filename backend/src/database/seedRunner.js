const db = require('../config/database');
const { hashPassword } = require('../utils/password');
const env = require('../config/env');
const { runMigrations } = require('./migrate');
const { isLocalDatabase } = require('../config/dbConfig');

const runSeed = async () => {
  // Seeding wipes every table, so a remote database needs an explicit opt-in
  if (!isLocalDatabase() && process.env.SEED_CONFIRM !== 'yes') {
    console.error(
      'Refusing to seed: the target database is not on this machine and seeding DELETES all existing data.\n' +
        'If you really mean to seed the remote database, run again with SEED_CONFIRM=yes.'
    );
    process.exit(1);
  }

  try {
    console.log('Seeding Database from Environment Configuration...');

    // 1. Ensure the schema is up to date
    await runMigrations();
    console.log('Schema verified.');

    // 2. Clear existing sample data
    await db.query('TRUNCATE TABLE audit_logs, correction_requests, attendance, attendance_rules, users RESTART IDENTITY CASCADE;');

    // 3. Hash Passwords from Environment Variables
    const adminConfig = env.SEED_USERS.ADMIN;
    const hrConfig = env.SEED_USERS.HR;
    const empConfig = env.SEED_USERS.EMPLOYEE;

    const adminPass = await hashPassword(adminConfig.password);
    const hrPass = await hashPassword(hrConfig.password);
    const empPass = await hashPassword(empConfig.password);

    const usersQuery = `
      INSERT INTO users (name, email, password_hash, role, designation, department, is_active)
      VALUES 
        ($1, $2, $3, 'ADMIN', 'Head of IT & Systems', 'Operations', true),
        ($4, $5, $6, 'HR', 'HR Manager', 'Human Resources', true),
        ($7, $8, $9, 'EMPLOYEE', 'Senior Software Engineer', 'Engineering', true),
        ('Emily Smith', 'emily@company.com', $9, 'EMPLOYEE', 'Product Designer', 'Design', true)
      RETURNING id, name, email, role;
    `;
    const usersResult = await db.query(usersQuery, [
      adminConfig.name, adminConfig.email.toLowerCase().trim(), adminPass,
      hrConfig.name, hrConfig.email.toLowerCase().trim(), hrPass,
      empConfig.name, empConfig.email.toLowerCase().trim(), empPass,
    ]);
    console.log(`Created ${usersResult.rows.length} default users from .env configuration.`);

    const adminId = usersResult.rows.find(u => u.role === 'ADMIN').id;
    const empId = usersResult.rows.find(u => u.email === empConfig.email.toLowerCase().trim()).id;
    const emilyId = usersResult.rows.find(u => u.email === 'emily@company.com').id;

    // 4. Create Default Attendance Rule
    await db.query(`
      INSERT INTO attendance_rules (office_start_time, grace_period_minutes, late_threshold_time, half_day_min_hours, full_day_min_hours, updated_by)
      VALUES ('09:00:00', 15, '09:30:00', 4.00, 8.00, $1);
    `, [adminId]);
    console.log('Default attendance rules seeded.');

    // 5. Seed Past Attendance Records for Employee & Emily
    const today = new Date();
    
    // Day 1 (3 days ago - Full Day Present)
    const d1 = new Date(today);
    d1.setDate(d1.getDate() - 3);
    const d1Str = d1.toISOString().split('T')[0];
    const d1In = new Date(`${d1Str}T09:05:00`);
    const d1Out = new Date(`${d1Str}T17:35:00`);

    // Day 2 (2 days ago - Late arrival)
    const d2 = new Date(today);
    d2.setDate(d2.getDate() - 2);
    const d2Str = d2.toISOString().split('T')[0];
    const d2In = new Date(`${d2Str}T09:45:00`);
    const d2Out = new Date(`${d2Str}T18:15:00`);

    // Day 3 (1 day ago - Half Day)
    const d3 = new Date(today);
    d3.setDate(d3.getDate() - 1);
    const d3Str = d3.toISOString().split('T')[0];
    const d3In = new Date(`${d3Str}T09:00:00`);
    const d3Out = new Date(`${d3Str}T13:00:00`);

    const attQuery = `
      INSERT INTO attendance (user_id, date, clock_in, clock_out, total_hours, status, notes)
      VALUES 
        ($1, $2, $3, $4, 8.50, 'PRESENT', 'Normal working day'),
        ($1, $5, $6, $7, 8.50, 'LATE', 'Traffic delay'),
        ($1, $8, $9, $10, 4.00, 'HALF_DAY', 'Doctor appointment afternoon'),
        ($11, $2, $3, $4, 8.50, 'PRESENT', 'Regular shift')
      RETURNING id, date, status;
    `;
    const attResult = await db.query(attQuery, [
      empId, d1Str, d1In, d1Out,
      d2Str, d2In, d2Out,
      d3Str, d3In, d3Out,
      emilyId
    ]);
    console.log(`Seeded ${attResult.rows.length} sample attendance records.`);

    // 6. Seed a Pending Correction Request
    const lateAttId = attResult.rows[1].id;
    const reqIn = new Date(`${d2Str}T09:00:00`);
    const reqOut = new Date(`${d2Str}T18:15:00`);
    await db.query(`
      INSERT INTO correction_requests (attendance_id, user_id, work_date, requested_clock_in, requested_clock_out, reason, status)
      VALUES ($1, $2, $3, $4, $5, 'Biometric device glitched at gate. Arrived on time at 09:00 AM.', 'PENDING');
    `, [lateAttId, empId, d2Str, reqIn, reqOut]);
    console.log('Sample correction request seeded.');

    // 7. Seed Initial Audit Logs
    await db.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES 
        ($1, 'SYSTEM_INIT', 'DATABASE', null, '{"message": "Database initialized and seeded from .env"}'),
        ($2, 'CLOCK_IN', 'ATTENDANCE', $3, '{"status": "LATE", "notes": "Traffic delay"}'),
        ($2, 'CORRECTION_REQUESTED', 'CORRECTION_REQUEST', 1, '{"reason": "Biometric glitch"}');
    `, [adminId, empId, lateAttId]);
    console.log('Audit logs seeded.');

    console.log('\nDatabase seeding completed successfully! ✨');
    console.log('--------------------------------------------------');
    console.log('Credentials loaded from environment (.env):');
    console.log(`👑 Admin:    ${adminConfig.email} / ${adminConfig.password}`);
    console.log(`💼 HR:       ${hrConfig.email} / ${hrConfig.password}`);
    console.log(`👤 Employee: ${empConfig.email} / ${empConfig.password}`);
    console.log('--------------------------------------------------');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

runSeed();
