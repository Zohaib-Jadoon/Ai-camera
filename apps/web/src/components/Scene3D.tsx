'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

const CAMERA_NODES = [
  { scroll: 0.0,  pos: [0, 0, 7.0],   look: [0, 0, 0] },
  { scroll: 0.25, pos: [1.2, 0.4, 5.5], look: [-0.4, 0, 0] },
  { scroll: 0.50, pos: [-1.2, -0.4, 5.5], look: [0.4, 0, 0] },
  { scroll: 0.75, pos: [0.0, 1.8, 5.2], look: [0, -0.4, 0] },
  { scroll: 1.0,  pos: [0.0, 0.0, 7.5], look: [0, 0, 0] },
];

function interpolateCamera(progress: number, targetPos: THREE.Vector3, targetLook: THREE.Vector3) {
  const p = Math.max(0, Math.min(1, progress));
  const count = CAMERA_NODES.length - 1;
  const step = 1 / count;
  const index = Math.min(Math.floor(p / step), count - 1);
  const localT = (p - index * step) / step;

  const easeT = localT * localT * (3 - 2 * localT);
  const n0 = CAMERA_NODES[index];
  const n1 = CAMERA_NODES[index + 1];

  targetPos.set(
    THREE.MathUtils.lerp(n0.pos[0], n1.pos[0], easeT),
    THREE.MathUtils.lerp(n0.pos[1], n1.pos[1], easeT),
    THREE.MathUtils.lerp(n0.pos[2], n1.pos[2], easeT)
  );

  targetLook.set(
    THREE.MathUtils.lerp(n0.look[0], n1.look[0], easeT),
    THREE.MathUtils.lerp(n0.look[1], n1.look[1], easeT),
    THREE.MathUtils.lerp(n0.look[2], n1.look[2], easeT)
  );
}

function AmbientParticles({ scrollProgress }: { scrollProgress: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Points>(null!);
  const count = 1200;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }
    return pos;
  }, []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    ref.current.rotation.y = time * 0.015 + scrollProgress.current * 0.3;
    ref.current.rotation.x = Math.sin(time * 0.008) * 0.05;
  });

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial
        transparent
        color="#38bdf8"
        size={0.032}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.25}
      />
    </Points>
  );
}

function SubtleGrid({ scrollProgress }: { scrollProgress: React.MutableRefObject<number> }) {
  const gridRef = useRef<THREE.GridHelper>(null!);

  useFrame(() => {
    gridRef.current.position.y = -2.2 - scrollProgress.current * 0.3;
  });

  return (
    <gridHelper
      ref={gridRef}
      args={[40, 40, '#1e293b', '#090d16']}
      position={[0, -2.2, 0]}
    />
  );
}

function FloatingNodes({ scrollProgress }: { scrollProgress: React.MutableRefObject<number> }) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    groupRef.current.rotation.y = time * 0.05 + scrollProgress.current * 0.4;
    groupRef.current.position.y = Math.sin(time * 0.8) * 0.15;
  });

  return (
    <group ref={groupRef} position={[0, 0, -2]}>
      <mesh>
        <icosahedronGeometry args={[2.2, 1]} />
        <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.06} />
      </mesh>
      <mesh>
        <octahedronGeometry args={[1.2, 0]} />
        <meshBasicMaterial color="#818cf8" wireframe transparent opacity={0.09} />
      </mesh>
    </group>
  );
}

function Scene3DContent({ scrollProgress }: { scrollProgress: React.MutableRefObject<number> }) {
  const { camera } = useThree();
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const targetLook = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    interpolateCamera(scrollProgress.current, targetPos, targetLook);
    camera.position.lerp(targetPos, 0.05);
    camera.lookAt(targetLook);
  });

  return (
    <>
      <AmbientParticles scrollProgress={scrollProgress} />
      <SubtleGrid scrollProgress={scrollProgress} />
      <FloatingNodes scrollProgress={scrollProgress} />
    </>
  );
}

export default function Scene3D({ scrollProgress }: { scrollProgress: React.MutableRefObject<number> }) {
  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none z-0">
      <Canvas
        camera={{ fov: 45, near: 0.1, far: 100 }}
        dpr={[1, 1.5]}
        gl={{ powerPreference: 'high-performance', antialias: true }}
      >
        <ambientLight intensity={0.5} />
        <Scene3DContent scrollProgress={scrollProgress} />
      </Canvas>
    </div>
  );
}


