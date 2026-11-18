import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Upload } from '../Upload';
import * as apiClient from '@/api/client';

// Mock Three.js 3D lazy components to keep unit tests fast and deterministic
vi.mock('@/three/AnomalyGauge3D', () => ({
  AnomalyGauge3D: ({ score }: { score: number }) => (
    <div data-testid="mock-anomaly-gauge">3D Gauge Score: {score}</div>
  ),
}));

const mockAuditResponse: any = {
  status: 'success',
  expense_id: 'test-exp-001',
  predicted_category: 'supplies_stationery',
  classifier_confidence: 0.95,
  ocr_confidence: 0.92,
  ocr_metadata: {
    detected_languages: ['en'],
    engine: 'EasyOCR',
    preprocessed_path: '/sample-receipts/sample_office_supplies.png',
  },
  parsed_receipt: {
    merchant_name: 'Dunder Mifflin Paper Co.',
    vendor: 'Dunder Mifflin Paper Co.',
    date: '2026-11-04',
    total: 3450.0,
    total_amount: 3450.0,
    tax: 414.0,
    tax_amount: 414.0,
    category: 'supplies_stationery',
    payment_method: 'UPI',
    items: [
      {
        description: 'A4 Premium Copy Paper 500 Sheets',
        quantity: 5,
        unit_price: 450.0,
        total_price: 2250.0,
      },
      {
        description: 'Gel Pens Assorted Pack',
        quantity: 4,
        unit_price: 300.0,
        total_price: 1200.0,
      },
    ],
  },
  expense: {
    id: 'test-exp-001',
    vendor: 'Dunder Mifflin Paper Co.',
    amount: 3450.0,
    tax: 414.0,
    category: 'supplies_stationery',
    date: '2026-11-04',
    payment_mode: 'UPI',
    item_description: 'A4 Copy Paper, Gel Pens',
    anomaly_flag: 0,
    audit_risk: 'LOW',
  },
  audit_risk: {
    risk_severity: 'LOW',
    anomaly_score: 0.12,
    is_anomaly: false,
    reasons: ['Normal commercial purchase within standard variance'],
    triggers: ['Normal commercial purchase within standard variance'],
    recommended_action: 'Auto-approve for standard reimbursement',
  },
  needs_review: false,
  image_url: '/sample-receipts/sample_office_supplies.png',
};

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/upload']}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Upload Page 3-Step Forensic Workflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Step 1 with dropzone, sample receipts picker, and run button initially disabled', () => {
    renderWithProviders(<Upload />);

    expect(screen.getByText(/Ingest & Audit Receipt/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 1: Upload/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload Commercial Invoice or Thermal Slip/i)).toBeInTheDocument();
    expect(screen.getByText(/Try Sample Receipts/i)).toBeInTheDocument();

    const runBtn = screen.getByRole('button', { name: /Run OCR & Forensic Audit Pipeline/i });
    expect(runBtn).toBeDisabled();
  });

  it('enables pipeline button upon selecting a sample receipt', async () => {
    renderWithProviders(<Upload />);

    // Click sample receipt card
    const sample = screen.getByText('Dunder Mifflin Paper Co.');
    fireEvent.click(sample);

    await waitFor(() => {
      const runBtn = screen.getByRole('button', { name: /Run OCR & Forensic Audit Pipeline/i });
      expect(runBtn).not.toBeDisabled();
    });
  });

  it('progresses to Step 2: Review after running OCR pipeline and displays extracted fields', async () => {
    vi.spyOn(apiClient, 'uploadReceipt').mockResolvedValueOnce(mockAuditResponse);

    renderWithProviders(<Upload />);

    // Select sample receipt
    const sample = screen.getByText('Dunder Mifflin Paper Co.');
    fireEvent.click(sample);

    // Click run button
    const runBtn = screen.getByRole('button', { name: /Run OCR & Forensic Audit Pipeline/i });
    await waitFor(() => expect(runBtn).not.toBeDisabled());
    fireEvent.click(runBtn);

    // Wait for Step 2 to be active
    await waitFor(() => {
      expect(screen.getByText(/Step 2: Review/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Verify & Correct Extracted Fields/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Dunder Mifflin Paper Co.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3450')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A4 Premium Copy Paper 500 Sheets')).toBeInTheDocument();
  });

  it('allows editing fields and adding line items in Step 2, then proceeds to Step 3: Audited', async () => {
    vi.spyOn(apiClient, 'uploadReceipt').mockResolvedValueOnce(mockAuditResponse);
    const updateSpy = vi.spyOn(apiClient, 'updateExpense').mockResolvedValueOnce({
      id: 'test-exp-001',
      vendor: 'Dunder Mifflin Paper Co. Edited',
    } as any);

    renderWithProviders(<Upload />);

    // Select sample & run
    fireEvent.click(screen.getByText('Dunder Mifflin Paper Co.'));
    const runBtn = screen.getByRole('button', { name: /Run OCR & Forensic Audit Pipeline/i });
    await waitFor(() => expect(runBtn).not.toBeDisabled());
    fireEvent.click(runBtn);

    // Wait for Step 2
    await waitFor(() => {
      expect(screen.getByText(/Step 2: Review/i)).toBeInTheDocument();
    });

    // Edit vendor name
    const vendorInput = screen.getByDisplayValue('Dunder Mifflin Paper Co.');
    fireEvent.change(vendorInput, { target: { value: 'Dunder Mifflin Paper Co. Edited' } });
    expect(screen.getByDisplayValue('Dunder Mifflin Paper Co. Edited')).toBeInTheDocument();

    // Click Proceed to Step 3
    const proceedBtn = screen.getByRole('button', { name: /Proceed to Audit Result/i });
    fireEvent.click(proceedBtn);

    // Wait for Step 3
    await waitFor(() => {
      expect(screen.getByText(/Step 3: Audited/i)).toBeInTheDocument();
    });

    expect(updateSpy).toHaveBeenCalledWith(
      'test-exp-001',
      expect.objectContaining({
        vendor: 'Dunder Mifflin Paper Co. Edited',
      })
    );

    // Check Step 3 KPI and findings
    expect(screen.getByText(/Classifier Confidence/i)).toBeInTheDocument();
    expect(screen.getByText(/OCR Quality Score/i)).toBeInTheDocument();
    expect(screen.getByText(/Anomaly Risk Score/i)).toBeInTheDocument();
    expect(screen.getByText(/Forensic Audit Findings & Triggers/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Normal commercial purchase within standard variance/i)
    ).toBeInTheDocument();

    // Confirm save to DB
    const confirmBtn = screen.getByRole('button', { name: /Save Verified Record to Database/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/successfully confirmed in SQLite ledger/i)).toBeInTheDocument();
    });
  });
});
