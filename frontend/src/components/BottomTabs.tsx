import React from 'react';
import { NavLink } from 'react-router-dom';
import { Upload, CheckCircle2, LayoutDashboard, TrendingUp, Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const BottomTabs: React.FC = () => {
  const { t } = useTranslation();

  const tabs = [
    { to: '/upload', label: t('nav.upload', 'Upload'), icon: Upload },
    { to: '/review-queue', label: t('nav.review', 'Review'), icon: CheckCircle2 },
    { to: '/dashboard', label: t('nav.dashboard', 'Khata'), icon: LayoutDashboard },
    { to: '/forecast', label: t('nav.forecast', 'Forecast'), icon: TrendingUp },
    { to: '/ask', label: t('nav.ask', 'Sahayak'), icon: Bot },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#000000]/90 backdrop-blur-md border-t border-[#1C1C1F] sm:hidden safe-area-pb"
      aria-label="Mobile Navigation"
    >
      <div className="grid grid-cols-5 h-14">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  isActive ? 'text-[#FF9933]' : 'text-[#656057] hover:text-[#A59E92]'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9.5px] font-mono tracking-tight">{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomTabs;
