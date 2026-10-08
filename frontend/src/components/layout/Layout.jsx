import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export const Layout = () => {
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the mobile drawer after navigating
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Escape closes the drawer
  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setNavOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen]);

  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Navbar navOpen={navOpen} onToggleNav={() => setNavOpen((open) => !open)} />
      <div className="main-content-wrapper">
        <Sidebar isOpen={navOpen} />
        {navOpen && <div className="sidebar-overlay" onClick={() => setNavOpen(false)} aria-hidden="true" />}
        <main id="main-content" className="page-container" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
