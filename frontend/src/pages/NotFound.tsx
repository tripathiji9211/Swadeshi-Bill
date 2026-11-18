import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Compass, LayoutDashboard, FileUp, ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-lg text-center"
      >
        <Card variant="glass" padding="lg" glow className="relative">
          {/* Glowing 404 Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-bold uppercase tracking-wider mb-4">
            <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
            404 &bull; Missing Route
          </div>

          <h1 className="text-6xl sm:text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-500">
            404
          </h1>

          <h2 className="mt-2 text-xl font-bold text-white tracking-tight">
            Financial Ledger Route Not Found
          </h2>

          <p className="mt-2 text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
            The page or audited transaction view you are searching for does not exist or has been
            relocated.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-lg shadow-brand-500/20 transition-all active:scale-95"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Go to Dashboard</span>
            </Link>

            <Link
              to="/upload"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/[0.08] font-semibold text-xs transition-all active:scale-95"
            >
              <FileUp className="w-4 h-4 text-brand-400" />
              <span>Upload Receipt</span>
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default NotFound;
