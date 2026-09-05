import React, { useState, useEffect, useRef } from 'react';
import { useStaff } from '../context/StaffContext';
import { useNotification } from '../context/NotificationContext';
import { SchoolSettings, Staff } from '../types';
import {
  Settings,
  Building,
  Users,
  ShieldCheck,
  KeyRound,
  Plus,
  Save,
  CheckCircle,
  FileText,
  DollarSign,
  FileSpreadsheet,
  Lock,
  HardDrive,
  ShieldAlert,
  ArrowRight,
  Moon,
  Sun,
  Trash2,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Pencil,
  UserX,
  UserCheck,
  X,
  Camera,
  Upload,
  Image as ImageIcon,
  ImageOff,
} from 'lucide-react';

interface SettingsViewProps {
  onOpenBulkImport?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onOpenBulkImport }) => {
  const { getHeaders, staffList, refreshStaff } = useStaff();
  const { showToast } = useNotification();

  const [activeTab, setActiveTab] = useState<'staff' | 'school' | 'system'>('staff');
  const [settings, setSettings] = useState<Partial<SchoolSettings>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [pinModalStaff, setPinModalStaff] = useState<Staff | null>(null);
  const [newPin, setNewPin] = useState('');
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [editStaffForm, setEditStaffForm] = useState({
    name: '',
    role: 'Admissions Officer',
    email: '',
    phone: '',
    photo_url: '',
  });
  const [editStaffPhotoUploading, setEditStaffPhotoUploading] = useState(false);
  const [uploadingStaffId, setUploadingStaffId] = useState<string | null>(null);

  const editStaffFileInputRef = useRef<HTMLInputElement>(null);
  const newStaffFileInputRef = useRef<HTMLInputElement>(null);
  const listFileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const [deactivatingStaff, setDeactivatingStaff] = useState<Staff | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [reactivatingStaffId, setReactivatingStaffId] = useState<string | null>(null);
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [clearConfirmationText, setClearConfirmationText] = useState('');

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return document.documentElement.classList.contains('dark');
  });

  const handleToggleTheme = (dark: boolean) => {
    setIsDarkMode(dark);
    if (dark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('elite_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('elite_theme', 'light');
    }
  };

  // Add staff form with PIN requirement toggle and photo
  const [newStaffForm, setNewStaffForm] = useState({
    name: '',
    role: 'Admissions Officer',
    email: '',
    phone: '',
    pin: '',
    photo_url: '',
  });
  const [newStaffRequirePin, setNewStaffRequirePin] = useState(true);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllStaff = async () => {
    try {
      const res = await fetch('/api/staff');
      if (res.ok) {
        const data: Staff[] = await res.json();
        setAllStaff(data);
      }
    } catch (err) {
      console.error('Failed to load staff list:', err);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchAllStaff();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        showToast('School settings saved successfully', 'success');
        window.dispatchEvent(new CustomEvent('school_settings_updated'));
        fetchSettings();
      }
    } catch (err) {
      showToast('Failed to save settings', 'error');
    }
  };

  const handleSelectLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Logo image must be under 5MB in size', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        const base64Data = reader.result as string;
        const updatedSettings = { ...settings, school_logo_url: base64Data };
        setSettings(updatedSettings);

        // Save immediately to settings
        try {
          const res = await fetch('/api/settings', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ school_logo_url: base64Data }),
          });
          if (res.ok) {
            showToast('School logo uploaded and saved successfully', 'success');
            window.dispatchEvent(new CustomEvent('school_settings_updated'));
            fetchSettings();
          } else {
            showToast('Failed to save uploaded logo', 'error');
          }
        } catch (err) {
          showToast('Failed to save uploaded logo', 'error');
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    const updatedSettings = { ...settings, school_logo_url: '' };
    setSettings(updatedSettings);
    if (logoFileInputRef.current) {
      logoFileInputRef.current.value = '';
    }
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ school_logo_url: '' }),
      });
      if (res.ok) {
        showToast('School logo removed', 'success');
        window.dispatchEvent(new CustomEvent('school_settings_updated'));
        fetchSettings();
      } else {
        showToast('Failed to remove logo', 'error');
      }
    } catch (err) {
      showToast('Failed to remove logo', 'error');
    }
  };

  const handleClearDemoData = async () => {
    if (clearConfirmationText !== 'CLEAR DEMO DATA') {
      showToast('Please type "CLEAR DEMO DATA" exactly to confirm', 'error');
      return;
    }

    setIsClearing(true);
    try {
      const res = await fetch('/api/settings/clear-demo-data', {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast('All demo transactional and applicant data cleared', 'success');
        setShowClearDataModal(false);
        setClearConfirmationText('');
        fetchSettings();
        refreshStaff();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to clear demo data', 'error');
      }
    } catch (err: any) {
      showToast('Error clearing data', 'error');
    } finally {
      setIsClearing(false);
    }
  };

  const handleSeedSampleData = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch('/api/settings/seed-sample-data', {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast('Full sample demo dataset restored successfully!', 'success');
        fetchSettings();
        refreshStaff();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to restore sample data', 'error');
      }
    } catch (err: any) {
      showToast('Error restoring demo data', 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffForm.name.trim()) {
      showToast('Staff name is required', 'error');
      return;
    }
    if (newStaffRequirePin && (!newStaffForm.pin || newStaffForm.pin.trim().length < 4)) {
      showToast('Please enter at least a 4-digit PIN (or uncheck "Require a PIN")', 'error');
      return;
    }

    try {
      const payload = {
        name: newStaffForm.name.trim(),
        role: newStaffForm.role,
        email: newStaffForm.email.trim(),
        phone: newStaffForm.phone.trim(),
        pin: newStaffRequirePin ? newStaffForm.pin.trim() : '',
        photo_url: newStaffForm.photo_url || '',
      };
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showToast(`Staff profile '${newStaffForm.name}' created`, 'success');
        setShowAddStaffModal(false);
        setNewStaffForm({ name: '', role: 'Admissions Officer', email: '', phone: '', pin: '', photo_url: '' });
        setNewStaffRequirePin(true);
        await fetchAllStaff();
        await refreshStaff();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to create staff profile', 'error');
      }
    } catch (err) {
      showToast('Failed to create staff profile', 'error');
    }
  };

  const handleOpenEditStaff = (staff: Staff) => {
    setEditingStaff(staff);
    setEditStaffForm({
      name: staff.name,
      role: staff.role,
      email: staff.email || '',
      phone: staff.phone || '',
      photo_url: staff.photo_url || '',
    });
  };

  const handleSelectEditStaffPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB in size', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditStaffForm(prev => ({ ...prev, photo_url: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveEditStaffPhoto = () => {
    setEditStaffForm(prev => ({ ...prev, photo_url: '' }));
    if (editStaffFileInputRef.current) {
      editStaffFileInputRef.current.value = '';
    }
  };

  const handleSaveEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    if (!editStaffForm.name.trim()) {
      showToast('Staff name is required', 'error');
      return;
    }
    if (!editStaffForm.role.trim()) {
      showToast('Staff role is required', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/staff/${editingStaff.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          name: editStaffForm.name,
          role: editStaffForm.role,
          email: editStaffForm.email,
          phone: editStaffForm.phone,
          photo_url: editStaffForm.photo_url || '',
        }),
      });
      if (res.ok) {
        showToast(`Staff profile for '${editStaffForm.name}' updated`, 'success');
        setEditingStaff(null);
        await fetchAllStaff();
        await refreshStaff();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to update staff profile', 'error');
      }
    } catch (err) {
      showToast('Failed to update staff profile', 'error');
    }
  };

  // Direct table avatar upload handler
  const handleDirectPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingStaffId) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB in size', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const res = await fetch(`/api/staff/${uploadingStaffId}/photo`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({ photo_url: base64 }),
        });
        if (res.ok) {
          showToast('Staff profile photo updated', 'success');
          await fetchAllStaff();
          await refreshStaff();
        } else {
          showToast('Failed to upload staff photo', 'error');
        }
      } catch (err) {
        showToast('Error uploading photo', 'error');
      } finally {
        setUploadingStaffId(null);
        if (listFileInputRef.current) listFileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };


  // Add staff photo preview handlers
  const handleSelectNewStaffPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB in size', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setNewStaffForm(prev => ({ ...prev, photo_url: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveNewStaffPhoto = () => {
    setNewStaffForm(prev => ({ ...prev, photo_url: '' }));
    if (newStaffFileInputRef.current) newStaffFileInputRef.current.value = '';
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivatingStaff) return;
    setIsDeactivating(true);
    try {
      const res = await fetch(`/api/staff/${deactivatingStaff.id}/deactivate`, {
        method: 'PATCH',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast(`Staff profile for '${deactivatingStaff.name}' deactivated`, 'success');
        setDeactivatingStaff(null);
        await fetchAllStaff();
        await refreshStaff();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to deactivate staff member', 'error');
      }
    } catch (err) {
      showToast('Failed to deactivate staff member', 'error');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleReactivateStaff = async (staff: Staff) => {
    setReactivatingStaffId(staff.id);
    try {
      const res = await fetch(`/api/staff/${staff.id}/reactivate`, {
        method: 'PATCH',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast(`Staff profile for '${staff.name}' reactivated`, 'success');
        await fetchAllStaff();
        await refreshStaff();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to reactivate staff member', 'error');
      }
    } catch (err) {
      showToast('Failed to reactivate staff member', 'error');
    } finally {
      setReactivatingStaffId(null);
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinModalStaff) return;
    try {
      const res = await fetch(`/api/staff/${pinModalStaff.id}/pin`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ pin: newPin }),
      });
      if (res.ok) {
        showToast(newPin ? 'Staff PIN code set' : 'Staff PIN code cleared', 'success');
        setPinModalStaff(null);
        setNewPin('');
        await fetchAllStaff();
        await refreshStaff();
      }
    } catch (err) {
      showToast('Failed to update PIN', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden file input for direct table avatar photo click */}
      <input
        type="file"
        ref={listFileInputRef}
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleDirectPhotoUpload}
      />

      {/* Top Banner with Navigation Tabs */}
      <div className="p-4 rounded-xl bg-card border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="eyebrow">Administration & Configuration</div>
          <h3 className="text-lg font-serif font-bold text-foreground">
            {activeTab === 'staff' && 'Staff Terminal Access & Profile Management'}
            {activeTab === 'school' && 'Institutional Details & Financial Policies'}
            {activeTab === 'system' && 'System Maintenance & Data Migration'}
          </h3>
        </div>

        {/* Tab switcher + Theme Toggle */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setActiveTab('staff')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'staff'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Staff Terminal</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium ${
                  activeTab === 'staff'
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {(allStaff.length > 0 ? allStaff : staffList).length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('school')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'school'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>School Profile</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('system')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'system'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>System & Data</span>
            </button>
          </div>

          <div className="flex items-center p-1 bg-muted/60 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => handleToggleTheme(!isDarkMode)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              title={isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-primary" />}
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: STAFF TERMINAL (Full width, No inner scroll, strictly aligned Deactivate buttons) */}
      {activeTab === 'staff' && (
        <div className="panel p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
            <div>
              <div className="eyebrow">Shared Front-Desk Terminal Access</div>
              <h3 className="font-serif font-bold text-lg text-foreground flex items-center gap-2.5">
                <span>Staff Profiles & PIN Security</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-medium">
                  {(allStaff.length > 0 ? allStaff : staffList).length} Registered Profiles
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Configure staff identities, bcrypt security verification PINs, and profile photos for shared terminal sessions and immutable audit logs.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setNewStaffForm({ name: '', role: 'Admissions Officer', email: '', phone: '', pin: '', photo_url: '' });
                setNewStaffRequirePin(true);
                setShowAddStaffModal(true);
              }}
              className="btn btn-primary text-xs flex items-center gap-1.5 self-start sm:self-auto shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Staff Profile</span>
            </button>
          </div>

          {/* Clean Staff Table: NO vertical inner scroll, Deactivate strictly right-aligned */}
          <div className="table-wrap">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="w-64">Staff Member</th>
                  <th className="w-48">Institutional Role</th>
                  <th>Contact Details</th>
                  <th className="w-44">Security PIN</th>
                  <th className="w-60 text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(allStaff.length > 0 ? allStaff : staffList).map(staff => {
                  const isStaffActive = (staff.is_active ?? staff.active ?? 1) === 1;
                  return (
                    <tr
                      key={staff.id}
                      className={`h-16 ${!isStaffActive ? 'bg-muted/30 opacity-75' : ''}`}
                    >
                      {/* Staff Member Column with Photo / Avatar */}
                      <td>
                        <div className="flex items-center gap-3">
                          <div
                            onClick={() => {
                              setUploadingStaffId(staff.id);
                              listFileInputRef.current?.click();
                            }}
                            className={`relative group/avatar w-10 h-10 rounded-full font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden cursor-pointer border ${
                              isStaffActive
                                ? 'bg-secondary text-primary border-primary/20 hover:border-primary'
                                : 'bg-muted text-muted-foreground border-border'
                            }`}
                            title="Click to change profile photo"
                          >
                            {staff.photo_url ? (
                              <img src={staff.photo_url} alt={staff.name} className="w-full h-full object-cover" />
                            ) : (
                              staff.avatar_initials || staff.name.substring(0, 2).toUpperCase()
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Camera className="w-3.5 h-3.5" />
                            </div>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`font-semibold text-xs truncate ${
                                  isStaffActive ? 'text-foreground' : 'text-muted-foreground line-through'
                                }`}
                              >
                                {staff.name}
                              </span>
                              {!isStaffActive && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-muted text-muted-foreground border border-border">
                                  Deactivated
                                </span>
                              )}
                              {isStaffActive && !staff.has_pin && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                  No PIN
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <span className="font-mono text-[10px] opacity-75">ID: {staff.id.slice(0, 8)}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Column */}
                      <td>
                        <span className="text-xs text-foreground font-medium">{staff.role}</span>
                      </td>

                      {/* Contact Details Column */}
                      <td>
                        <div className="text-xs space-y-0.5">
                          {staff.email ? (
                            <div className="text-foreground truncate max-w-xs">{staff.email}</div>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">No email registered</span>
                          )}
                          {staff.phone && (
                            <div className="text-muted-foreground text-[11px] font-mono">{staff.phone}</div>
                          )}
                        </div>
                      </td>

                      {/* Security PIN Status */}
                      <td>
                        {isStaffActive ? (
                          staff.has_pin ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                              <KeyRound className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>PIN Protected</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                              <ShieldAlert className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              <span>No PIN Required</span>
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                            <span>Inactive</span>
                          </span>
                        )}
                      </td>

                      {/* Actions Column: Fixed width, right-aligned, same exact order for EVERY single row */}
                      <td className="text-right pr-4">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditStaff(staff)}
                            className="btn btn-ghost !h-7 !px-2.5 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                            title="Edit staff details and photo"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Edit</span>
                          </button>

                          {isStaffActive && (
                            <button
                              type="button"
                              onClick={() => {
                                setPinModalStaff(staff);
                                setNewPin('');
                              }}
                              className="btn btn-ghost !h-7 !px-2.5 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                              title={staff.has_pin ? 'Change 4-digit PIN' : 'Set 4-digit PIN'}
                            >
                              <KeyRound className="w-3 h-3 text-accent" />
                              <span>{staff.has_pin ? 'Change PIN' : 'Set PIN'}</span>
                            </button>
                          )}

                          {isStaffActive ? (
                            <button
                              type="button"
                              onClick={() => setDeactivatingStaff(staff)}
                              className="btn btn-ghost !h-7 !px-2.5 text-xs text-destructive hover:bg-destructive/10 inline-flex items-center gap-1"
                              title="Deactivate staff profile"
                            >
                              <UserX className="w-3 h-3" />
                              <span>Deactivate</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReactivateStaff(staff)}
                              disabled={reactivatingStaffId === staff.id}
                              className="btn btn-soft !h-7 !px-2.5 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium inline-flex items-center gap-1"
                              title="Reactivate staff profile"
                            >
                              <UserCheck className="w-3 h-3" />
                              <span>{reactivatingStaffId === staff.id ? '...' : 'Reactivate'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SCHOOL PROFILE & POLICIES */}
      {activeTab === 'school' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* School Crest & Logo Upload Section */}
          <div className="panel p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <ImageIcon className="w-4 h-4 text-primary" />
              <h4 className="font-serif font-bold text-sm text-foreground">Official Institutional Logo & Crest</h4>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {/* Logo Preview / Fallback Box */}
              <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-border/80 bg-muted/30 p-2 flex flex-col items-center justify-center relative overflow-hidden group shrink-0 shadow-xs">
                {settings.school_logo_url ? (
                  <img
                    src={settings.school_logo_url}
                    alt="School Logo Preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center text-center p-2 text-muted-foreground">
                    <ImageOff className="w-7 h-7 mb-1 stroke-1 text-muted-foreground/60" />
                    <span className="text-[10px] font-mono leading-tight">No Logo Uploaded</span>
                  </div>
                )}
              </div>

              {/* Upload Controls & Actions */}
              <div className="space-y-3 flex-1">
                <div>
                  <h5 className="font-semibold text-xs text-foreground">School Brand Mark & Document Crest</h5>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    This logo appears at the top of 80mm thermal receipts, formal offer letters, student statements of account, and the navigation sidebar.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <input
                    type="file"
                    ref={logoFileInputRef}
                    onChange={handleSelectLogo}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoFileInputRef.current?.click()}
                    className="btn btn-secondary text-xs flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{settings.school_logo_url ? 'Replace Logo' : 'Upload School Logo'}</span>
                  </button>

                  {settings.school_logo_url && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="btn-ghost text-xs text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Logo</span>
                    </button>
                  )}
                </div>

                {/* Helper Guidance Note */}
                <div className="p-3 bg-muted/40 rounded-xl border border-border/70 text-[11px] text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">Receipt Printing Guidance: </span>
                  For best results on thermal receipt printing, use a simple black-and-white or high-contrast logo — thermal printers cannot print color or fine gradients, and detailed/photographic logos may print poorly or illegibly.
                </div>
              </div>
            </div>
          </div>

          <div className="panel p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <Building className="w-4 h-4 text-primary" />
              <h4 className="font-serif font-bold text-sm text-foreground">Institutional Details & Academic Year</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">School Name</label>
                <input
                  type="text"
                  required
                  className="input"
                  value={settings.school_name || ''}
                  onChange={e => setSettings({ ...settings, school_name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Latin Tagline</label>
                <input
                  type="text"
                  placeholder="e.g. Scientia est Infinita"
                  className="input"
                  value={settings.tagline || ''}
                  onChange={e => setSettings({ ...settings, tagline: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Institutional Motto</label>
              <input
                type="text"
                placeholder="e.g. To empower young minds with knowledge, skills, and values to create a future-ready generation."
                className="input text-xs"
                value={settings.motto || ''}
                onChange={e => setSettings({ ...settings, motto: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Official Telephone</label>
                <input
                  type="text"
                  placeholder="+94 70 699 9333"
                  className="input font-mono text-xs"
                  value={settings.phone || ''}
                  onChange={e => setSettings({ ...settings, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Official Office Email</label>
                <input
                  type="email"
                  placeholder="office@eis.lk"
                  className="input font-mono text-xs"
                  value={settings.email || ''}
                  onChange={e => setSettings({ ...settings, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Official WhatsApp</label>
                <input
                  type="text"
                  placeholder="+94706999333"
                  className="input font-mono text-xs"
                  value={settings.whatsapp_number || ''}
                  onChange={e => setSettings({ ...settings, whatsapp_number: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Campus Physical Address</label>
              <input
                type="text"
                placeholder="1/143, Akuressa Road, Matara, Sri Lanka"
                className="input text-xs"
                value={settings.address || ''}
                onChange={e => setSettings({ ...settings, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Currency Symbol</label>
                <input
                  type="text"
                  className="input font-mono"
                  value={settings.currency_symbol || 'LKR'}
                  onChange={e => setSettings({ ...settings, currency_symbol: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Active Academic Term</label>
                <input
                  type="text"
                  className="input font-mono"
                  value={settings.academic_year || '2026-2027'}
                  onChange={e => setSettings({ ...settings, academic_year: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Total Student Capacity</label>
                <input
                  type="number"
                  className="input font-mono"
                  value={settings.total_student_capacity || '450'}
                  onChange={e => setSettings({ ...settings, total_student_capacity: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border">
              <div>
                <label className="block text-xs font-semibold mb-1">Stalled Pipeline Alert Threshold (Days)</label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  className="input font-mono text-xs"
                  placeholder="14"
                  value={settings.stalled_applicant_threshold_days || '14'}
                  onChange={e => setSettings({ ...settings, stalled_applicant_threshold_days: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Triggers reminder if applicant is inactive in a stage for this many days (Default: 14)</p>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Desk Inactivity Auto-Lock (Minutes)</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  className="input font-mono text-xs"
                  placeholder="10"
                  value={settings.session_timeout_minutes || '10'}
                  onChange={e => setSettings({ ...settings, session_timeout_minutes: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Auto-locks terminal session after idle time</p>
              </div>
            </div>
          </div>

          {/* Sibling Discounts & Receipt Policy */}
          <div className="panel p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <DollarSign className="w-4 h-4 text-accent" />
              <h4 className="font-serif font-bold text-sm text-foreground">Financial Policies & Cash Drawer Defaults</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Default Opening Cash Float ({settings.currency_symbol || 'LKR'})</label>
                <input
                  type="number"
                  step="1"
                  className="input font-mono"
                  value={settings.default_opening_float ?? '50000.00'}
                  onChange={e => setSettings({ ...settings, default_opening_float: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Morning cash drawer starting float</p>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">2nd Child Sibling Discount (%)</label>
                <input
                  type="number"
                  className="input font-mono"
                  value={settings.sibling_discount_2nd || '10'}
                  onChange={e => setSettings({ ...settings, sibling_discount_2nd: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Applied automatically to tuition billing</p>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">3rd+ Child Sibling Discount (%)</label>
                <input
                  type="number"
                  className="input font-mono"
                  value={settings.sibling_discount_3rd || '15'}
                  onChange={e => setSettings({ ...settings, sibling_discount_3rd: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Applied for 3rd and subsequent siblings</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Official Receipt Footer Legal Notice</label>
              <textarea
                className="textarea !h-20"
                value={settings.receipt_footer_notice || ''}
                onChange={e => setSettings({ ...settings, receipt_footer_notice: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Local PC Backup Folder Path</label>
              <input
                type="text"
                className="input font-mono text-xs"
                placeholder="e.g. C:\EliteSchoolOffice\Backups"
                value={settings.backup_folder_path || ''}
                onChange={e => setSettings({ ...settings, backup_folder_path: e.target.value })}
              />
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" className="btn btn-primary flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" />
                <span>Save System Settings</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: SYSTEM DATA, SECURITY & APPEARANCE */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Data Migration Panel */}
            <div className="panel p-6 border border-border space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="eyebrow">Data Import & Migration</div>
                  <h3 className="text-base font-serif font-bold text-foreground">
                    Bulk Student Import (CSV / Excel)
                  </h3>
                </div>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Migrate your school's existing student body in seconds. Upload an Excel or CSV file with full names, DOB, grade, and guardian contact details. Includes full validation, duplicate checks, and pre-commit preview.
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenBulkImport}
                  className="btn btn-primary text-xs flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Launch Student Migration Tool</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Security & Data Privacy Compliance Panel */}
            <div className="panel p-6 border border-border space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="eyebrow">Security & Data Privacy</div>
                  <h3 className="text-base font-serif font-bold text-foreground">
                    Sensitive Records & Backup Hardening
                  </h3>
                </div>
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                <div className="flex items-start gap-2">
                  <Lock className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>
                    <strong>Bcrypt Hashed PINs:</strong> Staff security PIN codes are never stored in plaintext and are hashed using bcrypt with salt rounds. Profiles with no PIN set can switch without barrier.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <HardDrive className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                  <span>
                    <strong>Encrypted Drive Backups:</strong> Database files contain student PII and financial records. Ensure downloaded <code className="text-primary font-mono text-[11px]">.db</code> files are stored exclusively on BitLocker / FileVault encrypted external drives.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Terminal Auto-Lock:</strong> Shared desk sessions automatically suspend on inactivity to prevent unauthorized access.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Theme Preference Panel */}
          <div className="panel p-6 border border-border space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <div className="eyebrow">Appearance & Display</div>
                <h4 className="font-serif font-bold text-base text-foreground">Terminal Theme & Contrast</h4>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleToggleTheme(false)}
                className={`p-4 rounded-xl border flex items-center justify-center gap-3 text-sm font-semibold transition-all ${
                  !isDarkMode
                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sun className="w-5 h-5 text-amber-500" />
                <span>Light Theme</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleTheme(true)}
                className={`p-4 rounded-xl border flex items-center justify-center gap-3 text-sm font-semibold transition-all ${
                  isDarkMode
                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                <Moon className="w-5 h-5 text-primary" />
                <span>Dark Theme</span>
              </button>
            </div>
          </div>

          {/* Danger Zone: Clear Demo Data */}
          <div className="panel p-6 border border-destructive/30 space-y-4 bg-destructive/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="eyebrow text-destructive">Danger Zone</div>
                <h3 className="text-base font-serif font-bold text-foreground">
                  Reset Demo Database
                </h3>
              </div>
              <div className="p-2 rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Manage your school environment demo records. You can repopulate the complete institutional sample dataset (applicants, family records, fee structures, ledgers, assets) or clear demo records for production.
            </p>

            <div className="pt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isSeeding || isClearing}
                onClick={handleSeedSampleData}
                className="btn btn-primary text-xs flex items-center gap-2 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isSeeding ? 'Restoring Demo Records...' : 'Restore Sample Demo Dataset'}</span>
              </button>

              <button
                type="button"
                disabled={isSeeding || isClearing}
                onClick={() => {
                  setClearConfirmationText('');
                  setShowClearDataModal(true);
                }}
                className="btn btn-outline border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground text-xs flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Demo Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddStaffModal && (
        <div className="modal-backdrop" onClick={() => setShowAddStaffModal(false)}>
          <div className="modal !max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2 border-b border-border mb-3">
              <div>
                <div className="eyebrow">Staff Management</div>
                <h3 className="text-base font-serif font-bold text-foreground">Register New Staff Profile</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddStaff} className="space-y-3.5">
              {/* Profile Photo Upload */}
              <div className="flex items-center gap-4 p-3 bg-muted/20 rounded-xl border border-border">
                <input
                  type="file"
                  ref={newStaffFileInputRef}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleSelectNewStaffPhoto}
                />
                <div
                  onClick={() => newStaffFileInputRef.current?.click()}
                  className="relative group w-14 h-14 rounded-full bg-primary/10 text-primary border-2 border-dashed border-primary/30 flex items-center justify-center font-bold text-sm cursor-pointer overflow-hidden flex-shrink-0 hover:border-primary transition-all"
                  title="Click to choose staff profile photo"
                >
                  {newStaffForm.photo_url ? (
                    <img src={newStaffForm.photo_url} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-primary/70">
                      <Camera className="w-4 h-4" />
                      <span className="text-[8px] font-mono mt-0.5">Photo</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Camera className="w-4 h-4" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground">Staff Profile Photo</div>
                  <p className="text-[11px] text-muted-foreground mb-1.5">
                    Optional photo for terminal badge and audit verification (under 5MB).
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => newStaffFileInputRef.current?.click()}
                      className="btn btn-soft !h-6 !px-2 text-[10px] flex items-center gap-1"
                    >
                      <Camera className="w-2.5 h-2.5" />
                      <span>{newStaffForm.photo_url ? 'Change Photo' : 'Upload Photo'}</span>
                    </button>
                    {newStaffForm.photo_url && (
                      <button
                        type="button"
                        onClick={handleRemoveNewStaffPhoto}
                        className="btn btn-ghost !h-6 !px-2 text-[10px] text-destructive hover:bg-destructive/10"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Clara Montgomery"
                  className="input"
                  value={newStaffForm.name}
                  onChange={e => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Office Role *</label>
                <select
                  className="select text-xs"
                  value={newStaffForm.role}
                  onChange={e => setNewStaffForm({ ...newStaffForm, role: e.target.value })}
                >
                  <option value="Head of School">Head of School</option>
                  <option value="Principal">Principal</option>
                  <option value="Vice Principal">Vice Principal</option>
                  <option value="Bursar & Accounts Head">Bursar & Accounts Head</option>
                  <option value="Bursar">Bursar</option>
                  <option value="Registrar">Registrar</option>
                  <option value="Admissions Officer">Admissions Officer</option>
                  <option value="Front Desk Officer">Front Desk Officer</option>
                  <option value="Office Staff">Office Staff</option>
                  <option value="IT Administrator">IT Administrator</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="staff@eliteschool.edu"
                    className="input"
                    value={newStaffForm.email}
                    onChange={e => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Phone</label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 019-2811"
                    className="input"
                    value={newStaffForm.phone}
                    onChange={e => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                  />
                </div>
              </div>

              {/* Require a PIN Choice */}
              <div className="p-3 bg-muted/25 rounded-xl border border-border space-y-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newStaffRequirePin}
                    onChange={e => {
                      setNewStaffRequirePin(e.target.checked);
                      if (!e.target.checked) {
                        setNewStaffForm(prev => ({ ...prev, pin: '' }));
                      }
                    }}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-input cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-foreground">
                    Require a 4-digit PIN for this profile
                  </span>
                </label>

                {newStaffRequirePin ? (
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      Set 4-Digit Security PIN *
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      required={newStaffRequirePin}
                      minLength={4}
                      maxLength={6}
                      placeholder="••••"
                      className="input font-mono text-center tracking-widest text-sm"
                      value={newStaffForm.pin}
                      onChange={e => setNewStaffForm({ ...newStaffForm, pin: e.target.value })}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Staff member must type this PIN to authenticate on the shared terminal.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                    No PIN will be set. Anyone will be able to switch to this profile without entering a PIN.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddStaffModal(false)} className="btn btn-ghost text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary text-xs">
                  Register Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set PIN Modal */}
      {pinModalStaff && (
        <div className="modal-backdrop" onClick={() => setPinModalStaff(null)}>
          <div className="modal !max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="eyebrow">Security PIN</div>
            <h3 className="text-base font-serif font-bold text-foreground mb-1">
              Set PIN for {pinModalStaff.name}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Enter a 4-digit numeric code required when switching to this staff profile. Leave empty to remove PIN requirement.
            </p>

            <form onSubmit={handleUpdatePin} className="space-y-3">
              <div>
                <input
                  type="password"
                  maxLength={6}
                  autoFocus
                  placeholder="••••"
                  className="input text-center text-xl tracking-widest font-mono"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setPinModalStaff(null)} className="btn btn-ghost text-xs">Cancel</button>
                <button type="submit" className="btn btn-primary text-xs">Save PIN Code</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="modal-backdrop" onClick={() => setEditingStaff(null)}>
          <div className="modal !max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2 border-b border-border mb-3">
              <div>
                <div className="eyebrow">Terminal Access</div>
                <h3 className="text-base font-serif font-bold text-foreground">
                  Edit Staff Profile
                </h3>
              </div>
              <button
                onClick={() => setEditingStaff(null)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditStaff} className="space-y-3.5">
              {/* Profile Photo Upload */}
              <div className="flex items-center gap-4 p-3 bg-muted/20 rounded-xl border border-border">
                <input
                  type="file"
                  ref={editStaffFileInputRef}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleSelectEditStaffPhoto}
                />
                <div
                  onClick={() => editStaffFileInputRef.current?.click()}
                  className="relative group w-14 h-14 rounded-full bg-primary/10 text-primary border-2 border-dashed border-primary/30 flex items-center justify-center font-bold text-sm cursor-pointer overflow-hidden flex-shrink-0 hover:border-primary transition-all"
                  title="Click to change staff profile photo"
                >
                  {editStaffForm.photo_url ? (
                    <img src={editStaffForm.photo_url} alt={editStaffForm.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-primary/70">
                      <Camera className="w-4 h-4" />
                      <span className="text-[8px] font-mono mt-0.5">Photo</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Camera className="w-4 h-4" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground">Staff Profile Photo</div>
                  <p className="text-[11px] text-muted-foreground mb-1.5">
                    Update profile badge photo (JPG/PNG/WebP under 5MB).
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => editStaffFileInputRef.current?.click()}
                      className="btn btn-soft !h-6 !px-2 text-[10px] flex items-center gap-1"
                    >
                      <Camera className="w-2.5 h-2.5" />
                      <span>{editStaffForm.photo_url ? 'Change Photo' : 'Upload Photo'}</span>
                    </button>
                    {editStaffForm.photo_url && (
                      <button
                        type="button"
                        onClick={handleRemoveEditStaffPhoto}
                        className="btn btn-ghost !h-6 !px-2 text-[10px] text-destructive hover:bg-destructive/10"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Emily Thorne"
                  className="input"
                  value={editStaffForm.name}
                  onChange={e => setEditStaffForm({ ...editStaffForm, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Institutional Role</label>
                <select
                  className="select text-xs"
                  value={editStaffForm.role}
                  onChange={e => setEditStaffForm({ ...editStaffForm, role: e.target.value })}
                >
                  <option value="Head of School">Head of School</option>
                  <option value="Principal">Principal</option>
                  <option value="Vice Principal">Vice Principal</option>
                  <option value="Bursar & Accounts Head">Bursar & Accounts Head</option>
                  <option value="Bursar">Bursar</option>
                  <option value="Registrar">Registrar</option>
                  <option value="Admissions Officer">Admissions Officer</option>
                  <option value="Front Desk Officer">Front Desk Officer</option>
                  <option value="Office Staff">Office Staff</option>
                  <option value="IT Administrator">IT Administrator</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Official Email</label>
                <input
                  type="email"
                  placeholder="staff@eis.lk"
                  className="input"
                  value={editStaffForm.email}
                  onChange={e => setEditStaffForm({ ...editStaffForm, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+94 70 699 9333"
                  className="input"
                  value={editStaffForm.phone}
                  onChange={e => setEditStaffForm({ ...editStaffForm, phone: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingStaff(null)} className="btn btn-ghost text-xs">
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

      {/* Deactivate Staff Confirmation Modal */}
      {deactivatingStaff && (
        <div className="modal-backdrop" onClick={() => setDeactivatingStaff(null)}>
          <div className="modal !max-w-md border border-destructive/30" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-destructive font-serif font-bold text-base mb-1">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <span>Deactivate Staff Profile</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Are you sure you want to deactivate <strong>{deactivatingStaff.name}</strong> ({deactivatingStaff.role})?
            </p>

            <div className="p-3 bg-muted/40 rounded-xl border border-border text-xs mb-4 space-y-2">
              <div className="flex items-start gap-2 text-muted-foreground text-xs">
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  This staff member will no longer appear in the terminal profile switcher and cannot log into desk sessions.
                </span>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground text-xs">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Historical Preservation:</strong> All receipts, fee adjustments, and audit trail records previously authored by {deactivatingStaff.name} remain intact with full historical attribution.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeactivatingStaff(null)}
                className="btn btn-ghost text-xs"
                disabled={isDeactivating}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeactivate}
                className="btn btn-danger text-xs flex items-center gap-1.5"
                disabled={isDeactivating}
              >
                <UserX className="w-3.5 h-3.5" />
                <span>{isDeactivating ? 'Deactivating...' : 'Confirm Deactivation'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Demo Data Confirmation Modal */}
      {showClearDataModal && (
        <div className="modal-backdrop" onClick={() => setShowClearDataModal(false)}>
          <div className="modal !max-w-md border border-destructive/40" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-destructive font-serif font-bold text-base mb-1">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <span>Confirm Demo Data Reset</span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              This action will permanently delete all demo students, applicants, payment receipts, family records, ledger entries, and audit trail logs. <strong>This action cannot be undone.</strong>
            </p>

            <div className="p-3 bg-card rounded-lg border border-border text-xs mb-4 space-y-1.5">
              <div className="font-semibold text-foreground">What will be cleared:</div>
              <ul className="list-disc list-inside text-muted-foreground text-[11px] space-y-0.5">
                <li>All applicants, active student dossiers, and enrollment records</li>
                <li>All fee payments, income ledger entries, and cash drawer reconciliations</li>
                <li>All operational expenses and payment audit logs</li>
              </ul>
              <div className="font-semibold text-foreground pt-1">What is preserved:</div>
              <ul className="list-disc list-inside text-muted-foreground text-[11px] space-y-0.5">
                <li>School settings & tuition fee scale definitions</li>
                <li>Staff login profiles and access credentials</li>
              </ul>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Type <span className="font-mono text-destructive select-all">CLEAR DEMO DATA</span> to confirm:
                </label>
                <input
                  type="text"
                  placeholder="CLEAR DEMO DATA"
                  className="input font-mono text-xs border-destructive/40 focus:border-destructive"
                  value={clearConfirmationText}
                  onChange={e => setClearConfirmationText(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  disabled={isClearing}
                  onClick={() => {
                    setShowClearDataModal(false);
                    setClearConfirmationText('');
                  }}
                  className="btn btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={clearConfirmationText !== 'CLEAR DEMO DATA' || isClearing}
                  onClick={handleClearDemoData}
                  className="btn bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isClearing ? 'Clearing Database...' : 'Permanently Clear Demo Data'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
