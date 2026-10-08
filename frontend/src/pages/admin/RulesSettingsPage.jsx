import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { formatDate, formatTime } from '../../utils/formatters';
import { useToast, getErrorMessage } from '../../context/ToastContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ShieldCheck, AlertTriangle, Loader2, WifiOff, Info } from 'lucide-react';

const toMinutes = (timeStr) => {
  const [h = 0, m = 0] = String(timeStr || '').split(':').map(Number);
  return h * 60 + m;
};

const minutesToTime = (total) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}:00`;

// Same consistency rules the server and database enforce, checked up front for instant feedback
const validateForm = (f) => {
  const onTimeUntil = toMinutes(f.office_start_time) + f.grace_period_minutes;
  if (toMinutes(f.late_threshold_time) < onTimeUntil) {
    return `Late cutoff must be at or after ${formatTime(minutesToTime(onTimeUntil))} (start time + grace period).`;
  }
  if (f.half_day_min_hours >= f.full_day_min_hours) {
    return 'Half-day hours must be less than full-day hours.';
  }
  return null;
};

export const RulesSettingsPage = () => {
  usePageTitle('Attendance Rules');
  const toast = useToast();
  const [rules, setRules] = useState(null);
  const [formData, setFormData] = useState({
    office_start_time: '09:00:00',
    grace_period_minutes: 15,
    late_threshold_time: '09:30:00',
    half_day_min_hours: 4.0,
    full_day_min_hours: 8.0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchRules = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await adminService.getRules();
      if (res.data) {
        setRules(res.data);
        setFormData({
          office_start_time: res.data.office_start_time ?? '09:00:00',
          grace_period_minutes: res.data.grace_period_minutes ?? 15,
          late_threshold_time: res.data.late_threshold_time ?? '09:30:00',
          half_day_min_hours: parseFloat(res.data.half_day_min_hours ?? 4),
          full_day_min_hours: parseFloat(res.data.full_day_min_hours ?? 8),
        });
      }
    } catch (error) {
      setLoadError(true);
      toast.error(getErrorMessage(error, 'Could not load attendance rules.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formError) {
      toast.error(formError);
      return;
    }
    setSaving(true);

    try {
      const res = await adminService.updateRules(formData);
      setRules(res.data);
      toast.success('Attendance rules saved. They apply to new clock-ins from now on.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update rules.'));
    } finally {
      setSaving(false);
    }
  };

  const formError = validateForm(formData);
  const onTimeUntil = minutesToTime(toMinutes(formData.office_start_time) + formData.grace_period_minutes);

  if (loading) {
    return (
      <div className="loader-center-wrapper" role="status">
        <Loader2 size={36} className="spinner" aria-hidden="true" />
        <span className="sr-only">Loading attendance rules</span>
      </div>
    );
  }

  if (loadError && !rules) {
    return (
      <div className="card">
        <div className="empty-state">
          <WifiOff size={28} className="empty-state-icon" aria-hidden="true" />
          <p className="empty-state-title">Couldn't load attendance rules</p>
          <p className="empty-state-hint">Check your connection and try again.</p>
          <button type="button" className="btn-secondary" onClick={fetchRules}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rules-page">
      {/* Header */}
      <div>
        <h2 className="page-title">Attendance Policy Rules</h2>
        <p className="page-description">
          Configure business rules, grace period tolerances, and automated late/half-day thresholds
        </p>
      </div>

      {/* Rules Form */}
      <form onSubmit={handleSubmit} className="card stack-lg">
        <div className="rules-form-grid">
          {/* Office Start Time */}
          <div className="rule-setting-card">
            <label className="form-label rule-label" htmlFor="rule-start">
              Standard Office Start Time
            </label>
            <input
              id="rule-start"
              type="time"
              step="1"
              required
              value={formData.office_start_time}
              onChange={(e) => setFormData({ ...formData, office_start_time: e.target.value })}
              className="form-input fw-bold"
             
            />
            <p className="rule-hint-text">
              Official shift start timestamp (Default 09:00:00 AM)
            </p>
          </div>

          {/* Grace Period */}
          <div className="rule-setting-card">
            <label className="form-label rule-label" htmlFor="rule-grace">
              Grace Period (Minutes)
            </label>
            <input
              id="rule-grace"
              type="number"
              min="0"
              max="120"
              required
              value={formData.grace_period_minutes}
              onChange={(e) =>
                setFormData({ ...formData, grace_period_minutes: parseInt(e.target.value, 10) || 0 })
              }
              className="form-input fw-bold"
             
            />
            <p className="rule-hint-text">
              Clock-in up to start time + grace is 'PRESENT'; after that it is 'LATE'
            </p>
          </div>

          {/* Late Threshold */}
          <div className="rule-setting-card">
            <label className="form-label rule-label" htmlFor="rule-cutoff">
              Late Cutoff Time
            </label>
            <input
              id="rule-cutoff"
              type="time"
              step="1"
              required
              value={formData.late_threshold_time}
              onChange={(e) => setFormData({ ...formData, late_threshold_time: e.target.value })}
              className="form-input fw-bold"
             
            />
            <p className="rule-hint-text">
              Clock-ins after this time are classified as 'HALF_DAY'. Must be at or after start + grace
            </p>
          </div>

          {/* Half Day Hours */}
          <div className="rule-setting-card">
            <label className="form-label rule-label" htmlFor="rule-half">
              Half-Day Minimum Hours
            </label>
            <input
              id="rule-half"
              type="number"
              step="0.5"
              min="1"
              max="12"
              required
              value={formData.half_day_min_hours}
              onChange={(e) =>
                setFormData({ ...formData, half_day_min_hours: parseFloat(e.target.value) || 0 })
              }
              className="form-input fw-bold"
             
            />
            <p className="rule-hint-text">
              Shifts with total hours below this threshold become 'HALF_DAY'
            </p>
          </div>

          {/* Full Day Hours */}
          <div className="rule-setting-card col-span-full">
            <label className="form-label rule-label" htmlFor="rule-full">
              Full-Day Standard Shift Hours
            </label>
            <input
              id="rule-full"
              type="number"
              step="0.5"
              min="4"
              max="16"
              required
              value={formData.full_day_min_hours}
              onChange={(e) =>
                setFormData({ ...formData, full_day_min_hours: parseFloat(e.target.value) || 0 })
              }
              className="form-input fw-bold"
             
            />
            <p className="rule-hint-text">
              Expected daily work duration (Default 8.00 hours)
            </p>
          </div>
        </div>

        {/* Live preview of what the numbers mean */}
        <div className="rules-preview" aria-live="polite">
          <Info size={16} aria-hidden="true" />
          <p>
            Clock-in up to <strong>{formatTime(onTimeUntil)}</strong> is on time, up to{' '}
            <strong>{formatTime(formData.late_threshold_time)}</strong> is late, and after that counts as a half day.
          </p>
        </div>

        {formError && (
          <div className="alert-banner alert-danger" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        {/* Audit Meta */}
        {rules?.updated_at && (
          <div className="rules-info-bar">
            <span>Last policy revision: {formatDate(rules.updated_at)}</span>
            {rules.updated_by_name && <span>Modified by: {rules.updated_by_name}</span>}
          </div>
        )}

        <div className="form-actions-end">
          <button
            type="submit"
            disabled={saving || !!formError}
            className="btn-primary btn-roomy"
           
          >
            {saving ? (
              <Loader2 size={16} className="spinner" aria-label="Saving" />
            ) : (
              <>
                <ShieldCheck size={16} aria-hidden="true" />
                <span>Save Attendance Rules</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
