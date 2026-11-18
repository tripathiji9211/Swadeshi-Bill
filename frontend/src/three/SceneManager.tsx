import React, { Suspense, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMotionMode } from '@/hooks/useMotionMode';
import { detectDeviceCapabilities, PERF_DPR } from './threeUtils';
import { LiteBackground } from './LiteBackground';
import { GlassRing } from './GlassRing';
import { ScanBeam } from './ScanBeam';
import { AiOrb } from './AiOrb';
import { ForecastRibbon3D } from './ForecastRibbon3D';
import { PipelineNodes3D } from './PipelineNodes3D';

// Camera controller that smoothly animates between route portals
function RouteCameraController({ pathname }: { pathname: string }) {
  useFrame((state) => {
    let targetX = 0;
    let targetY = 0;
    let targetZ = 5.5;

    if (pathname === '/') {
      targetX = 0;
      targetY = 0;
      targetZ = 5.2;
    } else if (pathname.startsWith('/auth')) {
      targetX = 0;
      targetY = 0.2;
      targetZ = 4.8;
    } else if (pathname.startsWith('/upload')) {
      targetX = 0;
      targetY = 0;
      targetZ = 5.0;
    } else if (pathname.startsWith('/review')) {
      targetX = 0;
      targetY = 0;
      targetZ = 4.5;
    } else if (pathname.startsWith('/forecast')) {
      targetX = 0;
      targetY = 0;
      targetZ = 5.2;
    } else if (pathname.startsWith('/ask')) {
      targetX = 0;
      targetY = 0;
      targetZ = 4.6;
    } else if (pathname.startsWith('/about')) {
      targetX = 0;
      targetY = 0;
      targetZ = 6.0;
    }

    // Smooth glide lerp
    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, targetX, 0.05);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, targetY, 0.05);
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetZ, 0.05);
    state.camera.lookAt(0, 0, 0);
  });

  return null;
}

export const SceneManager: React.FC = () => {
  const location = useLocation();
  const { reduceMotion } = useMotionMode();
  const [hasWebGlError, setHasWebGlError] = useState(false);
  const [isLowEnd, setIsLowEnd] = useState(false);

  useEffect(() => {
    const caps = detectDeviceCapabilities();
    if (caps.isLowEnd) {
      setIsLowEnd(true);
    }
  }, []);

  const path = location.pathname;

  // Use LiteBackground if reduceMotion or low-end device or WebGL failure
  if (reduceMotion || isLowEnd || hasWebGlError) {
    return <LiteBackground />;
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#000000]"
      aria-hidden="true"
    >
      <Suspense fallback={<LiteBackground />}>
        <Canvas
          dpr={PERF_DPR}
          camera={{ position: [0, 0, 5.2], fov: 45 }}
          gl={{
            antialias: false,
            alpha: true,
            powerPreference: 'high-performance',
          }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 1);
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              setHasWebGlError(true);
            });
          }}
        >
          <RouteCameraController pathname={path} />

          {/* Meditative Soft Black Fog */}
          <fog attach="fog" args={['#000000', 4, 12]} />

          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} color="#FFF5EA" />
          <pointLight position={[-5, -5, -2]} intensity={0.4} color="#FF9933" />

          {/* Dynamic Route 3D Object Switcher (Real data, process state, or brand centerpiece only) */}
          {path === '/' && (
            <group position={[0, 0, 0]}>
              <GlassRing scale={0.9} />
            </group>
          )}

          {path.startsWith('/auth') && (
            <group position={[0, 0, 0]}>
              <GlassRing scale={1.05} glowIntensity={1.4} />
            </group>
          )}

          {path.startsWith('/upload') && (
            <group position={[0, 0, 0]}>
              <ScanBeam isScanning stage={1} />
            </group>
          )}

          {path.startsWith('/forecast') && (
            <group position={[0, 0, 0]}>
              <ForecastRibbon3D />
            </group>
          )}

          {path.startsWith('/ask') && (
            <group position={[0, 0, 0]}>
              <AiOrb isThinking={false} />
            </group>
          )}

          {path.startsWith('/about') && (
            <group position={[0, 0, 0]}>
              <PipelineNodes3D />
            </group>
          )}
        </Canvas>
      </Suspense>
    </div>
  );
};

export default SceneManager;
