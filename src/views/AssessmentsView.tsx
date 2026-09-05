import React, { useState, useEffect } from 'react';
import { useStaff } from '../context/StaffContext';
import { useNotification } from '../context/NotificationContext';
import { Assessment, Applicant } from '../types';
import { TableSkeleton } from '../components/common/SkeletonLoader';
import { EmptyState } from '../components/common/EmptyState';
import {
  ClipboardCheck,
  Calendar,
  CheckCircle,
  Plus,
  Search,
  Filter,
  User,
  Clock,
  Award,
  AlertTriangle,
  Edit3,
  Trash2,
  X,
} from 'lucide-react';
import { ConfirmDialogModal } from '../components/modals/ConfirmDialogModal';

interface ConflictWarning {
  conflictWith: {
    id: string;
    applicant_name: string;
    assessment_type: string;
    interviewer_name: string;
    scheduled_at: string;
    duration_minutes: number;
  };
  message: string;
  payload: any;
  isEdit?: boolean;
}

const getDefaultScheduledAt = () => {
  const d = new Date(Date.now() + 86400000 * 2);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatAssessmentDateTime = (dtStr: string) => {
  if (!dtStr) return '—';
  try {
    const d = new Date(dtStr);
    if (isNaN(d.getTime())) return dtStr;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dtStr;
  }
};

export const AssessmentsView: React.FC<{ onOpenDossier: (id: string) => void }> = ({ onOpenDossier }) => {
  const { getHeaders } = useStaff();
  const { showToast } = useNotification();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal / Form state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    applicant_id: '',
    applicant_name: '',
    grade: '',
    assessment_type: 'Entrance Exam' as Assessment['assessment_type'],
    interviewer_name: 'Sophia Chen',
    scheduled_at: getDefaultScheduledAt(),
    duration_minutes: 30,
    max_score: '100',
    notes: '',
  });

  // Edit / Reschedule Modal state
  const [editAssessment, setEditAssessment] = useState<Assessment | null>(null);
  const [editForm, setEditForm] = useState({
    interviewer_name: '',
    scheduled_at: '',
    duration_minutes: 30,
    notes: '',
  });

  // Score modal state
  const [scoreModalAssessment, setScoreModalAssessment] = useState<Assessment | null>(null);
  const [scoreForm, setScoreForm] = useState({
    score: '',
    recommendation: 'Recommend Full Admission',
    notes: '',
  });

  // Deletion modal state
  const [assessmentToDelete, setAssessmentToDelete] = useState<Assessment | null>(null);
  const [isDeletingAssessment, setIsDeletingAssessment] = useState(false);

  // Conflict warning state
  const [conflictWarning, setConflictWarning] = useState<ConflictWarning | null>(null);

  const fetchAssessments = async () => {
    setIsLoading(true);
    try {
      const [assRes, appRes] = await Promise.all([
        fetch('/api/assessments'),
        fetch('/api/applicants'),
      ]);
      if (assRes.ok) {
        const data = await assRes.json();
        setAssessments(data);
      }
      if (appRes.ok) {
        const data = await appRes.json();
        setApplicants(data.applicants || []);
      }
    } catch (err) {
      console.error('Failed to load assessments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, []);

  const handleApplicantSelect = (applicantId: string) => {
    const selected = applicants.find(a => a.id === applicantId);
    setScheduleForm(prev => ({
      ...prev,
      applicant_id: applicantId,
      applicant_name: selected ? `${selected.first_name} ${selected.last_name}` : '',
      grade: selected ? selected.grade_applying : '',
    }));
  };

  const handleScheduleSubmit = async (e?: React.FormEvent, override = false) => {
    if (e) e.preventDefault();
    if (!scheduleForm.applicant_id) {
      showToast('Please select a candidate applicant', 'error');
      return;
    }

    const payload = {
      applicant_id: scheduleForm.applicant_id,
      applicant_name: scheduleForm.applicant_name,
      grade: scheduleForm.grade,
      assessment_type: scheduleForm.assessment_type,
      interviewer_name: scheduleForm.interviewer_name.trim(),
      scheduled_at: scheduleForm.scheduled_at,
      duration_minutes: Number(scheduleForm.duration_minutes) || 30,
      max_score: Number(scheduleForm.max_score) || 100,
      notes: scheduleForm.notes,
      override_conflict: override,
    };

    try {
      const res = await fetch('/api/assessments', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const data = await res.json();
        setConflictWarning({
          conflictWith: data.conflictWith,
          message: data.message,
          payload,
          isEdit: false,
        });
        return;
      }

      if (res.ok) {
        showToast(override ? 'Assessment scheduled (conflict overridden)' : 'Assessment scheduled successfully', 'success');
        setShowScheduleModal(false);
        setConflictWarning(null);
        setScheduleForm({
          applicant_id: '',
          applicant_name: '',
          grade: '',
          assessment_type: 'Entrance Exam',
          interviewer_name: 'Sophia Chen',
          scheduled_at: getDefaultScheduledAt(),
          duration_minutes: 30,
          max_score: '100',
          notes: '',
        });
        fetchAssessments();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Failed to schedule assessment', 'error');
      }
    } catch (err) {
      showToast('Failed to schedule assessment', 'error');
    }
  };

  const handleOpenEditModal = (ass: Assessment) => {
    setEditAssessment(ass);
    let schedVal = ass.scheduled_at;
    if (schedVal && schedVal.includes(' ') && !schedVal.includes('T')) {
      schedVal = schedVal.replace(' ', 'T');
    }
    if (schedVal && schedVal.length === 10) {
      schedVal = `${schedVal}T10:00`;
    }
    setEditForm({
      interviewer_name: ass.interviewer_name,
      scheduled_at: schedVal.substring(0, 16),
      duration_minutes: ass.duration_minutes || 30,
      notes: ass.notes || '',
    });
  };

  const handleEditSubmit = async (e?: React.FormEvent, override = false) => {
    if (e) e.preventDefault();
    if (!editAssessment) return;

    const payload = {
      interviewer_name: editForm.interviewer_name.trim(),
      scheduled_at: editForm.scheduled_at,
      duration_minutes: Number(editForm.duration_minutes) || 30,
      notes: editForm.notes,
      status: 'Scheduled',
      override_conflict: override,
    };

    try {
      const res = await fetch(`/api/assessments/${editAssessment.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const data = await res.json();
        setConflictWarning({
          conflictWith: data.conflictWith,
          message: data.message,
          payload,
          isEdit: true,
        });
        return;
      }

      if (res.ok) {
        showToast(override ? 'Assessment rescheduled (conflict overridden)' : 'Assessment rescheduled successfully', 'success');
        setEditAssessment(null);
        setConflictWarning(null);
        fetchAssessments();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Failed to reschedule assessment', 'error');
      }
    } catch (err) {
      showToast('Failed to reschedule assessment', 'error');
    }
  };

  const handleScoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scoreModalAssessment) return;
    try {
      const res = await fetch(`/api/assessments/${scoreModalAssessment.id}/score`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          score: Number(scoreForm.score),
          recommendation: scoreForm.recommendation,
          notes: scoreForm.notes,
        }),
      });
      if (res.ok) {
        showToast('Assessment evaluation recorded', 'success');
        setScoreModalAssessment(null);
        fetchAssessments();
      } else {
        showToast('Failed to record evaluation score', 'error');
      }
    } catch (err) {
      showToast('Failed to record score', 'error');
    }
  };

  const handleConfirmDeleteAssessment = async () => {
    if (!assessmentToDelete) return;
    setIsDeletingAssessment(true);
    try {
      const res = await fetch(`/api/assessments/${assessmentToDelete.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast(`Cancelled assessment for ${assessmentToDelete.applicant_name}`, 'success');
        setAssessmentToDelete(null);
        fetchAssessments();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Failed to cancel assessment', 'error');
      }
    } catch (err) {
      showToast('Failed to cancel assessment', 'error');
    } finally {
      setIsDeletingAssessment(false);
    }
  };

  const filtered = assessments.filter(a => {
    if (filterStatus !== 'all' && a.status.toLowerCase() !== filterStatus.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchName = (a.applicant_name || '').toLowerCase().includes(query);
      const matchInterviewer = (a.interviewer_name || '').toLowerCase().includes(query);
      const matchType = (a.assessment_type || '').toLowerCase().includes(query);
      const matchGrade = (a.grade || '').toLowerCase().includes(query);
      if (!matchName && !matchInterviewer && !matchType && !matchGrade) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border shadow-2xs">
        <div>
          <div className="eyebrow">Academic Evaluation</div>
          <h3 className="text-lg font-serif font-bold text-foreground">Admissions Assessments & Interviews</h3>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-52">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search candidate, interviewer..."
              className="input !h-8 !pl-9 !text-xs w-full"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex rounded-lg border border-input p-0.5 bg-muted/40 text-xs">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${filterStatus === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >
              All ({assessments.length})
            </button>
            <button
              onClick={() => setFilterStatus('scheduled')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${filterStatus === 'scheduled' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >
              Upcoming ({assessments.filter(a => a.status === 'Scheduled').length})
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${filterStatus === 'completed' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >
              Completed ({assessments.filter(a => a.status === 'Completed').length})
            </button>
          </div>

          <button
            onClick={() => setShowScheduleModal(true)}
            className="btn btn-primary text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule Assessment</span>
          </button>
        </div>
      </div>

      {/* Assessments List Table */}
      <div className="panel overflow-hidden border border-border shadow-2xs">
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={6} />
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="table-clean w-full">
              <thead>
                <tr>
                  <th className="w-1/4">Candidate & Grade</th>
                  <th className="w-1/4">Assessment & Evaluator</th>
                  <th className="w-1/5">Scheduled Date & Time</th>
                  <th className="w-1/5">Score & Recommendation</th>
                  <th className="text-right">Status & Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ass => (
                  <tr key={ass.id} className="hover:bg-muted/30 transition-colors">
                    <td>
                      <div
                        onClick={() => onOpenDossier(ass.applicant_id)}
                        className="font-bold text-xs text-primary hover:underline cursor-pointer"
                      >
                        {ass.applicant_name}
                      </div>
                      <div className="inline-block text-[10px] font-medium text-muted-foreground mt-0.5 px-1.5 py-0.2 rounded bg-muted">
                        {ass.grade}
                      </div>
                    </td>
                    <td>
                      <div className="text-xs font-semibold text-foreground">
                        {ass.assessment_type}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <User className="w-3 h-3 text-muted-foreground/70" />
                        <span>{ass.interviewer_name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="mono text-xs text-foreground font-medium">
                        {formatAssessmentDateTime(ass.scheduled_at)}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-muted-foreground/60" />
                        <span>{ass.duration_minutes || 30} mins</span>
                      </div>
                    </td>
                    <td>
                      {ass.score !== null ? (
                        <div className="space-y-1">
                          <div className="mono font-bold text-xs text-foreground">
                            {ass.score} / {ass.max_score}{' '}
                            <span className="text-muted-foreground font-normal">
                              ({Math.round((ass.score / ass.max_score) * 100)}%)
                            </span>
                          </div>
                          {ass.recommendation && (
                            <div className="badge badge-accepted !text-[10px] truncate max-w-[220px]">
                              {ass.recommendation}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Pending evaluation</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className={`badge ${ass.status === 'Completed' ? 'badge-accepted' : 'badge-applied'}`}>
                          {ass.status}
                        </span>
                        {ass.status !== 'Completed' ? (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(ass)}
                              className="btn btn-soft !py-1 !px-2 text-xs flex items-center gap-1"
                              title="Reschedule / Edit details"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span className="hidden sm:inline">Reschedule</span>
                            </button>
                            <button
                              onClick={() => {
                                setScoreModalAssessment(ass);
                                setScoreForm({
                                  score: '',
                                  recommendation: 'Recommend Full Admission',
                                  notes: ass.notes || '',
                                });
                              }}
                              className="btn btn-primary !py-1 !px-2.5 text-xs"
                            >
                              Score
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => onOpenDossier(ass.applicant_id)}
                            className="btn btn-soft !py-1 !px-2.5 text-xs"
                          >
                            Dossier
                          </button>
                        )}
                        <button
                          onClick={() => setAssessmentToDelete(ass)}
                          className="btn btn-ghost !py-1 !px-2 text-xs text-destructive hover:bg-destructive/10 inline-flex items-center justify-center gap-1 rounded-md leading-none"
                          title="Cancel / Delete Assessment"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span className="hidden sm:inline">Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4">
                      <EmptyState
                        iconType="documents"
                        title="No Assessments Found"
                        description="No scheduled assessments or candidate interviews match your search criteria."
                        actionLabel="Schedule Assessment"
                        onAction={() => setShowScheduleModal(true)}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schedule Assessment Modal */}
      {showScheduleModal && (
        <div className="modal-backdrop" onClick={() => setShowScheduleModal(false)}>
          <div className="modal !max-w-md" onClick={e => e.stopPropagation()}>
            <div className="eyebrow">Academic Placement</div>
            <h3 className="text-lg font-serif font-bold text-foreground mb-4">Schedule Candidate Assessment</h3>

            <form onSubmit={e => handleScheduleSubmit(e, false)} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Select Candidate *</label>
                <select
                  required
                  className="select"
                  value={scheduleForm.applicant_id}
                  onChange={e => handleApplicantSelect(e.target.value)}
                >
                  <option value="">-- Choose student candidate --</option>
                  {applicants.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.first_name} {a.last_name} ({a.application_no} • {a.grade_applying})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Assessment Type</label>
                <select
                  className="select"
                  value={scheduleForm.assessment_type}
                  onChange={e => setScheduleForm({ ...scheduleForm, assessment_type: e.target.value as any })}
                >
                  <option value="Entrance Exam">Entrance Exam (Math & English)</option>
                  <option value="Parent Interview">Parent & Family Interview</option>
                  <option value="Faculty Placement">Faculty Placement Assessment</option>
                  <option value="Diagnostic Assessment">Diagnostic & Special Needs Assessment</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Interviewer / Faculty Lead *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sophia Chen"
                  className="input"
                  value={scheduleForm.interviewer_name}
                  onChange={e => setScheduleForm({ ...scheduleForm, interviewer_name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    className="input text-xs"
                    value={scheduleForm.scheduled_at}
                    onChange={e => setScheduleForm({ ...scheduleForm, scheduled_at: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Duration (mins)</label>
                  <select
                    className="select text-xs"
                    value={scheduleForm.duration_minutes}
                    onChange={e => setScheduleForm({ ...scheduleForm, duration_minutes: Number(e.target.value) })}
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes (1 hr)</option>
                    <option value={90}>90 minutes (1.5 hrs)</option>
                    <option value={120}>120 minutes (2 hrs)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Max Score</label>
                <input
                  type="number"
                  required
                  className="input"
                  value={scheduleForm.max_score}
                  onChange={e => setScheduleForm({ ...scheduleForm, max_score: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Scheduling / Prep Notes</label>
                <textarea
                  className="textarea !h-16"
                  placeholder="Classroom room number, special materials required..."
                  value={scheduleForm.notes}
                  onChange={e => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="btn btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary text-xs">
                  Schedule Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit / Reschedule Modal */}
      {editAssessment && (
        <div className="modal-backdrop" onClick={() => setEditAssessment(null)}>
          <div className="modal !max-w-md" onClick={e => e.stopPropagation()}>
            <div className="eyebrow">Academic Placement</div>
            <h3 className="text-lg font-serif font-bold text-foreground mb-1">
              Reschedule: {editAssessment.applicant_name}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {editAssessment.assessment_type} ({editAssessment.grade})
            </p>

            <form onSubmit={e => handleEditSubmit(e, false)} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Interviewer / Faculty Lead *</label>
                <input
                  type="text"
                  required
                  className="input"
                  value={editForm.interviewer_name}
                  onChange={e => setEditForm({ ...editForm, interviewer_name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">New Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    className="input text-xs"
                    value={editForm.scheduled_at}
                    onChange={e => setEditForm({ ...editForm, scheduled_at: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Duration (mins)</label>
                  <select
                    className="select text-xs"
                    value={editForm.duration_minutes}
                    onChange={e => setEditForm({ ...editForm, duration_minutes: Number(e.target.value) })}
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                    <option value={90}>90 minutes</option>
                    <option value={120}>120 minutes</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Notes</label>
                <textarea
                  className="textarea !h-16"
                  value={editForm.notes}
                  onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditAssessment(null)}
                  className="btn btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary text-xs">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Score Modal */}
      {scoreModalAssessment && (
        <div className="modal-backdrop" onClick={() => setScoreModalAssessment(null)}>
          <div className="modal !max-w-md" onClick={e => e.stopPropagation()}>
            <div className="eyebrow">Evaluation Results</div>
            <h3 className="text-lg font-serif font-bold text-foreground mb-1">
              Record Score: {scoreModalAssessment.applicant_name}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {scoreModalAssessment.assessment_type} ({scoreModalAssessment.grade})
            </p>

            <form onSubmit={handleScoreSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Score Attained (out of {scoreModalAssessment.max_score}) *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max={scoreModalAssessment.max_score}
                  required
                  className="input font-mono font-bold text-base"
                  value={scoreForm.score}
                  onChange={e => setScoreForm({ ...scoreForm, score: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Admissions Recommendation *</label>
                <select
                  className="select"
                  value={scoreForm.recommendation}
                  onChange={e => setScoreForm({ ...scoreForm, recommendation: e.target.value })}
                >
                  <option value="Recommend Full Admission">Recommend Full Admission</option>
                  <option value="Conditional">Conditional on Academic Support</option>
                  <option value="Needs Learning Support Review">Needs Learning Support Review</option>
                  <option value="Placement on Waitlist">Placement on Waitlist</option>
                  <option value="Under Review by Academic Council">Under Review by Academic Council</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Faculty Evaluator Notes</label>
                <textarea
                  className="textarea !h-20"
                  placeholder="Strong analytical ability, recommended for accelerated mathematics..."
                  value={scoreForm.notes}
                  onChange={e => setScoreForm({ ...scoreForm, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setScoreModalAssessment(null)}
                  className="btn btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary text-xs">
                  Save & Complete Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Conflict Warning Modal with Override */}
      {conflictWarning && (
        <div className="modal-backdrop !z-60" onClick={() => setConflictWarning(null)}>
          <div className="modal !max-w-md border-amber-500/50 shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <div className="text-xs font-bold uppercase tracking-wider">Scheduling Overlap Detected</div>
            </div>

            <h3 className="text-base font-serif font-bold text-foreground mb-2">
              Interview Conflict Warning
            </h3>

            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs space-y-2 mb-4">
              <p className="text-foreground font-medium">
                <strong>{conflictWarning.conflictWith.interviewer_name}</strong> already has{' '}
                <strong className="text-primary">{conflictWarning.conflictWith.assessment_type}</strong> scheduled with{' '}
                <strong>{conflictWarning.conflictWith.applicant_name}</strong>.
              </p>
              <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t border-amber-500/20">
                <div>
                  <span className="font-semibold text-foreground">Time:</span>{' '}
                  {formatAssessmentDateTime(conflictWarning.conflictWith.scheduled_at)}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Duration:</span>{' '}
                  {conflictWarning.conflictWith.duration_minutes || 30} minutes
                </div>
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                This time window directly overlaps with the appointment you are trying to schedule.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConflictWarning(null)}
                className="btn btn-soft text-xs"
              >
                Change Time
              </button>
              <button
                type="button"
                onClick={() => {
                  if (conflictWarning.isEdit) {
                    handleEditSubmit(undefined, true);
                  } else {
                    handleScheduleSubmit(undefined, true);
                  }
                }}
                className="btn btn-primary text-xs bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
              >
                Schedule Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel / Delete Assessment Confirmation Modal */}
      <ConfirmDialogModal
        isOpen={!!assessmentToDelete}
        onClose={() => setAssessmentToDelete(null)}
        onConfirm={handleConfirmDeleteAssessment}
        title="Cancel Assessment Appointment"
        message={`Are you sure you want to permanently delete or cancel the assessment for ${assessmentToDelete?.applicant_name}?`}
        confirmText="Delete Assessment"
        variant="danger"
        isConfirming={isDeletingAssessment}
        warningDetails={[
          `Candidate: ${assessmentToDelete?.applicant_name} (${assessmentToDelete?.grade})`,
          `Assessment: ${assessmentToDelete?.assessment_type} with ${assessmentToDelete?.interviewer_name}`,
          `Scheduled Window: ${formatAssessmentDateTime(assessmentToDelete?.scheduled_at || '')} (${assessmentToDelete?.duration_minutes || 30} mins)`,
          assessmentToDelete?.status === 'Completed' ? `Evaluation: Completed (Score: ${assessmentToDelete.score}/${assessmentToDelete.max_score})` : 'Status: Scheduled / Pending evaluation',
          'The assessment appointment will be permanently removed from the testing calendar.',
          'This cancellation is recorded in the administrative staff audit trail.',
        ]}
      />
    </div>
  );
};
