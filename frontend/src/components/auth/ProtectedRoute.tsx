import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#000000] flex flex-col items-center justify-center space-y-4">
        {/* Glowing Saffron Chakra loader */}
        <div className="relative w-12 h-12 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-[#FF9933]/30 animate-ping" />
          <div className="w-10 h-10 rounded-full border-2 border-t-[#FF9933] border-r-[#D4A017] border-b-[#138808] border-l-transparent animate-spin" />
        </div>
        <p className="font-mono text-xs text-[#A59E92] uppercase tracking-[0.14em]">
          खाता लोड हो रहा है // LOADING KHATA...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
