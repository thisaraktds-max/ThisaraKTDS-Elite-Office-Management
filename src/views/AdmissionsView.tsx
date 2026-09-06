import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStaff } from '../context/StaffContext';
import { useNotification } from '../context/NotificationContext';
import { Applicant, AdmissionStatus } from '../types';
import { soundManager } from '../components/common/AudioFeedback';
import { ConfirmDialogModal } from '../components/modals/ConfirmDialogModal';
import { TableSkeleton, CardSkeleton } from '../components/common/SkeletonLoader';
import { EmptyState } from '../components/common/EmptyState';
import {
  Kanban,
  Table as TableIcon,
  LayoutGrid,
  Search,
  Filter,
  UserPlus,
  ArrowRight,
  Phone,
  Mail,
  Calendar,
  FileText,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  Download,
  CheckSquare,
  Square,
  Sparkles,
  Check,
  FileSpreadsheet,
  Send,
} from 'lucide-react';

interface AdmissionsViewProps {
  onOpenDossier: (applicantId: string) => void;
  onOpenNewApplicant: () => void;
  onOpenBulkImport?: () => void;
  initialStatusFilter?: string;
}

type SortField = 'application_no' | 'name' | 'grade_applying' | 'status' | 'guardian_name' | 'created_at';
type SortDirection = 'asc' | 'desc';

export const AdmissionsView: React.FC<AdmissionsViewProps> = ({
  onOpenDossier,
  onOpenNewApplicant,
  onOpenBulkImport,
  initialStatusFilter,
}) => {
  const { getHeaders, isReadOnly } = useStaff();
  const { showToast, showUndoToast } = useNotification();

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Filters & View state
  const [viewMode, setViewMode] = useState<'kanban' | 'table' | 'grid'>('kanban');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter || 'all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [showBulkCommModal, setShowBulkCommModal] = useState(false);
  const [bulkCommForm, setBulkCommForm] = useState({
    contact_type: 'Email Notice',
    summary: '',
  });
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const fetchApplicants = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (gradeFilter !== 'all') params.append('grade', gradeFilter);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`/api/applicants?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setApplicants(data.applicants || []);
        setCounts(data.counts || {});
      }
    } catch (err) {
      console.error('Failed to load applicants:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApplicants();
  }, [statusFilter, gradeFilter, searchQuery]);

  const handleUpdateStatus = async (
    applicantId: string,
    newStatus: AdmissionStatus,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/applicants/${applicantId}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        if (newStatus === 'enrolled') {
          soundManager.playSuccessChime();
        }
        showToast(`Applicant stage moved to ${newStatus.replace('_', ' ')}`, 'success');
        fetchApplicants();
      }
    } catch (err) {
      showToast('Failed to update stage', 'error');
    }
  };

  // Bulk Status Update using single-batch optimized endpoint
  const handleBulkStatusChange = async (targetStatus: AdmissionStatus) => {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch('/api/applicants/bulk-status', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          status: targetStatus,
        }),
      });
      if (res.ok) {
        soundManager.playSuccessChime();
        showToast(
          `Updated ${selectedIds.size} applicant(s) to ${targetStatus.replace('_', ' ')}`,
          'success'
        );
        setSelectedIds(new Set());
        setShowBulkStatusModal(false);
        fetchApplicants();
      } else {
        showToast('Failed to update applicants in bulk', 'error');
      }
    } catch (err) {
      showToast('Failed to update applicants in bulk', 'error');
    }
  };

  // Bulk Communication Broadcast
  const handleBulkCommunication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.size === 0 || !bulkCommForm.summary.trim()) return;
    try {
      const res = await fetch('/api/applicants/bulk-communications', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          applicant_ids: Array.from(selectedIds),
          contact_type: bulkCommForm.contact_type,
          summary: bulkCommForm.summary,
        }),
      });
      if (res.ok) {
        showToast(`Logged communication for ${selectedIds.size} applicant(s)`, 'success');
        setBulkCommForm({ contact_type: 'Email Notice', summary: '' });
        setShowBulkCommModal(false);
        setSelectedIds(new Set());
      } else {
        showToast('Failed to broadcast bulk communication', 'error');
      }
    } catch (err) {
      showToast('Failed to broadcast bulk communication', 'error');
    }
  };

  // Bulk Delete with Undo
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const targetIds = Array.from(selectedIds);
    const count = targetIds.length;
    const backupApplicants = applicants.filter((a) => selectedIds.has(a.id));

    try {
      const promises = targetIds.map((id) =>
        fetch(`/api/applicants/${id}`, {
          method: 'DELETE',
          headers: getHeaders(),
        })
      );
      await Promise.all(promises);

      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      fetchApplicants();

      showUndoToast(
        `Removed ${count} applicant record${count > 1 ? 's' : ''}`,
        async () => {
          // Undo restoration
          for (const item of backupApplicants) {
            await fetch('/api/applicants', {
              method: 'POST',
              headers: getHeaders(),
              body: JSON.stringify(item),
            });
          }
          fetchApplicants();
          showToast(`Restored ${count} applicant records`, 'success');
        }
      );
    } catch (err) {
      showToast('Failed to delete selected applicants', 'error');
    }
  };

  // Export CSV
  const handleExportSelectedCSV = () => {
    const targetList =
      selectedIds.size > 0
        ? applicants.filter((a) => selectedIds.has(a.id))
        : applicants;

    if (targetList.length === 0) {
      showToast('No records to export', 'error');
      return;
    }

    const headers = [
      'Application No',
      'First Name',
      'Last Name',
      'Grade',
      'Status',
      'Date of Birth',
      'Gender',
      'Guardian Name',
      'Guardian Phone',
      'Guardian Email',
      'Address',
      'Registered Date',
    ];

    const rows = targetList.map((a) => [
      a.application_no,
      `"${a.first_name}"`,
      `"${a.last_name}"`,
      `"${a.grade_applying}"`,
      `"${a.status}"`,
      a.dob,
      a.gender,
      `"${a.guardian_name}"`,
      `"${a.guardian_phone}"`,
      `"${a.guardian_email || ''}"`,
      `"${(a.address || '').replace(/"/g, '""')}"`,
      a.created_at,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `admissions_export_${new Date().toISOString().substring(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported ${targetList.length} applicant records as CSV`, 'success');
  };

  // Toggle selection
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
    if (selectedIds.size === applicants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(applicants.map((a) => a.id)));
    }
  };

  // Sorting helper
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Sorted list memo
  const sortedApplicants = useMemo(() => {
    return [...applicants].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (sortField === 'name') {
        valA = `${a.first_name} ${a.last_name}`.toLowerCase();
        valB = `${b.first_name} ${b.last_name}`.toLowerCase();
      } else if (sortField === 'application_no') {
        valA = a.application_no.toLowerCase();
        valB = b.application_no.toLowerCase();
      } else if (sortField === 'grade_applying') {
        valA = a.grade_applying;
        valB = b.grade_applying;
      } else if (sortField === 'status') {
        valA = a.status;
        valB = b.status;
      } else if (sortField === 'guardian_name') {
        valA = (a.guardian_name || '').toLowerCase();
        valB = (b.guardian_name || '').toLowerCase();
      } else {
        valA = a.created_at;
        valB = b.created_at;
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [applicants, sortField, sortDir]);

  const stages: Array<{
    id: AdmissionStatus;
    title: string;
    color: string;
    next?: AdmissionStatus;
  }> = [
    { id: 'inquiry', title: 'Inquiry', color: 'bg-slate-400', next: 'applied' },
    { id: 'applied', title: 'Applied', color: 'bg-sky-500', next: 'documents_submitted' },
    { id: 'documents_submitted', title: 'Docs Submitted', color: 'bg-indigo-500', next: 'accepted' },
    { id: 'accepted', title: 'Accepted', color: 'bg-teal-600', next: 'enrolled' },
    { id: 'enrolled', title: 'Enrolled', color: 'bg-emerald-500', next: undefined },
  ];

  // Conversion calculations
  const totalInquiries = counts.inquiry || 0;
  const totalApplied = counts.applied || 0;
  const totalAccepted = counts.accepted || 0;
  const totalEnrolled = counts.enrolled || 0;
  const totalAll = counts.all || 0;

  const appConversion =
    totalInquiries > 0 ? Math.round((totalApplied / totalInquiries) * 100) : 0;
  const enrollConversion =
    totalAccepted > 0 ? Math.round((totalEnrolled / totalAccepted) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Top Banner: Conversion Analytics & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border">
        {/* Left: Conversion Funnel Stat Badges */}
        <div className="flex flex-wrap items-center gap-6 sm:gap-8">
          <div>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Total Pipeline
            </div>
            <div className="text-xl font-bold font-mono text-foreground mt-0.5">
              {totalAll}{' '}
              <span className="text-xs font-normal text-muted-foreground">Active</span>
            </div>
          </div>
          <div className="hidden sm:block w-px h-8 bg-border"></div>
          <div>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Application Rate
            </div>
            <div className="text-xl font-bold font-mono text-primary mt-0.5">
              {appConversion}%
            </div>
          </div>
          <div className="hidden sm:block w-px h-8 bg-border"></div>
          <div>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Enrollment Yield
            </div>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
              {enrollConversion}%
            </div>
          </div>
        </div>

        {/* Right: View Modes & Register Button */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <div className="flex rounded-lg border border-border p-1 bg-muted/40 text-xs">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 transition-all ${
                viewMode === 'kanban'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Kanban Board View"
            >
              <Kanban className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 transition-all ${
                viewMode === 'table'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Table</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 transition-all ${
                viewMode === 'grid'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Grid</span>
            </button>
          </div>

          {!isReadOnly && (
            <>
              {onOpenBulkImport && (
                <button
                  onClick={onOpenBulkImport}
                  className="btn btn-soft text-xs py-2 px-3 flex items-center gap-1.5 rounded-lg border border-border hover:bg-muted cursor-pointer"
                  title="Bulk Import Existing Students via CSV or Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline">Import CSV/Excel</span>
                </button>
              )}

              <button
                onClick={onOpenNewApplicant}
                className="btn btn-primary text-xs py-2 px-3 flex items-center gap-1.5 rounded-lg cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register Applicant</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
              statusFilter === 'all'
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            All Stages ({counts.all || 0})
          </button>
          {stages.map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 ${
                statusFilter === st.id
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${st.color}`}></span>
              <span>{st.title}</span>
              <span className="font-mono text-[10px] opacity-70">({counts[st.id] || 0})</span>
            </button>
          ))}
          <button
            onClick={() => setStatusFilter('declined')}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
              statusFilter === 'declined'
                ? 'bg-destructive text-destructive-foreground font-semibold'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Declined ({counts.declined || 0})
          </button>
        </div>

        {/* Right: Grade selector & search */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            className="select !h-9 !py-0 !text-xs !w-36"
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
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

          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search applicant..."
              className="input !h-9 !pl-10 !pr-8 !text-xs w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && !isReadOnly && (
        <div className="p-3 bg-primary text-primary-foreground rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 animate-fade">
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-mono text-[11px]">
              {selectedIds.size}
            </span>
            <span>applicant{selectedIds.size > 1 ? 's' : ''} selected</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setShowBulkStatusModal(true)}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Change Stage</span>
            </button>
            <button
              onClick={() => setShowBulkCommModal(true)}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Broadcast Notice</span>
            </button>
            <button
              onClick={handleExportSelectedCSV}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="px-3 py-1.5 rounded-lg bg-destructive/80 hover:bg-destructive text-white transition-all font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
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

      {/* Main View Area */}
      {isLoading ? (
        <div className="p-4">
          <TableSkeleton rows={8} />
        </div>
      ) : viewMode === 'kanban' ? (
        /* KANBAN PIPELINE VIEW */
        <div className="overflow-x-auto pb-4 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-5 min-w-[860px] xl:min-w-0 gap-3.5 items-start">
            {stages.map((stage) => {
              const columnApplicants = applicants.filter((a) => a.status === stage.id);
              return (
                <div
                  key={stage.id}
                  className="bg-muted/30 rounded-xl border border-border p-3 flex flex-col min-h-[500px]"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${stage.color}`}></span>
                      <span className="font-bold text-xs text-foreground uppercase tracking-wider">
                        {stage.title}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-card border border-border text-muted-foreground">
                      {columnApplicants.length}
                    </span>
                  </div>

                  {/* Column Cards */}
                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-320px)] pr-0.5">
                    {columnApplicants.map((app) => (
                      <div
                        key={app.id}
                        onClick={() => onOpenDossier(app.id)}
                        className="p-3.5 bg-card rounded-xl border border-border shadow-2xs hover:border-primary/50 hover:shadow-xs cursor-pointer transition-all group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                            {app.first_name} {app.last_name}
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                            {app.application_no}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] mb-2.5">
                          <span className="font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground text-[10px]">
                            {app.grade_applying}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {app.academic_year}
                          </span>
                        </div>

                        <div className="text-[11px] text-muted-foreground border-t border-border pt-2 space-y-0.5">
                          <div className="truncate text-foreground font-medium">
                            {app.guardian_name}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {app.guardian_phone}
                          </div>
                        </div>

                        {/* Quick Advance Button */}
                        {stage.next && !isReadOnly && (
                          <div className="mt-2.5 pt-2 border-t border-border flex justify-end">
                            <button
                              onClick={(e) => handleUpdateStatus(app.id, stage.next!, e)}
                              className="text-[10px] font-semibold text-primary hover:text-primary-foreground hover:bg-primary flex items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-md transition-colors"
                            >
                              <span>Advance Stage</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {columnApplicants.length === 0 && (
                      <div className="py-8 text-center text-xs text-muted-foreground/60 italic">
                        No candidates in this stage
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* SORTABLE TABLE VIEW WITH STICKY HEADERS & BULK CHECKBOXES */
        <div className="panel overflow-hidden border border-border">
          <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
            <table className="table-clean w-full">
              <thead className="sticky top-0 bg-card/95 backdrop-blur-xs z-10 shadow-2xs">
                <tr>
                  <th className="w-10 text-center">
                    <button
                      onClick={handleToggleSelectAll}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {selectedIds.size > 0 && selectedIds.size === applicants.length ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th
                    className="cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort('application_no')}
                  >
                    <div className="flex items-center gap-1">
                      <span>App #</span>
                      {sortField === 'application_no' ? (
                        sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>
                  <th
                    className="cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Candidate Name</span>
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
                  <th
                    className="cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Stage / Status</span>
                      {sortField === 'status' ? (
                        sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>
                  <th
                    className="cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort('guardian_name')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Primary Guardian</span>
                      {sortField === 'guardian_name' ? (
                        sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>
                  <th>Contact Info</th>
                  <th
                    className="cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Registered</span>
                      {sortField === 'created_at' ? (
                        sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedApplicants.map((app) => {
                  const isSelected = selectedIds.has(app.id);
                  return (
                    <tr
                      key={app.id}
                      onClick={() => onOpenDossier(app.id)}
                      className={`hover:bg-muted/40 cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      <td className="text-center" onClick={(e) => handleToggleSelect(app.id, e)}>
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-primary mx-auto" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground mx-auto" />
                        )}
                      </td>
                      <td className="font-mono font-semibold text-xs text-primary">
                        {app.application_no}
                      </td>
                      <td>
                        <div className="font-semibold text-xs text-foreground">
                          {app.first_name} {app.last_name}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {app.gender} • DOB: {app.dob}
                        </div>
                      </td>
                      <td className="text-xs font-medium">{app.grade_applying}</td>
                      <td>
                        <span className={`badge badge-${app.status} whitespace-nowrap`}>
                          {app.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <div className="text-xs font-medium text-foreground">{app.guardian_name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {app.guardian_relationship}
                        </div>
                      </td>
                      <td className="text-xs text-muted-foreground">
                        <div className="font-mono">{app.guardian_phone}</div>
                        {app.guardian_email && <div className="text-[10px]">{app.guardian_email}</div>}
                      </td>
                      <td className="text-xs text-muted-foreground font-mono">
                        {app.created_at.substring(0, 10)}
                      </td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onOpenDossier(app.id)}
                          className="btn btn-soft !py-1 !px-2.5 text-xs rounded-md"
                        >
                          Open Dossier
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {sortedApplicants.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-4">
                      <EmptyState
                        iconType="applicants"
                        title="No Applicants Found"
                        description="No matching student applications found for the selected filters."
                        actionLabel={!isReadOnly ? "Register Applicant" : undefined}
                        onAction={!isReadOnly ? onOpenNewApplicant : undefined}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARD GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sortedApplicants.map((app) => {
            const isSelected = selectedIds.has(app.id);
            return (
              <div
                key={app.id}
                onClick={() => onOpenDossier(app.id)}
                className={`card-elevated p-4 cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected ? 'border-primary ring-1 ring-primary' : 'hover:border-accent/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`badge badge-${app.status} whitespace-nowrap`}>
                      {app.status.replace('_', ' ')}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground font-semibold">
                      {app.application_no}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-foreground mb-0.5">
                    {app.first_name} {app.last_name}
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    {app.grade_applying} • {app.academic_year}
                  </p>

                  <div className="p-2.5 rounded-lg bg-muted/40 text-xs space-y-1 mb-3">
                    <div className="text-muted-foreground">
                      Guardian:{' '}
                      <span className="font-medium text-foreground">{app.guardian_name}</span>
                    </div>
                    <div className="text-muted-foreground">
                      Phone:{' '}
                      <span className="font-mono text-foreground">{app.guardian_phone}</span>
                    </div>
                    {app.household_name && (
                      <div className="text-muted-foreground">
                        Household:{' '}
                        <span className="font-medium text-foreground">{app.household_name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {app.created_at.substring(0, 10)}
                  </span>
                  <span className="font-semibold text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <span>View Dossier</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
          {sortedApplicants.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                iconType="applicants"
                title="No Applicants Found"
                description="No matching student applications found for the selected filters."
                actionLabel={!isReadOnly ? "Register Applicant" : undefined}
                onAction={!isReadOnly ? onOpenNewApplicant : undefined}
              />
            </div>
          )}
        </div>
      )}

      {/* Bulk Status Change Modal */}
      {showBulkStatusModal && createPortal(
        <div
          className="modal-backdrop"
          onClick={() => setShowBulkStatusModal(false)}
        >
          <div
            className="modal !max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
              <h3 className="font-serif font-bold text-base text-foreground">
                Change Stage for {selectedIds.size} Candidate(s)
              </h3>
              <button
                onClick={() => setShowBulkStatusModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Select the new funnel stage to assign to all selected applicants.
            </p>
            <div className="space-y-2">
              {stages.map((st) => (
                <button
                  key={st.id}
                  onClick={() => handleBulkStatusChange(st.id)}
                  className="w-full p-2.5 rounded-xl border border-border bg-card hover:bg-muted/40 text-left flex items-center justify-between text-xs font-semibold transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${st.color}`}></span>
                    <span>{st.title}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
              <button
                onClick={() => handleBulkStatusChange('declined')}
                className="w-full p-2.5 rounded-xl border border-border bg-card hover:bg-destructive/10 hover:border-destructive/30 text-left flex items-center justify-between text-xs font-semibold text-destructive transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-destructive"></span>
                  <span>Declined / Withdrawn</span>
                </div>
                <ChevronRight className="w-4 h-4 text-destructive" />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Communication Modal */}
      {showBulkCommModal && createPortal(
        <div
          className="modal-backdrop animate-fade"
          onClick={() => setShowBulkCommModal(false)}
        >
          <div
            className="modal !max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />
                <h3 className="font-serif font-bold text-base text-foreground">
                  Broadcast Notice to {selectedIds.size} Candidate(s)
                </h3>
              </div>
              <button
                onClick={() => setShowBulkCommModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBulkCommunication} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-foreground">Communication Medium</label>
                <select
                  className="select w-full"
                  value={bulkCommForm.contact_type}
                  onChange={(e) => setBulkCommForm({ ...bulkCommForm, contact_type: e.target.value })}
                >
                  <option value="Email Notice">Email Broadcast Notice</option>
                  <option value="SMS Alert">SMS Notification</option>
                  <option value="Placement Exam Dispatch">Assessment / Interview Invitation</option>
                  <option value="Tuition Advisory">Fee Schedule & Billing Reminder</option>
                  <option value="Document Checklist Request">Missing Document Follow-up</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-foreground">Notice Content / Summary</label>
                <textarea
                  required
                  rows={4}
                  className="textarea w-full text-xs leading-relaxed"
                  placeholder="Enter notice details to be dispatched to guardians and recorded in each applicant's communications dossier..."
                  value={bulkCommForm.summary}
                  onChange={(e) => setBulkCommForm({ ...bulkCommForm, summary: e.target.value })}
                />
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground">
                Notice will be recorded directly into the audit timeline and guardian communications log for all <strong className="text-foreground">{selectedIds.size} selected candidates</strong>.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkCommModal(false)}
                  className="btn btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispatch & Log Notice</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Delete Confirm Dialog */}
      <ConfirmDialogModal
        isOpen={showBulkDeleteConfirm}
        title={`Delete ${selectedIds.size} Applicant Record${selectedIds.size > 1 ? 's' : ''}?`}
        message="Are you sure you want to remove the selected applicant records? You will have an opportunity to undo this deletion from the notification toast."
        confirmText="Yes, Delete Records"
        variant="danger"
        onConfirm={handleBulkDelete}
        onClose={() => setShowBulkDeleteConfirm(false)}
      />
    </div>
  );
};
