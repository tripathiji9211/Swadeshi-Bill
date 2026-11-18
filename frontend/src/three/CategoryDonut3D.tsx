import React, { useRef, useState, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { useExpenses } from '@/api/client';
import { useCurrency } from '@/hooks/useCurrency';
import { useMotionMode } from '@/hooks/useMotionMode';
import {
  useCanvasVisibility,
  PERF_DPR,
  Accessible3DSummary,
  ThreeSkeletonLoader,
} from './threeUtils';
import { ThreeErrorBoundary } from './ThreeErrorBoundary';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';
import { RotateCcw, Play, Pause, PieChart, Layers, Info } from 'lucide-react';

// ============================================================================
// 1. DATA TYPES & COLOR PALETTES
// ============================================================================

export interface DonutSliceItem {
  category: string;
  label: string;
  amount: number;
  percentage: number;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  color: string;
  lightColor: string;
}

const DONUT_COLORS = [
  { color: '#3B82F6', lightColor: '#60A5FA' }, // Brand Blue
  { color: '#10B981', lightColor: '#34D399' }, // Emerald
  { color: '#F59E0B', lightColor: '#FBBF24' }, // Amber
  { color: '#EC4899', lightColor: '#F472B6' }, // Rose Pink
  { color: '#8B5CF6', lightColor: '#A78BFA' }, // Violet
  { color: '#06B6D4', lightColor: '#22D3EE' }, // Cyan
  { color: '#F43F5E', lightColor: '#FB7185' }, // Crimson
  { color: '#14B8A6', lightColor: '#2DD4BF' }, // Teal
];

// ============================================================================
// 2. 3D EXTRUDED DONUT SLICE COMPONENT (EXPLODED ON HOVER)
// ============================================================================

interface DonutSliceMeshProps {
  slice: DonutSliceItem;
  isHovered: boolean;
  onHover: (category: string | null) => void;
  innerRadius?: number;
  outerRadius?: number;
  depth?: number;
}

const DonutSliceMesh: React.FC<DonutSliceMeshProps> = ({
  slice,
  isHovered,
  onHover,
  innerRadius = 1.7,
  outerRadius = 3.0,
  depth = 0.55,
}) => {
  const meshRef = useRef<THREE.Group>(null!);
  const currentOffset = useRef<number>(0);

  // Generate 2D arc shape with inner and outer radii
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    // Arc outer edge
    shape.absarc(0, 0, outerRadius, slice.startAngle, slice.endAngle, false);
    // Arc inner edge back to start
    shape.absarc(0, 0, innerRadius, slice.endAngle, slice.startAngle, true);
    shape.closePath();

    return new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.03,
      bevelThickness: 0.03,
      curveSegments: 36,
    });
  }, [slice.startAngle, slice.endAngle, innerRadius, outerRadius, depth]);

  // Clean up extruded geometry on unmount
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  // Smoothly damp exploded radial translation on hover
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const targetOffset = isHovered ? 0.45 : 0.0;
    currentOffset.current = THREE.MathUtils.damp(currentOffset.current, targetOffset, 8.0, delta);

    // Translate outwards along midpoint angle vector
    const dx = Math.cos(slice.midAngle) * currentOffset.current;
    const dy = Math.sin(slice.midAngle) * currentOffset.current;
    meshRef.current.position.set(dx, dy, isHovered ? 0.15 : 0);

    // Subtle scale bump on hover
    const targetScale = isHovered ? 1.05 : 1.0;
    meshRef.current.scale.set(targetScale, targetScale, targetScale);
  });

  return (
    <group ref={meshRef}>
      <mesh
        geometry={geometry}
        castShadow
        receiveShadow
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(slice.category);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onHover(null);
        }}
      >
        <meshStandardMaterial
          color={slice.color}
          roughness={0.25}
          metalness={0.4}
          emissive={slice.color}
          emissiveIntensity={isHovered ? 0.6 : 0.08}
        />
      </mesh>

      {/* Glowing Edge Wireframe Line */}
      <lineSegments>
        <edgesGeometry args={[geometry]} />
        <lineBasicMaterial
          color={slice.lightColor}
          transparent
          opacity={isHovered ? 0.9 : 0.3}
          linewidth={1.5}
        />
      </lineSegments>
    </group>
  );
};

// ============================================================================
// 3. MAIN 3D CATEGORY DONUT SCENE
// ============================================================================

export interface CategoryDonut3DProps {
  data?: { category: string; amount: number }[];
  height?: number | string;
  className?: string;
  title?: string;
  autoRotateDefault?: boolean;
}

export const CategoryDonut3D: React.FC<CategoryDonut3DProps> = ({
  data: customData,
  height = 380,
  className,
  title = '3D Category Share Donut Matrix',
  autoRotateDefault = true,
}) => {
  const { format, currency } = useCurrency();
  const { reduceMotion } = useMotionMode();
  const { containerRef, isVisible, frameloop } = useCanvasVisibility(0.05, reduceMotion);

  // 1. Fetch expenses if no customData passed
  const { data: rawExpenses, isLoading } = useExpenses({ limit: 5000 });

  // 2. Interactive States
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(() => !reduceMotion && autoRotateDefault);
  const [resetSignal, setResetSignal] = useState<number>(0);
  const controlsRef = useRef<any>(null!);

  useEffect(() => {
    if (reduceMotion) {
      setAutoRotate(false);
    }
  }, [reduceMotion]);

  // 3. Aggregate Data into 3D Donut Slices
  const { slices, totalSpend } = useMemo(() => {
    const list = customData || rawExpenses || [];
    const map: Record<string, number> = {};
    let total = 0;

    list.forEach((item) => {
      const c = (item.category || 'misc').toLowerCase();
      const amt = item.amount || 0;
      map[c] = (map[c] || 0) + amt;
      total += amt;
    });

    const entries = Object.entries(map)
      .map(([cat, amt]) => ({
        category: cat,
        label: cat.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        amount: amt,
      }))
      .filter((d) => d.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    // Compute circular angles for each slice (0 to 2*PI)
    let currentAngle = 0;
    const computedSlices: DonutSliceItem[] = entries.map((entry, idx) => {
      const slicePct = total > 0 ? entry.amount / total : 0;
      const sliceAngle = slicePct * Math.PI * 2;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      const midAngle = (startAngle + endAngle) / 2;
      currentAngle = endAngle;

      const palette = DONUT_COLORS[idx % DONUT_COLORS.length];
      return {
        category: entry.category,
        label: entry.label,
        amount: entry.amount,
        percentage: slicePct * 100,
        startAngle,
        endAngle,
        midAngle,
        color: palette.color,
        lightColor: palette.lightColor,
      };
    });

    return { slices: computedSlices, totalSpend: total };
  }, [customData, rawExpenses]);

  // Find currently active slice
  const activeSlice = useMemo(() => {
    if (!hoveredCategory) return null;
    return slices.find((s) => s.category === hoveredCategory) || null;
  }, [slices, hoveredCategory]);

  return (
    <Card
      variant="glass"
      padding="none"
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/[0.08] shadow-glass bg-dark-900/90',
        className
      )}
      role="region"
      aria-label="3D Category Share Donut Matrix"
    >
      {/* Screen Reader Accessible Summary */}
      <Accessible3DSummary
        title={title}
        summary={`3D Donut Matrix representing category outlay across ${slices.length} categories with a total spend of ${format(totalSpend, 0)}.`}
        details={slices.map((s) => ({
          label: `${s.label} (${s.percentage.toFixed(1)}%)`,
          value: format(s.amount, 0),
        }))}
      />

      {/* Header Bar */}
      <div className="px-5 py-3 border-b border-white/[0.08] bg-dark-850/80 backdrop-blur-md flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <PieChart className="w-4 h-4 text-brand-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">{title}</h3>
          <StatusBadge label={`${slices.length} Slices`} variant="brand" />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={cn(
              'p-1.5 rounded-lg border text-xs font-bold transition-all',
              autoRotate
                ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                : 'bg-dark-900 border-white/10 text-slate-400 hover:text-white'
            )}
            title={autoRotate ? 'Pause Rotation' : 'Resume Rotation'}
          >
            {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => {
              if (controlsRef.current) {
                controlsRef.current.reset();
              }
              setResetSignal((s) => s + 1);
            }}
            className="p-1.5 rounded-lg bg-dark-900 border border-white/10 text-slate-400 hover:text-white transition-all"
            title="Reset Perspective"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3D Canvas Stage */}
      <div
        ref={containerRef}
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
        className="relative w-full bg-gradient-to-b from-dark-950 via-[#070B16] to-dark-950 overflow-hidden"
      >
        {isLoading && !customData ? (
          <ThreeSkeletonLoader height={height} label="Aggregating Category Slices..." />
        ) : (
          <ThreeErrorBoundary title="3D Donut Matrix Fallback">
            <Suspense
              fallback={<ThreeSkeletonLoader height={height} label="Mounting 3D Donut Matrix..." />}
            >
              <Canvas
                frameloop={frameloop} // 'always' when visible, 'demand' if reduced motion, 'never' when off-screen
                dpr={PERF_DPR} // Cap DPR to 1.5
                camera={{ position: [0, 4.5, 6.2], fov: 45 }}
                gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
              >
                <ambientLight intensity={0.7} />
                <directionalLight position={[6, 10, 6]} intensity={1.3} />
                <pointLight position={[-6, -4, 4]} intensity={0.6} color="#38BDF8" />

                {/* Orbit Navigation with Floor Prevention */}
                <OrbitControls
                  ref={controlsRef}
                  enablePan={true}
                  enableZoom={true}
                  minDistance={4}
                  maxDistance={18}
                  minPolarAngle={Math.PI / 8}
                  maxPolarAngle={Math.PI / 2.2}
                  autoRotate={autoRotate}
                  autoRotateSpeed={0.9}
                  enableDamping={true}
                  dampingFactor={0.06}
                  target={[0, 0, 0]}
                />

                {/* Tilted Donut Stage for Cinematic View */}
                <group rotation={[-Math.PI / 3, 0, 0]} position={[0, 0.2, 0]}>
                  {slices.map((slice) => (
                    <DonutSliceMesh
                      key={slice.category}
                      slice={slice}
                      isHovered={hoveredCategory === slice.category}
                      onHover={setHoveredCategory}
                    />
                  ))}

                  {/* Center Core HUD Readout in 3D Space */}
                  <Html position={[0, 0, 0.3]} center className="pointer-events-none select-none">
                    <div className="w-32 text-center p-2 rounded-2xl bg-dark-950/90 border border-white/10 backdrop-blur-md shadow-2xl">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        {activeSlice ? activeSlice.label : 'Net Outlay'}
                      </span>
                      <span className="text-xs font-mono font-bold text-brand-300 block">
                        {activeSlice ? format(activeSlice.amount, 0) : format(totalSpend, 0)}
                      </span>
                      <span className="text-[10px] text-emerald-400 font-mono font-bold block">
                        {activeSlice
                          ? `${activeSlice.percentage.toFixed(1)}%`
                          : `${slices.length} categories`}
                      </span>
                    </div>
                  </Html>
                </group>
              </Canvas>
            </Suspense>
          </ThreeErrorBoundary>
        )}

        {/* Hover Hint Overlay */}
        <div className="absolute bottom-3 left-4 text-[10px] text-slate-500 bg-dark-950/80 px-2.5 py-1 rounded-xl border border-white/5 pointer-events-none">
          <span>Hover slice to explode &bull; Drag to tilt</span>
        </div>
      </div>

      {/* Bottom Category Legend Bar */}
      <div className="p-3 border-t border-white/[0.06] bg-dark-950/70 flex items-center gap-2 overflow-x-auto scrollbar-none">
        {slices.map((slice) => {
          const isSelected = hoveredCategory === slice.category;
          return (
            <button
              key={slice.category}
              onMouseEnter={() => setHoveredCategory(slice.category)}
              onMouseLeave={() => setHoveredCategory(null)}
              className={cn(
                'px-2.5 py-1 rounded-xl text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 border',
                isSelected
                  ? 'bg-white/15 border-white/30 text-white shadow-sm'
                  : 'bg-dark-900 border-white/[0.08] text-slate-400 hover:text-white'
              )}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: slice.color }}
              />
              <span>{slice.label}</span>
              <span className="font-mono text-[10px] text-slate-500">
                {slice.percentage.toFixed(0)}%
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
};

export default CategoryDonut3D;
