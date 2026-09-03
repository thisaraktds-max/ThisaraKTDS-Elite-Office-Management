import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { soundManager } from '../components/common/AudioFeedback';
import { RotateCcw, X, CheckCircle, AlertTriangle, Info, Bell } from 'lucide-react';

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  title?: string;
  onUndo?: () => void;
  undoLabel?: string;
  duration?: number;
}

export interface StoredNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
  timestamp: string;
  read: boolean;
}

interface NotificationContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info', title?: string) => void;
  showUndoToast: (message: string, onUndo: () => void, undoLabel?: string, duration?: number) => void;
  notificationsList: StoredNotification[];
  unreadCount: number;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [notificationsList, setNotificationsList] = useState<StoredNotification[]>(() => {
    try {
      const saved = localStorage.getItem('elite_stored_notifications');
      return saved ? JSON.parse(saved) : [
        {
          id: 'init_1',
          title: 'Admissions Cycle Active',
          message: 'Academic Year 2026-2027 admissions open. Standard capacity at 480.',
          type: 'info',
          timestamp: new Date(Date.now() - 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          read: false,
        },
        {
          id: 'init_2',
          title: 'Daily Cash Counter Balancing',
          message: 'Remember to reconcile counter physical cash before desk handover.',
          type: 'info',
          timestamp: new Date(Date.now() - 7200000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          read: true,
        },
      ];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('elite_stored_notifications', JSON.stringify(notificationsList));
  }, [notificationsList]);

  const addStoredNotification = (title: string, message: string, type: 'success' | 'error' | 'info') => {
    const item: StoredNotification = {
      id: `notif_${Date.now()}_${Math.random()}`,
      title,
      message,
      type,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };
    setNotificationsList((prev) => [item, ...prev.slice(0, 19)]);
  };

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success', title?: string) => {
      const id = `toast_${Date.now()}_${Math.random()}`;
      setToasts((prev) => [...prev, { id, type, message, title }]);

      if (type === 'success') {
        soundManager.playSuccessChime();
      }

      addStoredNotification(title || (type === 'success' ? 'Success' : type === 'error' ? 'Notice' : 'Information'), message, type);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const showUndoToast = useCallback(
    (message: string, onUndo: () => void, undoLabel = 'Undo', duration = 6000) => {
      const id = `toast_undo_${Date.now()}_${Math.random()}`;
      setToasts((prev) => [...prev, { id, type: 'info', message, onUndo, undoLabel, duration }]);

      addStoredNotification('Action Executed', message, 'info');

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    []
  );

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const markAllAsRead = () => {
    setNotificationsList((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotificationsList([]);
  };

  const unreadCount = notificationsList.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        showToast,
        showUndoToast,
        notificationsList,
        unreadCount,
        markAllAsRead,
        clearNotifications,
      }}
    >
      {children}

      {/* Floating Interactive Toast Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl shadow-xl border bg-card/95 backdrop-blur-md transition-all animate-rise ${
              toast.type === 'success'
                ? 'border-emerald-500/30 border-l-4 border-l-emerald-600'
                : toast.type === 'error'
                ? 'border-destructive/30 border-l-4 border-l-destructive'
                : 'border-primary/30 border-l-4 border-l-primary'
            }`}
          >
            <div className="mt-0.5 flex-shrink-0">
              {toast.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : toast.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-destructive" />
              ) : (
                <Info className="w-4 h-4 text-primary" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              {toast.title && (
                <div className="font-semibold text-xs text-foreground mb-0.5">{toast.title}</div>
              )}
              <div className="text-xs text-foreground/85 leading-relaxed">{toast.message}</div>
            </div>

            {toast.onUndo ? (
              <button
                onClick={() => {
                  toast.onUndo?.();
                  removeToast(toast.id);
                }}
                className="flex-shrink-0 flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{toast.undoLabel || 'Undo'}</span>
              </button>
            ) : (
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within a NotificationProvider');
  return context;
};
