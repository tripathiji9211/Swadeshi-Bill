import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';

/**
 * Performance DPR (Device Pixel Ratio) bounds.
 * Caps maximum DPR at 1.5 to protect GPU fill-rate on high-DPI / Retina screens.
 */
export const PERF_DPR: [number, number] = [1, 1.5];

/**
 * Low-end hardware and device capability detector.
 * Identifies mobile processors, low RAM, software rasterizers, and <= 4 CPU cores
 * to gracefully disable expensive post-processing bloom shaders.
 */
export interface DeviceCapabilities {
  isLowEnd: boolean;
  recommendBloom: boolean;
  cores: number;
  memoryGB: number;
  isMobile: boolean;
  gpuRenderer: string;
}

export function detectDeviceCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined') {
    return {
      isLowEnd: false,
      recommendBloom: true,
      cores: 8,
      memoryGB: 8,
      isMobile: false,
      gpuRenderer: 'unknown',
    };
  }

  // 1. CPU Concurrency (Hardware threads)
  const cores = navigator.hardwareConcurrency || 4;

  // 2. RAM capacity (Chrome/Edge deviceMemory API in GB)
  const memoryGB = (navigator as any).deviceMemory || 8;

  // 3. Mobile Device User Agent Check
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  // 4. Inspect GPU Renderer Info via throwaway WebGL context
  let gpuRenderer = 'Standard GPU';
  let isSoftwareRasterizer = false;

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        gpuRenderer =
          (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
        // Check for software rasterizers or notoriously underpowered chips
        const lowGpuKeywords = [
          'swiftshader',
          'llvmpipe',
          'software rasterizer',
          'intel hd graphics 3000',
          'intel hd graphics 4000',
          'adreno 3',
          'adreno 4',
          'mali-4',
          'mali-t',
        ];
        const lowerName = gpuRenderer.toLowerCase();
        isSoftwareRasterizer = lowGpuKeywords.some((k) => lowerName.includes(k));
      }
    }
  } catch {
    // Ignore context errors
  }

  // Low-end classification rule:
  // <= 4 cores OR <= 4 GB RAM OR mobile OR software rasterizer
  const isLowEnd = cores <= 4 || memoryGB <= 4 || isMobile || isSoftwareRasterizer;
  const recommendBloom = !isLowEnd;

  return {
    isLowEnd,
    recommendBloom,
    cores,
    memoryGB,
    isMobile,
    gpuRenderer,
  };
}

/**
 * Hook to pause Three.js / R3F render loops when the canvas is scrolled off-screen
 * or when the user prefers reduced motion.
 */
export function useCanvasVisibility(threshold = 0.05, reduceMotion = false) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState<boolean>(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  // Frameloop decision:
  // 1. Off-screen -> 'never' (0% GPU)
  // 2. Reduce motion active -> 'demand' (renders once or on user interaction)
  // 3. Normal in-viewport -> 'always'
  const frameloop: 'always' | 'demand' | 'never' = !isVisible
    ? 'never'
    : reduceMotion
      ? 'demand'
      : 'always';

  return { containerRef, isVisible, frameloop };
}

/**
 * Safely traverses and disposes of all geometries, materials, and textures in a Three.js Object3D tree.
 * Call this in unmount effects to prevent GPU buffer leaks.
 */
export function disposeThreeObject(obj: THREE.Object3D | null) {
  if (!obj) return;

  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => {
            disposeMaterial(mat);
          });
        } else {
          disposeMaterial(mesh.material);
        }
      }
    }
  });
}

function disposeMaterial(mat: THREE.Material) {
  mat.dispose();
  // Dispose maps if any
  const mapProps = [
    'map',
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'emissiveMap',
    'alphaMap',
    'envMap',
  ];
  mapProps.forEach((prop) => {
    const texture = (mat as any)[prop];
    if (texture && typeof texture.dispose === 'function') {
      texture.dispose();
    }
  });
}

/**
 * Screen Reader Accessible 3D Summary Container.
 * Renders an accessible live region that describes 3D visualization metrics
 * for users relying on screen readers or assistive technologies.
 */
export const Accessible3DSummary: React.FC<{
  title: string;
  summary: string;
  details?: { label: string; value: string | number }[];
}> = ({ title, summary, details }) => {
  return (
    <div className="sr-only" role="region" aria-label={title} tabIndex={0}>
      <h4>{title}</h4>
      <p>{summary}</p>
      {details && details.length > 0 && (
        <table>
          <caption>Data summary for {title}</caption>
          <thead>
            <tr>
              <th scope="col">Dimension</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {details.map((d, i) => (
              <tr key={i}>
                <td>{d.label}</td>
                <td>{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

/**
 * Glassmorphic Skeleton Loader fallback for Suspense boundaries.
 */
export const ThreeSkeletonLoader: React.FC<{
  height?: number | string;
  label?: string;
  className?: string;
}> = ({ height = 280, label = 'Mounting 3D Canvas Stage...', className }) => {
  return (
    <div
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
      className={`w-full rounded-2xl bg-dark-900/80 border border-white/[0.08] flex flex-col items-center justify-center p-6 text-slate-400 gap-3 backdrop-blur-md relative overflow-hidden ${
        className || ''
      }`}
    >
      {/* Background Subtle Tech Grid */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(59, 130, 246, 0.45) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      {/* Animated Glowing Ring Spinner */}
      <div className="relative">
        <div className="w-8 h-8 border-2 border-brand-500/20 border-t-brand-400 rounded-full animate-spin" />
        <div className="w-8 h-8 border-2 border-sky-400/30 rounded-full absolute inset-0 animate-ping opacity-40" />
      </div>

      <div className="text-center space-y-1 z-10">
        <p className="text-xs font-mono font-medium text-slate-300">{label}</p>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
          Shader compilation &bull; Asset allocation
        </p>
      </div>
    </div>
  );
};
