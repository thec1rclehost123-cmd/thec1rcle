"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

// ── Cloth simulation constants ─────────────────────────────────────
const SEG_W    = 8;
const SEG_H    = 14;
const CLOTH_W  = 1.8;
const CLOTH_H  = 3.8;
const PCOUNT   = (SEG_W + 1) * (SEG_H + 1);
const GRAVITY  = -14;
const DAMPING  = 0.985;
const ITERATIONS = 10;
const COIN_COUNT = 22; // reduced for perf

// ── Verlet cloth factory ───────────────────────────────────────────
function makeCloth() {
  const pos    = new Float32Array(PCOUNT * 3);
  const prev   = new Float32Array(PCOUNT * 3);
  const pinned = new Uint8Array(PCOUNT);
  const restX  = new Float32Array(PCOUNT);
  const restY  = new Float32Array(PCOUNT);

  for (let j = 0; j <= SEG_H; j++) {
    for (let i = 0; i <= SEG_W; i++) {
      const idx = j * (SEG_W + 1) + i;
      const rx  = (i / SEG_W - 0.5) * CLOTH_W;
      const ry  = CLOTH_H / 2 - (j / SEG_H) * CLOTH_H;
      restX[idx] = rx;
      restY[idx] = ry;
      // Start collapsed at top — gravity unfurls naturally
      pos[idx * 3]     = rx;
      pos[idx * 3 + 1] = CLOTH_H / 2;
      pos[idx * 3 + 2] = 0;
      prev[idx * 3]     = rx;
      prev[idx * 3 + 1] = CLOTH_H / 2;
      prev[idx * 3 + 2] = 0;
      if (j === 0) pinned[idx] = 1;
    }
  }

  // Constraints from REST positions so cloth wants to hang correctly
  const constraints: [number, number, number][] = [];
  const addC = (a: number, b: number) => {
    const dx = restX[a] - restX[b];
    const dy = restY[a] - restY[b];
    constraints.push([a, b, Math.sqrt(dx * dx + dy * dy)]);
  };
  for (let j = 0; j <= SEG_H; j++) {
    for (let i = 0; i <= SEG_W; i++) {
      const idx = j * (SEG_W + 1) + i;
      if (i < SEG_W)              addC(idx, idx + 1);
      if (j < SEG_H)              addC(idx, idx + (SEG_W + 1));
      if (i < SEG_W && j < SEG_H) addC(idx, idx + SEG_W + 2);
      if (i > 0     && j < SEG_H) addC(idx, idx + SEG_W);
    }
  }
  return { pos, prev, pinned, constraints };
}

function stepCloth(
  { pos, prev, pinned, constraints }: ReturnType<typeof makeCloth>,
  dt: number, windX: number, windZ: number
) {
  const dt2 = dt * dt;
  for (let i = 0; i < PCOUNT; i++) {
    if (pinned[i]) continue;
    const i3 = i * 3;
    const vx = (pos[i3]     - prev[i3])     * DAMPING;
    const vy = (pos[i3 + 1] - prev[i3 + 1]) * DAMPING;
    const vz = (pos[i3 + 2] - prev[i3 + 2]) * DAMPING;
    prev[i3]     = pos[i3];
    prev[i3 + 1] = pos[i3 + 1];
    prev[i3 + 2] = pos[i3 + 2];
    pos[i3]     += vx + windX * dt2;
    pos[i3 + 1] += vy + GRAVITY * dt2;
    pos[i3 + 2] += vz + windZ * dt2;
  }
  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (const [a, b, rest] of constraints) {
      const a3 = a * 3, b3 = b * 3;
      const dx = pos[b3]     - pos[a3];
      const dy = pos[b3 + 1] - pos[a3 + 1];
      const dz = pos[b3 + 2] - pos[a3 + 2];
      const d  = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 0.0001) continue;
      const diff = (d - rest) / d * 0.5;
      if (!pinned[a]) { pos[a3]     += dx * diff; pos[a3 + 1] += dy * diff; pos[a3 + 2] += dz * diff; }
      if (!pinned[b]) { pos[b3]     -= dx * diff; pos[b3 + 1] -= dy * diff; pos[b3 + 2] -= dz * diff; }
    }
  }
}

// ── Component ──────────────────────────────────────────────────────
export default function NightclubScene() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Renderer ──────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0)); // cap at 1× — biggest perf win
    renderer.shadowMap.enabled = false; // shadows off — not visible at this scale, saves GPU
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    container.appendChild(renderer.domElement);

    // ── Scene & Camera ────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#06040A");
    // Linear fog — keeps DJ visible, hazes back wall
    scene.fog = new THREE.Fog("#06040A", 12, 26);

    const camera = new THREE.PerspectiveCamera(
      63, container.clientWidth / container.clientHeight, 0.1, 60
    );
    // Start right at the DJ — very tight, almost face-level
    camera.position.set(0, 0.8, -7.0);
    camera.lookAt(0, 1.2, -9.5);

    // ── Bloom composer ────────────────────────────────────────────────
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      0.38,  // strength — reduced, was 0.85
      0.35,  // radius
      0.28   // threshold — raised so only bright emissives trigger
    );
    composer.addPass(bloomPass);

    // ── Helpers ───────────────────────────────────────────────────────
    const emissiveMat = (color: string, intensity: number) =>
      new THREE.MeshStandardMaterial({
        color, emissive: new THREE.Color(color), emissiveIntensity: intensity,
      });

    const addMesh = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      pos: [number, number, number],
      rot?: [number, number, number],
      shadow = false
    ) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(...pos);
      if (rot) m.rotation.set(...rot);
      if (shadow) { m.receiveShadow = true; m.castShadow = true; }
      scene.add(m);
      return m;
    };

    // ── Lights ────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight("#0d0400", 0.12));

    // Only 2 spotlights cast shadows (perf)
    const addSpot = (
      px: number, py: number, pz: number,
      tx: number, ty: number, tz: number,
      color: string, intensity: number, angle: number, shadow = false
    ) => {
      const l = new THREE.SpotLight(new THREE.Color(color), intensity);
      l.position.set(px, py, pz);
      l.angle = angle; l.penumbra = 0.55; l.decay = 1.4;
      l.castShadow = shadow;
      if (shadow) l.shadow.mapSize.set(1024, 1024);
      l.target.position.set(tx, ty, tz);
      scene.add(l); scene.add(l.target);
      return l;
    };

    // General wash — two side spots only, moderate intensity
    addSpot(-5, 7.1, -5, -2, -2, -6,  "#FF4400", 70, 0.32);
    addSpot(5, 7.1, -5,   2, -2, -6,  "#CC2000", 70, 0.32);

    // Slow sweep cross-beams for atmosphere
    const sweepL = addSpot(-8, 7.1, -3, 2, -1, -7, "#FF3300", 60, 0.2);
    const sweepR = addSpot(8, 7.1, -3, -2, -1, -7, "#CC1800", 60, 0.2);

    // ── DJ key — single focused spot ─────────────────────────────────
    const djSpot = addSpot(0, 7.1, -5, 0, 0.5, -9.5, "#FF8050", 200, 0.22);
    djSpot.castShadow = false;

    const addPoint = (x: number, y: number, z: number, color: string, intens: number, dist = 8) => {
      const l = new THREE.PointLight(new THREE.Color(color), intens, dist, 2);
      l.position.set(x, y, z); scene.add(l); return l;
    };

    // Floor accent pools — left and right only
    addPoint(-3, -1.5, -3, "#F44A22", 25);
    addPoint(3, -1.5, -3,  "#CC2200", 20);

    // ── Ceiling light rigs (visible fixture sources for every spotlight) ──
    const trussMatl = new THREE.MeshStandardMaterial({ color: "#1E1C24", metalness: 0.9, roughness: 0.25 });

    // Simple straight-down PAR can — hangs from truss, lens faces floor
    // The actual spotlight direction is unchanged; this is purely the visible source geometry
    const addFixture = (px: number, py: number, pz: number, lensColor: string, tiltX = 0, tiltZ = 0) => {
      // Mount clamp (sits on truss bar)
      const clampMat = new THREE.MeshStandardMaterial({ color: "#2E2C38", metalness: 0.8, roughness: 0.3 });
      const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.10, 0.16), clampMat);
      clamp.position.set(px, py, pz);
      scene.add(clamp);

      // Short hanging rod
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 6), trussMatl);
      rod.position.set(px, py - 0.14, pz);
      scene.add(rod);

      // PAR can housing — wide end down, tapers up
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.09, 0.30, 10), trussMatl);
      housing.position.set(px, py - 0.38, pz);
      // Slight tilt so the fixture visually aims at its target
      housing.rotation.x = tiltX;
      housing.rotation.z = tiltZ;
      scene.add(housing);

      // Glowing lens disc at the wide (bottom) end of the housing
      const lensMat = new THREE.MeshStandardMaterial({
        color: lensColor,
        emissive: new THREE.Color(lensColor),
        emissiveIntensity: 5,
        roughness: 0.05,
      });
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.018, 16), lensMat);
      lens.position.set(
        px + Math.sin(tiltZ) * 0.15,
        py - 0.545,
        pz + Math.sin(tiltX) * 0.15
      );
      scene.add(lens);
    };

    // Truss 1: spans across ceiling at z=-5, y=7.1 — wash + DJ key
    const truss1 = new THREE.Mesh(new THREE.BoxGeometry(18, 0.08, 0.08), trussMatl);
    truss1.position.set(0, 7.1, -5);
    scene.add(truss1);

    // Truss 2: spans across ceiling at z=-3, y=7.1 — sweep spots (wider, near front)
    const truss2 = new THREE.Mesh(new THREE.BoxGeometry(20, 0.08, 0.08), trussMatl);
    truss2.position.set(0, 7.1, -3);
    scene.add(truss2);

    // PAR cans on truss 1 — tilt angle approximates direction to target
    addFixture(-5,  7.1, -5, "#FF4400",  0.28,  0.35); // wash left  → tilts right + fwd
    addFixture( 5,  7.1, -5, "#CC2000",  0.28, -0.35); // wash right → tilts left + fwd
    addFixture( 0,  7.1, -5, "#FF8050",  0.55,  0.00); // DJ key     → tilts fwd toward booth

    // PAR cans on truss 2 — sweep spots, wide throw
    addFixture(-8,  7.1, -3, "#FF3300",  0.18,  0.60); // sweep left → aims right across floor
    addFixture( 8,  7.1, -3, "#CC1800",  0.18, -0.60); // sweep right → aims left across floor

    // ── Room ──────────────────────────────────────────────────────────
    // Reflective dance floor (sharper: roughness 0.01)
    addMesh(
      new THREE.PlaneGeometry(28, 28),
      new THREE.MeshStandardMaterial({ color: "#08000E", roughness: 0.01, metalness: 0.97 }),
      [0, -2, -4], [-Math.PI / 2, 0, 0], true
    );
    addMesh(new THREE.PlaneGeometry(28, 12), new THREE.MeshStandardMaterial({ color: "#040208", roughness: 0.98 }), [0, 8, -4], [Math.PI / 2, 0, 0]);
    addMesh(new THREE.PlaneGeometry(28, 12), new THREE.MeshStandardMaterial({ color: "#0A0710" }), [0, 2, -13]);
    addMesh(new THREE.PlaneGeometry(20, 12), new THREE.MeshStandardMaterial({ color: "#0A0710" }), [-9, 2, -3], [0, Math.PI / 2, 0], true);
    addMesh(new THREE.PlaneGeometry(20, 12), new THREE.MeshStandardMaterial({ color: "#0A0710" }), [9, 2, -3], [0, -Math.PI / 2, 0], true);

    // ── LED strips ────────────────────────────────────────────────────
    addMesh(new THREE.BoxGeometry(18, 0.07, 0.07), emissiveMat("#F44A22", 2.5), [0, 7.9, -13]);
    addMesh(new THREE.BoxGeometry(20, 0.07, 0.07), emissiveMat("#F44A22", 2.0), [-9, 7.9, -3], [0, Math.PI / 2, 0]);
    addMesh(new THREE.BoxGeometry(20, 0.07, 0.07), emissiveMat("#F44A22", 2.0), [9, 7.9, -3], [0, Math.PI / 2, 0]);
    addMesh(new THREE.BoxGeometry(20, 0.05, 0.05), emissiveMat("#CC1800", 1.2), [-9, -1.9, -3], [0, Math.PI / 2, 0]);
    addMesh(new THREE.BoxGeometry(20, 0.05, 0.05), emissiveMat("#CC1800", 1.2), [9, -1.9, -3], [0, Math.PI / 2, 0]);
    for (const x of [-9, 9]) {
      for (const z of [-0.5, -5, -9]) {
        addMesh(new THREE.BoxGeometry(0.05, 10, 0.05), emissiveMat("#F44A22", 1.2), [x, 2, z]);
      }
    }

    // ── Curtain banners — left and right walls ───────────────────────
    const CURTAIN_H   = 8.0;   // full drop height
    const CURTAIN_TOP = 7.0;   // ceiling attachment y
    const curtainMat  = new THREE.MeshPhongMaterial({
      color: "#3A0808", specular: new THREE.Color("#8B1A1A"), shininess: 8,
      side: THREE.DoubleSide,
    });
    const curtainTrimMat = new THREE.MeshPhongMaterial({
      color: "#7A3A00", specular: new THREE.Color("#CC6600"), shininess: 30,
      side: THREE.DoubleSide,
    });

    const curtainPanels: THREE.Mesh[] = [];

    // Helper: add one curtain panel (box facing YZ plane) and store for animation
    const addCurtainPanel = (x: number, z: number, w: number) => {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, CURTAIN_H, w),
        curtainMat
      );
      // Start fully collapsed at top (scale.y=0.001, position at top)
      panel.scale.y = 0.001;
      panel.position.set(x, CURTAIN_TOP, z);
      scene.add(panel);
      curtainPanels.push(panel);

      // Gold trim strip on front edge of panel
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.08, CURTAIN_H, 0.04), curtainTrimMat);
      trim.scale.y = 0.001;
      trim.position.set(x, CURTAIN_TOP, z - w / 2 + 0.02);
      scene.add(trim);
      curtainPanels.push(trim);

      return panel;
    };

    // LEFT wall (x=-8.8) — 3 overlapping pleated panels across z=-3 to z=-8
    addCurtainPanel(-8.85, -3.8, 1.6);
    addCurtainPanel(-8.85, -5.5, 1.4);
    addCurtainPanel(-8.85, -7.2, 1.5);

    // RIGHT wall (x=+8.8) — matching 3 panels
    addCurtainPanel(8.85, -3.8, 1.6);
    addCurtainPanel(8.85, -5.5, 1.4);
    addCurtainPanel(8.85, -7.2, 1.5);

    // Rod from which curtains hang (thin cylinder at top)
    const rodMat = new THREE.MeshStandardMaterial({ color: "#5C3A00", metalness: 0.7, roughness: 0.4 });
    const addRod = (x: number) => {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 5.2, 8), rodMat);
      rod.rotation.z = Math.PI / 2;
      rod.position.set(x, CURTAIN_TOP + 0.12, -5.5);
      scene.add(rod);
    };
    addRod(-8.85);
    addRod(8.85);

    // ── Light beam cones (opacity 0.14) ───────────────────────────────
    // Beams placed further back so they don't overwhelm the near camera
    const beamMat = new THREE.MeshBasicMaterial({
      color: "#CC2200", transparent: true, opacity: 0.07,
      side: THREE.BackSide, depthWrite: false,
    });
    const addBeam = (x: number, z: number, rz: number) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1.6, 9, 16, 1, true), beamMat);
      b.position.set(x, 3, z); b.rotation.z = rz;
      scene.add(b); return b;
    };
    const beamL = addBeam(-4, -7, 0.15);
    const beamR = addBeam(4, -7, -0.15);

    // ── Disco ball — CubeCamera real reflections ──────────────────────
    const cubeRT = new THREE.WebGLCubeRenderTarget(256);
    (cubeRT.texture as THREE.Texture).type = THREE.HalfFloatType;
    const cubeCamera = new THREE.CubeCamera(0.1, 50, cubeRT);
    cubeCamera.position.set(0, 5.5, -3.5);
    scene.add(cubeCamera);

    const discoBall = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.78, 3),
      new THREE.MeshStandardMaterial({
        envMap: cubeRT.texture,
        roughness: 0.0, metalness: 1.0,
        color: "#FFFFFF", envMapIntensity: 1.8,
      })
    );
    discoBall.position.set(0, 5.5, -3.5);
    discoBall.castShadow = true;
    scene.add(discoBall);

    const ballKey = new THREE.PointLight("#FFFFFF", 18, 5, 2);
    ballKey.position.set(1.5, 6.5, -2);
    scene.add(ballKey);

    // 6 orbit scatter lights — dimmer, coloured
    const orbitLights = [
      new THREE.PointLight("#FF3300",  5, 9, 1),
      new THREE.PointLight("#FFFFFF",  6, 8, 1),
      new THREE.PointLight("#FF7700",  4, 9, 1),
      new THREE.PointLight("#FFD700",  5, 8, 1),
      new THREE.PointLight("#FF2200",  4, 9, 1),
      new THREE.PointLight("#FFFFFF",  5, 8, 1),
    ];
    orbitLights.forEach((l) => scene.add(l));

    // Hanging wire — from ceiling (Y=8) down to top of ball (Y=6.28)
    // Height = 1.72, centre Y = 7.14
    addMesh(
      new THREE.CylinderGeometry(0.018, 0.018, 1.72, 6),
      new THREE.MeshStandardMaterial({ color: "#888", metalness: 0.8, roughness: 0.3 }),
      [0, 7.14, -3.5]
    );
    // Small ceiling mount bracket
    addMesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.06, 12),
      new THREE.MeshStandardMaterial({ color: "#666", metalness: 0.9, roughness: 0.2 }),
      [0, 7.96, -3.5]
    );

    // ── DJ Booth ──────────────────────────────────────────────────────
    const BOOTH_Z = -9.5, BOOTH_Y = -1;
    addMesh(new THREE.BoxGeometry(5.5, 0.22, 2), new THREE.MeshStandardMaterial({ color: "#0E0C14", roughness: 0.9 }), [0, BOOTH_Y, BOOTH_Z]);
    addMesh(new THREE.BoxGeometry(1.5, 0.75, 1.3), new THREE.MeshStandardMaterial({ color: "#110F1C", roughness: 0.85 }), [-1.3, BOOTH_Y + 0.48, BOOTH_Z]);
    addMesh(new THREE.BoxGeometry(1.5, 0.75, 1.3), new THREE.MeshStandardMaterial({ color: "#110F1C", roughness: 0.85 }), [1.3, BOOTH_Y + 0.48, BOOTH_Z]);
    addMesh(new THREE.BoxGeometry(1.8, 0.08, 1.2), new THREE.MeshStandardMaterial({ color: "#161220" }), [0, BOOTH_Y + 0.5, BOOTH_Z]);
    const lblL = addMesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 32), new THREE.MeshStandardMaterial({ color: "#1A1826", metalness: 0.4, roughness: 0.6 }), [-1.3, BOOTH_Y + 0.92, BOOTH_Z]);
    const lblR = addMesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 32), new THREE.MeshStandardMaterial({ color: "#1A1826", metalness: 0.4, roughness: 0.6 }), [1.3, BOOTH_Y + 0.92, BOOTH_Z]);
    addMesh(new THREE.CylinderGeometry(0.12, 0.12, 0.045, 24), emissiveMat("#F44A22", 2.5), [-1.3, BOOTH_Y + 0.97, BOOTH_Z]);
    addMesh(new THREE.CylinderGeometry(0.12, 0.12, 0.045, 24), emissiveMat("#F44A22", 2.5), [1.3, BOOTH_Y + 0.97, BOOTH_Z]);
    addMesh(new THREE.BoxGeometry(5.5, 0.06, 0.06), emissiveMat("#F44A22", 6), [0, BOOTH_Y + 0.12, BOOTH_Z - 1]);
    addMesh(new THREE.BoxGeometry(3.2, 1.4, 0.06), emissiveMat("#280E00", 1.8), [0, BOOTH_Y + 0.38, BOOTH_Z - 0.97]);

    // ── DJ lighting — front fill + rim ───────────────────────────────
    addPoint(0, 3.0, -4.5, "#FF8050", 110, 10); // strong warm front fill
    addPoint(0, 1.8, -11,  "#F44A22",  55,  6); // rim from behind
    addPoint(-1.5, 2.5, -7, "#FF6030",  45, 8); // side key left
    addPoint(1.5, 2.5, -7,  "#FF5020",  35, 8); // side fill right

    // ── DJ Figure ─────────────────────────────────────────────────────
    // Separate materials per body region so the figure reads clearly under orange light
    const djSkinMat  = new THREE.MeshPhongMaterial({ color: "#8B5E3C", specular: new THREE.Color("#C08050"), shininess: 28 });
    const djShirtMat = new THREE.MeshPhongMaterial({ color: "#D0C8FF", specular: new THREE.Color("#FFFFFF"),  shininess: 45 }); // light lavender — glows warm under orange
    const djPantsMat = new THREE.MeshPhongMaterial({ color: "#101828", specular: new THREE.Color("#1A2840"),  shininess: 18 }); // dark navy
    const djHpMat    = new THREE.MeshPhongMaterial({ color: "#0A0818", shininess: 60 }); // headphone band — dark gloss

    const DJ_Z = BOOTH_Z + 0.1, BASE = BOOTH_Y + 0.11;

    // Single root group — all body parts are LOCAL children, positions in local space
    const djRoot = new THREE.Group();
    djRoot.position.set(0, BASE, DJ_Z);
    scene.add(djRoot);

    const djShoesMat = new THREE.MeshPhongMaterial({ color: "#0A0A14", shininess: 35 });

    // Shoes
    [-0.12, 0.12].forEach(sx => {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.30), djShoesMat);
      shoe.position.set(sx, 0.045, 0.06);
      djRoot.add(shoe);
    });

    // Lower legs
    [-0.12, 0.12].forEach(sx => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.52, 0.16), djPantsMat);
      leg.position.set(sx, 0.35, 0);
      djRoot.add(leg);
    });

    // Hips
    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.30, 0.22), djPantsMat);
    hips.position.set(0, 0.76, 0);
    djRoot.add(hips);

    // Torso (keep ref for bob animation)
    const djTorso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 0.25), djShirtMat);
    djTorso.position.set(0, 1.32, 0);
    djTorso.castShadow = true;
    djRoot.add(djTorso);

    // Neck
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.094, 0.20, 8), djSkinMat);
    neckMesh.position.set(0, 1.74, 0);
    djRoot.add(neckMesh);

    // Head GROUP — headphones are children so they follow every head movement
    const djHead = new THREE.Group();
    djHead.position.set(0, 2.06, 0);
    djRoot.add(djHead);

    const djHeadMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), djSkinMat);
    djHeadMesh.castShadow = true;
    djHead.add(djHeadMesh);

    // Headphones on head (local to djHead)
    const hpBand = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.052, 8, 24), djHpMat);
    hpBand.rotation.x = Math.PI / 2;
    djHead.add(hpBand);
    [-0.26, 0.26].forEach(hx => {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.062, 12), djHpMat);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(hx, 0, 0);
      djHead.add(cup);
    });

    // ── LEFT arm: shoulder pivot → upper arm → elbow pivot → forearm → hand ──
    // Rotating lShoulderPivot swings the ENTIRE left arm from the shoulder.
    // Rotating lElbowPivot bends only the forearm+hand from the elbow.
    const lShoulderPivot = new THREE.Group();
    lShoulderPivot.position.set(-0.32, 1.63, 0); // shoulder joint in local space
    djRoot.add(lShoulderPivot);

    const lUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.46, 0.14), djShirtMat);
    lUpperArm.position.set(0, -0.23, 0); // centre of upper arm hangs below pivot
    lShoulderPivot.add(lUpperArm);

    const lElbowPivot = new THREE.Group();
    lElbowPivot.position.set(0, -0.46, 0); // elbow joint at tip of upper arm
    lShoulderPivot.add(lElbowPivot);

    const lForeArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.12), djSkinMat);
    lForeArm.position.set(0, -0.21, 0);
    lElbowPivot.add(lForeArm);

    const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.10, 0.07), djSkinMat);
    lHand.position.set(0, -0.47, 0); // wrist
    lElbowPivot.add(lHand);

    // ── RIGHT arm hierarchy ──
    const rShoulderPivot = new THREE.Group();
    rShoulderPivot.position.set(0.32, 1.63, 0);
    djRoot.add(rShoulderPivot);

    const rUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.46, 0.14), djShirtMat);
    rUpperArm.position.set(0, -0.23, 0);
    rShoulderPivot.add(rUpperArm);

    const rElbowPivot = new THREE.Group();
    rElbowPivot.position.set(0, -0.46, 0);
    rShoulderPivot.add(rElbowPivot);

    const rForeArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.12), djSkinMat);
    rForeArm.position.set(0, -0.21, 0);
    rElbowPivot.add(rForeArm);

    const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.10, 0.07), djSkinMat);
    rHand.position.set(0, -0.47, 0);
    rElbowPivot.add(rHand);

    // Initial rest pose (arms reaching down toward decks)
    lShoulderPivot.rotation.z = -0.9;
    lElbowPivot.rotation.z    = -0.5;
    rShoulderPivot.rotation.z =  0.75;
    rElbowPivot.rotation.z    =  0.4;

    // Laptop screen on the booth (glowing blue-white monitor in front of DJ)
    addMesh(new THREE.BoxGeometry(0.72, 0.45, 0.03), emissiveMat("#1A3AFF", 1.2), [0, BOOTH_Y + 0.82, BOOTH_Z - 0.52], [-0.35, 0, 0]);
    addMesh(new THREE.BoxGeometry(0.75, 0.03, 0.32), new THREE.MeshPhongMaterial({ color: "#111", shininess: 40 }), [0, BOOTH_Y + 0.60, BOOTH_Z - 0.54]);
    // EQ bar strip above front LED — small orange bars
    for (let i = 0; i < 7; i++) {
      const h = 0.04 + Math.random() * 0.10;
      addMesh(new THREE.BoxGeometry(0.06, h, 0.04), emissiveMat("#F44A22", 3.5), [-0.22 + i * 0.075, BOOTH_Y + 0.22 + h / 2, BOOTH_Z - 0.99]);
    }
    // Monitor bounce — warm uplight from screen
    addPoint(0, BOOTH_Y + 1.1, BOOTH_Z - 0.4, "#3060FF", 30, 3);

    // ── Coins — MeshPhongMaterial + Z-drift ───────────────────────────
    const coinMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.03, 28),
      new THREE.MeshPhongMaterial({
        color: "#B8900A",
        specular: new THREE.Color("#D4B030"),
        shininess: 60,
      }),
      COIN_COUNT
    );
    scene.add(coinMesh);

    const coinData = Array.from({ length: COIN_COUNT }, () => ({
      x: (Math.random() - 0.5) * 12,
      y: 1.5 + Math.random() * 6,
      baseZ: -0.5 - Math.random() * 8, // fixed depth lane
      speed: 1.8 + Math.random() * 2.8,
      spinX: (Math.random() - 0.5) * 7,
      spinZ: (Math.random() - 0.5) * 4,
      delay: Math.random() * 0.5,
      phase: 0,
      rotX: Math.random() * Math.PI * 2,
      rotZ: Math.random() * Math.PI,
    }));
    const dummy = new THREE.Object3D();

    // ── Audience crowd ────────────────────────────────────────────────
    const FLOOR_Y = -2;

    // Visible crowd colors — warm mid-tones so spotlight hits them clearly
    const crowdMats = [
      new THREE.MeshPhongMaterial({ color: "#A0607A", shininess: 20 }),
      new THREE.MeshPhongMaterial({ color: "#7A4A90", shininess: 18 }),
      new THREE.MeshPhongMaterial({ color: "#905060", shininess: 22 }),
      new THREE.MeshPhongMaterial({ color: "#6A4880", shininess: 16 }),
    ];

    // Crowd lights — decay=0 so they don't fall off with distance, guaranteed illumination
    const addCrowdLight = (x: number, y: number, z: number, color: string, intensity: number) => {
      const l = new THREE.PointLight(new THREE.Color(color), intensity, 0, 0);
      l.position.set(x, y, z);
      scene.add(l);
    };
    addCrowdLight(  0, 4.0, -5.0, "#FF7040", 1.8);
    addCrowdLight( -4, 3.5, -5.5, "#FF5530", 1.4);
    addCrowdLight(  4, 3.5, -5.5, "#FF5530", 1.4);
    addCrowdLight( -2, 3.5, -7.0, "#FF4420", 1.4);
    addCrowdLight(  2, 3.5, -7.0, "#FF4420", 1.4);
    addCrowdLight(  0, 3.5, -8.0, "#FF3300", 1.2);

    type CrowdFigure = { lArm: THREE.Mesh; rArm: THREE.Mesh; phase: number; bobSpeed: number };
    const crowdFigures: CrowdFigure[] = [];

    // Seeded deterministic random (so same layout every load)
    let seed = 42;
    const rng = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };

    const addCrowdPerson = (x: number, z: number, scale: number, armRaise: boolean, phase: number) => {
      const h = FLOOR_Y;
      const s = scale;
      const mat = crowdMats[Math.floor(rng() * crowdMats.length)];
      const yaw = (rng() - 0.5) * 1.2; // random facing direction

      // Legs
      addMesh(new THREE.BoxGeometry(0.13*s, 0.45*s, 0.13*s), mat, [x - 0.10*s, h + 0.225*s, z]).rotation.y = yaw;
      addMesh(new THREE.BoxGeometry(0.13*s, 0.45*s, 0.13*s), mat, [x + 0.10*s, h + 0.225*s, z]).rotation.y = yaw;
      // Torso
      const torso = addMesh(new THREE.BoxGeometry(0.40*s, 0.60*s, 0.22*s), mat, [x, h + 0.75*s, z]);
      torso.rotation.y = yaw;
      // Head
      addMesh(new THREE.SphereGeometry(0.15*s, 7, 7), mat, [x, h + 1.20*s, z]);
      // Arms
      const lx = x + Math.sin(yaw) * -0.28*s;
      const rx = x + Math.sin(yaw) *  0.28*s;
      const lArm = addMesh(new THREE.BoxGeometry(0.11*s, 0.42*s, 0.11*s), mat, [lx - 0.18*s, h + 0.80*s, z]);
      const rArm = addMesh(new THREE.BoxGeometry(0.11*s, 0.42*s, 0.11*s), mat, [rx + 0.18*s, h + 0.80*s, z]);
      lArm.rotation.z = armRaise ? -2.2 + (rng()-0.5)*0.3 : -0.3 - rng()*0.4;
      rArm.rotation.z = armRaise ?  2.2 - (rng()-0.5)*0.3 :  0.3 + rng()*0.4;

      // Phone / glow stick held up
      if (armRaise) {
        const phoneColor = rng() > 0.5 ? "#C8E0FF" : "#AAFFCC";
        addMesh(
          new THREE.BoxGeometry(0.04*s, 0.07*s, 0.01),
          new THREE.MeshStandardMaterial({ emissive: new THREE.Color(phoneColor), emissiveIntensity: 9, roughness: 0.05 }),
          [lx - 0.18*s, h + 1.32*s, z]
        );
      }

      crowdFigures.push({ lArm, rArm, phase, bobSpeed: 0.8 + rng() * 0.5 });
    };

    // Fully random placement — no rows
    // 32 people scattered across the dance floor (z -4 to -8, x -6.5 to 6.5)
    // Avoid dead-centre front (x -0.8 to 0.8, z -4 to -5.5) so DJ stays visible
    const placed: [number, number][] = [];
    let attempts = 0;
    while (placed.length < 32 && attempts < 400) {
      attempts++;
      const px = (rng() - 0.5) * 13;   // -6.5 to 6.5
      const pz = -4.0 - rng() * 4.2;   // -4 to -8.2
      // Skip centre-front (obstructs DJ view)
      if (Math.abs(px) < 1.2 && pz > -6.0) continue;
      // Min spacing between figures
      if (placed.some(([ox, oz]) => Math.hypot(px - ox, pz - oz) < 0.9)) continue;
      placed.push([px, pz]);
    }

    placed.forEach(([px, pz], i) => {
      const depthScale = 0.88 + (Math.abs(pz + 4) / 4.2) * 0.10; // slightly smaller deeper
      const armUp = rng() > 0.45; // ~55% have arm raised
      addCrowdPerson(px, pz, depthScale, armUp, i * 0.63);
    });

    // ── Animation loop ────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let animId: number;
    let frameCount = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta   = Math.min(clock.getDelta(), 0.033);
      const elapsed = clock.getElapsedTime();
      frameCount++;

      // ── Camera: tight on DJ → smooth zoom-out to reveal full party ──
      // Phase 1 (0–2s): hold close on DJ, slight creep back
      // Phase 2 (2–9s): zoom out to show full room + disco ball
      const holdT  = Math.min(elapsed / 2, 1);                         // 0→1 over first 2s
      const zoomT  = Math.max(0, Math.min((elapsed - 2) / 7, 1));      // 0→1 over 2s–9s
      const eased  = 1 - Math.pow(1 - zoomT, 3);                       // easeOutCubic

      // Z: -7 (right at booth) → -6 (tiny creep) → 5.5 (full room)
      camera.position.z = -7.0 + holdT * 0.8 + eased * 12.3;
      // Y: 0.8 (torso level) → 2.8 (elevated, sees disco ball)
      camera.position.y = 0.8 + eased * 2.0;
      camera.position.x = 0; // locked centre — no drift

      // lookAt: stays locked on DJ during hold, then smoothly sweeps to room centre
      const lookZ = -9.5 + eased * 5.0;   // -9.5 → -4.5
      const lookY =  1.2 + eased * 2.8;   // 1.2  → 4.0 (disco ball enters upper frame)
      camera.lookAt(0, lookY, lookZ);

      // ── Disco ball ── (cube camera every 6 frames — still looks live, half the cost)
      discoBall.rotation.y += delta * 0.55;
      discoBall.rotation.x  = Math.sin(elapsed * 0.35) * 0.12;
      if (frameCount % 6 === 0) {
        discoBall.visible = false;
        cubeCamera.update(renderer, scene);
        discoBall.visible = true;
      }

      const { x: bx, y: by, z: bz } = discoBall.position;
      orbitLights.forEach((l, i) => {
        const a = elapsed * 1.5 + (i * Math.PI * 2) / orbitLights.length;
        l.position.set(
          bx + Math.cos(a) * 3,
          by + Math.sin(elapsed * 0.9 + i) * 1.2,
          bz + Math.sin(a) * 3
        );
      });

      // ── Sweep spots ──
      const sa = elapsed * 0.9;
      sweepL.target.position.set(Math.sin(sa) * 5, -1.5, -6);
      sweepR.target.position.set(Math.sin(sa + Math.PI) * 5, -1.5, -6);
      sweepL.target.updateMatrixWorld();
      sweepR.target.updateMatrixWorld();

      // ── Curtain unfurl — panels drop from ceiling over 2.5s ──────────
      const curtainProg = Math.min(elapsed / 2.5, 1);
      const curtainEase = 1 - Math.pow(1 - curtainProg, 3); // easeOutCubic
      curtainPanels.forEach((p) => {
        p.scale.y = Math.max(curtainEase, 0.001);
        p.position.y = CURTAIN_TOP - (CURTAIN_H / 2) * curtainEase;
      });

      // ── Beam sway ──
      beamL.rotation.z = 0.18  + Math.sin(elapsed * 1.1) * 0.06;
      beamR.rotation.z = -0.18 - Math.sin(elapsed * 1.1) * 0.06;

      // ── Turntable labels spin ──
      lblL.rotation.y += delta * 3.2;
      lblR.rotation.y -= delta * 3.2;

      // ── DJ playing animation — realistic deck control ──────────────
      // BPM constants (128 BPM ≈ 2.133 Hz)
      const BPM    = elapsed * Math.PI * 2.133;  // one full cycle per beat
      const HALF   = elapsed * Math.PI * 1.067;  // half-time groove
      const PHRASE = (elapsed % 8) / 8;           // 8-beat phrase 0→1

      // Whole-body groove: subtle bob on every beat, sway on half-time
      const bob  = Math.sin(BPM)  * 0.025;
      const sway = Math.sin(HALF) * 0.018;

      // Root slight lean forward (toward decks) — always engaged
      djRoot.rotation.x = 0.12 + Math.sin(HALF * 0.5) * 0.03;

      // Head: looks DOWN at decks most of the time, occasional head-raise on phrase end
      const headUp = PHRASE > 0.88 ? (PHRASE - 0.88) / 0.12 : 0; // 0→1 over last 12% of phrase
      djHead.position.y = 2.06 + bob;
      djHead.position.x = sway * 0.8;
      djHead.rotation.x = -0.28 + headUp * 0.32;  // looking down → looking out
      djHead.rotation.z = -sway * 1.2;

      // Torso bobs and sways
      djTorso.position.y = 1.32 + bob * 0.7;
      djTorso.rotation.z = sway;
      djTorso.rotation.x = 0.08; // permanent forward hunch over decks

      // LEFT arm — scratch motion: wrist moves left-right rapidly over left deck
      // Shoulder stays mostly fixed (arm extended to deck), elbow provides wrist sweep
      lShoulderPivot.rotation.z = -0.72 + sway * 0.4;
      lShoulderPivot.rotation.x =  0.55; // reaching forward onto deck
      const scratchFreq = elapsed * Math.PI * 5.8; // ~3.5× BPM, fast scratch
      const scratchAmp  = 0.18 + Math.sin(BPM * 0.5) * 0.06; // amplitude pulses
      lElbowPivot.rotation.z = -0.22 + Math.sin(scratchFreq) * scratchAmp;
      lElbowPivot.rotation.x = -0.15 + Math.sin(scratchFreq * 0.5) * 0.08;

      // RIGHT arm — fader/EQ control: slower deliberate up-down movement
      rShoulderPivot.rotation.z =  0.62 - sway * 0.3;
      rShoulderPivot.rotation.x =  0.48; // reaching forward to mixer
      const faderPush = Math.sin(BPM * 0.5) * 0.22;   // fader moves on half-beats
      const knobTweak = Math.sin(elapsed * 1.4) * 0.12; // slower EQ tweak
      rElbowPivot.rotation.z = 0.28 + faderPush;
      rElbowPivot.rotation.x = -0.12 + knobTweak;

      // Phrase-end: raise right fist on drop (every 8 beats)
      if (PHRASE > 0.90) {
        const dropT = (PHRASE - 0.90) / 0.10;
        rShoulderPivot.rotation.z = 0.62 - dropT * 1.4;  // arm swings up
        rShoulderPivot.rotation.x = 0.48 - dropT * 0.6;
        rElbowPivot.rotation.z    = 0.28 - dropT * 0.5;
      }

      // ── Crowd — throttled to every 2nd frame for perf ──
      if (frameCount % 2 === 0) {
        crowdFigures.forEach((fig) => {
          const t = elapsed * fig.bobSpeed * Math.PI * 2 + fig.phase;
          const pump = Math.sin(t) * 0.45;
          fig.lArm.rotation.z = -2.3 + pump;
          fig.rArm.rotation.z =  2.3 - pump * 0.7;
        });
      }

      // ── Coins — fall + Z-axis drift for depth ──
      coinData.forEach((c, i) => {
        c.phase += delta;
        if (c.phase < c.delay) return;
        c.y     -= c.speed * delta;
        c.rotX  += c.spinX * delta;
        c.rotZ  += c.spinZ * delta;
        if (c.y < -1.8) {
          c.y = 2 + Math.random() * 5;
          c.x = (Math.random() - 0.5) * 12;
        }
        // Z drifts sinusoidally around the base lane
        const driftZ = c.baseZ + Math.sin(elapsed * 1.2 + c.phase * 3) * 0.3;
        dummy.position.set(c.x, c.y, driftZ);
        dummy.rotation.set(c.rotX, 0, c.rotZ);
        dummy.updateMatrix();
        coinMesh.setMatrixAt(i, dummy.matrix);
      });
      coinMesh.instanceMatrix.needsUpdate = true;


      composer.render();
    };
    animate();

    // ── Resize ────────────────────────────────────────────────────────
    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      composer.setSize(container.clientWidth, container.clientHeight);
      bloomPass.resolution.set(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      composer.dispose();
      renderer.dispose();
      cubeRT.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
