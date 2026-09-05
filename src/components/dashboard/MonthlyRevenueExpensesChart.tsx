import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  ArrowDownLeft,
  ArrowUpRight,
  X,
  ChevronRight,
} from 'lucide-react';
import { MonthlyFinancial } from '../../types';

interface MonthlyRevenueExpensesChartProps {
  data: MonthlyFinancial[];
  currency?: string;
  onNavigate?: (view: string, id?: string) => void;
  onOpenNewIncome?: () => void;
  onOpenNewExpense?: () => void;
}

type ChartMode = 'dual' | 'area' | 'net';
type TimeRange = '6m' | '12m';

interface EnrichedMonthlyFinancial extends MonthlyFinancial {
  revenueGrowthPct?: number | null;
  expenseGrowthPct?: number | null;
  prevRevenue?: number;
  prevExpense?: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  currency: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, currency }) => {
  if (!active || !payload || payload.length === 0) return null;

  const itemData = payload[0]?.payload as EnrichedMonthlyFinancial;
  if (!itemData) return null;

  const revenue = itemData.revenue || 0;
  const expenses = itemData.expenses || 0;
  const net = itemData.net || 0;
  const isPositive = net >= 0;
  const margin = revenue > 0 ? ((net / revenue) * 100).toFixed(1) : '0.0';

  return (
    <div className="bg-card/95 backdrop-blur-md border border-border shadow-lg rounded-xl p-3.5 text-xs min-w-[230px] space-y-2.5 pointer-events-none transition-all font-sans">
      {/* Tooltip Header */}
      <div className="flex items-center justify-between border-b border-border/80 pb-2">
        <span className="font-semibold text-foreground text-xs">
          {itemData.fullMonth}
        </span>
        <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded font-medium">
          {itemData.monthKey}
        </span>
      </div>

      {/* Figures Breakdown */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block shrink-0" />
            <span className="font-medium text-foreground">Tuition & Fees</span>
          </div>
          <div className="text-right">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
              +{currency} {revenue.toLocaleString()}
            </span>
            {itemData.revenueGrowthPct !== undefined && itemData.revenueGrowthPct !== null && (
              <span
                className={`block text-[10px] font-medium ${
                  itemData.revenueGrowthPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {itemData.revenueGrowthPct >= 0 ? '+' : ''}
                {itemData.revenueGrowthPct.toFixed(1)}% vs prev
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-rose-600 inline-block shrink-0" />
            <span className="font-medium text-foreground">Disbursements</span>
          </div>
          <div className="text-right">
            <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
              -{currency} {expenses.toLocaleString()}
            </span>
            {itemData.expenseGrowthPct !== undefined && itemData.expenseGrowthPct !== null && (
              <span
                className={`block text-[10px] font-medium ${
                  itemData.expenseGrowthPct <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {itemData.expenseGrowthPct >= 0 ? '+' : ''}
                {itemData.expenseGrowthPct.toFixed(1)}% vs prev
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Net Outcome */}
      <div className="pt-2 border-t border-border/80 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground font-medium">Operating Position</span>
        <div className="text-right">
          <span
            className={`font-semibold text-xs tabular-nums ${
              isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {isPositive ? '+' : ''}{currency} {net.toLocaleString()}
          </span>
          <span
            className={`block text-[10px] font-medium ${
              isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {isPositive ? `${margin}% operating surplus` : `${margin}% deficit`}
          </span>
        </div>
      </div>
    </div>
  );
};

export const MonthlyRevenueExpensesChart: React.FC<MonthlyRevenueExpensesChartProps> = ({
  data = [],
  currency = 'LKR',
  onNavigate,
  onOpenNewIncome,
  onOpenNewExpense,
}) => {
  const [range, setRange] = useState<TimeRange>('6m');
  const [chartMode, setChartMode] = useState<ChartMode>('dual');
  const [showAverage, setShowAverage] = useState<boolean>(false);
  const [pinnedMonth, setPinnedMonth] = useState<EnrichedMonthlyFinancial | null>(null);
  const [hoveredSeries, setHoveredSeries] = useState<'revenue' | 'expenses' | 'net' | null>(null);
  const [visibleSeries, setVisibleSeries] = useState<{ revenue: boolean; expenses: boolean }>({
    revenue: true,
    expenses: true,
  });

  // Calculate Month-over-Month percentages across data series
  const enrichedData = useMemo<EnrichedMonthlyFinancial[]>(() => {
    if (!data || data.length === 0) return [];
    return data.map((curr, idx) => {
      if (idx === 0) {
        return { ...curr, revenueGrowthPct: null, expenseGrowthPct: null };
      }
      const prev = data[idx - 1];
      const revenueGrowthPct =
        prev.revenue > 0 ? ((curr.revenue - prev.revenue) / prev.revenue) * 100 : null;
      const expenseGrowthPct =
        prev.expenses > 0 ? ((curr.expenses - prev.expenses) / prev.expenses) * 100 : null;
      return {
        ...curr,
        prevRevenue: prev.revenue,
        prevExpense: prev.expenses,
        revenueGrowthPct,
        expenseGrowthPct,
      };
    });
  }, [data]);

  // Sliced data based on selected time range
  const displayData = useMemo(() => {
    if (enrichedData.length === 0) return [];
    return range === '6m' ? enrichedData.slice(-6) : enrichedData.slice(-12);
  }, [enrichedData, range]);

  // Aggregate statistics for active period
  const stats = useMemo(() => {
    const totalRevenue = displayData.reduce((sum, item) => sum + (item.revenue || 0), 0);
    const totalExpenses = displayData.reduce((sum, item) => sum + (item.expenses || 0), 0);
    const netTotal = totalRevenue - totalExpenses;
    const monthsCount = Math.max(displayData.length, 1);
    const avgMonthlyRevenue = Math.round(totalRevenue / monthsCount);
    const avgMonthlyExpenses = Math.round(totalExpenses / monthsCount);
    const avgMonthlyNet = Math.round(netTotal / monthsCount);
    const marginRate = totalRevenue > 0 ? ((netTotal / totalRevenue) * 100).toFixed(1) : '0.0';
    const isSurplus = netTotal >= 0;

    const nonZeroData = displayData.filter((d) => d.revenue > 0 || d.expenses > 0);
    const topRevenueMonth = nonZeroData.length
      ? [...nonZeroData].sort((a, b) => b.revenue - a.revenue)[0]
      : null;

    return {
      totalRevenue,
      totalExpenses,
      netTotal,
      avgMonthlyRevenue,
      avgMonthlyExpenses,
      avgMonthlyNet,
      marginRate,
      isSurplus,
      monthsCount,
      topRevenueMonth,
    };
  }, [displayData]);

  const activeFocusedMonth = pinnedMonth || (displayData.length > 0 ? displayData[displayData.length - 1] : null);

  const toggleSeries = (series: 'revenue' | 'expenses') => {
    setVisibleSeries((prev) => {
      if (prev[series] && !prev[series === 'revenue' ? 'expenses' : 'revenue']) {
        return prev;
      }
      return { ...prev, [series]: !prev[series] };
    });
  };

  const formatYAxisTick = (val: number) => {
    if (val === 0) return '0';
    if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (Math.abs(val) >= 1000) return `${Math.round(val / 1000)}k`;
    return `${val}`;
  };

  const handleChartClick = (state: any) => {
    if (state && state.activePayload && state.activePayload.length > 0) {
      const selected = state.activePayload[0].payload as EnrichedMonthlyFinancial;
      if (pinnedMonth?.monthKey === selected.monthKey) {
        setPinnedMonth(null);
      } else {
        setPinnedMonth(selected);
      }
    }
  };

  return (
    <div className="panel p-5 sm:p-6 bg-card border border-border rounded-2xl shadow-xs space-y-5 transition-all">
      {/* Top Header & Compact Unified Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Title & Description */}
        <div>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Monthly Revenue & Expenses
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 font-normal">
            Cash flow ledger comparing student fee receipts against operational disbursements
          </p>
        </div>

        {/* Compact, Single-Row Controls Toolbar */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Period Toggle */}
          <div className="inline-flex items-center bg-muted/60 p-0.5 rounded-lg border border-border text-xs font-medium h-7.5">
            <button
              type="button"
              onClick={() => setRange('6m')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer h-full flex items-center ${
                range === '6m'
                  ? 'bg-card text-foreground font-semibold shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              6M
            </button>
            <button
              type="button"
              onClick={() => setRange('12m')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer h-full flex items-center ${
                range === '12m'
                  ? 'bg-card text-foreground font-semibold shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              12M
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="inline-flex items-center bg-muted/60 p-0.5 rounded-lg border border-border text-xs font-medium h-7.5">
            <button
              type="button"
              onClick={() => setChartMode('dual')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer h-full flex items-center ${
                chartMode === 'dual'
                  ? 'bg-card text-foreground font-semibold shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Dual Trend Bars"
            >
              Dual
            </button>
            <button
              type="button"
              onClick={() => setChartMode('area')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer h-full flex items-center ${
                chartMode === 'area'
                  ? 'bg-card text-foreground font-semibold shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Smooth Fill Area"
            >
              Area
            </button>
            <button
              type="button"
              onClick={() => setChartMode('net')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer h-full flex items-center ${
                chartMode === 'net'
                  ? 'bg-card text-foreground font-semibold shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Net Position"
            >
              Net
            </button>
          </div>

          {/* Compact Average Baseline Toggle */}
          <button
            type="button"
            onClick={() => setShowAverage(!showAverage)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer h-7.5 ${
              showAverage
                ? 'bg-primary/10 text-primary border-primary/40 font-semibold shadow-2xs'
                : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground hover:bg-muted'
            }`}
            title="Toggle average benchmark line on chart"
          >
            <span className="w-2.5 border-t border-dashed border-current opacity-70" />
            <span>Avg</span>
          </button>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Revenue */}
        <div
          onMouseEnter={() => setHoveredSeries('revenue')}
          onMouseLeave={() => setHoveredSeries(null)}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            hoveredSeries === 'revenue'
              ? 'border-emerald-600/60 bg-emerald-500/5 shadow-xs'
              : 'border-border bg-card hover:border-emerald-600/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5 text-foreground font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
              Total Revenue
            </span>
            <span className="text-[11px] text-muted-foreground">Period</span>
          </div>
          <div className="text-lg sm:text-xl font-bold tracking-tight text-foreground mt-2 tabular-nums">
            {currency} {stats.totalRevenue.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
            <span>Avg {currency} {stats.avgMonthlyRevenue.toLocaleString()}/mo</span>
          </div>
        </div>

        {/* Card 2: Expenses */}
        <div
          onMouseEnter={() => setHoveredSeries('expenses')}
          onMouseLeave={() => setHoveredSeries(null)}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            hoveredSeries === 'expenses'
              ? 'border-rose-600/60 bg-rose-500/5 shadow-xs'
              : 'border-border bg-card hover:border-rose-600/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5 text-foreground font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-600 inline-block" />
              Total Disbursements
            </span>
            <span className="text-[11px] text-muted-foreground">Period</span>
          </div>
          <div className="text-lg sm:text-xl font-bold tracking-tight text-foreground mt-2 tabular-nums">
            {currency} {stats.totalExpenses.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
            <span>Avg {currency} {stats.avgMonthlyExpenses.toLocaleString()}/mo</span>
          </div>
        </div>

        {/* Card 3: Net Margin */}
        <div
          onMouseEnter={() => setHoveredSeries('net')}
          onMouseLeave={() => setHoveredSeries(null)}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            hoveredSeries === 'net'
              ? 'border-primary/60 bg-primary/5 shadow-xs'
              : 'border-border bg-card hover:border-primary/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span className="font-semibold text-foreground">Net Operating Cash</span>
            <span className={`text-[11px] font-semibold ${stats.isSurplus ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
              {stats.marginRate}% margin
            </span>
          </div>
          <div
            className={`text-lg sm:text-xl font-bold tracking-tight mt-2 tabular-nums ${
              stats.isSurplus ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {stats.isSurplus ? '+' : ''}{currency} {stats.netTotal.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {stats.isSurplus ? 'Healthy operating surplus' : 'Operating deficit'}
          </div>
        </div>

        {/* Card 4: Peak Collections */}
        <div className="p-4 rounded-xl border border-border bg-card flex flex-col justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground">Peak Month</div>
            {stats.topRevenueMonth ? (
              <>
                <div className="text-sm font-semibold text-foreground mt-1 truncate">
                  {stats.topRevenueMonth.fullMonth}
                </div>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                  {currency} {stats.topRevenueMonth.revenue.toLocaleString()}
                </div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground mt-2">No records</div>
            )}
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('cashflow')}
              className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1 mt-2 cursor-pointer pt-1"
            >
              <span>View cash flow ledger</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Interactive Month Focus Banner (when clicked or selected) */}
      {activeFocusedMonth && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-muted/40 border border-border rounded-xl text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="font-semibold text-foreground">
              {pinnedMonth ? 'Pinned Month: ' : 'Active Month: '}
              <span className="text-primary">{activeFocusedMonth.fullMonth}</span>
            </span>
            {pinnedMonth && (
              <button
                type="button"
                onClick={() => setPinnedMonth(null)}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 bg-muted px-2 py-0.5 rounded cursor-pointer ml-1"
                title="Unpin month"
              >
                <X className="w-3 h-3" />
                <span className="text-[11px]">Clear pin</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div>
              <span className="text-muted-foreground mr-1.5">Tuition & Fees:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {currency} {activeFocusedMonth.revenue.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground mr-1.5">Disbursements:</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                {currency} {activeFocusedMonth.expenses.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground mr-1.5">Net Position:</span>
              <span
                className={`font-semibold tabular-nums ${
                  activeFocusedMonth.net >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {activeFocusedMonth.net >= 0 ? '+' : ''}
                {currency} {activeFocusedMonth.net.toLocaleString()}
              </span>
            </div>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('cashflow')}
                className="text-primary font-semibold hover:underline flex items-center gap-0.5 cursor-pointer ml-2"
              >
                <span>Audit month</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="w-full h-[320px] pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={displayData}
            margin={{ top: 14, right: 18, left: -6, bottom: 6 }}
            onClick={handleChartClick}
          >
            <defs>
              <linearGradient id="cleanRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
              </linearGradient>

              <linearGradient id="cleanExpensesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#e11d48" stopOpacity={0.16} />
                <stop offset="95%" stopColor="#e11d48" stopOpacity={0.0} />
              </linearGradient>

              <linearGradient id="cleanNetGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="hsl(var(--border))"
              opacity={0.4}
            />

            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
              tick={{
                fontSize: 11,
                fill: 'hsl(var(--muted-foreground))',
                fontFamily: 'var(--app-font-sans)',
                fontWeight: 500,
              }}
              dy={8}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{
                fontSize: 11,
                fill: 'hsl(var(--muted-foreground))',
                fontFamily: 'var(--app-font-sans)',
                fontWeight: 500,
              }}
              tickFormatter={formatYAxisTick}
              dx={-4}
            />

            <Tooltip
              content={<CustomTooltip currency={currency} />}
              cursor={{
                stroke: 'hsl(var(--muted-foreground))',
                strokeWidth: 1.5,
                strokeDasharray: '4 4',
                opacity: 0.6,
              }}
            />

            {/* Benchmark Average Line */}
            {showAverage && (
              <ReferenceLine
                y={chartMode === 'net' ? stats.avgMonthlyNet : stats.avgMonthlyRevenue}
                stroke="#64748b"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Avg: ${currency} ${(chartMode === 'net' ? stats.avgMonthlyNet : stats.avgMonthlyRevenue).toLocaleString()}`,
                  fill: '#64748b',
                  fontSize: 11,
                  fontFamily: 'var(--app-font-sans)',
                  fontWeight: 500,
                  position: 'insideTopRight',
                }}
              />
            )}

            {/* Zero Baseline for Net Position Mode */}
            {chartMode === 'net' && (
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
            )}

            {/* Mode: Net Position */}
            {chartMode === 'net' && (
              <Area
                type="monotone"
                dataKey="net"
                name="Net Operating Cash"
                stroke="#2563eb"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#cleanNetGradient)"
                dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#ffffff' }}
                activeDot={{ r: 6.5, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
                animationDuration={700}
                animationEasing="ease-in-out"
              />
            )}

            {/* Mode: Smooth Area Fill */}
            {chartMode === 'area' && (
              <>
                {visibleSeries.revenue && (
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Tuition & Fees"
                    stroke="#059669"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#cleanRevenueGradient)"
                    dot={{ r: 3.5, fill: '#059669', strokeWidth: 1.5, stroke: '#ffffff' }}
                    activeDot={{ r: 6.5, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                    animationDuration={700}
                    animationEasing="ease-in-out"
                  />
                )}
                {visibleSeries.expenses && (
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    name="Disbursements"
                    stroke="#e11d48"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#cleanExpensesGradient)"
                    dot={{ r: 3.5, fill: '#e11d48', strokeWidth: 1.5, stroke: '#ffffff' }}
                    activeDot={{ r: 6.5, fill: '#e11d48', stroke: '#ffffff', strokeWidth: 2 }}
                    animationDuration={700}
                    animationEasing="ease-in-out"
                  />
                )}
              </>
            )}

            {/* Mode: Dual Trend */}
            {chartMode === 'dual' && (
              <>
                {visibleSeries.revenue && (
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Tuition & Fees"
                    stroke="#059669"
                    strokeWidth={hoveredSeries === 'revenue' ? 3.5 : 2.5}
                    strokeOpacity={hoveredSeries === 'expenses' ? 0.3 : 1}
                    fillOpacity={1}
                    fill="url(#cleanRevenueGradient)"
                    dot={{ r: 3.5, fill: '#059669', strokeWidth: 1.5, stroke: '#ffffff' }}
                    activeDot={{ r: 6.5, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                    animationDuration={700}
                    animationEasing="ease-in-out"
                  />
                )}
                {visibleSeries.expenses && (
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    name="Disbursements"
                    stroke="#e11d48"
                    strokeWidth={hoveredSeries === 'expenses' ? 3.5 : 2.5}
                    strokeOpacity={hoveredSeries === 'revenue' ? 0.3 : 1}
                    fillOpacity={1}
                    fill="url(#cleanExpensesGradient)"
                    dot={{ r: 3.5, fill: '#e11d48', strokeWidth: 1.5, stroke: '#ffffff' }}
                    activeDot={{ r: 6.5, fill: '#e11d48', stroke: '#ffffff', strokeWidth: 2 }}
                    animationDuration={700}
                    animationEasing="ease-in-out"
                  />
                )}
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Bar: Clean Legend & Action Links */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-3 border-t border-border gap-3 text-xs">
        {/* Interactive Legend Toggles */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => toggleSeries('revenue')}
            onMouseEnter={() => setHoveredSeries('revenue')}
            onMouseLeave={() => setHoveredSeries(null)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              visibleSeries.revenue
                ? 'text-foreground hover:bg-muted font-medium'
                : 'text-muted-foreground line-through opacity-50'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block shrink-0" />
            <span>Tuition & Fees</span>
          </button>

          <button
            type="button"
            onClick={() => toggleSeries('expenses')}
            onMouseEnter={() => setHoveredSeries('expenses')}
            onMouseLeave={() => setHoveredSeries(null)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              visibleSeries.expenses
                ? 'text-foreground hover:bg-muted font-medium'
                : 'text-muted-foreground line-through opacity-50'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block shrink-0" />
            <span>Disbursements</span>
          </button>

          <span className="text-muted-foreground hidden lg:inline-block">
            • Click any month point to pin and inspect
          </span>
        </div>

        {/* Quick Transaction Modals & Ledger Links */}
        <div className="flex items-center gap-4 self-end sm:self-auto">
          {onOpenNewIncome && (
            <button
              type="button"
              onClick={onOpenNewIncome}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              + Record Fee
            </button>
          )}
          {onOpenNewExpense && (
            <button
              type="button"
              onClick={onOpenNewExpense}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              + Record Expense
            </button>
          )}
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('fees')}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>Fee Ledger</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
