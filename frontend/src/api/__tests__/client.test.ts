import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  apiClient,
  uploadReceipt,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getDashboardSummary,
  getForecast,
  getInsights,
  askQuestion,
  getAskSuggestions,
  getSampleReceipts,
  getReviewQueue,
  correctExpense,
} from '../client';

describe('ReceiptRadar API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('apiClient instance configuration', () => {
    it('should be configured with default headers and timeout', () => {
      expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
      expect(apiClient.defaults.timeout).toBe(45000);
    });
  });

  describe('uploadReceipt', () => {
    it('posts FormData to /upload-receipt with multipart header', async () => {
      const mockResponse = {
        status: 'success',
        expense_id: 'exp-123',
        predicted_category: 'supplies_stationery',
        classifier_confidence: 0.95,
        ocr_confidence: 0.9,
      };

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockResponse });

      const file = new File(['dummy content'], 'invoice.png', { type: 'image/png' });
      const result = await uploadReceipt(file);

      expect(postSpy).toHaveBeenCalledWith(
        '/upload-receipt',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000,
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('accepts existing FormData directly', async () => {
      const mockResponse = { status: 'success', expense_id: 'exp-456' };
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockResponse });

      const formData = new FormData();
      formData.append('file', new Blob(['test']), 'test.png');
      const result = await uploadReceipt(formData);

      expect(postSpy).toHaveBeenCalledWith(
        '/upload-receipt',
        formData,
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      );
      expect(result.expense_id).toBe('exp-456');
    });
  });

  describe('Expenses endpoints', () => {
    it('fetches expenses list with query params', async () => {
      const mockExpenses = [
        { id: '1', vendor: 'Office Depot', amount: 1500, category: 'supplies_stationery' },
      ];
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockExpenses });

      const params = { category: 'supplies_stationery', limit: 10 };
      const result = await getExpenses(params);

      expect(getSpy).toHaveBeenCalledWith('/expenses', { params });
      expect(result).toEqual(mockExpenses);
    });

    it('fetches single expense by ID', async () => {
      const mockExpense = { id: 'exp-99', vendor: 'IndianOil', amount: 2000 };
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockExpense });

      const result = await getExpenseById('exp-99');
      expect(getSpy).toHaveBeenCalledWith('/expenses/exp-99');
      expect(result.vendor).toBe('IndianOil');
    });

    it('updates an expense record via PUT', async () => {
      const payload = { vendor: 'Updated Vendor', amount: 2500 };
      const mockResponse = { id: 'exp-99', ...payload };
      const putSpy = vi.spyOn(apiClient, 'put').mockResolvedValueOnce({ data: mockResponse });

      const result = await updateExpense('exp-99', payload);
      expect(putSpy).toHaveBeenCalledWith('/expenses/exp-99', payload);
      expect(result.vendor).toBe('Updated Vendor');
    });

    it('deletes an expense record via DELETE', async () => {
      const mockResponse = { status: 'success', message: 'Expense deleted' };
      const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({ data: mockResponse });

      const result = await deleteExpense('exp-99');
      expect(deleteSpy).toHaveBeenCalledWith('/expenses/exp-99');
      expect(result.status).toBe('success');
    });
  });

  describe('Analytics & Intelligence endpoints', () => {
    it('fetches dashboard summary metrics', async () => {
      const mockSummary = {
        total_spend: 150000,
        receipts_count: 85,
        anomalies_count: 3,
        avg_ocr_confidence: 0.92,
      };
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockSummary });

      const result = await getDashboardSummary();
      expect(getSpy).toHaveBeenCalledWith('/dashboard/summary');
      expect(result.total_spend).toBe(150000);
    });

    it('fetches spend forecast and model comparisons', async () => {
      const mockForecast = {
        total_projected_spend: 45000,
        forecast_month: '2026-12',
        forecast_date: '2026-12-01',
        category_projections: {},
        methodology: 'SARIMA & XGBoost',
      };
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockForecast });

      const result = await getForecast();
      expect(getSpy).toHaveBeenCalledWith('/forecast');
      expect(result.total_projected_spend).toBe(45000);
    });

    it('fetches financial insights report', async () => {
      const mockInsights = {
        total_expenses_audited: 50,
        total_spend_analyzed: 120000,
        total_potential_annual_savings: 15000,
        price_variance_findings: [],
        category_spike_findings: [],
        subscription_findings: [],
        actionable_tips: ['Tip 1', 'Tip 2'],
        executive_report_markdown: 'Monthly Executive Report',
      };
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockInsights });

      const result = await getInsights();
      expect(getSpy).toHaveBeenCalledWith('/insights');
      expect(result.actionable_tips).toHaveLength(2);
    });
  });

  describe('Ask Expenses Natural Language endpoints', () => {
    it('submits a question string and returns answer with metrics', async () => {
      const mockAnswer = {
        answer: 'You spent ₹12,500 on Food & Dining last month.',
        question: 'How much did I spend on Food last month?',
        relevant_metrics: { total: 12500 },
      };
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockAnswer });

      const result = await askQuestion('How much did I spend on Food last month?');
      expect(postSpy).toHaveBeenCalledWith('/ask', {
        question: 'How much did I spend on Food last month?',
      });
      expect(result.answer).toContain('₹12,500');
    });

    it('accepts an AskQuestionRequest object', async () => {
      const mockAnswer = {
        question: 'Any anomalies?',
        answer: 'All looks normal.',
        relevant_metrics: {},
      };
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockAnswer });

      const result = await askQuestion({ question: 'Any anomalies?' });
      expect(postSpy).toHaveBeenCalledWith('/ask', { question: 'Any anomalies?' });
      expect(result).toEqual(mockAnswer);
    });

    it('fetches query suggestion chips', async () => {
      const mockSuggestions = {
        suggestions: ['Top 5 vendors this month?', 'Show recent anomalies'],
      };
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockSuggestions });

      const result = await getAskSuggestions();
      expect(result.suggestions).toContain('Top 5 vendors this month?');
    });
  });

  describe('Review Queue & Human-in-the-Loop Corrections', () => {
    it('fetches review queue with limit', async () => {
      const mockQueue = [{ id: 'q-1', vendor: 'Unclear Receipt', amount: 500 }];
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockQueue });

      const result = await getReviewQueue(25);
      expect(getSpy).toHaveBeenCalledWith('/review-queue', { params: { limit: 25 } });
      expect(result).toHaveLength(1);
    });

    it('submits correction to review-queue item', async () => {
      const correction = {
        corrected_category: 'travel_fuel',
        notes: 'Verified via fleet card fuel receipt',
      };
      const mockResponse = {
        status: 'success',
        message: 'Receipt corrected',
        expense: { id: 'q-1', category: 'travel_fuel' },
        feedback_record: { id: 1 },
      };
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockResponse });

      const result = await correctExpense('q-1', correction);
      expect(postSpy).toHaveBeenCalledWith('/review-queue/q-1/correct', correction);
      expect(result.status).toBe('success');
    });

    it('fetches sample receipts for demoing', async () => {
      const mockSamples = [
        {
          filename: 'sample.png',
          title: 'Sample Cafe',
          expected_category: 'food_dining',
          expected_amount: 450,
          image_url: '/samples/sample.png',
        },
      ];
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockSamples });

      const result = await getSampleReceipts();
      expect(result).toEqual(mockSamples);
    });
  });
});
