import React, { useState, useMemo, useRef, useEffect, Suspense, Component, ErrorInfo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart as RechartsBarChart,
  Bar as RechartsBar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  RotateCcw,
  Play,
  Pause,
  Box,
  BarChart3,
  AlertTriangle,
  Info,
  Sparkles,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { useExpenses } from '@/api/client';
import { useCurrency } from '@/hooks/useCurrency';
import { useMotionMode } from '@/hooks/useMotionMode';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  useCanvasVisibility,
  PERF_DPR,
  Accessible3DSummary,
  ThreeSkeletonLoader,
} from './threeUtils';
import { cn } from '@/lib/utils';

// ============================================================================
// 1. PALETTE & CATEGORY MAPPING DEFINITIONS
// ============================================================================

export interface CategorySpendItem {
  category: string;
  displayName: string;
  amount: number;
  count: number;
  percentage: number;
  color: string;
  lightColor: string;
}

const CATEGORY_STYLE_MAP: Record<
  string,
  { color: string; lightColor: string; label: string; icon: string }
> = {
  meals: { color: '#10B981', lightColor: '#34D399', label: 'Meals & Dining', icon: '🍽️' },
  dining: { color: '#10B981', lightColor: '#34D399', label: 'Dining Out', icon: '🍷' },
  food: { color: '#10B981', lightColor: '#34D399', label: 'Food & Groceries', icon: '🥗' },
  travel: { color: '#0EA5E9', lightColor: '#38BDF8', label: 'Travel & Commute', icon: '✈️' },
  transportation: { color: '#0EA5E9', lightColor: '#38BDF8', label: 'Transportation', icon: '🚕' },
  software: { color: '#6366F1', lightColor: '#818CF8', label: 'Software & Cloud', icon: '💻' },
  saas: { color: '#6366F1', lightColor: '#818CF8', label: 'SaaS Subscriptions', icon: '☁️' },
  office_supplies: {
    color: '#F59E0B',
    lightColor: '#FBBF24',
    label: 'Office Supplies',
    icon: '📎',
  },
  supplies: { color: '#F59E0B', lightColor: '#FBBF24', label: 'Equipment & Supplies', icon: '📦' },
  utilities: { color: '#EC4899', lightColor: '#F472B6', label: 'Utilities & Power', icon: '⚡' },
  groceries: { color: '#84CC16', lightColor: '#A3E635', label: 'Groceries & Stock', icon: '🛒' },
  health: { color: '#14B8A6', lightColor: '#2DD4BF', label: 'Health & Medical', icon: '🩺' },
  entertainment: {
    color: '#8B5CF6',
    lightColor: '#A78BFA',
    label: 'Events & Entertainment',
    icon: '🎟️',
  },
  electronics: {
    color: '#F43F5E',
    lightColor: '#FB7185',
    label: 'Electronics & Hardware',
    icon: '🔌',
  },
  legal: { color: '#A855F7', lightColor: '#C084FC', label: 'Legal & Compliance', icon: '⚖️' },
  marketing: { color: '#E11D48', lightColor: '#FB7185', label: 'Marketing & Ads', icon: '📣' },
  misc: { color: '#3B82F6', lightColor: '#60A5FA', label: 'Miscellaneous', icon: '📁' },
  other: { color: '#64748B', lightColor: '#94A3B8', label: 'Uncategorized', icon: '📂' },
};

const FALLBACK_PALETTE = [
  { color: '#3B82F6', lightColor: '#60A5FA' },
  { color: '#10B981', lightColor: '#34D399' },
  { color: '#F59E0B', lightColor: '#FBBF24' },
  { color: '#EC4899', lightColor: '#F472B6' },
  { color: '#8B5CF6', lightColor: '#A78BFA' },
  { color: '#06B6D4', lightColor: '#22D3EE' },
  { color: '#F43F5E', lightColor: '#FB7185' },
  { color: '#14B8A6', lightColor: '#2DD4BF' },
  { color: '#F97316', lightColor: '#FB923C' },
  { color: '#84CC16', lightColor: '#A3E635' },
];

function getCategoryMetadata(categoryKey: string, index: number) {
  const normalized = categoryKey.toLowerCase().replace(/[\s-]/g, '_');
  if (CATEGORY_STYLE_MAP[normalized]) {
    return {
      displayName: CATEGORY_STYLE_MAP[normalized].label,
      icon: CATEGORY_STYLE_MAP[normalized].icon,
      color: CATEGORY_STYLE_MAP[normalized].color,
      lightColor: CATEGORY_STYLE_MAP[normalized].lightColor,
    };
  }

  const fallback = FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
  const formattedName = categoryKey
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return {
    displayName: formattedName || 'Other',
    icon: '📊',
    color: fallback.color,
    lightColor: fallback.lightColor,
  };
}

// ============================================================================
// 2. WEBGL CAPABILITY DETECTOR & ERROR BOUNDARY
// ============================================================================

export function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

interface ErrorBoundaryProps {
  fallback: React.ReactNode;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class WebGLErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[CategoryBars3D] WebGL render error intercepted:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ============================================================================
// 3. THREE.JS 3D BAR ITEM COMPONENT
// ============================================================================

interface SingleBarProps {
  item: CategorySpendItem;
  index: number;
  totalBars: number;
  maxSpend: number;
  isHovered: boolean;
  onHover: (category: string | null) => void;
  currencyFormatter: (amount: number) => string;
}

const SingleBar3D: React.FC<SingleBarProps> = ({
  item,
  index,
  totalBars,
  maxSpend,
  isHovered,
  onHover,
  currencyFormatter,
}) => {
  const groupRef = useRef<THREE.Group>(null!);
  const scaleMeshRef = useRef<THREE.Group>(null!);
  const animatedScaleY = useRef<number>(0.01);
  const [hasGrown, setHasGrown] = useState<boolean>(false);

  // Layout math: center bars along the X axis
  const spacing = 1.45;
  const barWidth = 0.85;
  const barDepth = 0.85;
  const x = (index - (totalBars - 1) / 2) * spacing;
  const z = 0;

  // Compute target height scaled between min 0.4 and max 4.4 units
  const minHeight = 0.4;
  const maxHeight = 4.4;
  const targetHeight =
    maxSpend > 0 ? minHeight + (item.amount / maxSpend) * (maxHeight - minHeight) : minHeight;

  // Staggered grow-in animation via useFrame
  useFrame((_, delta) => {
    // Smooth damp towards target height
    const growSpeed = hasGrown ? 8.0 : 3.8;
    animatedScaleY.current = THREE.MathUtils.damp(
      animatedScaleY.current,
      targetHeight,
      growSpeed,
      delta
    );

    if (scaleMeshRef.current) {
      scaleMeshRef.current.scale.y = animatedScaleY.current;

      // Tactile scale expansion on hover (X and Z expand slightly)
      const targetScaleXZ = isHovered ? 1.14 : 1.0;
      scaleMeshRef.current.scale.x = THREE.MathUtils.damp(
        scaleMeshRef.current.scale.x,
        targetScaleXZ,
        10.0,
        delta
      );
      scaleMeshRef.current.scale.z = THREE.MathUtils.damp(
        scaleMeshRef.current.scale.z,
        targetScaleXZ,
        10.0,
        delta
      );
    }

    if (!hasGrown && Math.abs(animatedScaleY.current - targetHeight) < 0.05) {
      setHasGrown(true);
    }
  });

  // Memoize geometries and clean up GPU buffers on unmount
  const boxGeo = useMemo(() => new THREE.BoxGeometry(barWidth, 1, barDepth), [barWidth, barDepth]);
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(boxGeo), [boxGeo]);
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.55, 0.65, 32), []);

  useEffect(() => {
    return () => {
      boxGeo.dispose();
      edgesGeo.dispose();
      ringGeo.dispose();
    };
  }, [boxGeo, edgesGeo, ringGeo]);

  return (
    <group ref={groupRef} position={[x, 0, z]}>
      {/* Scaling Bar Mesh - Pivot at bottom (y = 0) */}
      <group
        ref={scaleMeshRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(item.category);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onHover(null);
        }}
      >
        {/* Solid Bar Geometry: Centered at 0.5 so base is at y = 0 */}
        <mesh geometry={boxGeo} position={[0, 0.5, 0]} castShadow receiveShadow>
          <meshStandardMaterial
            color={item.color}
            roughness={0.25}
            metalness={0.4}
            emissive={item.color}
            emissiveIntensity={isHovered ? 0.5 : 0.08}
          />
        </mesh>

        {/* Luminous Neon Edge Highlights */}
        <lineSegments geometry={edgesGeo} position={[0, 0.5, 0]}>
          <lineBasicMaterial
            color={item.lightColor}
            transparent
            opacity={isHovered ? 0.95 : 0.4}
            linewidth={1.5}
          />
        </lineSegments>
      </group>

      {/* Floating Floor Marker Disc */}
      <mesh geometry={ringGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <meshBasicMaterial
          color={item.lightColor}
          transparent
          opacity={isHovered ? 0.8 : 0.25}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Floating 3D HTML Label & Rich Hover Tooltip */}
      <Html
        position={[0, targetHeight + 0.35, 0]}
        center
        distanceFactor={11}
        className="pointer-events-none select-none"
      >
        <AnimatePresence>
          {isHovered ? (
            /* Rich Hover Tooltip */
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 8 }}
              transition={{ duration: 0.15 }}
              className="z-50 w-52 p-3 rounded-2xl bg-dark-950/95 backdrop-blur-xl border border-white/20 shadow-2xl shadow-black/80 text-left text-xs text-white"
            >
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-white/10">
                <span
                  className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-bold text-white truncate text-xs">{item.displayName}</span>
              </div>

              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans">Total Spend:</span>
                  <span className="font-bold text-brand-300">{currencyFormatter(item.amount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans">Allocation:</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-white/10 text-emerald-400 font-bold">
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans">Receipts:</span>
                  <span className="text-slate-200">{item.count} items</span>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Compact Floating Label Pill */
            <div
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border transition-all duration-200 whitespace-nowrap shadow-md',
                'bg-dark-900/85 backdrop-blur-md text-slate-300 border-white/10'
              )}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
                style={{ backgroundColor: item.color }}
              />
              {item.displayName.split(' ')[0]}
            </div>
          )}
        </AnimatePresence>
      </Html>
    </group>
  );
};

// ============================================================================
// 4. REFLECTIVE FLOOR & SCENIC LIGHTING
// ============================================================================

const SceneEnvironment: React.FC = () => {
  return (
    <>
      {/* Soft Ambient Illumination */}
      <ambientLight intensity={0.65} color="#E2E8F0" />

      {/* Primary Directional Keylight with Soft Shadows */}
      <directionalLight
        position={[8, 14, 8]}
        intensity={1.25}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0001}
      />

      {/* Cool Rim Lighting from Rear */}
      <pointLight position={[-9, 7, -6]} intensity={0.7} color="#38BDF8" />

      {/* Warm Fill Lighting from Opposite Corner */}
      <pointLight position={[9, 5, -5]} intensity={0.5} color="#F472B6" />

      {/* Tech Concentric Floor Radar Rings */}
      <group position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {[2.5, 4.5, 6.8, 9.2].map((radius, i) => (
          <mesh key={i}>
            <ringGeometry args={[radius - 0.02, radius, 64]} />
            <meshBasicMaterial
              color="#3B82F6"
              transparent
              opacity={0.12 - i * 0.025}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>

      {/* High-Fidelity Reflective Ground Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <MeshReflectorMaterial
          blur={[300, 100]}
          resolution={512}
          mixBlur={1}
          mixStrength={35}
          roughness={0.55}
          depthScale={1.2}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#0B0F19"
          metalness={0.7}
          mirror={0.55}
        />
      </mesh>
    </>
  );
};

// ============================================================================
// 5. CAMERA CONTROLS HELPER
// ============================================================================

interface CameraControlsProps {
  autoRotate: boolean;
  resetSignal: number;
}

const ControlledOrbit: React.FC<CameraControlsProps> = ({ autoRotate, resetSignal }) => {
  const controlsRef = useRef<any>(null!);
  const { camera } = useThree();

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.reset();
      camera.position.set(0, 5.2, 11.5);
      controlsRef.current.target.set(0, 1.4, 0);
      controlsRef.current.update();
    }
  }, [resetSignal, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      minDistance={5}
      maxDistance={22}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI / 2 - 0.04} // Prevents camera from dipping beneath the reflective floor
      autoRotate={autoRotate}
      autoRotateSpeed={0.8}
      enableDamping={true}
      dampingFactor={0.06}
      target={[0, 1.4, 0]}
    />
  );
};

// ============================================================================
// 6. 2D FALLBACK CHART COMPONENT
// ============================================================================

interface CategoryBars2DProps {
  items: CategorySpendItem[];
  currencyFormatter: (amount: number) => string;
  isWebGLSupported: boolean;
}

const CategoryBars2D: React.FC<CategoryBars2DProps> = ({
  items,
  currencyFormatter,
  isWebGLSupported,
}) => {
  const chartData = useMemo(() => {
    return items.map((item) => ({
      name: item.displayName,
      amount: item.amount,
      color: item.color,
      percentage: item.percentage,
      count: item.count,
    }));
  }, [items]);

  return (
    <div className="p-5 space-y-6">
      {!isWebGLSupported && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            WebGL hardware acceleration is unavailable on this browser or device. Displaying
            high-performance 2D expenditure breakdown instead.
          </span>
        </div>
      )}

      {/* 2D Recharts Bar Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart data={chartData} margin={{ top: 15, right: 10, left: 10, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="name"
              stroke="#64748B"
              fontSize={11}
              interval={0}
              angle={-15}
              textAnchor="end"
            />
            <YAxis stroke="#64748B" fontSize={11} tickFormatter={(v) => currencyFormatter(v)} />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: '#0B0F19',
                borderColor: 'rgba(255,255,255,0.15)',
                borderRadius: '0.75rem',
                fontSize: '12px',
                color: '#fff',
              }}
              formatter={(val: any, _name: any, item: any) => [
                `${currencyFormatter(val)} (${item.payload.percentage.toFixed(1)}%)`,
                'Total Spend',
              ]}
            />
            <RechartsBar dataKey="amount" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </RechartsBar>
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>

      {/* Category Progress Row Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
        {items.map((cat) => (
          <div
            key={cat.category}
            className="p-3 rounded-xl bg-dark-900 border border-white/[0.06] hover:border-white/15 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-xs mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="font-bold text-white">{cat.displayName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-mono text-[11px]">
                  {cat.percentage.toFixed(1)}%
                </span>
                <span className="font-bold text-brand-300 font-mono">
                  {currencyFormatter(cat.amount)}
                </span>
              </div>
            </div>

            {/* Visual Progress Track */}
            <div className="w-full bg-dark-950 rounded-full h-2 overflow-hidden border border-white/5">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${cat.percentage}%`,
                  backgroundColor: cat.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 7. MAIN INTERACTIVE 3D CATEGORY BARS COMPONENT
// ============================================================================

export interface CategoryBars3DProps {
  /** Optional custom data array. Defaults to querying /expenses endpoint */
  data?: { category: string; amount: number; count?: number }[];
  /** Container height in pixels or Tailwind classes. Defaults to 460 */
  height?: number | string;
  /** Custom outer wrapper CSS classes */
  className?: string;
  /** Custom title string */
  title?: string;
  /** Whether auto-rotate is initially active (defaults to true) */
  autoRotateDefault?: boolean;
  /** Whether to show header HUD controls (defaults to true) */
  showControls?: boolean;
}

export const CategoryBars3D: React.FC<CategoryBars3DProps> = ({
  data: customData,
  height = 460,
  className,
  title = 'Interactive 3D Category Expenditure Matrix',
  autoRotateDefault = true,
  showControls = true,
}) => {
  const { format, currency } = useCurrency();
  const { reduceMotion } = useMotionMode();

  // 1. Data Fetching from /expenses endpoint (active if no customData passed)
  const { data: rawExpenses, isLoading: isExpensesLoading } = useExpenses({
    limit: 5000,
  });

  // 2. Hardware Capability State & Reduced Motion
  const [webGLSupported] = useState<boolean>(() => isWebGLAvailable());
  const [viewMode, setViewMode] = useState<'3D' | '2D'>(() =>
    reduceMotion ? '2D' : webGLSupported ? '3D' : '2D'
  );

  // Sync viewMode when reduced motion preference changes
  useEffect(() => {
    if (reduceMotion) {
      setViewMode('2D');
    }
  }, [reduceMotion]);

  // 3. Performance & Off-Screen Visibility
  const { containerRef, isVisible, frameloop } = useCanvasVisibility(0.05, reduceMotion);

  // 4. 3D Scene Controls State
  const [autoRotate, setAutoRotate] = useState<boolean>(() => !reduceMotion && autoRotateDefault);
  const [resetSignal, setResetSignal] = useState<number>(0);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // 5. Data Aggregation & Preparation
  const categoryItems = useMemo<CategorySpendItem[]>(() => {
    // A: If customData is supplied
    if (customData && customData.length > 0) {
      const total = customData.reduce((acc, curr) => acc + (curr.amount || 0), 0);
      return customData
        .filter((d) => d.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .map((item, idx) => {
          const meta = getCategoryMetadata(item.category, idx);
          return {
            category: item.category,
            displayName: meta.displayName,
            amount: item.amount,
            count: item.count || 1,
            percentage: total > 0 ? (item.amount / total) * 100 : 0,
            color: meta.color,
            lightColor: meta.lightColor,
          };
        });
    }

    // B: Otherwise aggregate from /expenses query
    if (!rawExpenses || rawExpenses.length === 0) return [];

    const map: Record<string, { amount: number; count: number }> = {};
    let totalOutlay = 0;

    rawExpenses.forEach((exp) => {
      const rawCat = exp.category || 'misc';
      const amt = exp.amount || 0;
      if (!map[rawCat]) {
        map[rawCat] = { amount: 0, count: 0 };
      }
      map[rawCat].amount += amt;
      map[rawCat].count += 1;
      totalOutlay += amt;
    });

    const entries = Object.entries(map)
      .map(([cat, val], idx) => {
        const meta = getCategoryMetadata(cat, idx);
        return {
          category: cat,
          displayName: meta.displayName,
          amount: val.amount,
          count: val.count,
          percentage: totalOutlay > 0 ? (val.amount / totalOutlay) * 100 : 0,
          color: meta.color,
          lightColor: meta.lightColor,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return entries;
  }, [customData, rawExpenses]);

  // Aggregate metrics
  const maxSpend = useMemo(() => {
    if (!categoryItems.length) return 0;
    return Math.max(...categoryItems.map((c) => c.amount));
  }, [categoryItems]);

  const totalSpend = useMemo(() => {
    return categoryItems.reduce((acc, curr) => acc + curr.amount, 0);
  }, [categoryItems]);

  // Loading Skeleton State
  if (isExpensesLoading && !customData) {
    return (
      <Card variant="glass" padding="none" className={cn('overflow-hidden', className)}>
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-ping" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Initializing 3D Telemetry...
            </span>
          </div>
        </div>
        <div
          style={{ height: typeof height === 'number' ? `${height}px` : height }}
          className="flex flex-col items-center justify-center gap-3 text-slate-400 bg-dark-950/70"
        >
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono">Aggregating /expenses data...</span>
        </div>
      </Card>
    );
  }

  // Empty State
  if (categoryItems.length === 0) {
    return (
      <Card variant="glass" padding="lg" className={cn('text-center space-y-3', className)}>
        <BarChart3 className="w-10 h-10 text-slate-500 mx-auto" />
        <h3 className="text-sm font-bold text-white">No Category Outlay Recorded</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Upload receipt invoices to populate the interactive 3D expenditure matrix.
        </p>
      </Card>
    );
  }

  return (
    <Card
      variant="glass"
      padding="none"
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/[0.08] shadow-glass bg-dark-900/90',
        className
      )}
    >
      {/* ===================================================================== */}
      {/* TOP HEADER & HUD CONTROLS BAR                                        */}
      {/* ===================================================================== */}
      <div className="px-5 py-3.5 border-b border-white/[0.08] bg-dark-850/70 backdrop-blur-md flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-400 block" />
            <span className="w-2.5 h-2.5 rounded-full bg-brand-400 absolute inset-0 animate-ping opacity-75" />
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <span>{title}</span>
              <StatusBadge label={`${categoryItems.length} Categories`} variant="brand" />
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Net Outlay:{' '}
              <span className="font-bold text-brand-300 font-mono">{format(totalSpend, 0)}</span>
            </p>
          </div>
        </div>

        {showControls && (
          <div className="flex items-center gap-2">
            {/* View Mode Toggle (3D vs 2D Fallback) */}
            <div className="flex items-center p-1 rounded-xl bg-dark-900 border border-white/10 text-xs font-bold">
              <button
                onClick={() => setViewMode('3D')}
                disabled={!webGLSupported}
                className={cn(
                  'px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all text-xs',
                  viewMode === '3D'
                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                    : 'text-slate-400 hover:text-white disabled:opacity-30'
                )}
                title={webGLSupported ? 'Switch to 3D View' : 'WebGL Not Supported'}
              >
                <Box className="w-3.5 h-3.5" />
                <span>3D Mesh</span>
              </button>

              <button
                onClick={() => setViewMode('2D')}
                className={cn(
                  'px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all text-xs',
                  viewMode === '2D'
                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                    : 'text-slate-400 hover:text-white'
                )}
                title="Switch to 2D Fallback"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>2D Chart</span>
              </button>
            </div>

            {/* 3D-Only Controls */}
            {viewMode === '3D' && webGLSupported && (
              <>
                {/* Auto-Rotate Toggle */}
                <button
                  onClick={() => setAutoRotate(!autoRotate)}
                  className={cn(
                    'p-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center',
                    autoRotate
                      ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                      : 'bg-dark-900 border-white/10 text-slate-400 hover:text-white'
                  )}
                  title={autoRotate ? 'Pause Auto-Rotation' : 'Resume Auto-Rotation'}
                >
                  {autoRotate ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Reset Camera View */}
                <button
                  onClick={() => setResetSignal((s) => s + 1)}
                  className="p-2 rounded-xl bg-dark-900 border border-white/10 text-slate-400 hover:text-white transition-all"
                  title="Reset Camera Angle"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Accessible Screen Reader Summary */}
      <Accessible3DSummary
        title={title}
        summary={`3D Category Bar Matrix displaying expenditure across ${categoryItems.length} business categories. Total outlay is ${format(totalSpend, 0)}.`}
        details={categoryItems.map((cat) => ({
          label: `${cat.displayName} (${cat.percentage.toFixed(1)}%)`,
          value: format(cat.amount, 0),
        }))}
      />

      {/* ===================================================================== */}
      {/* MAIN VIEWPORT: 3D CANVAS OR 2D FALLBACK                              */}
      {/* ===================================================================== */}
      <div
        ref={containerRef}
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
        className="relative w-full bg-gradient-to-b from-dark-950 via-dark-900 to-dark-950 overflow-hidden"
      >
        {viewMode === '3D' && webGLSupported ? (
          <WebGLErrorBoundary
            fallback={
              <CategoryBars2D
                items={categoryItems}
                currencyFormatter={(v) => format(v, 0)}
                isWebGLSupported={false}
              />
            }
          >
            {/* Subtle Tech Grid Floor Projection */}
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(rgba(59, 130, 246, 0.45) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />

            {/* R3F WebGL Canvas Mount with Capped DPR and Visibility Frameloop */}
            <Suspense
              fallback={
                <ThreeSkeletonLoader height={height} label="Mounting 3D Category Outlay Mesh..." />
              }
            >
              <Canvas
                shadows
                frameloop={frameloop}
                dpr={PERF_DPR}
                camera={{ position: [0, 5.2, 11.5], fov: 42 }}
                gl={{
                  antialias: true,
                  alpha: true,
                  powerPreference: 'high-performance',
                }}
              >
                {/* Reflective floor & scenic lighting */}
                <SceneEnvironment />

                {/* OrbitControls with limited zoom & auto-rotate */}
                <ControlledOrbit autoRotate={autoRotate} resetSignal={resetSignal} />

                {/* Render Category 3D Bars */}
                {categoryItems.map((item, index) => (
                  <SingleBar3D
                    key={item.category}
                    item={item}
                    index={index}
                    totalBars={categoryItems.length}
                    maxSpend={maxSpend}
                    isHovered={hoveredCategory === item.category}
                    onHover={setHoveredCategory}
                    currencyFormatter={(v) => format(v, 0)}
                  />
                ))}
              </Canvas>
            </Suspense>

            {/* Bottom-Left 3D Interaction Hint Badge */}
            <div className="absolute bottom-3 left-4 text-[10px] text-slate-400 flex items-center gap-2 pointer-events-none bg-dark-950/80 px-2.5 py-1 rounded-lg border border-white/10 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Drag to Orbit &bull; Scroll to Zoom &bull; Hover for Details</span>
            </div>
          </WebGLErrorBoundary>
        ) : (
          <CategoryBars2D
            items={categoryItems}
            currencyFormatter={(v) => format(v, 0)}
            isWebGLSupported={webGLSupported}
          />
        )}
      </div>

      {/* ===================================================================== */}
      {/* BOTTOM CATEGORY QUICK-FILTER CHIPS / LEGEND                          */}
      {/* ===================================================================== */}
      <div className="p-3 border-t border-white/[0.06] bg-dark-950/70 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0 ml-1">
          Categories:
        </span>
        {categoryItems.map((cat) => {
          const isSelected = hoveredCategory === cat.category;
          return (
            <button
              key={cat.category}
              onMouseEnter={() => setHoveredCategory(cat.category)}
              onMouseLeave={() => setHoveredCategory(null)}
              onClick={() =>
                setHoveredCategory(hoveredCategory === cat.category ? null : cat.category)
              }
              className={cn(
                'px-2.5 py-1 rounded-xl text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 border',
                isSelected
                  ? 'bg-white/15 border-white/30 text-white shadow-sm'
                  : 'bg-dark-900 border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-dark-850'
              )}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span>{cat.displayName}</span>
              <span className="font-mono text-[10px] text-slate-500 font-normal">
                {cat.percentage.toFixed(0)}%
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
};

export default CategoryBars3D;
