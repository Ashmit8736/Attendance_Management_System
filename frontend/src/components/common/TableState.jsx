import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Full-width table row shown while data loads.
 */
export const TableLoading = ({ colSpan, label = 'Loading...' }) => (
  <tr>
    <td colSpan={colSpan} className="cell-loading">
      <div className="empty-state">
        <Loader2 size={24} className="spinner" aria-hidden="true" />
        <span className="sr-only" role="status">
          {label}
        </span>
      </div>
    </td>
  </tr>
);

/**
 * Full-width table row for "nothing here" / "request failed" with an icon and an optional hint.
 */
export const TableEmpty = ({ colSpan, icon: Icon, title, hint, action }) => (
  <tr>
    <td colSpan={colSpan} className="cell-empty">
      <div className="empty-state">
        {Icon && <Icon size={28} className="empty-state-icon" aria-hidden="true" />}
        <p className="empty-state-title">{title}</p>
        {hint && <p className="empty-state-hint">{hint}</p>}
        {action}
      </div>
    </td>
  </tr>
);
