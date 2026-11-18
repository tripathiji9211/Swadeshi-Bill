import { test, expect } from '@playwright/test';

test.describe('Swadeshi Khata (स्वदेशी खाता) Full End-to-End Parity Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept and mock backend API routes to ensure fast, deterministic E2E verification
    await page.route('**/api/upload-receipt', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          message: 'Receipt processed and saved to database.',
          expense_id: 'e2e-exp-101',
          expense: {
            id: 'e2e-exp-101',
            vendor: 'Dunder Mifflin Paper Co.',
            amount: 3450.0,
            tax: 414.0,
            category: 'supplies_stationery',
            date: '2026-11-04',
            payment_mode: 'UPI',
            item_description: 'A4 Copier Paper Pack',
            is_anomaly: false,
            anomaly_score: 0.12,
            risk_severity: 'LOW',
            risk_reasons: 'Clean audit pass.',
            raw_text: 'Dunder Mifflin Paper Co. A4 Paper Pack Total: 3450.00',
            ocr_confidence: 0.92,
            classifier_confidence: 0.94,
          },
          parsed_receipt: {
            merchant_name: 'Dunder Mifflin Paper Co.',
            vendor: 'Dunder Mifflin Paper Co.',
            date: '2026-11-04',
            total: 3450.0,
            tax: 414.0,
            items: [
              {
                description: 'A4 Copier Paper Pack',
                quantity: 5,
                unit_price: 690.0,
                total_price: 3450.0,
              },
            ],
          },
          predicted_category: 'supplies_stationery',
          category_confidence: 0.94,
          classifier_confidence: 0.94,
          ocr_confidence: 0.92,
          needs_review: false,
          review_reason: '',
          audit_risk: {
            is_anomaly: false,
            anomaly_score: 0.12,
            risk_severity: 'LOW',
            reasons: ['Clean audit pass: conforms to commercial purchase standards.'],
          },
          image_url: '/sample-receipts/sample_office_supplies.png',
          explanation: {
            predicted_category: 'supplies_stationery',
            confidence: 0.94,
            base_value: 0.05,
            top_features: [
              { token: 'paper', weight: 3.4, contribution: 1.25, direction: 'positive' },
              { token: 'copier', weight: 2.8, contribution: 0.95, direction: 'positive' },
            ],
            summary_explanation: "Classified as 'supplies_stationery' due to salient tokens: 'paper', 'copier'.",
          },
        }),
      });
    });

    await page.route('**/api/expenses/e2e-exp-101', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'e2e-exp-101',
          vendor: 'Dunder Mifflin Paper Co.',
          amount: 3450.0,
          category: 'supplies_stationery',
        }),
      });
    });

    await page.route('**/api/ask', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          question: 'What is our highest spending category?',
          answer: 'Based on your 5,000 audited expense records, your highest spending category is Salaries & Retainers.',
          relevant_metrics: {
            total_spend_inr: 8450000.0,
            total_receipts_audited: 5000,
            top_spending_category: 'salaries',
          },
          sources_cited: ['SQLite Database (data/receiptradar.db)'],
        }),
      });
    });
  });

  test('should execute complete parity user flow: upload -> review -> dashboard -> forecast -> insights -> ask', async ({
    page,
  }) => {
    // ------------------------------------------------------------------------
    // STAGE 1: UPLOAD & EXTRACTION
    // ------------------------------------------------------------------------
    await page.goto('/upload');
    await expect(page.locator('h1')).toContainText(/Ingest & Audit Receipt/i);

    // Pick a demo sample invoice
    const sampleCard = page.locator('text=Dunder Mifflin Paper Co.').first();
    await sampleCard.click();

    // Trigger processing pipeline
    const runBtn = page.getByRole('button', { name: /Run OCR & Forensic Audit Pipeline/i });
    await expect(runBtn).toBeEnabled();
    await runBtn.click();

    // ------------------------------------------------------------------------
    // STAGE 2: SIDE-BY-SIDE REVIEW
    // ------------------------------------------------------------------------
    await expect(page.getByText(/Step 2: Review/i)).toBeVisible();
    await expect(page.getByText(/Verify & Correct Extracted Fields/i)).toBeVisible();
    await expect(page.locator('input[value="Dunder Mifflin Paper Co."]').first()).toBeVisible();

    // Check raw OCR text expander is present
    const rawOcrBtn = page.getByRole('button', { name: /View Raw OCR Text Output/i });
    await expect(rawOcrBtn).toBeVisible();

    // Proceed to Step 3: Audited
    const proceedBtn = page.getByRole('button', { name: /Proceed to Audit Result/i });
    await proceedBtn.click();

    // ------------------------------------------------------------------------
    // STAGE 3: AUDIT RESULT INSPECTION & DATABASE PERSISTENCE
    // ------------------------------------------------------------------------
    await expect(page.getByText(/Step 3: Audited/i)).toBeVisible();
    await expect(page.getByText(/Forensic Confidence & Anomaly Metrics/i).or(page.getByText(/Classifier Confidence/i))).toBeVisible();
    await expect(page.getByText(/Clean Transaction/i).or(page.getByText(/Forensic Audit Findings/i))).toBeVisible();

    // Verify Explainability feature card
    await expect(page.getByText(/Explainable AI/i)).toBeVisible();

    // Persist to SQLite
    const saveBtn = page.getByRole('button', { name: /Save Verified Record to Database/i });
    await saveBtn.click();
    await expect(page.getByText(/Persisted in SQLite Database/i)).toBeVisible();

    // ------------------------------------------------------------------------
    // STAGE 4: DASHBOARD TELEMETRY & TABS
    // ------------------------------------------------------------------------
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toContainText(/Financial Intelligence Dashboard/i);

    // Verify 4 KPI cards exist
    await expect(page.getByText(/Total Spend/i).first()).toBeVisible();
    await expect(page.getByText(/Receipts Processed/i).first()).toBeVisible();
    await expect(page.getByText(/Anomalies Flagged/i).first()).toBeVisible();
    await expect(page.getByText(/Avg OCR Confidence/i).first()).toBeVisible();

    // Switch tabs: Categories
    await page.getByRole('tab', { name: /Categories/i }).or(page.locator('button:has-text("Categories")')).first().click();
    await expect(page.getByText(/Category Allocation/i).or(page.getByText(/Category Outlay/i))).toBeVisible();

    // Switch tabs: Vendors
    await page.getByRole('tab', { name: /Vendors/i }).or(page.locator('button:has-text("Vendors")')).first().click();
    await expect(page.getByText(/Top Vendors by Aggregate Outlay/i)).toBeVisible();

    // Switch tabs: Anomalies
    await page.getByRole('tab', { name: /Anomalies/i }).or(page.locator('button:has-text("Anomalies")')).first().click();
    await expect(page.getByText(/Audited Anomaly Logs/i)).toBeVisible();

    // ------------------------------------------------------------------------
    // STAGE 5: SPEND FORECASTING ENGINE
    // ------------------------------------------------------------------------
    await page.goto('/forecast');
    await expect(page.locator('h1')).toContainText(/Spend Forecasting Engine/i);
    await expect(page.getByText(/Forecast Horizon/i).first()).toBeVisible();
    await expect(page.getByText(/Total Projected Spend/i).first()).toBeVisible();
    await expect(page.getByText(/Model Benchmark/i).or(page.getByText(/Algorithm Architecture/i))).toBeVisible();

    // ------------------------------------------------------------------------
    // STAGE 6: SAVINGS INSIGHTS SENTINEL
    // ------------------------------------------------------------------------
    await page.goto('/insights');
    await expect(page.locator('h1')).toContainText(/Expense Insights/i);
    await expect(page.getByText(/Potential Annual Savings/i).first()).toBeVisible();
    await expect(page.getByText(/Actionable Tips/i).first()).toBeVisible();

    // ------------------------------------------------------------------------
    // STAGE 7: ASK YOUR EXPENSES COPILOT
    // ------------------------------------------------------------------------
    await page.goto('/ask');
    await expect(page.locator('h1')).toContainText(/Ask Your Expenses/i);

    // Click a suggested chip
    const chip = page.getByRole('button', { name: /Highest spending category/i }).first();
    if (await chip.isVisible()) {
      await chip.click();
    } else {
      const chatInput = page.getByPlaceholder(/Ask anything about your expenses/i);
      await chatInput.fill('What is our highest spending category?');
      await page.getByRole('button', { name: /Ask AI/i }).click();
    }

    // Verify assistant answer appears
    await expect(page.getByText(/highest spending category is/i)).toBeVisible();
  });
});

