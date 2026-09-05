import React, { useState, useEffect } from 'react';
import { useStaff } from '../context/StaffContext';
import { useNotification } from '../context/NotificationContext';
import { CashReconciliation } from '../types';
import {
  Vault,
  CheckCircle,
  AlertCircle,
  Lock,
  Calendar,
  DollarSign,
  History,
} from 'lucide-react';

export const CashDrawerView: React.FC = () => {
  const { getHeaders } = useStaff();
  const { showToast } = useNotification();

  const [date, setDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [reconData, setReconData] = useState<any>(null);
  const [history, setHistory] = useState<CashReconciliation[]>([]);
  const [defaultFloat, setDefaultFloat] = useState<string>('50000.00');
  const [openingCash, setOpeningCash] = useState<string>('50000.00');
  const [physicalCount, setPhysicalCount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchDailyRecon = async (d: string) => {
    setIsLoading(true);
    try {
      const [reconRes, histRes, settingsRes] = await Promise.all([
        fetch(`/api/cash-drawer/daily?date=${d}`),
        fetch('/api/cash-drawer/history'),
        fetch('/api/settings'),
      ]);

      let configuredOpeningFloat = defaultFloat;
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        if (settingsData.default_opening_float) {
          configuredOpeningFloat = settingsData.default_opening_float;
          setDefaultFloat(settingsData.default_opening_float);
        }
      }

      if (reconRes.ok) {
        const data = await reconRes.json();
        setReconData(data);
        if (data.reconciliation) {
          setOpeningCash(String(data.reconciliation.opening_cash));
          setPhysicalCount(
            data.reconciliation.physically_counted_cash !== null &&
            data.reconciliation.physically_counted_cash !== undefined
              ? String(data.reconciliation.physically_counted_cash)
              : ''
          );
          setNotes(data.reconciliation.notes || '');
        } else {
          setOpeningCash(configuredOpeningFloat);
          // For days with no existing reconciliation, leave physicalCount blank
          setPhysicalCount('');
          setNotes('');
        }
      }
      if (histRes.ok) {
        setHistory(await histRes.json());
      }
    } catch (err) {
      console.error('Failed to load cash drawer data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyRecon(date);
  }, [date]);

  const opening = Number(openingCash) || 0;
  const cashIn = Number(reconData?.systemCashIncome) || 0;
  const cashOut = Number(reconData?.systemCashExpense) || 0;
  const systemExpected = opening + cashIn - cashOut;
  const isCountEntered = physicalCount.trim() !== '';
  const counted = isCountEntered ? Number(physicalCount) : 0;
  const discrepancy = counted - systemExpected;

  const handleSaveAndLock = async (lock: boolean) => {
    if (lock && !isCountEntered) {
      showToast('Please enter the physically counted cash before locking reconciliation', 'error');
      return;
    }
    try {
      const res = await fetch('/api/cash-drawer/reconcile', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          date,
          opening_cash: opening,
          physically_counted_cash: isCountEntered ? counted : 0,
          system_expected_cash: systemExpected,
          discrepancy: isCountEntered ? discrepancy : 0,
          is_locked: lock ? 1 : 0,
          notes,
        }),
      });
      if (res.ok) {
        showToast(lock ? 'Daily cash drawer reconciled and locked' : 'Cash reconciliation draft saved', 'success');
        fetchDailyRecon(date);
      }
    } catch (err) {
      showToast('Failed to save cash drawer reconciliation', 'error');
    }
  };

  const isLocked = reconData?.reconciliation?.is_locked === 1;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border">
        <div>
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Physical Float & Cash Balancing</div>
          <h3 className="text-lg font-serif font-bold text-foreground">Daily Cash Drawer Reconciliation</h3>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-muted-foreground">Select Reconcile Date:</span>
            <input
              type="date"
              className="input !h-8 !py-0 !text-xs !w-36"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
          {isLocked && (
            <span className="badge-pill bg-emerald-700 text-white text-xs flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Locked & Balanced</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Reconciliation Worksheet */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Calculation Worksheet */}
        <div className="lg:col-span-2 panel p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Balancing Worksheet for {date}</div>
            <div className="mono text-xs text-muted-foreground font-semibold">
              Cash Transactions Count: {reconData?.cashTransactions?.length || 0}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Step 1: Opening Float */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-2">
              <label className="block text-xs font-semibold text-muted-foreground">
                1. Starting Opening Cash Float (LKR)
              </label>
              <input
                type="number"
                step="1"
                disabled={isLocked}
                className="input font-mono font-bold text-lg"
                value={openingCash}
                onChange={e => setOpeningCash(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Morning drawer base reserve</p>
            </div>

            {/* Step 2: System Cash Inflow */}
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/30 space-y-2">
              <span className="block text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                2. System Cash Inflows (+)
              </span>
              <div className="mono font-bold text-lg text-emerald-600 dark:text-emerald-400">
                +LKR {cashIn.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-muted-foreground">Fee receipts recorded as 'Cash'</p>
            </div>

            {/* Step 3: System Cash Outflow */}
            <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/30 space-y-2">
              <span className="block text-xs font-semibold text-destructive">
                3. System Cash Outflows (-)
              </span>
              <div className="mono font-bold text-lg text-destructive">
                -LKR {cashOut.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-muted-foreground">Office expenses paid via Cash</p>
            </div>

            {/* Step 4: System Expected Cash */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/30 space-y-2">
              <span className="block text-xs font-semibold text-primary">
                4. Computed System Expected Cash
              </span>
              <div className="mono font-bold text-lg text-primary">
                =LKR {systemExpected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-muted-foreground">Opening + Inflow - Outflow</p>
            </div>
          </div>

          {/* Physical Count & Discrepancy Box */}
          <div className="p-5 rounded-xl bg-card border-2 border-border space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  5. Physical Cash Drawer Count (LKR) *
                </label>
                <input
                  type="number"
                  step="1"
                  placeholder="Enter counted amount..."
                  disabled={isLocked}
                  className="input font-mono font-bold text-xl"
                  value={physicalCount}
                  onChange={e => setPhysicalCount(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Total notes and coins physically counted in drawer at close of business.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 text-center">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">Reconciliation Discrepancy</span>
                {isCountEntered ? (
                  <>
                    <div className={`mono text-2xl font-bold mt-1 ${
                      discrepancy === 0 ? 'text-emerald-600 dark:text-emerald-400' : discrepancy > 0 ? 'text-primary' : 'text-destructive'
                    }`}>
                      {discrepancy >= 0 ? '+' : ''}LKR {discrepancy.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[11px] font-medium block mt-0.5">
                      {discrepancy === 0 ? '✓ Perfectly Balanced' : discrepancy > 0 ? 'Surplus Float' : 'Shortage in Drawer'}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="mono text-2xl font-bold mt-1 text-muted-foreground">
                      —
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground block mt-0.5">
                      Awaiting Physical Count
                    </span>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Reconciliation Notes / Explanation</label>
              <textarea
                disabled={isLocked}
                className="textarea !h-16"
                placeholder="Reason for discrepancy, petty cash replenishment notes..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {!isLocked && (
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleSaveAndLock(false)}
                  className="btn btn-soft text-xs"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveAndLock(true)}
                  className="btn btn-primary text-xs flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Lock & Reconcile Day</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Historical Reconciliations */}
        <div className="panel p-5 space-y-3">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Audit Trail</div>
          <h4 className="font-serif font-bold text-sm text-foreground">Past Daily Balancing Logs</h4>

          <div className="space-y-2 overflow-y-auto max-h-[500px] pr-1">
            {history.map(h => (
              <div
                key={h.id}
                onClick={() => setDate(h.date)}
                className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                  h.date === date ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center justify-between font-semibold text-foreground mb-1">
                  <span className="mono">{h.date}</span>
                  <span className={`mono text-[11px] font-bold ${
                    h.discrepancy === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                  }`}>
                    {h.discrepancy === 0 ? 'LKR 0.00 balanced' : `${h.discrepancy > 0 ? '+' : ''}LKR ${Number(h.discrepancy).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Count: LKR {Number(h.physically_counted_cash).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <span>By: {h.reconciled_by_staff_name}</span>
                </div>
              </div>
            ))}
            {history.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">No past reconciliation logs.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
