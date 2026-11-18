import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, Store, ShieldCheck, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';

export const UserMenu: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isAuthenticated, isGuest, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isAuthenticated || !user) {
    return (
      <button
        onClick={() => navigate('/auth')}
        className="px-3 py-1.5 rounded bg-[#111111] hover:bg-[#161618] border border-[#1C1C1F] text-xs font-mono text-[#F5EFE6] transition-colors cursor-pointer"
      >
        {t('nav.signIn', 'Sign In')}
      </button>
    );
  }

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    navigate('/auth');
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 pl-2 pr-2.5 rounded bg-[#111111] hover:bg-[#161618] border border-[#1C1C1F] transition-colors cursor-pointer"
      >
        <div className="w-6 h-6 rounded-full bg-[#000000] border border-[#FF9933]/50 flex items-center justify-center text-[#FF9933]">
          <Store className="w-3.5 h-3.5" />
        </div>
        <div className="text-left hidden sm:block">
          <div className="text-[11px] font-medium text-[#F5EFE6] truncate max-w-[120px]">
            {user.business_name}
          </div>
          <div className="text-[9px] font-mono text-[#A59E92] truncate max-w-[120px]">
            {user.state} {isGuest && `• ${t('common.demoData', 'Demo')}`}
          </div>
        </div>
        <ChevronDown className="w-3 h-3 text-[#A59E92]" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded bg-[#0A0A0A] border border-[#1C1C1F] py-1 shadow-2xl z-50">
          <div className="px-3 py-2 border-b border-[#1C1C1F]">
            <div className="text-xs font-medium text-[#F5EFE6]">{user.name}</div>
            <div className="text-[11px] text-[#A59E92] truncate">{user.email}</div>
            {user.gstin && (
              <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#111111] border border-[#1C1C1F] text-[9.5px] font-mono text-[#138808]">
                <ShieldCheck className="w-2.5 h-2.5" />
                <span>GST: {user.gstin}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              navigate('/dashboard');
            }}
            className="w-full text-left px-3 py-2 text-xs text-[#A59E92] hover:text-[#F5EFE6] hover:bg-[#161618] flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-[#D4A017]" />
            <span>{t('landing.missionControl', 'Mission Control')}</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-xs text-[#B3202A] hover:bg-[#161618] flex items-center gap-2 transition-colors border-t border-[#1C1C1F] cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t('nav.signOut', 'Sign Out')}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
