import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal } from '../components/common/Modal';

const ConfirmContext = createContext(null);

/**
 * Promise-based replacement for window.confirm:
 *   const confirm = useConfirm();
 *   if (await confirm({ title, message, confirmText, tone: 'danger' })) { ... }
 */
export const ConfirmProvider = ({ children }) => {
  const [options, setOptions] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setOptions(opts);
      }),
    []
  );

  const settle = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  };

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal isOpen={!!options} onClose={() => settle(false)} title={options?.title || 'Please confirm'}>
        <p className="confirm-message">{options?.message}</p>
        <div className="modal-footer">
          {/* Cancel is the default focus so Enter cannot trigger a destructive action by accident */}
          <button type="button" className="btn-secondary" data-autofocus onClick={() => settle(false)}>
            {options?.cancelText || 'Cancel'}
          </button>
          <button
            type="button"
            className={options?.tone === 'danger' ? 'btn-danger' : 'btn-primary'}
            onClick={() => settle(true)}
          >
            {options?.confirmText || 'Confirm'}
          </button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
};
