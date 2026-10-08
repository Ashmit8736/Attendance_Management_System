import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { formatDate, formatTime } from '../../utils/formatters';
import { Code2, ShieldOff, WifiOff } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Pagination } from '../../components/common/Pagination';
import { TableLoading, TableEmpty } from '../../components/common/TableState';
import { useToast, getErrorMessage } from '../../context/ToastContext';
import { usePageTitle } from '../../hooks/usePageTitle';

export const AuditLogsPage = () => {
  usePageTitle('Audit Logs');
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchLogs = async (page = 1) => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await adminService.getAuditLogs({
        action: actionFilter || undefined,
        page,
        limit: 20,
      });

      setLogs(res.data?.logs || []);
      setPagination(res.data?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      setLoadError(true);
      toast.error(getErrorMessage(error, 'Could not load audit logs.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [actionFilter]);

  const viewPayload = (log) => {
    setSelectedLog(log);
    setIsModalOpen(true);
  };

  const getActionBadgeClass = (action) => {
    if (action.includes('APPROVED')) return 'badge-approved';
    if (action.includes('REJECTED')) return 'badge-rejected';
    if (action.includes('CLOCK')) return 'badge-present';
    if (action.includes('UPDATE')) return 'badge-late';
    return 'badge-halfday';
  };

  return (
    <div className="audit-logs-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">System Audit Trail</h2>
          <p className="page-description">
            Append-only record of sign-ins, clock-ins, administrative updates, and correction reviews
          </p>
        </div>

        {/* Filter */}
        <div>
          <label htmlFor="audit-action-filter" className="sr-only">
            Filter by action
          </label>
          <select
            id="audit-action-filter"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="form-select input-auto-width"
           
          >
            <option value="">All Actions</option>
            <option value="USER_LOGIN">Sign In</option>
            <option value="CLOCK_IN">Clock In</option>
            <option value="CLOCK_OUT">Clock Out</option>
            <option value="CORRECTION_REQUESTED">Correction Requested</option>
            <option value="CORRECTION_APPROVED">Correction Approved</option>
            <option value="CORRECTION_REJECTED">Correction Rejected</option>
            <option value="CREATE_USER">Create User</option>
            <option value="UPDATE_USER">Update User</option>
            <option value="DEACTIVATE_USER">Deactivate User</option>
            <option value="ACTIVATE_USER">Activate User</option>
            <option value="UPDATE_ATTENDANCE_RULES">Update Rules</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card table-card">
        <div className="data-table-container">
          <table className="data-table" aria-busy={loading}>
            <caption className="sr-only">System audit trail</caption>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>IP Address</th>
                <th className="cell-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoading colSpan={6} label="Loading audit logs" />
              ) : loadError ? (
                <TableEmpty
                  colSpan={6}
                  icon={WifiOff}
                  title="Couldn't load audit logs"
                  hint="Check your connection and try again."
                  action={
                    <button type="button" className="btn-secondary" onClick={() => fetchLogs(pagination.page)}>
                      Try again
                    </button>
                  }
                />
              ) : logs.length === 0 ? (
                <TableEmpty
                  colSpan={6}
                  icon={ShieldOff}
                  title="No audit entries found"
                  hint={actionFilter ? 'Nothing has been logged for this action yet.' : 'Activity will be recorded here as people use the system.'}
                />
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="cell-mono-dark">
                      {formatDate(log.created_at)} {formatTime(log.created_at)}
                    </td>
                    <td>
                      {log.user_name ? (
                        <div>
                          <p className="cell-name">{log.user_name}</p>
                          <p className="cell-sub">{log.user_email}</p>
                        </div>
                      ) : (
                        <span className="cell-system-auto">System Auto</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${getActionBadgeClass(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="cell-action-text">
                      {log.entity_type} {log.entity_id ? `(#${log.entity_id})` : ''}
                    </td>
                    <td className="cell-mono-muted">
                      {log.ip_address || '127.0.0.1'}
                    </td>
                    <td className="cell-right">
                      <button
                        onClick={() => viewPayload(log)}
                        className="btn-secondary btn-compact"
                        title="View JSON payload"
                        aria-label={`View details of ${log.action} entry #${log.id}`}
                      >
                        <Code2 size={14} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination pagination={pagination} onPageChange={fetchLogs} noun="audit records" />
      </div>

      {/* Payload Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Audit Entry Details (#${selectedLog?.id})`}
        wide
      >
        <div className="stack-sm">
          <div className="request-summary-box">
            <p className="detail-line"><strong>Action:</strong> {selectedLog?.action}</p>
            <p className="detail-line"><strong>Entity:</strong> {selectedLog?.entity_type} {selectedLog?.entity_id && `(#${selectedLog?.entity_id})`}</p>
            <p className="detail-line"><strong>Actor:</strong> {selectedLog?.user_name || 'System'}</p>
            <p className="no-margin"><strong>Timestamp:</strong> {selectedLog?.created_at}</p>
          </div>

          <div>
            <p className="form-label" id="audit-payload-label">
              JSON Payload Data
            </p>
            <pre className="json-payload-viewer" aria-labelledby="audit-payload-label" tabIndex={0}>
              {JSON.stringify(selectedLog?.details, null, 2)}
            </pre>
          </div>

          <div className="modal-footer">
            <button
              onClick={() => setIsModalOpen(false)}
              className="btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
