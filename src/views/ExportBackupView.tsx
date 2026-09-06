import React, { useState, useEffect } from 'react';
import { useStaff } from '../context/StaffContext';
import { useNotification } from '../context/NotificationContext';
import * as XLSX from 'xlsx';
import {
  DownloadCloud,
  Database,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle,
  HardDrive,
  AlertTriangle,
  History,
} from 'lucide-react';
import { TableSkeleton } from '../components/common/SkeletonLoader';
import { EmptyState } from '../components/common/EmptyState';

export const ExportBackupView: React.FC = () => {
  const { getHeaders } = useStaff();
  const { showToast } = useNotification();
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/audit-logs?limit=50');
      if (res.ok) {
        const data = await res.json();
        const logs = Array.isArray(data) ? data : data.logs || [];
        setAuditLogs(logs.filter((l: any) => l.action_type === 'backup' || l.action_type === 'restore' || l.entity_type === 'system'));
      }
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Download raw SQLite database file
  const handleDownloadSqlite = () => {
    window.location.href = '/api/backup/sqlite';
    showToast('SQLite database file download initiated', 'success');
  };

  // Multi-sheet Excel workbook export using XLSX library
  const handleExportExcelWorkbook = async () => {
    setIsExportingExcel(true);
    try {
      const [appRes, famRes, incRes, expRes, balRes, audRes] = await Promise.all([
        fetch('/api/applicants'),
        fetch('/api/families'),
        fetch('/api/income'),
        fetch('/api/expenses'),
        fetch('/api/balances'),
        fetch('/api/audit-logs'),
      ]);

      const appsData = await appRes.json();
      const famsData = await famRes.json();
      const incsData = await incRes.json();
      const expsData = await expRes.json();
      const balsData = await balRes.json();
      const audsData = await audRes.json();

      const wb = XLSX.utils.book_new();

      // Sheet 1: Applicants
      const wsApps = XLSX.utils.json_to_sheet(appsData.applicants || []);
      XLSX.utils.book_append_sheet(wb, wsApps, 'Students & Applicants');

      // Sheet 2: Families
      const wsFams = XLSX.utils.json_to_sheet(famsData || []);
      XLSX.utils.book_append_sheet(wb, wsFams, 'Families & Households');

      // Sheet 3: Income Receipts
      const wsInc = XLSX.utils.json_to_sheet(incsData || []);
      XLSX.utils.book_append_sheet(wb, wsInc, 'Income Receipts');

      // Sheet 4: Expenses
      const wsExp = XLSX.utils.json_to_sheet(expsData || []);
      XLSX.utils.book_append_sheet(wb, wsExp, 'Operating Expenses');

      // Sheet 5: Outstanding Balances
      const wsBal = XLSX.utils.json_to_sheet(balsData || []);
      XLSX.utils.book_append_sheet(wb, wsBal, 'Outstanding Balances');

      // Sheet 6: Audit Logs
      const wsAud = XLSX.utils.json_to_sheet(audsData || []);
      XLSX.utils.book_append_sheet(wb, wsAud, 'Audit Trail');

      const dateStr = new Date().toISOString().substring(0, 10);
      XLSX.writeFile(wb, `Elite_International_School_Records_${dateStr}.xlsx`);
      showToast('Excel workbook exported successfully with 6 sheets', 'success');
    } catch (err: any) {
      showToast('Failed to export Excel workbook: ' + err.message, 'error');
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Export JSON Snapshot
  const handleExportJson = async () => {
    setIsExportingJson(true);
    try {
      const res = await fetch('/api/backup/json');
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `elite_school_backup_${new Date().toISOString().substring(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('JSON snapshot backup downloaded', 'success');
      }
    } catch (err) {
      showToast('Failed to export JSON', 'error');
    } finally {
      setIsExportingJson(false);
    }
  };

  // Restore JSON Snapshot
  const handleRestoreJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Warning: Restoring a JSON backup will merge and update database records. Continue?')) {
      return;
    }

    setIsRestoring(true);
    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ backup: backupData }),
      });
      if (res.ok) {
        showToast('Database successfully restored from JSON snapshot', 'success');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        showToast('Failed to restore backup', 'error');
      }
    } catch (err) {
      showToast('Invalid backup file format', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-card border border-border">
        <div className="eyebrow">Local Office PC Storage</div>
        <h3 className="text-lg font-serif font-bold text-foreground">Database Backup & Comprehensive Export</h3>
      </div>

      {/* Backup Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Option 1: Raw SQLite Database File */}
        <div className="card-elevated p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-base text-foreground">Direct SQLite Database (.db)</h4>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Download the complete raw SQLite database binary (`school-office.db`). Can be opened in DB Browser for SQLite or copied to a USB drive for air-gapped office archival.
              </p>
            </div>
          </div>

          <button
            onClick={handleDownloadSqlite}
            className="btn btn-primary text-xs flex items-center justify-center gap-2 w-full"
          >
            <DownloadCloud className="w-4 h-4" />
            <span>Download SQLite Database</span>
          </button>
        </div>

        {/* Option 2: Multi-Sheet Excel Workbook */}
        <div className="card-elevated p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[hsl(162,30%,40%)]/10 text-[hsl(162,30%,35%)] flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-base text-foreground">Excel Workbook (.xlsx)</h4>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Generates a clean, multi-tab Microsoft Excel spreadsheet containing Students, Households, Receipts, Disbursements, Balances, and Audit Trails.
              </p>
            </div>
          </div>

          <button
            onClick={handleExportExcelWorkbook}
            disabled={isExportingExcel}
            className="btn btn-primary text-xs flex items-center justify-center gap-2 w-full"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isExportingExcel ? 'Generating Workbook...' : 'Export Multi-Sheet Excel'}</span>
          </button>
        </div>

        {/* Option 3: JSON Snapshot Backup & Restore */}
        <div className="card-elevated p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-accent/15 text-accent-foreground flex items-center justify-center">
              <HardDrive className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-base text-foreground">JSON Snapshot & Restore</h4>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Download a portable JSON snapshot or upload a previous JSON snapshot to restore office data.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleExportJson}
              disabled={isExportingJson}
              className="btn btn-soft text-xs flex items-center justify-center gap-2 w-full"
            >
              <DownloadCloud className="w-4 h-4" />
              <span>Export JSON Snapshot</span>
            </button>

            <label className="btn btn-ghost text-xs flex items-center justify-center gap-2 w-full cursor-pointer border border-border">
              <UploadCloud className="w-4 h-4" />
              <span>{isRestoring ? 'Restoring...' : 'Restore from JSON File'}</span>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleRestoreJson}
                disabled={isRestoring}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Archival Activity & System Log */}
      <div className="panel p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Audit Trail</div>
            <h4 className="font-serif font-bold text-sm text-foreground">Recent Backup & Archival Activities</h4>
          </div>
        </div>

        {isLoadingLogs ? (
          <TableSkeleton rows={3} columns={4} />
        ) : auditLogs.length === 0 ? (
          <EmptyState
            title="No Backup Logs Found"
            description="System backup and restore events will appear here once executed."
            iconType="general"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-clean w-full">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Staff Member</th>
                  <th>Action</th>
                  <th>Event Description</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="mono text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="font-medium text-xs text-foreground">{log.staff_name}</td>
                    <td>
                      <span className="badge-pill bg-primary/10 text-primary text-[10px] font-semibold uppercase">
                        {log.action_type}
                      </span>
                    </td>
                    <td className="text-xs text-muted-foreground">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
