import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

export const ForecastRibbon3D: React.FC = () => {
  const ribbonGroupRef = useRef<THREE.Group>(null);

  // Generate historical and forecasted points
  const points = useMemo(() => {
    const list: THREE.Vector3[] = [];
    const count = 30;
    for (let i = 0; i < count; i++) {
      const x = (i - 15) * 0.25;
      // Spend wave curve
      const y = Math.sin(i * 0.4) * 0.45 + (i > 18 ? 0.3 : 0);
      const z = Math.cos(i * 0.3) * 0.2;
      list.push(new THREE.Vector3(x, y, z));
    }
    return list;
  }, []);

  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (ribbonGroupRef.current) {
      ribbonGroupRef.current.rotation.y = Math.sin(time * 0.3) * 0.12;
    }
  });

  return (
    <group ref={ribbonGroupRef} position={[0, -0.2, 0]}>
      {/* 3D Extruded Tube Ribbon */}
      <mesh>
        <tubeGeometry args={[curve, 64, 0.08, 12, false]} />
        <meshStandardMaterial
          color="#FF9933"
          emissive="#D4A017"
          emissiveIntensity={0.4}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>

      {/* Festival Beacon Markers (Diwali, Holi, Eid, Pongal) */}
      {[
        { x: -2.5, y: 0.6, label: 'PONGAL', color: '#FF9933' },
        { x: -0.8, y: 0.7, label: 'HOLI', color: '#D4A017' },
        { x: 0.8, y: 0.8, label: 'EID', color: '#138808' },
        { x: 2.2, y: 0.9, label: 'DIWALI', color: '#FF9933' },
      ].map((beacon, idx) => (
        <group key={idx} position={[beacon.x, beacon.y, 0]}>
          <mesh>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshBasicMaterial color={beacon.color} />
          </mesh>
          <mesh position={[0, -0.3, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.6, 8]} />
            <meshBasicMaterial color={beacon.color} transparent opacity={0.5} />
          </mesh>
        </group>
      ))}

      <pointLight position={[0, 1, 1]} color="#FF9933" intensity={1.8} distance={6} />
    </group>
  );
};

export default ForecastRibbon3D;
