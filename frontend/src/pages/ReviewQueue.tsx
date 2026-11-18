import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import {
  useReviewQueue,
  correctExpense,
  retrainFeedback,
  simulateReviewItem,
  useFeedbackCorrections,
} from '@/api/client';
import { ExpenseItemResponse, CorrectionRequest } from '@/types';
import { formatINR } from '@/lib/indianFormats';
import { Card } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import {
  ClipboardList,
  Check,
  CheckCheck,
  RotateCw,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  Download,
  Sparkles,
  ShieldCheck,
  X,
  Clock,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Standard 9 Indian SMB expense categories
const STANDARD_CATEGORIES = [
  { value: 'food_dining', label: 'Food & Dining' },
  { value: 'travel_fuel', label: 'Travel & Fuel' },
  { value: 'utilities_recharge', label: 'Utilities & Recharge' },
  { value: 'supplies_stationery', label: 'Office Supplies & Stationery' },
  { value: 'client_entertainment', label: 'Client Entertainment' },
  { value: 'electronics_repairs', label: 'Hardware & IT Repairs' },
  { value: 'logistics_courier', label: 'Courier & Logistics' },
  { value: 'software_subscriptions', label: 'Software & Subscriptions' },
  { value: 'misc', label: 'Miscellaneous' },
];

export const ReviewQueue: React.FC = () => {
  const queryClient = useQueryClient();

  // 1. Fetch Review Queue Data
  const { data: queueItems, isLoading, isRefetching } = useReviewQueue(100);
  const rawList = useMemo(() => queueItems || [], [queueItems]);
  const { data: feedbackList } = useFeedbackCorrections();

  // 2. Filters & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [confidenceTierFilter, setConfidenceTierFilter] = useState<
    'ALL' | 'CRITICAL' | 'BORDERLINE'
  >('ALL');

  // 3. Selection & Bulk Action State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  // 4. Inline Row Edits State: Record<expenseId, { category: string; notes?: string }>
  const [inlineEdits, setInlineEdits] = useState<Record<string, string>>({});

  // 5. Image Lightbox Modal State
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  // 6. Retraining Feedback Feedback State
  const [retrainSuccess, setRetrainSuccess] = useState<string | null>(null);

  // ==========================================================================
  // TANSTACK QUERY OPTIMISTIC MUTATION
  // ==========================================================================
  const correctMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CorrectionRequest }) =>
      correctExpense(id, payload),

    // Optimistic Update: Immediately remove corrected item from cache
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['review-queue'] });
      const previousQueue =
        queryClient.getQueryData<ExpenseItemResponse[]>(['review-queue', 100]) || [];

      // Optimistically filter out the corrected item
      queryClient.setQueryData<ExpenseItemResponse[]>(['review-queue', 100], (old) =>
        old ? old.filter((item) => item.id !== id) : []
      );

      // Remove from selectedIds if present
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      return { previousQueue };
    },

    onError: (_err, _vars, context) => {
      // Rollback cache if mutation failed
      if (context?.previousQueue) {
        queryClient.setQueryData(['review-queue', 100], context.previousQueue);
      }
      alert('Failed to save correction. Changes reverted.');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['feedback-corrections'] });
    },
  });

  // Retrain Model Mutation
  const retrainMutation = useMutation({
    mutationFn: retrainFeedback,
    onSuccess: (res) => {
      setRetrainSuccess(
        `Classifier retrained! ${res.corrections_applied} human corrections applied with ${(res.training_accuracy * 100).toFixed(1)}% accuracy.`
      );
      setTimeout(() => setRetrainSuccess(null), 6000);
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
    },
    onError: (err: any) => {
      alert(`Retraining failed: ${err.message}`);
    },
  });

  // Simulate Ambiguous Receipt Mutation
  const simulateMutation = useMutation({
    mutationFn: simulateReviewItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
    },
  });

  // ==========================================================================
  // FILTERING LOGIC
  // ==========================================================================
  const filteredList = useMemo(() => {
    return rawList.filter((item) => {
      // Text Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesVendor = item.vendor?.toLowerCase().includes(q);
        const matchesDesc = item.item_description?.toLowerCase().includes(q);
        const matchesReason = item.review_reason?.toLowerCase().includes(q);
        if (!matchesVendor && !matchesDesc && !matchesReason) return false;
      }

      // Category Filter
      if (selectedCategoryFilter !== 'ALL' && item.category !== selectedCategoryFilter) {
        return false;
      }

      // Confidence Tier Filter
      const conf = item.classifier_confidence ?? 0.5;
      if (confidenceTierFilter === 'CRITICAL' && conf >= 0.5) {
        return false;
      }
      if (confidenceTierFilter === 'BORDERLINE' && (conf < 0.5 || conf >= 0.65)) {
        return false;
      }

      return true;
    });
  }, [rawList, searchQuery, selectedCategoryFilter, confidenceTierFilter]);

  // ==========================================================================
  // SELECTION & BULK APPROVAL
  // ==========================================================================
  const allFilteredSelected =
    filteredList.length > 0 && filteredList.every((item) => selectedIds.has(item.id));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredList.map((item) => item.id)));
    }
  };

  const handleToggleRowSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Bulk Approve Selected Receipts
  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    setIsBulkApproving(true);

    try {
      const promises = Array.from(selectedIds).map((id) => {
        const item = rawList.find((r) => r.id === id);
        const correctedCategory = inlineEdits[id] || item?.category || 'misc';
        return correctExpense(id, {
          corrected_category: correctedCategory,
          notes: 'Bulk approved by human reviewer',
        });
      });

      await Promise.all(promises);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    } catch (err: any) {
      alert(`Bulk approval error: ${err.message}`);
    } finally {
      setIsBulkApproving(false);
    }
  };

  // Inline Correction Save Handler
  const handleSaveInline = (item: ExpenseItemResponse) => {
    const chosenCategory = inlineEdits[item.id] || item.category;
    correctMutation.mutate({
      id: item.id,
      payload: {
        corrected_category: chosenCategory,
        corrected_vendor: item.vendor,
        notes: 'Inline verified by reviewer in Needs Review queue',
      },
    });
  };

  // Get image URL with fallback
  const getThumbnailUrl = (item: ExpenseItemResponse) => {
    const base = import.meta.env.VITE_API_URL || '/api';
    return `${base}/receipts/${item.id}/image`;
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & GLOBAL ACTIONS */}
      <SectionHeader
        tag="// SATEEK_AUDIT // मानव सत्यापन"
        title="Needs Review Queue (जांच आवश्यक)"
        subtitle="Forensic human-in-the-loop audit queue for low-confidence OCR and ambiguous classifier predictions"
        icon="📋"
        badge={
          <StatusBadge
            label={`${rawList.length} PENDING`}
            variant={rawList.length > 0 ? 'warning' : 'success'}
            dot
            pulse={rawList.length > 0}
          />
        }
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Simulate Ambiguous Item Button */}
            <button
              onClick={() => simulateMutation.mutate()}
              disabled={simulateMutation.isPending}
              title="Inject a low-confidence test receipt into SQLite to test review flow"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#111111] hover:bg-[#161618] text-[#A59E92] hover:text-[#F5EFE6] border border-[#1C1C1F] text-xs font-mono uppercase tracking-[0.08em] transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FF9933]" />
              <span>{simulateMutation.isPending ? 'Injecting...' : 'Simulate Ambiguous Item'}</span>
            </button>

            {/* Retrain Model on Feedback Button */}
            <button
              onClick={() => retrainMutation.mutate()}
              disabled={retrainMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#EDEDED] hover:bg-white disabled:bg-[#111111] disabled:text-[#52555C] disabled:border disabled:border-[#1C1C1F] text-black font-medium text-xs tracking-tight transition-colors cursor-pointer"
            >
              <RotateCw
                className={cn('w-3.5 h-3.5', retrainMutation.isPending && 'animate-spin')}
              />
              <span>
                {retrainMutation.isPending ? 'Retraining Model...' : 'Retrain on Feedback'}
              </span>
            </button>

            {/* Download CSV Audit Trail */}
            <a
              href={`${import.meta.env.VITE_API_URL || '/api'}/feedback-corrections/csv`}
              download="human_feedback_corrections.csv"
              title="Export human corrections audit CSV file"
              className="p-1.5 rounded bg-[#111111] border border-[#1C1C1F] text-[#8A8F98] hover:text-[#EDEDED] transition-colors"
            >
              <Download className="w-4 h-4 text-[#8A8F98]" />
            </a>
          </div>
        }
      />

      {/* Retrain Success Toast */}
      {retrainSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded bg-[#111111] border border-[#34D399]/40 text-[#34D399] text-xs font-mono flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <CheckCheck className="w-4 h-4 text-[#34D399]" />
            <span>{retrainSuccess}</span>
          </div>
          <button
            onClick={() => setRetrainSuccess(null)}
            className="text-[#34D399] hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}

      {/* 2. KPI METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KPICard
          label="Pending Items"
          value={rawList.length}
          sub="Requires human triage"
          icon="⏳"
          accent={rawList.length > 0 ? 'warning' : 'success'}
          valueColor={rawList.length > 0 ? 'text-[#F5B544]' : 'text-[#34D399]'}
          tooltip="Receipts scoring below 0.65 classifier probability or 0.60 OCR confidence."
        />
        <KPICard
          label="Classifier Gate"
          value="< 65% Confidence"
          sub="Multi-class text threshold"
          icon="🏷️"
          accent="brand"
          tooltip="Any document with ambiguous category semantics is automatically routed here."
        />
        <KPICard
          label="OCR Quality Gate"
          value="< 60% Character Score"
          sub="EasyOCR confidence threshold"
          icon="🔍"
          accent="brand"
          tooltip="Smudged or low-contrast paper receipts routed for manual verification."
        />
        <KPICard
          label="Active Learning"
          value="15x Supervised Weight"
          sub="Feedback CSV loop"
          icon="🧠"
          accent="success"
          tooltip="Human corrections are stored with 15x sample weights to rapidly correct misclassifications."
        />
      </div>

      {/* 3. SEARCH & FILTERS TOOLBAR */}
      <Card variant="solid" padding="sm" className="space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Left: Search input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-[#52555C] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search vendor, description, or review reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#000000] border border-[#1C1C1F] rounded pl-9 pr-3 py-1.5 text-xs text-[#EDEDED] placeholder-[#52555C] focus:outline-none focus:border-[#FF9933] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52555C] hover:text-[#EDEDED]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right: Dropdowns & Bulk Trigger */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5 bg-[#000000] border border-[#1C1C1F] rounded px-2.5 py-1 text-xs">
              <Filter className="w-3 h-3 text-[#FF9933]" />
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="bg-transparent text-[#EDEDED] font-mono text-xs focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-[#0A0A0A] text-[#EDEDED]">
                  All Categories
                </option>
                {STANDARD_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value} className="bg-[#0A0A0A] text-[#EDEDED]">
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Confidence Tier Filter */}
            <div className="flex items-center gap-1.5 bg-[#000000] border border-[#1C1C1F] rounded px-2.5 py-1 text-xs">
              <span className="text-[#52555C] font-mono text-[11px]">CONFIDENCE:</span>
              <select
                value={confidenceTierFilter}
                onChange={(e) => setConfidenceTierFilter(e.target.value as any)}
                className="bg-transparent text-[#EDEDED] font-mono text-xs focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-[#0A0A0A] text-[#EDEDED]">
                  All Levels
                </option>
                <option value="CRITICAL" className="bg-[#0A0A0A] text-[#EDEDED]">
                  Critical (&lt;50%)
                </option>
                <option value="BORDERLINE" className="bg-[#0A0A0A] text-[#EDEDED]">
                  Borderline (50-65%)
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Action Sticky Bar (appears when rows are selected) */}
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-2.5 rounded bg-[#111111] border border-[#FF9933]/30 flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-xs bg-[#FF9933] text-black font-mono font-medium text-[10px]">
                {selectedIds.size} SELECTED
              </span>
              <span className="text-[#8A8F98]">Ready for bulk audit sign-off</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-2.5 py-1 rounded text-[#8A8F98] hover:text-[#EDEDED] text-xs font-mono transition-colors"
              >
                Deselect All
              </button>
              <button
                onClick={handleBulkApprove}
                disabled={isBulkApproving}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#EDEDED] hover:bg-white text-black font-medium text-xs tracking-tight transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>
                  {isBulkApproving ? 'Approving...' : `Bulk Approve (${selectedIds.size})`}
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </Card>

      {/* 4. TABLE OF LOW-CONFIDENCE RECEIPTS */}
      {isLoading ? (
        <SkeletonTable rows={6} columns={6} />
      ) : filteredList.length === 0 ? (
        <EmptyState
          variant="success"
          title="Review Queue is Clear!"
          description={
            rawList.length === 0
              ? 'All audited receipts have satisfied both OCR character quality and classifier confidence gates.'
              : 'No pending receipts match your current filter parameters.'
          }
          action={
            rawList.length === 0 ? (
              <button
                onClick={() => simulateMutation.mutate()}
                disabled={simulateMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#EDEDED] hover:bg-white text-black text-xs font-medium transition-colors"
              >
                <Sparkles className="w-4 h-4 text-[#FF9933]" />
                <span>Simulate Ambiguous Item</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategoryFilter('ALL');
                  setConfidenceTierFilter('ALL');
                }}
                className="px-4 py-2 rounded bg-[#111111] border border-[#1C1C1F] text-[#EDEDED] text-xs font-mono hover:bg-[#161618] transition-colors"
              >
                Clear Filters
              </button>
            )
          }
        />
      ) : (
        <div className="rounded border border-[#1C1C1F] overflow-hidden bg-[#0A0A0A]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#111111] text-[#52555C] font-mono text-[10px] uppercase tracking-[0.1em] border-b border-[#1C1C1F] select-none">
                <tr>
                  <th className="py-2.5 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={handleToggleSelectAll}
                      className="rounded border-[#1C1C1F] bg-[#000000] text-[#FF9933] focus:ring-0 cursor-pointer w-3.5 h-3.5"
                    />
                  </th>
                  <th className="py-2.5 px-3 w-16 text-center">Scan</th>
                  <th className="py-2.5 px-4 min-w-[200px]">Vendor & Details</th>
                  <th className="py-2.5 px-4 min-w-[170px]">Confidence Scores</th>
                  <th className="py-2.5 px-4 min-w-[180px]">Routing Reason</th>
                  <th className="py-2.5 px-4 min-w-[220px]">Correct Category & Approve</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#1C1C1F]">
                {filteredList.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  const currentCategory = inlineEdits[item.id] || item.category;
                  const clfConf = item.classifier_confidence ?? 0.5;
                  const ocrConf = item.ocr_confidence ?? 0.6;
                  const confPct = Math.round(clfConf * 100);

                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        'transition-colors',
                        isSelected ? 'bg-[#111111]' : 'hover:bg-[#111111]/40'
                      )}
                    >
                      {/* 1. Row Checkbox */}
                      <td className="py-2.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRowSelect(item.id)}
                          className="rounded border-[#1C1C1F] bg-[#000000] text-[#FF9933] focus:ring-0 cursor-pointer w-3.5 h-3.5"
                        />
                      </td>

                      {/* 2. Image Thumbnail with Zoom Lightbox Trigger */}
                      <td className="py-2.5 px-3 text-center">
                        <div
                          onClick={() =>
                            setLightboxImage({
                              url: getThumbnailUrl(item),
                              title: `${item.vendor} (${item.date})`,
                            })
                          }
                          className="relative w-9 h-9 rounded border border-[#1C1C1F] bg-[#000000] overflow-hidden cursor-pointer group shrink-0 mx-auto"
                          title="Click to view full receipt scan"
                        >
                          <img
                            src={getThumbnailUrl(item)}
                            alt="Scan Thumbnail"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Eye className="w-3 h-3 text-[#FF9933]" />
                          </div>
                        </div>
                      </td>

                      {/* 3. Vendor, Date, and Amount */}
                      <td className="py-2.5 px-4">
                        <div className="font-normal text-[#EDEDED] text-xs truncate max-w-[220px]">
                          {item.vendor}
                        </div>
                        <div className="text-[10px] text-[#8A8F98] mt-0.5 flex items-center gap-1.5 font-mono">
                          <span>{item.date}</span>
                          <span>&bull;</span>
                          <span className="text-[#138808]">
                            {formatINR(item.amount)}
                          </span>
                        </div>
                        {item.item_description && (
                          <div className="text-[10px] text-[#52555C] truncate max-w-[220px] mt-0.5">
                            {item.item_description}
                          </div>
                        )}
                      </td>

                      {/* 4. Confidence Visual Progress Bar */}
                      <td className="py-2.5 px-4">
                        <div className="space-y-1 max-w-[150px]">
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="text-[#52555C]">CONFIDENCE:</span>
                            <span
                              className={cn(
                                'font-mono',
                                confPct >= 65
                                  ? 'text-[#34D399]'
                                  : confPct >= 50
                                    ? 'text-[#F5B544]'
                                    : 'text-[#F87171]'
                              )}
                            >
                              {confPct}%
                            </span>
                          </div>

                          {/* Thin saffron progress bar */}
                          <div className="w-full h-1 rounded-full bg-[#111111] overflow-hidden">
                            <div
                              className="h-full bg-[#FF9933] transition-all"
                              style={{ width: `${Math.min(confPct, 100)}%` }}
                            />
                          </div>

                          <div className="text-[9.5px] font-mono text-[#52555C] flex items-center justify-between">
                            <span>OCR: {(ocrConf * 100).toFixed(0)}%</span>
                            <span>GATE: 65%</span>
                          </div>
                        </div>
                      </td>

                      {/* 5. Routing Reason */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-start gap-1.5 text-[11px] text-[#F5B544] max-w-[200px] font-mono">
                          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                          <span className="leading-snug">
                            {item.review_reason || 'Borderline prediction confidence'}
                          </span>
                        </div>
                      </td>

                      {/* 6. Inline Correction Dropdown & Save Button */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <select
                            value={currentCategory}
                            onChange={(e) =>
                              setInlineEdits({ ...inlineEdits, [item.id]: e.target.value })
                            }
                            className="bg-[#000000] border border-[#1C1C1F] rounded px-2 py-1 text-xs text-[#EDEDED] focus:outline-none focus:border-[#FF9933] max-w-[150px] truncate"
                          >
                            {STANDARD_CATEGORIES.map((c) => (
                              <option key={c.value} value={c.value} className="bg-[#0A0A0A] text-[#EDEDED]">
                                {c.label}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() => handleSaveInline(item)}
                            disabled={correctMutation.isPending}
                            title="Commit verified label & route to retraining loop"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#EDEDED] hover:bg-white text-black text-xs font-medium transition-colors shrink-0 cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                            <span>Save</span>
                          </button>
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

      {/* 5. HUMAN FEEDBACK CORRECTIONS AUDIT TRAIL (PARITY WITH STREAMLIT) */}
      <Card variant="solid" padding="md" className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#1C1C1F]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#FF9933]" />
            <h3 className="text-sm font-normal text-[#EDEDED]">
              Human Feedback Corrections Audit Trail
            </h3>
          </div>
          <span className="font-mono text-[10px] text-[#52555C]">
            {feedbackList && feedbackList.length > 0
              ? `${feedbackList.length} VERIFIED CORRECTIONS RECORDED`
              : 'DATA/HUMAN_FEEDBACK_CORRECTIONS.CSV'}
          </span>
        </div>

        {feedbackList && feedbackList.length > 0 ? (
          <div className="overflow-x-auto rounded border border-[#1C1C1F] bg-[#000000] max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#111111] text-[#52555C] font-mono text-[10px] uppercase tracking-[0.1em] border-b border-[#1C1C1F] sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Date / ID</th>
                  <th className="py-2.5 px-3">Vendor</th>
                  <th className="py-2.5 px-3">Original Category</th>
                  <th className="py-2.5 px-3 text-[#34D399]">Corrected Category</th>
                  <th className="py-2.5 px-3">Reviewer Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C1C1F]">
                {feedbackList.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-[#111111]/30">
                    <td className="py-2 px-3 font-mono text-[#52555C]">
                      {row.timestamp ? String(row.timestamp).slice(0, 10) : row.expense_id || `rec_${i}`}
                    </td>
                    <td className="py-2 px-3 font-normal text-[#EDEDED]">{row.vendor}</td>
                    <td className="py-2 px-3 font-mono text-[#F87171] line-through">
                      {row.old_category}
                    </td>
                    <td className="py-2 px-3 font-mono text-[#34D399]">
                      {row.corrected_category}
                    </td>
                    <td className="py-2 px-3 text-[#8A8F98]">{row.notes || 'Human verified'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 rounded bg-[#000000] border border-[#1C1C1F] text-center text-xs text-[#52555C] font-mono">
            NO FEEDBACK LOGGED YET &bull; CORRECTIONS ABOVE PERSIST TO DATA/HUMAN_FEEDBACK_CORRECTIONS.CSV
          </div>
        )}
      </Card>

      {/* 6. LIGHTBOX MODAL FOR FULL RECEIPT INSPECTION */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setLightboxImage(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-xl w-full bg-[#0A0A0A] border border-[#1C1C1F] rounded p-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#1C1C1F] mb-3">
                <span className="font-mono text-xs text-[#EDEDED] truncate">{lightboxImage.title}</span>
                <button
                  onClick={() => setLightboxImage(null)}
                  className="p-1 rounded text-[#52555C] hover:text-[#EDEDED]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-[600px] overflow-auto flex items-center justify-center bg-[#000000] rounded p-2 border border-[#1C1C1F]">
                <img
                  src={lightboxImage.url}
                  alt="Full Scan"
                  className="max-h-[560px] object-contain rounded"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReviewQueue;
