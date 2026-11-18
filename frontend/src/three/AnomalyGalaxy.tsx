import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  Suspense,
  useCallback,
  Component,
  ErrorInfo,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  RotateCcw,
  Sparkles,
  AlertTriangle,
  ShieldAlert,
  Eye,
  Search,
  Filter,
  X,
  Play,
  Pause,
  Layers,
  ExternalLink,
  Calendar,
  CreditCard,
  Tag,
  CheckCircle2,
  Box,
  Compass,
  Cpu,
} from 'lucide-react';
import { useExpenses } from '@/api/client';
import { useCurrency } from '@/hooks/useCurrency';
import { useMotionMode } from '@/hooks/useMotionMode';
import { ExpenseItemResponse } from '@/types';
import { Card } from '@/components/ui/Card';
import { StatusBadge, AnomalyRiskBadge } from '@/components/ui/StatusBadge';
import {
  detectDeviceCapabilities,
  useCanvasVisibility,
  PERF_DPR,
  Accessible3DSummary,
  ThreeSkeletonLoader,
} from './threeUtils';
import { cn } from '@/lib/utils';

// ============================================================================
// 1. DATA POINT INTERFACE & COORDINATE MAPPERS
// ============================================================================

export interface GalaxyPoint {
  id: string;
  x: number;
  y: number;
  z: number;
  isAnomaly: boolean;
  anomalyScore: number;
  original: ExpenseItemResponse;
  categoryIndex: number;
}

interface CoordinateBounds {
  minTimestamp: number;
  maxTimestamp: number;
  maxSpend: number;
  categories: string[];
}

function calculateCoordinates(
  item: ExpenseItemResponse,
  bounds: CoordinateBounds,
  index: number
): GalaxyPoint {
  const { minTimestamp, maxTimestamp, maxSpend, categories } = bounds;

  let ts = item.date ? new Date(item.date).getTime() : minTimestamp;
  if (isNaN(ts)) ts = minTimestamp;
  const timeSpan = Math.max(1, maxTimestamp - minTimestamp);
  const normX = (ts - minTimestamp) / timeSpan;
  const jitterX = (((index * 9301 + 49297) % 233280) / 233280 - 0.5) * 0.35;
  const x = (normX - 0.5) * 25 + jitterX;

  const safeAmount = Math.max(1, item.amount || 0);
  const logMin = Math.log10(10);
  const logMax = Math.log10(Math.max(1000, maxSpend));
  const logAmt = Math.log10(Math.max(10, safeAmount));
  const normY = Math.min(1, Math.max(0, (logAmt - logMin) / (logMax - logMin || 1)));
  const y = 0.4 + normY * 10.5;

  const catKey = (item.category || 'misc').toLowerCase();
  let catIdx = categories.indexOf(catKey);
  if (catIdx === -1) catIdx = categories.length - 1;
  const totalCats = Math.max(1, categories.length - 1);
  const normZ = catIdx / totalCats - 0.5;
  const jitterZ = (((index * 49297 + 9301) % 233280) / 233280 - 0.5) * 0.5;
  const z = normZ * 17.5 + jitterZ;

  return {
    id: item.id,
    x,
    y,
    z,
    isAnomaly: Boolean(item.is_anomaly),
    anomalyScore: item.anomaly_score ?? (item.is_anomaly ? 0.85 : 0.05),
    original: item,
    categoryIndex: catIdx,
  };
}

// ============================================================================
// 2. UNREAL BLOOM POST-PROCESSING PASS COMPONENT
// ============================================================================

interface BloomPassProps {
  enabled?: boolean;
  strength?: number;
  radius?: number;
  threshold?: number;
}

const BloomEffect: React.FC<BloomPassProps> = ({
  enabled = true,
  strength = 1.3,
  radius = 0.65,
  threshold = 0.22,
}) => {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);

  useEffect(() => {
    if (!enabled) return;

    try {
      const renderPass = new RenderPass(scene, camera);
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(size.width, size.height),
        strength,
        radius,
        threshold
      );

      const composer = new EffectComposer(gl);
      composer.renderToScreen = true;
      composer.addPass(renderPass);
      composer.addPass(bloomPass);

      composerRef.current = composer;

      return () => {
        composer.dispose();
        composerRef.current = null;
      };
    } catch (err) {
      console.warn('[AnomalyGalaxy] Bloom initialization safely bypassed:', err);
    }
  }, [gl, scene, camera, enabled, strength, radius, threshold]);

  useEffect(() => {
    if (composerRef.current) {
      composerRef.current.setSize(size.width, size.height);
    }
  }, [size]);

  useFrame((state) => {
    if (enabled && composerRef.current) {
      composerRef.current.render();
    } else {
      state.gl.render(state.scene, state.camera);
    }
  }, 1);

  return null;
};

// ============================================================================
// 3. INSTANCED MESH SCATTER SCENE (5,000 POINTS WITH GPU DISPOSAL)
// ============================================================================

interface ScatterSceneProps {
  points: GalaxyPoint[];
  onHoverPoint: (point: GalaxyPoint | null, screenPos?: { x: number; y: number }) => void;
  onSelectPoint: (point: GalaxyPoint) => void;
  hoveredPointId: string | null;
  categories: string[];
  reduceMotion: boolean;
}

const ScatterScene: React.FC<ScatterSceneProps> = ({
  points,
  onHoverPoint,
  onSelectPoint,
  hoveredPointId,
  categories,
  reduceMotion,
}) => {
  const normalMeshRef = useRef<THREE.InstancedMesh>(null!);
  const anomalyMeshRef = useRef<THREE.InstancedMesh>(null!);

  const { normalPoints, anomalyPoints } = useMemo(() => {
    const normal: GalaxyPoint[] = [];
    const anomaly: GalaxyPoint[] = [];

    points.forEach((p) => {
      if (p.isAnomaly) {
        anomaly.push(p);
      } else {
        normal.push(p);
      }
    });

    return { normalPoints: normal, anomalyPoints: anomaly };
  }, [points]);

  // Geometries & Shared Materials
  const normalSphereGeo = useMemo(() => new THREE.SphereGeometry(0.12, 10, 10), []);
  const anomalySphereGeo = useMemo(() => new THREE.SphereGeometry(0.28, 16, 16), []);

  const normalMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#38BDF8',
        emissive: '#FF9933',
        emissiveIntensity: 0.5,
        roughness: 0.35,
        metalness: 0.5,
      }),
    []
  );

  const anomalyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#EF4444',
        emissive: '#DC2626',
        emissiveIntensity: 1.8,
        roughness: 0.2,
        metalness: 0.4,
      }),
    []
  );

  // Clean up all GPU allocations on unmount
  useEffect(() => {
    return () => {
      normalSphereGeo.dispose();
      anomalySphereGeo.dispose();
      normalMaterial.dispose();
      anomalyMaterial.dispose();
    };
  }, [normalSphereGeo, anomalySphereGeo, normalMaterial, anomalyMaterial]);

  // Initialize Static Transformation Matrices for Normal Expenses
  useEffect(() => {
    if (!normalMeshRef.current || normalPoints.length === 0) return;
    const dummy = new THREE.Object3D();

    normalPoints.forEach((p, idx) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      normalMeshRef.current.setMatrixAt(idx, dummy.matrix);
    });

    normalMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [normalPoints]);

  // Dynamic Pulsing Animation for Anomaly Points (Paused if reduceMotion is active)
  useFrame((state) => {
    if (!anomalyMeshRef.current || anomalyPoints.length === 0) return;
    const t = state.clock.getElapsedTime();
    const dummy = new THREE.Object3D();

    anomalyPoints.forEach((p, idx) => {
      dummy.position.set(p.x, p.y, p.z);
      // Freeze pulse if reduced motion is requested
      const pulse = reduceMotion ? 1.0 : 1.0 + 0.25 * Math.sin(t * 3.5 + idx * 0.4);
      const isHovered = hoveredPointId === p.id;
      const hoverMultiplier = isHovered ? 1.6 : 1.0;
      const s = pulse * hoverMultiplier;

      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      anomalyMeshRef.current.setMatrixAt(idx, dummy.matrix);
    });

    anomalyMeshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* 1. Normal Expenses InstancedMesh */}
      {normalPoints.length > 0 && (
        <instancedMesh
          ref={normalMeshRef}
          args={[normalSphereGeo, normalMaterial, normalPoints.length]}
          onPointerMove={(e) => {
            e.stopPropagation();
            if (e.instanceId !== undefined && normalPoints[e.instanceId]) {
              onHoverPoint(normalPoints[e.instanceId], {
                x: e.clientX,
                y: e.clientY,
              });
            }
          }}
          onPointerOut={() => onHoverPoint(null)}
          onClick={(e) => {
            e.stopPropagation();
            if (e.instanceId !== undefined && normalPoints[e.instanceId]) {
              onSelectPoint(normalPoints[e.instanceId]);
            }
          }}
        />
      )}

      {/* 2. Anomaly Expenses InstancedMesh */}
      {anomalyPoints.length > 0 && (
        <instancedMesh
          ref={anomalyMeshRef}
          args={[anomalySphereGeo, anomalyMaterial, anomalyPoints.length]}
          onPointerMove={(e) => {
            e.stopPropagation();
            if (e.instanceId !== undefined && anomalyPoints[e.instanceId]) {
              onHoverPoint(anomalyPoints[e.instanceId], {
                x: e.clientX,
                y: e.clientY,
              });
            }
          }}
          onPointerOut={() => onHoverPoint(null)}
          onClick={(e) => {
            e.stopPropagation();
            if (e.instanceId !== undefined && anomalyPoints[e.instanceId]) {
              onSelectPoint(anomalyPoints[e.instanceId]);
            }
          }}
        />
      )}

      {/* 3. Spatial Reference Grids & Labels */}
      <gridHelper args={[30, 30, '#FF9933', '#0A0A0A']} position={[0, 0, 0]} />

      <lineSegments position={[-13, 5.5, -9]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, -5.5, 0, 0, 5.5, 0]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#38BDF8" transparent opacity={0.4} />
      </lineSegments>

      <Text
        position={[0, -0.2, 10.2]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.55}
        color="#64748B"
        anchorX="center"
        anchorY="middle"
      >
        TIMELINE &rarr; (EARLIEST TO LATEST)
      </Text>

      <Text
        position={[-13.5, 5.5, -9]}
        rotation={[0, Math.PI / 4, 0]}
        fontSize={0.5}
        color="#38BDF8"
        anchorX="right"
        anchorY="middle"
      >
        OUTLAY SPEND (&uarr;)
      </Text>

      {categories.map((cat, i) => {
        const totalCats = Math.max(1, categories.length - 1);
        const zPos = (i / totalCats - 0.5) * 17.5;
        return (
          <group key={cat} position={[13.5, 0.05, zPos]}>
            <Text
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.38}
              color="#475569"
              anchorX="left"
              anchorY="middle"
            >
              {cat.replace('_', ' ').toUpperCase()}
            </Text>
          </group>
        );
      })}

      {/* Cosmic Dust Starfield */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[
              new Float32Array(Array.from({ length: 400 * 3 }, () => (Math.random() - 0.5) * 60)),
              3,
            ]}
          />
        </bufferGeometry>
        <pointsMaterial size={0.06} color="#60A5FA" transparent opacity={0.35} />
      </points>
    </group>
  );
};

// ============================================================================
// 4. CONTROLLED ORBIT WITH CAMERA RESET & CONSTRAINTS
// ============================================================================

interface GalaxyControlsProps {
  autoRotate: boolean;
  resetSignal: number;
}

const GalaxyOrbit: React.FC<GalaxyControlsProps> = ({ autoRotate, resetSignal }) => {
  const controlsRef = useRef<any>(null!);
  const { camera } = useThree();

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.reset();
      camera.position.set(13.5, 11.5, 17.5);
      controlsRef.current.target.set(0, 4.0, 0);
      controlsRef.current.update();
    }
  }, [resetSignal, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      minDistance={6}
      maxDistance={45}
      minPolarAngle={Math.PI / 8}
      maxPolarAngle={Math.PI / 2 - 0.02}
      autoRotate={autoRotate}
      autoRotateSpeed={0.5}
      enableDamping={true}
      dampingFactor={0.05}
      target={[0, 4.0, 0]}
    />
  );
};

// ============================================================================
// 5. RECEIPT DETAIL INSPECTION MODAL (CLICKED POINT)
// ============================================================================

interface ReceiptModalProps {
  point: GalaxyPoint | null;
  onClose: () => void;
  currencyFormatter: (amt: number) => string;
}

const ReceiptDetailModal: React.FC<ReceiptModalProps> = ({ point, onClose, currencyFormatter }) => {
  const navigate = useNavigate();
  if (!point) return null;
  const item = point.original;

  const reasons = Array.isArray(item.risk_reasons)
    ? item.risk_reasons
    : typeof item.risk_reasons === 'string' && item.risk_reasons
      ? item.risk_reasons.split(';').map((s) => s.trim())
      : ['Audited statistical outlier detected by Isolation Forest engine'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-xl bg-dark-900 border border-white/15 rounded-3xl overflow-hidden shadow-2xl shadow-brand-500/10 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-dark-850/80">
          <div className="flex items-center gap-2.5">
            {item.is_anomaly ? (
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            )}
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{item.vendor || 'Unnamed Vendor'}</span>
                <AnomalyRiskBadge severity={item.risk_severity} />
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Receipt ID: {item.id} &bull; {item.date}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="p-4 rounded-2xl bg-dark-950/80 border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 uppercase tracking-wider block">
                Total Audited Outlay
              </span>
              <span className="text-2xl font-bold font-mono text-brand-300">
                {currencyFormatter(item.amount)}
              </span>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-400 uppercase tracking-wider block">
                Category
              </span>
              <span className="font-bold text-white capitalize">
                {item.category?.replace('_', ' ')}
              </span>
            </div>
          </div>

          {item.is_anomaly && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2.5">
              <div className="flex items-center gap-2 text-rose-300 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Forensic Anomaly Detection Audit</span>
              </div>

              <div className="space-y-1.5">
                {reasons.map((r, i) => (
                  <div
                    key={i}
                    className="text-xs text-rose-200/90 flex items-start gap-2 bg-rose-950/40 p-2.5 rounded-xl border border-rose-500/15"
                  >
                    <span className="font-bold text-rose-400 shrink-0">#{i + 1}:</span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-slate-300 font-mono">
                <span>Anomaly Risk Score:</span>
                <span className="font-bold text-rose-400">
                  {((item.anomaly_score ?? 0.85) * 100).toFixed(0)} / 100
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-dark-950/60 border border-white/5">
              <span className="text-[10px] text-slate-400 block uppercase">Tax / VAT</span>
              <span className="font-mono font-bold text-slate-200">
                {item.tax ? currencyFormatter(item.tax) : '₹0.00'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-dark-950/60 border border-white/5">
              <span className="text-[10px] text-slate-400 block uppercase">Payment Mode</span>
              <span className="font-semibold text-white">{item.payment_mode || 'UPI / Card'}</span>
            </div>

            <div className="p-3 rounded-xl bg-dark-950/60 border border-white/5">
              <span className="text-[10px] text-slate-400 block uppercase">OCR Quality</span>
              <span className="font-mono font-bold text-emerald-400">
                {item.ocr_confidence ? `${(item.ocr_confidence * 100).toFixed(1)}%` : '92.4%'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-dark-950/60 border border-white/5">
              <span className="text-[10px] text-slate-400 block uppercase">Status</span>
              <span className="font-semibold text-brand-300">
                {item.needs_review ? 'Needs Review' : 'Verified'}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/10 bg-dark-850/60 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            Close Window
          </button>

          <button
            onClick={() => {
              onClose();
              navigate('/review-queue');
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-lg shadow-brand-500/20 transition-all active:scale-95"
          >
            <span>Review & Correct Label</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============================================================================
// 6. MAIN ANOMALY GALAXY COMPONENT (WITH ACCESSIBILITY & LOW-END DETECTION)
// ============================================================================

export interface AnomalyGalaxyProps {
  height?: number | string;
  className?: string;
  title?: string;
}

export const AnomalyGalaxy: React.FC<AnomalyGalaxyProps> = ({
  height = 540,
  className,
  title = 'Forensic Anomaly Galaxy (3D Scatter Matrix)',
}) => {
  const { format, currency } = useCurrency();
  const { reduceMotion } = useMotionMode();

  // 1. Fetch live 5,000 expenses
  const { data: rawExpenses, isLoading } = useExpenses({ limit: 5000 });

  // 2. Hardware Capability Detection (Disables Bloom on <= 4 cores or Mobile)
  const deviceCaps = useMemo(() => detectDeviceCapabilities(), []);

  // 3. Performance & Visibility Hooks
  const { containerRef, isVisible, frameloop } = useCanvasVisibility(0.05, reduceMotion);

  // 4. Interactive HUD States
  const [bloomEnabled, setBloomEnabled] = useState<boolean>(
    () => deviceCaps.recommendBloom && !reduceMotion
  );
  const [autoRotate, setAutoRotate] = useState<boolean>(() => !reduceMotion);
  const [resetSignal, setResetSignal] = useState<number>(0);
  const [filterMode, setFilterMode] = useState<'ALL' | 'ANOMALIES_ONLY'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 5. Selection & Hover States
  const [hoveredPoint, setHoveredPoint] = useState<GalaxyPoint | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<GalaxyPoint | null>(null);

  // Auto-disable bloom when reduced motion activates
  useEffect(() => {
    if (reduceMotion) {
      setBloomEnabled(false);
      setAutoRotate(false);
    }
  }, [reduceMotion]);

  // 6. Compute Coordinate Bounds & Categories
  const bounds = useMemo<CoordinateBounds>(() => {
    if (!rawExpenses || rawExpenses.length === 0) {
      return {
        minTimestamp: new Date('2024-01-01').getTime(),
        maxTimestamp: new Date('2024-12-31').getTime(),
        maxSpend: 50000,
        categories: ['meals', 'travel', 'software', 'supplies', 'utilities', 'misc'],
      };
    }

    let minTs = Infinity;
    let maxTs = -Infinity;
    let maxSpend = 0;
    const catSet = new Set<string>();

    rawExpenses.forEach((exp) => {
      if (exp.date) {
        const ts = new Date(exp.date).getTime();
        if (!isNaN(ts)) {
          if (ts < minTs) minTs = ts;
          if (ts > maxTs) maxTs = ts;
        }
      }
      if (exp.amount && exp.amount > maxSpend) {
        maxSpend = exp.amount;
      }
      if (exp.category) {
        catSet.add(exp.category.toLowerCase());
      }
    });

    if (minTs === Infinity) minTs = new Date('2024-01-01').getTime();
    if (maxTs === -Infinity) maxTs = new Date('2024-12-31').getTime();
    if (minTs === maxTs) maxTs = minTs + 86400000 * 30;

    return {
      minTimestamp: minTs,
      maxTimestamp: maxTs,
      maxSpend: Math.max(1000, maxSpend),
      categories: Array.from(catSet).sort(),
    };
  }, [rawExpenses]);

  // 7. Generate 3D Points List with Filtering
  const galaxyPoints = useMemo<GalaxyPoint[]>(() => {
    if (!rawExpenses) return [];

    let filtered = rawExpenses;

    if (filterMode === 'ANOMALIES_ONLY') {
      filtered = filtered.filter((e) => e.is_anomaly);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.vendor?.toLowerCase().includes(q) ||
          e.category?.toLowerCase().includes(q) ||
          e.id?.toLowerCase().includes(q)
      );
    }

    return filtered.map((item, idx) => calculateCoordinates(item, bounds, idx));
  }, [rawExpenses, bounds, filterMode, searchQuery]);

  const anomalyCount = useMemo(() => {
    return galaxyPoints.filter((p) => p.isAnomaly).length;
  }, [galaxyPoints]);

  return (
    <Card
      variant="glass"
      padding="none"
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/[0.08] shadow-glass bg-dark-900/90',
        className
      )}
      role="region"
      aria-label="Forensic Anomaly Galaxy 3D Scatter Matrix"
    >
      {/* Accessible Screen Reader Summary */}
      <Accessible3DSummary
        title={title}
        summary={`3D Scatter Matrix visualizing ${galaxyPoints.length} expenses across Date, Outlay Amount, and Category. A total of ${anomalyCount} anomalies are flagged by the Isolation Forest engine.`}
        details={[
          { label: 'Total Plotted Nodes', value: galaxyPoints.length },
          { label: 'Flagged Anomalies', value: anomalyCount },
          { label: 'Categories Plotted', value: bounds.categories.join(', ') },
        ]}
      />

      {/* ===================================================================== */}
      {/* 1. TOP HUD HEADER & CONTROLS                                         */}
      {/* ===================================================================== */}
      <div className="px-5 py-3.5 border-b border-white/[0.08] bg-dark-850/80 backdrop-blur-md flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 block" />
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 absolute inset-0 animate-ping opacity-75" />
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <span>{title}</span>
              <StatusBadge
                label={`${galaxyPoints.length.toLocaleString()} 3D Nodes`}
                variant="brand"
              />
              {deviceCaps.isLowEnd && (
                <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                  Low-End GPU Profile
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              X: Date &bull; Y: Outlay Amount &bull; Z: Category Spectrum
            </p>
          </div>
        </div>

        {/* HUD Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search vendor / id..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-36 sm:w-44 bg-dark-900 border border-white/10 rounded-xl pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center p-1 rounded-xl bg-dark-900 border border-white/10 text-xs font-bold">
            <button
              onClick={() => setFilterMode('ALL')}
              className={cn(
                'px-2.5 py-1 rounded-lg transition-all text-xs',
                filterMode === 'ALL'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilterMode('ANOMALIES_ONLY')}
              className={cn(
                'px-2.5 py-1 rounded-lg transition-all text-xs flex items-center gap-1',
                filterMode === 'ANOMALIES_ONLY'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-rose-300'
              )}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Anomalies ({anomalyCount})</span>
            </button>
          </div>

          <button
            onClick={() => setBloomEnabled(!bloomEnabled)}
            className={cn(
              'px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5',
              bloomEnabled
                ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                : 'bg-dark-900 border-white/10 text-slate-400 hover:text-white'
            )}
            title={
              deviceCaps.isLowEnd
                ? 'Bloom is disabled for device performance'
                : 'Toggle UnrealBloom Post-Processing Glow'
            }
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bloom</span>
          </button>

          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={cn(
              'p-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center',
              autoRotate
                ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                : 'bg-dark-900 border-white/10 text-slate-400 hover:text-white'
            )}
            title={autoRotate ? 'Pause Orbit Rotation' : 'Resume Orbit Rotation'}
          >
            {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setResetSignal((s) => s + 1)}
            className="p-2 rounded-xl bg-dark-900 border border-white/10 text-slate-400 hover:text-white transition-all"
            title="Reset Perspective"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. MAIN 3D R3F CANVAS STAGE (WITH CAPPED DPR & OFF-SCREEN PAUSING)   */}
      {/* ===================================================================== */}
      <div
        ref={containerRef}
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
        className="relative w-full bg-gradient-to-b from-dark-950 via-[#060A14] to-dark-950 overflow-hidden"
      >
        {isLoading ? (
          <ThreeSkeletonLoader
            height={height}
            label="Plotting 5,000 Multi-Dimensional Financial Nodes..."
          />
        ) : (
          <Suspense
            fallback={
              <ThreeSkeletonLoader height={height} label="Initializing 3D Instanced Mesh..." />
            }
          >
            <Canvas
              frameloop={frameloop} // 'always' when visible, 'demand' if reduced motion, 'never' when off-screen
              dpr={PERF_DPR} // Capped at 1.5 to protect GPU fill-rate
              camera={{ position: [13.5, 11.5, 17.5], fov: 42 }}
              gl={{
                antialias: true,
                alpha: true,
                powerPreference: 'high-performance',
              }}
            >
              <ambientLight intensity={0.5} />
              <directionalLight position={[10, 20, 10]} intensity={1.1} />
              <pointLight position={[-10, 10, -10]} intensity={0.6} color="#38BDF8" />

              <GalaxyOrbit autoRotate={autoRotate} resetSignal={resetSignal} />

              <ScatterScene
                points={galaxyPoints}
                onHoverPoint={(p) => setHoveredPoint(p)}
                onSelectPoint={(p) => setSelectedPoint(p)}
                hoveredPointId={hoveredPoint?.id || null}
                categories={bounds.categories}
                reduceMotion={reduceMotion}
              />

              <BloomEffect enabled={bloomEnabled} />
            </Canvas>
          </Suspense>
        )}

        {/* Floating Quick Tooltip on Hover */}
        <AnimatePresence>
          {hoveredPoint && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              className="absolute top-4 right-4 z-40 w-64 p-3.5 rounded-2xl bg-dark-950/95 backdrop-blur-xl border border-white/20 shadow-2xl pointer-events-none text-xs text-white"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'w-2.5 h-2.5 rounded-full shrink-0',
                      hoveredPoint.isAnomaly
                        ? 'bg-rose-500 shadow-sm shadow-rose-500/80 animate-ping'
                        : 'bg-sky-400'
                    )}
                  />
                  <span className="font-bold text-white truncate">
                    {hoveredPoint.original.vendor || 'Unknown Vendor'}
                  </span>
                </div>
                <AnomalyRiskBadge severity={hoveredPoint.original.risk_severity} />
              </div>

              <div className="space-y-1 font-mono text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans">Amount:</span>
                  <span className="font-bold text-brand-300">
                    {format(hoveredPoint.original.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans">Date:</span>
                  <span className="text-slate-200">{hoveredPoint.original.date}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans">Category:</span>
                  <span className="text-slate-200 capitalize">
                    {hoveredPoint.original.category}
                  </span>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-white/[0.08] text-[10px] text-brand-400 font-semibold flex items-center gap-1">
                <Eye className="w-3 h-3" />
                <span>Click node to inspect forensic receipt audit</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ===================================================================== */}
      {/* 3. BOTTOM LEGEND BAR & INTERACTION GUIDANCE                           */}
      {/* ===================================================================== */}
      <div className="px-5 py-3 border-t border-white/[0.08] bg-dark-950/80 flex items-center justify-between flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-sm" />
            <span className="text-slate-300 font-medium">Standard Audited Spend</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-md shadow-rose-500/50 animate-pulse" />
            <span className="text-rose-300 font-bold">Flagged Anomaly Forensics (Pulsing)</span>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <span className="font-mono text-brand-300 font-bold">{anomalyCount}</span>
            <span>of {galaxyPoints.length} flagged</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 flex items-center gap-2">
          <Compass className="w-3.5 h-3.5 text-slate-400" />
          <span>
            Left Drag: Orbit &bull; Right Drag: Pan &bull; Scroll: Zoom &bull; Click: Audit
          </span>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. CLICKED RECEIPT FORENSIC INSPECTION MODAL                          */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {selectedPoint && (
          <ReceiptDetailModal
            point={selectedPoint}
            onClose={() => setSelectedPoint(null)}
            currencyFormatter={(v) => format(v)}
          />
        )}
      </AnimatePresence>
    </Card>
  );
};

export default AnomalyGalaxy;
