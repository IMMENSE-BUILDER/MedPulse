"use client";

/**
 * Procedural Three.js hero for the welcome page.
 *
 * Bundled from three@0.160.0 — no CDN, no textures or models. The cluster is
 * drag-to-spin, pointer-parallaxed, and rotated/lifted by the scroll progress
 * that welcome-motion.ts broadcasts. If WebGL fails the CSS pills take over.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

type CapsuleOptions = {
  radius?: number;
  length?: number;
  colorA?: number;
  colorB?: number;
};

type FloatMotion = {
  float: number;
  phase: number;
  spin: number;
  sway: number;
};

type FloatData = FloatMotion & {
  baseY: number;
  baseRotY: number;
};

type ScrollDetail = { progress?: number };
type ThemeDetail = { light?: boolean };

type Spinner = {
  object: THREE.Object3D;
  speed: number;
  axis: "x" | "y" | "z";
};

type Pulse = {
  light: THREE.PointLight;
  base: number;
  amplitude: number;
  speed: number;
  phase: number;
};

export function WelcomeScene() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    let cleanup: (() => void) | undefined;

    try {
      cleanup = createScene(canvas, stage);
    } catch (error) {
      console.warn("[welcome] 3D stage disabled:", error);
      stage.classList.add("no-3d");
    }

    return () => cleanup?.();
  }, []);

  return (
    <div className="stage" id="stage" ref={stageRef}>
      <canvas
        id="pill-canvas"
        ref={canvasRef}
        aria-label="Animated 3D specimen of a gel capsule, blister card, glass vial, tablets and a medicine carton orbiting inside four comparison rings"
      />
      <div className="stage-fallback" aria-hidden="true">
        <span className="fb-pill fb-a" />
        <span className="fb-pill fb-b" />
        <span className="fb-pack" />
      </div>
      <span className="stage-hint" id="stage-hint">
        drag to spin
      </span>
    </div>
  );
}

function createScene(canvas: HTMLCanvasElement, stage: HTMLDivElement): () => void {
  stage.classList.remove("no-3d", "grabbing", "spun");

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = motionQuery.matches;

  const spinners: Spinner[] = [];
  const pulses: Pulse[] = [];

  /* ---- renderer --------------------------------------------------------- */

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  camera.position.set(0, 1.3, 6.62);
  camera.lookAt(0, -0.05, 0);

  /* ---- studio environment ---------------------------------------------- */

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  const envTarget = pmrem.fromScene(envScene, 0.04);
  scene.environment = envTarget.texture;
  pmrem.dispose();

  const hemi = new THREE.HemisphereLight(0xe8f1ee, 0x0a0f0d, 0.85);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 2.15);
  key.position.set(3.4, 5.2, 3.8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 16;
  key.shadow.camera.left = -3.4;
  key.shadow.camera.right = 3.4;
  key.shadow.camera.top = 3.4;
  key.shadow.camera.bottom = -3.4;
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 3;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x0041c2, 2.1);
  rim.position.set(-4.2, 1.6, -3.4);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0xffffff, 0.32);
  fill.position.set(-2.2, -2.6, 3.2);
  scene.add(fill);

  const bluePulse = new THREE.PointLight(0x3355ff, 18, 10, 2);
  bluePulse.position.set(-2.1, 0.9, 2.4);
  scene.add(bluePulse);
  pulses.push({ light: bluePulse, base: 18, amplitude: 3.5, speed: 0.85, phase: 0.4 });

  const whitePulse = new THREE.PointLight(0xffffff, 9, 8, 2);
  whitePulse.position.set(2.5, 1.7, 2.1);
  scene.add(whitePulse);
  pulses.push({ light: whitePulse, base: 9, amplitude: 1.6, speed: 0.62, phase: 2.1 });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.34 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.6;
  floor.receiveShadow = true;
  scene.add(floor);

  /* ---- materials & objects --------------------------------------------- */

  function pillMaterial(color: number): THREE.MeshPhysicalMaterial {
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.32,
      metalness: 0,
      clearcoat: 0.85,
      clearcoatRoughness: 0.22,
      sheen: 0.35,
      sheenColor: new THREE.Color(0xffffff),
      sheenRoughness: 0.85,
      envMapIntensity: 0.7,
    });
  }

  /** A real tablet silhouette: a wide disc with a shallow score line. */
  function makeTablet(radius = 0.15, color = 0xf7fbf9): THREE.Group {
    const group = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.062, 32), pillMaterial(color));
    disc.castShadow = true;
    disc.receiveShadow = true;

    const score = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 1.34, 0.007, 0.014),
      new THREE.MeshStandardMaterial({ color: 0xa6b3ae, roughness: 0.72, metalness: 0.1 })
    );
    score.position.y = 0.033;

    const bevel = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.92, 0.008, 5, 40),
      new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0 })
    );
    bevel.rotation.x = Math.PI / 2;
    bevel.position.y = 0.032;

    group.add(disc, score, bevel);
    return group;
  }

  /** Two-tone gel capsule: cylinder + hemisphere per half, plus a seam ring. */
  function makeCapsule({
    radius = 0.34,
    length = 1.05,
    colorA = 0xf1f5f3,
    colorB = 0x0000ff,
  }: CapsuleOptions = {}): THREE.Group {
    const group = new THREE.Group();
    const half = length / 2;
    const matA = pillMaterial(colorA);
    const matB = pillMaterial(colorB);

    const topWall = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, half, 40, 1, false), matA);
    topWall.position.y = half / 2;

    const topCap = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2),
      matA
    );
    topCap.position.y = half;

    const bottomWall = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, half, 40, 1, false), matB);
    bottomWall.position.y = -half / 2;

    const bottomCap = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 40, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      matB
    );
    bottomCap.position.y = -half;

    const seam = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.992, 0.016, 8, 64),
      new THREE.MeshStandardMaterial({ color: 0xb9c5cf, roughness: 0.3, metalness: 0.7 })
    );
    seam.rotation.x = Math.PI / 2;

    const band = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.998, 0.008, 6, 64),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.38 })
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.035;

    for (const part of [topWall, topCap, bottomWall, bottomCap, seam, band]) {
      part.castShadow = true;
      part.receiveShadow = true;
      group.add(part);
    }
    return group;
  }

  /** Foil-backed blister with a frosted dome and a 2x3 pill grid. */
  function makeBlister(): THREE.Group {
    const group = new THREE.Group();

    const backing = new THREE.Mesh(
      new RoundedBoxGeometry(2.02, 1.28, 0.09, 4, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x46534e, roughness: 0.38, metalness: 0.68, envMapIntensity: 1 })
    );
    backing.position.z = -0.03;

    const dome = new THREE.Mesh(
      new RoundedBoxGeometry(1.96, 1.22, 0.2, 4, 0.09),
      new THREE.MeshPhysicalMaterial({
        color: 0xdcefe8,
        roughness: 0.14,
        metalness: 0,
        transparent: true,
        opacity: 0.3,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        envMapIntensity: 0.8,
      })
    );
    dome.position.z = 0.1;

    group.add(backing, dome);

    for (const y of [-0.3, 0.3]) {
      for (const x of [-0.58, 0, 0.58]) {
        const tablet = makeTablet(0.14);
        tablet.position.set(x, y, 0.17);
        tablet.rotation.x = Math.PI / 2;
        tablet.rotation.z = (x + y) * 0.3;
        tablet.scale.set(1, 1, 1.12);
        group.add(tablet);
      }
    }

    backing.castShadow = true;
    backing.receiveShadow = true;
    return group;
  }

  function makeOrb(radius: number, color: number): THREE.Mesh {
    return new THREE.Mesh(
      new THREE.SphereGeometry(radius, 28, 20),
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.18,
        metalness: 0.05,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
        envMapIntensity: 0.9,
      })
    );
  }

  /** Transparent gel shell with a granule fill — the “look inside” specimen. */
  function makeGranuleCapsule(): THREE.Group {
    const group = new THREE.Group();
    const radius = 0.29;
    const length = 0.94;
    const half = length / 2;
    const shell = new THREE.MeshPhysicalMaterial({
      color: 0xe4edff,
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const topWall = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, half, 36, 1, true), shell);
    topWall.position.y = half / 2;
    const topCap = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2),
      shell
    );
    topCap.position.y = half;
    const bottomWall = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, half, 36, 1, true),
      shell
    );
    bottomWall.position.y = -half / 2;
    const bottomCap = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 36, 18, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      shell
    );
    bottomCap.position.y = -half;
    for (const part of [topWall, topCap, bottomWall, bottomCap]) {
      part.renderOrder = 2;
      part.castShadow = false;
      group.add(part);
    }

    const seam = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 1.004, 0.012, 6, 64),
      new THREE.MeshStandardMaterial({ color: 0xbfc9d4, roughness: 0.24, metalness: 0.78 })
    );
    seam.rotation.x = Math.PI / 2;
    group.add(seam);

    const granuleGeometry = new THREE.SphereGeometry(0.043, 10, 8);
    const granuleMaterials = [pillMaterial(0xf8fbff), pillMaterial(0x0000ff), pillMaterial(0x9db4ff)];
    for (let index = 0; index < 22; index += 1) {
      const angle = index * 2.399;
      const y = -0.34 + (index / 21) * 0.68;
      const spread = 0.155 * (1 - Math.abs(y) / 0.62);
      const granule = new THREE.Mesh(granuleGeometry, granuleMaterials[index % granuleMaterials.length]);
      granule.position.set(Math.cos(angle) * spread, y, Math.sin(angle) * spread);
      granule.scale.setScalar(0.78 + (index % 4) * 0.09);
      granule.castShadow = true;
      group.add(granule);
    }

    return group;
  }

  /** Glass vial with a blue liquid, a paper label and a metal cap. */
  function makeVial(): THREE.Group {
    const group = new THREE.Group();
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xdde9ff,
      roughness: 0.05,
      metalness: 0.02,
      transparent: true,
      opacity: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 1.06, 36, 1, true), glass);
    body.renderOrder = 2;
    const shoulder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.27, 0.16, 36, 1, true),
      glass
    );
    shoulder.position.y = 0.59;
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.275, 0.275, 0.055, 36),
      new THREE.MeshStandardMaterial({ color: 0xe9f1ff, roughness: 0.16, metalness: 0.08 })
    );
    base.position.y = -0.55;
    base.castShadow = true;

    const liquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.225, 0.225, 0.66, 32),
      new THREE.MeshPhysicalMaterial({
        color: 0x183cff,
        roughness: 0.12,
        metalness: 0.02,
        transparent: true,
        opacity: 0.62,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      })
    );
    liquid.position.y = -0.16;

    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(0.274, 0.274, 0.235, 36, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0, side: THREE.DoubleSide })
    );
    label.position.y = 0.04;
    const labelStripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.276, 0.276, 0.026, 36, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x0000ff, roughness: 0.42, metalness: 0.1, side: THREE.DoubleSide })
    );
    labelStripe.position.y = -0.055;

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.285, 0.305, 0.18, 36),
      new THREE.MeshStandardMaterial({ color: 0x0000ff, roughness: 0.26, metalness: 0.42 })
    );
    cap.position.y = 0.74;
    cap.castShadow = true;
    const capTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.285, 0.285, 0.018, 36),
      new THREE.MeshStandardMaterial({ color: 0xdbe4ff, roughness: 0.2, metalness: 0.55 })
    );
    capTop.position.y = 0.834;
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.274, 0.018, 8, 48),
      new THREE.MeshStandardMaterial({ color: 0xbfc9d4, roughness: 0.2, metalness: 0.8 })
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.65;

    group.add(body, shoulder, base, liquid, label, labelStripe, cap, capTop, collar);
    return group;
  }

  /** A small medicine carton, with a foil window and a cross mark. */
  function makeCarton(): THREE.Group {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new RoundedBoxGeometry(0.92, 1.12, 0.32, 4, 0.045),
      new THREE.MeshPhysicalMaterial({
        color: 0xfbfdff,
        roughness: 0.46,
        metalness: 0.02,
        clearcoat: 0.45,
        clearcoatRoughness: 0.25,
      })
    );
    body.castShadow = true;
    body.receiveShadow = true;

    const band = new THREE.Mesh(
      new RoundedBoxGeometry(0.94, 0.25, 0.335, 3, 0.025),
      new THREE.MeshStandardMaterial({ color: 0x0000ff, roughness: 0.34, metalness: 0.12 })
    );
    band.position.y = 0.12;

    const windowFrame = new THREE.Mesh(
      new RoundedBoxGeometry(0.28, 0.28, 0.02, 3, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xd8e3f7, roughness: 0.3, metalness: 0.3 })
    );
    windowFrame.position.set(-0.22, -0.2, 0.17);
    const crossA = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.035, 0.012),
      new THREE.MeshBasicMaterial({ color: 0x0000ff })
    );
    crossA.position.set(-0.22, -0.2, 0.188);
    const crossB = crossA.clone();
    crossB.rotation.z = Math.PI / 2;

    group.add(body, band, windowFrame, crossA, crossB);
    return group;
  }

  /** Four concentric comparison rings with cardinal nodes. */
  function makeOrbit(radius: number, tiltX: number, tiltY: number, opacity: number): THREE.Group {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.0075, 5, 180),
      new THREE.MeshBasicMaterial({
        color: 0x4c69ff,
        transparent: true,
        opacity,
        depthWrite: false,
      })
    );
    group.add(ring);

    const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: Math.min(0.9, opacity + 0.3) });
    for (let index = 0; index < 4; index += 1) {
      const angle = (index / 4) * Math.PI * 2;
      const node = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 8), nodeMaterial);
      node.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      group.add(node);
    }

    group.rotation.set(tiltX, tiltY, 0);
    spinners.push({ object: group, speed: 0.025, axis: "z" });
    return group;
  }

  /** Hovering glass plinth and concentric floor guides. */
  function makePedestal(): THREE.Group {
    const group = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(2.9, 3.05, 0.07, 64),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.18,
        metalness: 0.15,
        transparent: true,
        opacity: 0.14,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      })
    );
    disc.position.y = -1.55;
    disc.receiveShadow = true;
    group.add(disc);

    for (const [radius, opacity] of [
      [2.15, 0.34],
      [2.55, 0.22],
      [3.0, 0.14],
    ] as const) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.006, 5, 180),
        new THREE.MeshBasicMaterial({ color: 0x5a74ff, transparent: true, opacity, depthWrite: false })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -1.5;
      group.add(ring);
    }

    return group;
  }

  /** Sparse additive dust so the dark studio feels deep without a texture. */
  function makeDust(): THREE.Points {
    const count = 240;
    const positions = new Float32Array(count * 3);
    let seed = 17;
    const random = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };

    for (let index = 0; index < count; index += 1) {
      const radius = 2.2 + random() * 2.5;
      const angle = random() * Math.PI * 2;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = -1.2 + random() * 3.1;
      positions[index * 3 + 2] = Math.sin(angle) * radius;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0x7892ff,
      size: 0.024,
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    return new THREE.Points(geometry, material);
  }

  /* ---- composition ------------------------------------------------------ */

  const root = new THREE.Group();
  const scrollRig = new THREE.Group();
  const tilt = new THREE.Group();
  root.add(scrollRig);
  scrollRig.add(tilt);
  scene.add(root);

  const floaters: THREE.Object3D[] = [];

  function place(
    object: THREE.Object3D,
    position: [number, number, number],
    rotation: [number, number, number],
    scale: number,
    motion: FloatMotion
  ): THREE.Object3D {
    object.position.set(position[0], position[1], position[2]);
    object.rotation.set(rotation[0], rotation[1], rotation[2]);
    object.scale.setScalar(scale);
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    Object.assign(object.userData, {
      baseY: position[1],
      baseRotY: rotation[1],
      float: motion.float,
      phase: motion.phase,
      spin: motion.spin,
      sway: motion.sway,
    } satisfies FloatData);
    tilt.add(object);
    floaters.push(object);
    return object;
  }

  place(
    makeCapsule({ radius: 0.42, length: 1.24, colorA: 0xf5f9ff, colorB: 0x0000ff }),
    [0.04, 0.08, 0.3],
    [0.18, 0.42, 0.62],
    1,
    { float: 0.06, phase: 0, spin: 0.1, sway: 0.12 }
  );

  place(
    makeCapsule({ radius: 0.3, length: 0.92, colorA: 0x9db4ff, colorB: 0xf4f8f6 }),
    [-1.22, -0.62, 0.18],
    [-0.08, -0.78, -0.46],
    0.98,
    { float: 0.09, phase: 1.7, spin: -0.08, sway: 0.12 }
  );

  place(
    makeCapsule({ radius: 0.25, length: 0.78, colorA: 0xf4f8f6, colorB: 0x1c2622 }),
    [1.24, 0.68, -0.05],
    [0.1, 1.12, 1.02],
    0.95,
    { float: 0.08, phase: 3.1, spin: 0.09, sway: 0.11 }
  );

  place(
    makeBlister(),
    [0.3, -0.68, -0.98],
    [0.16, -0.4, -0.13],
    0.98,
    { float: 0.045, phase: 0.9, spin: 0, sway: 0.055 }
  );

  place(
    makeGranuleCapsule(),
    [-1.74, 0.58, -1.1],
    [0.14, 0.5, -0.28],
    0.86,
    { float: 0.07, phase: 2.6, spin: -0.05, sway: 0.08 }
  );

  place(
    makeVial(),
    [1.64, -0.5, 0.62],
    [0.02, -0.3, 0.14],
    0.82,
    { float: 0.05, phase: 1.2, spin: 0.03, sway: 0.05 }
  );

  place(
    makeCarton(),
    [1.82, 0.32, -1.45],
    [0.08, 0.5, -0.08],
    0.9,
    { float: 0.035, phase: 4.1, spin: 0, sway: 0.04 }
  );

  place(makeTablet(0.18), [1.36, -1.06, 1.2], [0.12, 0.4, 0.1], 1.12, {
    float: 0.03,
    phase: 0.4,
    spin: 0.05,
    sway: 0.04,
  });
  place(makeTablet(0.16, 0x9db4ff), [-0.72, -1.08, 1.32], [0.1, -0.6, 0.2], 0.96, {
    float: 0.03,
    phase: 2.2,
    spin: -0.04,
    sway: 0.03,
  });
  place(makeTablet(0.17), [0.18, -1.18, 1.52], [0.2, 0.2, -0.1], 0.84, {
    float: 0.025,
    phase: 4.8,
    spin: 0.03,
    sway: 0.03,
  });

  place(makeOrb(0.105, 0x0000ff), [-0.7, 1.18, -0.25], [0, 0, 0], 1, {
    float: 0.11,
    phase: 2.2,
    spin: 0,
    sway: 0,
  });

  place(makeOrb(0.082, 0xffffff), [1.45, 0.02, 0.95], [0, 0, 0], 1, {
    float: 0.1,
    phase: 4.4,
    spin: 0,
    sway: 0,
  });

  // Distant orbs extend the composition across the wide stage.
  place(makeOrb(0.12, 0x0000ff), [-2.9, 0.76, -2.3], [0, 0, 0], 1, {
    float: 0.12,
    phase: 5.2,
    spin: 0,
    sway: 0,
  });

  place(makeOrb(0.085, 0x9db4ff), [3.0, -0.42, -2.0], [0, 0, 0], 1, {
    float: 0.1,
    phase: 1.1,
    spin: 0,
    sway: 0,
  });

  tilt.add(makeOrbit(2.08, 0.2, 0.08, 0.38));
  tilt.add(makeOrbit(2.46, -0.42, 0.28, 0.24));
  tilt.add(makeOrbit(2.9, 0.62, -0.22, 0.16));

  const pedestal = makePedestal();
  scene.add(pedestal);

  const dust = makeDust();
  scene.add(dust);

  /* ---- interaction ------------------------------------------------------ */

  const pointer = { tx: 0, ty: 0, x: 0, y: 0 };
  let dragging = false;
  let dragX = 0;
  let spinVelocity = 0;

  let scrollProgress = 0;
  let scrollSmooth = 0;

  const controller = new AbortController();
  const { signal } = controller;

  const onScroll = (event: Event): void => {
    const detail = (event as CustomEvent<ScrollDetail>).detail;
    scrollProgress = Number(detail?.progress) || 0;
  };
  window.addEventListener("medpulse:scroll", onScroll, { signal });

  const onStagePointerMove = (event: PointerEvent): void => {
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer.tx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.ty = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  };
  const onStagePointerLeave = (): void => {
    pointer.tx = 0;
    pointer.ty = 0;
  };
  stage.addEventListener("pointermove", onStagePointerMove, { signal });
  stage.addEventListener("pointerleave", onStagePointerLeave, { signal });

  const onCanvasPointerDown = (event: PointerEvent): void => {
    dragging = true;
    dragX = event.clientX;
    stage.classList.add("grabbing", "spun");
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* pointer capture is best-effort */
    }
  };

  const onCanvasPointerMove = (event: PointerEvent): void => {
    if (!dragging) return;
    spinVelocity += (event.clientX - dragX) * 0.006;
    dragX = event.clientX;
  };

  const endDrag = (event: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove("grabbing");
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  };

  canvas.addEventListener("pointerdown", onCanvasPointerDown, { signal });
  canvas.addEventListener("pointermove", onCanvasPointerMove, { signal });
  canvas.addEventListener("pointerup", endDrag, { signal });
  canvas.addEventListener("pointercancel", endDrag, { signal });

  /* ---- sizing ----------------------------------------------------------- */

  let width = 0;
  let height = 0;
  let resizeObserver: ResizeObserver | null = null;

  function resize(): void {
    const nextWidth = Math.max(1, Math.round(stage.clientWidth));
    const nextHeight = Math.max(1, Math.round(stage.clientHeight));
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;

    renderer.setSize(width, height, false);

    camera.aspect = width / height;
    camera.fov = width < 460 ? 40 : 34;
    camera.updateProjectionMatrix();

    const scale = width < 360 ? 0.86 : width < 520 ? 0.94 : width < 760 ? 1.02 : width > 1100 ? 1.12 : 1.08;
    const wideStage = width > 620 && height / width < 0.78;
    root.scale.setScalar(wideStage ? scale * 1.12 : scale);

    if (reduced) renderer.render(scene, camera);
  }

  resize();
  renderer.render(scene, camera);

  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(stage);
  } else {
    window.addEventListener("resize", resize, { signal });
  }

  /* ---- theme ------------------------------------------------------------ */

  function applyTheme(isLight: boolean): void {
    renderer.toneMappingExposure = isLight ? 0.94 : 1.04;
    key.intensity = isLight ? 2.0 : 2.15;
    rim.intensity = isLight ? 1.05 : 1.55;
    hemi.intensity = isLight ? 1.0 : 0.85;
    floor.material.opacity = isLight ? 0.2 : 0.34;
    if (reduced) renderer.render(scene, camera);
  }

  applyTheme(document.documentElement.classList.contains("light"));

  const onTheme = (event: Event): void => {
    applyTheme(Boolean((event as CustomEvent<ThemeDetail>).detail?.light));
  };
  window.addEventListener("medpulse:theme", onTheme, { signal });

  /* ---- animation loop --------------------------------------------------- */

  let onScreen = true;
  let running = false;
  let contextLost = false;
  let frameId = 0;
  let last = 0;
  let elapsed = 0;

  const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

  function frame(now: number): void {
    if (!running) return;
    frameId = window.requestAnimationFrame(frame);

    const delta = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    elapsed += delta;

    const ease = clamp01(delta * 6);
    pointer.x += (pointer.tx - pointer.x) * ease;
    pointer.y += (pointer.ty - pointer.y) * ease;

    tilt.rotation.y = pointer.x * 0.22;
    tilt.rotation.x = -pointer.y * 0.14;

    scrollSmooth += (scrollProgress - scrollSmooth) * clamp01(delta * 5);
    scrollRig.rotation.y = scrollSmooth * 0.9;
    scrollRig.rotation.x = scrollSmooth * 0.07;
    scrollRig.rotation.z = scrollSmooth * 0.025;
    scrollRig.position.y = -scrollSmooth * 0.38;

    for (const spinner of spinners) {
      spinner.object.rotation[spinner.axis] += delta * spinner.speed;
    }

    for (const pulse of pulses) {
      pulse.light.intensity = pulse.base + Math.sin(elapsed * pulse.speed + pulse.phase) * pulse.amplitude;
    }

    dust.rotation.y += delta * 0.008;
    dust.rotation.x = Math.sin(elapsed * 0.05) * 0.02;
    dust.position.y = Math.sin(elapsed * 0.18) * 0.04;

    if (!dragging) {
      root.rotation.y += spinVelocity * delta * 3;
      spinVelocity *= Math.pow(0.92, delta * 60);
      if (Math.abs(spinVelocity) < 0.01) {
        root.rotation.y += delta * 0.045;
      }
    }

    for (const object of floaters) {
      const data = object.userData as FloatData;
      object.position.y = data.baseY + Math.sin(elapsed * 0.9 + data.phase) * data.float;

      const spin = data.spin ? elapsed * data.spin : 0;
      const sway = data.sway ? Math.sin(elapsed * 0.42 + data.phase) * data.sway : 0;
      object.rotation.y = data.baseRotY + spin + sway;
    }

    renderer.render(scene, camera);
  }

  function shouldRun(): boolean {
    return !reduced && !contextLost && onScreen && !document.hidden;
  }

  function sync(): void {
    const next = shouldRun();
    if (next === running) return;
    running = next;

    if (running) {
      last = performance.now();
      frameId = window.requestAnimationFrame(frame);
    } else {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
      renderer.render(scene, camera);
    }
  }

  let screenObserver: IntersectionObserver | null = null;
  if (typeof IntersectionObserver !== "undefined") {
    screenObserver = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((entry) => entry.isIntersecting);
        sync();
      },
      { threshold: 0.02 }
    );
    screenObserver.observe(stage);
  }

  document.addEventListener("visibilitychange", sync, { signal });

  const onMotionChange = (): void => {
    reduced = motionQuery.matches;
    sync();
    if (reduced) renderer.render(scene, camera);
  };
  motionQuery.addEventListener("change", onMotionChange);

  const onContextLost = (event: Event): void => {
    event.preventDefault();
    contextLost = true;
    sync();
    stage.classList.add("no-3d");
  };

  const onContextRestored = (): void => {
    contextLost = false;
    stage.classList.remove("no-3d");
    sync();
  };

  canvas.addEventListener("webglcontextlost", onContextLost, { signal });
  canvas.addEventListener("webglcontextrestored", onContextRestored, { signal });

  sync();

  return () => {
    running = false;
    controller.abort();
    motionQuery.removeEventListener("change", onMotionChange);
    resizeObserver?.disconnect();
    screenObserver?.disconnect();
    window.cancelAnimationFrame(frameId);

    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();

    const collect = (object: THREE.Object3D): void => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material) {
        const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of list) materials.add(material);
      }
    };

    scene.traverse(collect);
    envScene.traverse(collect);

    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();

    envTarget.dispose();
    renderer.dispose();
    stage.classList.remove("grabbing", "spun");
  };
}
