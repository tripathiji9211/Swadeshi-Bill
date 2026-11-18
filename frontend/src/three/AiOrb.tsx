import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

export interface AiOrbProps {
  isThinking?: boolean;
  isSpeaking?: boolean;
}

export const AiOrb: React.FC<AiOrbProps> = ({ isThinking = false, isSpeaking = false }) => {
  const orbRef = useRef<THREE.Mesh>(null);
  const ripple1Ref = useRef<THREE.Mesh>(null);
  const ripple2Ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (orbRef.current) {
      // Gentle breathing pulse, faster when thinking
      const speed = isThinking ? 4.5 : isSpeaking ? 3.0 : 1.5;
      const scale = 1 + Math.sin(time * speed) * (isThinking ? 0.15 : 0.08);
      orbRef.current.scale.set(scale, scale, scale);
      orbRef.current.rotation.y = time * 0.4;
      orbRef.current.rotation.x = time * 0.2;
    }

    if (ripple1Ref.current) {
      const r1Scale = 1.2 + ((time * 1.2) % 1.5);
      ripple1Ref.current.scale.set(r1Scale, r1Scale, r1Scale);
      (ripple1Ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        1 - ((time * 1.2) % 1.5) / 1.5
      );
    }

    if (ripple2Ref.current) {
      const r2Scale = 1.2 + (((time + 0.6) * 1.2) % 1.5);
      ripple2Ref.current.scale.set(r2Scale, r2Scale, r2Scale);
      (ripple2Ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        1 - (((time + 0.6) * 1.2) % 1.5) / 1.5
      );
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Central Glowing AI Sentinel Orb */}
      <mesh ref={orbRef}>
        <sphereGeometry args={[1.0, 32, 32]} />
        <meshStandardMaterial
          color="#FF9933"
          emissive={isThinking ? '#D4A017' : '#FF9933'}
          emissiveIntensity={1.4}
          roughness={0.2}
          metalness={0.5}
          wireframe={isThinking}
        />
      </mesh>

      {/* Ripple Wave 1 */}
      <mesh ref={ripple1Ref}>
        <torusGeometry args={[1.2, 0.02, 16, 64]} />
        <meshBasicMaterial color="#D4A017" transparent opacity={0.6} />
      </mesh>

      {/* Ripple Wave 2 */}
      <mesh ref={ripple2Ref}>
        <torusGeometry args={[1.2, 0.02, 16, 64]} />
        <meshBasicMaterial color="#FF9933" transparent opacity={0.6} />
      </mesh>

      {/* Atmospheric Point Light */}
      <pointLight
        position={[0, 0, 0]}
        color={isThinking ? '#D4A017' : '#FF9933'}
        intensity={2.5}
        distance={6}
      />
    </group>
  );
};

export default AiOrb;
