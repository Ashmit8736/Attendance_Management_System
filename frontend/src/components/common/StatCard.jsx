import React from 'react';

export const StatCard = ({ title, value, icon: Icon, color = 'blue', subtitle }) => {
  const themeClassMap = {
    blue: 'stat-theme-blue',
    emerald: 'stat-theme-emerald',
    amber: 'stat-theme-amber',
    purple: 'stat-theme-purple',
  };

  const themeClass = themeClassMap[color] || 'stat-theme-blue';

  return (
    <div className="stat-card">
      <div className="stat-card-inner">
        <div>
          <p className="stat-card-title">{title}</p>
          <h4 className="stat-card-value">{value}</h4>
          {subtitle && <p className="stat-card-subtitle">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`stat-card-icon ${themeClass}`}>
            <Icon size={22} />
          </div>
        )}
      </div>
    </div>
  );
};
