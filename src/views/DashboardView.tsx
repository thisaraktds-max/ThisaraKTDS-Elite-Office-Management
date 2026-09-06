import React, { useState, useEffect } from 'react';
import { useStaff } from '../context/StaffContext';
import { CountUp } from '../components/common/CountUp';
import { CardSkeleton, TableSkeleton } from '../components/common/SkeletonLoader';
import { EmptyState } from '../components/common/EmptyState';
import { formatCurrency } from '../utils/format';
import { MonthlyRevenueExpensesChart } from '../components/dashboard/MonthlyRevenueExpensesChart';
import {
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
  ArrowRight,
  Receipt,
  Scale,
  Plus,
  AlertTriangle,
  Calendar,
  Clock,
  TrendingDown,
  ChevronRight,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (view: string, id?: string) => void;
  onOpenNewApplicant: () => void;
  onOpenNewIncome: () => void;
  onOpenNewExpense: () => void;
}

interface RemindersData {
  totalCount: number;
  overdueBalances: Array<{
    id: string;
    type: string;
    applicant_id?: string;
    student_name: string;
    grade?: string;
    guardian_name?: string;
    guardian_phone?: string;
    amount_due?: number;
    days_overdue?: number;
    title: string;
    message: string;
  }>;
  stalledApplicants: Array<{
    id: string;
    type: string;
    applicant_id: string;
    student_name: string;
    stage: string;
    daysInStage: number;
    title: string;
    message: string;
  }>;
  upcomingAssessments: Array<{
    id: string;
    type: string;
    applicant_id: string;
    student_name: string;
    grade?: string;
    scheduled_at: string;
    interviewer?: string;
    assessment_type?: string;
    title: string;
    message: string;
  }>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenNewApplicant,
  onOpenNewIncome,
  onOpenNewExpense,
}) => {
  const { activeStaff, isReadOnly } = useStaff();
  const [data, setData] = useState<any>(null);
  const [reminders, setReminders] = useState<RemindersData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<'income' | 'expenses' | 'net' | 'outstanding'>('income');

  // Balances data for the Outstanding detail panel
  const [balances, setBalances] = useState<any[]>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState<boolean>(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/metrics').then((res) => res.json()),
      fetch('/api/reminders').then((res) => res.json()).catch(() => null),
    ])
      .then(([metrics, reminderData]) => {
        setData(metrics);
        if (reminderData) {
          setReminders(reminderData);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load dashboard data:', err);
        setIsLoading(false);
      });
  }, []);

  // Fetch balances when outstanding card is selected
  useEffect(() => {
    if (selectedCard === 'outstanding' && balances.length === 0 && !isLoadingBalances) {
      setIsLoadingBalances(true);
      fetch('/api/balances')
        .then((res) => res.json())
        .then((b) => {
          if (Array.isArray(b)) {
            setBalances(b);
          }
          setIsLoadingBalances(false);
        })
        .catch((err) => {
          console.error('Failed to load balances:', err);
          setIsLoadingBalances(false);
        });
    }
  }, [selectedCard, balances.length, isLoadingBalances]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    const staffName = activeStaff?.name ? activeStaff.name.split(' ')[0] : 'Malki';
    if (hour < 12) return `Good morning, ${staffName}.`;
    if (hour < 17) return `Good afternoon, ${staffName}.`;
    return `Good evening, ${staffName}.`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton count={4} />
        <div className="panel p-5">
          <TableSkeleton rows={6} />
        </div>
      </div>
    );
  }

  const pipelineCounts = data?.pipelineCounts || data?.funnelCounts || {
    inquiry: 1,
    applied: 1,
    documents_submitted: 1,
    accepted: 1,
    enrolled: 1,
    declined: 0,
  };

  const incomeThisWeek = data?.incomeThisWeek ?? 65000;
  const expensesThisWeek = data?.expensesThisWeek ?? 18500;
  const netMovement = data?.netMovement ?? 46500;
  const outstanding = data?.outstanding ?? data?.outstandingTotal ?? 270000;
  const currency = data?.settings?.currency_symbol || 'LKR';

  const pipelineStages: Array<{
    key: string;
    label: string;
    count: number;
  }> = [
    { key: 'inquiry', label: 'Inquiry', count: pipelineCounts.inquiry ?? 0 },
    { key: 'applied', label: 'Applied', count: pipelineCounts.applied ?? 0 },
    { key: 'documents_submitted', label: 'Documents Submitted', count: pipelineCounts.documents_submitted ?? 0 },
    { key: 'accepted', label: 'Accepted', count: pipelineCounts.accepted ?? 0 },
    { key: 'enrolled', label: 'Enrolled', count: pipelineCounts.enrolled ?? 0 },
    { key: 'declined', label: 'Declined', count: pipelineCounts.declined ?? 0 },
  ];

  const maxStageCount = Math.max(...pipelineStages.map((s) => s.count), 1);

  // Prepare reminders list
  const reminderItems: Array<{
    id: string;
    type: 'overdue' | 'stalled' | 'assessment';
    title: string;
    subtitle: string;
    applicantId?: string;
    badge?: string;
  }> = [];

  if (reminders) {
    (reminders.overdueBalances || []).forEach((item) => {
      reminderItems.push({
        id: item.id,
        type: 'overdue',
        title: item.student_name,
        subtitle: `${item.title} — ${item.grade || 'Student'}`,
        applicantId: item.applicant_id,
        badge: `${currency} ${formatCurrency(item.amount_due || 0)}`,
      });
    });
    (reminders.stalledApplicants || []).forEach((item) => {
      reminderItems.push({
        id: item.id,
        type: 'stalled',
        title: item.student_name,
        subtitle: `Stalled in ${item.stage.replace('_', ' ')} for ${item.daysInStage}d`,
        applicantId: item.applicant_id,
        badge: `${item.daysInStage}d stalled`,
      });
    });
    (reminders.upcomingAssessments || []).forEach((item) => {
      reminderItems.push({
        id: item.id,
        type: 'assessment',
        title: item.student_name,
        subtitle: `${item.assessment_type || 'Assessment'} • ${item.scheduled_at}`,
        applicantId: item.applicant_id,
        badge: item.grade || 'Upcoming',
      });
    });
  }

  // Filter non-zero balances for Outstanding panel
  const overdueBalancesList = balances.filter((b) => (b.balance || b.balanceDue || 0) > 0);

  return (
    <div className="space-y-7">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl lg:text-[38px] font-bold tracking-tight text-foreground leading-tight">
            {getGreeting()}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 font-normal">
            Here’s the office at a glance. A short list, a clear ledger, and room to do the human work.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex-shrink-0">
          <button
            onClick={() => onNavigate('admissions')}
            className="btn btn-primary text-xs py-2.5 px-4 rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            <span>Review admissions</span>
          </button>
        </div>
      </div>

      {/* 4 Selectable KPI Metric Cards / Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
        {/* Card 1: Income This Week */}
        <div
          onClick={() => setSelectedCard('income')}
          className={`border rounded-2xl p-4 sm:p-5 relative overflow-hidden transition-all duration-200 cursor-pointer ${
            selectedCard === 'income'
              ? 'bg-primary text-primary-foreground border-primary shadow-md ring-2 ring-primary/25'
              : 'bg-card border-border hover:border-primary/40 text-foreground shadow-2xs hover:shadow-xs'
          }`}
        >
          <div
            className={`text-[10px] font-mono tracking-widest uppercase font-semibold ${
              selectedCard === 'income' ? 'text-primary-foreground/80' : 'text-muted-foreground'
            }`}
          >
            INCOME THIS WEEK
          </div>
          <div
            className={`font-mono text-xl sm:text-2xl xl:text-[26px] font-bold tracking-tight my-2 sm:my-2.5 truncate ${
              selectedCard === 'income' ? 'text-primary-foreground' : 'text-foreground'
            }`}
          >
            {currency} <CountUp value={Number(incomeThisWeek)} duration={1600} />
          </div>
          <div
            className={`flex items-center gap-1 text-xs font-medium ${
              selectedCard === 'income' ? 'text-primary-foreground/90' : 'text-primary font-semibold'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Money in</span>
          </div>

          {/* Defined Visible Decorative Rings */}
          <div
            className={`w-32 h-32 rounded-full border-2 absolute -right-8 -bottom-10 pointer-events-none transition-opacity ${
              selectedCard === 'income'
                ? 'border-primary-foreground/20 bg-primary-foreground/5'
                : 'border-primary/15 dark:border-primary/25 bg-primary/5'
            }`}
          />
          <div
            className={`w-20 h-20 rounded-full border-2 absolute -right-2 -bottom-4 pointer-events-none transition-opacity ${
              selectedCard === 'income'
                ? 'border-primary-foreground/15 bg-primary-foreground/5'
                : 'border-primary/10 dark:border-primary/20 bg-primary/5'
            }`}
          />
        </div>

        {/* Card 2: Expenses This Week */}
        <div
          onClick={() => setSelectedCard('expenses')}
          className={`border rounded-2xl p-4 sm:p-5 relative overflow-hidden transition-all duration-200 cursor-pointer ${
            selectedCard === 'expenses'
              ? 'bg-primary text-primary-foreground border-primary shadow-md ring-2 ring-primary/25'
              : 'bg-card border-border hover:border-primary/40 text-foreground shadow-2xs hover:shadow-xs'
          }`}
        >
          <div
            className={`text-[10px] font-mono tracking-widest uppercase font-semibold ${
              selectedCard === 'expenses' ? 'text-primary-foreground/80' : 'text-muted-foreground'
            }`}
          >
            EXPENSES THIS WEEK
          </div>
          <div
            className={`font-mono text-xl sm:text-2xl xl:text-[26px] font-bold tracking-tight my-2 sm:my-2.5 truncate ${
              selectedCard === 'expenses' ? 'text-primary-foreground' : 'text-foreground'
            }`}
          >
            {currency} <CountUp value={Number(expensesThisWeek)} duration={1600} />
          </div>
          <div
            className={`flex items-center gap-1 text-xs font-medium ${
              selectedCard === 'expenses' ? 'text-primary-foreground/90' : 'text-muted-foreground'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Money out</span>
          </div>

          {/* Defined Visible Decorative Rings */}
          <div
            className={`w-32 h-32 rounded-full border-2 absolute -right-8 -bottom-10 pointer-events-none transition-opacity ${
              selectedCard === 'expenses'
                ? 'border-primary-foreground/20 bg-primary-foreground/5'
                : 'border-primary/15 dark:border-primary/25 bg-primary/5'
            }`}
          />
          <div
            className={`w-20 h-20 rounded-full border-2 absolute -right-2 -bottom-4 pointer-events-none transition-opacity ${
              selectedCard === 'expenses'
                ? 'border-primary-foreground/15 bg-primary-foreground/5'
                : 'border-primary/10 dark:border-primary/20 bg-primary/5'
            }`}
          />
        </div>

        {/* Card 3: Net Movement */}
        <div
          onClick={() => setSelectedCard('net')}
          className={`border rounded-2xl p-4 sm:p-5 relative overflow-hidden transition-all duration-200 cursor-pointer ${
            selectedCard === 'net'
              ? 'bg-primary text-primary-foreground border-primary shadow-md ring-2 ring-primary/25'
              : 'bg-card border-border hover:border-primary/40 text-foreground shadow-2xs hover:shadow-xs'
          }`}
        >
          <div
            className={`text-[10px] font-mono tracking-widest uppercase font-semibold ${
              selectedCard === 'net' ? 'text-primary-foreground/80' : 'text-muted-foreground'
            }`}
          >
            NET MOVEMENT
          </div>
          <div
            className={`font-mono text-xl sm:text-2xl xl:text-[26px] font-bold tracking-tight my-2 sm:my-2.5 truncate ${
              selectedCard === 'net' ? 'text-primary-foreground' : 'text-foreground'
            }`}
          >
            {currency} <CountUp value={Number(netMovement)} duration={1600} />
          </div>
          <div
            className={`text-xs font-medium ${
              selectedCard === 'net' ? 'text-primary-foreground/90' : 'text-muted-foreground'
            }`}
          >
            Since Monday
          </div>

          {/* Defined Visible Decorative Rings */}
          <div
            className={`w-32 h-32 rounded-full border-2 absolute -right-8 -bottom-10 pointer-events-none transition-opacity ${
              selectedCard === 'net'
                ? 'border-primary-foreground/20 bg-primary-foreground/5'
                : 'border-primary/15 dark:border-primary/25 bg-primary/5'
            }`}
          />
          <div
            className={`w-20 h-20 rounded-full border-2 absolute -right-2 -bottom-4 pointer-events-none transition-opacity ${
              selectedCard === 'net'
                ? 'border-primary-foreground/15 bg-primary-foreground/5'
                : 'border-primary/10 dark:border-primary/20 bg-primary/5'
            }`}
          />
        </div>

        {/* Card 4: Outstanding */}
        <div
          onClick={() => setSelectedCard('outstanding')}
          className={`border rounded-2xl p-4 sm:p-5 relative overflow-hidden transition-all duration-200 cursor-pointer ${
            selectedCard === 'outstanding'
              ? 'bg-primary text-primary-foreground border-primary shadow-md ring-2 ring-primary/25'
              : 'bg-card border-border hover:border-primary/40 text-foreground shadow-2xs hover:shadow-xs'
          }`}
        >
          <div
            className={`text-[10px] font-mono tracking-widest uppercase font-semibold ${
              selectedCard === 'outstanding' ? 'text-primary-foreground/80' : 'text-muted-foreground'
            }`}
          >
            OUTSTANDING
          </div>
          <div
            className={`font-mono text-xl sm:text-2xl xl:text-[26px] font-bold tracking-tight my-2 sm:my-2.5 truncate ${
              selectedCard === 'outstanding' ? 'text-primary-foreground' : 'text-destructive'
            }`}
          >
            {currency} <CountUp value={Number(outstanding)} duration={1600} />
          </div>
          <div
            className={`text-xs font-medium ${
              selectedCard === 'outstanding' ? 'text-primary-foreground/90' : 'text-muted-foreground'
            }`}
          >
            Across active families
          </div>

          {/* Defined Visible Decorative Rings */}
          <div
            className={`w-32 h-32 rounded-full border-2 absolute -right-8 -bottom-10 pointer-events-none transition-opacity ${
              selectedCard === 'outstanding'
                ? 'border-primary-foreground/20 bg-primary-foreground/5'
                : 'border-primary/15 dark:border-primary/25 bg-primary/5'
            }`}
          />
          <div
            className={`w-20 h-20 rounded-full border-2 absolute -right-2 -bottom-4 pointer-events-none transition-opacity ${
              selectedCard === 'outstanding'
                ? 'border-primary-foreground/15 bg-primary-foreground/5'
                : 'border-primary/10 dark:border-primary/20 bg-primary/5'
            }`}
          />
        </div>
      </div>

      {/* Interactive Card Selection Detail Panel */}
      <div className="panel p-5 bg-card border border-border rounded-2xl shadow-2xs transition-all">
        {selectedCard === 'income' && (
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-sm text-foreground">Recent Fee Collections</h3>
                <span className="text-xs text-muted-foreground font-mono">
                  ({(data?.recentIncome || []).length} recorded)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!isReadOnly && (
                  <button
                    onClick={onOpenNewIncome}
                    className="btn btn-soft text-xs py-1 px-2.5 rounded-lg border border-border flex items-center gap-1 cursor-pointer hover:bg-muted"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Record payment</span>
                  </button>
                )}
                <button
                  onClick={() => onNavigate('fees')}
                  className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>View fee ledger</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {(data?.recentIncome || []).length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No fee collections recorded recently.
              </div>
            ) : (
              <div className="space-y-2">
                {(data.recentIncome as any[]).slice(0, 5).map((item: any) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.applicant_id) {
                        onNavigate('dossier', item.applicant_id);
                      } else {
                        onNavigate('fees');
                      }
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 hover:border-primary/40 bg-muted/20 hover:bg-muted/50 cursor-pointer transition-all text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-mono font-bold text-[10px]">
                        IN
                      </div>
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <span>{item.payer_name || (item.student_first_name ? `${item.student_first_name} ${item.student_last_name}` : 'Fee Payment')}</span>
                          {item.receipt_no && (
                            <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {item.receipt_no}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {item.source} • {item.payment_method} • {item.date}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        +{currency} {formatCurrency(item.amount)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {item.received_by_staff_name || 'Staff'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedCard === 'expenses' && (
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-500" />
                <h3 className="font-bold text-sm text-foreground">Recent Office Expenses</h3>
                <span className="text-xs text-muted-foreground font-mono">
                  ({(data?.recentExpenses || []).length} recorded)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenNewExpense}
                  className="btn btn-soft text-xs py-1 px-2.5 rounded-lg border border-border flex items-center gap-1 cursor-pointer hover:bg-muted"
                >
                  <Plus className="w-3 h-3" />
                  <span>Record expense</span>
                </button>
                <button
                  onClick={() => onNavigate('cashflow')}
                  className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>View cash flow</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {(data?.recentExpenses || []).length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No expenses recorded recently.
              </div>
            ) : (
              <div className="space-y-2">
                {(data.recentExpenses as any[]).slice(0, 5).map((item: any) => (
                  <div
                    key={item.id}
                    onClick={() => onNavigate('cashflow')}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 hover:border-primary/40 bg-muted/20 hover:bg-muted/50 cursor-pointer transition-all text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-mono font-bold text-[10px]">
                        OUT
                      </div>
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <span>{item.paid_to}</span>
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium">
                            {item.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {item.payment_method} • {item.date} {item.notes ? `• ${item.notes}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-destructive">
                        -{currency} {formatCurrency(item.amount)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {item.recorded_by_staff_name || 'Staff'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedCard === 'net' && (
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm text-foreground">Recent Ledger Activity</h3>
                <span className="text-xs text-muted-foreground font-mono">
                  (Inflows & Outflows)
                </span>
              </div>
              <button
                onClick={() => onNavigate('cashflow')}
                className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Full cash flow statement</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {(data?.recentLedger || []).length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No recent transactions in the ledger.
              </div>
            ) : (
              <div className="space-y-2">
                {(data.recentLedger as any[]).slice(0, 5).map((item: any) => {
                  const isIncome = item.type === 'income';
                  return (
                    <div
                      key={item.id}
                      onClick={() => onNavigate(isIncome ? 'fees' : 'cashflow')}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 hover:border-primary/40 bg-muted/20 hover:bg-muted/50 cursor-pointer transition-all text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-[10px] ${
                            isIncome
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isIncome ? 'IN' : 'OUT'}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground flex items-center gap-2">
                            <span>{item.party}</span>
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium">
                              {item.category}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {item.payment_method} • {item.date}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`font-mono font-bold ${
                            isIncome
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-destructive'
                          }`}
                        >
                          {isIncome ? '+' : '-'}{currency} {formatCurrency(item.amount)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selectedCard === 'outstanding' && (
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-sm text-foreground">Outstanding Family Balances</h3>
                <span className="text-xs text-muted-foreground font-mono">
                  ({overdueBalancesList.length} families with dues)
                </span>
              </div>
              <button
                onClick={() => onNavigate('balances')}
                className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>View all balances & aging</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {isLoadingBalances ? (
              <div className="py-2">
                <TableSkeleton rows={4} />
              </div>
            ) : overdueBalancesList.length === 0 ? (
              <EmptyState
                iconType="balance"
                title="All Accounts Settled"
                description="No active outstanding balances found. All accounts are settled!"
              />
            ) : (
              <div className="space-y-2">
                {overdueBalancesList.slice(0, 5).map((item: any) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.id) {
                        onNavigate('dossier', item.id);
                      } else {
                        onNavigate('balances');
                      }
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 hover:border-primary/40 bg-muted/20 hover:bg-muted/50 cursor-pointer transition-all text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-mono font-bold text-[10px]">
                        DUE
                      </div>
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <span>{item.student_name || `${item.first_name} ${item.last_name}`}</span>
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium">
                            {item.grade_applying}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Guardian: {item.guardian_name} {item.guardian_phone ? `(${item.guardian_phone})` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-destructive">
                        {currency} {formatCurrency(item.balance || item.balanceDue)}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center justify-end gap-1">
                        <span>Open dossier</span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Monthly Revenue vs. Expenses Line Chart */}
      <MonthlyRevenueExpensesChart
        data={data?.monthlyFinancials || data?.monthlyTrends || []}
        currency={currency}
        onNavigate={onNavigate}
        onOpenNewIncome={!isReadOnly ? onOpenNewIncome : undefined}
        onOpenNewExpense={!isReadOnly ? onOpenNewExpense : undefined}
      />

      {/* Two Lower Columns: Admissions Pulse & Office Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Admissions Pulse */}
        <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="eyebrow">
                Admissions Pulse
              </div>
              <h2 className="text-xl font-bold text-foreground mt-0.5">
                Where applications stand
              </h2>
            </div>
            <button
              onClick={() => onNavigate('admissions')}
              className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5 cursor-pointer bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/15"
            >
              <span>View admissions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Funnel Progress Rows */}
          <div className="space-y-4 pt-1">
            {pipelineStages.map((stage) => {
              const widthRatio = maxStageCount > 0 ? (stage.count / maxStageCount) * 100 : 0;
              const widthPercent = `${Math.max(widthRatio, stage.count > 0 ? 5 : 0)}%`;

              return (
                <div
                  key={stage.label}
                  onClick={() => onNavigate('admissions', stage.key)}
                  className="group cursor-pointer p-1.5 -mx-1.5 rounded-xl hover:bg-muted/40 transition-all"
                  title={`View ${stage.label} applicants in Admissions`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-foreground font-medium group-hover:text-primary transition-colors flex items-center gap-1.5">
                      <span>{stage.label}</span>
                      <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                    </span>
                    <span className="font-mono text-muted-foreground group-hover:text-foreground font-semibold">
                      {stage.count}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500 group-hover:brightness-110"
                      style={{ width: widthPercent }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (5 cols): Needs a Look (Office Reminders) */}
        <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-6 shadow-2xs min-h-[380px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="eyebrow">
                Needs a Look
              </div>
              <h2 className="text-xl font-bold text-foreground mt-0.5">
                Office reminders
              </h2>
            </div>
            {reminderItems.length > 0 && (
              <button
                onClick={() => onNavigate('reminders')}
                className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>View all ({reminderItems.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {reminderItems.length === 0 ? (
            /* Empty State / Clear Desk */
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-foreground/70 mb-3.5">
                <ClipboardList className="w-5 h-5 text-foreground" />
              </div>
              <h3 className="font-bold text-base text-foreground mb-1">
                A clear desk
              </h3>
              <p className="text-xs text-muted-foreground max-w-[240px] leading-relaxed">
                There’s nothing waiting on the office today.
              </p>
            </div>
          ) : (
            /* Reminders list */
            <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[340px] pr-0.5">
              {reminderItems.map((rem) => {
                const isOverdue = rem.type === 'overdue';
                const isStalled = rem.type === 'stalled';

                return (
                  <div
                    key={rem.id}
                    onClick={() => {
                      if (rem.applicantId) {
                        onNavigate('dossier', rem.applicantId);
                      } else {
                        onNavigate('reminders');
                      }
                    }}
                    className="p-3 rounded-xl border border-border/80 hover:border-primary/40 bg-card hover:bg-muted/40 cursor-pointer transition-all flex items-start justify-between gap-3 text-xs group"
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-lg shrink-0 mt-0.5 flex items-center justify-center ${
                          isOverdue
                            ? 'bg-destructive/10 text-destructive'
                            : isStalled
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        {isOverdue ? (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        ) : isStalled ? (
                          <Clock className="w-3.5 h-3.5" />
                        ) : (
                          <Calendar className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {rem.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                          {rem.subtitle}
                        </div>
                      </div>
                    </div>
                    {rem.badge && (
                      <span
                        className={`shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                          isOverdue
                            ? 'bg-destructive/10 text-destructive'
                            : isStalled
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        {rem.badge}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
