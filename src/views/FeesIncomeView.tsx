import React, { useState, useEffect, useMemo } from 'react';
import { useStaff } from '../context/StaffContext';
import { useNotification } from '../context/NotificationContext';
import { FeeStructure, Income } from '../types';
import { TableSkeleton } from '../components/common/SkeletonLoader';
import { EmptyState } from '../components/common/EmptyState';
import { formatCurrency } from '../utils/format';
import {
  Receipt,
  Plus,
  Printer,
  Search,
  Layers,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  ListFilter,
  CreditCard,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { ConfirmDialogModal } from '../components/modals/ConfirmDialogModal';

interface FeesIncomeViewProps {
  onOpenNewIncome: () => void;
  onOpenReceiptModal: (receiptId: string) => void;
  onOpenDossier: (applicantId: string) => void;
}

// Helper to sort grades in logical educational sequence (Early Childhood -> Grades 1-12 -> Unspecified/Other)
const sortGradesLogically = (a: string, b: string): number => {
  const getWeight = (str: string) => {
    const s = (str || '').trim().toLowerCase();
    if (s.includes('daycare') || s.includes('playgroup')) return 1;
    if (s.includes('nursery')) return 2;
    if (s.includes('pre-k') || s.includes('pre-kg') || s.includes('pre kindergarten') || s.includes('pre-kindergarten')) return 3;
    if (s.includes('lkg') || s.includes('lower kg')) return 4;
    if (s.includes('ukg') || s.includes('upper kg')) return 5;
    if (s.includes('kindergarten') || s.includes('kg')) return 6;
    if (s.includes('institutional') || s.includes('general')) return 999;
    if (s.includes('unspecified')) return 998;

    // Check for numbers: Grade 1..12, Year 1..12
    const match = s.match(/\d+/);
    if (match) {
      return 100 + parseInt(match[0], 10);
    }
    return 900;
  };

  const weightA = getWeight(a);
  const weightB = getWeight(b);
  if (weightA !== weightB) {
    return weightA - weightB;
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

export const FeesIncomeView: React.FC<FeesIncomeViewProps> = ({
  onOpenNewIncome,
  onOpenReceiptModal,
  onOpenDossier,
}) => {
  const { getHeaders } = useStaff();
  const { showToast } = useNotification();

  const [activeTab, setActiveTab] = useState<'income' | 'structure'>('income');
  const [viewStyle, setViewStyle] = useState<'grouped' | 'flat'>('grouped');
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [collapsedGrades, setCollapsedGrades] = useState<Record<string, boolean>>({});

  // Filters
  const [sourceFilter, setSourceFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Fee Structure Modal (Add & Edit) & Deletion
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [editingFee, setEditingFee] = useState<FeeStructure | null>(null);
  const [isSavingFee, setIsSavingFee] = useState(false);
  const [feeForm, setFeeForm] = useState({
    academic_year: '2026-2027',
    grade: 'Grade 1',
    fee_type: 'Tuition',
    amount: '145000',
    is_compulsory: 1,
    description: 'Standard Annual Academic Tuition',
  });
  const [feeToDelete, setFeeToDelete] = useState<FeeStructure | null>(null);
  const [isDeletingFee, setIsDeletingFee] = useState(false);

  // Income Deletion
  const [incomeToDelete, setIncomeToDelete] = useState<Income | null>(null);
  const [isDeletingIncome, setIsDeletingIncome] = useState(false);

  // Edit Income Modal
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [isSavingIncome, setIsSavingIncome] = useState(false);
  const [incomeForm, setIncomeForm] = useState({
    amount: '',
    payer_name: '',
    date: '',
    source: 'Tuition',
    payment_method: 'Cash',
    reference_no: '',
    notes: '',
  });

  const handleOpenEditIncome = (inc: Income) => {
    setEditingIncome(inc);
    setIncomeForm({
      amount: String(inc.amount),
      payer_name: inc.payer_name || '',
      date: inc.date || new Date().toISOString().split('T')[0],
      source: inc.source || 'Tuition',
      payment_method: inc.payment_method || 'Cash',
      reference_no: inc.reference_no || '',
      notes: inc.notes || '',
    });
  };

  const handleSaveEditIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIncome) return;
    const numAmount = parseFloat(incomeForm.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter a valid amount greater than 0', 'error');
      return;
    }
    if (!incomeForm.payer_name.trim()) {
      showToast('Payer / Remitter name is required', 'error');
      return;
    }

    setIsSavingIncome(true);
    try {
      const res = await fetch(`/api/income/${editingIncome.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          amount: numAmount,
          payer_name: incomeForm.payer_name.trim(),
          date: incomeForm.date,
          source: incomeForm.source,
          payment_method: incomeForm.payment_method,
          reference_no: incomeForm.reference_no.trim() || undefined,
          notes: incomeForm.notes.trim() || undefined,
        }),
      });

      if (res.ok) {
        showToast(`Income receipt #${editingIncome.receipt_no} updated successfully`, 'success');
        setEditingIncome(null);
        await fetchData();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to update income entry', 'error');
      }
    } catch (err: any) {
      showToast('Failed to update income entry', 'error');
    } finally {
      setIsSavingIncome(false);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [incRes, feeRes] = await Promise.all([
        fetch('/api/income'),
        fetch('/api/fees'),
      ]);
      if (incRes.ok) setIncomes(await incRes.json());
      if (feeRes.ok) setFeeStructures(await feeRes.json());
    } catch (err) {
      console.error('Failed to load fees/income:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAddFee = () => {
    setEditingFee(null);
    setFeeForm({
      academic_year: '2026-2027',
      grade: 'Grade 1',
      fee_type: 'Tuition',
      amount: '145000',
      is_compulsory: 1,
      description: 'Standard Annual Academic Tuition',
    });
    setShowFeeModal(true);
  };

  const handleOpenEditFee = (fee: FeeStructure) => {
    setEditingFee(fee);
    setFeeForm({
      academic_year: fee.academic_year || '2026-2027',
      grade: fee.grade || 'Grade 1',
      fee_type: fee.fee_type || 'Tuition',
      amount: String(fee.amount || ''),
      is_compulsory: fee.is_compulsory ?? 1,
      description: fee.description || '',
    });
    setShowFeeModal(true);
  };

  const handleSaveFeeStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(feeForm.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter a valid amount greater than 0', 'error');
      return;
    }
    setIsSavingFee(true);
    try {
      const url = editingFee ? `/api/fees/${editingFee.id}` : '/api/fees';
      const method = editingFee ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          academic_year: feeForm.academic_year,
          grade: feeForm.grade,
          fee_type: feeForm.fee_type,
          amount: numAmount,
          is_compulsory: feeForm.is_compulsory,
          description: feeForm.description,
        }),
      });
      if (res.ok) {
        showToast(
          editingFee
            ? `Fee schedule rule for ${feeForm.grade} (${feeForm.fee_type}) updated`
            : 'Fee structure item registered successfully',
          'success'
        );
        setShowFeeModal(false);
        setEditingFee(null);
        await fetchData();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to save fee structure', 'error');
      }
    } catch (err) {
      showToast('Failed to save fee structure', 'error');
    } finally {
      setIsSavingFee(false);
    }
  };

  const handleConfirmDeleteFee = async () => {
    if (!feeToDelete) return;
    setIsDeletingFee(true);
    try {
      const res = await fetch(`/api/fees/${feeToDelete.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast(
          `Fee schedule rule "${feeToDelete.fee_type}" for ${feeToDelete.grade} deleted`,
          'success'
        );
        setFeeToDelete(null);
        await fetchData();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to delete fee rule', 'error');
      }
    } catch (err) {
      showToast('Failed to delete fee rule', 'error');
    } finally {
      setIsDeletingFee(false);
    }
  };

  const handleConfirmDeleteIncome = async () => {
    if (!incomeToDelete) return;
    setIsDeletingIncome(true);
    try {
      const res = await fetch(`/api/income/${incomeToDelete.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast(
          `Receipt #${incomeToDelete.receipt_no} reversed and deleted. Student balance updated.`,
          'success'
        );
        setIncomeToDelete(null);
        await fetchData();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to reverse income entry', 'error');
      }
    } catch (err) {
      showToast('Failed to reverse income entry', 'error');
    } finally {
      setIsDeletingIncome(false);
    }
  };

  const toggleGradeCollapse = (grade: string) => {
    setCollapsedGrades(prev => ({
      ...prev,
      [grade]: !prev[grade],
    }));
  };

  const filteredIncome = useMemo(() => {
    return incomes.filter(inc => {
      if (sourceFilter !== 'all' && inc.source !== sourceFilter) return false;
      if (methodFilter !== 'all' && inc.payment_method !== methodFilter) return false;
      const studentGrade = inc.student_grade || (inc.applicant_id ? 'Unspecified Grade' : 'Institutional');
      if (gradeFilter !== 'all' && studentGrade !== gradeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          inc.receipt_no.toLowerCase().includes(q) ||
          inc.payer_name.toLowerCase().includes(q) ||
          (inc.reference_no && inc.reference_no.toLowerCase().includes(q)) ||
          (inc.student_first_name && inc.student_first_name.toLowerCase().includes(q)) ||
          (inc.student_last_name && inc.student_last_name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [incomes, sourceFilter, methodFilter, gradeFilter, search]);

  const totalIncomeSum = useMemo(() => {
    return filteredIncome.reduce((acc, i) => acc + Number(i.amount), 0);
  }, [filteredIncome]);

  // Group filtered incomes by Grade
  const groupedByGrade = useMemo(() => {
    const groups: Record<string, { total: number; count: number; items: Income[] }> = {};

    filteredIncome.forEach(inc => {
      const gradeKey = inc.student_grade || (inc.applicant_id ? 'Unspecified Grade' : 'Institutional / General');
      if (!groups[gradeKey]) {
        groups[gradeKey] = { total: 0, count: 0, items: [] };
      }
      groups[gradeKey].items.push(inc);
      groups[gradeKey].total += Number(inc.amount);
      groups[gradeKey].count += 1;
    });

    // Sort grades in logical order
    const sortedKeys = Object.keys(groups).sort(sortGradesLogically);

    return sortedKeys.map(key => ({
      grade: key,
      ...groups[key],
    }));
  }, [filteredIncome]);

  // Group Fee Structures by Grade in logical order
  const groupedFeeStructures = useMemo(() => {
    const groups: Record<
      string,
      {
        grade: string;
        items: FeeStructure[];
        totalAmount: number;
        compulsoryAmount: number;
      }
    > = {};

    feeStructures.forEach(fee => {
      const g = fee.grade || 'Unspecified Grade';
      if (!groups[g]) {
        groups[g] = { grade: g, items: [], totalAmount: 0, compulsoryAmount: 0 };
      }
      groups[g].items.push(fee);
      groups[g].totalAmount += Number(fee.amount) || 0;
      if (fee.is_compulsory === 1) {
        groups[g].compulsoryAmount += Number(fee.amount) || 0;
      }
    });

    // Sort grades in logical educational order (Grade 1 -> Grade 12)
    const sortedGrades = Object.keys(groups).sort(sortGradesLogically);

    return sortedGrades.map(grade => {
      const group = groups[grade];
      // Sort items within each grade: Compulsory first, then prioritized fee types
      group.items.sort((a, b) => {
        if (a.is_compulsory !== b.is_compulsory) {
          return b.is_compulsory - a.is_compulsory;
        }
        const getFeeTypePriority = (type: string) => {
          const t = (type || '').toLowerCase();
          if (t.includes('tuition')) return 1;
          if (t.includes('registration') || t.includes('admission')) return 2;
          if (t.includes('uniform')) return 3;
          if (t.includes('exam')) return 4;
          if (t.includes('laboratory') || t.includes('lab')) return 5;
          return 10;
        };
        const pA = getFeeTypePriority(a.fee_type);
        const pB = getFeeTypePriority(b.fee_type);
        if (pA !== pB) return pA - pB;
        return a.fee_type.localeCompare(b.fee_type);
      });
      return group;
    });
  }, [feeStructures]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-input p-0.5 bg-muted/40 text-xs">
            <button
              onClick={() => setActiveTab('income')}
              className={`px-3.5 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'income' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Income & Receipts ({incomes.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('structure')}
              className={`px-3.5 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'structure' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Fee Structure Matrix ({feeStructures.length})</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'income' ? (
            <button
              onClick={onOpenNewIncome}
              className="btn btn-primary text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Income / Payment</span>
            </button>
          ) : (
            <button
              onClick={handleOpenAddFee}
              className="btn btn-primary text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Fee Schedule Rule</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'income' ? (
        /* INCOME LEDGER VIEW */
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Grouped vs Flat Toggle */}
              <div className="flex rounded-lg border border-border p-0.5 bg-muted/40 text-xs">
                <button
                  onClick={() => setViewStyle('grouped')}
                  className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 transition-all ${
                    viewStyle === 'grouped'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Group Payments by Grade"
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Grouped by Grade</span>
                </button>
                <button
                  onClick={() => setViewStyle('flat')}
                  className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 transition-all ${
                    viewStyle === 'flat'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Flat Ledger View"
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  <span>Flat Ledger</span>
                </button>
              </div>

              <select
                className="select !h-8 !py-0 !text-xs !w-36"
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value)}
              >
                <option value="all">All Sources</option>
                <option value="Tuition">Tuition</option>
                <option value="Registration">Registration</option>
                <option value="Exam Fee">Exam Fee</option>
                <option value="Uniform">Uniform</option>
                <option value="Donation">Donation</option>
                <option value="Grant">Grant</option>
              </select>

              <select
                className="select !h-8 !py-0 !text-xs !w-36"
                value={methodFilter}
                onChange={e => setMethodFilter(e.target.value)}
              >
                <option value="all">All Methods</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Cheque">Cheque</option>
              </select>

              <div className="relative w-60">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search receipt, payer..."
                  className="input !h-8 !pl-10 !text-xs w-full"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="text-xs text-muted-foreground font-mono">
              Filtered Total: <strong className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">LKR {formatCurrency(totalIncomeSum)}</strong>
            </div>
          </div>

          {/* Grouped by Grade View */}
          {isLoading ? (
            <div className="panel p-4 border border-border">
              <TableSkeleton rows={8} />
            </div>
          ) : viewStyle === 'grouped' ? (
            <div className="space-y-4">
              {groupedByGrade.map(group => {
                const isCollapsed = collapsedGrades[group.grade];
                return (
                  <div key={group.grade} className="panel overflow-hidden border border-border shadow-2xs">
                    {/* Grade Header Summary Accordion */}
                    <div
                      onClick={() => toggleGradeCollapse(group.grade)}
                      className="p-4 bg-muted/40 hover:bg-muted/60 transition-colors flex items-center justify-between cursor-pointer border-b border-border select-none"
                    >
                      <div className="flex items-center gap-3">
                        <button className="p-1 rounded-md hover:bg-background/80 text-muted-foreground">
                          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="font-serif font-bold text-sm text-foreground">{group.grade}</span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground">
                            {group.count} {group.count === 1 ? 'payment' : 'payments'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Grade Total</span>
                          <span className="font-mono font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                            LKR {formatCurrency(group.total)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Grade Table Content */}
                    {!isCollapsed && (
                      <div className="overflow-x-auto">
                        <table className="table-clean w-full">
                          <thead>
                            <tr>
                              <th className="w-24">Receipt #</th>
                              <th className="w-24">Date</th>
                              <th>Payer / Remitter</th>
                              <th>Linked Student</th>
                              <th>Source</th>
                              <th>Payment Method</th>
                              <th>Received By</th>
                              <th className="text-right">Amount</th>
                              <th className="text-right w-20">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map(inc => (
                              <tr key={inc.id} className="hover:bg-muted/20 transition-colors">
                                <td className="mono font-bold text-xs text-primary">{inc.receipt_no}</td>
                                <td className="text-xs text-muted-foreground mono">{inc.date}</td>
                                <td>
                                  <div className="font-semibold text-xs text-foreground">{inc.payer_name}</div>
                                </td>
                                <td>
                                  {inc.applicant_id ? (
                                    <div
                                      onClick={() => onOpenDossier(inc.applicant_id!)}
                                      className="text-xs font-medium text-primary hover:underline cursor-pointer"
                                    >
                                      {inc.student_first_name} {inc.student_last_name}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground italic">Institutional</span>
                                  )}
                                </td>
                                <td>
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-foreground">
                                    {inc.source}
                                  </span>
                                </td>
                                <td className="text-xs text-muted-foreground">
                                  <div>{inc.payment_method}</div>
                                  {inc.reference_no && <div className="mono text-[10px] text-muted-foreground/70">{inc.reference_no}</div>}
                                </td>
                                <td className="text-xs text-muted-foreground">{inc.received_by_staff_name}</td>
                                <td className="text-right mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                                  +LKR {formatCurrency(inc.amount)}
                                </td>
                                <td className="text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleOpenEditIncome(inc)}
                                      className="btn btn-ghost !h-7 !px-2 text-xs inline-flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground rounded-md leading-none whitespace-nowrap"
                                      title="Edit Payment Details"
                                    >
                                      <Pencil className="w-3 h-3 shrink-0" />
                                      <span className="hidden sm:inline leading-none">Edit</span>
                                    </button>
                                    <button
                                      onClick={() => onOpenReceiptModal(inc.id)}
                                      className="btn btn-soft !h-7 !px-2.5 text-xs inline-flex items-center justify-center gap-1.5 rounded-md leading-none whitespace-nowrap shadow-2xs"
                                      title="View / Print Receipt"
                                    >
                                      <Printer className="w-3.5 h-3.5 shrink-0" />
                                      <span className="leading-none">Receipt</span>
                                    </button>
                                    <button
                                      onClick={() => setIncomeToDelete(inc)}
                                      className="btn btn-ghost !h-7 !px-2 text-xs inline-flex items-center justify-center gap-1 text-destructive hover:bg-destructive/10 rounded-md leading-none whitespace-nowrap"
                                      title="Reverse / Delete Income Entry"
                                    >
                                      <Trash2 className="w-3 h-3 shrink-0" />
                                      <span className="hidden sm:inline leading-none">Delete</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}

              {groupedByGrade.length === 0 && (
                <div className="panel p-4 border border-border">
                  <EmptyState
                    iconType="ledger"
                    title="No Income Records Found"
                    description="No income records match the selected filters."
                    actionLabel="Record Fee Payment"
                    onAction={onOpenNewIncome}
                  />
                </div>
              )}
            </div>
          ) : (
            /* Flat Ledger Table View */
            <div className="panel overflow-hidden border border-border shadow-2xs">
              <div className="overflow-x-auto">
                <table className="table-clean w-full">
                  <thead>
                    <tr>
                      <th>Receipt #</th>
                      <th>Date</th>
                      <th>Payer / Remitter</th>
                      <th>Linked Student & Grade</th>
                      <th>Source</th>
                      <th>Payment Mode & Ref</th>
                      <th>Received By</th>
                      <th className="text-right">Amount</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIncome.map(inc => (
                      <tr key={inc.id} className="hover:bg-muted/20 transition-colors">
                        <td className="mono font-bold text-xs text-primary">{inc.receipt_no}</td>
                        <td className="text-xs text-muted-foreground mono">{inc.date}</td>
                        <td>
                          <div className="font-semibold text-xs text-foreground">{inc.payer_name}</div>
                        </td>
                        <td>
                          {inc.applicant_id ? (
                            <div>
                              <div
                                onClick={() => onOpenDossier(inc.applicant_id!)}
                                className="text-xs font-medium text-primary hover:underline cursor-pointer"
                              >
                                {inc.student_first_name} {inc.student_last_name}
                              </div>
                              {inc.student_grade && (
                                <div className="text-[10px] text-muted-foreground">{inc.student_grade}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">General / Institutional</span>
                          )}
                        </td>
                        <td>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-foreground">
                            {inc.source}
                          </span>
                        </td>
                        <td className="text-xs text-muted-foreground">
                          <div>{inc.payment_method}</div>
                          {inc.reference_no && <div className="mono text-[10px]">{inc.reference_no}</div>}
                        </td>
                        <td className="text-xs text-muted-foreground">{inc.received_by_staff_name}</td>
                        <td className="text-right mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                          +LKR {formatCurrency(inc.amount)}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditIncome(inc)}
                              className="btn btn-ghost !h-7 !px-2 text-xs inline-flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground rounded-md leading-none whitespace-nowrap"
                              title="Edit Payment Details"
                            >
                              <Pencil className="w-3 h-3 shrink-0" />
                              <span className="hidden sm:inline leading-none">Edit</span>
                            </button>
                            <button
                              onClick={() => onOpenReceiptModal(inc.id)}
                              className="btn btn-soft !h-7 !px-2.5 text-xs inline-flex items-center justify-center gap-1.5 rounded-md leading-none whitespace-nowrap shadow-2xs"
                              title="View / Print Receipt"
                            >
                              <Printer className="w-3.5 h-3.5 shrink-0" />
                              <span className="leading-none">Receipt</span>
                            </button>
                            <button
                              onClick={() => setIncomeToDelete(inc)}
                              className="btn btn-ghost !h-7 !px-2 text-xs inline-flex items-center justify-center gap-1 text-destructive hover:bg-destructive/10 rounded-md leading-none whitespace-nowrap"
                              title="Reverse / Delete Income Entry"
                            >
                              <Trash2 className="w-3 h-3 shrink-0" />
                              <span className="hidden sm:inline leading-none">Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredIncome.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-4">
                          <EmptyState
                            iconType="ledger"
                            title="No Income Records Found"
                            description="No income entries match current filter criteria."
                            actionLabel="Record Fee Payment"
                            onAction={onOpenNewIncome}
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* FEE STRUCTURE MATRIX */
        <div className="panel p-6 space-y-4 border border-border shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-border flex-wrap gap-2">
            <div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Academic Pricing</div>
              <h3 className="text-base font-serif font-bold text-foreground">Standard Fee Schedules & Prescriptions</h3>
            </div>
            <div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-muted/40 border border-border">
                {groupedFeeStructures.length} {groupedFeeStructures.length === 1 ? 'Grade Level' : 'Grade Levels'}
              </span>
              <span>•</span>
              <span className="px-2 py-0.5 rounded-md bg-muted/40 border border-border">
                {feeStructures.length} {feeStructures.length === 1 ? 'Fee Rule' : 'Fee Rules'}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table-clean w-full">
              <thead>
                <tr>
                  <th>Academic Year</th>
                  <th>Grade Level</th>
                  <th>Fee Classification</th>
                  <th>Description</th>
                  <th>Requirement</th>
                  <th className="text-right">Standard Amount</th>
                  <th className="text-right w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupedFeeStructures.map(group => (
                  <React.Fragment key={group.grade}>
                    {/* Grade Section Header / Divider */}
                    <tr className="bg-muted/50 border-t-2 border-b border-border/80 select-none">
                      <td colSpan={7} className="py-2.5 px-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                              <GraduationCap className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-serif font-bold text-sm text-foreground tracking-wide">{group.grade}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground">
                              {group.items.length} {group.items.length === 1 ? 'fee rule' : 'fee rules'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-muted-foreground text-[11px]">
                              Compulsory Total: <strong className="font-mono text-foreground font-semibold">LKR {formatCurrency(group.compulsoryAmount)}</strong>
                            </span>
                            <span className="text-border">|</span>
                            <span className="text-muted-foreground text-[11px]">
                              All Prescribed Fees: <strong className="font-mono text-foreground font-bold">LKR {formatCurrency(group.totalAmount)}</strong>
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Fee rules for this grade */}
                    {group.items.map(fee => (
                      <tr key={fee.id} className="hover:bg-muted/20 transition-colors">
                        <td className="mono text-xs text-muted-foreground">{fee.academic_year}</td>
                        <td className="font-semibold text-xs text-foreground">{fee.grade}</td>
                        <td className="font-medium text-xs text-primary">{fee.fee_type}</td>
                        <td className="text-xs text-muted-foreground">{fee.description || 'Standard rate'}</td>
                        <td>
                          {fee.is_compulsory === 1 ? (
                            <span className="badge badge-accepted !text-[10px]">Compulsory</span>
                          ) : (
                            <span className="badge badge-applied !text-[10px]">Optional</span>
                          )}
                        </td>
                        <td className="text-right mono font-bold text-xs text-foreground">
                          LKR {formatCurrency(fee.amount)}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditFee(fee)}
                              className="btn btn-ghost !h-7 !px-2 text-xs inline-flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground rounded-md leading-none"
                              title="Edit Fee Rule"
                            >
                              <Pencil className="w-3 h-3" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>
                            <button
                              onClick={() => setFeeToDelete(fee)}
                              className="btn btn-ghost !h-7 !px-2 text-xs inline-flex items-center justify-center gap-1 text-destructive hover:bg-destructive/10 rounded-md leading-none"
                              title="Delete Fee Rule"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span className="hidden sm:inline">Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                {feeStructures.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-4">
                      <EmptyState
                        iconType="ledger"
                        title="No Fee Structures Defined"
                        description="No academic fee rules exist yet."
                        actionLabel="Add Fee Schedule Rule"
                        onAction={handleOpenAddFee}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fee Schedule Modal (Add & Edit) */}
      {showFeeModal && (
        <div className="modal-backdrop" onClick={() => { setShowFeeModal(false); setEditingFee(null); }}>
          <div className="modal !max-w-md" onClick={e => e.stopPropagation()}>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Fee Management</div>
            <h3 className="text-lg font-serif font-bold text-foreground mb-4">
              {editingFee ? 'Edit Fee Schedule Rule' : 'Register New Fee Schedule Item'}
            </h3>

            <form onSubmit={handleSaveFeeStructure} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Academic Year</label>
                  <input
                    type="text"
                    required
                    className="input"
                    value={feeForm.academic_year}
                    onChange={e => setFeeForm({ ...feeForm, academic_year: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Grade Level</label>
                  <select
                    className="select"
                    value={feeForm.grade}
                    onChange={e => setFeeForm({ ...feeForm, grade: e.target.value })}
                  >
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Fee Type</label>
                  <select
                    className="select"
                    value={feeForm.fee_type}
                    onChange={e => setFeeForm({ ...feeForm, fee_type: e.target.value })}
                  >
                    <option value="Tuition">Tuition Fee</option>
                    <option value="Registration">Registration / Matriculation</option>
                    <option value="Laboratory">Science / Tech Lab Fee</option>
                    <option value="Activity">Student Activities & Sports</option>
                    <option value="Technology">Technology Infrastructure</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Requirement</label>
                  <select
                    className="select"
                    value={feeForm.is_compulsory}
                    onChange={e => setFeeForm({ ...feeForm, is_compulsory: Number(e.target.value) })}
                  >
                    <option value={1}>Compulsory (Mandatory)</option>
                    <option value={0}>Optional (Elective)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Amount (LKR)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  required
                  className="input font-mono font-bold"
                  value={feeForm.amount}
                  onChange={e => setFeeForm({ ...feeForm, amount: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Description</label>
                <input
                  type="text"
                  className="input"
                  value={feeForm.description}
                  onChange={e => setFeeForm({ ...feeForm, description: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowFeeModal(false); setEditingFee(null); }}
                  className="btn btn-ghost text-xs"
                  disabled={isSavingFee}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs"
                  disabled={isSavingFee}
                >
                  {isSavingFee ? 'Saving...' : editingFee ? 'Update Fee Rule' : 'Save Schedule Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Income Entry Modal */}
      {editingIncome && (
        <div className="modal-backdrop" onClick={() => setEditingIncome(null)}>
          <div className="modal !max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <div>
                <div className="eyebrow">Financial Ledger</div>
                <h3 className="text-base font-serif font-bold text-foreground">
                  Edit Income Entry — Receipt #{editingIncome.receipt_no}
                </h3>
              </div>
              <button
                onClick={() => setEditingIncome(null)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Read-only linkage summary */}
            <div className="p-3 bg-muted/40 rounded-xl border border-border text-xs mb-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Receipt Number:</span>
                <span className="font-mono font-bold text-primary">{editingIncome.receipt_no}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Linked Student:</span>
                <span className="font-medium text-foreground">
                  {editingIncome.applicant_id ? (
                    `${editingIncome.student_first_name} ${editingIncome.student_last_name} (${editingIncome.student_grade || 'Grade'})`
                  ) : (
                    <span className="italic text-muted-foreground">General / Institutional (No Student)</span>
                  )}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                Receipt # and student linkage are locked to preserve audit trail integrity. Modifying the payment amount will automatically recalculate the student's installment plan balances.
              </div>
            </div>

            <form onSubmit={handleSaveEditIncome} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Payment Amount (LKR)</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    className="input font-mono font-bold text-emerald-600 dark:text-emerald-400"
                    value={incomeForm.amount}
                    onChange={e => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    className="input font-mono text-xs"
                    value={incomeForm.date}
                    onChange={e => setIncomeForm({ ...incomeForm, date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Payer / Remitter Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mrs. Sunethra Perera"
                  className="input"
                  value={incomeForm.payer_name}
                  onChange={e => setIncomeForm({ ...incomeForm, payer_name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Income Source</label>
                  <select
                    className="select text-xs"
                    value={incomeForm.source}
                    onChange={e => setIncomeForm({ ...incomeForm, source: e.target.value })}
                  >
                    <option value="Tuition">Tuition</option>
                    <option value="Registration">Registration</option>
                    <option value="Exam Fee">Exam Fee</option>
                    <option value="Uniform">Uniform</option>
                    <option value="Donation">Donation</option>
                    <option value="Grant">Grant</option>
                    <option value="Laboratory">Laboratory</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Payment Method</label>
                  <select
                    className="select text-xs"
                    value={incomeForm.payment_method}
                    onChange={e => setIncomeForm({ ...incomeForm, payment_method: e.target.value })}
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online">Online</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Reference / Cheque No. (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. TXN-928371 / CHQ-10492"
                  className="input font-mono text-xs"
                  value={incomeForm.reference_no}
                  onChange={e => setIncomeForm({ ...incomeForm, reference_no: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Notes / Remarks (Optional)</label>
                <textarea
                  placeholder="Optional internal remark or explanation..."
                  className="textarea !h-16 text-xs"
                  value={incomeForm.notes}
                  onChange={e => setIncomeForm({ ...incomeForm, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingIncome(null)}
                  className="btn btn-ghost text-xs"
                  disabled={isSavingIncome}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs"
                  disabled={isSavingIncome}
                >
                  {isSavingIncome ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Fee Rule Confirmation Modal */}
      <ConfirmDialogModal
        isOpen={!!feeToDelete}
        onClose={() => setFeeToDelete(null)}
        onConfirm={handleConfirmDeleteFee}
        title="Delete Fee Schedule Rule"
        message={`Are you sure you want to permanently delete the standard ${feeToDelete?.fee_type} fee rule (${feeToDelete?.grade}, ${feeToDelete?.academic_year})?`}
        confirmText="Delete Fee Rule"
        variant="danger"
        isConfirming={isDeletingFee}
        warningDetails={[
          `Amount: LKR ${formatCurrency(feeToDelete?.amount || 0)}`,
          'This removes this fee prescription from the institutional structure matrix.',
          "This affects every student's expected-fee calculation for this grade and academic year going forward.",
          'Historical payments and receipts already issued will not be altered.',
          'This action is permanently logged in the staff audit trail.',
        ]}
      />

      {/* Delete / Reverse Income Receipt Confirmation Modal */}
      <ConfirmDialogModal
        isOpen={!!incomeToDelete}
        onClose={() => setIncomeToDelete(null)}
        onConfirm={handleConfirmDeleteIncome}
        title="Reverse & Delete Income Receipt"
        message={`Are you sure you want to permanently reverse and delete receipt #${incomeToDelete?.receipt_no} from ${incomeToDelete?.payer_name}?`}
        confirmText="Reverse & Delete Receipt"
        variant="danger"
        isConfirming={isDeletingIncome}
        warningDetails={[
          `Amount to be reversed: LKR ${formatCurrency(incomeToDelete?.amount || 0)} (${incomeToDelete?.payment_method || 'Payment'})`,
          'This removes the payment from school revenue, income ledger, and cash flow reports.',
          'The linked student balance will immediately increase by this amount.',
          'Any linked installment schedules will automatically re-calculate and show as pending.',
          'This reversal is permanently logged in the staff audit trail.',
        ]}
      />
    </div>
  );
};
