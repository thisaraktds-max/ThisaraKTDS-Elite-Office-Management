import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { useStaff } from '../../context/StaffContext';
import { useNotification } from '../../context/NotificationContext';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Users,
  Edit2,
  Trash2,
  RefreshCw,
  Info,
  Check,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Filter,
  FileText,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ParsedStudentRow {
  id: string;
  full_name: string;
  date_of_birth: string;
  grade: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string;
  family_name: string;
  status: string;
  gender: string;
  address: string;
  blood_group: string;
  allergies: string;
  notes: string;
  selected: boolean;
  validationStatus: 'valid' | 'warning' | 'error' | 'duplicate';
  validationMessage: string;
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { getHeaders } = useStaff();
  const { showToast } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'summary'>('upload');
  const [rows, setRows] = useState<ParsedStudentRow[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'valid' | 'issues' | 'duplicates'>('all');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  const [importResult, setImportResult] = useState<{
    importedCount: number;
    familiesCreatedLinked: number;
    skippedCount: number;
    skippedRows: Array<{ row: any; reason: string }>;
  } | null>(null);

  useLockBodyScroll(isOpen);

  if (!isOpen) return null;

  // Download Sample Template (both CSV and XLSX)
  const downloadTemplate = (format: 'csv' | 'xlsx') => {
    const sampleData = [
      {
        full_name: 'Devin Jayasuriya',
        date_of_birth: '2015-05-18',
        grade: 'Grade 5',
        guardian_name: 'Sunil Jayasuriya',
        guardian_phone: '+94 77 123 4567',
        guardian_email: 'sunil.j@example.com',
        family_name: 'Jayasuriya',
        status: 'Enrolled',
        gender: 'Male',
        address: '24 Beach Road, Matara',
        blood_group: 'O+',
        allergies: 'None',
        notes: 'Existing 2025 student migration',
      },
      {
        full_name: 'Ananya Jayasuriya',
        date_of_birth: '2018-09-12',
        grade: 'Grade 2',
        guardian_name: 'Sunil Jayasuriya',
        guardian_phone: '+94 77 123 4567',
        guardian_email: 'sunil.j@example.com',
        family_name: 'Jayasuriya',
        status: 'Enrolled',
        gender: 'Female',
        address: '24 Beach Road, Matara',
        blood_group: 'B+',
        allergies: 'Peanuts (Mild)',
        notes: 'Sibling of Devin Jayasuriya',
      },
      {
        full_name: 'Kavindu Senanayake',
        date_of_birth: '2011-03-24',
        grade: 'Grade 9',
        guardian_name: 'Manel Senanayake',
        guardian_phone: '+94 71 987 6543',
        guardian_email: 'manel.s@example.lk',
        family_name: 'Senanayake',
        status: 'Enrolled',
        gender: 'Male',
        address: '10 Galle Road, Matara',
        blood_group: 'A+',
        allergies: 'Asthma inhaler',
        notes: 'Senior Secondary Section',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Student_Import_Template');

    if (format === 'csv') {
      XLSX.writeFile(wb, 'Elite_School_Student_Import_Template.csv', { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, 'Elite_School_Student_Import_Template.xlsx');
    }
    showToast(`Template (${format.toUpperCase()}) downloaded`, 'success');
  };

  const handleFileUpload = async (file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (json.length === 0) {
          showToast('The uploaded file contains no data rows.', 'error');
          return;
        }

        // Fetch existing students from API to check duplicates
        let existingMap = new Set<string>();
        try {
          const res = await fetch('/api/applicants');
          if (res.ok) {
            const data = await res.json();
            const list = data.applicants || [];
            list.forEach((a: any) => {
              const key = `${(a.first_name + ' ' + a.last_name).trim().toLowerCase()}_${(a.dob || '').trim()}`;
              existingMap.add(key);
            });
          }
        } catch (e) {
          // Ignore
        }

        const parsed: ParsedStudentRow[] = json.map((row, index) => {
          const fullName = (row.full_name || row['Full Name'] || row.name || row.StudentName || '').toString().trim();
          let dob = (row.date_of_birth || row.dob || row['Date of Birth'] || row.DOB || '').toString().trim();
          
          // Handle numeric Excel date serial numbers
          if (/^\d{5}$/.test(dob)) {
            const parsedDate = new Date(Math.round((Number(dob) - 25569) * 86400 * 1000));
            dob = parsedDate.toISOString().substring(0, 10);
          } else if (dob.includes('/')) {
            const parts = dob.split('/');
            if (parts.length === 3) {
              // try DD/MM/YYYY or MM/DD/YYYY
              if (parts[2].length === 4) {
                dob = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            }
          }

          const grade = (row.grade || row.Grade || row['Applying Grade'] || 'Grade 1').toString().trim();
          const guardianName = (row.guardian_name || row['Guardian Name'] || row.parent_name || '').toString().trim();
          const guardianPhone = (row.guardian_phone || row['Guardian Phone'] || row.phone || '').toString().trim();
          const guardianEmail = (row.guardian_email || row['Guardian Email'] || row.email || '').toString().trim();
          const familyName = (row.family_name || row['Family Name'] || row.household || '').toString().trim();
          const status = (row.status || row.Status || 'Enrolled').toString().trim();
          const gender = (row.gender || row.Gender || '').toString().trim();
          const address = (row.address || row.Address || '').toString().trim();
          const bloodGroup = (row.blood_group || row['Blood Group'] || '').toString().trim();
          const allergies = (row.allergies || row.Allergies || '').toString().trim();
          const notes = (row.notes || row.Notes || '').toString().trim();

          let validationStatus: ParsedStudentRow['validationStatus'] = 'valid';
          let validationMessage = 'Valid & ready to import';

          const dupKey = `${fullName.toLowerCase()}_${dob}`;
          if (dob && existingMap.has(dupKey)) {
            validationStatus = 'duplicate';
            validationMessage = 'Candidate with matching Name + DOB already in registry';
          } else if (!fullName) {
            validationStatus = 'error';
            validationMessage = 'Missing student full name';
          } else if (!dob) {
            validationStatus = 'warning';
            validationMessage = 'Missing date of birth (default 2015-01-01 will be used)';
          } else if (!guardianName && !guardianPhone) {
            validationStatus = 'warning';
            validationMessage = 'No guardian contact provided';
          }

          return {
            id: `row_${index}`,
            full_name: fullName,
            date_of_birth: dob,
            grade,
            guardian_name: guardianName,
            guardian_phone: guardianPhone,
            guardian_email: guardianEmail,
            family_name: familyName,
            status,
            gender,
            address,
            blood_group: bloodGroup,
            allergies,
            notes,
            selected: validationStatus !== 'error' && validationStatus !== 'duplicate',
            validationStatus,
            validationMessage,
          };
        });

        setRows(parsed);
        setStep('preview');
        showToast(`Parsed ${parsed.length} student records from file`, 'success');
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      console.error('File parsing error:', err);
      showToast('Failed to parse file. Ensure it is a valid CSV or XLSX.', 'error');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleRowChange = (id: string, field: keyof ParsedStudentRow, value: any) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const updated = { ...r, [field]: value };
          // Re-validate row
          if (!updated.full_name.trim()) {
            updated.validationStatus = 'error';
            updated.validationMessage = 'Missing student full name';
          } else {
            updated.validationStatus = 'valid';
            updated.validationMessage = 'Valid & ready to import';
          }
          return updated;
        }
        return r;
      })
    );
  };

  const handleToggleSelectAll = (checked: boolean) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.validationStatus === 'error') return { ...r, selected: false };
        return { ...r, selected: checked };
      })
    );
  };

  const handleCommitImport = async () => {
    const selectedRows = rows.filter((r) => r.selected);
    if (selectedRows.length === 0) {
      showToast('No students selected for import.', 'error');
      return;
    }

    setStep('importing');

    try {
      const res = await fetch('/api/applicants/bulk-import', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          rows: selectedRows.map((r) => ({
            full_name: r.full_name,
            date_of_birth: r.date_of_birth,
            grade: r.grade,
            guardian_name: r.guardian_name,
            guardian_phone: r.guardian_phone,
            guardian_email: r.guardian_email,
            family_name: r.family_name,
            status: r.status,
            gender: r.gender,
            address: r.address,
            blood_group: r.blood_group,
            allergies: r.allergies,
            notes: r.notes,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setImportResult(data);
        setStep('summary');
        showToast(`Successfully imported ${data.importedCount} student records`, 'success');
        if (onSuccess) onSuccess();
      } else {
        const err = await res.json();
        showToast(err.error || 'Bulk import failed', 'error');
        setStep('preview');
      }
    } catch (err: any) {
      console.error('Import error:', err);
      showToast('Network error during bulk import', 'error');
      setStep('preview');
    }
  };

  const exportSkippedReport = () => {
    if (!importResult || importResult.skippedRows.length === 0) {
      showToast('No skipped rows to export', 'info');
      return;
    }
    const exportData = importResult.skippedRows.map((item) => ({
      'Student Name': item.row.full_name || '',
      DOB: item.row.date_of_birth || '',
      Grade: item.row.grade || '',
      'Guardian Contact': item.row.guardian_phone || item.row.guardian_name || '',
      'Skip Reason': item.reason,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Skipped_Students');
    XLSX.writeFile(wb, `Student_Import_Skipped_Report_${new Date().toISOString().substring(0, 10)}.xlsx`);
    showToast('Skipped student report exported', 'success');
  };

  const filteredRows = rows.filter((r) => {
    if (filterMode === 'valid') return r.validationStatus === 'valid';
    if (filterMode === 'issues') return r.validationStatus === 'warning' || r.validationStatus === 'error';
    if (filterMode === 'duplicates') return r.validationStatus === 'duplicate';
    return true;
  });

  const validCount = rows.filter((r) => r.validationStatus === 'valid').length;
  const warningCount = rows.filter((r) => r.validationStatus === 'warning').length;
  const errorCount = rows.filter((r) => r.validationStatus === 'error').length;
  const duplicateCount = rows.filter((r) => r.validationStatus === 'duplicate').length;
  const selectedCount = rows.filter((r) => r.selected).length;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal !max-w-5xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3.5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-foreground flex items-center gap-2">
                Migrate / Import Students
                <span className="badge-pill bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px]">
                  CSV / Excel Engine
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Bulk register existing 460+ enrolled students with automated family link matching and validation.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground text-sm font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto py-4">
          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Drag & Drop Box */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-primary rounded-2xl p-10 text-center cursor-pointer transition-all bg-card hover:bg-muted/30 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform flex items-center justify-center mx-auto mb-3">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  Select or Drag & Drop Student Spreadsheet
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  Supports standard Excel (<strong>.xlsx</strong>, <strong>.xls</strong>) and CSV (<strong>.csv</strong>) export formats.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-primary group-hover:underline">
                  <span>Browse local files</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Template Download & Formatting Instructions */}
              <div className="panel p-4 bg-muted/30 border border-border space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-serif font-bold text-foreground flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-primary" />
                      Expected Spreadsheet Columns
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Download pre-formatted sample templates with sample student rows to verify column headers.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => downloadTemplate('xlsx')}
                      className="btn btn-soft text-xs py-1.5 px-3 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .XLSX</span>
                    </button>
                    <button
                      onClick={() => downloadTemplate('csv')}
                      className="btn btn-soft text-xs py-1.5 px-3 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .CSV</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/60 text-[11px]">
                  <div className="p-2 rounded-lg bg-card border border-border">
                    <span className="font-semibold text-foreground block">full_name *</span>
                    <span className="text-muted-foreground text-[10px]">Student First & Last Name</span>
                  </div>
                  <div className="p-2 rounded-lg bg-card border border-border">
                    <span className="font-semibold text-foreground block">date_of_birth *</span>
                    <span className="text-muted-foreground text-[10px]">YYYY-MM-DD format</span>
                  </div>
                  <div className="p-2 rounded-lg bg-card border border-border">
                    <span className="font-semibold text-foreground block">grade *</span>
                    <span className="text-muted-foreground text-[10px]">e.g. Grade 1 - Grade 12</span>
                  </div>
                  <div className="p-2 rounded-lg bg-card border border-border">
                    <span className="font-semibold text-foreground block">family_name</span>
                    <span className="text-muted-foreground text-[10px]">Links siblings together</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Preview & Inline Validation */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Validation Summary Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-foreground">
                    Parsed {rows.length} Total Records
                  </span>
                  <div className="h-4 w-px bg-border hidden sm:block"></div>
                  <button
                    onClick={() => setFilterMode('all')}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                      filterMode === 'all' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    All ({rows.length})
                  </button>
                  <button
                    onClick={() => setFilterMode('valid')}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                      filterMode === 'valid' ? 'bg-emerald-600 text-white' : 'text-emerald-600 hover:underline'
                    }`}
                  >
                    Valid ({validCount})
                  </button>
                  {(warningCount > 0 || errorCount > 0) && (
                    <button
                      onClick={() => setFilterMode('issues')}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                        filterMode === 'issues' ? 'bg-amber-600 text-white' : 'text-amber-600 hover:underline'
                      }`}
                    >
                      Warnings ({warningCount + errorCount})
                    </button>
                  )}
                  {duplicateCount > 0 && (
                    <button
                      onClick={() => setFilterMode('duplicates')}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                        filterMode === 'duplicates' ? 'bg-rose-600 text-white' : 'text-rose-600 hover:underline'
                      }`}
                    >
                      Duplicates ({duplicateCount})
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-[11px]">
                    <strong className="text-foreground">{selectedCount}</strong> rows selected for commit
                  </span>
                  <button
                    onClick={() => handleToggleSelectAll(true)}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => handleToggleSelectAll(false)}
                    className="text-[11px] text-muted-foreground hover:underline"
                  >
                    Deselect
                  </button>
                </div>
              </div>

              {/* Preview Table */}
              <div className="panel overflow-hidden border border-border">
                <div className="overflow-x-auto max-h-96">
                  <table className="table w-full text-left text-xs">
                    <thead className="sticky top-0 bg-card border-b border-border z-10">
                      <tr className="text-[11px] text-muted-foreground uppercase font-semibold">
                        <th className="py-2.5 px-3 w-10 text-center">Import</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Student Full Name</th>
                        <th className="py-2.5 px-3">DOB</th>
                        <th className="py-2.5 px-3">Grade</th>
                        <th className="py-2.5 px-3">Guardian Name</th>
                        <th className="py-2.5 px-3">Phone</th>
                        <th className="py-2.5 px-3">Family Sibling Group</th>
                        <th className="py-2.5 px-3">Enrollment Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredRows.map((r) => (
                        <tr
                          key={r.id}
                          className={`hover:bg-muted/30 transition-colors ${
                            !r.selected ? 'opacity-50 bg-muted/10' : ''
                          }`}
                        >
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={r.selected}
                              disabled={r.validationStatus === 'error'}
                              onChange={(e) => handleRowChange(r.id, 'selected', e.target.checked)}
                              className="rounded border-border cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {r.validationStatus === 'valid' && (
                              <span className="badge-pill bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-medium flex items-center gap-1 w-fit">
                                <CheckCircle2 className="w-3 h-3" /> Ready
                              </span>
                            )}
                            {r.validationStatus === 'warning' && (
                              <span
                                className="badge-pill bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[10px] font-medium flex items-center gap-1 w-fit cursor-help"
                                title={r.validationMessage}
                              >
                                <AlertTriangle className="w-3 h-3" /> Warning
                              </span>
                            )}
                            {r.validationStatus === 'duplicate' && (
                              <span
                                className="badge-pill bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 text-[10px] font-medium flex items-center gap-1 w-fit cursor-help"
                                title={r.validationMessage}
                              >
                                <XCircle className="w-3 h-3" /> Duplicate
                              </span>
                            )}
                            {r.validationStatus === 'error' && (
                              <span
                                className="badge-pill bg-destructive/10 text-destructive border border-destructive/20 text-[10px] font-medium flex items-center gap-1 w-fit cursor-help"
                                title={r.validationMessage}
                              >
                                <XCircle className="w-3 h-3" /> Error
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={r.full_name}
                              onChange={(e) => handleRowChange(r.id, 'full_name', e.target.value)}
                              className="input py-1 px-2 text-xs w-44 font-semibold"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="date"
                              value={r.date_of_birth}
                              onChange={(e) => handleRowChange(r.id, 'date_of_birth', e.target.value)}
                              className="input py-1 px-2 text-xs w-32 font-mono text-[11px]"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={r.grade}
                              onChange={(e) => handleRowChange(r.id, 'grade', e.target.value)}
                              className="input py-1 px-2 text-xs w-28"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={r.guardian_name}
                              onChange={(e) => handleRowChange(r.id, 'guardian_name', e.target.value)}
                              placeholder="Guardian Name"
                              className="input py-1 px-2 text-xs w-36"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={r.guardian_phone}
                              onChange={(e) => handleRowChange(r.id, 'guardian_phone', e.target.value)}
                              placeholder="Phone"
                              className="input py-1 px-2 text-xs w-32 font-mono text-[11px]"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={r.family_name}
                              onChange={(e) => handleRowChange(r.id, 'family_name', e.target.value)}
                              placeholder="Family Sibling Tag"
                              className="input py-1 px-2 text-xs w-32"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={r.status}
                              onChange={(e) => handleRowChange(r.id, 'status', e.target.value)}
                              className="input py-1 px-2 text-xs w-28"
                            >
                              <option value="Enrolled">Enrolled</option>
                              <option value="Accepted">Accepted</option>
                              <option value="Applied">Applied</option>
                              <option value="Inquiry">Inquiry</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Importing Spinner */}
          {step === 'importing' && (
            <div className="py-16 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto animate-bounce">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
              <h3 className="text-base font-serif font-bold text-foreground">
                Importing & Matriculating Student Registry...
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Allocating official APP-2026 application numbers, connecting sibling households, and seeding compliance documents.
              </p>
            </div>
          )}

          {/* STEP 4: Summary Report */}
          {step === 'summary' && importResult && (
            <div className="space-y-6 animate-fade">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-serif font-bold text-foreground">
                  Migration Batch Successfully Processed
                </h3>
                <p className="text-xs text-muted-foreground">
                  Student profiles are live in the database and ready for admissions & bursary operations.
                </p>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="panel p-4 text-center bg-card">
                  <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {importResult.importedCount}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-medium mt-0.5">
                    Students Enrolled
                  </div>
                </div>

                <div className="panel p-4 text-center bg-card">
                  <div className="text-2xl font-bold font-mono text-primary">
                    {importResult.familiesCreatedLinked}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-medium mt-0.5">
                    Family Groups Linked
                  </div>
                </div>

                <div className="panel p-4 text-center bg-card">
                  <div className="text-2xl font-bold font-mono text-muted-foreground">
                    {importResult.skippedCount}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-medium mt-0.5">
                    Skipped / Excluded
                  </div>
                </div>
              </div>

              {/* Skipped Rows Log if any */}
              {importResult.skippedRows.length > 0 && (
                <div className="panel p-3.5 bg-muted/20 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Skipped Records Log ({importResult.skippedRows.length})
                    </span>
                    <button
                      onClick={exportSkippedReport}
                      className="btn btn-soft text-[11px] py-1 px-2.5 flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Export Error Log</span>
                    </button>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 text-[11px] divide-y divide-border">
                    {importResult.skippedRows.map((s, idx) => (
                      <div key={idx} className="pt-1 flex items-center justify-between text-muted-foreground">
                        <span className="font-medium text-foreground">{s.row.full_name || 'Unnamed Student'}</span>
                        <span className="text-destructive font-mono text-[10px]">{s.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3.5 border-t border-border flex-shrink-0">
          {step === 'preview' && (
            <button
              onClick={() => setStep('upload')}
              className="btn btn-soft text-xs"
            >
              Back to Upload
            </button>
          )}

          {step === 'summary' ? (
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                onClick={() => {
                  setStep('upload');
                  setRows([]);
                  setImportResult(null);
                }}
                className="btn btn-soft text-xs"
              >
                Import Another File
              </button>
              <button onClick={onClose} className="btn btn-primary text-xs">
                Finish & View Pipeline
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2 ml-auto">
              <button onClick={onClose} className="btn btn-soft text-xs">
                Cancel
              </button>
              {step === 'preview' && (
                <button
                  onClick={handleCommitImport}
                  disabled={selectedCount === 0}
                  className="btn btn-primary text-xs flex items-center gap-1.5"
                >
                  <span>Commit Import ({selectedCount} Students)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
