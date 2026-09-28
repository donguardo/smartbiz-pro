import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type SceneColors = {
  purple: string;
  magenta: string;
  glow: string;
};

function FloatingForms({ colors, motion }: { colors: SceneColors; motion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);

  useFrame(({ clock }, rawDelta) => {
    if (!motion) return;
    const delta = Math.min(rawDelta, 0.05);
    const elapsed = clock.getElapsedTime();
    if (group.current) {
      group.current.rotation.y += delta * 0.08;
      group.current.rotation.x = Math.sin(elapsed * 0.18) * 0.08;
    }
    if (ring.current) ring.current.rotation.z -= delta * 0.06;
  });

  return (
    <group ref={group} rotation={[0.2, -0.35, 0.1]}>
      <mesh position={[-3.8, 1.2, -1]} rotation={[0.4, 0.2, 0]}>
        <icosahedronGeometry args={[2.8, 2]} />
        <meshBasicMaterial color={colors.purple} wireframe transparent opacity={0.17} />
      </mesh>
      <mesh ref={ring} position={[3.7, -0.8, 0]} rotation={[1, 0.2, 0.5]}>
        <torusKnotGeometry args={[2.1, 0.32, 96, 12, 2, 3]} />
        <meshBasicMaterial color={colors.magenta} wireframe transparent opacity={0.2} />
      </mesh>
      <mesh position={[0.8, 2.7, -2]} rotation={[0.5, 0, 0.3]}>
        <octahedronGeometry args={[1.45, 1]} />
        <meshBasicMaterial color={colors.glow} transparent opacity={0.1} />
      </mesh>
    </group>
  );
}

export function AnimatedBackdrop() {
  const [colors, setColors] = useState<SceneColors | null>(null);
  const [motion, setMotion] = useState(true);

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    setColors({
      purple: styles.getPropertyValue("--scene-purple").trim(),
      magenta: styles.getPropertyValue("--scene-magenta").trim(),
      glow: styles.getPropertyValue("--scene-glow").trim(),
    });
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMotion(!preference.matches);
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, []);

  if (!colors) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <Canvas camera={{ position: [0, 0, 10], fov: 48 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }}>
        <FloatingForms colors={colors} motion={motion} />
      </Canvas>
    </div>
  );
}