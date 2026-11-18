import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface OfflineBannerProps {
  backendUrl?: string;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  backendUrl = 'http://127.0.0.1:8000',
}) => {
  const { t } = useTranslation();

  return (
    <div className="mb-6 rounded border border-[#F5B544]/30 bg-[#0A0A0A] p-4 text-[#F5B544]">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-[#F5B544] shrink-0 mt-0.5" />
        <div className="text-xs">
          <div className="font-medium text-[#F5B544]">
            {t('offline.title', 'Backend Service Offline')}
          </div>
          <div className="mt-1 text-[#8A8F98]">
            {t('offline.message', 'Cannot reach backend at')}{' '}
            <code className="bg-[#111111] border border-[#1C1C1F] px-1.5 py-0.5 rounded text-[#EDEDED] font-mono">
              {backendUrl}
            </code>
            . {t('offline.instruction', 'Start the backend service in your terminal:')}
          </div>
          <div className="mt-2 bg-[#000000] border border-[#1C1C1F] rounded p-2 font-mono text-[11px] text-[#FF9933]">
            python -m uvicorn src.api.main:app --port 8000
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineBanner;
