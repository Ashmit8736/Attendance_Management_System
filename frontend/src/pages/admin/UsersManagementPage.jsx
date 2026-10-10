import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { RoleBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Pagination } from '../../components/common/Pagination';
import { TableLoading, TableEmpty } from '../../components/common/TableState';
import { useToast, getErrorMessage } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatDate } from '../../utils/formatters';
import {
  UserPlus,
  Search,
  CheckCircle,
  XCircle,
  Edit2,
  Loader2,
  AlertCircle,
  UserX,
  WifiOff,
  Eye,
  EyeOff,
} from 'lucide-react';

export const UsersManagementPage = () => {
  usePageTitle('User Directory');
  const toast = useToast();
  const confirm = useConfirm();
  const { isAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('CREATE');
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'EMPLOYEE',
    designation: 'Staff',
    department: 'General',
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const fetchUsers = async (page = 1) => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await adminService.getUsers({
        search: searchTerm || undefined,
        role: roleFilter || undefined,
        page,
        limit: 15,
      });
      setUsers(res.data?.users || []);
      setPagination(res.data?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      setLoadError(true);
      toast.error(getErrorMessage(error, 'Could not load users.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1);
  }, [roleFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers(1);
  };

  const openCreateModal = () => {
    setModalMode('CREATE');
    setSelectedUser(null);
    setShowPassword(false);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'EMPLOYEE',
      designation: 'Software Engineer',
      department: 'Engineering',
    });
    setFeedback(null);
    setIsModalOpen(true);
  };

  const openEditModal = (u) => {
    setModalMode('EDIT');
    setSelectedUser(u);
    setShowPassword(false);
    setFormData({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      designation: u.designation || '',
      department: u.department || '',
    });
    setFeedback(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFeedback(null);

    try {
      if (modalMode === 'CREATE') {
        await adminService.createUser(formData);
        toast.success(`${formData.name} was added.`);
      } else {
        await adminService.updateUser(selectedUser.id, formData);
        toast.success('User details updated.');
      }

      setIsModalOpen(false);
      fetchUsers(modalMode === 'CREATE' ? 1 : pagination.page);
    } catch (error) {
      setFeedback({
        type: 'error',
        text: getErrorMessage(error, 'Operation failed.'),
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleStatus = async (userToToggle) => {
    const deactivating = userToToggle.is_active;
    const confirmed = await confirm({
      title: deactivating ? 'Deactivate user?' : 'Activate user?',
      message: deactivating
        ? `${userToToggle.name} will no longer be able to sign in. Their attendance history is kept, and you can reactivate the account at any time.`
        : `${userToToggle.name} will be able to sign in again.`,
      confirmText: deactivating ? 'Deactivate' : 'Activate',
      tone: deactivating ? 'danger' : 'primary',
    });
    if (!confirmed) return;

    try {
      await adminService.toggleUserStatus(userToToggle.id);
      toast.success(`${userToToggle.name} ${deactivating ? 'deactivated' : 'activated'}.`);
      fetchUsers(pagination.page);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Status change failed.'));
    }
  };

  return (
    <div className="users-management-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">User & Role Management</h2>
          <p className="page-description">
            Manage organization members, assign roles (Employee, HR, Admin), and toggle access
          </p>
        </div>

        {isAdmin ? (
          <button
            onClick={openCreateModal}
            className="btn-primary"
          >
            <UserPlus size={16} />
            <span>Add New User</span>
          </button>
        ) : currentUser?.role === 'HR' ? (
          <button
            onClick={openCreateModal}
            className="btn-primary"
          >
            <UserPlus size={16} />
            <span>Add Employee</span>
          </button>
        ) : null}
      </div>

      {/* Filter / Search Bar */}
      <div className="card user-search-bar search-bar-pad">
        <form onSubmit={handleSearchSubmit} className="search-input-wrapper">
          <Search size={16} className="search-icon-pos" aria-hidden="true" />
          <label htmlFor="user-search" className="sr-only">
            Search users by name or email
          </label>
          <input
            id="user-search"
            type="search"
            placeholder="Search by name or email address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input user-search-field"
          />
        </form>

        <select
          aria-label="Filter by role"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="form-select input-auto-width"
         
        >
          <option value="">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="HR">HR</option>
          <option value="EMPLOYEE">Employee</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="card table-card">
        <div className="data-table-container">
          <table className="data-table" aria-busy={loading}>
            <caption className="sr-only">Organization members</caption>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Designation</th>
                <th>Department</th>
                <th>Status</th>
                <th>Joined Date</th>
                {isAdmin && <th className="cell-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoading colSpan={isAdmin ? 7 : 6} label="Loading users" />
              ) : loadError ? (
                <TableEmpty
                  colSpan={isAdmin ? 7 : 6}
                  icon={WifiOff}
                  title="Couldn't load users"
                  hint="Check your connection and try again."
                  action={
                    <button type="button" className="btn-secondary" onClick={() => fetchUsers(pagination.page)}>
                      Try again
                    </button>
                  }
                />
              ) : users.length === 0 ? (
                <TableEmpty
                  colSpan={isAdmin ? 7 : 6}
                  icon={UserX}
                  title="No users found"
                  hint={searchTerm || roleFilter ? 'Try a different search or role filter.' : 'Add the first member with "Add New User".'}
                />
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <p className="cell-name-lg">{u.name}</p>
                      <p className="cell-sub-lg">{u.email}</p>
                    </td>
                    <td>
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="cell-text-dark">
                      {u.designation || 'Staff'}
                    </td>
                    <td className="cell-text-dark">
                      {u.department || 'General'}
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-present' : 'badge-absent'}`}>
                        <span className="badge-dot" />
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="cell-text-muted">
                      {formatDate(u.created_at)}
                    </td>
                    {isAdmin && (
                      <td className="cell-right">
                        <div className="actions-row">
                          <button
                            onClick={() => openEditModal(u)}
                            className="btn-secondary btn-compact"
                            title="Edit user"
                            aria-label={`Edit ${u.name}`}
                          >
                            <Edit2 size={14} aria-hidden="true" />
                          </button>
                          {u.id !== currentUser?.id && (
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={u.is_active ? 'btn-reject-action' : 'btn-approve-action'}
                            title={u.is_active ? 'Deactivate' : 'Activate'}
                            aria-label={`${u.is_active ? 'Deactivate' : 'Activate'} ${u.name}`}
                          >
                            {u.is_active ? (
                              <XCircle size={14} aria-hidden="true" />
                            ) : (
                              <CheckCircle size={14} aria-hidden="true" />
                            )}
                          </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination pagination={pagination} onPageChange={fetchUsers} noun="users" />
      </div>

      {/* User Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalMode === 'CREATE'
            ? isAdmin
              ? 'Add New Organization Member'
              : 'Add New Employee'
            : `Edit ${selectedUser?.name}`
        }
      >
        <form onSubmit={handleFormSubmit} className="stack-md">
          {feedback && (
            <div className="alert-banner alert-danger" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{feedback.text}</span>
            </div>
          )}

          <div>
            <label className="form-label" htmlFor="user-name">
              Full Name
            </label>
            <input
              id="user-name"
              type="text"
              required
              minLength={2}
              maxLength={100}
              autoComplete="off"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="E.g., Jane Smith"
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label" htmlFor="user-email">
              Work Email Address
            </label>
            <input
              id="user-email"
              type="email"
              required
              maxLength={150}
              autoComplete="off"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="jane.smith@company.com"
              className="form-input"
            />
          </div>

          <div className="form-grid-2">
            <div>
              <label className="form-label" htmlFor="user-role">
                Access Role
              </label>
              <select
                id="user-role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="form-select"
                disabled={!isAdmin && currentUser?.role === 'HR'}
              >
                <option value="EMPLOYEE">Employee</option>
                {isAdmin && <option value="HR">HR Manager</option>}
                {isAdmin && <option value="ADMIN">System Admin</option>}
              </select>
              {!isAdmin && currentUser?.role === 'HR' && (
                <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.3rem' }}>
                  HR can only create Employee accounts.
                </p>
              )}
            </div>

            <div>
              <label className="form-label" htmlFor="user-department">
                Department
              </label>
              <input
                id="user-department"
                type="text"
                maxLength={100}
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="Engineering / HR"
                className="form-input"
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div>
              <label className="form-label" htmlFor="user-designation">
                Designation
              </label>
              <input
                id="user-designation"
                type="text"
                maxLength={100}
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                placeholder="Senior Engineer"
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="user-password">
                {modalMode === 'CREATE' ? 'Initial Password' : 'New Password (Optional)'}
              </label>
              <div className="password-field">
                <input
                  id="user-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  aria-describedby="user-password-hint"
                  maxLength={72}
                  required={modalMode === 'CREATE'}
                  minLength={modalMode === 'CREATE' || formData.password ? 8 : undefined}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={modalMode === 'CREATE' ? '••••••••' : 'Leave empty to keep'}
                  className="form-input"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
              <p id="user-password-hint" className="rule-hint-text">At least 8 characters, with a letter and a number</p>
            </div>
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
              disabled={formSubmitting}
              className="btn-primary"
            >
              {formSubmitting ? (
                <Loader2 size={16} className="spinner" />
              ) : modalMode === 'CREATE' ? (
                'Create User'
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
