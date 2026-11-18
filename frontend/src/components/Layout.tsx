import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from './Navbar';
import { Footer } from './landing/Footer';
import { BottomTabs } from './BottomTabs';
import { CommandPalette } from './CommandPalette';
import { OnboardingTour } from './OnboardingTour';
import { SceneManager } from '@/three/SceneManager';
import { useMotionMode } from '@/hooks/useMotionMode';

export const Layout: React.FC = () => {
  const location = useLocation();
  const { reduceMotion } = useMotionMode();
  const isLanding = location.pathname === '/';
  const isAuth = location.pathname.startsWith('/auth');

  return (
    <div className="relative min-h-screen flex flex-col bg-[#000000] text-[#F5EFE6] font-body selection:bg-[#FF9933] selection:text-black pb-14 sm:pb-0">
      {/* 1. SINGLE PERSISTENT 3D BACKGROUND CANVAS (React Three Fiber) */}
      <SceneManager />

      {/* 2. STICKY TOP NAVIGATION BAR */}
      <Navbar />

      {/* 3. GLOBAL COMMAND PALETTE (Ctrl+K) */}
      <CommandPalette />

      {/* 4. ONBOARDING TOUR */}
      <OnboardingTour />

      {/* 5. MAIN PAGE CONTENT OVER 3D SCENE */}
      <main className="relative z-10 flex-1 w-full">
        {isLanding || isAuth ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
                transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* 6. MOBILE BOTTOM TAB BAR */}
      <BottomTabs />

      {/* 7. FOOTER */}
      {!isAuth && <Footer />}
    </div>
  );
};

export default Layout;
