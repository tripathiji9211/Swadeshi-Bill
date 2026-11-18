import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Upload,
  CheckCircle2,
  LayoutDashboard,
  TrendingUp,
  Sparkles,
  Bot,
  Volume2,
  VolumeX,
  Sliders,
  X,
} from 'lucide-react';
import { tanpuraSynth } from '@/lib/audioSynth';
import { useMotionMode } from '@/hooks/useMotionMode';

export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { reduceMotion, setReduceMotion } = useMotionMode();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isOpen) return null;

  const isMuted = tanpuraSynth.getMuted();

  const actions = [
    {
      id: 'upload',
      title: t('palette.uploadTitle', 'Upload Commercial Receipt'),
      sub: t('palette.uploadSub', 'Extract with EasyOCR and forensic audit'),
      icon: Upload,
      action: () => navigate('/upload'),
    },
    {
      id: 'review',
      title: t('palette.reviewTitle', 'Needs Review Queue'),
      sub: t('palette.reviewSub', 'Inspect flagged anomalies and verify OCR'),
      icon: CheckCircle2,
      action: () => navigate('/review-queue'),
    },
    {
      id: 'dashboard',
      title: t('palette.dashboardTitle', 'Mission Control Dashboard'),
      sub: t('palette.dashboardSub', 'Real-time ledger telemetry and cash burn'),
      icon: LayoutDashboard,
      action: () => navigate('/dashboard'),
    },
    {
      id: 'forecast',
      title: t('palette.forecastTitle', 'Forward Spend Forecast'),
      sub: t('palette.forecastSub', 'Time-series projections with festival markers'),
      icon: TrendingUp,
      action: () => navigate('/forecast'),
    },
    {
      id: 'insights',
      title: t('palette.insightsTitle', 'Savings Insights'),
      sub: t('palette.insightsSub', 'Vendor price spread and recurring retainers'),
      icon: Sparkles,
      action: () => navigate('/insights'),
    },
    {
      id: 'ask',
      title: t('palette.askTitle', 'Swadeshi Sahayak'),
      sub: t('palette.askSub', 'Ask questions about your business expenses'),
      icon: Bot,
      action: () => navigate('/ask'),
    },
    {
      id: 'sound',
      title: isMuted ? t('palette.soundOn', 'Turn On Tanpura Drone') : t('palette.soundOff', 'Mute Ambient Audio'),
      sub: t('palette.soundSub', 'Ambient meditative Indian drone synthesis'),
      icon: isMuted ? Volume2 : VolumeX,
      action: () => tanpuraSynth.toggle(),
    },
    {
      id: 'motion',
      title: reduceMotion ? t('palette.motion3D', 'Switch to 3D Immersive Mode') : t('palette.motion2D', 'Switch to 2D Lite Mode'),
      sub: t('palette.motionSub', 'Optimize for low-power devices and battery saving'),
      icon: Sliders,
      action: () => setReduceMotion(!reduceMotion),
    },
  ];

  const filtered = actions.filter(
    (a) =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.sub.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
      <div className="w-full max-w-xl rounded bg-[#0A0A0A] border border-[#1C1C1F] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-[#1C1C1F] gap-3">
          <Search className="w-4 h-4 text-[#FF9933]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('palette.searchPlaceholder', 'Search commands, pages, or tools...')}
            className="w-full bg-transparent text-xs text-[#F5EFE6] placeholder-[#656057] focus:outline-none font-mono"
          />
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-[#656057] hover:text-[#F5EFE6] cursor-pointer"
            aria-label={t('common.close', 'Close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Items List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  item.action();
                  setIsOpen(false);
                }}
                className="w-full text-left p-2.5 rounded hover:bg-[#111111] border border-transparent hover:border-[#1C1C1F] flex items-center justify-between transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded border border-[#1C1C1F] bg-[#000000] flex items-center justify-center text-[#FF9933] group-hover:border-[#FF9933]/40">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[#F5EFE6] group-hover:text-[#FF9933] transition-colors">
                      {item.title}
                    </div>
                    <div className="text-[10px] text-[#A59E92]">{item.sub}</div>
                  </div>
                </div>
                <span className="font-mono text-[9px] text-[#656057] uppercase tracking-wider">
                  {t('palette.enter', 'Enter')} ↵
                </span>
              </button>
            );
          })}
        </div>

        <div className="px-4 py-2 border-t border-[#1C1C1F] bg-[#000000] flex items-center justify-between text-[10px] font-mono text-[#656057]">
          <span>{t('palette.footerShortcut', 'Swadeshi Command Palette')} // Ctrl+K</span>
          <span>{t('palette.escToClose', 'Esc to close')}</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
