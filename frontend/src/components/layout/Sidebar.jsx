import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  CalendarCheck,
  FileEdit,
  Users,
  Sliders,
  ShieldCheck,
} from 'lucide-react';

export const Sidebar = ({ isOpen = false }) => {
  const { isHR, isAdmin } = useAuth();

  const navItems = [
    {
      label: 'Main Menu',
      items: [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'Attendance History', path: '/attendance', icon: CalendarCheck },
        { name: 'Correction Requests', path: '/corrections', icon: FileEdit },
      ],
    },
    ...(isHR
      ? [
          {
            label: 'Management',
            items: [
              { name: 'User Directory', path: '/admin/users', icon: Users },
            ],
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            label: 'Administration',
            items: [
              { name: 'Attendance Rules', path: '/admin/rules', icon: Sliders },
              { name: 'System Audit Logs', path: '/admin/audit-logs', icon: ShieldCheck },
            ],
          },
        ]
      : []),
  ];

  return (
    <aside id="app-sidebar" className={`sidebar${isOpen ? ' sidebar-open' : ''}`} aria-label="Main navigation">
      <nav className="sidebar-sections">
        {navItems.map((section, idx) => (
          <div key={idx} role="group" aria-label={section.label}>
            <p className="sidebar-group-title" aria-hidden="true">{section.label}</p>
            <div className="sidebar-nav-list">
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `sidebar-nav-link ${isActive ? 'active' : ''}`
                  }
                >
                  <item.icon size={18} aria-hidden="true" />
                  <span>{item.name}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p className="sidebar-footer-title">AttendTrack Portal</p>
        <p className="sidebar-footer-sub">v1.0.0 • Role-Based Access</p>
      </div>
    </aside>
  );
};
