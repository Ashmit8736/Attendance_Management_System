import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast, getErrorMessage } from '../context/ToastContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { TableEmpty } from '../components/common/TableState';
import { attendanceService } from '../services/attendanceService';
import { StatCard } from '../components/common/StatCard';
import { StatusBadge } from '../components/common/Badge';
import { formatTime, formatDate, formatHours } from '../utils/formatters';
import {
  Clock,
  LogIn,
  LogOut,
  CalendarCheck,
  AlertTriangle,
  Award,
  Timer,
  CheckCircle2,
  Loader2,
  CalendarX,
  WifiOff,
} from 'lucide-react';

// "09:00:00" + 15 minutes -> "09:15:00"
const addMinutesToTime = (timeStr, minutes) => {
  const [h = 0, m = 0] = String(timeStr).split(':').map(Number);
  const total = Math.min(h * 60 + m + (Number(minutes) || 0), 24 * 60 - 1);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}:00`;
};

export const DashboardPage = () => {
  usePageTitle('Dashboard');
  const toast = useToast();
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayData, setTodayData] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [recentRecords, setRecentRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // The full-page loader only shows on the first load; refreshes after clock actions keep the page in place
  const loadDashboardData = async ({ initial = false } = {}) => {
    try {
      if (initial) setLoading(true);
      setLoadError(false);
      const [todayRes, metricsRes, historyRes] = await Promise.all([
        attendanceService.getTodayStatus(),
        attendanceService.getMetrics(),
        attendanceService.getHistory({ limit: 5 }),
      ]);

      setTodayData(todayRes.data);
      setMetrics(metricsRes.data);
      setRecentRecords(historyRes.data?.records || []);
    } catch (error) {
      setLoadError(true);
      toast.error(getErrorMessage(error, 'Could not load your dashboard.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData({ initial: true });
  }, []);

  const handleClockIn = async () => {
    try {
      setActionLoading(true);
      await attendanceService.clockIn(notes);
      toast.success('Clocked in. Have a productive day!');
      setNotes('');
      await loadDashboardData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Clock-in failed.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    try {
      setActionLoading(true);
      await attendanceService.clockOut(notes);
      toast.success('Clocked out. See you tomorrow!');
      setNotes('');
      await loadDashboardData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Clock-out failed.'));
    } finally {
      setActionLoading(false);
    }
  };

  const todayRecord = todayData?.record;
  const isClockedIn = !!todayRecord?.clock_in;
  const isClockedOut = !!todayRecord?.clock_out;

  const getElapsedTimeString = () => {
    if (!isClockedIn || isClockedOut) return null;
    const inTime = new Date(todayRecord.clock_in);
    const diffMs = Math.max(0, currentTime - inTime);
    const totalSecs = Math.floor(diffMs / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="loader-center-wrapper" role="status">
        <Loader2 size={36} className="spinner" aria-hidden="true" />
        <span className="sr-only">Loading dashboard</span>
      </div>
    );
  }

  if (loadError && !todayData) {
    return (
      <div className="card">
        <div className="empty-state">
          <WifiOff size={28} className="empty-state-icon" aria-hidden="true" />
          <p className="empty-state-title">Couldn't load your dashboard</p>
          <p className="empty-state-hint">Check your connection and try again.</p>
          <button type="button" className="btn-secondary" onClick={() => loadDashboardData({ initial: true })}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {/* Welcome & Live Time Banner */}
      <div className="welcome-banner">
        <div>
          <span className="welcome-tag">
            Active Session
          </span>
          <h2 className="welcome-title">
            {user?.name} 👋
          </h2>
          <p className="welcome-sub">
            {user?.designation} • {user?.department}
          </p>
        </div>

        <div className="live-clock-card" role="timer" aria-label="Current date and time">
          <p className="live-date-text">
            {currentTime.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          <div className="live-time-display">
            {currentTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
            })}
          </div>
        </div>
      </div>

      {/* Clock In / Out Action Panel */}
      <div className="card">
        <div className="station-header">
          <div>
            <h3 className="station-title">Today's Attendance Station</h3>
            <p className="station-sub">
              On time until {formatTime(addMinutesToTime(todayData?.rules?.office_start_time || '09:00:00', todayData?.rules?.grace_period_minutes ?? 15))}
              {' • '}Late until {formatTime(todayData?.rules?.late_threshold_time || '09:30:00')}
            </p>
          </div>
          {todayRecord && (
            <div>
              <StatusBadge status={todayRecord.status} />
            </div>
          )}
        </div>

        <div className="station-grid">
          {/* Status Details */}
          <div>
            <div className="status-metrics-grid">
              <div className="metric-box">
                <p className="metric-label">Clock In</p>
                <p className="metric-value">
                  {formatTime(todayRecord?.clock_in)}
                </p>
              </div>

              <div className="metric-box">
                <p className="metric-label">Clock Out</p>
                <p className="metric-value">
                  {formatTime(todayRecord?.clock_out)}
                </p>
              </div>

              <div className="metric-box">
                <p className="metric-label">Working Time</p>
                <p className="metric-value">
                  {isClockedIn && !isClockedOut ? (
                    <span className="live-elapsed-time">
                      {getElapsedTimeString()}
                    </span>
                  ) : (
                    formatHours(todayRecord?.total_hours)
                  )}
                </p>
              </div>
            </div>

            {!isClockedOut && (
              <div>
                <label htmlFor="shift-note" className="sr-only">
                  Shift note (optional)
                </label>
                <input
                  id="shift-note"
                  type="text"
                  maxLength={500}
                  placeholder="Optional shift note (e.g. Remote work, field visit)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="form-input"
                />
              </div>
            )}
          </div>

          {/* Action Trigger Button */}
          <div className="action-button-panel">
            {!isClockedIn ? (
              <button
                onClick={handleClockIn}
                disabled={actionLoading}
                aria-busy={actionLoading}
                className="btn-clock-in"
              >
                {actionLoading ? (
                  <>
                    <Loader2 size={24} className="spinner" aria-hidden="true" />
                    <span className="sr-only">Clocking in</span>
                  </>
                ) : (
                  <>
                    <LogIn size={24} aria-hidden="true" />
                    <span>Clock In Now</span>
                  </>
                )}
              </button>
            ) : !isClockedOut ? (
              <button
                onClick={handleClockOut}
                disabled={actionLoading}
                aria-busy={actionLoading}
                className="btn-clock-out"
              >
                {actionLoading ? (
                  <>
                    <Loader2 size={24} className="spinner" aria-hidden="true" />
                    <span className="sr-only">Clocking out</span>
                  </>
                ) : (
                  <>
                    <LogOut size={24} aria-hidden="true" />
                    <span>Clock Out</span>
                  </>
                )}
              </button>
            ) : (
              <div className="done-state">
                <div className="done-icon">
                  <CheckCircle2 size={24} />
                </div>
                <p className="cell-name-lg">Shift Completed</p>
                <p className="done-sub">Recorded for today</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div>
        <p className="form-label mb-sm">
          Performance Overview
        </p>
        <div className="metrics-overview-grid">
          <StatCard
            title="Total Logged Days"
            value={metrics?.total_days || metrics?.total_records || '0'}
            icon={CalendarCheck}
            color="blue"
            subtitle="Current cycle"
          />
          <StatCard
            title="On-Time Arrivals"
            value={metrics?.present_days || metrics?.present_count || '0'}
            icon={Award}
            color="emerald"
            subtitle="Full-day present"
          />
          <StatCard
            title="Late Arrivals"
            value={metrics?.late_days || metrics?.late_count || '0'}
            icon={AlertTriangle}
            color="amber"
            subtitle="After grace period"
          />
          <StatCard
            title="Average Work Hours"
            value={`${metrics?.avg_hours || '0'} hrs`}
            icon={Timer}
            color="purple"
            subtitle="Per working day"
          />
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="card">
        <div className="section-header">
          <h3 className="section-title">Recent Attendance Logs</h3>
          <Link to="/attendance" className="section-link">
            View Full History →
          </Link>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <caption className="sr-only">Your most recent attendance records</caption>
            <thead>
              <tr>
                <th>Date</th>
                {user?.role !== 'EMPLOYEE' && <th>Employee</th>}
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Total Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentRecords.length === 0 ? (
                <TableEmpty
                  colSpan={user?.role !== 'EMPLOYEE' ? 6 : 5}
                  icon={CalendarX}
                  title="No attendance records yet"
                  hint="Clock in above to start your first record."
                />
              ) : (
                recentRecords.map((rec) => (
                  <tr key={rec.id}>
                    <td className="fw-semibold">
                      {formatDate(rec.date)}
                    </td>
                    {user?.role !== 'EMPLOYEE' && (
                      <td className="fw-semibold">
                        {rec.user_name}
                      </td>
                    )}
                    <td>{formatTime(rec.clock_in)}</td>
                    <td>{formatTime(rec.clock_out)}</td>
                    <td className="fw-bold">
                      {formatHours(rec.total_hours)}
                    </td>
                    <td>
                      <StatusBadge status={rec.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
