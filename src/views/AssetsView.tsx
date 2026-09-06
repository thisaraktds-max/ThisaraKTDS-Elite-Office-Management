import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStaff } from '../context/StaffContext';
import { useNotification } from '../context/NotificationContext';
import { Asset } from '../types';
import { TableSkeleton } from '../components/common/SkeletonLoader';
import { EmptyState } from '../components/common/EmptyState';
import { formatCurrency } from '../utils/format';
import {
  Package,
  Plus,
  Search,
  Filter,
  DollarSign,
  Archive,
  Edit2,
  Trash2,
  Download,
  Printer,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Building,
  Tag,
  Calendar,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const AssetsView: React.FC = () => {
  const { activeStaff, getHeaders } = useStaff();
  const { showToast } = useNotification();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [summary, setSummary] = useState<{
    totalActiveValue: number;
    totalAllValue: number;
    totalCount: number;
    activeCount: number;
    retiredCount: number;
  }>({
    totalActiveValue: 0,
    totalAllValue: 0,
    totalCount: 0,
    activeCount: 0,
    retiredCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [conditionFilter, setConditionFilter] = useState('all');

  // Add / Edit Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [formData, setFormData] = useState({
    item_name: '',
    category: 'Furniture' as Asset['category'],
    purchase_date: new Date().toISOString().substring(0, 10),
    purchase_price: '',
    current_location: 'Main Campus',
    condition: 'Good' as Asset['condition'],
    notes: '',
  });

  // Delete confirm modal state
  const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null);

  const categories: Asset['category'][] = [
    'Furniture',
    'Electronics',
    'Maintenance Equipment',
    'Textbooks',
    'Sports Equipment',
    'Lab Equipment',
    'Vehicles',
    'Other',
  ];

  const conditions: Asset['condition'][] = ['New', 'Good', 'Fair', 'Poor', 'Retired'];

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (conditionFilter !== 'all') params.append('condition', conditionFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`/api/assets?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (err) {
      console.error('Failed to load assets:', err);
      showToast('Error loading asset register', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [categoryFilter, conditionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAssets();
  };

  const handleOpenAdd = () => {
    setEditingAsset(null);
    setFormData({
      item_name: '',
      category: 'Furniture',
      purchase_date: new Date().toISOString().substring(0, 10),
      purchase_price: '',
      current_location: 'Main Campus',
      condition: 'Good',
      notes: '',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setFormData({
      item_name: asset.item_name,
      category: asset.category,
      purchase_date: asset.purchase_date,
      purchase_price: asset.purchase_price.toString(),
      current_location: asset.current_location,
      condition: asset.condition,
      notes: asset.notes || '',
    });
    setShowModal(true);
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.item_name.trim() || !formData.purchase_price) {
      showToast('Please provide item name and purchase price', 'error');
      return;
    }

    try {
      if (editingAsset) {
        // Update
        const res = await fetch(`/api/assets/${editingAsset.id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({
            ...formData,
            purchase_price: parseFloat(formData.purchase_price) || 0,
          }),
        });
        if (res.ok) {
          showToast(`Asset "${formData.item_name}" updated successfully`, 'success');
          setShowModal(false);
          fetchAssets();
        } else {
          const err = await res.json();
          showToast(err.error || 'Failed to update asset', 'error');
        }
      } else {
        // Create
        const res = await fetch('/api/assets', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            ...formData,
            purchase_price: parseFloat(formData.purchase_price) || 0,
          }),
        });
        if (res.ok) {
          showToast(`Asset "${formData.item_name}" registered successfully`, 'success');
          setShowModal(false);
          fetchAssets();
        } else {
          const err = await res.json();
          showToast(err.error || 'Failed to register asset', 'error');
        }
      }
    } catch (err) {
      console.error('Error saving asset:', err);
      showToast('Network error while saving asset', 'error');
    }
  };

  const handleRetireAsset = async (asset: Asset) => {
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ condition: 'Retired' }),
      });
      if (res.ok) {
        showToast(`Asset "${asset.item_name}" marked as Retired`, 'success');
        fetchAssets();
      }
    } catch (err) {
      showToast('Failed to update asset condition', 'error');
    }
  };

  const handleDeleteAsset = async () => {
    if (!deletingAsset) return;
    try {
      const res = await fetch(`/api/assets/${deletingAsset.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast(`Asset "${deletingAsset.item_name}" removed from registry`, 'success');
        setDeletingAsset(null);
        fetchAssets();
      }
    } catch (err) {
      showToast('Failed to delete asset', 'error');
    }
  };

  const exportToExcel = () => {
    if (assets.length === 0) {
      showToast('No asset data to export', 'error');
      return;
    }
    const exportData = assets.map((a) => ({
      'Asset ID': a.id,
      'Item Name': a.item_name,
      Category: a.category,
      'Purchase Date': a.purchase_date,
      'Purchase Price (LKR)': a.purchase_price,
      Location: a.current_location,
      Condition: a.condition,
      Notes: a.notes || '',
      'Registered By': a.created_by,
      'Registered At': a.created_at,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'School Assets');
    XLSX.writeFile(wb, `Elite_School_Asset_Register_${new Date().toISOString().substring(0, 10)}.xlsx`);
    showToast('Asset register exported to Excel', 'success');
  };

  const getConditionBadge = (condition: Asset['condition']) => {
    switch (condition) {
      case 'New':
        return <span className="badge-pill whitespace-nowrap bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-medium">New</span>;
      case 'Good':
        return <span className="badge-pill whitespace-nowrap bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 font-medium">Good</span>;
      case 'Fair':
        return <span className="badge-pill whitespace-nowrap bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-medium">Fair</span>;
      case 'Poor':
        return <span className="badge-pill whitespace-nowrap bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 font-medium">Poor</span>;
      case 'Retired':
        return <span className="badge-pill whitespace-nowrap bg-muted text-muted-foreground border border-border font-medium">Retired</span>;
      default:
        return <span className="badge-pill whitespace-nowrap">{condition}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2.5">
            <Package className="w-6 h-6 text-primary" />
            Asset & Inventory Register
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track school furniture, electronics, laboratory gear, and operational assets with valuation & condition audit.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            className="btn btn-soft text-xs py-2 px-3 flex items-center gap-1.5 cursor-pointer"
            title="Export Asset Register to XLSX Spreadsheet"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="btn btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Asset</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="panel p-4 bg-gradient-to-br from-card to-card/60">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider">Active Inventory Value</span>
            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-foreground">
            LKR {formatCurrency(summary.totalActiveValue)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{summary.activeCount}</span> active items in service
          </div>
        </div>

        <div className="panel p-4 bg-gradient-to-br from-card to-card/60">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider">Total Registered Assets</span>
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-bold font-mono text-foreground">
            {summary.totalCount} <span className="text-xs font-normal text-muted-foreground">Items</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Across {categories.length} campus departments
          </div>
        </div>

        <div className="panel p-4 bg-gradient-to-br from-card to-card/60">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider">Operational Condition</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-xl font-bold font-mono text-foreground">
            {Math.round((summary.activeCount / (summary.totalCount || 1)) * 100)}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Healthy & in active operational rotation
          </div>
        </div>

        <div className="panel p-4 bg-gradient-to-br from-card to-card/60">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider">Retired / Decommissioned</span>
            <Archive className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-xl font-bold font-mono text-foreground">
            {summary.retiredCount} <span className="text-xs font-normal text-muted-foreground">Archived</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Replaced or retired from ledger
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="panel p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 bg-card/80">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search asset, location, custodian..."
            className="input !pl-10 !pr-3 !h-9 text-xs w-full"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="w-3.5 h-3.5" />
            <span>Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input py-1 px-2 text-xs bg-card"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Condition Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Condition:</span>
            <select
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value)}
              className="input py-1 px-2 text-xs bg-card"
            >
              <option value="all">All Conditions</option>
              {conditions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchAssets}
            className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all ml-auto md:ml-0"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Assets Table */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4">Item & Description</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Current Location</th>
                <th className="py-3 px-4">Condition</th>
                <th className="py-3 px-4">Purchase Date</th>
                <th className="py-3 px-4 text-right">Value (LKR)</th>
                <th className="py-3 px-4">Recorded By</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-4">
                    <TableSkeleton rows={6} />
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4">
                    <EmptyState
                      iconType="ledger"
                      title="No Asset Records Found"
                      description="No asset records match your filters. Register equipment or adjust your search filters above."
                      actionLabel="Register Asset"
                      onAction={() => setShowModal(true)}
                    />
                  </td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">{asset.item_name}</div>
                      {asset.notes && (
                        <div className="text-[11px] text-muted-foreground truncate max-w-xs mt-0.5">
                          {asset.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="badge-pill whitespace-nowrap bg-muted font-medium text-foreground/80">
                        {asset.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground/90">
                      <div className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{asset.current_location}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">{getConditionBadge(asset.condition)}</td>
                    <td className="py-3 px-4 text-muted-foreground font-mono text-[11px]">
                      {asset.purchase_date}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                      LKR {formatCurrency(asset.purchase_price)}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-[11px]">
                      {asset.created_by}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {asset.condition !== 'Retired' && (
                          <button
                            onClick={() => handleRetireAsset(asset)}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-amber-600 transition-colors"
                            title="Retire Asset (Decommission)"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEdit(asset)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                          title="Edit Asset Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingAsset(asset)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete Asset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Asset Modal */}
      {showModal && createPortal(
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal !max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                <h3 className="text-base font-serif font-bold text-foreground">
                  {editingAsset ? 'Edit Asset Record' : 'Register New Asset'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAsset} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-muted-foreground font-medium mb-1">Item / Asset Name *</label>
                <input
                  type="text"
                  required
                  value={formData.item_name}
                  onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                  placeholder="e.g. Dell OptiPlex Desktop 7090 or Classroom Teak Desk"
                  className="input w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="input w-full"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Current Condition</label>
                  <select
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value as any })}
                    className="input w-full"
                  >
                    {conditions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Purchase Price (LKR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                    placeholder="0.00"
                    className="input w-full font-mono"
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">Current Location / Room *</label>
                <input
                  type="text"
                  required
                  value={formData.current_location}
                  onChange={(e) => setFormData({ ...formData, current_location: e.target.value })}
                  placeholder="e.g. Reception, Library, Science Lab A, Main Hall"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">Notes & Serial / Model Numbers</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Warranty dates, vendor contact, serial number, maintenance status..."
                  className="input w-full"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-soft text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary text-xs">
                  {editingAsset ? 'Save Asset Changes' : 'Register Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Dialog */}
      {deletingAsset && createPortal(
        <div className="modal-backdrop" onClick={() => setDeletingAsset(null)}>
          <div className="modal !max-w-sm space-y-4 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-serif font-bold text-foreground">Remove Asset from Register?</h3>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to permanently delete <strong className="text-foreground">{deletingAsset.item_name}</strong>? This action will be audited.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeletingAsset(null)}
                className="btn btn-soft text-xs w-28"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAsset}
                className="btn btn-destructive text-xs w-28"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
