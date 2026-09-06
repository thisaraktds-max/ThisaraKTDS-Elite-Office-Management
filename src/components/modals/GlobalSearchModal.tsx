import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { formatCurrency } from '../../utils/format';
import {
  Search,
  User,
  Users,
  Receipt,
  CreditCard,
  PlusCircle,
  ArrowRight,
  X,
  History,
  Clock,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string, id?: string) => void;
  onOpenNewApplicant: () => void;
  onOpenNewIncome: () => void;
  onOpenNewExpense: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenNewApplicant,
  onOpenNewIncome,
  onOpenNewExpense,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{
    applicants: any[];
    families: any[];
    income: any[];
    expenses: any[];
  }>({ applicants: [], families: [], income: [], expenses: [] });
  const [recentStudents, setRecentStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      try {
        const recents = localStorage.getItem('elite_recent_students');
        if (recents) {
          setRecentStudents(JSON.parse(recents).slice(0, 4));
        }
      } catch (e) {}
    } else {
      setQuery('');
      setResults({ applicants: [], families: [], income: [], expenses: [] });
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ applicants: [], families: [], income: [], expenses: [] });
      return;
    }
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query]);

  // Flatten items for keyboard navigation
  const allItems: Array<{ type: string; item: any; action: () => void }> = [];

  // If empty query, show recent students + quick shortcuts
  if (!query.trim()) {
    recentStudents.forEach((st) => {
      allItems.push({
        type: 'recent_student',
        item: st,
        action: () => {
          onClose();
          onNavigate('dossier', st.id);
        },
      });
    });

    allItems.push(
      {
        type: 'shortcut',
        item: { title: 'Register New Applicant', icon: 'user' },
        action: () => {
          onClose();
          onOpenNewApplicant();
        },
      },
      {
        type: 'shortcut',
        item: { title: 'Record Income / Fee Payment', icon: 'receipt' },
        action: () => {
          onClose();
          onOpenNewIncome();
        },
      },
      {
        type: 'shortcut',
        item: { title: 'Record Office Expense', icon: 'card' },
        action: () => {
          onClose();
          onOpenNewExpense();
        },
      },
      {
        type: 'shortcut',
        item: { title: 'Admissions Funnel', icon: 'nav' },
        action: () => {
          onClose();
          onNavigate('admissions');
        },
      },
      {
        type: 'shortcut',
        item: { title: 'Outstanding Balances & Aging Ledger', icon: 'nav' },
        action: () => {
          onClose();
          onNavigate('balances');
        },
      }
    );
  } else {
    results.applicants.forEach((a) => {
      allItems.push({
        type: 'applicant',
        item: a,
        action: () => {
          // Save to recent
          try {
            const cur = JSON.parse(localStorage.getItem('elite_recent_students') || '[]');
            const filtered = [a, ...cur.filter((c: any) => c.id !== a.id)].slice(0, 8);
            localStorage.setItem('elite_recent_students', JSON.stringify(filtered));
          } catch (e) {}
          onClose();
          onNavigate('dossier', a.id);
        },
      });
    });
    results.families.forEach((f) => {
      allItems.push({
        type: 'family',
        item: f,
        action: () => {
          onClose();
          onNavigate('families');
        },
      });
    });
    results.income.forEach((i) => {
      allItems.push({
        type: 'income',
        item: i,
        action: () => {
          onClose();
          onNavigate('fees');
        },
      });
    });
    results.expenses.forEach((e) => {
      allItems.push({
        type: 'expense',
        item: e,
        action: () => {
          onClose();
          onNavigate('cashflow');
        },
      });
    });
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < allItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        allItems[selectedIndex].action();
      }
    }
  };

  useLockBodyScroll(isOpen);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal !max-w-2xl !p-0 overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search header */}
        <div className="flex items-center px-4 border-b border-border bg-card">
          <Search className="w-5 h-5 text-muted-foreground mr-3" />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent border-0 py-4 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            placeholder="Type student name, application #, parent phone, receipt #, or keyword..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Results body */}
        <div className="max-h-96 overflow-y-auto p-3">
          {isLoading && (
            <div className="p-4 text-center text-xs text-muted-foreground">Searching records...</div>
          )}

          {!isLoading && allItems.length === 0 && query && (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-xs">No matching records found for "{query}"</p>
            </div>
          )}

          {!query && (
            <div className="space-y-4 px-2 py-1">
              {/* Recently Viewed */}
              {recentStudents.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-primary" />
                    <span>Recently Opened Students</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {recentStudents.map((st) => (
                      <div
                        key={st.id}
                        onClick={() => {
                          onClose();
                          onNavigate('dossier', st.id);
                        }}
                        className="p-2 rounded-lg bg-card border border-border hover:border-primary/50 hover:bg-muted/40 cursor-pointer flex items-center justify-between text-xs transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] font-mono">
                            {st.first_name?.[0]}
                            {st.last_name?.[0]}
                          </div>
                          <span className="font-semibold text-foreground">
                            {st.first_name} {st.last_name}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {st.grade_applying}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
                  Quick Actions & Shortcuts
                </div>
                <div className="space-y-1">
                  {allItems
                    .filter((e) => e.type === 'shortcut')
                    .map((entry, idx) => {
                      const absoluteIdx = allItems.indexOf(entry);
                      return (
                        <div
                          key={idx}
                          onClick={entry.action}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                            selectedIndex === absoluteIdx
                              ? 'bg-primary text-primary-foreground font-semibold'
                              : 'hover:bg-muted text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <PlusCircle className="w-3.5 h-3.5 text-accent" />
                            <span>{entry.item.title}</span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 opacity-50" />
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {query && (
            <div className="space-y-3">
              {/* Applicants */}
              {results.applicants.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider font-semibold text-muted-foreground px-3 mb-1">
                    Students & Applicants ({results.applicants.length})
                  </div>
                  <div className="space-y-1">
                    {results.applicants.map((app) => {
                      const idx = allItems.findIndex(
                        (i) => i.type === 'applicant' && i.item.id === app.id
                      );
                      const isSelected = selectedIndex === idx;
                      return (
                        <div
                          key={app.id}
                          onClick={() => {
                            onClose();
                            onNavigate('dossier', app.id);
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-primary text-primary-foreground font-semibold'
                              : 'hover:bg-muted text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <GraduationCap className="w-4 h-4 flex-shrink-0" />
                            <div>
                              <div className="font-semibold flex items-center gap-1.5">
                                <span>
                                  {app.first_name} {app.last_name}
                                </span>
                                <span
                                  className={`text-[10px] font-mono ${
                                    isSelected
                                      ? 'text-primary-foreground/80'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  ({app.application_no})
                                </span>
                              </div>
                              <div
                                className={`text-[11px] ${
                                  isSelected
                                    ? 'text-primary-foreground/80'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {app.grade_applying} • Parent: {app.guardian_name} ({app.guardian_phone})
                              </div>
                            </div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 opacity-50" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Families */}
              {results.families.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider font-semibold text-muted-foreground px-3 mb-1">
                    Households ({results.families.length})
                  </div>
                  <div className="space-y-1">
                    {results.families.map((fam) => (
                      <div
                        key={fam.id}
                        onClick={() => {
                          onClose();
                          onNavigate('families');
                        }}
                        className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted text-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Users className="w-4 h-4 text-primary" />
                          <div>
                            <div className="font-semibold text-foreground">
                              {fam.household_name} ({fam.family_code})
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {fam.primary_guardian_name} • {fam.primary_phone}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Income */}
              {results.income.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider font-semibold text-muted-foreground px-3 mb-1">
                    Fee Receipts ({results.income.length})
                  </div>
                  <div className="space-y-1">
                    {results.income.map((inc) => (
                      <div
                        key={inc.id}
                        onClick={() => {
                          onClose();
                          onNavigate('fees');
                        }}
                        className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted text-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <div>
                            <div className="font-semibold font-mono text-foreground">
                              {inc.receipt_no} - LKR {formatCurrency(inc.amount)}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Paid by {inc.payer_name} • {inc.date} ({inc.payment_method})
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
