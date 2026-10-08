import React from 'react';
import { ATTENDANCE_STATUS, CORRECTION_STATUS } from '../../utils/constants';

export const StatusBadge = ({ status }) => {
  const config = ATTENDANCE_STATUS[status] || {
    label: status || 'Unknown',
    className: 'badge-present',
  };

  return (
    <span className={`badge ${config.className}`}>
      <span className="badge-dot" />
      {config.label}
    </span>
  );
};

export const CorrectionBadge = ({ status }) => {
  const config = CORRECTION_STATUS[status] || {
    label: status || 'Pending',
    className: 'badge-pending',
  };

  return (
    <span className={`badge ${config.className}`}>
      {config.label}
    </span>
  );
};

export const RoleBadge = ({ role }) => {
  const roleClassMap = {
    ADMIN: 'role-admin',
    HR: 'role-hr',
    EMPLOYEE: 'role-employee',
  };

  return (
    <span className={`role-badge ${roleClassMap[role] || 'role-employee'}`}>
      {role}
    </span>
  );
};
