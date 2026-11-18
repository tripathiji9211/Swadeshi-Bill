import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileUp,
  ClipboardList,
  LayoutDashboard,
  TrendingUp,
  Lightbulb,
  MessageSquareText,
  Info,
  ChevronLeft,
  ChevronRight,
  Server,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useReviewQueue } from '@/hooks/useExpenses';
import { useBackendStatus } from '@/api/client';
import { cn } from '@/lib/utils';

export interface SidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed: externalCollapsed,
  onToggleCollapse,
}) => {
  const { t } = useTranslation();
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('swadeshikhata_sidebar_collapsed') === 'true';
  });

  const isCollapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;

  const toggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem('swadeshikhata_sidebar_collapsed', String(next));
        return next;
      });
    }
  };

  const { data: reviewItems } = useReviewQueue();
  const pendingCount = reviewItems?.length || 0;
  const { isOnline } = useBackendStatus();

  const navItems: NavItem[] = [
    { to: '/upload', label: t('nav.upload', 'Upload'), icon: <FileUp className="w-4 h-4 shrink-0" /> },
    {
      to: '/review-queue',
      label: t('nav.review', 'Review Queue'),
      icon: <ClipboardList className="w-4 h-4 shrink-0" />,
      badge: pendingCount,
    },
    {
      to: '/dashboard',
      label: t('nav.dashboard', 'Dashboard'),
      icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
    },
    { to: '/forecast', label: t('nav.forecast', 'Forecast'), icon: <TrendingUp className="w-4 h-4 shrink-0" /> },
    { to: '/insights', label: t('nav.insights', 'Insights'), icon: <Lightbulb className="w-4 h-4 shrink-0" /> },
    {
      to: '/ask',
      label: t('nav.ask', 'Sahayak'),
      icon: <MessageSquareText className="w-4 h-4 shrink-0" />,
    },
    { to: '/about', label: t('nav.about', 'About'), icon: <Info className="w-4 h-4 shrink-0" /> },
  ];

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 64 : 220 }}
      transition={{ duration: 0.18, ease: 'easeInOut' }}
      className={cn(
        'relative shrink-0 flex flex-col justify-between',
        'border-r border-[#1C1C1F] bg-[#0A0A0A]',
        'py-4 z-30 select-none overflow-hidden hidden md:flex'
      )}
    >
      <div>
        <div className="px-3 pb-3 flex items-center justify-between border-b border-[#1C1C1F] mb-3">
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                className="flex items-center gap-2 pl-1"
              >
                <div className="w-5 h-5 rounded border border-[#2A2A2E] bg-[#111111] flex items-center justify-center font-mono text-[10px] text-[#FF9933]">
                  SK
                </div>
                <span className="font-heading text-xs tracking-tight text-[#F5EFE6]">
                  {t('brand.name', 'Swadeshi Khata')}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={toggleCollapse}
            aria-label={isCollapsed ? t('common.next', 'Expand') : t('common.back', 'Collapse')}
            className={cn(
              'p-1.5 rounded border border-[#1C1C1F] text-[#8A8F98] hover:text-[#EDEDED] transition-colors cursor-pointer',
              isCollapsed && 'mx-auto'
            )}
          >
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        <nav className="px-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/upload'}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center rounded text-xs transition-colors',
                  isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 gap-2.5',
                  isActive
                    ? 'bg-[#111111] text-[#FF9933] border border-[#1C1C1F]'
                    : 'text-[#8A8F98] hover:text-[#EDEDED] hover:bg-[#111111]/40'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'transition-colors',
                      isActive ? 'text-[#FF9933]' : 'text-[#52555C] group-hover:text-[#EDEDED]'
                    )}
                  >
                    {item.icon}
                  </span>

                  {!isCollapsed && (
                    <span className="truncate flex-1 tracking-tight">{item.label}</span>
                  )}

                  {!isCollapsed && item.badge !== undefined && item.badge > 0 && (
                    <span className="px-1.5 py-0.2 rounded-xs font-mono text-[9.5px] bg-[#111111] text-[#F5B544] border border-[#F5B544]/30 shrink-0">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="px-3 pt-3 border-t border-[#1C1C1F]">
        {!isCollapsed && (
          <div className="flex items-center justify-between text-[10px] font-mono text-[#52555C]">
            <span className="flex items-center gap-1.5">
              <span
                className={cn('w-1.5 h-1.5 rounded-full', isOnline ? 'bg-[#138808]' : 'bg-[#B3202A]')}
              />
              {isOnline ? t('common.online', 'Online') : t('common.offline', 'Offline')}
            </span>
            <Server className="w-3 h-3 text-[#52555C]" />
          </div>
        )}
      </div>
    </motion.aside>
  );
};

export default Sidebar;
