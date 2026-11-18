import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';

interface GlassRingProps {
  pointer?: { x: number; y: number };
  scale?: number;
  glowIntensity?: number;
}

export const GlassRing: React.FC<GlassRingProps> = ({ scale = 1, glowIntensity = 1 }) => {
  const outerRingRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const spokesRef = useRef<THREE.Group>(null);

  // 24 slim spokes inside the ring (Ashoka Chakra 24-spoke motif)
  const spokes = useMemo(() => {
    const list = [];
    const count = 24;
    const innerR = 0.55;
    const outerR = 2.1;
    for (let i = 0; i < count; i++) {
      const angle = (i * Math.PI * 2) / count;
      list.push({ angle, innerR, outerR });
    }
    return list;
  }, []);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    if (outerRingRef.current) {
      // Slow meditative idle rotation
      outerRingRef.current.rotation.z = time * 0.12;
      outerRingRef.current.rotation.x = Math.sin(time * 0.25) * 0.08 + (state.pointer.y * 0.15);
      outerRingRef.current.rotation.y = Math.cos(time * 0.25) * 0.08 + (state.pointer.x * 0.15);
    }

    if (coreRef.current) {
      // Diya-like breathing pulsation
      const pulse = 1 + Math.sin(time * 1.8) * 0.08;
      coreRef.current.scale.set(pulse, pulse, pulse);
    }

    if (spokesRef.current) {
      spokesRef.current.rotation.z = -time * 0.06;
    }
  });

  return (
    <group scale={scale}>
      {/* Central Glowing Diya Core (Saffron & Antique Gold) */}
      <mesh ref={coreRef} position={[0, 0, -0.1]}>
        <sphereGeometry args={[0.45, 32, 32]} />
        <meshBasicMaterial color="#FF9933" />
      </mesh>

      {/* Point light for warm saffron/gold aura */}
      <pointLight position={[0, 0, 0.5]} color="#FF9933" intensity={2.5 * glowIntensity} distance={8} />
      <pointLight position={[0, 0, -0.5]} color="#D4A017" intensity={1.8 * glowIntensity} distance={6} />

      {/* 24 Slim Chakra Spokes */}
      <group ref={spokesRef}>
        {spokes.map((spoke, idx) => (
          <mesh
            key={idx}
            rotation={[0, 0, spoke.angle]}
            position={[0, 0, 0]}
          >
            <cylinderGeometry args={[0.008, 0.012, 1.55, 8]} />
            <meshStandardMaterial
              color="#D4A017"
              emissive="#FF9933"
              emissiveIntensity={0.3}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
        ))}
      </group>

      {/* Signature Glassy / Refractive Outer Ring */}
      <group ref={outerRingRef}>
        <mesh>
          <torusGeometry args={[2.2, 0.28, 32, 100]} />
          <MeshTransmissionMaterial
            backside
            samples={4}
            thickness={0.5}
            chromaticAberration={0.06}
            anisotropy={0.1}
            distortion={0.15}
            distortionScale={0.3}
            temporalDistortion={0.1}
            iridescence={0.25}
            roughness={0.1}
            color="#FFF4E0"
          />
        </mesh>

        {/* Delicate Golden Inner Rim */}
        <mesh>
          <torusGeometry args={[1.92, 0.02, 16, 64]} />
          <meshStandardMaterial color="#D4A017" metalness={0.9} roughness={0.1} />
        </mesh>
      </group>
    </group>
  );
};

export default GlassRing;
