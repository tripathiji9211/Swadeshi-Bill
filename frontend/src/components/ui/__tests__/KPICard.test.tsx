import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { KPICard } from '../KPICard';

describe('KPICard Component', () => {
  it('renders label, value, and subtext correctly', () => {
    render(<KPICard label="Total Spend" value="₹1,24,500" sub="Across 42 transactions" />);

    expect(screen.getByText('Total Spend')).toBeInTheDocument();
    expect(screen.getByText('₹1,24,500')).toBeInTheDocument();
    expect(screen.getByText('Across 42 transactions')).toBeInTheDocument();
  });

  it('renders custom icon when provided', () => {
    render(
      <KPICard
        label="Receipts Audited"
        value={150}
        icon={<span data-testid="custom-icon">🧾</span>}
      />
    );

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('renders loading skeleton when isLoading is true', () => {
    const { container } = render(<KPICard label="Pending Anomalies" value="5" isLoading={true} />);

    // Label and value should not be in the DOM when loading
    expect(screen.queryByText('Pending Anomalies')).not.toBeInTheDocument();
    expect(screen.queryByText('5')).not.toBeInTheDocument();
    // Should render skeleton elements
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('triggers onClick handler when card is clicked', () => {
    const handleClick = vi.fn();
    render(<KPICard label="Clickable KPI" value="42" onClick={handleClick} />);

    const card =
      screen.getByText('Clickable KPI').closest('.cursor-pointer') ||
      screen.getByText('Clickable KPI').parentElement;
    if (card) {
      fireEvent.click(card);
      expect(handleClick).toHaveBeenCalledTimes(1);
    }
  });

  it('renders positive trend badge with up arrow', () => {
    render(
      <KPICard
        label="Revenue"
        value="₹50,000"
        trend={{
          value: '+12.4%',
          direction: 'up',
          isPositiveGood: true,
          label: 'vs last month',
        }}
      />
    );

    expect(screen.getByText('+12.4%')).toBeInTheDocument();
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('renders negative trend badge correctly for bad direction', () => {
    render(
      <KPICard
        label="Anomalies Flagged"
        value="12"
        trend={{
          value: '+50%',
          direction: 'up',
          isPositiveGood: false, // For anomalies, up is bad (red)
        }}
      />
    );

    expect(screen.getByText('+50%')).toBeInTheDocument();
  });

  it('displays tooltip text on hover / renders info icon', () => {
    render(
      <KPICard
        label="OCR Accuracy"
        value="98.2%"
        tooltip="Average confidence score from EasyOCR model"
      />
    );

    const tooltipText = screen.getByText('Average confidence score from EasyOCR model');
    expect(tooltipText).toBeInTheDocument();
  });
});
