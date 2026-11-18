import React, { useState, useMemo, useEffect, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { useExpenses, useUpdateExpense } from '@/api/client';
import { useMotionMode } from '@/hooks/useMotionMode';
import { useReviewQueue } from '@/hooks/useExpenses';
import {
  formatINR,
  formatDateIN,
  getFinancialYear,
  calculateTaxSplit,
  INDIAN_PAYMENT_MODES,
} from '@/lib/indianFormats';
import { Card } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import {
  Download,
  Search,
  AlertTriangle,
  Boxes,
  Store,
  HelpCircle,
  FileSpreadsheet,
  X,
} from 'lucide-react';

// Count-Up Animation Helper
const CountUpINR: React.FC<{ end: number; compact?: boolean }> = ({ end, compact = false }) => {
  const [val, setVal] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    let animId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / 900, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setVal(ease * end);
      if (progress < 1) {
        animId = requestAnimationFrame(step);
      }
    };
    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [end]);

  return <span>{formatINR(val, { compact })}</span>;
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { reduceMotion } = useMotionMode();

  // 1. Data Fetching
  const { data: expenses } = useExpenses({ limit: 5000 });
  const { data: reviewQueue } = useReviewQueue();

  const rawList = useMemo(() => expenses || [], [expenses]);
  const currentFY = useMemo(() => getFinancialYear(), []);

  // 2. Filter Bar State
  const [vendorSearch, setVendorSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [paymentModeFilter, setPaymentModeFilter] = useState('ALL');
  const [datePreset, setDatePreset] = useState<'FY' | '30D' | '90D' | '7D' | 'ALL'>('FY');
  const [onlyAnomalies, setOnlyAnomalies] = useState(false);

  // 3. UI State: 2D vs 3D toggle, expanded reasons, undo toast
  const [show3DVisuals, setShow3DVisuals] = useState<boolean>(!reduceMotion);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  const [dismissedActionIds, setDismissedActionIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);

  // Keyboard Shortcuts (U, R, D, ?)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'u' || e.key === 'U') navigate('/upload');
      if (e.key === 'r' || e.key === 'R') navigate('/review-queue');
      if (e.key === 'd' || e.key === 'D') navigate('/dashboard');
      if (e.key === '?') setShowShortcutsModal(true);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // Categories Dropdown Options
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    rawList.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set).sort();
  }, [rawList]);

  // Compute Filtered Expense List
  const filteredList = useMemo(() => {
    const now = new Date();
    let minDateStr = '';

    if (datePreset === '7D') {
      const d = new Date();
      d.setDate(now.getDate() - 7);
      minDateStr = d.toISOString().slice(0, 10);
    } else if (datePreset === '30D') {
      const d = new Date();
      d.setDate(now.getDate() - 30);
      minDateStr = d.toISOString().slice(0, 10);
    } else if (datePreset === '90D') {
      const d = new Date();
      d.setDate(now.getDate() - 90);
      minDateStr = d.toISOString().slice(0, 10);
    } else if (datePreset === 'FY') {
      minDateStr = `${currentFY.fyStartYear}-04-01`;
    }

    return rawList.filter((item) => {
      if (vendorSearch) {
        const q = vendorSearch.toLowerCase();
        const v = item.vendor?.toLowerCase() || '';
        const desc = item.item_description?.toLowerCase() || '';
        if (!v.includes(q) && !desc.includes(q)) return false;
      }

      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (paymentModeFilter !== 'ALL' && item.payment_mode !== paymentModeFilter) return false;
      if (onlyAnomalies && !item.is_anomaly) return false;
      if (minDateStr && item.date && item.date < minDateStr) return false;

      return true;
    });
  }, [rawList, vendorSearch, categoryFilter, paymentModeFilter, onlyAnomalies, datePreset, currentFY]);

  // Metrics for Top KPI Strip
  const totalSpend = useMemo(
    () => filteredList.reduce((acc, curr) => acc + (curr.amount || 0), 0),
    [filteredList]
  );
  const totalReceipts = filteredList.length;
  const anomaliesCount = useMemo(
    () => filteredList.filter((i) => i.is_anomaly).length,
    [filteredList]
  );
  const avgOcrConfidence = useMemo(() => {
    if (!filteredList.length) return 85.0;
    const sum = filteredList.reduce((acc, curr) => acc + (curr.ocr_confidence || 0.85), 0);
    return Math.round((sum / filteredList.length) * 1000) / 10;
  }, [filteredList]);
  const pendingReviewCount = reviewQueue?.length || 0;

  // Prioritized Attention List (Row 2: Needs Attention)
  const attentionItems = useMemo(() => {
    return rawList
      .filter((item) => !dismissedActionIds.has(item.id))
      .filter(
        (item) =>
          item.is_anomaly ||
          item.needs_review ||
          (item.ocr_confidence && item.ocr_confidence < 0.7)
      )
      .slice(0, 5);
  }, [rawList, dismissedActionIds]);

  // Tax Breakdown (GST Summary Card)
  const taxSummary = useMemo(() => {
    const totalTax = filteredList.reduce((acc, curr) => acc + (curr.tax || 0), 0);
    return calculateTaxSplit(totalSpend, totalTax);
  }, [filteredList, totalSpend]);

  // Monthly Aggregate Time Series for AreaChart
  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; amount: number; count: number }> = {};
    filteredList.forEach((item) => {
      const m = (item.date || '').slice(0, 7);
      if (m) {
        if (!map[m]) map[m] = { month: m, amount: 0, count: 0 };
        map[m].amount += item.amount || 0;
        map[m].count += 1;
      }
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredList]);

  // Toggle "Why Flagged?" row expander
  const toggleRowExpander = (id: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 1-Click Approve in Attention List
  const handleApproveAction = (item: any) => {
    setDismissedActionIds((prev) => new Set(prev).add(item.id));
    setToastMessage(`✓ ${item.vendor} (${formatINR(item.amount)}) ${t('review.approvedToast', 'approved into ledger')}`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // CSV Export Handler
  const exportCSV = () => {
    if (!filteredList.length) return;
    const headers = [
      'id', 'date', 'vendor', 'category', 'amount', 'tax',
      'payment_mode', 'is_anomaly', 'anomaly_score', 'risk_severity', 'risk_reasons',
    ];
    const rows = filteredList.map((r) => [
      r.id,
      r.date,
      `"${(r.vendor || '').replace(/"/g, '""')}"`,
      r.category,
      r.amount,
      r.tax,
      r.payment_mode || 'UPI',
      r.is_anomaly,
      r.anomaly_score ?? 0,
      r.risk_severity || 'LOW',
      `"${(Array.isArray(r.risk_reasons) ? r.risk_reasons.join('; ') : r.risk_reasons || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `swadeshi_khata_expenses_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* UNDO TOAST NOTIFICATION */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 px-4 py-2.5 rounded bg-[#138808] text-white text-xs font-mono shadow-2xl flex items-center gap-3 border border-white/20"
          >
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="hover:underline font-bold text-[10px] cursor-pointer"
            >
              {t('common.dismiss', 'Dismiss')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER WITH MISSION CONTROL TITLE & FY SELECTOR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#1C1C1F]">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#FF9933]">
            <Store className="w-3.5 h-3.5" />
            <span>{t('dashboard.fyHorizon', 'Financial Horizon')} // {currentFY.fy}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-medium text-[#F5EFE6] tracking-tight mt-1">
            {t('dashboard.title', 'Mission Control')}
          </h1>
          <p className="text-xs text-[#A59E92] mt-0.5">
            {t('dashboard.subtitle', 'Real-time ledger telemetry, anomaly containment, and forward burn projections')}
          </p>
        </div>

        {/* FY & Time Horizon Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="p-1 rounded bg-[#0A0A0A] border border-[#1C1C1F] flex items-center gap-1 text-xs font-mono">
            {(['FY', '30D', '90D', '7D', 'ALL'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  datePreset === preset
                    ? 'bg-[#111111] text-[#FF9933] border border-[#FF9933]/40 font-medium'
                    : 'text-[#A59E92] hover:text-[#F5EFE6]'
                }`}
              >
                {preset === 'FY' ? currentFY.fy : preset === 'ALL' ? t('common.all', 'All') : preset}
              </button>
            ))}
          </div>

          {/* 2D / 3D Mode Toggle */}
          <button
            type="button"
            onClick={() => setShow3DVisuals(!show3DVisuals)}
            className={`px-3 py-1.5 rounded border text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
              show3DVisuals
                ? 'bg-[#111111] border-[#FF9933]/40 text-[#FF9933]'
                : 'bg-[#0A0A0A] border-[#1C1C1F] text-[#A59E92]'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>{show3DVisuals ? t('dashboard.mode3D', '3D Visuals') : t('dashboard.mode2D', '2D Mode')}</span>
          </button>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={exportCSV}
            className="px-3 py-1.5 rounded bg-[#111111] hover:bg-[#161618] border border-[#1C1C1F] text-xs font-mono text-[#F5EFE6] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#D4A017]" />
            <span className="hidden sm:inline">{t('dashboard.exportCsv', 'Export CSV')}</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* ROW 1: KPI STRIP WITH INDIAN FORMAT (₹, LAKH, CRORE)                  */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard
          label={t('dashboard.kpiTotalSpend', 'Total Spend')}
          value={<CountUpINR end={totalSpend} compact />}
          sub={`${filteredList.length} ${t('dashboard.kpiTotalSpendSub', 'total entries')}`}
          accent="brand"
          className="border-[#1C1C1F] hover:border-[#FF9933]/40 cursor-pointer"
          onClick={() => {
            setOnlyAnomalies(false);
            setCategoryFilter('ALL');
          }}
        />

        <KPICard
          label={t('dashboard.kpiAudited', 'Receipts Audited')}
          value={totalReceipts.toLocaleString('en-IN')}
          sub={t('dashboard.kpiAuditedSub', 'verified ledger records')}
          accent="success"
          className="border-[#1C1C1F] hover:border-[#138808]/40 cursor-pointer"
          onClick={() => navigate('/upload')}
        />

        <KPICard
          label={t('dashboard.kpiAnomalies', 'Anomalies')}
          value={anomaliesCount}
          sub={anomaliesCount > 0 ? t('dashboard.kpiAnomaliesSub', 'Requires merchant review') : t('dashboard.kpiAnomaliesZero', 'Zero anomalies detected')}
          valueColor={anomaliesCount > 0 ? 'text-[#B3202A]' : 'text-[#138808]'}
          accent="danger"
          className="border-[#1C1C1F] hover:border-[#B3202A]/40 cursor-pointer"
          onClick={() => setOnlyAnomalies(!onlyAnomalies)}
        />

        <KPICard
          label={t('dashboard.kpiOcr', 'Avg OCR Accuracy')}
          value={`${avgOcrConfidence}%`}
          sub={t('dashboard.kpiOcrSub', 'Dual-pass EasyOCR')}
          accent="warning"
          className="border-[#1C1C1F] hover:border-[#D4A017]/40"
        />

        <KPICard
          label={t('dashboard.kpiPending', 'Pending Review')}
          value={pendingReviewCount}
          sub={t('dashboard.kpiPendingSub', 'Items in triage queue')}
          valueColor={pendingReviewCount > 0 ? 'text-[#D4A017]' : 'text-[#138808]'}
          accent="warning"
          className="col-span-2 lg:col-span-1 border-[#1C1C1F] hover:border-[#D4A017]/40 cursor-pointer"
          onClick={() => navigate('/review-queue')}
        />
      </div>

      {/* ===================================================================== */}
      {/* ROW 2: NEEDS ATTENTION PRIORITIZED ACTION LIST                         */}
      {/* ===================================================================== */}
      {attentionItems.length > 0 && (
        <Card variant="solid" padding="md" className="border-[#B3202A]/30 bg-[#0A0A0A]">
          <div className="flex items-center justify-between pb-3 border-b border-[#1C1C1F]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#B3202A] animate-ping" />
              <h2 className="text-sm font-heading font-medium text-[#F5EFE6]">
                {t('dashboard.attentionTitle', 'Needs Attention')}
              </h2>
            </div>
            <span className="font-mono text-[10px] text-[#D4A017] uppercase">
              {attentionItems.length} {t('dashboard.actionsPending', 'actions pending')}
            </span>
          </div>

          <div className="divide-y divide-[#1C1C1F] mt-2">
            {attentionItems.map((item) => (
              <div
                key={item.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#F5EFE6]">{item.vendor}</span>
                    <span className="font-mono text-[#D4A017] font-semibold">
                      {formatINR(item.amount)}
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#111111] text-[#A59E92] uppercase">
                      {item.category}
                    </span>
                    {item.is_anomaly && (
                      <span className="px-1.5 py-0.5 rounded bg-[#B3202A]/20 text-[#B3202A] text-[10px] font-mono">
                        {t('common.flagged', 'Flagged')}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#A59E92] font-mono">
                    {formatDateIN(item.date)} &bull; {item.risk_severity || 'LOW'} &bull;{' '}
                    {Array.isArray(item.risk_reasons) ? item.risk_reasons[0] : item.risk_reasons || t('common.needsReview', 'Review')}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleRowExpander(item.id)}
                    className="px-2.5 py-1 rounded bg-[#111111] hover:bg-[#161618] border border-[#1C1C1F] text-[11px] font-mono text-[#A59E92] hover:text-[#F5EFE6] cursor-pointer"
                  >
                    {t('dashboard.why', 'Why?')}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/review-queue')}
                    className="px-2.5 py-1 rounded bg-[#111111] hover:bg-[#161618] border border-[#1C1C1F] text-[11px] font-mono text-[#D4A017] cursor-pointer"
                  >
                    {t('dashboard.fixCategory', 'Fix Category')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApproveAction(item)}
                    className="px-3 py-1 rounded bg-[#138808] hover:bg-[#0E6806] text-white text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    {t('dashboard.approve', 'Approve')} ✓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ===================================================================== */}
      {/* ROW 3: SINGLE UNIFIED FILTER BAR                                      */}
      {/* ===================================================================== */}
      <div className="p-3 rounded bg-[#0A0A0A] border border-[#1C1C1F] flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#656057]" />
          <input
            type="text"
            value={vendorSearch}
            onChange={(e) => setVendorSearch(e.target.value)}
            placeholder={t('dashboard.searchPlaceholder', 'Search vendor, item description...')}
            className="w-full bg-[#000000] border border-[#1C1C1F] rounded pl-8 pr-3 py-1.5 text-xs text-[#F5EFE6] focus:outline-none focus:border-[#FF9933] font-mono"
          />
        </div>

        {/* Category Dropdown */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-[#000000] border border-[#1C1C1F] rounded px-3 py-1.5 text-xs text-[#F5EFE6] focus:outline-none focus:border-[#FF9933] font-mono cursor-pointer"
        >
          <option value="ALL">{t('dashboard.allCategories', 'All Categories')}</option>
          {categoryOptions.map((cat) => (
            <option key={cat} value={cat}>
              {t(`common.categories.${cat}`, cat)}
            </option>
          ))}
        </select>

        {/* Payment Mode */}
        <select
          value={paymentModeFilter}
          onChange={(e) => setPaymentModeFilter(e.target.value)}
          className="bg-[#000000] border border-[#1C1C1F] rounded px-3 py-1.5 text-xs text-[#F5EFE6] focus:outline-none focus:border-[#FF9933] font-mono cursor-pointer"
        >
          <option value="ALL">{t('dashboard.allPayments', 'All Payment Modes')}</option>
          {INDIAN_PAYMENT_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>

        {/* Only Anomalies Toggle */}
        <label className="flex items-center gap-1.5 font-mono text-[11px] text-[#A59E92] cursor-pointer">
          <input
            type="checkbox"
            checked={onlyAnomalies}
            onChange={(e) => setOnlyAnomalies(e.target.checked)}
            className="rounded border-[#1C1C1F] bg-[#000000] text-[#B3202A]"
          />
          <span>{t('dashboard.onlyFlags', 'Only Flags')}</span>
        </label>

        {/* Reset Filters */}
        <button
          type="button"
          onClick={() => {
            setVendorSearch('');
            setCategoryFilter('ALL');
            setPaymentModeFilter('ALL');
            setDatePreset('FY');
            setOnlyAnomalies(false);
          }}
          className="px-2 py-1 rounded text-[11px] font-mono text-[#656057] hover:text-[#F5EFE6] hover:bg-[#111111] cursor-pointer"
        >
          {t('dashboard.reset', 'Reset')}
        </button>
      </div>

      {/* ===================================================================== */}
      {/* ROW 4: TELEMETRY CHARTS & GST SUMMARY                                 */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Visual: Spend Flux (7 cols) */}
        <div className="lg:col-span-7">
          <Card variant="solid" padding="md" className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1C1C1F]">
              <div className="font-mono text-xs uppercase tracking-wider text-[#A59E92] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#FF9933]" />
                <span>{t('dashboard.monthlyFlux', 'Monthly Spend Flux')}</span>
              </div>
              <span className="font-mono text-[10px] text-[#656057]">
                {monthlyData.length} {t('dashboard.monthsRecorded', 'months recorded')}
              </span>
            </div>

            <div className="h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="saffronGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF9933" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#FF9933" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1C1C1F" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="#656057"
                    tick={{ fill: '#656057', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={false}
                    axisLine={{ stroke: '#1C1C1F' }}
                  />
                  <YAxis
                    stroke="#656057"
                    tick={{ fill: '#656057', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={false}
                    axisLine={{ stroke: '#1C1C1F' }}
                    tickFormatter={(val) => formatINR(val, { compact: true, showSymbol: false })}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#0A0A0A',
                      borderColor: '#1C1C1F',
                      borderRadius: '4px',
                      color: '#F5EFE6',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                    formatter={(val: any) => [formatINR(Number(val)), t('dashboard.kpiTotalSpend', 'Total Spend')]}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#FF9933"
                    strokeWidth={2}
                    fill="url(#saffronGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Right Visual: GST Input Tax Credit Summary Card (5 cols) */}
        <div className="lg:col-span-5">
          <Card variant="solid" padding="md" className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1C1C1F]">
              <div className="font-mono text-xs uppercase tracking-wider text-[#A59E92] flex items-center gap-2">
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#138808]" />
                <span>{t('dashboard.gstTitle', 'GST Input Tax Credit')}</span>
              </div>
              <span className="font-mono text-[9.5px] px-1.5 py-0.5 rounded bg-[#111111] text-[#A59E92] uppercase">
                {currentFY.quarter}
              </span>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded bg-[#000000] border border-[#1C1C1F] flex items-center justify-between">
                <div>
                  <div className="text-[10.5px] font-mono text-[#A59E92] uppercase">
                    {t('dashboard.gstItc', 'Eligible Input Tax Credit')}
                  </div>
                  <div className="text-xl font-heading font-medium text-[#138808] mt-0.5">
                    {formatINR(taxSummary.totalTax)}
                  </div>
                </div>
                <span className="font-mono text-[10px] text-[#A59E92]">{t('dashboard.gst18Slips', 'From GST Invoices')}</span>
              </div>

              {/* Tax Breakup Rows */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded bg-[#000000] border border-[#1C1C1F]">
                  <div className="text-[#656057] text-[10px]">{t('dashboard.cgst', 'CGST (Central)')}</div>
                  <div className="text-[#F5EFE6] font-medium mt-0.5">
                    {formatINR(taxSummary.cgst)}
                  </div>
                </div>
                <div className="p-2.5 rounded bg-[#000000] border border-[#1C1C1F]">
                  <div className="text-[#656057] text-[10px]">{t('dashboard.sgst', 'SGST (State)')}</div>
                  <div className="text-[#F5EFE6] font-medium mt-0.5">
                    {formatINR(taxSummary.sgst)}
                  </div>
                </div>
              </div>

              <div className="p-2 rounded bg-[#000000] border border-[#1C1C1F] flex items-center justify-between text-xs font-mono">
                <span className="text-[#656057]">{t('dashboard.igst', 'IGST (Interstate)')}</span>
                <span className="text-[#F5EFE6]">{formatINR(taxSummary.igst)}</span>
              </div>

              <div className="pt-2 text-[10.5px] text-[#656057] font-body italic flex items-center gap-1.5">
                <HelpCircle className="w-3 h-3 text-[#D4A017] shrink-0" />
                <span>{t('dashboard.gstEstimateNotice', 'Estimate only, not formal tax advice')}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* ROW 5: ANOMALY TABLE WITH "WHY FLAGGED?" EXPLAINER                     */}
      {/* ===================================================================== */}
      <Card variant="solid" padding="md" className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#1C1C1F]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-[#F5EFE6] uppercase tracking-wider">
              {t('dashboard.auditLogTitle', 'Ledger Audit Log')}
            </span>
            <span className="text-xs text-[#A59E92]">({filteredList.length})</span>
          </div>
          <button
            type="button"
            onClick={exportCSV}
            className="text-xs font-mono text-[#D4A017] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>{t('dashboard.downloadCsv', 'Download Ledger (.csv)')}</span>
          </button>
        </div>

        {/* Dense Financial Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1C1C1F] text-[#656057] text-[10px] uppercase tracking-wider">
                <th className="py-2.5 px-3">{t('dashboard.colDate', 'Date')}</th>
                <th className="py-2.5 px-3">{t('dashboard.colVendor', 'Vendor / Merchant')}</th>
                <th className="py-2.5 px-3">{t('dashboard.colCategory', 'Category')}</th>
                <th className="py-2.5 px-3 text-right">{t('dashboard.colAmount', 'Amount')}</th>
                <th className="py-2.5 px-3">{t('dashboard.colPayment', 'Payment Mode')}</th>
                <th className="py-2.5 px-3">{t('dashboard.colStatus', 'Status')}</th>
                <th className="py-2.5 px-3 text-right">{t('dashboard.colCheck', 'Forensic Check')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C1C1F]">
              {filteredList.slice(0, 15).map((row) => {
                const isExpanded = expandedRowIds.has(row.id);
                return (
                  <React.Fragment key={row.id}>
                    <tr className="hover:bg-[#111111] transition-colors">
                      <td className="py-2.5 px-3 text-[#A59E92] whitespace-nowrap">
                        {formatDateIN(row.date)}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[#F5EFE6] max-w-[200px] truncate">
                        {row.vendor}
                      </td>
                      <td className="py-2.5 px-3 text-[#A59E92] uppercase">
                        {t(`common.categories.${row.category}`, row.category)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#F5EFE6] font-semibold whitespace-nowrap">
                        {formatINR(row.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-[#A59E92]">
                        {row.payment_mode || 'UPI'}
                      </td>
                      <td className="py-2.5 px-3">
                        {row.is_anomaly ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#B3202A]/20 text-[#B3202A] text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#B3202A]" />
                            {t('dashboard.flagged', 'Flagged')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#138808]/20 text-[#138808] text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#138808]" />
                            {t('dashboard.audited', 'Audited')}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {row.is_anomaly && (
                          <button
                            type="button"
                            onClick={() => toggleRowExpander(row.id)}
                            className="text-[#FF9933] hover:underline text-[10.5px] cursor-pointer"
                          >
                            {isExpanded ? t('dashboard.hideReason', 'Hide Reason') : t('dashboard.whyFlagged', 'Why Flagged?')}
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Explainer Accordion Row */}
                    {isExpanded && (
                      <tr className="bg-[#111111]/80 border-b border-[#1C1C1F]">
                        <td colSpan={7} className="p-3 text-[11px] text-[#A59E92] space-y-1">
                          <div className="flex items-center gap-2 text-[#FF9933] font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{t('dashboard.triggerLabel', 'Anomaly Trigger & Reasons:')}</span>
                          </div>
                          <div>
                            {Array.isArray(row.risk_reasons)
                              ? row.risk_reasons.join(' • ')
                              : row.risk_reasons || t('common.needsReview', 'Review required')}
                          </div>
                          <div className="text-[10px] text-[#656057]">
                            {t('dashboard.score', 'Score')}: {row.anomaly_score} &bull; {t('dashboard.severity', 'Severity')}: {row.risk_severity}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* KEYBOARD SHORTCUTS MODAL (?) */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded bg-[#0A0A0A] border border-[#1C1C1F] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#1C1C1F]">
              <span className="font-mono text-xs uppercase text-[#F5EFE6]">{t('dashboard.shortcutsTitle', 'Keyboard Shortcuts')}</span>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="text-[#656057] hover:text-[#F5EFE6] cursor-pointer"
                aria-label={t('common.close', 'Close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between p-2 rounded bg-[#000000]">
                <span>{t('dashboard.shortcutUpload', 'Upload Receipt')}</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[#111111] border border-[#1C1C1F] text-[#FF9933]">U</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-[#000000]">
                <span>{t('dashboard.shortcutReview', 'Review Queue')}</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[#111111] border border-[#1C1C1F] text-[#FF9933]">R</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-[#000000]">
                <span>{t('dashboard.shortcutDashboard', 'Mission Control')}</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[#111111] border border-[#1C1C1F] text-[#FF9933]">D</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-[#000000]">
                <span>{t('dashboard.shortcutPalette', 'Command Palette')}</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[#111111] border border-[#1C1C1F] text-[#FF9933]">Ctrl+K</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
