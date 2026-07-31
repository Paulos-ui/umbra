"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";

/**
 * MOTION CONCEPT — "you are the light."
 *
 * The umbra is a dark, rough sphere sitting mostly in shadow. The cursor drives a
 * real gold PointLight, so the lit crescent (the shadow terminator) chases the
 * pointer and rakes texture across the surface. Click to LOCK the light in place —
 * selective disclosure made physical: you choose what stays revealed.
 *
 * Idle for a moment and the light resumes its own slow orbit, so the scene is
 * never dead. Honours prefers-reduced-motion by snapping instead of easing.
 */

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Procedural grayscale noise → bumpMap, so moving light reveals surface detail. */
function useBumpTexture() {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    const size = 256;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      let v = 0, amp = 0.5;
      for (let o = 0; o < 4; o++) { v += Math.random() * amp; amp *= 0.5; }
      const g = 120 + Math.min(1, v) * 135;
      img.data[i * 4] = g; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = g; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  }, []);
}

function Eclipse({ locked }: { locked: boolean }) {
  const light = useRef<THREE.PointLight>(null!);
  const glow = useRef<THREE.Sprite>(null!);
  const sphere = useRef<THREE.Mesh>(null!);
  const corona = useRef<THREE.Mesh>(null!);
  const bump = useBumpTexture();
  const reduced = useReducedMotion();
  const { pointer } = useThree();

  const target = useMemo(() => new THREE.Vector3(3, 2, 2.6), []);
  const lastMove = useRef(0);
  const prev = useRef({ x: 0, y: 0 });

  const glowTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const s = 128;
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const g = c.getContext("2d")!;
    const rad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    rad.addColorStop(0, "rgba(240,201,135,0.9)");
    rad.addColorStop(0.4, "rgba(232,176,75,0.35)");
    rad.addColorStop(1, "rgba(232,176,75,0)");
    g.fillStyle = rad;
    g.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(c);
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // detect real pointer movement
    if (Math.abs(pointer.x - prev.current.x) > 0.001 || Math.abs(pointer.y - prev.current.y) > 0.001) {
      lastMove.current = t;
      prev.current = { x: pointer.x, y: pointer.y };
    }
    const idle = t - lastMove.current > 2.6;

    if (locked) {
      // frozen — do nothing to target
    } else if (idle && !reduced) {
      target.set(Math.cos(t * 0.5) * 3.4, Math.sin(t * 0.38) * 2.4, 2.6);
    } else {
      target.set(pointer.x * 4.2, pointer.y * 3.2, 2.6);
    }

    if (light.current) {
      light.current.position.lerp(target, reduced ? 1 : 0.075);
      if (glow.current) glow.current.position.copy(light.current.position);

      // corona brightens as the light nears the sphere's limb
      if (corona.current) {
        const limb = 1 - Math.min(1, Math.abs(light.current.position.length() - 2.4) / 2.2);
        (corona.current.material as THREE.MeshBasicMaterial).opacity = 0.04 + limb * 0.1;
        corona.current.rotation.z = t * 0.05;
      }
    }
    if (sphere.current) {
      sphere.current.rotation.y = t * 0.04;
      sphere.current.rotation.x = Math.sin(t * 0.15) * 0.05;
    }
  });

  return (
    <>
      <ambientLight color={0x140f1c} intensity={0.22} />
      <directionalLight color={0x3a2f4a} intensity={0.35} position={[-5, -2, -4]} />
      <pointLight ref={light} color={0xe8b04b} intensity={5.2} distance={22} decay={2} />

      {glowTexture && (
        <sprite ref={glow} scale={[1.6, 1.6, 1]}>
          <spriteMaterial map={glowTexture} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
      )}

      <mesh ref={sphere}>
        <sphereGeometry args={[1.55, 160, 160]} />
        <meshStandardMaterial
          color={0x2a2333}
          roughness={0.92}
          metalness={0.06}
          bumpMap={bump ?? undefined}
          bumpScale={0.045}
          emissive={0x0d0a13}
        />
      </mesh>

      <mesh ref={corona} position={[0, 0, -0.6]}>
        <ringGeometry args={[1.58, 2.9, 160]} />
        <meshBasicMaterial
          color={0xe8b04b}
          transparent
          opacity={0.05}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  );
}

export function EclipseScene() {
  const [locked, setLocked] = useState(false);
  return (
    // absolute (not fixed) so the eclipse lives inside the hero section only —
    // otherwise its full-screen click layer would swallow clicks further down the page.
    <div
      className="absolute inset-0 z-0"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button,a")) return;
        setLocked((l) => !l);
      }}
      style={{ cursor: locked ? "crosshair" : "default" }}
    >
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }} dpr={[1, 2]}>
        <Eclipse locked={locked} />
      </Canvas>
    </div>
  );
}
