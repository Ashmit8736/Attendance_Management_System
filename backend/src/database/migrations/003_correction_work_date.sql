-- 003: Record which calendar day a correction is for, and allow only one open
-- (PENDING) request per user per day. The old application-level check only covered
-- days that already had an attendance row, so absent days could collect duplicates.

ALTER TABLE correction_requests ADD COLUMN work_date DATE;

-- Backfill: the attendance day if linked, otherwise the requested clock-in day
-- (evaluated in the default office timezone, Asia/Kolkata).
UPDATE correction_requests cr
SET work_date = COALESCE(
    (SELECT a.date FROM attendance a WHERE a.id = cr.attendance_id),
    (cr.requested_clock_in AT TIME ZONE 'Asia/Kolkata')::date
);

ALTER TABLE correction_requests ALTER COLUMN work_date SET NOT NULL;

CREATE UNIQUE INDEX uq_correction_one_pending_per_day
    ON correction_requests (user_id, work_date)
    WHERE status = 'PENDING';
