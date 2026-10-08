import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { correctionService } from '../services/correctionService';
import { CorrectionBadge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Pagination } from '../components/common/Pagination';
import { TableLoading, TableEmpty } from '../components/common/TableState';
import { useToast, getErrorMessage } from '../context/ToastContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { formatDate, formatTime } from '../utils/formatters';
import {
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  FileX,
  WifiOff,
} from 'lucide-react';

export const CorrectionsPage = () => {
  usePageTitle('Corrections');
  const toast = useToast();
  const { isHR } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [statusFilter, setStatusFilter] = useState('');

  const [selectedReq, setSelectedReq] = useState(null);
  const [reviewAction, setReviewAction] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const fetchRequests = async (page = 1) => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await correctionService.getRequests({
        status: statusFilter || undefined,
        page,
        limit: 15,
      });
      setRequests(res.data?.requests || []);
      setPagination(res.data?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      setLoadError(true);
      toast.error(getErrorMessage(error, 'Could not load correction requests.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests(1);
  }, [statusFilter]);

  const openReviewModal = (req, action) => {
    setSelectedReq(req);
    setReviewAction(action);
    setReviewNote('');
    setFeedback(null);
    setIsReviewModalOpen(true);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewing(true);
    setFeedback(null);

    try {
      await correctionService.reviewRequest(selectedReq.id, {
        status: reviewAction,
        review_note: reviewNote,
      });

      setIsReviewModalOpen(false);
      toast.success(`Request ${reviewAction.toLowerCase()} successfully.`);
      fetchRequests(pagination.page);
    } catch (error) {
      setFeedback({
        type: 'error',
        text: getErrorMessage(error, 'Review submission failed.'),
      });
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="corrections-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">
            Attendance Corrections
          </h2>
          <p className="page-description">
            {isHR
              ? 'Review, approve, or reject employee attendance correction requests'
              : 'Track the status and history of your requested attendance adjustments'}
          </p>
        </div>

        {/* Filter */}
        <div className="corrections-filter-bar">
          <label className="form-label no-margin" htmlFor="corr-status-filter">Status:</label>
          <select
            id="corr-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-select input-auto-width"
           
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Requests List */}
      <div className="card table-card">
        <div className="data-table-container">
          <table className="data-table" aria-busy={loading}>
            <caption className="sr-only">Attendance correction requests</caption>
            <thead>
              <tr>
                <th>Requested On</th>
                {isHR && <th>Employee</th>}
                <th>Target Date</th>
                <th>Requested Shift</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Reviewer Note</th>
                {isHR && <th className="cell-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoading colSpan={isHR ? 8 : 6} label="Loading correction requests" />
              ) : loadError ? (
                <TableEmpty
                  colSpan={isHR ? 8 : 6}
                  icon={WifiOff}
                  title="Couldn't load correction requests"
                  hint="Check your connection and try again."
                  action={
                    <button type="button" className="btn-secondary" onClick={() => fetchRequests(pagination.page)}>
                      Try again
                    </button>
                  }
                />
              ) : requests.length === 0 ? (
                <TableEmpty
                  colSpan={isHR ? 8 : 6}
                  icon={FileX}
                  title="No correction requests found"
                  hint={
                    statusFilter
                      ? 'No requests match this status. Try "All Statuses".'
                      : isHR
                        ? 'New requests from employees will show up here.'
                        : 'Use "Correction" on a day in Attendance History to raise one.'
                  }
                />
              ) : (
                requests.map((req) => (
                  <tr key={req.id}>
                    <td className="cell-id">
                      {formatDate(req.created_at)}
                    </td>
                    {isHR && (
                      <td>
                        <p className="cell-name">{req.user_name}</p>
                        <p className="cell-sub">{req.user_department}</p>
                      </td>
                    )}
                    <td className="cell-bold-sm">
                      {formatDate(req.requested_clock_in)}
                    </td>
                    <td className="cell-mono-dark">
                      {formatTime(req.requested_clock_in)} → {formatTime(req.requested_clock_out)}
                    </td>
                    <td className="cell-reason">
                      {req.reason}
                    </td>
                    <td>
                      <CorrectionBadge status={req.status} />
                    </td>
                    <td className="cell-text-muted">
                      {req.review_note ? (
                        <span>
                          <strong>{req.reviewer_name}:</strong> {req.review_note}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    {isHR && (
                      <td className="cell-right">
                        {req.status === 'PENDING' ? (
                          <div className="corrections-actions-cell">
                            <button
                              onClick={() => openReviewModal(req, 'APPROVED')}
                              className="btn-approve-action"
                              title="Approve request"
                              aria-label={`Approve request from ${req.user_name}`}
                            >
                              <CheckCircle size={16} aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => openReviewModal(req, 'REJECTED')}
                              className="btn-reject-action"
                              title="Reject request"
                              aria-label={`Reject request from ${req.user_name}`}
                            >
                              <XCircle size={16} aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          <span className="cell-processed">Processed</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination pagination={pagination} onPageChange={fetchRequests} noun="requests" />
      </div>

      {/* Review Modal */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title={`${reviewAction === 'APPROVED' ? 'Approve' : 'Reject'} Correction Request`}
      >
        <form onSubmit={handleReviewSubmit} className="stack-md">
          {feedback && (
            <div className="alert-banner alert-danger" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{feedback.text}</span>
            </div>
          )}

          <div className="request-summary-box">
            <p className="detail-line">
              Employee: <strong>{selectedReq?.user_name}</strong> ({selectedReq?.user_email})
            </p>
            <p className="detail-line">
              Requested Time: {formatTime(selectedReq?.requested_clock_in)} → {formatTime(selectedReq?.requested_clock_out)}
            </p>
            <p className="detail-note">
              "{selectedReq?.reason}"
            </p>
          </div>

          <div>
            <label className="form-label" htmlFor="review-note">
              Reviewer Note / Justification{reviewAction === 'REJECTED' ? ' (required)' : ''}
            </label>
            <textarea
              id="review-note"
              maxLength={500}
              required={reviewAction === 'REJECTED'}
              rows="3"
              placeholder={
                reviewAction === 'APPROVED'
                  ? 'Optional approval note...'
                  : 'Specify reason for rejection...'
              }
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              className="form-textarea"
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={() => setIsReviewModalOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={reviewing}
              className={reviewAction === 'APPROVED' ? 'btn-primary' : 'btn-danger'}
            >
              {reviewing ? (
                <Loader2 size={16} className="spinner" />
              ) : reviewAction === 'APPROVED' ? (
                'Confirm Approval'
              ) : (
                'Confirm Rejection'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
