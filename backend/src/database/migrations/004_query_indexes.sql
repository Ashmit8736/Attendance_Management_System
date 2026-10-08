-- 004: Indexes that match the real query patterns.

-- UNIQUE (user_id, date) already creates an equivalent index, so this one is redundant.
DROP INDEX IF EXISTS idx_attendance_user_date;

-- History and reports filter by date range across all users
CREATE INDEX idx_attendance_date ON attendance (date DESC);

-- Audit log page is ordered newest-first
CREATE INDEX idx_audit_created_at ON audit_logs (created_at DESC);

-- Foreign-key lookups and per-user request lists
CREATE INDEX idx_correction_user_created ON correction_requests (user_id, created_at DESC);
CREATE INDEX idx_correction_attendance ON correction_requests (attendance_id);
