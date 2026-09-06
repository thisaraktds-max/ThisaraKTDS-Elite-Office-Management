import React, { useState, useEffect } from 'react';
import { useStaff } from '../context/StaffContext';
import { useNotification } from '../context/NotificationContext';
import { Family } from '../types';
import { CardSkeleton } from '../components/common/SkeletonLoader';
import { EmptyState } from '../components/common/EmptyState';
import {
  Users,
  Home,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  User,
  GraduationCap,
  Pencil,
  Trash2,
} from 'lucide-react';
import { ConfirmDialogModal } from '../components/modals/ConfirmDialogModal';

export const FamiliesView: React.FC<{ onOpenDossier: (id: string) => void }> = ({ onOpenDossier }) => {
  const { getHeaders } = useStaff();
  const { showToast } = useNotification();
  const [families, setFamilies] = useState<Family[]>([]);
  const [settings, setSettings] = useState<any>({});
  const currency = settings.currency_symbol || 'LKR';
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);
  const [isSavingFamily, setIsSavingFamily] = useState(false);
  const [familyToDelete, setFamilyToDelete] = useState<Family | null>(null);
  const [isDeletingFamily, setIsDeletingFamily] = useState(false);

  const [form, setForm] = useState({
    household_name: '',
    primary_guardian_name: '',
    primary_phone: '',
    primary_email: '',
    secondary_guardian_name: '',
    secondary_phone: '',
    secondary_email: '',
    address: '',
    notes: '',
  });

  const fetchFamilies = async () => {
    setIsLoading(true);
    try {
      const [res, settingsRes] = await Promise.all([
        fetch('/api/families'),
        fetch('/api/settings'),
      ]);
      if (settingsRes.ok) {
        setSettings(await settingsRes.json());
      }
      if (res.ok) {
        const data = await res.json();
        setFamilies(data);
      }
    } catch (err) {
      console.error('Failed to load families:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFamilies();
  }, []);

  const handleOpenAddFamily = () => {
    setEditingFamily(null);
    setForm({
      household_name: '',
      primary_guardian_name: '',
      primary_phone: '',
      primary_email: '',
      secondary_guardian_name: '',
      secondary_phone: '',
      secondary_email: '',
      address: '',
      notes: '',
    });
    setShowAddModal(true);
  };

  const handleOpenEditFamily = (fam: Family) => {
    setEditingFamily(fam);
    setForm({
      household_name: fam.household_name || '',
      primary_guardian_name: fam.primary_guardian_name || '',
      primary_phone: fam.primary_phone || '',
      primary_email: fam.primary_email || '',
      secondary_guardian_name: fam.secondary_guardian_name || '',
      secondary_phone: fam.secondary_phone || '',
      secondary_email: fam.secondary_email || '',
      address: fam.address || '',
      notes: fam.notes || '',
    });
    setShowAddModal(true);
  };

  const handleSaveFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.household_name || !form.primary_guardian_name || !form.primary_phone) {
      showToast('Please fill all required household details', 'error');
      return;
    }
    setIsSavingFamily(true);
    try {
      const url = editingFamily ? `/api/families/${editingFamily.id}` : '/api/families';
      const method = editingFamily ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          editingFamily
            ? `Updated household record for ${form.household_name}`
            : `Created household account ${form.household_name} (${data.family_code})`,
          'success'
        );
        setShowAddModal(false);
        setEditingFamily(null);
        fetchFamilies();
      } else {
        showToast(data.error || 'Failed to save family household', 'error');
      }
    } catch (err) {
      showToast('Failed to save family household', 'error');
    } finally {
      setIsSavingFamily(false);
    }
  };

  const handleConfirmDeleteFamily = async () => {
    if (!familyToDelete) return;
    setIsDeletingFamily(true);
    try {
      const res = await fetch(`/api/families/${familyToDelete.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Household "${familyToDelete.household_name}" deleted successfully`, 'success');
        setFamilyToDelete(null);
        fetchFamilies();
      } else {
        showToast(data.error || 'Failed to delete household', 'error');
      }
    } catch (err) {
      showToast('Failed to delete household', 'error');
    } finally {
      setIsDeletingFamily(false);
    }
  };

  const filtered = families.filter(f => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      f.household_name.toLowerCase().includes(q) ||
      f.family_code.toLowerCase().includes(q) ||
      f.primary_guardian_name.toLowerCase().includes(q) ||
      f.primary_phone.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border">
        <div>
          <div className="eyebrow">Unified Household Ledger</div>
          <h3 className="text-lg font-serif font-bold text-foreground">Families & Guardian Accounts</h3>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search family or guardian..."
              className="input !h-8 !pl-10 !text-xs w-full"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <button
            onClick={handleOpenAddFamily}
            className="btn btn-primary text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Household</span>
          </button>
        </div>
      </div>

      {/* Families Grid */}
      {isLoading ? (
        <CardSkeleton count={6} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(fam => (
            <div key={fam.id} className="card-elevated p-5 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-base text-foreground font-serif">{fam.household_name}</h4>
                    <div className="mono text-xs text-primary font-semibold">{fam.family_code}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditFamily(fam)}
                      className="btn btn-ghost !h-7 !w-7 !p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center justify-center"
                      title="Edit Household Details"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setFamilyToDelete(fam)}
                      className="btn btn-ghost !h-7 !w-7 !p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 inline-flex items-center justify-center"
                      title="Delete Household"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent-foreground flex items-center justify-center font-bold text-xs ml-1">
                      <Users className="w-4 h-4 text-accent" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground pt-2 border-t border-border mt-3">
                  <div className="flex items-center gap-2 text-foreground font-medium">
                    <User className="w-3.5 h-3.5 text-accent" />
                    <span>{fam.primary_guardian_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5" />
                    <span className="mono">{fam.primary_phone}</span>
                  </div>
                  {fam.primary_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" />
                      <span>{fam.primary_email}</span>
                    </div>
                  )}
                  {fam.address && (
                    <div className="flex items-start gap-2 pt-1">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span className="text-[11px] leading-tight">{fam.address}</span>
                    </div>
                  )}
                </div>

                {/* Linked Students List */}
                <div className="pt-3 border-t border-border mt-3">
                  <div className="eyebrow mb-1.5">Linked Students ({fam.students?.length || 0})</div>
                  <div className="space-y-1">
                    {fam.students?.map(st => (
                      <div
                        key={st.id}
                        onClick={() => onOpenDossier(st.id)}
                        className="p-1.5 px-2 rounded-lg bg-muted/40 hover:bg-muted text-xs flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <span className="font-medium text-foreground flex items-center gap-1.5">
                          <GraduationCap className="w-3.5 h-3.5 text-primary" />
                          <span>{st.first_name} {st.last_name} ({st.grade_applying})</span>
                        </span>
                        <span className={`badge badge-${st.status} !text-[9px]`}>{st.status}</span>
                      </div>
                    ))}
                    {(!fam.students || fam.students.length === 0) && (
                      <p className="text-[11px] text-muted-foreground italic">No linked students registered.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-mono text-[10px]">
                  Total Credited: <strong className="text-foreground">{currency} {Number(fam.total_paid || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                iconType="family"
                title="No Households Found"
                description="No family households match your search query."
                actionLabel="Create Household"
                onAction={handleOpenAddFamily}
              />
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Household Modal */}
      {showAddModal && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setShowAddModal(false);
            setEditingFamily(null);
          }}
        >
          <div className="modal !max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="eyebrow">Household Management</div>
            <h3 className="text-lg font-serif font-bold text-foreground mb-4">
              {editingFamily ? `Edit Household: ${editingFamily.household_name}` : 'Create Family Household Record'}
            </h3>

            <form onSubmit={handleSaveFamily} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Household Title / Family Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. The Vance Household"
                  className="input"
                  value={form.household_name}
                  onChange={e => setForm({ ...form, household_name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Primary Guardian Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Richard Vance"
                    className="input"
                    value={form.primary_guardian_name}
                    onChange={e => setForm({ ...form, primary_guardian_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Primary Phone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +1 (555) 019-2811"
                    className="input"
                    value={form.primary_phone}
                    onChange={e => setForm({ ...form, primary_phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Primary Email</label>
                  <input
                    type="email"
                    placeholder="guardian@example.com"
                    className="input"
                    value={form.primary_email}
                    onChange={e => setForm({ ...form, primary_email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Secondary Contact / Spouse</label>
                  <input
                    type="text"
                    placeholder="e.g. Eleanor Vance"
                    className="input"
                    value={form.secondary_guardian_name}
                    onChange={e => setForm({ ...form, secondary_guardian_name: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Residential Address</label>
                <input
                  type="text"
                  placeholder="Street address, city, postal code"
                  className="input"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Household Notes</label>
                <textarea
                  className="textarea !h-16"
                  placeholder="Billing preferences, sibling relations..."
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingFamily(null);
                  }}
                  className="btn btn-ghost text-xs"
                  disabled={isSavingFamily}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs"
                  disabled={isSavingFamily}
                >
                  {isSavingFamily ? 'Saving...' : editingFamily ? 'Save Changes' : 'Create Household'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Household Confirmation Modal */}
      <ConfirmDialogModal
        isOpen={!!familyToDelete}
        onClose={() => setFamilyToDelete(null)}
        onConfirm={handleConfirmDeleteFamily}
        title="Delete Family Household"
        message={`Are you sure you want to permanently delete household "${familyToDelete?.household_name}" (${familyToDelete?.family_code})?`}
        confirmText="Delete Household"
        variant="danger"
        isConfirming={isDeletingFamily}
        warningDetails={
          familyToDelete?.students && familyToDelete.students.length > 0
            ? [
                `⚠️ This household currently has ${familyToDelete.students.length} linked active student(s): ${familyToDelete.students.map(s => `${s.first_name} ${s.last_name}`).join(', ')}.`,
                'The system requires active students to be unlinked or reassigned before this household can be removed.',
                'If attempted with active students linked, the server will reject the deletion.',
              ]
            : [
                'This household currently has no linked active students.',
                'The household profile and guardian contact details will be permanently removed.',
                'This action is logged in the administrative staff audit trail.',
              ]
        }
      />
    </div>
  );
};
