"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * MOTION CONCEPT — the mechanism, told in 3D and scrubbed by scroll.
 *
 * Scattered ciphertext nodes CONVERGE into a single glowing aggregate (submit),
 * the core swells as it crosses the swap ring into light (aggregate + swap),
 * then the nodes FAN BACK OUT as shielded shares, shifting haze-grey → corona-gold
 * (redistribute). Scroll position IS the timeline — the batching story, literally.
 */

const N = 90;

function Orders({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const points = useRef<THREE.Points>(null!);
  const core = useRef<THREE.Mesh>(null!);
  const ring = useRef<THREE.Mesh>(null!);

  const { geometry, scatter, fan, material } = useMemo(() => {
    const scatter: [number, number, number][] = [];
    const fan: [number, number, number][] = [];
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const rad = 3.4 + Math.random() * 2.4;
      scatter.push([Math.cos(a) * rad, Math.sin(a) * rad * 0.8, (Math.random() - 0.5) * 3]);
      const a2 = (i / N) * Math.PI * 2;
      const rad2 = 2.6 + Math.random() * 1.4;
      fan.push([Math.cos(a2) * rad2, Math.sin(a2) * rad2 * 0.8, (Math.random() - 0.5) * 1.5]);
      pos[i * 3] = scatter[i][0];
      pos[i * 3 + 1] = scatter[i][1];
      pos[i * 3 + 2] = scatter[i][2];
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const material = new THREE.PointsMaterial({
      color: 0xa99bb5, size: 0.11, transparent: true, opacity: 0.85,
    });
    return { geometry, scatter, fan, material };
  }, []);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const p = progressRef.current;

    const conv = Math.min(1, p / 0.45);            // gather to centre
    const redist = Math.max(0, (p - 0.6) / 0.4);   // fan back out
    const agg = Math.min(conv, 1 - redist);

    const arr = geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < N; i++) {
      const s = scatter[i], f = fan[i];
      let x = lerp(s[0], 0, conv), y = lerp(s[1], 0, conv), z = lerp(s[2], 0, conv);
      x = lerp(x, f[0], redist); y = lerp(y, f[1], redist); z = lerp(z, f[2], redist);
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
    }
    geometry.attributes.position.needsUpdate = true;

    // haze → gold as orders cross into light
    const gold = Math.max(0, (p - 0.4) / 0.6);
    material.color.setRGB(lerp(0.66, 0.91, gold), lerp(0.61, 0.69, gold), lerp(0.71, 0.29, gold));

    if (core.current) {
      core.current.scale.setScalar(0.001 + agg * 1.1);
      (core.current.material as THREE.MeshBasicMaterial).opacity = agg;
    }
    if (ring.current) {
      ring.current.rotation.z = t * 1.2;
      ring.current.rotation.x = 0.5 + Math.sin(t) * 0.15;
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.25 + agg * 0.5;
    }
    if (points.current) points.current.rotation.z = t * 0.4;
    state.camera.position.z = 8 - agg * 1.5;
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <mesh ref={ring}>
        <torusGeometry args={[1.15, 0.02, 16, 120]} />
        <meshBasicMaterial color={0xe8b04b} transparent opacity={0.55} />
      </mesh>
      <mesh ref={core}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial color={0xe8b04b} transparent opacity={0.95} />
      </mesh>
      <points ref={points} geometry={geometry} material={material} />
    </>
  );
}

export function MechanismScene({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 50 }} dpr={[1, 2]}>
      <Orders progressRef={progressRef} />
    </Canvas>
  );
}
