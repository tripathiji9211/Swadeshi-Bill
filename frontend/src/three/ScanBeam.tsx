import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

export interface ScanBeamProps {
  stage?: number; // 1: OCR, 2: Parse, 3: Classify, 4: Anomaly
  isScanning?: boolean;
}

export const ScanBeam: React.FC<ScanBeamProps> = ({ stage = 1, isScanning = true }) => {
  const laserRef = useRef<THREE.Mesh>(null);
  const billGroupRef = useRef<THREE.Group>(null);

  // Colors synced to real forensic pipeline stages:
  // Stage 1 (OCR): Saffron #FF9933
  // Stage 2 (Parse): Antique Gold #D4A017
  // Stage 3 (Classify): India Green #138808
  // Stage 4 (Anomaly Gating): Kumkum Red #B3202A / Saffron
  const beamColor =
    stage === 1
      ? '#FF9933'
      : stage === 2
        ? '#D4A017'
        : stage === 3
          ? '#138808'
          : '#B3202A';

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (laserRef.current && isScanning) {
      // Moves back and forth along the vertical height of the bill (-1.2 to +1.2)
      laserRef.current.position.y = Math.sin(time * 3.5) * 1.15;
    }

    if (billGroupRef.current) {
      billGroupRef.current.rotation.y = Math.sin(time * 0.5) * 0.08;
      billGroupRef.current.rotation.x = Math.cos(time * 0.4) * 0.05;
    }
  });

  return (
    <group position={[0, 0, 0]} ref={billGroupRef}>
      {/* 3D Kirana Thermal Paper Bill */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[1.8, 2.6]} />
        <meshStandardMaterial
          color="#F9F6F0"
          roughness={0.9}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Bill Header Strip (Red Khata Accent) */}
      <mesh position={[0, 1.15, 0.01]}>
        <planeGeometry args={[1.7, 0.22]} />
        <meshStandardMaterial color="#B3202A" roughness={0.7} />
      </mesh>

      {/* Simulated Bill Line Item Rows */}
      {[-0.8, -0.5, -0.2, 0.1, 0.4, 0.7].map((y, idx) => (
        <mesh key={idx} position={[0, y, 0.01]}>
          <planeGeometry args={[1.5, 0.08]} />
          <meshBasicMaterial color="#333333" opacity={0.65} transparent />
        </mesh>
      ))}

      {/* Moving Forensic Laser Scan Line */}
      <mesh ref={laserRef} position={[0, 0, 0.03]}>
        <planeGeometry args={[2.0, 0.04]} />
        <meshBasicMaterial color={beamColor} />
      </mesh>

      {/* Laser Light Point */}
      <pointLight position={[0, 0, 0.3]} color={beamColor} intensity={2.0} distance={4} />
    </group>
  );
};

export default ScanBeam;
