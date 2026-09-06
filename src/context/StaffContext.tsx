import React, { createContext, useContext, useState, useEffect } from 'react';
import { Staff } from '../types';

interface StaffContextType {
  staffList: Staff[];
  activeStaff: Staff | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setActiveStaff: (staff: Staff) => void;
  authenticateStaff: (staff: Staff, pin: string) => Promise<{ success: boolean; error?: string }>;
  lockSession: () => void;
  refreshStaff: () => Promise<void>;
  isSwitchModalOpen: boolean;
  openSwitchModal: () => void;
  closeSwitchModal: () => void;
  getHeaders: () => Record<string, string>;
  // RBAC & Permission helpers
  hasRole: (roles: string[]) => boolean;
  canManageFinance: boolean;
  canManageAdmissions: boolean;
  canManageSystem: boolean;
}

const StaffContext = createContext<StaffContextType | undefined>(undefined);

export const StaffProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [activeStaff, setActiveStaffState] = useState<Staff | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(10);

  const fetchStaff = async () => {
    try {
      const [staffRes, settingsRes] = await Promise.all([
        fetch('/api/staff?active_only=true'),
        fetch('/api/settings')
      ]);
      
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        if (settings.session_timeout_minutes) {
          const parsed = parseInt(settings.session_timeout_minutes, 10);
          if (!isNaN(parsed) && parsed > 0) {
            setSessionTimeoutMinutes(parsed);
          }
        }
      }

      if (staffRes.ok) {
        const data: Staff[] = await staffRes.json();
        setStaffList(data);

        // Check if there is an active authenticated session in sessionStorage
        const savedAuthId = sessionStorage.getItem('elite_school_authenticated_staff_id');
        if (savedAuthId) {
          const found = data.find(s => s.id === savedAuthId);
          if (found) {
            setActiveStaffState(found);
            setIsAuthenticated(true);
          } else {
            sessionStorage.removeItem('elite_school_authenticated_staff_id');
            setIsAuthenticated(false);
            if (data.length > 0) {
              setActiveStaffState(data[0]);
            }
          }
        } else if (data.length > 0 && (!activeStaff || !data.some(s => s.id === activeStaff.id))) {
          // Default to first active staff profile
          setActiveStaffState(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load staff list or settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  // Inactivity Auto-Lock Timer based on configurable settings
  useEffect(() => {
    if (!isAuthenticated) return;

    let timeoutId: NodeJS.Timeout;
    const timeoutDuration = Math.max(1, sessionTimeoutMinutes) * 60 * 1000;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        lockSession();
      }, timeoutDuration);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [isAuthenticated, sessionTimeoutMinutes]);

  const setActiveStaff = (staff: Staff) => {
    setActiveStaffState(staff);
  };

  const authenticateStaff = async (staff: Staff, pin: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/staff/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staff.id, pin: pin || '' }),
      });
      const data = await res.json();

      if (data.valid) {
        setActiveStaffState(staff);
        setIsAuthenticated(true);
        sessionStorage.setItem('elite_school_authenticated_staff_id', staff.id);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Incorrect PIN code.' };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Error verifying PIN' };
    }
  };

  const lockSession = () => {
    sessionStorage.removeItem('elite_school_authenticated_staff_id');
    setIsAuthenticated(false);
    setIsSwitchModalOpen(true);
  };

  const getHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'x-staff-name': activeStaff ? activeStaff.name : 'Office Staff',
    };
  };

  // RBAC permissions based on active staff role
  const currentRole = (activeStaff?.role || 'Office Staff').toLowerCase();
  
  const hasRole = (roles: string[]): boolean => {
    if (!activeStaff) return false;
    const r = activeStaff.role.toLowerCase();
    return roles.some(req => r.includes(req.toLowerCase()));
  };

  const canManageFinance = hasRole(['Bursar', 'Finance', 'Head of Office', 'Operations', 'Admin']);
  const canManageAdmissions = hasRole(['Registrar', 'Admissions', 'Head of Office', 'Operations', 'Admin', 'Office Staff']);
  const canManageSystem = hasRole(['Head of Office', 'Operations', 'Admin', 'Bursar']);

  return (
    <StaffContext.Provider
      value={{
        staffList,
        activeStaff,
        isAuthenticated,
        isLoading,
        setActiveStaff,
        authenticateStaff,
        lockSession,
        refreshStaff: fetchStaff,
        isSwitchModalOpen,
        openSwitchModal: () => setIsSwitchModalOpen(true),
        closeSwitchModal: () => setIsSwitchModalOpen(false),
        getHeaders,
        hasRole,
        canManageFinance,
        canManageAdmissions,
        canManageSystem,
      }}
    >
      {children}
    </StaffContext.Provider>
  );
};

export const useStaff = () => {
  const context = useContext(StaffContext);
  if (!context) throw new Error('useStaff must be used within a StaffProvider');
  return context;
};
