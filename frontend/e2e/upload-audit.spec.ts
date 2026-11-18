import { test, expect } from '@playwright/test';

test.describe('ReceiptRadar Upload & Forensic Audit Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate directly to /upload
    await page.goto('/upload');
  });

  test('should render upload page with stepper at Step 1', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/Ingest & Audit Receipt/i);
    await expect(page.getByText(/Step 1: Upload/i)).toBeVisible();
    await expect(page.getByText(/Try Sample Receipts/i)).toBeVisible();
  });

  test('should complete 3-step upload and audit flow with sample receipt', async ({ page }) => {
    // 1. Mock the /upload-receipt API call for deterministic E2E verification
    await page.route('**/api/upload-receipt', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          expense_id: 'test-expense-123',
          predicted_category: 'supplies_stationery',
          classifier_confidence: 0.94,
          ocr_confidence: 0.89,
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
            id: 'test-expense-123',
            vendor: 'Dunder Mifflin Paper Co.',
            amount: 3450.0,
            tax: 414.0,
            category: 'supplies_stationery',
            date: '2026-11-04',
            payment_mode: 'UPI',
            item_description: 'A4 Premium Copy Paper, Gel Pens',
            anomaly_flag: 0,
            audit_risk: 'LOW',
          },
          audit_risk: {
            risk_severity: 'LOW',
            anomaly_score: 0.12,
            is_anomaly: false,
            reasons: ['Normal commercial purchase within standard monthly variance'],
            triggers: ['Normal commercial purchase within standard monthly variance'],
            recommended_action: 'Auto-approve for standard reimbursement',
          },
          needs_review: false,
          image_url: '/sample-receipts/sample_office_supplies.png',
        }),
      });
    });

    // Mock update expense in step 2
    await page.route('**/api/expenses/test-expense-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-expense-123',
          vendor: 'Dunder Mifflin Paper Co.',
          amount: 3450.0,
          category: 'supplies_stationery',
        }),
      });
    });

    // 2. Select a demo sample receipt
    const sampleCard = page.locator('text=Dunder Mifflin Paper Co.').first();
    await sampleCard.click();

    // Verify sample file is selected
    await expect(page.getByText('sample_office_supplies.png')).toBeVisible();

    // 3. Click Run OCR & Forensic Audit Pipeline
    const runBtn = page.getByRole('button', { name: /Run OCR & Forensic Audit Pipeline/i });
    await expect(runBtn).toBeEnabled();
    await runBtn.click();

    // 4. Verify transition to Step 2: Review
    await expect(page.getByText(/Step 2: Review/i)).toBeVisible();
    await expect(page.getByText(/Verify & Correct Extracted Fields/i)).toBeVisible();
    await expect(page.getByLabel(/Merchant \/ Vendor Name/i).or(page.locator('input[value="Dunder Mifflin Paper Co."]'))).toBeVisible();

    // Check line items table rendered
    await expect(page.getByText(/A4 Premium Copy Paper/i)).toBeVisible();

    // 5. Proceed to Step 3: Audited
    const proceedBtn = page.getByRole('button', { name: /Proceed to Audit Result/i });
    await expect(proceedBtn).toBeVisible();
    await proceedBtn.click();

    // 6. Verify Step 3: Audited Result & Findings
    await expect(page.getByText(/Step 3: Audited/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dunder Mifflin Paper Co.' })).toBeVisible();
    await expect(page.getByText(/Classifier Confidence/i)).toBeVisible();
    await expect(page.getByText(/OCR Quality Score/i)).toBeVisible();
    await expect(page.getByText(/Anomaly Risk Score/i)).toBeVisible();
    await expect(page.getByText(/Forensic Audit Findings & Triggers/i)).toBeVisible();
    await expect(page.getByText(/Normal commercial purchase within standard monthly variance/i)).toBeVisible();

    // 7. Click confirm save to database
    const saveBtn = page.getByRole('button', { name: /Save Verified Record to Database/i });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    await expect(page.getByText(/successfully confirmed in SQLite ledger/i)).toBeVisible();
  });
});

