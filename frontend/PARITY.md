# Swadeshi Khata (स्वदेशी खाता): Streamlit -> React Frontend Parity Checklist
> **Tagline:** "Aapka hisaab, aapka bharosa" (Your accounts, your trust)

This document details feature-by-feature parity between the legacy Streamlit multi-page application (`app/pages/*.py`) and the production React 19 + TypeScript frontend (`frontend/src/pages/*.tsx`).

---

## 1. Page 1: Ingest & Audit Receipt
**Streamlit Reference:** `app/pages/1_Upload.py`  
**React Implementation:** `frontend/src/pages/Upload.tsx`

- [x] **3-Step Visual Stepper Bar**
  - Streamlit: `1. Upload (Active/Completed) -> 2. Review Extraction -> 3. Audit Result`
  - React: `<div className="grid grid-cols-3 gap-2">` with state `activeStep (1 | 2 | 3)`, icons, step badges, and checkmarks (`Upload.tsx:392-428`).
- [x] **Document Dropzone**
  - Streamlit: `st.file_uploader` supporting PNG, JPG, JPEG, PDF, TXT.
  - React: Drag-and-drop zone with native fallback file input accepting `image/png,image/jpeg,image/jpg,image/webp,application/pdf,text/plain,.txt` (`Upload.tsx:539-581`).
- [x] **Preloaded Demo Sample Invoices Picker**
  - Streamlit: Dropdown `st.selectbox` loading demo invoices (`sample_office_supplies.png`, `sample_travel_fuel.png`, `sample_client_dinner.png`, `sample_suspicious_high_dinner.png`).
  - React: Interactive card grid with 1-click preload (`Upload.tsx:595-631`).
- [x] **Selected Document Preview**
  - Streamlit: `st.image` displaying the original, unmodified receipt scan.
  - React: High-resolution preview panel preserving the source image (`Upload.tsx:634-679`).
- [x] **Staged Pipeline Execution Feedback**
  - Streamlit: `st.status` tracking OCR -> Parser -> Classifier -> Anomaly stages.
  - React: Staged animated modal checklist with active pulse/spinner (`Upload.tsx:431-504`).
- [x] **Side-by-Side Review Mode (Step 2)**
  - Streamlit: Left column original image; right column editable inputs for Vendor, Date, Amount, Tax, and Payment Mode.
  - React: Split 12-column grid layout with original document on left and reactive form inputs on right (`Upload.tsx:692-850`).
- [x] **Collapsible OpenCV Preprocessed Document View**
  - Streamlit: `st.expander("View preprocessed image (OpenCV Denoised & Deskewed)")`.
  - React: Expandable card showing deskewed and thresholded document scan (`Upload.tsx:721-758`).
- [x] **Collapsible Raw OCR Text View**
  - Streamlit: `st.expander("📄 View Raw OCR Text Output")`.
  - React: Collapsible `<pre>` block rendering complete raw OCR output (`Upload.tsx:761-797`).
- [x] **Interactive Line Items Table**
  - Streamlit: `st.data_editor` for adding, modifying, and deleting item descriptions and unit prices.
  - React: Full interactive line item table with dynamic add, delete, and recalculation handlers (`Upload.tsx:851-950`).
- [x] **Symmetric Forensic Metric Tiles (Step 3)**
  - Streamlit: Triple metric cards for Classifier Confidence, OCR Confidence, and Anomaly Risk Score.
  - React: `KPICard` grid with symmetric typography and calibrated color status badges (`Upload.tsx:1060-1092`).
- [x] **Audit Findings & Trigger Breakdown**
  - Streamlit: Formatted list of forensic violation rules triggered.
  - React: Risk trigger cards with severity color coding (`Upload.tsx:1105-1134`).
- [x] **Explainable AI (Feature Attribution / SHAP)**
  - Streamlit: Rule reason text.
  - React: Dedicated Explainable AI card displaying local token attribution scores and natural-language summary (`Upload.tsx:1137-1172`).
- [x] **Database Persistence Confirmation**
  - Streamlit: `st.button("💾 Save Verified Record to Database")` writing to SQLite.
  - React: Direct API persistence hook with optimistic success feedback (`Upload.tsx:1150-1167`).

---

## 2. Page 2: Human-in-the-Loop Review Queue
**Streamlit Reference:** `app/pages/2_Review_Queue.py`  
**React Implementation:** `frontend/src/pages/ReviewQueue.tsx`

- [x] **Confidence Gate Summary KPIs**
  - Streamlit: 4 KPI cards (`Pending Reviews`, `Human Corrections`, `Trained Feedback`, `Confidence Gates (OCR 60% / CLF 65%)`).
  - React: 4 top KPI cards matching exact counts and thresholds (`ReviewQueue.tsx:319-365`).
- [x] **Action Toolbar**
  - Streamlit: `Refresh Queue`, `Retrain Classifier on Feedback Now`, `Simulate Flagged Low-Confidence Receipt`.
  - React: Action header bar with `Refresh`, `Retrain on Feedback`, `Simulate Ambiguous Item`, and `Export CSV` (`ReviewQueue.tsx:255-296`).
- [x] **Pending Verification Records List**
  - Streamlit: Record cards with Action Required badge, extracted text, model confidences, and review reason banner.
  - React: High-density interactive audit table with search filter, category filter, and confidence progress bars (`ReviewQueue.tsx:515-674`).
- [x] **Inline Category Correction & Verification**
  - Streamlit: `st.selectbox` for 9 standard categories + Save button.
  - React: Inline select dropdown + instant optimistic save button updating SQLite (`ReviewQueue.tsx:641-666`).
- [x] **Simulate Ambiguous Receipt for Testing**
  - Streamlit: Button injecting mock low-confidence record into SQLite.
  - React: `simulateMutation` calling `POST /review-queue/simulate` (`ReviewQueue.tsx:131-137, 261-270`).
- [x] **Retraining on Feedback Feedback Toast**
  - Streamlit: Spinner + success message with applied corrections count and accuracy.
  - React: Dismissible banner with live metrics upon model retraining (`ReviewQueue.tsx:299-317`).
- [x] **Human Feedback Corrections Audit Trail**
  - Streamlit: Table rendering `data/human_feedback_corrections.csv` + CSV download button.
  - React: Dedicated card rendering historical corrections log + direct CSV download link (`ReviewQueue.tsx:677-735`).

---

## 3. Page 3: Financial Intelligence Dashboard
**Streamlit Reference:** `app/pages/3_Dashboard.py`  
**React Implementation:** `frontend/src/pages/Dashboard.tsx`

- [x] **Filter Bar**
  - Streamlit: Date range picker, Category dropdown, Vendor dropdown, Anomaly checkbox.
  - React: Responsive filter bar with search query, category selector, vendor selector, and only-anomalies switch (`Dashboard.tsx:378-435`).
- [x] **Top Row of 4 KPI Cards with Count-Up Animation**
  - Streamlit: `Total Spend`, `Receipts Processed`, `Anomalies Flagged`, `Avg OCR Confidence`.
  - React: Animated count-up KPI cards with percentage variances and forensic tooltips (`Dashboard.tsx:438-485`).
- [x] **Tab 1: Overview**
  - Streamlit: Monthly spend trend chart, daily spend velocity, median ticket size, peak outlay month, recent invoices table.
  - React: Recharts responsive area trend chart, sub-metric KPI grid, and recent audited transactions table (`Dashboard.tsx:540-750`).
- [x] **Tab 2: Categories**
  - Streamlit: Spend allocation donut chart, category outlay ranking bar chart, telemetry summary table.
  - React: 2D Recharts pie & bar charts + interactive category breakdown leaderboard (`Dashboard.tsx:755-853`).
- [x] **Tab 3: Vendors**
  - Streamlit: Top 10 merchants horizontal bar chart, vendor concentration metrics (top 5 share, unique vendor count), full portfolio table.
  - React: Top vendors outlay bar chart + supplier concentration table with ticket size metrics (`Dashboard.tsx:856-930`).
- [x] **Tab 4: Anomalies with "Why Flagged?" Expander**
  - Streamlit: Forensic overview KPIs (at-risk spend, high/medium counts), severity pie chart, expandable table with "Why flagged?" column, and "Download Flagged Anomalies Only (CSV)" button.
  - React: Anomaly risk summary, interactive table with row expanders showing audit triggers, and dedicated "Download Flagged Anomalies Only (CSV)" button (`Dashboard.tsx:933-1110`).
- [x] **Global CSV Export**
  - Streamlit: `st.download_button` exporting filtered dataset.
  - React: Top header `Export CSV` button generating downloadable CSV blob (`Dashboard.tsx:294-333, 360-366`).

---

## 4. Page 4: Spend Forecasting Engine
**Streamlit Reference:** `app/pages/4_Forecast.py`  
**React Implementation:** `frontend/src/pages/Forecast.tsx`

- [x] **Forecast KPI Cards**
  - Streamlit: `Forecast Horizon`, `Total Projected Spend`, `Primary Spend Driver`.
  - React: 3 top KPI cards computing next month run-rate and primary category outlay (`Forecast.tsx:135-180`).
- [x] **Category Projection Visualization**
  - Streamlit: Plotly horizontal bar chart.
  - React: Composed multi-category bar and area projection chart (`Forecast.tsx:185-245`).
- [x] **Model Comparison Benchmark Table**
  - Streamlit: Architecture notes on SARIMA, XGBoost, and Moving Average.
  - React: Full quantitative benchmark table comparing Moving Average vs SARIMA vs XGBoost with MAE, MAPE, and winning model badge (`Forecast.tsx:250-380`).
- [x] **Forecasting Architecture & Methodology Expander**
  - Streamlit: Expander detailing hyperparameter tuning and lag features.
  - React: Technical deep dive card detailing autoregressive lag features (L1, L2, L3) and seasonal differencing (`Forecast.tsx:385-440`).

---

## 5. Page 5: Expense Insights & Savings Sentinel
**Streamlit Reference:** `app/pages/5_Insights.py`  
**React Implementation:** `frontend/src/pages/Insights.tsx`

- [x] **Top Savings Metric Cards**
  - Streamlit: `Potential Annual Savings`, `Audited Expenditure`, `Savings ROI %`.
  - React: 4 forensic metric cards including recoverable cash and margin expansion (`Insights.tsx:65-111`).
- [x] **3 Actionable Tips Callout**
  - Streamlit: 3 styled callout boxes with AI financial advice.
  - React: Executive callout grid rendering 3 LLM-generated operational tips (`Insights.tsx:125-180`).
- [x] **Tab 1: Vendor Price Arbitrage**
  - Streamlit: Table of identical products with price variance across suppliers.
  - React: Structured table showing cheapest vs expensive supplier, price spread %, and annual savings (`Insights.tsx:210-275`).
- [x] **Tab 2: Budget Spikes (>25%)**
  - Streamlit: Categories exceeding 3-month rolling mean by >25%.
  - React: Spike surveillance table with excess outlay and likely driver analysis (`Insights.tsx:280-330`).
- [x] **Tab 3: Recurring Subscriptions**
  - Streamlit: Active SaaS, utilities, and retainers table.
  - React: Subscription inventory with annual outlay and recommended optimization actions (`Insights.tsx:335-390`).
- [x] **Tab 4: Plain-Language Executive Report**
  - Streamlit: `st.markdown` of the synthesized executive report.
  - React: Formatted markdown reader rendering the full executive report (`Insights.tsx:395-440`).

---

## 6. Page 6: Ask Your Expenses Copilot
**Streamlit Reference:** `app/pages/6_Ask.py`  
**React Implementation:** `frontend/src/pages/Ask.tsx`

- [x] **Curated Suggested Inquiry Chips**
  - Streamlit: 4 quick inquiry buttons (`Highest spending category`, `Anomalies detected`, `Top 5 vendors`, etc.).
  - React: Horizontal quick-prompt carousel loaded dynamically from `/ask/suggestions` (`Ask.tsx:318-333`).
- [x] **Conversational Chat Stream**
  - Streamlit: `st.chat_message` with user and assistant avatars.
  - React: Smooth scrolling message list with role avatars, timestamps, and copy button (`Ask.tsx:172-284`).
- [x] **Structured Financial Metrics Display**
  - Streamlit: `st.expander("📊 View Referenced Metrics from SQLite")` with JSON dump.
  - React: Interactive summary metric chips + collapsible `"📊 View Referenced Metrics from SQLite"` expander (`Ask.tsx:215-265`).
- [x] **Sources Citation & Grounding**
  - Streamlit: Citations to SQLite database.
  - React: Grounding badges displaying sources cited from the SMB ledger (`Ask.tsx:250-256`).

---

## 7. 3D Visual Enhancements (React Three Fiber & Drei)
- [x] **FloatingHeroReceipt (`src/three/FloatingHeroReceipt.tsx`)**: 3D floating invoice and gold coins with mouse parallax interaction.
- [x] **CategoryBars3D (`src/three/CategoryBars3D.tsx`)**: Interactive 3D bar chart with reflective floor and hover tooltips.
- [x] **CategoryDonut3D (`src/three/CategoryDonut3D.tsx`)**: 3D donut chart with exploded slices on hover.
- [x] **AnomalyGalaxy (`src/three/AnomalyGalaxy.tsx`)**: 3D scatter plot of 5,000 points using InstancedMesh with glowing anomalies.
- [x] **AnomalyGauge3D (`src/three/AnomalyGauge3D.tsx`)**: 3D rotating risk speedometer gauge.
- [x] **RadarGlobe (`src/three/RadarGlobe.tsx`)**: 3D wireframe telemetry globe for status badges and header displays.
- [x] **Performance & Accessibility Protections**:
  - `frameloop="demand"` where applicable.
  - Lazy loading with `React.lazy` and `Suspense` fallback skeletons.
  - Error boundaries (`ThreeErrorBoundary`) wrapping all 3D canvases.
  - DPR capping (`PERF_DPR = [1, 1.5]`).
  - "Reduce motion / 2D mode" toggle stored in `localStorage`.

