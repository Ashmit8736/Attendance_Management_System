import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { RoleBadge } from '../common/Badge';
import { LogOut, User as UserIcon, Clock, Menu, X } from 'lucide-react';

export const Navbar = ({ navOpen = false, onToggleNav }) => {
  const { user, logout } = useAuth();
  const toast = useToast();

  const handleLogout = () => {
    logout();
    toast.info('You have been signed out.');
  };

  return (
    <header className="navbar">
      <button
        type="button"
        className="nav-toggle"
        onClick={onToggleNav}
        aria-label={navOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={navOpen}
        aria-controls="app-sidebar"
      >
        {navOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button>

      <div className="navbar-brand">
        <div className="brand-icon-wrapper">
          <Clock size={20} />
        </div>
        <div className="brand-text">
          <h1>AttendTrack</h1>
          <p>Enterprise Attendance System</p>
        </div>
      </div>

      <div className="navbar-actions">
        {user && (
          <div className="user-profile-badge">
            <div className="user-avatar">
              <UserIcon size={18} />
            </div>
            <div className="user-details">
              <div className="user-name-role">
                <span className="user-name">{user.name}</span>
                <RoleBadge role={user.role} />
              </div>
              <p className="user-email">{user.email}</p>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          aria-label="Log out"
          className="btn-logout"
        >
          <LogOut size={16} aria-hidden="true" />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
};
