import { useState, useEffect } from 'react';
import { CurrencyCode } from '@/types';
import {
  formatCurrency as formatCurrencyUtil,
  CURRENCY_MAP,
  CurrencyOptions,
} from '@/lib/currency';

const STORAGE_KEY = 'receiptradar_currency';

export function useCurrency() {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as CurrencyCode) || 'INR';
  });

  const setCurrency = (newCurrency: CurrencyCode) => {
    setCurrencyState(newCurrency);
    localStorage.setItem(STORAGE_KEY, newCurrency);
  };

  const format = (
    amount: number | null | undefined,
    optionsOrDecimals: CurrencyOptions | number = 2
  ) => {
    if (typeof optionsOrDecimals === 'object') {
      return formatCurrencyUtil(amount, { currency, ...optionsOrDecimals });
    }
    return formatCurrencyUtil(amount, currency, optionsOrDecimals);
  };

  return {
    currency,
    setCurrency,
    format,
    symbol: CURRENCY_MAP[currency]?.symbol || '₹',
    currencyMap: CURRENCY_MAP,
  };
}
