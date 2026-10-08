-- 002: Move business rules that must never be violated into the database itself,
-- so they hold regardless of which code path (or manual SQL) writes the data.

-- Attendance: clock-out must come after clock-in; hours cannot be negative
ALTER TABLE attendance
    ADD CONSTRAINT chk_attendance_clock_order
        CHECK (clock_in IS NULL OR clock_out IS NULL OR clock_out > clock_in),
    ADD CONSTRAINT chk_attendance_total_hours
        CHECK (total_hours >= 0);

-- Attendance rules: values must be sane and consistent with each other
ALTER TABLE attendance_rules
    ADD CONSTRAINT chk_rules_grace
        CHECK (grace_period_minutes BETWEEN 0 AND 120),
    ADD CONSTRAINT chk_rules_hours
        CHECK (half_day_min_hours > 0 AND half_day_min_hours < full_day_min_hours AND full_day_min_hours <= 24),
    -- the late cutoff cannot be earlier than start time + grace period (compared in minutes)
    ADD CONSTRAINT chk_rules_cutoff
        CHECK (EXTRACT(EPOCH FROM office_start_time) / 60 + grace_period_minutes
               <= EXTRACT(EPOCH FROM late_threshold_time) / 60);

-- Exactly one active policy row: a second row can never be inserted
CREATE UNIQUE INDEX uq_attendance_rules_single_row ON attendance_rules ((TRUE));

-- Correction requests: valid time range, and review fields match the status
ALTER TABLE correction_requests
    ADD CONSTRAINT chk_correction_times
        CHECK (requested_clock_out > requested_clock_in),
    ADD CONSTRAINT chk_correction_review_state
        CHECK ((status = 'PENDING' AND reviewed_at IS NULL)
            OR (status <> 'PENDING' AND reviewed_at IS NOT NULL));

-- Emails are unique regardless of letter case
CREATE UNIQUE INDEX uq_users_email_lower ON users (LOWER(email));

-- History must survive: users (and attendance rows) cannot be deleted while records
-- reference them. Accounts are deactivated (is_active = FALSE), never deleted.
ALTER TABLE attendance
    DROP CONSTRAINT attendance_user_id_fkey,
    ADD CONSTRAINT attendance_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE correction_requests
    DROP CONSTRAINT correction_requests_user_id_fkey,
    ADD CONSTRAINT correction_requests_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    DROP CONSTRAINT correction_requests_attendance_id_fkey,
    ADD CONSTRAINT correction_requests_attendance_id_fkey
        FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE RESTRICT;

-- Audit log is append-only: UPDATE and DELETE are rejected by a trigger.
-- The one allowed change is the FK action ON DELETE SET NULL (user_id -> NULL),
-- which keeps every other column untouched.
CREATE OR REPLACE FUNCTION prevent_audit_log_changes() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD.user_id IS NOT NULL
       AND NEW.user_id IS NULL
       AND (NEW.id, NEW.action, NEW.entity_type, NEW.entity_id, NEW.details, NEW.ip_address, NEW.created_at)
           IS NOT DISTINCT FROM
           (OLD.id, OLD.action, OLD.entity_type, OLD.entity_id, OLD.details, OLD.ip_address, OLD.created_at)
    THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'audit_logs is append-only: % is not allowed', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_append_only
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_changes();
