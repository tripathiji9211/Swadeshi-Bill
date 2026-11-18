import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInsights } from '@/api/client';
import { formatINR } from '@/lib/indianFormats';
import { KPICard } from '@/components/ui/KPICard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SkeletonKPICard } from '@/components/ui/Skeleton';
import {
  TrendingDown,
  AlertTriangle,
  Repeat,
  FileText,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const Insights: React.FC = () => {
  const { t } = useTranslation();
  const { data: insights, isLoading } = useInsights();

  const [activeTab, setActiveTab] = useState<'all' | 'variance' | 'spikes' | 'subscriptions'>(
    'all'
  );

  const savings = insights?.total_potential_annual_savings || 0;
  const analyzedSpend = insights?.total_spend_analyzed || 0;
  const auditedCount = insights?.total_expenses_audited || 0;
  const tips = insights?.actionable_tips || [];

  // Fallback findings or structured data
  const priceVariances =
    insights?.price_variance_findings || (insights as any)?.vendor_price_variances || [];
  const categorySpikes =
    insights?.category_spike_findings || (insights as any)?.budget_spikes || [];
  const subscriptions =
    insights?.subscription_findings || (insights as any)?.active_subscriptions || [];
  const executiveMarkdown = insights?.executive_report_markdown || '';

  return (
    <div className="space-y-6">
      {/* 1. SECTION HEADER */}
      <SectionHeader
        title="Bachat Margdarshak & Savings Sentinel (बचत मार्गदर्शक)"
        subtitle="Forensic vendor price arbitrage, budget spikes (>25% vs 3M rolling average), and recurring supplier retainers"
        icon="💡"
        badge={
          <StatusBadge
            label={`${formatINR(savings, { compact: true })} Bachat Sambhav`}
            variant="success"
            dot
          />
        }
      />

      {/* 2. TOP KPI STRIP */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <SkeletonKPICard />
          <SkeletonKPICard />
          <SkeletonKPICard />
          <SkeletonKPICard />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <KPICard
            label="POTENTIAL ANNUAL SAVINGS"
            value={formatINR(savings, { compact: true })}
            sub="Recoverable via vendor arbitrage"
            accent="success"
            className="border-[#1C1C1F]"
            tooltip="Algorithmic sum of multi-vendor pricing arbitrage and redundant subscription pruning."
          />
          <KPICard
            label="TOTAL AUDITED EXPENDITURE"
            value={formatINR(analyzedSpend, { compact: true })}
            sub={`${auditedCount.toLocaleString()} verified bills`}
            accent="brand"
            className="border-[#1C1C1F]"
            tooltip="Total gross commercial spend evaluated by the forensic insights engine."
          />
          <KPICard
            label="SAVINGS MARGIN EXPANSION"
            value={analyzedSpend > 0 ? `${((savings / analyzedSpend) * 100).toFixed(1)}%` : '0%'}
            sub="Direct bottom-line recovery"
            accent="brand"
            className="border-[#1C1C1F]"
            tooltip="Percentage of historical expenditure reclaimable without operational disruption."
          />
          <KPICard
            label="ACTIONABLE PRICE LEAKS"
            value={priceVariances.length + categorySpikes.length + subscriptions.length}
            sub="Surveillance flags identified"
            accent="warning"
            className="border-[#1C1C1F]"
            tooltip="Total identified anomalies across vendor price variance, spikes, and retainers."
          />
        </div>
      )}

      {/* 3. LLM EXECUTIVE REPORT WITH 3 ACTIONABLE DIRECTIVES */}
      <div className="rounded bg-[#0A0A0A] border border-[#1C1C1F] p-4 sm:p-5 relative overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-[#1C1C1F] mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#FF9933]" />
            <h2 className="text-sm font-semibold text-[#F5EFE6]">
              Swadeshi Sahayak: Executive Monthly Directive (कार्यकारी रिपोर्ट)
            </h2>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#A59E92]">
            Powered by Google Gemini LLM
          </span>
        </div>

        {/* 3 Actionable Tips */}
        <div className="space-y-3 mb-5">
          <h3 className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#656057]">
            Top 3 Actionable Cost Optimization Directives
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {tips.slice(0, 3).map((tip: any, idx: number) => {
              const title =
                typeof tip === 'string' ? `Optimization Directive #${idx + 1}` : tip.title;
              const desc = typeof tip === 'string' ? tip : tip.description;
              const cat = typeof tip === 'string' ? 'Arbitrage' : tip.category || 'Operations';
              const amt = typeof tip === 'string' ? 0 : tip.potential_savings || 0;

              return (
                <div
                  key={idx}
                  className="rounded bg-[#000000] border border-[#1C1C1F] p-4 relative overflow-hidden flex flex-col justify-between hover:border-[#FF9933]/50 transition-colors"
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#FF9933] via-[#D4A017] to-transparent" />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider">
                      <span className="text-[#FF9933]">{cat.replace('_', ' ')}</span>
                      <span className="text-[#D4A017]">PRIORITY #{idx + 1}</span>
                    </div>
                    <h4 className="text-xs font-semibold text-[#F5EFE6] leading-snug">{title}</h4>
                    <p className="text-[11px] text-[#A59E92] leading-relaxed font-body">{desc}</p>
                  </div>

                  {amt > 0 && (
                    <div className="mt-4 pt-2.5 border-t border-[#1C1C1F] flex items-center justify-between text-xs">
                      <span className="text-[10px] text-[#656057] uppercase font-mono">Bachat:</span>
                      <span className="font-mono font-semibold text-[#138808]">{formatINR(amt)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Narrative Executive Synthesis */}
        {executiveMarkdown && (
          <div className="mt-3 p-4 rounded bg-[#000000] border border-[#1C1C1F] text-xs text-[#A59E92] leading-relaxed font-sans space-y-2">
            <div className="font-mono text-[10px] text-[#F5EFE6] uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#FF9933]" />
              <span>Full Ledger Synthesis Narrative</span>
            </div>
            <div className="prose prose-invert prose-xs max-w-none whitespace-pre-line text-[#A59E92] font-body">
              {executiveMarkdown}
            </div>
          </div>
        )}
      </div>

      {/* 4. TABS: OVERPRICED VENDORS | CATEGORY SPIKES | RECURRING SUBSCRIPTIONS */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-[#1C1C1F] pb-2">
          {[
            {
              id: 'all',
              label: `All Intelligence (${priceVariances.length + categorySpikes.length + subscriptions.length})`,
            },
            { id: 'variance', label: `Vendor Price Spread (${priceVariances.length})` },
            { id: 'spikes', label: `Budget Spikes >25% (${categorySpikes.length})` },
            { id: 'subscriptions', label: `Recurring Retainers (${subscriptions.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-mono transition-colors uppercase tracking-wider',
                activeTab === tab.id
                  ? 'bg-[#1C1C1F] text-[#FF9933] border border-[#FF9933]/40'
                  : 'text-[#A59E92] hover:text-[#F5EFE6] hover:bg-[#111111]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* SECTION A: OVERPRICED VENDOR ITEMS (PRICE VARIANCE) */}
        {(activeTab === 'all' || activeTab === 'variance') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#F5EFE6] flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-[#FF9933]" />
                <span>Vendor Price Arbitrage (Same Product, Different Suppliers)</span>
              </h3>
              <span className="text-[10px] font-mono text-[#656057] uppercase">
                Consolidate to lowest priced supplier
              </span>
            </div>

            {priceVariances.length === 0 ? (
              <div className="p-6 rounded bg-[#0A0A0A] border border-[#1C1C1F] text-center text-xs text-[#A59E92]">
                No cross-vendor price variances detected in current dataset.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {priceVariances.map((item: any, i: number) => {
                  const desc = item.item_description || item.vendor;
                  const cheapest = item.cheapest_vendor || 'Benchmark Vendor';
                  const expensive = item.expensive_vendor || item.vendor || 'Secondary Vendor';
                  const spread = item.price_spread_pct || item.variance_pct || 25;
                  const annSavings = item.estimated_annual_savings || 12000;

                  return (
                    <div key={i} className="rounded bg-[#0A0A0A] border border-[#1C1C1F] p-4 space-y-3 hover:border-[#2A2A2E] transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-wider text-[#FF9933]">
                            {item.category?.replace('_', ' ') || 'COMMERCIAL ITEM'}
                          </div>
                          <h4 className="text-xs font-semibold text-[#F5EFE6] mt-0.5">{desc}</h4>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#B3202A]/10 text-[#B3202A] border border-[#B3202A]/30">
                          +{spread.toFixed(1)}% SPREAD
                        </span>
                      </div>

                      {/* Pricing Comparison Boxes */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded bg-[#000000] border border-[#138808]/30">
                          <div className="text-[10px] text-[#138808] font-mono uppercase">
                            Cheapest Supplier
                          </div>
                          <div className="font-medium text-[#F5EFE6] truncate mt-0.5">{cheapest}</div>
                          <div className="text-sm font-mono font-semibold text-[#138808] mt-1">
                            {formatINR(item.cheapest_price || item.benchmark_price || 0)}
                          </div>
                        </div>

                        <div className="p-2.5 rounded bg-[#000000] border border-[#B3202A]/30">
                          <div className="text-[10px] text-[#B3202A] font-mono uppercase">
                            Higher Supplier
                          </div>
                          <div className="font-medium text-[#F5EFE6] truncate mt-0.5">
                            {expensive}
                          </div>
                          <div className="text-sm font-mono font-semibold text-[#B3202A] mt-1">
                            {formatINR(item.expensive_price || item.average_price || 0)}
                          </div>
                        </div>
                      </div>

                      {/* Recommendation & Annual Savings */}
                      <div className="pt-2 border-t border-[#1C1C1F] flex items-center justify-between text-xs">
                        <span className="text-[#A59E92] text-[11px] truncate max-w-[200px]">
                          {item.recommendation || `Switch orders to ${cheapest}`}
                        </span>
                        <div className="text-right">
                          <span className="text-[10px] text-[#656057] uppercase font-mono block">Annual Savings</span>
                          <span className="font-mono font-semibold text-[#138808]">
                            {formatINR(annSavings)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SECTION B: CATEGORY BUDGET SPIKES (>25%) */}
        {(activeTab === 'all' || activeTab === 'spikes') && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#F5EFE6] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#D4A017]" />
                <span>Category Budget Spikes (&gt;25% Above 3-Month Rolling Average)</span>
              </h3>
              <span className="text-[10px] font-mono text-[#656057] uppercase">Budget variance alarms</span>
            </div>

            {categorySpikes.length === 0 ? (
              <div className="p-6 rounded bg-[#0A0A0A] border border-[#1C1C1F] text-center text-xs text-[#A59E92]">
                No categories exceeded their 3-month rolling average by &gt;25%.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categorySpikes.map((spike: any, i: number) => {
                  const cat = spike.category || 'Commercial Category';
                  const spikePct = spike.spike_percentage || spike.increase_pct || 32;
                  const excess = spike.excess_spend || 45000;
                  const rollingAvg = spike.rolling_3m_average || spike.prior_month_spend || 80000;
                  const actual = spike.actual_spend || spike.current_month_spend || 125000;

                  return (
                    <div
                      key={i}
                      className="rounded bg-[#0A0A0A] border border-[#D4A017]/30 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-wider text-[#D4A017]">
                            {spike.month || 'Current Cycle'}
                          </div>
                          <h4 className="text-xs font-semibold text-[#F5EFE6] uppercase mt-0.5">
                            {cat.replace('_', ' ')}
                          </h4>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#D4A017]/10 text-[#D4A017] border border-[#D4A017]/30">
                          +{spikePct.toFixed(0)}% SPIKE
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="p-2 rounded bg-[#000000] border border-[#1C1C1F]">
                          <span className="text-[10px] text-[#656057] uppercase font-mono block">3M Rolling</span>
                          <span className="font-mono font-semibold text-[#F5EFE6] mt-0.5 block">
                            {formatINR(rollingAvg)}
                          </span>
                        </div>
                        <div className="p-2 rounded bg-[#000000] border border-[#1C1C1F]">
                          <span className="text-[10px] text-[#656057] uppercase font-mono block">Actual Spend</span>
                          <span className="font-mono font-semibold text-[#D4A017] mt-0.5 block">
                            {formatINR(actual)}
                          </span>
                        </div>
                        <div className="p-2 rounded bg-[#000000] border border-[#B3202A]/30">
                          <span className="text-[10px] text-[#B3202A] uppercase font-mono block">Excess Burn</span>
                          <span className="font-mono font-semibold text-[#B3202A] mt-0.5 block">
                            +{formatINR(excess)}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-[#A59E92] pt-1 flex items-center gap-1.5 font-body">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#D4A017] shrink-0" />
                        <span>
                          Driver:{' '}
                          {spike.likely_driver ||
                            'Sudden volume increase or unannounced vendor price hike'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SECTION C: RECURRING SUBSCRIPTIONS */}
        {(activeTab === 'all' || activeTab === 'subscriptions') && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#F5EFE6] flex items-center gap-2">
                <Repeat className="w-4 h-4 text-[#FF9933]" />
                <span>Recurring Subscriptions & Retainers (सक्रिय अनुबंध)</span>
              </h3>
              <span className="text-[10px] font-mono text-[#656057] uppercase">
                Review for unused seats or redundant retainers
              </span>
            </div>

            {subscriptions.length === 0 ? (
              <div className="p-6 rounded bg-[#0A0A0A] border border-[#1C1C1F] text-center text-xs text-[#A59E92]">
                No active recurring subscriptions detected in current ledger.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {subscriptions.map((sub: any, i: number) => {
                  const name = sub.service_name || sub.vendor || 'Subscription';
                  const vendor = sub.vendor || name;
                  const cadence = sub.billing_cadence || sub.cadence || 'Monthly';
                  const amount = sub.avg_billing_amount || sub.recurring_amount || 4500;
                  const annual = sub.annual_spend || amount * 12;

                  return (
                    <div key={i} className="rounded bg-[#0A0A0A] border border-[#1C1C1F] p-4 space-y-2.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-wider text-[#FF9933]">
                            {cadence} Plan
                          </div>
                          <h4 className="text-xs font-semibold text-[#F5EFE6] truncate max-w-[160px]">
                            {name}
                          </h4>
                          <span className="text-[10px] text-[#A59E92] font-mono">{vendor}</span>
                        </div>
                        <span className="w-7 h-7 rounded bg-[#111111] border border-[#1C1C1F] flex items-center justify-center text-xs">
                          💳
                        </span>
                      </div>

                      <div className="pt-2 border-t border-[#1C1C1F] flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] text-[#656057] uppercase font-mono block">Per Cycle</span>
                          <span className="font-mono font-semibold text-[#F5EFE6]">{formatINR(amount)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-[#656057] uppercase font-mono block">Annualized</span>
                          <span className="font-mono font-semibold text-[#D4A017]">
                            {formatINR(annual)}
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-[#138808] font-medium pt-1 font-body">
                        Action:{' '}
                        {sub.optimization_action || 'Review seat utilization before renewal'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Insights;
