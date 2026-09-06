import React, { useState, useEffect } from 'react';
import { useStaff } from '../context/StaffContext';
import { useNotification } from '../context/NotificationContext';
import { Expense } from '../types';
import {
  TrendingUp,
  CreditCard,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  Trash2,
} from 'lucide-react';
import { CardSkeleton, TableSkeleton } from '../components/common/SkeletonLoader';
import { EmptyState } from '../components/common/EmptyState';
import { formatCurrency } from '../utils/format';

export const CashFlowView: React.FC<{ onOpenNewExpense: () => void }> = ({ onOpenNewExpense }) => {
  const { getHeaders } = useStaff();
  const { showToast } = useNotification();

  const [flowData, setFlowData] = useState<any>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchCashFlow = async () => {
    setIsLoading(true);
    try {
      const [flowRes, expRes] = await Promise.all([
        fetch('/api/cashflow/weekly'),
        fetch('/api/expenses'),
      ]);
      if (flowRes.ok) setFlowData(await flowRes.json());
      if (expRes.ok) setExpenses(await expRes.json());
    } catch (err) {
      console.error('Failed to load cash flow:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCashFlow();
  }, []);

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast('Expense record deleted', 'success');
        fetchCashFlow();
      }
    } catch (err) {
      showToast('Failed to delete expense', 'error');
    }
  };

  const filteredExpenses = expenses.filter(exp => {
    if (categoryFilter !== 'all' && exp.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        exp.paid_to.toLowerCase().includes(q) ||
        (exp.reference_no && exp.reference_no.toLowerCase().includes(q)) ||
        exp.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalExpenseSum = filteredExpenses.reduce((acc, e) => acc + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      {/* 8-Week Cash Projection Summary */}
      {isLoading ? (
        <div className="space-y-6">
          <CardSkeleton count={3} />
          <div className="panel p-5 space-y-4">
            <TableSkeleton rows={4} columns={6} />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card-elevated p-5">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">8-Week Income Inflow</div>
              <div className="mono text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                +LKR {formatCurrency(flowData?.totalIncome || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Tuition fees & bursary credits</p>
            </div>

            <div className="card-elevated p-5">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">8-Week Disbursements</div>
              <div className="mono text-2xl font-bold text-destructive mt-1">
                -LKR {formatCurrency(flowData?.totalExpense || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Payroll, facilities, supplies</p>
            </div>

            <div className="card-elevated p-5">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">8-Week Net Surplus / (Deficit)</div>
              <div className={`mono text-2xl font-bold mt-1 ${
                (flowData?.netSurplus || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
              }`}>
                LKR {formatCurrency(flowData?.netSurplus || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Rolling operational cash position</p>
            </div>
          </div>

          {/* 8-Week Visual Weekly Cash Bars */}
          <div className="panel p-5 space-y-3">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">8-Week Rolling Cash Timeline</div>
            <h4 className="font-serif font-bold text-sm text-foreground">Weekly Inflows vs Disbursements</h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 pt-2">
              {flowData?.weeklyData?.map((w: any) => {
                const isPositive = w.net >= 0;
                return (
                  <div key={w.week} className="p-2.5 rounded-lg bg-card border border-border text-center space-y-1">
                    <div className="mono text-[10px] text-muted-foreground font-semibold uppercase">{w.week}</div>
                    <div className="mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">+{formatCurrency(w.income)}</div>
                    <div className="mono text-[11px] font-bold text-destructive">-{formatCurrency(w.expense)}</div>
                    <div className={`mono text-[10px] font-bold pt-1 border-t border-border ${isPositive ? 'text-primary' : 'text-destructive'}`}>
                      {isPositive ? '+' : ''}{formatCurrency(w.net)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Disbursements & Expenses Ledger */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="select !h-8 !py-0 !text-xs !w-44"
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                >
                  <option value="all">All Expense Categories</option>
                  <option value="Payroll">Faculty & Staff Payroll</option>
                  <option value="Utilities">Campus Utilities</option>
                  <option value="Supplies">Office & Campus Supplies</option>
                  <option value="Maintenance">Maintenance & Facilities</option>
                  <option value="Educational Materials">Textbooks & Academic</option>
                  <option value="Other">Other Operational</option>
                </select>

                <div className="relative w-60">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search vendor, invoice #..."
                    className="input !h-8 !pl-10 !text-xs w-full"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <button
                onClick={onOpenNewExpense}
                className="btn btn-primary text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record Office Expense</span>
              </button>
            </div>

            <div className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table-clean w-full">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Vendor / Paid To</th>
                      <th>Category</th>
                      <th>Invoice / Ref #</th>
                      <th>Payment Method</th>
                      <th>Recorded By</th>
                      <th className="text-right">Amount</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map(exp => (
                      <tr key={exp.id}>
                        <td className="mono text-xs text-muted-foreground">{exp.date}</td>
                        <td className="font-semibold text-xs text-foreground">{exp.paid_to}</td>
                        <td>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted">
                            {exp.category}
                          </span>
                        </td>
                        <td className="mono text-xs text-muted-foreground">{exp.reference_no || '—'}</td>
                        <td className="text-xs text-muted-foreground">{exp.payment_method}</td>
                        <td className="text-xs text-muted-foreground">{exp.recorded_by_staff_name}</td>
                        <td className="text-right mono font-bold text-xs text-destructive">
                          -LKR {formatCurrency(exp.amount)}
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="btn-ghost p-1 rounded text-muted-foreground hover:text-destructive transition-colors ml-auto"
                            title="Delete Expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredExpenses.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-4">
                          <EmptyState
                            title="No Expense Records"
                            description={search || categoryFilter !== 'all' ? "No expense disbursements match the active filters." : "No operational expenses have been recorded yet."}
                            iconType="general"
                            actionLabel="Record Office Expense"
                            onAction={onOpenNewExpense}
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
