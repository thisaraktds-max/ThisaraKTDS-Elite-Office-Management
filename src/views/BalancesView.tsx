import React, { useState, useEffect, useMemo } from 'react';
import { StudentBalance } from '../types';
import { useNotification } from '../context/NotificationContext';
import { TableSkeleton } from '../components/common/SkeletonLoader';
import { EmptyState } from '../components/common/EmptyState';
import {
  Scale,
  Search,
  Filter,
  Send,
  FileText,
  Receipt,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  CheckSquare,
  Square,
  Layers,
  Sparkles,
} from 'lucide-react';

interface BalancesViewProps {
  onOpenDossier: (applicantId: string) => void;
  onOpenStatementOfAccount: (applicantId: string) => void;
  onOpenCommunications: (recipient: any) => void;
  onOpenRecordIncome: (applicantId: string, prefilledAmount?: number) => void;
}

type SortField = 'name' | 'grade_applying' | 'expected' | 'paid' | 'balance' | 'agingBucket';
type SortDirection = 'asc' | 'desc';

export const BalancesView: React.FC<BalancesViewProps> = ({
  onOpenDossier,
  onOpenStatementOfAccount,
  onOpenCommunications,
  onOpenRecordIncome,
}) => {
  const { showToast } = useNotification();
  const [balances, setBalances] = useState<StudentBalance[]>([]);
  const [search, setSearch] = useState('');
  const [agingFilter, setAgingFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [activePreset, setActivePreset] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Sorting
  const [sortField, setSortField] = useState<SortField>('balance');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const fetchBalances = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/balances');
      if (res.ok) {
        const data = await res.json();
        setBalances(data || []);
      }
    } catch (err) {
      console.error('Failed to load balances:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, []);

  const handleApplyPreset = (presetKey: string) => {
    setActivePreset(presetKey);
    setSelectedIds(new Set());
    if (presetKey === 'all') {
      setAgingFilter('all');
      setGradeFilter('all');
      setSearch('');
    } else if (presetKey === 'overdue_all') {
      setAgingFilter('overdue');
      setGradeFilter('all');
      setSearch('');
    } else if (presetKey === 'critical_90') {
      setAgingFilter('90_plus');
      setGradeFilter('all');
      setSearch('');
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'balance' ? 'desc' : 'asc');
    }
  };

  const totalOutstanding = balances.reduce((acc, b) => acc + (b.balance > 0 ? b.balance : 0), 0);
  const overdueCount = balances.filter((b) => b.isOverdue).length;

  const filtered = useMemo(() => {
    return balances.filter((b) => {
      if (agingFilter !== 'all') {
        if (agingFilter === 'overdue' && !b.isOverdue) return false;
        if (agingFilter === '30_days' && b.agingBucket !== '30_days') return false;
        if (agingFilter === '60_days' && b.agingBucket !== '60_days') return false;
        if (agingFilter === '90_plus' && b.agingBucket !== '90_plus') return false;
      }
      if (gradeFilter !== 'all' && b.grade_applying !== gradeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          b.first_name.toLowerCase().includes(q) ||
          b.last_name.toLowerCase().includes(q) ||
          b.application_no.toLowerCase().includes(q) ||
          b.guardian_name.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [balances, agingFilter, gradeFilter, search]);

  const sortedBalances = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (sortField === 'name') {
        valA = `${a.first_name} ${a.last_name}`.toLowerCase();
        valB = `${b.first_name} ${b.last_name}`.toLowerCase();
      } else if (sortField === 'grade_applying') {
        valA = a.grade_applying;
        valB = b.grade_applying;
      } else if (sortField === 'expected') {
        valA = Number(a.expected) || 0;
        valB = Number(b.expected) || 0;
      } else if (sortField === 'paid') {
        valA = Number(a.paid) || 0;
        valB = Number(b.paid) || 0;
      } else if (sortField === 'balance') {
        valA = Number(a.balance) || 0;
        valB = Number(b.balance) || 0;
      } else if (sortField === 'agingBucket') {
        valA = a.agingBucket || '';
        valB = b.agingBucket || '';
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortDir]);

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((b) => b.id)));
    }
  };

  const handleExportCSV = () => {
    const list =
      selectedIds.size > 0
        ? filtered.filter((b) => selectedIds.has(b.id))
        : filtered;

    if (list.length === 0) {
      showToast('No records to export', 'error');
      return;
    }

    const headers = [
      'Application No',
      'Student Name',
      'Grade',
      'Guardian Name',
      'Guardian Phone',
      'Net Expected (LKR)',
      'Paid to Date (LKR)',
      'Outstanding Balance (LKR)',
      'Aging Status',
    ];

    const rows = list.map((b) => [
      b.application_no,
      `"${b.first_name} ${b.last_name}"`,
      `"${b.grade_applying}"`,
      `"${b.guardian_name}"`,
      `"${b.guardian_phone}"`,
      b.expected,
      b.paid,
      b.balance,
      `"${b.agingBucket || 'Current'}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `outstanding_balances_${new Date().toISOString().substring(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported ${list.length} student balances to CSV`, 'success');
  };

  return (
    <div className="space-y-5">
      {/* Top Banner KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-elevated p-5">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Total Outstanding Receivable
          </div>
          <div className="mono text-2xl font-bold text-destructive mt-1">
            LKR {totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Across all active student accounts</p>
        </div>

        <div className="card-elevated p-5">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Delinquent Accounts (&gt;30 Days)
          </div>
          <div className="mono text-2xl font-bold text-foreground mt-1 flex items-baseline gap-2">
            <span>{overdueCount}</span>
            <span className="text-xs text-muted-foreground font-sans">students require outreach</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Actionable guardian notices available</p>
        </div>

        <div className="card-elevated p-5">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Average Settlement Yield
          </div>
          <div className="mono text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {balances.length > 0
              ? Math.round(
                  balances.reduce((a, b) => a + b.percentPaid, 0) / balances.length
                )
              : 0}
            %
          </div>
          <p className="text-xs text-muted-foreground mt-1">Tuition fee collection efficiency</p>
        </div>
      </div>

      {/* Saved Filter Presets */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
        <span className="text-[11px] font-mono uppercase text-muted-foreground shrink-0 flex items-center gap-1">
          <Layers className="w-3 h-3 text-primary" />
          <span>Presets:</span>
        </span>
        <button
          onClick={() => handleApplyPreset('all')}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
            activePreset === 'all'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-card border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          All Accounts ({balances.length})
        </button>
        <button
          onClick={() => handleApplyPreset('overdue_all')}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
            activePreset === 'overdue_all'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-card border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          Overdue Balances ({overdueCount})
        </button>
        <button
          onClick={() => handleApplyPreset('critical_90')}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
            activePreset === 'critical_90'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-card border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          Critical 90+ Days
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5 bg-muted/40 text-xs">
            <button
              onClick={() => {
                setActivePreset('');
                setAgingFilter('all');
              }}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                agingFilter === 'all' && !activePreset
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              All Accounts ({balances.length})
            </button>
            <button
              onClick={() => {
                setActivePreset('');
                setAgingFilter('overdue');
              }}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                agingFilter === 'overdue' && !activePreset
                  ? 'bg-destructive text-destructive-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              All Overdue ({overdueCount})
            </button>
            <button
              onClick={() => {
                setActivePreset('');
                setAgingFilter('60_days');
              }}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                agingFilter === '60_days'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              60 Days ({balances.filter((b) => b.agingBucket === '60_days').length})
            </button>
            <button
              onClick={() => {
                setActivePreset('');
                setAgingFilter('90_plus');
              }}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                agingFilter === '90_plus' && !activePreset
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              90+ Days ({balances.filter((b) => b.agingBucket === '90_plus').length})
            </button>
          </div>

          <select
            className="select !h-8 !py-0 !text-xs !w-36"
            value={gradeFilter}
            onChange={(e) => {
              setActivePreset('');
              setGradeFilter(e.target.value);
            }}
          >
            <option value="all">All Grades</option>
            <option value="Kindergarten">Kindergarten</option>
            <option value="Grade 1">Grade 1</option>
            <option value="Grade 2">Grade 2</option>
            <option value="Grade 3">Grade 3</option>
            <option value="Grade 4">Grade 4</option>
            <option value="Grade 5">Grade 5</option>
            <option value="Grade 6">Grade 6</option>
            <option value="Grade 7">Grade 7</option>
            <option value="Grade 8">Grade 8</option>
            <option value="Grade 9">Grade 9</option>
            <option value="Grade 10">Grade 10</option>
            <option value="Grade 11">Grade 11</option>
            <option value="Grade 12">Grade 12</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search student or guardian..."
              className="input !h-8 !pl-10 !text-xs w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="btn btn-soft !h-8 !py-0 !px-2.5 text-xs flex items-center gap-1.5"
            title="Export Ledger to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="p-3 bg-primary text-primary-foreground rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 animate-fade">
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-mono text-[11px]">
              {selectedIds.size}
            </span>
            <span>student account{selectedIds.size > 1 ? 's' : ''} selected</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Selected CSV</span>
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-2.5 py-1.5 text-primary-foreground/80 hover:text-primary-foreground"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Balances Ledger Table with Sticky Headers & Sorting */}
      <div className="panel overflow-hidden border border-border">
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={8} />
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
            <table className="table-clean w-full text-xs">
            <thead className="sticky top-0 bg-card/95 backdrop-blur-xs z-10 shadow-2xs">
              <tr>
                <th className="w-10 text-center">
                  <button
                    onClick={handleToggleSelectAll}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {selectedIds.size > 0 && selectedIds.size === filtered.length ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    <span>Student / Ref</span>
                    {sortField === 'name' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => handleSort('grade_applying')}
                >
                  <div className="flex items-center gap-1">
                    <span>Grade</span>
                    {sortField === 'grade_applying' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th>Guardian Contact</th>
                <th
                  className="text-right cursor-pointer select-none hover:text-foreground"
                  onClick={() => handleSort('expected')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Net Expected</span>
                    {sortField === 'expected' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  className="text-right cursor-pointer select-none hover:text-foreground"
                  onClick={() => handleSort('paid')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Paid to Date</span>
                    {sortField === 'paid' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  className="text-right cursor-pointer select-none hover:text-foreground"
                  onClick={() => handleSort('balance')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Outstanding</span>
                    {sortField === 'balance' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="text-center">Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedBalances.map((b) => {
                const isSelected = selectedIds.has(b.id);
                return (
                  <tr
                    key={b.id}
                    className={`hover:bg-muted/30 transition-colors ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td
                      className="text-center"
                      onClick={(e) => handleToggleSelect(b.id, e)}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-primary mx-auto" />
                      ) : (
                        <Square className="w-4 h-4 text-muted-foreground mx-auto" />
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        onClick={() => onOpenDossier(b.id)}
                        className="font-bold text-xs text-primary hover:underline cursor-pointer"
                      >
                        {b.first_name} {b.last_name}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {b.application_no}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-xs font-medium text-foreground whitespace-nowrap">
                      {b.grade_applying}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-xs font-medium text-foreground">{b.guardian_name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {b.guardian_phone}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs font-medium whitespace-nowrap">
                      {Number(b.expected).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs text-primary font-semibold whitespace-nowrap">
                      {Number(b.paid).toLocaleString()}
                      <span className="text-[10px] text-muted-foreground ml-1">
                        ({b.percentPaid}%)
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs font-bold whitespace-nowrap">
                      <span className={b.balance > 0 ? 'text-destructive' : 'text-primary'}>
                        {Number(b.balance).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {b.balance <= 0 ? (
                        <span className="badge badge-accepted !text-[9px]">Settled</span>
                      ) : b.agingBucket === '90_plus' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                          90+ Days
                        </span>
                      ) : b.agingBucket === '60_days' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          60 Days
                        </span>
                      ) : b.agingBucket === '30_days' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-amber-50/60 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border border-amber-200/60">
                          30 Days
                        </span>
                      ) : (
                        <span className="badge badge-applied !text-[9px]">Current</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {b.balance > 0 && (
                          <button
                            onClick={() => onOpenRecordIncome(b.id, b.balance)}
                            className="btn btn-primary !h-7 !py-0 !px-2 text-xs"
                            title="Record Settlement"
                          >
                            <Receipt className="w-3 h-3 mr-1" />
                            <span>Pay</span>
                          </button>
                        )}
                        <button
                          onClick={() =>
                            onOpenCommunications({
                              applicant_id: b.id,
                              student_name: `${b.first_name} ${b.last_name}`,
                              guardian_name: b.guardian_name,
                              guardian_phone: b.guardian_phone,
                              guardian_email: b.guardian_email,
                              grade: b.grade_applying,
                              balance_due: b.balance,
                              days_overdue: b.daysSinceLastPayment || 30,
                              contextType: 'tuition_reminder',
                            })
                          }
                          className="btn btn-soft !h-7 !py-0 !px-2 text-xs"
                          title="Send Notice"
                        >
                          <Send className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onOpenStatementOfAccount(b.id)}
                          className="btn btn-soft !h-7 !py-0 !px-2 text-xs"
                          title="Statement of Account"
                        >
                          <FileText className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sortedBalances.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-4">
                    <EmptyState
                      iconType="balance"
                      title="No Student Accounts Found"
                      description="No student accounts match the selected filters."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
};
