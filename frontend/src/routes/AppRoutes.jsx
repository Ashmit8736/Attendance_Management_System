import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { Layout } from '../components/layout/Layout';

import { LoginPage } from '../pages/auth/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { AttendanceHistoryPage } from '../pages/AttendanceHistoryPage';
import { CorrectionsPage } from '../pages/CorrectionsPage';
import { UsersManagementPage } from '../pages/admin/UsersManagementPage';
import { RulesSettingsPage } from '../pages/admin/RulesSettingsPage';
import { AuditLogsPage } from '../pages/admin/AuditLogsPage';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Routes inside Layout */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          {/* General Access (Employee, HR, Admin) */}
          <Route path="/" element={<DashboardPage />} />
          <Route path="/attendance" element={<AttendanceHistoryPage />} />
          <Route path="/corrections" element={<CorrectionsPage />} />

          {/* HR & Admin Access */}
          <Route element={<ProtectedRoute allowedRoles={['HR', 'ADMIN']} />}>
            <Route path="/admin/users" element={<UsersManagementPage />} />
          </Route>

          {/* Admin Only Access */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route path="/admin/rules" element={<RulesSettingsPage />} />
            <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
          </Route>
        </Route>
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
