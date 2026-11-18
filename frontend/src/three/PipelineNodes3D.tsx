import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

export const PipelineNodes3D: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);

  const nodes = [
    { x: -3.0, label: 'INGEST', color: '#FF9933' },
    { x: -1.8, label: 'EASYOCR', color: '#D4A017' },
    { x: -0.6, label: 'LLM_PARSE', color: '#138808' },
    { x: 0.6, label: 'CLASSIFIER', color: '#FF9933' },
    { x: 1.8, label: 'ANOMALY', color: '#B3202A' },
    { x: 3.0, label: 'LEDGER', color: '#D4A017' },
  ];

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(time * 0.3) * 0.12;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Central Connector Conduit */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 6.2, 16]} />
        <meshBasicMaterial color="#FF9933" transparent opacity={0.4} />
      </mesh>

      {/* Nodes */}
      {nodes.map((node, idx) => (
        <group key={idx} position={[node.x, 0, 0]}>
          <mesh>
            <sphereGeometry args={[0.22, 24, 24]} />
            <meshStandardMaterial
              color={node.color}
              emissive={node.color}
              emissiveIntensity={0.6}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
          <mesh>
            <ringGeometry args={[0.28, 0.32, 24]} />
            <meshBasicMaterial color={node.color} side={THREE.DoubleSide} transparent opacity={0.5} />
          </mesh>
        </group>
      ))}

      <pointLight position={[0, 0, 2]} color="#FF9933" intensity={2} distance={8} />
    </group>
  );
};

export default PipelineNodes3D;
