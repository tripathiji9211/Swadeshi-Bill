import React, { useRef, useState, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Html, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useMotionMode } from '@/hooks/useMotionMode';
import {
  useCanvasVisibility,
  PERF_DPR,
  Accessible3DSummary,
  ThreeSkeletonLoader,
} from './threeUtils';
import { ThreeErrorBoundary } from './ThreeErrorBoundary';
import { Card } from '@/components/ui/Card';
import { StatusBadge, AnomalyRiskBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';
import { ShieldAlert, AlertTriangle, ShieldCheck, Gauge, RotateCw } from 'lucide-react';

// ============================================================================
// 1. 3D NEEDLE COMPONENT WITH SMOOTH DAMPING
// ============================================================================

interface GaugeNeedleProps {
  targetAngle: number;
}

const GaugeNeedle: React.FC<GaugeNeedleProps> = ({ targetAngle }) => {
  const needleGroupRef = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    if (needleGroupRef.current) {
      needleGroupRef.current.rotation.z = THREE.MathUtils.damp(
        needleGroupRef.current.rotation.z,
        targetAngle,
        4.5,
        delta
      );
    }
  });

  return (
    <group ref={needleGroupRef} position={[0, 0, 0.15]}>
      {/* Central Pivot Hub Cap */}
      <mesh castShadow>
        <cylinderGeometry args={[0.3, 0.35, 0.18, 32]} />
        <meshStandardMaterial color="#0A0A0A" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Hub Glowing Accent Ring */}
      <mesh position={[0, 0, 0.1]}>
        <ringGeometry args={[0.15, 0.25, 32]} />
        <meshBasicMaterial color="#38BDF8" side={THREE.DoubleSide} />
      </mesh>

      {/* Tapered 3D Needle Pointer */}
      <group position={[0, 1.1, 0]}>
        <mesh castShadow>
          <coneGeometry args={[0.1, 2.2, 4]} />
          <meshStandardMaterial
            color="#EF4444"
            emissive="#DC2626"
            emissiveIntensity={0.8}
            metalness={0.5}
            roughness={0.2}
          />
        </mesh>
      </group>
    </group>
  );
};

// ============================================================================
// 2. 3D SEMI-CIRCULAR GAUGE DIAL ARC
// ============================================================================

interface GaugeDialArcProps {
  score: number; // 0 to 100
}

const GaugeDialArc: React.FC<GaugeDialArcProps> = ({ score }) => {
  const ringRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ringRef.current) {
      // Subtle ambient pulsation when risk is elevated
      if (score > 50) {
        ringRef.current.scale.setScalar(1 + Math.sin(t * 4) * 0.02);
      }
    }
  });

  // Dial arc segments: Green (0-35), Amber (35-70), Red (70-100)
  const segments = useMemo(() => {
    // Semi-circle spans from PI to 0 (or -PI/2 to PI/2)
    return [
      { start: Math.PI, end: Math.PI * 0.65, color: '#10B981', label: 'SAFE' },
      { start: Math.PI * 0.65, end: Math.PI * 0.35, color: '#F59E0B', label: 'ELEVATED' },
      { start: Math.PI * 0.35, end: 0, color: '#EF4444', label: 'CRITICAL' },
    ];
  }, []);

  // Memoize geometries and clean up GPU buffers on unmount
  const arcGeometries = useMemo(() => {
    return segments.map((seg) => {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, 2.65, seg.start, seg.end, true);
      shape.absarc(0, 0, 2.2, seg.end, seg.start, false);
      shape.closePath();

      return new THREE.ExtrudeGeometry(shape, {
        depth: 0.12,
        bevelEnabled: true,
        bevelSegments: 2,
        bevelSize: 0.02,
        bevelThickness: 0.02,
      });
    });
  }, [segments]);

  useEffect(() => {
    return () => {
      arcGeometries.forEach((g) => g.dispose());
    };
  }, [arcGeometries]);

  return (
    <group position={[0, -0.2, 0]}>
      {/* Outer Protective Bezel Ring */}
      <mesh ref={ringRef} rotation={[0, 0, 0]}>
        <ringGeometry args={[2.7, 2.9, 64]} />
        <meshStandardMaterial color="#161618" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Dial Sector Arc Segments */}
      {segments.map((seg, i) => {
        return (
          <mesh key={i} geometry={arcGeometries[i]} position={[0, 0, 0]}>
            <meshStandardMaterial
              color={seg.color}
              emissive={seg.color}
              emissiveIntensity={0.35}
              metalness={0.3}
              roughness={0.25}
            />
          </mesh>
        );
      })}

      {/* Major Tick Marks */}
      {[0, 25, 50, 75, 100].map((val) => {
        const angle = Math.PI - (val / 100) * Math.PI;
        const x = Math.cos(angle) * 2.0;
        const y = Math.sin(angle) * 2.0;
        return (
          <group key={val} position={[x, y, 0.1]}>
            <Text fontSize={0.22} color="#94A3B8" anchorX="center" anchorY="middle">
              {val}%
            </Text>
          </group>
        );
      })}
    </group>
  );
};

// ============================================================================
// 3. MAIN 3D ANOMALY GAUGE SCENE
// ============================================================================

export interface AnomalyGauge3DProps {
  score?: number; // 0 to 100
  height?: number | string;
  className?: string;
  title?: string;
  subtext?: string;
}

export const AnomalyGauge3D: React.FC<AnomalyGauge3DProps> = ({
  score = 78,
  height = 340,
  className,
  title = 'Forensic Anomaly Risk Engine',
  subtext = 'Dynamic Isolation Forest & Z-Score Probability',
}) => {
  const { reduceMotion } = useMotionMode();
  const { containerRef, isVisible, frameloop } = useCanvasVisibility(0.05, reduceMotion);
  const clampedScore = Math.max(0, Math.min(100, score));

  // Compute needle angle: 0% -> PI/2 (left), 100% -> -PI/2 (right)
  const targetNeedleAngle = Math.PI / 2 - (clampedScore / 100) * Math.PI;

  const severity = useMemo(() => {
    if (clampedScore >= 75) return 'CRITICAL';
    if (clampedScore >= 50) return 'HIGH';
    if (clampedScore >= 25) return 'MEDIUM';
    return 'LOW';
  }, [clampedScore]);

  return (
    <Card
      variant="glass"
      padding="none"
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/[0.08] shadow-glass bg-dark-900/90',
        className
      )}
      role="region"
      aria-label="3D Anomaly Risk Dial Gauge"
    >
      {/* Screen Reader Accessible Summary */}
      <Accessible3DSummary
        title={title}
        summary={`3D Anomaly Gauge indicating a risk level of ${clampedScore.toFixed(0)}%, classified as ${severity} risk severity.`}
        details={[
          { label: 'Risk Score', value: `${clampedScore.toFixed(0)}%` },
          { label: 'Risk Severity', value: severity },
          { label: 'Safety Threshold', value: '0-35% Safe, 35-70% Elevated, 70-100% Critical' },
        ]}
      />

      {/* Header */}
      <div className="px-5 py-3 border-b border-white/[0.08] bg-dark-850/80 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Gauge className="w-4 h-4 text-brand-400" />
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">{title}</h3>
            <p className="text-[10px] text-slate-400">{subtext}</p>
          </div>
        </div>

        <AnomalyRiskBadge severity={severity} />
      </div>

      {/* 3D Gauge Canvas */}
      <div
        ref={containerRef}
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
        className="relative w-full bg-gradient-to-b from-dark-950 via-[#090D1A] to-dark-950 overflow-hidden"
      >
        <ThreeErrorBoundary title="3D Anomaly Gauge Fallback">
          <Suspense fallback={<ThreeSkeletonLoader height={height} label="Mounting 3D Gauge..." />}>
            <Canvas
              frameloop={frameloop} // 'always' when active, 'demand' when reduced motion, 'never' when off-screen
              dpr={PERF_DPR} // Cap DPR
              camera={{ position: [0, 0.4, 5.2], fov: 42 }}
              gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            >
              <ambientLight intensity={0.7} />
              <directionalLight position={[5, 8, 5]} intensity={1.3} />
              <pointLight position={[-4, 3, 3]} intensity={0.7} color="#38BDF8" />
              <pointLight position={[4, -2, 2]} intensity={0.5} color="#EF4444" />

              <Float speed={1.5} rotationIntensity={0.15} floatIntensity={0.25}>
                <group position={[0, -0.3, 0]}>
                  {/* 3D Dial Ring */}
                  <GaugeDialArc score={clampedScore} />

                  {/* Rotating Needle */}
                  <GaugeNeedle targetAngle={targetNeedleAngle} />

                  {/* Floating Central Score Readout */}
                  <Html
                    position={[0, -0.85, 0.3]}
                    center
                    className="pointer-events-none select-none"
                  >
                    <div className="p-3 rounded-2xl bg-dark-950/90 border border-white/10 backdrop-blur-md text-center shadow-2xl min-w-[130px]">
                      <span className="text-2xl font-bold font-mono text-white block">
                        {clampedScore.toFixed(0)}%
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-bold uppercase tracking-wider block',
                          severity === 'CRITICAL' || severity === 'HIGH'
                            ? 'text-rose-400'
                            : severity === 'MEDIUM'
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                        )}
                      >
                        {severity} RISK
                      </span>
                    </div>
                  </Html>
                </group>
              </Float>
            </Canvas>
          </Suspense>
        </ThreeErrorBoundary>

        {/* Ambient Gauge HUD Marker */}
        <div className="absolute bottom-3 left-4 text-[10px] text-slate-500 bg-dark-950/80 px-2 py-0.5 rounded-lg border border-white/5 pointer-events-none">
          <span>Realtime Anomaly Weighting</span>
        </div>
      </div>
    </Card>
  );
};

export default AnomalyGauge3D;
