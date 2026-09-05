import React from 'react';
import { createPortal } from 'react-dom';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { AlertTriangle, Trash2, X, AlertCircle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isConfirming?: boolean;
  warningDetails?: string[];
}

export const ConfirmDialogModal: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm & Delete',
  cancelText = 'Cancel',
  variant = 'danger',
  isConfirming = false,
  warningDetails,
}) => {
  useLockBodyScroll(isOpen);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal !max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between pb-3 mb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                variant === 'danger'
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}
            >
              {variant === 'danger' ? (
                <Trash2 className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                Confirmation Required
              </div>
              <h3 className="font-serif font-bold text-base text-foreground leading-snug">
                {title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-foreground/80 leading-relaxed mb-4">{message}</p>

        {warningDetails && warningDetails.length > 0 && (
          <div className="p-3 mb-4 rounded-xl bg-destructive/5 border border-destructive/20 text-xs space-y-1.5">
            <div className="font-semibold text-destructive flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Consequences of this action:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-muted-foreground pl-1">
              {warningDetails.map((detail, idx) => (
                <li key={idx}>{detail}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="btn btn-ghost text-xs py-2 px-3.5 rounded-lg"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className={`btn text-xs py-2 px-4 rounded-lg flex items-center gap-1.5 shadow-xs ${
              variant === 'danger'
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'btn-primary'
            }`}
          >
            {isConfirming ? (
              <span>Processing...</span>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
