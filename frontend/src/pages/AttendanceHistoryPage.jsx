import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { attendanceService } from '../services/attendanceService';
import { correctionService } from '../services/correctionService';
import { StatusBadge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Pagination } from '../components/common/Pagination';
import { TableLoading, TableEmpty } from '../components/common/TableState';
import { useToast, getErrorMessage } from '../context/ToastContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { formatDate, formatTime, formatHours, toDateInputValue, toDateTimeInputValue } from '../utils/formatters';
import {
  Filter,
  FileEdit,
  Loader2,
  AlertTriangle,
  RotateCcw,
  CalendarX,
  WifiOff,
} from 'lucide-react';

export const AttendanceHistoryPage = () => {
  usePageTitle('Attendance History');
  const toast = useToast();
  const { user, isHR } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [requestedIn, setRequestedIn] = useState('');
  const [requestedOut, setRequestedOut] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalFeedback, setModalFeedback] = useState(null);

  // `filters` lets callers (e.g. Reset) fetch with new values before React state has updated
  const fetchHistory = async (page = 1, filters = { startDate, endDate, status: statusFilter }) => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await attendanceService.getHistory({
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        status: filters.status || undefined,
        page,
        limit: 15,
      });

      setRecords(res.data?.records || []);
      setPagination(res.data?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      setLoadError(true);
      toast.error(getErrorMessage(error, 'Could not load attendance history.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(1);
  }, [statusFilter]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchHistory(1);
  };

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setStatusFilter('');
    fetchHistory(1, { startDate: '', endDate: '', status: '' });
  };

  const openCorrectionModal = (record) => {
    setSelectedRecord(record);
    const recDate = toDateInputValue(record.date);
    const nowInput = toDateTimeInputValue(new Date());
    
    if (record.clock_in) {
      setRequestedIn(toDateTimeInputValue(record.clock_in));
    } else {
      setRequestedIn(`${recDate}T09:00`);
    }

    if (record.clock_out) {
      setRequestedOut(toDateTimeInputValue(record.clock_out));
    } else {
      // Default to end of day, but never a time that has not happened yet (the server rejects those)
      const endOfDay = `${recDate}T18:00`;
      setRequestedOut(endOfDay > nowInput ? nowInput : endOfDay);
    }

    setReason('');
    setModalFeedback(null);
    setIsModalOpen(true);
  };

  const handleCorrectionSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setModalFeedback(null);

    try {
      await correctionService.createRequest({
        attendance_id: selectedRecord.id,
        requested_clock_in: requestedIn,
        requested_clock_out: requestedOut,
        reason,
      });

      setIsModalOpen(false);
      toast.success('Correction request submitted to HR/Admin for approval.');
    } catch (error) {
      setModalFeedback({
        type: 'error',
        text: getErrorMessage(error, 'Submission failed.'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="attendance-history-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Attendance History</h2>
          <p className="page-description">
            {isHR ? 'Review organization-wide attendance records and time logs' : 'View past attendance records and request shift corrections'}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card filter-card">
        <form onSubmit={handleFilterSubmit} className="filter-grid">
          <div>
            <label className="form-label" htmlFor="hist-start">
              Start Date
            </label>
            <input
              id="hist-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label" htmlFor="hist-end">
              End Date
            </label>
            <input
              id="hist-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label" htmlFor="hist-status">
              Status Filter
            </label>
            <select
              id="hist-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select"
            >
              <option value="">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="ABSENT">Absent</option>
            </select>
          </div>

          <div className="filter-actions">
            <button
              type="submit"
              className="btn-primary flex-fill"
             
            >
              <Filter size={15} aria-hidden="true" />
              <span>Apply</span>
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              aria-label="Reset filters"
              title="Reset filters"
              className="btn-icon-reset"
            >
              <RotateCcw size={15} aria-hidden="true" />
            </button>
          </div>
        </form>
      </div>

      {/* History Table */}
      <div className="card table-card">
        <div className="data-table-container">
          <table className="data-table" aria-busy={loading}>
            <caption className="sr-only">Attendance records</caption>
            <thead>
              <tr>
                <th>Date</th>
                {isHR && <th>Employee</th>}
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Total Hours</th>
                <th>Status</th>
                <th>Notes</th>
                <th className="cell-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoading colSpan={8} label="Loading attendance records" />
              ) : loadError ? (
                <TableEmpty
                  colSpan={8}
                  icon={WifiOff}
                  title="Couldn't load attendance records"
                  hint="Check your connection and try again."
                  action={
                    <button type="button" className="btn-secondary" onClick={() => fetchHistory(pagination.page)}>
                      Try again
                    </button>
                  }
                />
              ) : records.length === 0 ? (
                <TableEmpty
                  colSpan={8}
                  icon={CalendarX}
                  title="No attendance records found"
                  hint={
                    startDate || endDate || statusFilter
                      ? 'Try widening the date range or clearing the filters.'
                      : 'Records appear here after the first clock-in.'
                  }
                />
              ) : (
                records.map((rec) => (
                  <tr key={rec.id}>
                    <td className="fw-bold">
                      {formatDate(rec.date)}
                    </td>
                    {isHR && (
                      <td>
                        <p className="cell-name">{rec.user_name}</p>
                        <p className="cell-sub">{rec.user_department}</p>
                      </td>
                    )}
                    <td className="cell-mono">
                      {formatTime(rec.clock_in)}
                    </td>
                    <td className="cell-mono">
                      {formatTime(rec.clock_out)}
                    </td>
                    <td className="fw-bold">
                      {formatHours(rec.total_hours)}
                    </td>
                    <td>
                      <div className="flex-center">
                        <StatusBadge status={rec.status} />
                        {rec.is_corrected && (
                          <span className="badge-corrected-tag">
                            Corrected
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="cell-truncate">
                      {rec.notes || '—'}
                    </td>
                    <td className="cell-right">
                      {user?.id === rec.user_id && (
                        <button
                          onClick={() => openCorrectionModal(rec)}
                          className="btn-action-correction"
                        >
                          <FileEdit size={14} aria-hidden="true" />
                          <span>Correction</span>
                          <span className="sr-only"> for {formatDate(rec.date)}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination pagination={pagination} onPageChange={(page) => fetchHistory(page)} />
      </div>

      {/* Request Correction Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Request Attendance Correction"
        wide
      >
        <form onSubmit={handleCorrectionSubmit} className="stack-md">
          {modalFeedback && (
            <div className="alert-banner alert-danger" role="alert">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>{modalFeedback.text}</span>
            </div>
          )}

          <div className="request-summary-box">
            <p className="detail-line">
              Target Date: <strong>{formatDate(selectedRecord?.date)}</strong>
            </p>
            <p className="detail-muted">
              Current Log: {formatTime(selectedRecord?.clock_in)} → {formatTime(selectedRecord?.clock_out)} ({formatHours(selectedRecord?.total_hours)})
            </p>
          </div>

          <div className="form-grid-2">
            <div>
              <label className="form-label" htmlFor="corr-in">
                Requested Clock-In
              </label>
              <input
                id="corr-in"
                max={toDateTimeInputValue(new Date())}
                type="datetime-local"
                required
                value={requestedIn}
                onChange={(e) => setRequestedIn(e.target.value)}
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="corr-out">
                Requested Clock-Out
              </label>
              <input
                id="corr-out"
                max={toDateTimeInputValue(new Date())}
                type="datetime-local"
                required
                value={requestedOut}
                onChange={(e) => setRequestedOut(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div>
            <label className="form-label" htmlFor="corr-reason">
              Reason / Explanation
            </label>
            <textarea
              id="corr-reason"
              required
              minLength={5}
              maxLength={500}
              rows="3"
              placeholder="Specify justification (e.g. Biometric reader failure, client site meeting)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="form-textarea"
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? <Loader2 size={16} className="spinner" /> : 'Submit for Review'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
