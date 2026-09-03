import React, { useState, useEffect, useRef } from 'react';
import { useStaff } from '../../context/StaffContext';
import { useNotification } from '../../context/NotificationContext';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ClipboardCheck,
  Home,
  Receipt,
  Scale,
  Bell,
  TrendingUp,
  Vault,
  History,
  Settings,
  DownloadCloud,
  Search,
  Plus,
  Moon,
  Sun,
  ChevronRight,
  Shield,
  CreditCard,
  Package,
  HelpCircle,
  Maximize2,
  Minimize2,
  CheckCheck,
  Trash2,
} from 'lucide-react';

interface AppShellProps {
  currentView: string;
  onNavigate: (view: string, id?: string) => void;
  onOpenNewApplicant: () => void;
  onOpenNewIncome: () => void;
  onOpenNewExpense: () => void;
  onOpenGlobalSearch: () => void;
  onOpenGuidedEnroll: () => void;
  onOpenQuickPayment: () => void;
  onOpenHelp: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentView,
  onNavigate,
  onOpenNewApplicant,
  onOpenNewIncome,
  onOpenNewExpense,
  onOpenGlobalSearch,
  onOpenGuidedEnroll,
  onOpenQuickPayment,
  onOpenHelp,
  children,
}) => {
  const { activeStaff, openSwitchModal } = useStaff();
  const { notificationsList, unreadCount, markAllAsRead, clearNotifications } = useNotification();
  const [reminderCount, setReminderCount] = useState<number>(0);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem('elite_theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      return true;
    } else if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
      return false;
    }
    return document.documentElement.classList.contains('dark');
  });

  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => {
    return (localStorage.getItem('elite_table_density') as any) || 'comfortable';
  });

  useEffect(() => {
    if (density === 'compact') {
      document.body.classList.add('density-compact');
      document.body.classList.remove('density-comfortable');
    } else {
      document.body.classList.add('density-comfortable');
      document.body.classList.remove('density-compact');
    }
    localStorage.setItem('elite_table_density', density);
  }, [density]);

  const toggleDensity = () => {
    setDensity((prev) => (prev === 'comfortable' ? 'compact' : 'comfortable'));
  };

  const toggleDarkMode = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    setIsDarkMode(isDark);
    localStorage.setItem('elite_theme', isDark ? 'dark' : 'light');
  };

  useEffect(() => {
    // Fetch reminder count
    const fetchReminderCount = async () => {
      try {
        const res = await fetch('/api/reminders');
        if (res.ok) {
          const data = await res.json();
          const total =
            (data.overdueBalances?.length || 0) +
            (data.stalledApplicants?.length || 0) +
            (data.upcomingAssessments?.length || 0);
          setReminderCount(total);
        }
      } catch (err) {
        console.error('Failed to load reminders count:', err);
      }
    };
    fetchReminderCount();
    const interval = setInterval(fetchReminderCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close notifications menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setShowNotificationsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard, section: 'Overview', hint: 'Overview' },
    { id: 'admissions', label: 'Admissions Funnel', icon: GraduationCap, section: 'Admissions', hint: 'Pipeline' },
    { id: 'assessments', label: 'Admissions Assessments', icon: ClipboardCheck, section: 'Admissions', hint: 'Testing' },
    { id: 'families', label: 'Households & Families', icon: Home, section: 'Admissions', hint: 'Guardians' },
    { id: 'fees', label: 'Fees & Income Ledger', icon: Receipt, section: 'Bursary & Finance', hint: 'Receipts' },
    { id: 'balances', label: 'Outstanding Balances', icon: Scale, section: 'Bursary & Finance', hint: 'Aging Ledger' },
    { id: 'reminders', label: 'Actionable Reminders', icon: Bell, badge: reminderCount, section: 'Bursary & Finance', hint: 'Overdue & Alerts' },
    { id: 'cashflow', label: 'Expenses (Cash Flow)', icon: TrendingUp, section: 'Operations', hint: 'Operational Outflows' },
    { id: 'cashdrawer', label: 'Daily Cash Drawer', icon: Vault, section: 'Operations', hint: 'Counter Cash Balancing' },
    { id: 'assets', label: 'Assets & Inventory', icon: Package, section: 'Operations', hint: 'Asset Register' },
    { id: 'audit', label: 'Security & Audit Trail', icon: History, section: 'Administration', hint: 'Staff Logs' },
    { id: 'settings', label: 'School & Staff Settings', icon: Settings, section: 'Administration', hint: 'Config & PIN' },
    { id: 'export', label: 'Backup & SQLite Export', icon: DownloadCloud, section: 'Administration', hint: 'Database Files' },
  ];

  // Group nav items by section
  const sections = ['Overview', 'Admissions', 'Bursary & Finance', 'Operations', 'Administration'];

  const getPageTitle = () => {
    if (currentView === 'dossier') return 'Applicant Dossier & Records';
    const found = navItems.find((i) => i.id === currentView);
    return found ? found.label : 'Elite International School';
  };

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar flex flex-col justify-between select-none">
        <div className="flex flex-col flex-1 min-h-0">
          {/* School Brand Mark */}
          <div className="flex items-center gap-3 px-2.5 py-3 mb-2 border-b border-sidebar-border flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 p-1 border border-sidebar-border/80 flex-shrink-0 flex items-center justify-center shadow-xs">
              <img
                src="/school-logo.png"
                alt="Elite International School"
                className="w-full h-full object-contain rounded-md"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0 flex-1 flex flex-col justify-center">
              <h1 className="font-serif font-bold text-[13.5px] leading-[1.22] text-sidebar-foreground tracking-tight">
                Elite International School
              </h1>
              <p className="text-[10px] uppercase font-mono tracking-widest text-sidebar-foreground/60 mt-1 font-medium">
                Matara
              </p>
            </div>
          </div>

          {/* Navigation Links grouped by section */}
          <div className="space-y-3.5 py-1.5 overflow-y-auto flex-1 sidebar-scrollable pr-3">
            {sections.map((secName) => {
              const items = navItems.filter((i) => i.section === secName);
              if (items.length === 0) return null;
              return (
                <div key={secName} className="space-y-0.5">
                  <div className="eyebrow px-3 py-1 !text-sidebar-foreground/50">{secName}</div>
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentView === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className={`sidebar-link w-full text-left flex items-center justify-between group ${
                          isActive ? 'active' : ''
                        }`}
                        title={item.hint}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={`w-4 h-4 flex-shrink-0 ${
                              isActive ? 'text-accent' : 'text-sidebar-foreground/70'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="badge-pill bg-destructive text-destructive-foreground mono font-bold text-[10px] px-1.5 py-0.2 rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom: Active Staff Card & Switcher */}
        <div className="p-2 border-t border-sidebar-border mt-auto flex-shrink-0">
          <div
            onClick={openSwitchModal}
            className="flex items-center justify-between p-2.5 rounded-xl bg-sidebar-accent/50 hover:bg-sidebar-accent border border-sidebar-border/50 cursor-pointer transition-all group"
            title="Click to Switch Active Staff Profile"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-xs">
                {activeStaff?.avatar_initials || 'MP'}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-semibold text-sidebar-foreground truncate flex items-center gap-1.5">
                  {activeStaff?.name || 'Malki Perera'}
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                </div>
                <div className="text-[10px] text-sidebar-foreground/60 truncate font-mono">
                  {activeStaff?.role || 'Office Staff'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-sidebar-foreground/40 group-hover:text-sidebar-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-wrap flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="topbar">
          {/* Left: Omni-Search Bar */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onOpenGlobalSearch}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-border bg-card/70 hover:bg-card text-muted-foreground hover:text-foreground text-xs transition-all shadow-xs w-64 md:w-80 justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
                <span className="truncate">Search students, guardians, receipts...</span>
              </span>
              <kbd className="mono text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border flex-shrink-0 font-medium">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right: Task-Oriented Actions & Utility Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">

            {/* Task-Oriented Workflows */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenGuidedEnroll}
                className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Enroll a New Student (5-Step Guided Flow)"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Enroll Student</span>
              </button>

              <button
                onClick={onOpenQuickPayment}
                className="btn btn-soft text-xs py-1.5 px-2.5 flex items-center gap-1.5 border border-border hover:!bg-primary hover:!text-primary-foreground hover:!border-primary transition-all cursor-pointer group"
                title="Walk-in Parent Payment Terminal"
              >
                <CreditCard className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:text-primary-foreground" />
                <span className="hidden sm:inline">Walk-In Payment</span>
              </button>
            </div>

            <div className="h-5 w-px bg-border mx-1 hidden sm:block"></div>

            {/* Density Mode Toggle */}
            <button
              onClick={toggleDensity}
              className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              title={`Toggle Table Spacing: Currently ${density}`}
            >
              {density === 'comfortable' ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Help & Tour Trigger */}
            <button
              onClick={onOpenHelp}
              className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              title="Help, Keyboard Shortcuts & Tour"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Notifications Bell Dropdown */}
            <div className="relative" ref={notifMenuRef}>
              <button
                onClick={() => setShowNotificationsMenu((prev) => !prev)}
                className="relative p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                title="Notifications & Activity Log"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center font-mono animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Box */}
              {showNotificationsMenu && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-card border border-border shadow-xl z-50 p-3 space-y-2 animate-fade">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-primary" />
                      <span className="font-serif font-bold text-xs text-foreground">
                        Recent Alerts & Notices
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={markAllAsRead}
                        className="text-[10px] text-primary hover:underline font-medium flex items-center gap-1"
                      >
                        <CheckCheck className="w-3 h-3" />
                        <span>Mark read</span>
                      </button>
                      <button
                        onClick={clearNotifications}
                        className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                    {notificationsList.length > 0 ? (
                      notificationsList.map((n) => (
                        <div
                          key={n.id}
                          className={`p-2.5 rounded-xl border text-xs transition-colors ${
                            n.read
                              ? 'bg-muted/30 border-transparent opacity-80'
                              : 'bg-primary/5 border-primary/20'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-semibold text-foreground text-[11px]">
                              {n.title}
                            </span>
                            <span className="text-[9px] font-mono text-muted-foreground">
                              {n.timestamp}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            {n.message}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-xs text-muted-foreground py-4">
                        No notifications or alerts.
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border/60 text-center">
                    <button
                      onClick={() => {
                        setShowNotificationsMenu(false);
                        onNavigate('reminders');
                      }}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      View All Actionable Reminders ({reminderCount}) →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Dark/Light Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              title="Toggle Color Theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-accent" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* View Content Viewport */}
        <main className="page">
          {children}
        </main>
      </div>
    </div>
  );
};
