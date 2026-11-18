import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useMotionMode } from '@/hooks/useMotionMode';
import { useCanvasVisibility, PERF_DPR, Accessible3DSummary } from '@/three/threeUtils';
import { PipelineNodes3D } from '@/three/PipelineNodes3D';
import { KPICard } from '@/components/ui/KPICard';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Cpu, ShieldCheck, Activity, Database, GitBranch, Zap, Sparkles } from 'lucide-react';

export const About: React.FC = () => {
  const { reduceMotion } = useMotionMode();
  const { containerRef, frameloop } = useCanvasVisibility(0.05, reduceMotion);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Section Header */}
      <SectionHeader
        tag="// SYSTEM_TOPOLOGY"
        title="Swadeshi Khata Architecture & Forensic Pipeline"
        subtitle="Explore the multi-stage machine learning & forensic audit engine built for Indian small businesses"
        icon="ℹ️"
      />

      {/* 3D INTERACTIVE PIPELINE NODES HERO */}
      <div
        ref={containerRef}
        role="region"
        aria-label="3D Architecture Pipeline Simulation"
        className="relative rounded bg-[#0A0A0A] border border-[#1C1C1F] overflow-hidden shadow-2xl h-80 flex items-center justify-center"
      >
        <Accessible3DSummary
          title="Interactive 3D Pipeline Nodes"
          summary="Visualizing the 6-stage Swadeshi Khata pipeline from raw receipt ingestion, OpenCV deskewing, EasyOCR, LLM parsing, anomaly detection to the SQLite ledger."
        />

        <div className="absolute top-4 left-4 z-10">
          <div className="text-xs font-mono font-medium uppercase tracking-wider text-[#FF9933] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FF9933] animate-ping" />
            <span>Interactive 3D Pipeline Topology</span>
          </div>
          <div className="text-[11px] text-[#A59E92] font-mono">Drag to inspect 3D node mesh</div>
        </div>

        <Canvas frameloop={frameloop} dpr={PERF_DPR} camera={{ position: [0, 0, 5], fov: 45 }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1.5} color="#FFF5EA" />
          <directionalLight position={[-5, 5, 5]} intensity={1} color="#FF9933" />
          <Suspense fallback={null}>
            <PipelineNodes3D />
          </Suspense>
          <OrbitControls enableZoom={false} autoRotate={!reduceMotion} autoRotateSpeed={0.8} />
        </Canvas>
      </div>

      {/* BENCHMARK TILES */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <KPICard
          label="OCR ACCURACY"
          value="94.2%"
          sub="Bilingual EN + Hindi"
          accent="success"
          className="border-[#1C1C1F]"
          tooltip="Tested on bilingual Indian receipts including thermal prints and low-contrast mobile camera captures."
        />
        <KPICard
          label="CLASSIFIER F1"
          value="0.912"
          sub="Macro F1 on 8 classes"
          accent="brand"
          className="border-[#1C1C1F]"
          tooltip="Evaluated across 500 out-of-fold Hinglish and commercial receipts."
        />
        <KPICard
          label="PIPELINE LATENCY"
          value="1.8s"
          sub="End-to-end audit cycle"
          accent="warning"
          className="border-[#1C1C1F]"
          tooltip="Includes OpenCV deskewing, neural OCR bounding box extraction, entity parsing, and anomaly scoring."
        />
        <KPICard
          label="CONFIDENCE GATES"
          value="65% / 60%"
          sub="CLF & OCR thresholds"
          accent="danger"
          className="border-[#1C1C1F]"
          tooltip="Receipts scoring below 0.65 classifier confidence or 0.60 OCR confidence automatically route to human review."
        />
      </div>

      {/* PIPELINE DATAFLOW MAP */}
      <Card variant="solid" padding="md" className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[#1C1C1F]">
          <GitBranch className="w-4 h-4 text-[#FF9933]" />
          <h2 className="text-sm font-heading font-medium text-[#F5EFE6]">
            End-to-End Pipeline Dataflow (डेटा प्रवाह)
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center font-mono">
          <div className="bg-[#000000] border border-[#1C1C1F] p-3 rounded">
            <div className="text-xs font-semibold text-[#FF9933]">1. Ingest Slip</div>
            <div className="text-[11px] text-[#A59E92] mt-1">Mobile photos, PDFs, PNGs</div>
          </div>
          <div className="bg-[#000000] border border-[#1C1C1F] p-3 rounded">
            <div className="text-xs font-semibold text-[#D4A017]">2. OpenCV Prep</div>
            <div className="text-[11px] text-[#A59E92] mt-1">Deskew &plusmn;45&deg;, Otsu Binarize</div>
          </div>
          <div className="bg-[#000000] border border-[#1C1C1F] p-3 rounded">
            <div className="text-xs font-semibold text-[#138808]">3. Dual OCR</div>
            <div className="text-[11px] text-[#A59E92] mt-1">EasyOCR English + Devanagari</div>
          </div>
          <div className="bg-[#000000] border border-[#1C1C1F] p-3 rounded">
            <div className="text-xs font-semibold text-[#FF9933]">4. LLM Parser</div>
            <div className="text-[11px] text-[#A59E92] mt-1">Vendor, totals, taxes, lines</div>
          </div>
          <div className="bg-[#000000] border border-[#1C1C1F] p-3 rounded">
            <div className="text-xs font-semibold text-[#138808]">5. Categorizer</div>
            <div className="text-[11px] text-[#A59E92] mt-1">TF-IDF + Calibrated 8 classes</div>
          </div>
          <div className="bg-[#000000] border border-[#1C1C1F] p-3 rounded">
            <div className="text-xs font-semibold text-[#B3202A]">6. Anomaly Engine</div>
            <div className="text-[11px] text-[#A59E92] mt-1">Isolation Forest + Z-Scores</div>
          </div>
          <div className="bg-[#000000] border border-[#1C1C1F] p-3 rounded">
            <div className="text-xs font-semibold text-[#D4A017]">7. Feedback Loop</div>
            <div className="text-[11px] text-[#A59E92] mt-1">Operator correction loop</div>
          </div>
          <div className="bg-[#000000] border border-[#1C1C1F] p-3 rounded">
            <div className="text-xs font-semibold text-[#FF9933]">8. Khata Ledger</div>
            <div className="text-[11px] text-[#A59E92] mt-1">SQLite + GST Breakdown</div>
          </div>
        </div>
      </Card>

      {/* TECH STACK GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="solid" padding="md" className="space-y-2">
          <div className="text-xs font-mono font-medium text-[#FF9933] uppercase">
            Sovereign Frontend
          </div>
          <ul className="text-xs text-[#A59E92] space-y-1.5 list-disc list-inside font-body">
            <li>Vite + React 18 + TypeScript</li>
            <li>Tailwind CSS + Pure Black Command Tokens</li>
            <li>React Three Fiber (WebGL 3D Context)</li>
            <li>i18next Multilingual (EN, HI, TA, BN, MR, TE, GU)</li>
            <li>Pure Web Audio API Tanpura Synthesizer</li>
          </ul>
        </Card>

        <Card variant="solid" padding="md" className="space-y-2">
          <div className="text-xs font-mono font-medium text-[#138808] uppercase">
            FastAPI Backend
          </div>
          <ul className="text-xs text-[#A59E92] space-y-1.5 list-disc list-inside font-body">
            <li>FastAPI High-Performance REST</li>
            <li>SQLite Relational Database (SQLAlchemy)</li>
            <li>Additive JWT & Mobile OTP Auth</li>
            <li>5,000 SMB Benchmark Ledger</li>
            <li>Pydantic v2 Request/Response Schemas</li>
          </ul>
        </Card>

        <Card variant="solid" padding="md" className="space-y-2">
          <div className="text-xs font-mono font-medium text-[#D4A017] uppercase">
            Forensics & AI Engines
          </div>
          <ul className="text-xs text-[#A59E92] space-y-1.5 list-disc list-inside font-body">
            <li>EasyOCR (English + Hindi Devanagari)</li>
            <li>OpenCV Binarization & Deskewing</li>
            <li>Scikit-Learn (Isolation Forest & TF-IDF)</li>
            <li>SARIMA & XGBoost Forecasting</li>
            <li>Google Gemini AI Financial Copilot</li>
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default About;
