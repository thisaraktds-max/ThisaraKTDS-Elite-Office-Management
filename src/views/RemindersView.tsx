import React, { useState, useEffect } from 'react';
import { TableSkeleton } from '../components/common/SkeletonLoader';
import { EmptyState } from '../components/common/EmptyState';
import { formatCurrency } from '../utils/format';
import {
  Bell,
  AlertTriangle,
  Clock,
  Calendar,
  Send,
  ArrowRight,
  Receipt,
  FileText,
  UserCheck,
} from 'lucide-react';

interface RemindersViewProps {
  onOpenDossier: (applicantId: string) => void;
  onOpenCommunications: (recipient: any) => void;
  onOpenRecordIncome: (applicantId: string, prefilledAmount?: number) => void;
}

export const RemindersView: React.FC<RemindersViewProps> = ({
  onOpenDossier,
  onOpenCommunications,
  onOpenRecordIncome,
}) => {
  const [data, setData] = useState<{
    overdueBalances: any[];
    stalledApplicants: any[];
    upcomingAssessments: any[];
  }>({ overdueBalances: [], stalledApplicants: [], upcomingAssessments: [] });
  const [settings, setSettings] = useState<any>({});
  const currency = settings.currency_symbol || 'LKR';
  const [isLoading, setIsLoading] = useState(true);

  const fetchReminders = async () => {
    setIsLoading(true);
    try {
      const [res, settingsRes] = await Promise.all([
        fetch('/api/reminders'),
        fetch('/api/settings'),
      ]);
      if (settingsRes.ok) {
        setSettings(await settingsRes.json());
      }
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.warn('Unable to load reminders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  const totalAlerts =
    (data.overdueBalances?.length || 0) +
    (data.stalledApplicants?.length || 0) +
    (data.upcomingAssessments?.length || 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-start justify-between p-4 rounded-xl bg-card border border-border">
        <div>
          <div className="eyebrow">Proactive Office Intelligence</div>
          <h3 className="text-lg font-serif font-bold text-foreground">Actionable Alerts & Reminders</h3>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="mono text-xs font-bold px-3 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20 whitespace-nowrap">
            {totalAlerts} Pending Action Items
          </span>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="panel p-5 space-y-4">
          <TableSkeleton rows={8} />
        </div>
      ) : (
        <>
          {/* Section 1: Overdue Balances & Tuition Delinquencies */}
      <div className="panel p-5 space-y-4">
        <div className="flex items-start justify-between pb-2 border-b border-border">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-sm text-foreground">Overdue Tuition & Account Balances</h4>
              <p className="text-xs text-muted-foreground">Accounts with unpaid balances past term settlement deadline</p>
            </div>
          </div>
          <span className="mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground whitespace-nowrap mt-0.5">
            {data.overdueBalances?.length || 0} overdue
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="table-clean w-full">
            <thead>
              <tr>
                <th>Student / App #</th>
                <th>Grade</th>
                <th>Guardian Contact</th>
                <th className="text-right">Outstanding Due</th>
                <th>Days Past Due</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.overdueBalances?.map((b: any) => (
                <tr key={b.id}>
                  <td>
                    <div
                      onClick={() => onOpenDossier(b.id)}
                      className="font-bold text-xs text-primary hover:underline cursor-pointer"
                    >
                      {b.first_name} {b.last_name}
                    </div>
                    <div className="mono text-[10px] text-muted-foreground">{b.application_no}</div>
                  </td>
                  <td className="text-xs font-medium">{b.grade_applying}</td>
                  <td>
                    <div className="text-xs font-medium text-foreground">{b.guardian_name}</div>
                    <div className="mono text-[10px] text-muted-foreground">{b.guardian_phone}</div>
                  </td>
                  <td className="text-right mono text-xs font-bold text-destructive">
                    {currency} {formatCurrency(b.balance)}
                  </td>
                  <td>
                    <span className="badge-pill bg-destructive text-destructive-foreground !text-[9px] font-bold whitespace-nowrap">
                      {b.daysSinceLastPayment || 45} Days Overdue
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onOpenRecordIncome(b.id, b.balance)}
                        className="btn btn-primary !py-1 !px-2 text-xs flex items-center gap-1"
                        title="Record Payment"
                      >
                        <Receipt className="w-3 h-3" />
                        <span>Settle</span>
                      </button>
                      <button
                        onClick={() => onOpenCommunications({
                          applicant_id: b.id,
                          student_name: `${b.first_name} ${b.last_name}`,
                          guardian_name: b.guardian_name,
                          guardian_phone: b.guardian_phone,
                          guardian_email: b.guardian_email,
                          grade: b.grade_applying,
                          balance_due: b.balance,
                          days_overdue: b.daysSinceLastPayment || 45,
                          contextType: 'tuition_reminder',
                        })}
                        className="btn btn-soft !py-1 !px-2 text-xs flex items-center gap-1"
                        title="Draft Guardian Notice via WhatsApp/Email"
                      >
                        <Send className="w-3 h-3 text-accent" />
                        <span>Notice</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!data.overdueBalances || data.overdueBalances.length === 0) && (
                <tr>
                  <td colSpan={6} className="p-4">
                    <EmptyState
                      iconType="balance"
                      title="No Overdue Balances"
                      description="All student fee accounts are currently settled and up to date."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Stalled Admissions Candidates (>14 Days in same funnel stage) */}
      <div className="panel p-5 space-y-4">
        <div className="flex items-start justify-between pb-2 border-b border-border">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-sm text-foreground">Stalled Pipeline Applicants (&gt;14 Days Idle)</h4>
              <p className="text-xs text-muted-foreground">Candidates requiring admissions outreach or document follow-ups</p>
            </div>
          </div>
          <span className="mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground whitespace-nowrap mt-0.5">
            {data.stalledApplicants?.length || 0} stalled
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="table-clean w-full">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Grade</th>
                <th>Current Funnel Stage</th>
                <th>Guardian Contact</th>
                <th>Stage Date</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.stalledApplicants?.map((app: any) => (
                <tr key={app.id}>
                  <td>
                    <div
                      onClick={() => onOpenDossier(app.id)}
                      className="font-bold text-xs text-primary hover:underline cursor-pointer"
                    >
                      {app.first_name} {app.last_name}
                    </div>
                    <div className="mono text-[10px] text-muted-foreground">{app.application_no}</div>
                  </td>
                  <td className="text-xs font-medium">{app.grade_applying}</td>
                  <td>
                    <span className={`badge badge-${app.status} whitespace-nowrap`}>
                      {app.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <div className="text-xs font-medium text-foreground">{app.guardian_name}</div>
                    <div className="mono text-[10px] text-muted-foreground">{app.guardian_phone}</div>
                  </td>
                  <td className="mono text-xs text-muted-foreground">{app.status_updated_at.substring(0, 10)}</td>
                  <td className="text-right">
                    <button
                      onClick={() => onOpenCommunications({
                        applicant_id: app.id,
                        student_name: `${app.first_name} ${app.last_name}`,
                        guardian_name: app.guardian_name,
                        guardian_phone: app.guardian_phone,
                        guardian_email: app.guardian_email,
                        grade: app.grade_applying,
                        contextType: app.status === 'applied' ? 'document_request' : 'general',
                      })}
                      className="btn btn-soft !py-1 !px-2.5 text-xs flex items-center gap-1.5 ml-auto"
                    >
                      <Send className="w-3 h-3 text-accent" />
                      <span>Follow-up Notice</span>
                    </button>
                  </td>
                </tr>
              ))}
              {(!data.stalledApplicants || data.stalledApplicants.length === 0) && (
                <tr>
                  <td colSpan={6} className="p-4">
                    <EmptyState
                      iconType="applicants"
                      title="No Stalled Applicants"
                      description="All candidate files in the admissions pipeline are actively progressing."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Upcoming Assessments */}
      <div className="panel p-5 space-y-4">
        <div className="flex items-start justify-between pb-2 border-b border-border">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-sm text-foreground">Upcoming Candidate Assessments</h4>
              <p className="text-xs text-muted-foreground">Entrance examinations and faculty placement interviews scheduled</p>
            </div>
          </div>
          <span className="mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground whitespace-nowrap mt-0.5">
            {data.upcomingAssessments?.length || 0} scheduled
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="table-clean w-full">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Grade</th>
                <th>Assessment Type</th>
                <th>Evaluator Panel</th>
                <th>Scheduled Date</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.upcomingAssessments?.map((ass: any) => (
                <tr key={ass.id}>
                  <td>
                    <div
                      onClick={() => onOpenDossier(ass.applicant_id)}
                      className="font-bold text-xs text-primary hover:underline cursor-pointer"
                    >
                      {ass.applicant_name}
                    </div>
                  </td>
                  <td className="text-xs font-medium">{ass.grade}</td>
                  <td>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted">
                      {ass.assessment_type}
                    </span>
                  </td>
                  <td className="text-xs text-muted-foreground">{ass.interviewer_name}</td>
                  <td className="mono text-xs font-bold text-foreground">{ass.scheduled_at}</td>
                  <td className="text-right">
                    <button
                      onClick={() => onOpenDossier(ass.applicant_id)}
                      className="btn btn-soft !py-1 !px-2.5 text-xs ml-auto"
                    >
                      Open Dossier
                    </button>
                  </td>
                </tr>
              ))}
              {(!data.upcomingAssessments || data.upcomingAssessments.length === 0) && (
                <tr>
                  <td colSpan={6} className="p-4">
                    <EmptyState
                      iconType="documents"
                      title="No Upcoming Assessments"
                      description="No upcoming candidate assessments or interviews are scheduled."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
