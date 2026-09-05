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
} from 'lucide-react';

export const FamiliesView: React.FC<{ onOpenDossier: (id: string) => void }> = ({ onOpenDossier }) => {
  const { getHeaders } = useStaff();
  const { showToast } = useNotification();
  const [families, setFamilies] = useState<Family[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

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
      const res = await fetch('/api/families');
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

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.household_name || !form.primary_guardian_name || !form.primary_phone) {
      showToast('Please fill all required household details', 'error');
      return;
    }
    try {
      const res = await fetch('/api/families', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Created household account ${form.household_name} (${data.family_code})`, 'success');
        setShowAddModal(false);
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
        fetchFamilies();
      }
    } catch (err) {
      showToast('Failed to create family', 'error');
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
            onClick={() => setShowAddModal(true)}
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
                  <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent-foreground flex items-center justify-center font-bold text-xs">
                    <Users className="w-4 h-4 text-accent" />
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
                  Total Credited: <strong className="text-foreground">${Number(fam.total_paid || 0).toFixed(2)}</strong>
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
                onAction={() => setShowAddModal(true)}
              />
            </div>
          )}
        </div>
      )}

      {/* Add Household Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal !max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="eyebrow">Household Management</div>
            <h3 className="text-lg font-serif font-bold text-foreground mb-4">Create Family Household Record</h3>

            <form onSubmit={handleCreateFamily} className="space-y-3">
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
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-ghost text-xs">Cancel</button>
                <button type="submit" className="btn btn-primary text-xs">Create Household</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
