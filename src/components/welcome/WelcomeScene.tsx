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
      <canvas id="pill-canvas" ref={canvasRef} aria-label="Animated 3D render of gel capsules and a blister pack" />
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
  camera.position.set(0, 1.12, 6.35);
  camera.lookAt(0, -0.04, 0);

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
      new THREE.TorusGeometry(radius * 0.992, 0.012, 6, 56),
      new THREE.MeshStandardMaterial({ color: 0x101614, roughness: 0.45, metalness: 0.25 })
    );
    seam.rotation.x = Math.PI / 2;

    for (const part of [topWall, topCap, bottomWall, bottomCap, seam]) {
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

    const pillGeometry = new THREE.SphereGeometry(0.135, 20, 14);
    const tabletMaterial = pillMaterial(0xf7fbf9);
    for (const y of [-0.3, 0.3]) {
      for (const x of [-0.58, 0, 0.58]) {
        const pill = new THREE.Mesh(pillGeometry, tabletMaterial);
        pill.position.set(x, y, 0.16);
        pill.scale.set(1, 1, 0.55);
        pill.castShadow = true;
        group.add(pill);
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
    makeCapsule({ radius: 0.38, length: 1.12, colorA: 0xf4f8f6, colorB: 0x0000ff }),
    [0.14, 0.12, 0.28],
    [0.14, 0.34, 0.6],
    1,
    { float: 0.07, phase: 0, spin: 0.11, sway: 0.13 }
  );

  place(
    makeCapsule({ radius: 0.3, length: 0.92, colorA: 0x9db4ff, colorB: 0xf4f8f6 }),
    [-1.16, -0.52, 0.08],
    [-0.08, -0.78, -0.46],
    1,
    { float: 0.09, phase: 1.7, spin: -0.08, sway: 0.12 }
  );

  place(
    makeCapsule({ radius: 0.25, length: 0.78, colorA: 0xf4f8f6, colorB: 0x1c2622 }),
    [1.24, 0.6, -0.22],
    [0.1, 1.12, 1.02],
    1,
    { float: 0.08, phase: 3.1, spin: 0.09, sway: 0.11 }
  );

  place(
    makeBlister(),
    [0.36, -0.64, -1.18],
    [0.16, -0.4, -0.13],
    0.92,
    { float: 0.045, phase: 0.9, spin: 0, sway: 0.055 }
  );

  place(makeOrb(0.105, 0x0000ff), [-0.66, 1.04, -0.28], [0, 0, 0], 1, {
    float: 0.11,
    phase: 2.2,
    spin: 0,
    sway: 0,
  });

  place(makeOrb(0.082, 0xffffff), [1.52, -0.04, 0.56], [0, 0, 0], 1, {
    float: 0.1,
    phase: 4.4,
    spin: 0,
    sway: 0,
  });

  // Distant orbs for the wide, full-bleed stage.
  place(makeOrb(0.12, 0x0000ff), [-2.95, 0.72, -2.35], [0, 0, 0], 1, {
    float: 0.12,
    phase: 5.2,
    spin: 0,
    sway: 0,
  });

  place(makeOrb(0.085, 0x9db4ff), [3.05, -0.5, -2.05], [0, 0, 0], 1, {
    float: 0.1,
    phase: 1.1,
    spin: 0,
    sway: 0,
  });

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

  const onIntro = (event: Event): void => {
    introPaused = Boolean((event as CustomEvent<{ playing?: boolean }>).detail?.playing);
    sync();
  };
  window.addEventListener("medpulse:intro", onIntro, { signal });

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

    const scale = width < 380 ? 0.82 : width < 520 ? 0.92 : width > 1200 ? 1.2 : width > 900 ? 1.08 : 1;
    root.scale.setScalar(scale);

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
  let introPaused = false;
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
    scrollRig.position.y = -scrollSmooth * 0.38;

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
    return !reduced && !contextLost && onScreen && !document.hidden && !introPaused;
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
