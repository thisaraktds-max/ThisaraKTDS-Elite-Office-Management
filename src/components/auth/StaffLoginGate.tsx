import React, { useState } from 'react';
import { useStaff } from '../../context/StaffContext';
import { useNotification } from '../../context/NotificationContext';
import { Staff } from '../../types';
import { Shield, KeyRound, ArrowRight, UserCheck, CheckCircle2, Lock, Sparkles } from 'lucide-react';

export const StaffLoginGate: React.FC = () => {
  const { staffList, authenticateStaff } = useStaff();
  const { showToast } = useNotification();
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleSelectStaff = (staff: Staff) => {
    setSelectedStaff(staff);
    setPin('');
    setError('');
  };

  const handleQuickPin = () => {
    setPin('9999');
    setError('');
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    if (!pin) {
      setError('Please enter your 4-digit PIN (default: 9999)');
      return;
    }

    setIsAuthenticating(true);
    setError('');

    const res = await authenticateStaff(selectedStaff, pin);
    setIsAuthenticating(false);

    if (res.success) {
      showToast(`Welcome back, ${selectedStaff.name}. Terminal unlocked.`, 'success');
    } else {
      setError(res.error || 'Authentication failed. Please try 9999.');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4 py-8 relative overflow-hidden transition-colors duration-300">
      {/* Subtle Background Accent Rings */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full border border-primary/10 bg-primary/5 pointer-events-none blur-2xl" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full border border-primary/10 bg-primary/5 pointer-events-none blur-2xl" />

      <div className="w-full max-w-lg relative z-10">
        {/* Terminal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary shadow-sm mb-3.5">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Elite International School
          </h1>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-1">
            Admissions & Bursary Terminal
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-card border border-border/80 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/30 p-6 sm:p-7 backdrop-blur-sm">
          {!selectedStaff ? (
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
                <div>
                  <div className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase font-semibold">
                    SECURITY VERIFICATION
                  </div>
                  <h2 className="text-base font-bold text-foreground">
                    Select Your Staff Profile
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground px-2 py-0.5 bg-muted rounded-md">
                  Default PIN: 9999
                </span>
              </div>

              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                Please select your staff identity to stamp and verify receipts, admissions records, and bursary logs.
              </p>

              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {staffList.map((staff) => (
                  <div
                    key={staff.id}
                    onClick={() => handleSelectStaff(staff)}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-background/50 hover:bg-muted/60 hover:border-primary/40 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-sm group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        {staff.avatar_initials || staff.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                          {staff.name}
                        </div>
                        <div className="text-xs text-muted-foreground">{staff.role}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                      <KeyRound className="w-4 h-4 opacity-60" />
                      <ArrowRight className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handleUnlock} className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-xs">
                    {selectedStaff.avatar_initials || selectedStaff.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-foreground">{selectedStaff.name}</div>
                    <div className="text-xs text-muted-foreground">{selectedStaff.role}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => { setSelectedStaff(null); setPin(''); setError(''); }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Change User
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                    Enter 4-Digit Security PIN
                  </label>
                  <button
                    type="button"
                    onClick={handleQuickPin}
                    className="text-[11px] font-mono text-primary hover:text-primary/80 font-medium flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Fill Default (9999)</span>
                  </button>
                </div>

                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoFocus
                  required
                  className="input !h-12 text-center text-2xl tracking-[0.4em] font-mono font-bold bg-background text-foreground"
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => { setPin(e.target.value); setError(''); }}
                />

                {error && (
                  <p className="text-xs text-destructive mt-2 font-medium flex items-center gap-1">
                    <span>{error}</span>
                  </p>
                )}
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => { setSelectedStaff(null); setPin(''); setError(''); }}
                  className="btn btn-soft flex-1 py-2.5 text-xs font-semibold"
                >
                  Back to Staff List
                </button>
                <button
                  type="submit"
                  disabled={isAuthenticating || !pin}
                  className="btn btn-primary flex-1 py-2.5 text-xs font-semibold shadow-xs flex items-center justify-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isAuthenticating ? 'Verifying...' : 'Unlock Terminal'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Note */}
        <p className="text-center text-[11px] text-muted-foreground mt-4 font-mono">
          Single Office Multi-Role Terminal · Default PIN is 9999 for all staff accounts
        </p>
      </div>
    </div>
  );
};
