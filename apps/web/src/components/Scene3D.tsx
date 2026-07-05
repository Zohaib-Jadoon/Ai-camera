'use client';

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

// Camera position and lookAt targets for scroll segments
const CAMERA_POSITIONS: [number, number, number][] = [
  [0, 0, 7.5],        // Section 0: Hero (Center)
  [1.8, 0.4, 4.5],    // Section 1: Stats (Shifted right, zoom in)
  [-2.2, -0.8, 5.2],  // Section 2: Centroid Tracking (Shifted left, low angle)
  [0.0, 3.2, 4.8],    // Section 3: Virtual Perimeter (High angle, looking down)
  [0.0, 0.0, 7.8],    // Section 4: PPE / CTA (Center, wide view)
];

const CAMERA_TARGETS: [number, number, number][] = [
  [0, 0, 0],          // Hero
  [-0.6, 0.1, 0],     // Stats (Look left)
  [0.8, 0.2, 0],      // Centroid (Look right)
  [0.0, -0.8, 0],     // Perimeter (Look down)
  [0, 0, 0],          // CTA
];

function getInterpolatedVector(progress: number, points: [number, number, number][], targetVec: THREE.Vector3) {
  const t = Math.max(0, Math.min(1, progress));
  const segments = points.length - 1;
  const segmentLength = 1 / segments;
  const index = Math.min(Math.floor(t / segmentLength), segments - 1);
  const localT = (t - index * segmentLength) / segmentLength;

  const p0 = points[index];
  const p1 = points[index + 1];

  targetVec.set(
    THREE.MathUtils.lerp(p0[0], p1[0], localT),
    THREE.MathUtils.lerp(p0[1], p1[1], localT),
    THREE.MathUtils.lerp(p0[2], p1[2], localT)
  );
}

function ParticleField({ scrollProgress }: { scrollProgress: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Points>(null!);
  const count = 1800;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 15;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 15;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 15;
    }
    return pos;
  }, []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    // Subtle rotation and waving
    ref.current.rotation.y = time * 0.03;
    ref.current.rotation.x = time * 0.01;
    
    // Scale expansion based on scroll progress
    const scale = 1.0 + scrollProgress.current * 0.5;
    ref.current.scale.set(scale, scale, scale);
  });

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial
        transparent
        color="#7eb8f7"
        size={0.035}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.35}
      />
    </Points>
  );
}

function ScanningGrid({ scrollProgress }: { scrollProgress: React.MutableRefObject<number> }) {
  const gridRef = useRef<THREE.GridHelper>(null!);
  const laserRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    // Grid animation synced with time and scroll
    gridRef.current.position.y = -1.5 - scrollProgress.current * 0.5;
    
    // Laser scanning bar going back and forth
    laserRef.current.position.z = Math.sin(time * 1.5) * 4;
    laserRef.current.position.y = -1.48 - scrollProgress.current * 0.5;
    
    // Fade in laser scan on section 3 (Perimeter)
    const prog = scrollProgress.current;
    // Section 3 is around progress 0.5 - 0.75
    const isPerimeter = prog > 0.45 && prog < 0.8;
    const targetOpacity = isPerimeter ? 0.75 : 0.0;
    const mat = laserRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.1);
  });

  return (
    <group>
      <gridHelper
        ref={gridRef}
        args={[30, 30, '#1e293b', '#0f172a']}
        position={[0, -1.5, 0]}
      />
      {/* Red laser scanner beam */}
      <mesh ref={laserRef} position={[0, -1.48, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 0.05]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function CyberSensor({ scrollProgress }: { scrollProgress: React.MutableRefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const prog = scrollProgress.current;
    
    // Rotate and morph
    meshRef.current.rotation.x = time * 0.2;
    meshRef.current.rotation.y = time * 0.3;
    
    // Pulse size
    const baseScale = 1.2 + Math.sin(time * 2.0) * 0.05;
    // Morphosis shape changes based on scroll (scale changes)
    meshRef.current.scale.set(
      baseScale * (1.0 + Math.sin(prog * Math.PI) * 0.3),
      baseScale * (1.0 - Math.sin(prog * Math.PI) * 0.2),
      baseScale
    );
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <octahedronGeometry args={[1, 2]} />
      <meshBasicMaterial color="#10b981" wireframe transparent opacity={0.15} />
    </mesh>
  );
}

function TrackerNodes({ scrollProgress }: { scrollProgress: React.MutableRefObject<number> }) {
  const groupRef = useRef<THREE.Group>(null!);

  const nodes = useMemo(() => {
    const items = [];
    for (let i = 0; i < 15; i++) {
      items.push({
        pos: [
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 4,
        ] as [number, number, number],
        color: Math.random() > 0.5 ? '#7eb8f7' : '#10b981',
      });
    }
    return items;
  }, []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    groupRef.current.position.y = Math.sin(time * 0.5) * 0.2;
    // Rotate group based on scroll
    groupRef.current.rotation.y = scrollProgress.current * Math.PI * 0.5;
  });

  return (
    <group ref={groupRef}>
      {nodes.map((node, i) => (
        <mesh key={i} position={node.pos}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshBasicMaterial color={node.color} transparent opacity={0.4} wireframe />
        </mesh>
      ))}
    </group>
  );
}

function SceneController({ scrollProgress }: { scrollProgress: React.MutableRefObject<number> }) {
  const { camera } = useThree();
  const currentPos = useMemo(() => new THREE.Vector3(), []);
  const currentTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    // Interpolate camera position and target target based on scroll progress
    getInterpolatedVector(scrollProgress.current, CAMERA_POSITIONS, currentPos);
    getInterpolatedVector(scrollProgress.current, CAMERA_TARGETS, currentTarget);
    
    // Smooth transition (lerp camera position)
    camera.position.lerp(currentPos, 0.08);
    camera.lookAt(currentTarget);
  });

  return null;
}

export default function Scene3D({ scrollProgress }: { scrollProgress: React.MutableRefObject<number> }) {
  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none z-0">
      <Canvas camera={{ fov: 45, near: 0.1, far: 100 }}>
        <ambientLight intensity={0.5} />
        <SceneController scrollProgress={scrollProgress} />
        <ParticleField scrollProgress={scrollProgress} />
        <ScanningGrid scrollProgress={scrollProgress} />
        <CyberSensor scrollProgress={scrollProgress} />
        <TrackerNodes scrollProgress={scrollProgress} />
      </Canvas>
    </div>
  );
}
