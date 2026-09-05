import React, { useState, useEffect } from 'react';
import { AuditLog } from '../types';
import { History, Search, ShieldCheck, Filter, User } from 'lucide-react';
import { TableSkeleton } from '../components/common/SkeletonLoader';
import { EmptyState } from '../components/common/EmptyState';
import { useStaff } from '../context/StaffContext';

export const AuditLogView: React.FC = () => {
  const { staffList } = useStaff();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [staffFilter, setStaffFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const uniqueStaff = Array.from(new Set(logs.map(l => l.staff_name)));
  const uniqueActions = Array.from(new Set(logs.map(l => l.action_type)));

  const filtered = logs.filter(l => {
    if (staffFilter !== 'all' && l.staff_name !== staffFilter) return false;
    if (actionFilter !== 'all' && l.action_type !== actionFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        l.details.toLowerCase().includes(q) ||
        l.staff_name.toLowerCase().includes(q) ||
        l.action_type.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border">
        <div>
          <div className="eyebrow">Institutional Governance</div>
          <h3 className="text-lg font-serif font-bold text-foreground">Security Audit Trail & Activity Logs</h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="select !h-8 !py-0 !text-xs !w-36"
            value={staffFilter}
            onChange={e => setStaffFilter(e.target.value)}
          >
            <option value="all">All Staff</option>
            {uniqueStaff.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            className="select !h-8 !py-0 !text-xs !w-36"
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
          >
            <option value="all">All Action Types</option>
            {uniqueActions.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <div className="relative w-60">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search audit details..."
              className="input !h-8 !pl-10 !text-xs w-full"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="panel overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={8} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-clean w-full">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Staff Member</th>
                  <th>Action Category</th>
                  <th>Record Type</th>
                  <th>Audit Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr key={l.id}>
                    <td className="mono text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(l.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        {(() => {
                          const matchedStaff = staffList.find(s => s.name.toLowerCase() === l.staff_name.toLowerCase());
                          if (matchedStaff?.photo_url) {
                            return (
                              <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 border border-border">
                                <img src={matchedStaff.photo_url} alt={l.staff_name} className="w-full h-full object-cover" />
                              </div>
                            );
                          }
                          if (matchedStaff?.avatar_initials) {
                            return (
                              <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                {matchedStaff.avatar_initials}
                              </div>
                            );
                          }
                          return <ShieldCheck className="w-3.5 h-3.5 text-accent" />;
                        })()}
                        <span>{l.staff_name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="mono text-[11px] font-bold px-2 py-0.5 rounded bg-muted">
                        {l.action_type}
                      </span>
                    </td>
                    <td className="text-xs text-muted-foreground capitalize">{l.record_type}</td>
                    <td className="text-xs text-foreground leading-relaxed">{l.details}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4">
                      <EmptyState
                        iconType="ledger"
                        title="No Audit Logs Found"
                        description="No matching security or audit trail records found for current filters."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
