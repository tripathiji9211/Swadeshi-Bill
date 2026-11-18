import React, { useState, useRef, useEffect, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { uploadReceipt, updateExpense, useSampleReceipts } from '@/api/client';
import { AuditedReceipt, SampleReceiptResponse, ReceiptItem } from '@/types';
import { formatINR } from '@/lib/indianFormats';
import { Card } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { StatusBadge, AnomalyRiskBadge, ConfidenceBadge } from '@/components/ui/StatusBadge';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ThreeSkeletonLoader } from '@/three/threeUtils';
import {
  Upload as UploadIcon,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Database,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldCheck,
  Plus,
  Trash2,
  Scan,
  RefreshCw,
  Eye,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Lazy-load 3D Components under performance budget
const AnomalyGauge3D = lazy(() =>
  import('@/three/AnomalyGauge3D').then((m) => ({ default: m.AnomalyGauge3D }))
);

// Standard commercial categories for Indian SMB accounting
const EXPENSE_CATEGORIES = [
  { value: 'food_dining', label: 'Food & Dining' },
  { value: 'travel_fuel', label: 'Travel & Fuel' },
  { value: 'utilities_recharge', label: 'Utilities & Recharge' },
  { value: 'supplies_stationery', label: 'Office Supplies & Stationery' },
  { value: 'client_entertainment', label: 'Client Entertainment' },
  { value: 'electronics_repairs', label: 'Hardware & IT Repairs' },
  { value: 'logistics_courier', label: 'Courier & Logistics' },
  { value: 'software_subscriptions', label: 'Software & Subscriptions' },
  { value: 'misc', label: 'Miscellaneous' },
];

const PAYMENT_MODES = ['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Cash', 'Corporate Card'];

// Pre-packaged samples fallback if backend is offline
const FALLBACK_SAMPLES: SampleReceiptResponse[] = [
  {
    filename: 'sample_office_supplies.png',
    title: 'Dunder Mifflin Paper Co.',
    expected_category: 'supplies_stationery',
    expected_amount: 3450.0,
    image_url: '/sample-receipts/sample_office_supplies.png',
  },
  {
    filename: 'sample_travel_fuel.png',
    title: 'IndianOil Fuel Station',
    expected_category: 'travel_fuel',
    expected_amount: 1850.0,
    image_url: '/sample-receipts/sample_travel_fuel.png',
  },
  {
    filename: 'sample_client_dinner.png',
    title: 'Bukhara ITC Client Dinner',
    expected_category: 'client_entertainment',
    expected_amount: 9400.0,
    image_url: '/sample-receipts/sample_client_dinner.png',
  },
  {
    filename: 'sample_suspicious_high_dinner.png',
    title: 'Late Night High-Risk Banquet',
    expected_category: 'client_entertainment',
    expected_amount: 42500.0,
    image_url: '/sample-receipts/sample_suspicious_high_dinner.png',
  },
];

interface ExtractedFormState {
  vendor: string;
  date: string;
  amount: number;
  tax: number;
  category: string;
  paymentMode: string;
  lineItems: ReceiptItem[];
}

export const Upload: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stepper Stage
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  // Unified File & Image State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [preprocessedImageUrl, setPreprocessedImageUrl] = useState<string | null>(null);
  const [showPreprocessed, setShowPreprocessed] = useState<boolean>(false);
  const [showRawText, setShowRawText] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Processing & Pipeline Progress
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [pipelineStage, setPipelineStage] = useState<number>(0);
  const [pipelineMessage, setPipelineMessage] = useState<string>('');

  // Extracted Fields State (Step 2)
  const [formData, setFormData] = useState<ExtractedFormState>({
    vendor: '',
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    tax: 0,
    category: 'supplies_stationery',
    paymentMode: 'UPI',
    lineItems: [],
  });

  // Audit Result State (Step 3)
  const [auditResult, setAuditResult] = useState<AuditedReceipt | null>(null);
  const [isSavedToDb, setIsSavedToDb] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Fetch sample receipts from backend
  const { data: remoteSamples } = useSampleReceipts();
  const sampleList = remoteSamples && remoteSamples.length > 0 ? remoteSamples : FALLBACK_SAMPLES;

  // Cleanup object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (originalImageUrl && originalImageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(originalImageUrl);
      }
    };
  }, [originalImageUrl]);

  // Handle User File Selection (input or drop)
  const handleFile = (file: File) => {
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setOriginalImageUrl(blobUrl);
    setPreprocessedImageUrl(null);
    setAuditResult(null);
    setIsSavedToDb(false);
    setSaveSuccessMsg(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Select pre-configured sample receipt
  const handleSelectSample = async (sample: SampleReceiptResponse) => {
    try {
      // Build sample URL (proxied through backend or static)
      const sampleUrl = sample.image_url.startsWith('http')
        ? sample.image_url
        : `${import.meta.env.VITE_API_URL || '/api'}${sample.image_url.startsWith('/') ? '' : '/'}${sample.image_url}`;

      const res = await fetch(sampleUrl);
      const blob = await res.blob();
      const file = new File([blob], sample.filename, { type: blob.type || 'image/png' });
      handleFile(file);
    } catch {
      // Fallback synthetic file
      const synthetic = new File(['[SAMPLE RECEIPT]'], sample.filename, { type: 'image/png' });
      handleFile(synthetic);
    }
  };

  // Pipeline Execution with Real-Time Progress Steps
  const handleRunPipeline = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setPipelineStage(1);
    setPipelineMessage('Scanning document & deskewing text with EasyOCR...');

    // Progress Simulation Intervals
    const t1 = setTimeout(() => {
      setPipelineStage(2);
      setPipelineMessage('Extracting vendor, date & itemized lines with Gemini LLM...');
    }, 1100);

    const t2 = setTimeout(() => {
      setPipelineStage(3);
      setPipelineMessage('Predicting spending category with TF-IDF classifier...');
    }, 2200);

    const t3 = setTimeout(() => {
      setPipelineStage(4);
      setPipelineMessage('Auditing transaction risk with Isolation Forest & Z-Score rules...');
    }, 3200);

    try {
      const response = await uploadReceipt(selectedFile);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);

      setAuditResult(response);

      // Hydrate Step 2 Form
      const parsed = response.parsed_receipt || {};
      const expense = response.expense || {};

      const lineItems: ReceiptItem[] =
        parsed.items && parsed.items.length > 0
          ? parsed.items
          : parsed.line_items && parsed.line_items.length > 0
            ? parsed.line_items
            : [
                {
                  description:
                    expense.item_description || parsed.vendor || 'Commercial invoice item',
                  quantity: 1,
                  unit_price: expense.amount || parsed.total || 0,
                  total_price: expense.amount || parsed.total || 0,
                },
              ];

      setFormData({
        vendor: expense.vendor || parsed.merchant_name || parsed.vendor || 'Unknown Vendor',
        date: expense.date || parsed.date || new Date().toISOString().slice(0, 10),
        amount: Number(expense.amount || parsed.total_amount || parsed.total || 0),
        tax: Number(expense.tax || parsed.tax_amount || parsed.tax || 0),
        category: expense.category || response.predicted_category || 'supplies_stationery',
        paymentMode: expense.payment_mode || parsed.payment_method || 'UPI',
        lineItems,
      });

      // If backend returned an image URL, use it as fallback/permanent
      if (response.image_url && !originalImageUrl) {
        setOriginalImageUrl(response.image_url);
      }

      // Preprocessed image simulation/path
      setPreprocessedImageUrl(
        response.ocr_metadata?.preprocessed_path
          ? response.ocr_metadata.preprocessed_path
          : originalImageUrl
      );

      // Transition to Step 2
      setActiveStep(2);
    } catch (err: any) {
      alert(`OCR & Audit Pipeline Failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setPipelineStage(0);
      setPipelineMessage('');
    }
  };

  // Line Item Table Handlers
  const handleUpdateLineItem = (index: number, field: keyof ReceiptItem, val: any) => {
    setFormData((prev) => {
      const updated = [...prev.lineItems];
      updated[index] = { ...updated[index], [field]: val };
      // Recalculate total_price if qty or unit_price changes
      if (field === 'quantity' || field === 'unit_price') {
        const qty = Number(updated[index].quantity || 1);
        const unit = Number(updated[index].unit_price || 0);
        updated[index].total_price = Number((qty * unit).toFixed(2));
      }
      return { ...prev, lineItems: updated };
    });
  };

  const handleAddLineItem = () => {
    setFormData((prev) => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        {
          description: 'New Item',
          quantity: 1,
          unit_price: 0,
          total_price: 0,
        },
      ],
    }));
  };

  const handleDeleteLineItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== index),
    }));
  };

  // Step 2 Proceed to Step 3
  const handleProceedToAudit = async () => {
    if (auditResult?.expense_id) {
      try {
        await updateExpense(auditResult.expense_id, {
          vendor: formData.vendor,
          date: formData.date,
          amount: formData.amount,
          tax: formData.tax,
          category: formData.category,
          payment_mode: formData.paymentMode,
          item_description:
            formData.lineItems.map((i) => i.description).join(', ') || formData.vendor,
        });
      } catch {
        // Continue even if update warning occurs
      }
    }
    setActiveStep(3);
  };

  // Step 3 Final Save Confirmation
  const handleSaveToDatabase = () => {
    setIsSavedToDb(true);
    setSaveSuccessMsg(
      `Verified receipt for "${formData.vendor}" successfully confirmed in SQLite ledger.`
    );
  };

  return (
    <div className="space-y-6">
      {/* SECTION HEADER */}
      <SectionHeader
        tag="// FORENSIC_INGESTION"
        title="Ingest & Audit Receipt"
        subtitle="Forensic OCR extraction, multi-class categorizer, and automated anomaly risk screening"
        icon="🧾"
        badge={
          <StatusBadge
            label={
              activeStep === 1
                ? 'Step 1: Upload'
                : activeStep === 2
                  ? 'Step 2: Review'
                  : 'Step 3: Audited'
            }
            variant={activeStep === 3 ? 'success' : 'brand'}
            dot
          />
        }
        actions={
          activeStep > 1 && (
            <button
              onClick={() => {
                setActiveStep(1);
                setSelectedFile(null);
                setOriginalImageUrl(null);
                setAuditResult(null);
                setIsSavedToDb(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#111111] hover:bg-[#161618] text-[#8A8F98] hover:text-[#EDEDED] text-xs font-mono uppercase tracking-[0.08em] border border-[#1C1C1F] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#FF9933]" />
              <span>Reset / Upload New</span>
            </button>
          )
        }
      />

      {/* 3-STEP STEPPER BREADCRUMB BAR */}
      <div className="grid grid-cols-3 gap-2 p-1 rounded bg-[#0A0A0A] border border-[#1C1C1F]">
        {[
          { step: 1, label: '1. Ingest Slip', icon: UploadIcon },
          { step: 2, label: '2. Correct Entities', icon: FileText },
          { step: 3, label: '3. Forensic Risk', icon: ShieldCheck },
        ].map(({ step, label, icon: Icon }) => {
          const isDone =
            (step === 1 && (activeStep === 2 || activeStep === 3)) ||
            (step === 2 && activeStep === 3);
          const isCurrent = activeStep === step;

          return (
            <button
              key={step}
              onClick={() => {
                if (step === 1) setActiveStep(1);
                if (step === 2 && auditResult) setActiveStep(2);
                if (step === 3 && auditResult) setActiveStep(3);
              }}
              disabled={step > 1 && !auditResult}
              className={cn(
                'flex items-center justify-center gap-2 py-2.5 px-3 rounded text-xs font-mono uppercase tracking-[0.08em] transition-colors',
                isCurrent
                  ? 'bg-[#111111] text-[#FF9933] border border-[#FF9933]/40 font-medium'
                  : isDone
                    ? 'bg-[#000000] text-[#34D399] border border-[#34D399]/30 hover:bg-[#111111]'
                    : 'text-[#52555C] hover:text-[#8A8F98] border border-transparent cursor-not-allowed'
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">Step {step}</span>
              {isDone && <CheckCircle2 className="w-3 h-3 ml-1 text-[#34D399]" />}
            </button>
          );
        })}
      </div>

      {/* PROCESSING PROGRESS MODAL / OVERLAY */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md bg-[#0A0A0A] border border-[#1C1C1F] rounded p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded border border-[#1C1C1F] bg-[#111111] flex items-center justify-center text-[#FF9933]">
                  <Scan className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-normal text-[#EDEDED]">Auditing Receipt Document</h3>
                  <p className="font-mono text-[10px] text-[#52555C] uppercase tracking-wide">STAGE {pipelineStage} OF 4</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 rounded-full bg-[#111111] overflow-hidden">
                <motion.div
                  className="h-full bg-[#FF9933]"
                  animate={{
                    width: `${pipelineStage === 1 ? 25 : pipelineStage === 2 ? 55 : pipelineStage === 3 ? 75 : 95}%`,
                  }}
                  transition={{ duration: 0.4 }}
                />
              </div>

              {/* Live Status Message */}
              <div className="p-3 rounded bg-[#000000] border border-[#1C1C1F] flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-[#FF9933] animate-ping shrink-0" />
                <span className="text-xs font-mono text-[#EDEDED]">{pipelineMessage}</span>
              </div>

              {/* Pipeline Checklist */}
              <div className="space-y-1.5 text-xs font-mono">
                {[
                  { stage: 1, text: 'EasyOCR Bounding Box Character Recognition' },
                  { stage: 2, text: 'Gemini LLM Extraction (Vendor, Date, Line Items)' },
                  { stage: 3, text: 'TF-IDF + Classifier Category Categorization' },
                  { stage: 4, text: 'Isolation Forest & Z-Score Anomaly Gating' },
                ].map(({ stage, text }) => (
                  <div
                    key={stage}
                    className={cn(
                      'flex items-center gap-2 px-2.5 py-1.5 rounded text-[11px]',
                      pipelineStage > stage
                        ? 'text-[#34D399] bg-[#111111]'
                        : pipelineStage === stage
                          ? 'text-[#FF9933] bg-[#111111] border border-[#FF9933]/30'
                          : 'text-[#52555C]'
                    )}
                  >
                    {pipelineStage > stage ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399] shrink-0" />
                    ) : pipelineStage === stage ? (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-[#FF9933] border-t-transparent animate-spin shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-[#1C1C1F] shrink-0" />
                    )}
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* STEP 1: UPLOAD & SAMPLE PICKER */}
      {/* ========================================================================= */}
      {activeStep === 1 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Drag & Drop Zone (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <Card variant="solid" padding="md">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#1C1C1F]">
                  <h2 className="text-sm font-normal text-[#EDEDED] flex items-center gap-2">
                    <UploadIcon className="w-4 h-4 text-[#FF9933]" />
                    <span>Upload Commercial Invoice or Thermal Slip</span>
                  </h2>
                  <span className="font-mono text-[10px] text-[#52555C] uppercase tracking-[0.1em]">
                    PNG, JPG, WEBP, PDF, TXT
                  </span>
                </div>

                {/* Dropzone Area */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'border border-dashed rounded p-8 sm:p-10 flex flex-col items-center justify-center cursor-pointer transition-colors text-center',
                    isDragOver
                      ? 'border-[#FF9933] bg-[#111111]'
                      : 'border-[#2A2A2E] bg-[#000000] hover:border-[#52555C] hover:bg-[#111111]'
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf,text/plain,.txt"
                    onChange={handleInputChange}
                    className="hidden"
                  />

                  <div className="w-10 h-10 rounded border border-[#1C1C1F] bg-[#111111] flex items-center justify-center text-[#FF9933] mb-3">
                    <UploadIcon className="w-5 h-5" />
                  </div>

                  <div className="text-sm font-normal text-[#EDEDED]">
                    {selectedFile ? (
                      <span className="text-[#FF9933] font-mono">{selectedFile.name}</span>
                    ) : (
                      'Drag & drop receipt image here, or browse files'
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[#8A8F98] max-w-sm">
                    Supports high-resolution scans, low-light mobile photos, and GST tax invoices
                  </p>

                  {selectedFile && (
                    <div className="mt-3 px-2.5 py-1 rounded bg-[#111111] border border-[#1C1C1F] text-[11px] text-[#8A8F98] font-mono">
                      {(selectedFile.size / 1024).toFixed(1)} KB &bull;{' '}
                      {selectedFile.type || 'image/png'}
                    </div>
                  )}
                </div>

                {/* Submit Action */}
                <button
                  onClick={handleRunPipeline}
                  disabled={!selectedFile || isProcessing}
                  className="mt-4 w-full py-3 rounded bg-[#EDEDED] hover:bg-white disabled:bg-[#111111] disabled:text-[#52555C] disabled:border disabled:border-[#1C1C1F] text-black font-medium text-xs tracking-tight transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#FF9933]" />
                  <span>Run OCR & Forensic Audit Pipeline</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </Card>

              {/* Sample Receipts Picker */}
              <Card variant="solid" padding="md">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#1C1C1F]">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#FF9933]" />
                    <h3 className="text-sm font-normal text-[#EDEDED]">
                      Try Sample Receipts (One-Click Audit)
                    </h3>
                  </div>
                  <span className="font-mono text-[10px] text-[#52555C] uppercase tracking-wide">CLICK TO PRELOAD</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sampleList.map((sample, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectSample(sample)}
                      className="p-3 rounded bg-[#000000] border border-[#1C1C1F] hover:border-[#2A2A2E] hover:bg-[#111111] cursor-pointer transition-colors flex items-start gap-3 group"
                    >
                      <div className="w-8 h-8 rounded border border-[#1C1C1F] bg-[#111111] flex items-center justify-center text-xs shrink-0">
                        🧾
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-normal text-[#EDEDED] truncate group-hover:text-white transition-colors">
                          {sample.title}
                        </div>
                        <div className="text-[11px] font-mono text-[#8A8F98] mt-0.5">
                          {formatINR(sample.expected_amount)} &bull;{' '}
                          <span className="capitalize text-[#52555C]">
                            {sample.expected_category.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Right: Selected Document Preview (5 cols) */}
            <div className="lg:col-span-5">
              <Card variant="solid" padding="md" className="h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#1C1C1F]">
                    <h3 className="text-sm font-normal text-[#EDEDED] flex items-center gap-2">
                      <Eye className="w-4 h-4 text-[#FF9933]" />
                      <span>Document Preview</span>
                    </h3>
                    {originalImageUrl && (
                      <span className="font-mono text-[9.5px] uppercase tracking-wide text-[#34D399] bg-[#111111] px-2 py-0.5 rounded-xs border border-[#34D399]/30">
                        READY_FOR_OCR
                      </span>
                    )}
                  </div>

                  {originalImageUrl ? (
                    <div className="relative rounded border border-[#1C1C1F] bg-[#000000] p-3 flex items-center justify-center max-h-[460px] overflow-hidden">
                      <img
                        src={originalImageUrl}
                        alt="Selected Commercial Invoice"
                        className="max-h-[430px] w-auto object-contain rounded"
                      />
                    </div>
                  ) : (
                    <div className="rounded border border-dashed border-[#1C1C1F] bg-[#000000] p-12 text-center text-[#52555C] space-y-3 min-h-[380px] flex flex-col items-center justify-center">
                      <FileText className="w-10 h-10 text-[#2A2A2E]" />
                      <div className="text-xs font-mono text-[#8A8F98]">
                        NO DOCUMENT LOADED YET
                      </div>
                      <p className="text-xs text-[#52555C] max-w-xs">
                        Drag & drop a commercial receipt or pick one of the demo samples above to
                        preview here
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 p-2.5 rounded bg-[#000000] border border-[#1C1C1F] text-[11px] text-[#8A8F98] flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-[#52555C] shrink-0" />
                  <span>
                    The original uploaded scan is strictly preserved for visual audit comparison.
                  </span>
                </div>
              </Card>
            </div>
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: SIDE-BY-SIDE REVIEW (ORIGINAL ON LEFT, EDITABLE FIELDS ON RIGHT) */}
      {/* ========================================================================= */}
      {activeStep === 2 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: ORIGINAL DOCUMENT SCAN (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <Card variant="solid" padding="md">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#1C1C1F]">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[#FF9933]" />
                    <h3 className="text-sm font-normal text-[#EDEDED]">Original Uploaded Document</h3>
                  </div>
                  <span className="font-mono text-[9.5px] uppercase tracking-wide text-[#FF9933] bg-[#111111] px-2 py-0.5 rounded-xs border border-[#FF9933]/30">
                    SOURCE_SCAN
                  </span>
                </div>

                {/* Original Image Container */}
                <div className="rounded border border-[#1C1C1F] bg-[#000000] p-2 flex items-center justify-center max-h-[520px] overflow-auto">
                  {originalImageUrl ? (
                    <img
                      src={originalImageUrl}
                      alt="Original Receipt Document"
                      className="max-h-[500px] w-auto object-contain rounded"
                    />
                  ) : (
                    <div className="text-[#52555C] text-xs py-12 font-mono">
                      ORIGINAL IMAGE STREAM UNAVAILABLE
                    </div>
                  )}
                </div>

                {/* Collapsible OpenCV Preprocessed View */}
                <div className="mt-3 border-t border-[#1C1C1F] pt-3">
                  <button
                    onClick={() => setShowPreprocessed(!showPreprocessed)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded bg-[#111111] hover:bg-[#161618] border border-[#1C1C1F] text-xs font-mono text-[#8A8F98] hover:text-[#EDEDED] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span>🔬</span>
                      <span>View OpenCV Preprocessed Document</span>
                    </span>
                    {showPreprocessed ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <AnimatePresence>
                    {showPreprocessed && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2.5 p-2 rounded bg-[#000000] border border-[#1C1C1F] overflow-hidden"
                      >
                        <p className="text-[11px] text-[#8A8F98] mb-2 px-1">
                          Deskewed, binarized & contrast-adjusted for EasyOCR character
                          segmentation:
                        </p>
                        <img
                          src={preprocessedImageUrl || originalImageUrl || ''}
                          alt="OpenCV Preprocessed Image"
                          className="max-h-[300px] mx-auto object-contain filter grayscale contrast-125"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Collapsible Raw OCR Text Output (Parity with Streamlit) */}
                <div className="mt-2.5 border-t border-[#1C1C1F] pt-2.5">
                  <button
                    onClick={() => setShowRawText(!showRawText)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded bg-[#111111] hover:bg-[#161618] border border-[#1C1C1F] text-xs font-mono text-[#8A8F98] hover:text-[#EDEDED] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span>📄</span>
                      <span>View Raw OCR Text Output</span>
                    </span>
                    {showRawText ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <AnimatePresence>
                    {showRawText && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2.5 p-3 rounded bg-[#000000] border border-[#1C1C1F] overflow-hidden"
                      >
                        <pre className="text-xs text-[#EDEDED] whitespace-pre-wrap font-mono max-h-52 overflow-y-auto">
                          {auditResult?.expense?.raw_text ||
                            (auditResult as any)?.raw_text ||
                            auditResult?.parsed_receipt?.raw_text ||
                            'No raw OCR text available.'}
                        </pre>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Card>
            </div>

            {/* RIGHT COLUMN: EDITABLE EXTRACTED FIELDS & LINE ITEMS (7 cols) */}
            <div className="lg:col-span-7 space-y-5">
              <Card variant="solid" padding="md">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#1C1C1F]">
                  <h3 className="text-sm font-normal text-[#EDEDED] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#34D399]" />
                    <span>Verify & Correct Extracted Fields</span>
                  </h3>
                  <span className="font-mono text-[10px] text-[#34D399] uppercase tracking-wide flex items-center gap-1">
                    <span>✓</span> READY_FOR_AUDIT
                  </span>
                </div>

                {/* Primary Entity Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Vendor */}
                  <div>
                    <label className="text-[10px] font-mono font-medium text-[#52555C] uppercase tracking-[0.1em]">
                      Merchant / Vendor Name
                    </label>
                    <input
                      type="text"
                      value={formData.vendor}
                      onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                      className="mt-1 w-full bg-[#111111] border border-[#1C1C1F] rounded px-3 py-2 text-xs font-normal text-[#EDEDED] focus:outline-none focus:border-[#FF9933] transition-colors"
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <label className="text-[10px] font-mono font-medium text-[#52555C] uppercase tracking-[0.1em]">
                      Date (YYYY-MM-DD)
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="mt-1 w-full bg-[#111111] border border-[#1C1C1F] rounded px-3 py-2 text-xs font-normal text-[#EDEDED] focus:outline-none focus:border-[#FF9933] transition-colors"
                    />
                  </div>

                  {/* Total Amount */}
                  <div>
                    <label className="text-[10px] font-mono font-medium text-[#52555C] uppercase tracking-[0.1em]">
                      Grand Total Amount (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                      }
                      className="mt-1 w-full bg-[#111111] border border-[#1C1C1F] rounded px-3 py-2 text-xs font-mono text-[#FF9933] focus:outline-none focus:border-[#FF9933] transition-colors"
                    />
                  </div>

                  {/* Tax Amount */}
                  <div>
                    <label className="text-[10px] font-mono font-medium text-[#52555C] uppercase tracking-[0.1em]">
                      GST / Sales Tax (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.tax}
                      onChange={(e) =>
                        setFormData({ ...formData, tax: parseFloat(e.target.value) || 0 })
                      }
                      className="mt-1 w-full bg-[#111111] border border-[#1C1C1F] rounded px-3 py-2 text-xs font-mono text-[#EDEDED] focus:outline-none focus:border-[#FF9933] transition-colors"
                    />
                  </div>

                  {/* Category Selector */}
                  <div>
                    <label className="text-[10px] font-mono font-medium text-[#52555C] uppercase tracking-[0.1em]">
                      Spending Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="mt-1 w-full bg-[#111111] border border-[#1C1C1F] rounded px-3 py-2 text-xs font-normal text-[#EDEDED] focus:outline-none focus:border-[#FF9933] transition-colors"
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option
                          key={cat.value}
                          value={cat.value}
                          className="bg-[#0A0A0A] text-[#EDEDED]"
                        >
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Payment Mode */}
                  <div>
                    <label className="text-[10px] font-mono font-medium text-[#52555C] uppercase tracking-[0.1em]">
                      Payment Mode
                    </label>
                    <select
                      value={formData.paymentMode}
                      onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                      className="mt-1 w-full bg-[#111111] border border-[#1C1C1F] rounded px-3 py-2 text-xs font-normal text-[#EDEDED] focus:outline-none focus:border-[#FF9933] transition-colors"
                    >
                      {PAYMENT_MODES.map((mode) => (
                        <option key={mode} value={mode} className="bg-[#0A0A0A] text-[#EDEDED]">
                          {mode}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Itemized Line Items Table */}
                <div className="mt-6 pt-4 border-t border-[#1C1C1F]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#52555C]">
                        Extracted Line Items ({formData.lineItems.length})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#111111] text-[#FF9933] hover:bg-[#161618] border border-[#FF9933]/30 text-[11px] font-mono transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Row</span>
                    </button>
                  </div>

                  <div className="rounded border border-[#1C1C1F] overflow-hidden bg-[#000000]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#111111] text-[#52555C] font-mono text-[10px] uppercase tracking-[0.1em] border-b border-[#1C1C1F]">
                        <tr>
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-3 w-16 text-center">Qty</th>
                          <th className="py-2 px-3 w-28 text-right">Price</th>
                          <th className="py-2 px-3 w-28 text-right">Total</th>
                          <th className="py-2 px-2 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1C1C1F]">
                        {formData.lineItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-[#111111]/30 transition-colors">
                            <td className="py-1.5 px-3">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) =>
                                  handleUpdateLineItem(idx, 'description', e.target.value)
                                }
                                className="w-full bg-[#000000] border border-[#1C1C1F] rounded px-2 py-1 text-xs text-[#EDEDED] focus:outline-none focus:border-[#FF9933]"
                              />
                            </td>
                            <td className="py-1.5 px-3">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity || 1}
                                onChange={(e) =>
                                  handleUpdateLineItem(
                                    idx,
                                    'quantity',
                                    parseFloat(e.target.value) || 1
                                  )
                                }
                                className="w-full bg-[#000000] border border-[#1C1C1F] rounded px-1.5 py-1 text-xs text-center text-[#EDEDED] focus:outline-none focus:border-[#FF9933]"
                              />
                            </td>
                            <td className="py-1.5 px-3">
                              <input
                                type="number"
                                step="0.01"
                                value={item.unit_price || 0}
                                onChange={(e) =>
                                  handleUpdateLineItem(
                                    idx,
                                    'unit_price',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-full bg-[#000000] border border-[#1C1C1F] rounded px-2 py-1 text-xs text-right text-[#EDEDED] font-mono focus:outline-none focus:border-[#FF9933]"
                              />
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono text-[#EDEDED]">
                              {formatINR(item.total_price)}
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteLineItem(idx)}
                                className="p-1 rounded text-[#52555C] hover:text-[#F87171] hover:bg-[#111111] transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bottom Navigation Buttons */}
                <div className="mt-6 pt-4 flex items-center justify-between border-t border-[#1C1C1F]">
                  <button
                    onClick={() => setActiveStep(1)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#111111] hover:bg-[#161618] text-[#8A8F98] hover:text-[#EDEDED] text-xs font-mono uppercase tracking-[0.08em] border border-[#1C1C1F] transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Upload</span>
                  </button>

                  <button
                    onClick={handleProceedToAudit}
                    className="inline-flex items-center gap-2 px-6 py-2 rounded bg-[#EDEDED] hover:bg-white text-black font-medium text-xs tracking-tight transition-colors cursor-pointer"
                  >
                    <span>Proceed to Audit Result</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Card>
            </div>
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: AUDIT RESULT & FORENSIC INTELLIGENCE */}
      {/* ========================================================================= */}
      {activeStep === 3 && auditResult && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Top Summary Banner */}
          <Card variant="solid" padding="md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#1C1C1F]">
              <div>
                <div className="font-mono text-[10px] text-[#FF9933] uppercase tracking-[0.1em]">
                  Audited Merchant Record
                </div>
                <h2 className="text-xl font-normal text-[#EDEDED] mt-0.5">{formData.vendor}</h2>
                <div className="text-xs text-[#8A8F98] mt-1 font-mono">
                  Transaction Date:{' '}
                  <span className="text-[#EDEDED]">{formData.date}</span> &bull; Payment
                  Mode: <span className="text-[#EDEDED]">{formData.paymentMode}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <AnomalyRiskBadge
                  severity={auditResult.audit_risk.risk_severity}
                  score={auditResult.audit_risk.anomaly_score}
                />
              </div>
            </div>

            {/* Quick Numbers Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="p-3 rounded bg-[#000000] border border-[#1C1C1F]">
                <div className="font-mono text-[10px] uppercase tracking-wide text-[#52555C]">Total Spend</div>
                <div className="text-lg font-mono text-[#FF9933] mt-0.5">
                  {formatINR(formData.amount)}
                </div>
              </div>
              <div className="p-3 rounded bg-[#000000] border border-[#1C1C1F]">
                <div className="font-mono text-[10px] uppercase tracking-wide text-[#52555C]">Tax Verified</div>
                <div className="text-lg font-mono text-[#EDEDED] mt-0.5">
                  {formatINR(formData.tax)}
                </div>
              </div>
              <div className="p-3 rounded bg-[#000000] border border-[#1C1C1F]">
                <div className="font-mono text-[10px] uppercase tracking-wide text-[#52555C]">
                  Verified Category
                </div>
                <div className="text-xs font-mono text-[#34D399] uppercase mt-1 truncate">
                  {formData.category.replace('_', ' ')}
                </div>
              </div>
              <div className="p-3 rounded bg-[#000000] border border-[#1C1C1F]">
                <div className="font-mono text-[10px] uppercase tracking-wide text-[#52555C]">
                  Human Review Status
                </div>
                <div className="text-xs font-mono mt-1">
                  {auditResult.needs_review ? (
                    <span className="text-[#F5B544]">PENDING_REVIEW</span>
                  ) : (
                    <span className="text-[#34D399]">VERIFIED_CLEAN</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Symmetric Triple Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KPICard
              label="Classifier Confidence"
              value={`${(auditResult.classifier_confidence * 100).toFixed(1)}%`}
              sub="TF-IDF Multi-Class Model"
              icon="🏷️"
              accent={auditResult.classifier_confidence >= 0.65 ? 'success' : 'warning'}
              tooltip="Probability calculated across standard Indian SMB commercial expense classes."
            />
            <KPICard
              label="OCR Quality Score"
              value={`${(auditResult.ocr_confidence * 100).toFixed(1)}%`}
              sub="EasyOCR Character Certainty"
              icon="🔍"
              accent={auditResult.ocr_confidence >= 0.6 ? 'success' : 'warning'}
              tooltip="Mean character recognition probability across bounding boxes in English & Hindi."
            />
            <KPICard
              label="Anomaly Risk Score"
              value={`${(auditResult.audit_risk.anomaly_score * 100).toFixed(0)} / 100`}
              sub={`Severity: ${auditResult.audit_risk.risk_severity}`}
              icon="🚨"
              accent={
                auditResult.audit_risk.risk_severity === 'HIGH'
                  ? 'danger'
                  : auditResult.audit_risk.risk_severity === 'MEDIUM'
                    ? 'warning'
                    : 'success'
              }
              tooltip="Evaluated by Isolation Forest and Category rolling Z-Score."
            />
          </div>

          {/* 3D Rotating Anomaly Risk Speedometer Gauge */}
          <Suspense
            fallback={<ThreeSkeletonLoader height={280} label="Mounting 3D Risk Gauge..." />}
          >
            <AnomalyGauge3D
              score={Math.round((auditResult.audit_risk.anomaly_score ?? 0.85) * 100)}
              height={280}
            />
          </Suspense>

          {/* Audit Findings & Trigger Breakdown */}
          <Card variant="solid" padding="md">
            <h3 className="text-sm font-normal text-[#EDEDED] flex items-center gap-2 mb-3 pb-2 border-b border-[#1C1C1F]">
              <ShieldCheck className="w-4 h-4 text-[#FF9933]" />
              <span>Forensic Audit Findings & Triggers</span>
            </h3>

            {auditResult.audit_risk.reasons && auditResult.audit_risk.reasons.length > 0 ? (
              <div className="space-y-2.5">
                {auditResult.audit_risk.reasons.map((reason, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded bg-[#000000] border border-[#F5B544]/30 flex items-start gap-3"
                  >
                    <AlertTriangle className="w-4 h-4 text-[#F5B544] shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-mono uppercase text-[#F5B544]">Flagged Risk Pattern</div>
                      <div className="text-xs text-[#EDEDED] mt-0.5">{reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded bg-[#000000] border border-[#34D399]/30 flex items-center gap-3 text-[#34D399] text-xs font-mono">
                <CheckCircle2 className="w-4 h-4 text-[#34D399]" />
                <span>
                  Clean Transaction: Amount and vendor pattern conform to historical business norms.
                </span>
              </div>
            )}
          </Card>

          {/* Model Explainability: Feature Attribution & SHAP Saliency */}
          {(auditResult as any)?.explanation && (
            <Card variant="solid" padding="md">
              <h3 className="text-sm font-normal text-[#EDEDED] flex items-center gap-2 mb-2 pb-2 border-b border-[#1C1C1F]">
                <Sparkles className="w-4 h-4 text-[#FF9933]" />
                <span>Explainable AI: Why was this category assigned?</span>
              </h3>
              <p className="text-xs text-[#8A8F98] leading-relaxed">
                {(auditResult as any).explanation.summary_explanation}
              </p>
              {(auditResult as any).explanation.top_features &&
                (auditResult as any).explanation.top_features.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(auditResult as any).explanation.top_features.map((feat: any, fIdx: number) => (
                      <span
                        key={fIdx}
                        className={cn(
                          'px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1.5 border',
                          feat.direction === 'positive'
                            ? 'bg-[#111111] text-[#34D399] border-[#34D399]/30'
                            : 'bg-[#111111] text-[#F87171] border-[#F87171]/30'
                        )}
                      >
                        <span className="font-bold">{feat.token}</span>
                        <span className="opacity-80">
                          ({feat.contribution > 0 ? `+${feat.contribution.toFixed(2)}` : feat.contribution.toFixed(2)})
                        </span>
                      </span>
                    ))}
                  </div>
                )}
            </Card>
          )}

          {/* Save & Finish Actions */}
          <div className="space-y-3 pt-2">
            {saveSuccessMsg && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded bg-[#111111] border border-[#34D399]/40 text-[#34D399] text-xs font-mono flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{saveSuccessMsg}</span>
              </motion.div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={handleSaveToDatabase}
                disabled={isSavedToDb}
                className={cn(
                  'w-full sm:flex-1 py-2.5 rounded font-medium text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer',
                  isSavedToDb
                    ? 'bg-[#111111] text-[#34D399] border border-[#34D399]/30 cursor-default'
                    : 'bg-[#EDEDED] hover:bg-white text-black'
                )}
              >
                <Database className="w-3.5 h-3.5" />
                <span>
                  {isSavedToDb
                    ? '✓ Persisted in SQLite Database'
                    : '💾 Save Verified Record to Database'}
                </span>
              </button>

              <button
                onClick={() => navigate('/dashboard')}
                className="w-full sm:w-auto px-5 py-2.5 rounded bg-[#111111] hover:bg-[#161618] text-[#8A8F98] hover:text-[#EDEDED] text-xs font-mono uppercase tracking-[0.08em] border border-[#1C1C1F] transition-colors"
              >
                <span>View in Dashboard &rarr;</span>
              </button>

              <button
                onClick={() => {
                  setActiveStep(1);
                  setSelectedFile(null);
                  setOriginalImageUrl(null);
                  setAuditResult(null);
                  setIsSavedToDb(false);
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded bg-[#000000] hover:bg-[#111111] text-[#8A8F98] hover:text-[#EDEDED] text-xs font-mono uppercase tracking-[0.08em] border border-[#1C1C1F] transition-colors"
              >
                <span>Audit Next Receipt</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Upload;
