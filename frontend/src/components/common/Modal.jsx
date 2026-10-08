import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: role="dialog", labelled by its title, traps Tab inside,
 * closes on Escape / backdrop click, and returns focus to the trigger on close.
 * Mark an element with `data-autofocus` to choose what receives initial focus.
 */
export const Modal = ({ isOpen, onClose, title, children, wide = false }) => {
  const titleId = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const dialog = dialogRef.current;
    const focusables = () => Array.from(dialog.querySelectorAll(FOCUSABLE));

    // Initial focus: [data-autofocus] > first form field > first control > dialog itself
    const initial =
      dialog.querySelector('[data-autofocus]') ||
      dialog.querySelector('.modal-body input:not([type="hidden"]), .modal-body select, .modal-body textarea') ||
      focusables().find((el) => !el.classList.contains('modal-close-btn')) ||
      dialog;
    initial.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-root">
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />

      {/* Dialog */}
      <div
        className="modal-wrapper"
        onMouseDown={(e) => {
          // Only a click that starts on the empty area closes the dialog (not a text-selection drag)
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={`modal-dialog${wide ? ' modal-dialog-wide' : ''}`}
        >
          {/* Header */}
          <div className="modal-header">
            <h3 id={titleId} className="modal-title">
              {title}
            </h3>
            <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Close dialog">
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          {/* Body */}
          <div className="modal-body">{children}</div>
        </div>
      </div>
    </div>
  );
};
