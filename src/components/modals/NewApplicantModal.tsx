import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { useStaff } from '../../context/StaffContext';
import { useNotification } from '../../context/NotificationContext';
import { Family } from '../../types';
import { soundManager } from '../common/AudioFeedback';
import {
  X,
  UserPlus,
  Maximize2,
  Minimize2,
  Save,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Check,
} from 'lucide-react';

interface NewApplicantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (id: string) => void;
}

export const NewApplicantModal: React.FC<NewApplicantModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { getHeaders } = useStaff();
  const { showToast } = useNotification();
  const [families, setFamilies] = useState<Family[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  const initialFormState = {
    first_name: '',
    last_name: '',
    dob: '2019-05-15',
    gender: 'Male',
    grade_applying: 'Grade 1',
    academic_year: '2026-2027',
    status: 'inquiry',
    guardian_name: '',
    guardian_phone: '',
    guardian_email: '',
    guardian_relationship: 'Father',
    address: 'Matara, Sri Lanka',
    family_id: '',
    notes: '',
    blood_group: 'O+',
    allergies: '',
    dietary_needs: '',
    emergency_contact: '',
    emergency_phone: '',
    emergency_relationship: 'Mother',
  };

  const [formData, setFormData] = useState(initialFormState);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      fetch('/api/families')
        .then((res) => res.json())
        .then((data) => setFamilies(data || []))
        .catch((err) => console.error(err));

      const saved = localStorage.getItem('elite_applicant_form_draft');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.first_name || parsed.last_name || parsed.guardian_name) {
            setFormData(parsed);
            setDraftRestored(true);
          }
        } catch (e) {}
      }
    } else {
      setDraftRestored(false);
      setIsFocusMode(false);
    }
  }, [isOpen]);

  // Auto-save draft on changes
  useEffect(() => {
    if (isOpen && (formData.first_name || formData.last_name || formData.guardian_name)) {
      localStorage.setItem('elite_applicant_form_draft', JSON.stringify(formData));
    }
  }, [formData, isOpen]);

  // Real-time inline validation
  useEffect(() => {
    const errs: Record<string, string> = {};
    if (touched.first_name && !formData.first_name.trim()) {
      errs.first_name = 'First name is required';
    }
    if (touched.last_name && !formData.last_name.trim()) {
      errs.last_name = 'Last name is required';
    }
    if (touched.guardian_name && !formData.guardian_name.trim()) {
      errs.guardian_name = 'Guardian name is required';
    }
    if (touched.guardian_phone) {
      if (!formData.guardian_phone.trim()) {
        errs.guardian_phone = 'Phone number is required';
      } else if (formData.guardian_phone.replace(/\D/g, '').length < 8) {
        errs.guardian_phone = 'Please enter a valid phone number';
      }
    }
    if (touched.guardian_email && formData.guardian_email) {
      if (!formData.guardian_email.includes('@') || !formData.guardian_email.includes('.')) {
        errs.guardian_email = 'Invalid email address';
      }
    }
    setErrors(errs);
  }, [formData, touched]);

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleClearDraft = () => {
    localStorage.removeItem('elite_applicant_form_draft');
    setFormData(initialFormState);
    setDraftRestored(false);
    setTouched({});
    showToast('Draft cleared', 'info');
  };

  const handleFamilyChange = (famId: string) => {
    const fam = families.find((f) => f.id === famId);
    if (fam) {
      setFormData((prev) => ({
        ...prev,
        family_id: famId,
        guardian_name: prev.guardian_name || fam.primary_guardian_name,
        guardian_phone: prev.guardian_phone || fam.primary_phone,
        guardian_email: prev.guardian_email || fam.primary_email,
        address: prev.address || fam.address,
      }));
    } else {
      setFormData((prev) => ({ ...prev, family_id: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      first_name: true,
      last_name: true,
      guardian_name: true,
      guardian_phone: true,
      guardian_email: true,
    });

    if (!formData.first_name || !formData.last_name || !formData.guardian_name || !formData.guardian_phone) {
      showToast('Please complete all required fields highlighted in red.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/applicants', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.removeItem('elite_applicant_form_draft');
        soundManager.playSuccessChime();
        showToast(
          `Registered applicant ${formData.first_name} ${formData.last_name} (${data.application_no})`,
          'success'
        );
        onSuccess(data.id);
        onClose();
      } else {
        showToast(data.error || 'Failed to register applicant', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  useLockBodyScroll(isOpen);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal transition-all duration-200 ${
          isFocusMode ? '!max-w-5xl !max-h-[96vh]' : '!max-w-3xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider font-semibold text-primary">
                Admissions Intake
              </div>
              <h3 className="text-xl font-serif font-bold text-foreground">
                Register New Applicant
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {draftRestored && (
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-primary bg-primary/10 px-2.5 py-1 rounded-md">
                <Save className="w-3 h-3" />
                <span>Draft restored</span>
                <button
                  type="button"
                  onClick={handleClearDraft}
                  className="text-muted-foreground hover:text-destructive ml-1"
                  title="Clear auto-saved draft"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsFocusMode((prev) => !prev)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              title={isFocusMode ? 'Exit Distraction-Free Mode' : 'Enter Focus Mode'}
            >
              {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Section 1: Academic & Student Info */}
          <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
              1. Student Details & Academic Placement
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  First Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  className={`input ${errors.first_name ? 'border-destructive ring-1 ring-destructive' : ''}`}
                  placeholder="e.g. Sebastian"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  onBlur={() => handleBlur('first_name')}
                />
                {errors.first_name && (
                  <span className="text-[10px] text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.first_name}
                  </span>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Last Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  className={`input ${errors.last_name ? 'border-destructive ring-1 ring-destructive' : ''}`}
                  placeholder="e.g. Sterling"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  onBlur={() => handleBlur('last_name')}
                />
                {errors.last_name && (
                  <span className="text-[10px] text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.last_name}
                  </span>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Date of Birth <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  required
                  className="input"
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Gender</label>
                <select
                  className="select"
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Grade Applying <span className="text-destructive">*</span>
                </label>
                <select
                  className="select"
                  value={formData.grade_applying}
                  onChange={(e) => setFormData({ ...formData, grade_applying: e.target.value })}
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
              <div>
                <label className="block text-xs font-semibold mb-1">Academic Year</label>
                <input
                  type="text"
                  className="input"
                  value={formData.academic_year}
                  onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Initial Funnel Stage</label>
                <select
                  className="select font-medium"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="inquiry">Inquiry</option>
                  <option value="applied">Applied</option>
                  <option value="documents_submitted">Documents Submitted</option>
                  <option value="accepted">Accepted</option>
                  <option value="enrolled">Enrolled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Guardian & Household Info */}
          <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                2. Guardian & Household Contact
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Link Household:</span>
                <select
                  className="select !h-7 !py-0 !text-xs !w-48"
                  value={formData.family_id}
                  onChange={(e) => handleFamilyChange(e.target.value)}
                >
                  <option value="">-- New / Unlinked Family --</option>
                  {families.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.household_name} ({f.family_code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Primary Guardian Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  className={`input ${errors.guardian_name ? 'border-destructive ring-1 ring-destructive' : ''}`}
                  placeholder="e.g. Richard Sterling"
                  value={formData.guardian_name}
                  onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })}
                  onBlur={() => handleBlur('guardian_name')}
                />
                {errors.guardian_name && (
                  <span className="text-[10px] text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.guardian_name}
                  </span>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Primary Phone Number <span className="text-destructive">*</span>
                </label>
                <input
                  type="tel"
                  required
                  className={`input ${errors.guardian_phone ? 'border-destructive ring-1 ring-destructive' : ''}`}
                  placeholder="e.g. 077 123 4567"
                  value={formData.guardian_phone}
                  onChange={(e) => setFormData({ ...formData, guardian_phone: e.target.value })}
                  onBlur={() => handleBlur('guardian_phone')}
                />
                {errors.guardian_phone && (
                  <span className="text-[10px] text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.guardian_phone}
                  </span>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  className={`input ${errors.guardian_email ? 'border-destructive ring-1 ring-destructive' : ''}`}
                  placeholder="guardian@example.com"
                  value={formData.guardian_email}
                  onChange={(e) => setFormData({ ...formData, guardian_email: e.target.value })}
                  onBlur={() => handleBlur('guardian_email')}
                />
                {errors.guardian_email && (
                  <span className="text-[10px] text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.guardian_email}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Relationship to Student</label>
                <select
                  className="select"
                  value={formData.guardian_relationship}
                  onChange={(e) => setFormData({ ...formData, guardian_relationship: e.target.value })}
                >
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Legal Guardian">Legal Guardian</option>
                  <option value="Grandparent">Grandparent</option>
                  <option value="Sponsor">Sponsor</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1">Residential Address</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Street address, city, district"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Medical & Intake Notes */}
          <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
              3. Medical & Office Intake Notes
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Blood Group</label>
                <select
                  className="select"
                  value={formData.blood_group}
                  onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                >
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="Unknown">Unknown</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Allergies</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Peanuts, Penicillin"
                  value={formData.allergies}
                  onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Dietary Needs</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Halal, Vegetarian, Nut-Free"
                  value={formData.dietary_needs}
                  onChange={(e) => setFormData({ ...formData, dietary_needs: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Admissions Notes / Observations</label>
              <textarea
                className="textarea !h-16"
                placeholder="Prior academic background, special interests, scholarship requests..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Auto-saved to terminal cache</span>
            </div>

            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} className="btn btn-ghost text-xs">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary text-xs py-2 px-4 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isSubmitting ? 'Registering...' : 'Create Applicant Dossier'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
