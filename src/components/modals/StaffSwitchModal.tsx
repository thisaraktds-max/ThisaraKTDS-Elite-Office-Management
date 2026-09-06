import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { useStaff } from '../../context/StaffContext';
import { useNotification } from '../../context/NotificationContext';
import { Staff } from '../../types';
import {
  UserCheck,
  KeyRound,
  X,
  ShieldCheck,
  Sparkles,
  Lock,
  Edit3,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';

export const StaffSwitchModal: React.FC = () => {
  const {
    staffList,
    activeStaff,
    authenticateStaff,
    lockSession,
    isSwitchModalOpen,
    closeSwitchModal,
    refreshStaff,
    getHeaders,
  } = useStaff();
  const { showToast } = useNotification();

  useLockBodyScroll(isSwitchModalOpen);

  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Change PIN mode state
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinChangeLoading, setPinChangeLoading] = useState(false);

  if (!isSwitchModalOpen) return null;

  const handleSelectStaff = (staff: Staff) => {
    setSelectedStaff(staff);
    setPin('');
    setPinError('');
    setIsChangingPin(false);
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setIsVerifying(true);
    setPinError('');

    try {
      const res = await authenticateStaff(selectedStaff, selectedStaff.has_pin ? pin : '');
      if (res.success) {
        showToast(`Switched active profile to ${selectedStaff.name} (${selectedStaff.role})`, 'success');
        closeSwitchModal();
        setSelectedStaff(null);
        setPin('');
      } else {
        setPinError(res.error || 'Incorrect PIN code.');
      }
    } catch (err: any) {
      setPinError('Error verifying PIN code');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleChangePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    if (newPin.length < 4) {
      setPinError('New PIN must be at least 4 digits');
      return;
    }
    if (newPin !== confirmNewPin) {
      setPinError('New PIN and confirmation do not match');
      return;
    }

    setPinChangeLoading(true);
    setPinError('');

    try {
      const res = await fetch(`/api/staff/${selectedStaff.id}/pin`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          current_pin: currentPin,
          new_pin: newPin,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`PIN for ${selectedStaff.name} updated successfully`, 'success');
        setIsChangingPin(false);
        setCurrentPin('');
        setNewPin('');
        setConfirmNewPin('');
        setPin(newPin);
        refreshStaff();
      } else {
        setPinError(data.error || 'Failed to update PIN code');
      }
    } catch (err: any) {
      setPinError('Network error while updating PIN');
    } finally {
      setPinChangeLoading(false);
    }
  };

  return createPortal(
    <div className="modal-backdrop" onClick={closeSwitchModal}>
      <div
        className="modal !max-w-md text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <div>
            <div className="text-[10.5px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
              Shared Office Terminal
            </div>
            <h3 className="text-base font-serif font-bold text-foreground">
              {isChangingPin
                ? 'Update Staff Security PIN'
                : selectedStaff
                ? 'Staff Authentication'
                : 'Switch Active Staff Profile'}
            </h3>
          </div>
          <button
            onClick={closeSwitchModal}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground text-sm font-bold transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View 1: Select Staff Profile List */}
        {!selectedStaff && (
          <div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Select your staff identity. All audit stamps, receipts, approvals, and logs will be attributed to your session.
            </p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {staffList
                .filter((s) => (s.is_active ?? s.active ?? 1) === 1)
                .map((staff) => {
                const isActive = activeStaff?.id === staff.id;
                return (
                  <div
                    key={staff.id}
                    onClick={() => handleSelectStaff(staff)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      isActive
                        ? 'border-primary bg-primary/5 shadow-2xs'
                        : 'border-border bg-card hover:bg-muted/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs overflow-hidden flex-shrink-0 ${
                          isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                        }`}
                      >
                        {staff.photo_url ? (
                          <img src={staff.photo_url} alt={staff.name} className="w-full h-full object-cover" />
                        ) : (
                          staff.avatar_initials || staff.name.substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-foreground flex items-center gap-2">
                          {staff.name}
                          {isActive && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-primary/15 text-primary font-mono font-medium">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{staff.role}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!staff.has_pin ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-mono font-medium">
                          No PIN
                        </span>
                      ) : (
                        <KeyRound className="w-3.5 h-3.5 text-muted-foreground opacity-60" />
                      )}
                      <UserCheck className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground/40'}`} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  closeSwitchModal();
                  lockSession();
                }}
                className="btn btn-soft text-xs text-destructive hover:bg-destructive/10 flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock Terminal Session</span>
              </button>
              <button onClick={closeSwitchModal} className="btn btn-ghost text-xs cursor-pointer">
                Close
              </button>
            </div>
          </div>
        )}

        {/* View 2: Enter PIN to Authenticate */}
        {selectedStaff && !isChangingPin && (
          <form onSubmit={handleVerifyPin} className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm overflow-hidden flex-shrink-0">
                  {selectedStaff.photo_url ? (
                    <img src={selectedStaff.photo_url} alt={selectedStaff.name} className="w-full h-full object-cover" />
                  ) : (
                    selectedStaff.avatar_initials || selectedStaff.name.substring(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="font-bold text-sm text-foreground">{selectedStaff.name}</div>
                  <div className="text-xs text-muted-foreground">{selectedStaff.role}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedStaff(null);
                  setPinError('');
                }}
                className="text-[11px] text-primary hover:underline font-medium"
              >
                Change
              </button>
            </div>

            {selectedStaff.has_pin ? (
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                  Enter 4-Digit Staff PIN
                </label>

                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  required
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setPinError('');
                  }}
                  placeholder="••••"
                  className="input text-center text-xl tracking-[0.3em] font-mono font-bold w-full"
                />

                {pinError && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-destructive">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{pinError}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center space-y-1">
                <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">No Security PIN Required</div>
                <div className="text-[11px] text-muted-foreground">
                  This staff profile does not require a PIN code to switch.
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsChangingPin(true);
                  setPinError('');
                }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Change PIN</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStaff(null)}
                  className="btn btn-soft text-xs"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isVerifying}
                  className="btn btn-primary text-xs flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{isVerifying ? 'Verifying...' : 'Unlock Profile'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* View 3: Change PIN Form */}
        {selectedStaff && isChangingPin && (
          <form onSubmit={handleChangePinSubmit} className="space-y-3.5 text-xs">
            <div className="p-3 bg-muted/20 rounded-xl border border-border flex items-center gap-2.5 text-muted-foreground">
              <ShieldAlert className="w-4 h-4 text-primary flex-shrink-0" />
              <span>
                Setting new secure PIN for <strong className="text-foreground">{selectedStaff.name}</strong>.
              </span>
            </div>

            <div>
              <label className="block text-muted-foreground font-medium mb-1">Current PIN</label>
              <input
                type="password"
                inputMode="numeric"
                required={selectedStaff.has_pin}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                placeholder={selectedStaff.has_pin ? "Enter current PIN" : "None required (profile has no PIN)"}
                className="input w-full font-mono text-center tracking-widest text-sm"
              />
            </div>

            <div>
              <label className="block text-muted-foreground font-medium mb-1">New 4-Digit PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                required
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="••••"
                className="input w-full font-mono text-center tracking-widest text-sm"
              />
            </div>

            <div>
              <label className="block text-muted-foreground font-medium mb-1">Confirm New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                required
                value={confirmNewPin}
                onChange={(e) => setConfirmNewPin(e.target.value)}
                placeholder="••••"
                className="input w-full font-mono text-center tracking-widest text-sm"
              />
            </div>

            {pinError && (
              <div className="flex items-center gap-1.5 text-destructive text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setIsChangingPin(false);
                  setPinError('');
                }}
                className="btn btn-soft text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pinChangeLoading}
                className="btn btn-primary text-xs"
              >
                {pinChangeLoading ? 'Saving...' : 'Update PIN'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
};
