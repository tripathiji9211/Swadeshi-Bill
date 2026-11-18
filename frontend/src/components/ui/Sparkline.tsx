import React from 'react';
import { cn } from '@/lib/utils';

export interface SparklineProps {
  data?: number[];
  color?: string; // e.g. '#FF9933' or '#8B8DFF' or '#34D399'
  width?: number;
  height?: number;
  className?: string;
  fill?: boolean;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data = [12, 19, 14, 25, 22, 30, 28, 35, 42, 38, 48, 55],
  color = '#FF9933',
  width = 96,
  height = 24,
  className,
  fill = true,
}) => {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const effectiveH = height - padding * 2;
  const step = (width - padding * 2) / (data.length - 1);

  const points = data.map((val, idx) => {
    const x = padding + idx * step;
    const y = height - padding - ((val - min) / range) * effectiveH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polylinePoints = points.join(' ');
  const areaPoints = `${padding},${height} ${polylinePoints} ${width - padding},${height}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible shrink-0', className)}
      aria-hidden="true"
    >
      {fill && (
        <polygon
          points={areaPoints}
          fill={color}
          fillOpacity={0.12}
        />
      )}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polylinePoints}
      />
      {/* End point dot with subtle glow */}
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].split(',')[0]}
          cy={points[points.length - 1].split(',')[1]}
          r="2"
          fill={color}
        />
      )}
    </svg>
  );
};

export default Sparkline;

