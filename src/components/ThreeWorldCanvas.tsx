import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { REGIONS } from '../data/regionsData';
import { GameMode } from '../types';
import {
  createUniverseFinaleFX,
  disposeUniverseFinaleFX,
  universeFinaleCamera,
  updateUniverseFinaleFX,
} from './universeFinaleFX';
import type { UniverseFinaleFX } from './universeFinaleFX';

/** Cómo se ve un mesh "en reposo": lo que hace falta para volver ahí después
 * de una animación de victoria/derrota, sin conocer de antemano qué mesh es
 * ni qué animación le van a aplicar. */
interface FinishMeshSnapshot {
  visible: boolean;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  opacity: number | null;
}

function snapshotFinishMesh(obj: THREE.Object3D): FinishMeshSnapshot {
  const mat = 'material' in obj ? (obj as THREE.Mesh).material : undefined;
  const opacity = mat && !Array.isArray(mat) && 'opacity' in mat ? (mat as THREE.MeshBasicMaterial).opacity : null;
  return {
    visible: obj.visible,
    position: obj.position.clone(),
    rotation: obj.rotation.clone(),
    opacity,
  };
}

function restoreFinishMesh(obj: THREE.Object3D, snap: FinishMeshSnapshot) {
  obj.visible = snap.visible;
  obj.position.copy(snap.position);
  obj.rotation.copy(snap.rotation);
  if (snap.opacity !== null) {
    const mat = 'material' in obj ? (obj as THREE.Mesh).material : undefined;
    if (mat && !Array.isArray(mat) && 'opacity' in mat) (mat as THREE.MeshBasicMaterial).opacity = snap.opacity;
  }
}
import {
  createRunnerCharacter,
  createKnightHeroCharacter,
  createGolemEnemyCharacter,
  createMerchantCharacter,
  createCustomerCharacter,
  createExplorerCharacter,
  createDetectiveCharacter,
  RunnerCharacterResult,
  KnightHeroResult,
  GolemEnemyResult,
  MerchantCharacterResult,
  CustomerCharacterResult,
  ExplorerCharacterResult,
  DetectiveCharacterResult,
} from './characterBuilder3D';

interface ThreeWorldCanvasProps {
  viewMode: 'map' | 'game';
  currentRegionId: string;
  gameMode: GameMode;
  questionIndex: number;
  totalQuestions: number;
  isCorrect: boolean | null;
  heroHp: number;
  enemyHp: number;
  bridgeBuiltSegments: number;
  raceProgress?: number;
  shopCartTotal?: number;
  cluesFound?: number;
  gameWon?: boolean;
  gameOver?: boolean;
  onSelectRegion?: (regionId: string) => void;
  onWebGLError?: () => void;
  /** Id de la región recién desbloqueada mientras dura la celebración 3D (null = ninguna). */
  unlockingRegionId?: string | null;
  /** Gran Final "universo completado" activo: monta el FX 3D y la cámara cinematográfica en el mapa. */
  universeFinaleActive?: boolean;
}

// ==========================================
// FX 3D "MARIO GALAXY" DE REGIÓN DESBLOQUEADA
// ==========================================
// Porta 1:1 el FX del prototipo (candado dorado que retumba y explota en
// fragmentos, haz de luz, anillos, estrellas orbitando, flecha flotante).
interface GalaxyUnlockFXData {
  group: THREE.Group;
  beamMesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
  lockGroup: THREE.Group;
  fragmentsGroup: THREE.Group;
  fragments: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; rotSpd: number }[];
  starsGroup: THREE.Group;
  starMeshes: THREE.Mesh[];
  pointerGroup: THREE.Group;
  targetRegionId: string;
}

function createMarioGalaxyUnlockFX(regionPos: [number, number, number], themeColor = '#f59e0b'): GalaxyUnlockFXData {
  const group = new THREE.Group();
  group.position.set(...regionPos);

  // 1. Haz de luz celestial descendiendo
  const beamGeo = new THREE.CylinderGeometry(0.9, 2.0, 36, 24, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beamMesh = new THREE.Mesh(beamGeo, beamMat);
  beamMesh.position.y = 16;
  group.add(beamMesh);

  // 2. Anillos de choque pulsantes sobre la isla
  const ringGeo = new THREE.RingGeometry(2.2, 3.2, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.position.y = 0.55;
  group.add(ringMesh);

  // 3. Candado 3D dorado
  const lockGroup = new THREE.Group();
  lockGroup.position.set(0, 2.5, 0);

  const lockBodyMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.85,
    roughness: 0.25,
    emissive: 0xd97706,
    emissiveIntensity: 0.45,
  });
  const lockBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.95, 0.45), lockBodyMat);
  lockGroup.add(lockBody);

  const shackleGeo = new THREE.TorusGeometry(0.48, 0.12, 12, 24, Math.PI);
  const shackleMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.92,
    roughness: 0.18,
  });
  const shackle = new THREE.Mesh(shackleGeo, shackleMat);
  shackle.position.y = 0.48;
  lockGroup.add(shackle);

  const keyhole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.05, 12),
    new THREE.MeshBasicMaterial({ color: 0x1e293b })
  );
  keyhole.rotation.x = Math.PI / 2;
  keyhole.position.z = 0.24;
  lockGroup.add(keyhole);

  group.add(lockGroup);

  // 4. Fragmentos explosivos (cristales dorados)
  const fragmentCount = 36;
  const fragGeo = new THREE.DodecahedronGeometry(0.16, 0);
  const fragMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.8,
    roughness: 0.2,
  });
  const fragments: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; rotSpd: number }[] = [];
  const fragmentsGroup = new THREE.Group();
  fragmentsGroup.position.set(0, 2.5, 0);
  fragmentsGroup.visible = false;

  for (let i = 0; i < fragmentCount; i++) {
    const frag = new THREE.Mesh(fragGeo, fragMat);
    const theta = Math.random() * Math.PI * 2;
    const phi = (Math.random() - 0.5) * Math.PI;
    const speed = 2.8 + Math.random() * 4.2;
    const vx = Math.cos(theta) * Math.cos(phi) * speed;
    const vy = Math.abs(Math.sin(phi)) * speed + 1.8;
    const vz = Math.sin(theta) * Math.cos(phi) * speed;
    fragmentsGroup.add(frag);
    fragments.push({ mesh: frag, vx, vy, vz, rotSpd: (Math.random() - 0.5) * 8 });
  }
  group.add(fragmentsGroup);

  // 5. Estrellas orbitando la isla
  const starsGroup = new THREE.Group();
  starsGroup.position.set(0, 1.2, 0);
  const starGeo = new THREE.OctahedronGeometry(0.24, 0);
  const starMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfbbf24,
    emissiveIntensity: 0.9,
    roughness: 0.1,
  });
  const starMeshes: THREE.Mesh[] = [];
  for (let s = 0; s < 5; s++) {
    const star = new THREE.Mesh(starGeo, starMat);
    starsGroup.add(star);
    starMeshes.push(star);
  }
  group.add(starsGroup);

  // 6. Flecha/puntero flotante indicando dónde tocar
  const pointerGroup = new THREE.Group();
  pointerGroup.position.set(0, 3.8, 0);
  const pointerCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 0.7, 16),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.8,
    })
  );
  pointerCone.rotation.x = Math.PI; // apunta hacia abajo
  pointerGroup.add(pointerCone);
  group.add(pointerGroup);

  return {
    group,
    beamMesh,
    ringMesh,
    lockGroup,
    fragmentsGroup,
    fragments,
    starsGroup,
    starMeshes,
    pointerGroup,
    targetRegionId: '',
  };
}

// Procedural realistic gradient sky dome (vibrant daylight blue to soft peach/gold dawn horizon)
function createProceduralSky(): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, '#1e3a8a'); // Deep celestial azure at zenith
    grad.addColorStop(0.28, '#2563eb'); // Rich daytime blue
    grad.addColorStop(0.55, '#38bdf8'); // Soft vibrant cyan
    grad.addColorStop(0.74, '#93c5fd'); // Atmospheric haze
    grad.addColorStop(0.88, '#fed7aa'); // Soft apricot dawn horizon
    grad.addColorStop(1.0, '#fef08a'); // Warm golden rim
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const skyGeo = new THREE.SphereGeometry(95, 32, 20);
  const skyMat = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
    depthWrite: false,
  });
  return new THREE.Mesh(skyGeo, skyMat);
}

// Soft volumetric cloud cluster (composite of 6 overlapping smooth spheres)
function createVolumetricCloud(scale = 1.0): THREE.Group {
  const group = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0.0,
    transparent: true,
    opacity: 0.88,
  });

  const puffs = [
    { r: 1.1, x: 0, y: 0, z: 0 },
    { r: 0.9, x: -0.9, y: -0.15, z: 0.2 },
    { r: 0.85, x: 0.9, y: -0.1, z: -0.15 },
    { r: 0.75, x: -0.4, y: 0.45, z: -0.2 },
    { r: 0.7, x: 0.4, y: 0.5, z: 0.15 },
    { r: 0.6, x: 1.4, y: -0.3, z: 0 },
    { r: 0.6, x: -1.3, y: -0.3, z: 0 },
  ];

  puffs.forEach((c) => {
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(c.r * scale, 12, 10), cloudMat);
    sphere.position.set(c.x * scale, c.y * scale, c.z * scale);
    group.add(sphere);
  });

  return group;
}

// Far mountain panorama range on the distant horizon
function createMountainPanorama(): THREE.Group {
  const mountainGroup = new THREE.Group();
  const mountainMat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    roughness: 0.95,
    transparent: true,
    opacity: 0.45,
  });
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.7,
    transparent: true,
    opacity: 0.65,
  });

  const peaks = [
    { x: -36, y: 7.5, z: -40, r: 7.5, h: 11 },
    { x: -25, y: 9.0, z: -43, r: 9.0, h: 13.5 },
    { x: -14, y: 6.5, z: -38, r: 7.0, h: 9.5 },
    { x: -3, y: 10.5, z: -45, r: 10.0, h: 15.0 },
    { x: 8, y: 8.0, z: -41, r: 8.0, h: 12.0 },
    { x: 19, y: 9.5, z: -44, r: 9.5, h: 14.0 },
    { x: 30, y: 7.5, z: -39, r: 7.5, h: 11.0 },
    { x: 40, y: 8.5, z: -42, r: 8.5, h: 12.5 },
  ];

  peaks.forEach((p) => {
    const peak = new THREE.Mesh(new THREE.ConeGeometry(p.r, p.h, 16), mountainMat);
    peak.position.set(p.x, p.y, p.z);
    mountainGroup.add(peak);

    const snow = new THREE.Mesh(new THREE.ConeGeometry(p.r * 0.45, p.h * 0.38, 16), snowMat);
    snow.position.set(p.x, p.y + p.h * 0.31, p.z);
    mountainGroup.add(snow);
  });

  return mountainGroup;
}

// ==========================================
// HIGH-FIDELITY PROCEDURAL TEXTURE GENERATORS (CACHED)
// ==========================================

const proceduralTextureCache = new Map<string, THREE.CanvasTexture>();

function getCachedTexture(key: string, creator: () => THREE.CanvasTexture): THREE.CanvasTexture {
  let tex = proceduralTextureCache.get(key);
  if (!tex) {
    tex = creator();
    proceduralTextureCache.set(key, tex);
  }
  return tex;
}

// Liberación profunda de memoria GPU (geometrías y materiales) para objetos
// dinámicos que se reconstruyen a cada cambio de juego/región. Sin esto, cada
// cambio deja geometrías y materiales huérfanos en la GPU (fuga de memoria
// en sesiones largas).
function disposeObjectHierarchy(obj: THREE.Object3D) {
  obj.traverse((child) => {
    // Mesh, pero también Points (partículas), Line (guías del puente) y Sprite: antes solo
    // se liberaban los Mesh y los demás quedaban huérfanos en la GPU en cada cambio de nivel.
    // (Las texturas procedurales son compartidas y cacheadas: no se liberan aquí.)
    const o = child as THREE.Mesh;
    if (o.isMesh || (child as THREE.Points).isPoints || (child as THREE.Line).isLine || (child as THREE.Sprite).isSprite) {
      if (o.geometry) {
        o.geometry.dispose();
      }
      if (Array.isArray(o.material)) {
        o.material.forEach((m) => m.dispose());
      } else if (o.material) {
        o.material.dispose();
      }
    }
  });
}

// Helper: Seeded pseudo-random noise for reproducible crisp patterns
function createProceduralNoiseCanvas(
  width: number,
  height: number,
  drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    drawFn(ctx, width, height);
  }
  return canvas;
}

// 1. Lush Rolling Meadow Grass Texture (Forest/Race World)
function createMeadowGrassTexture(): THREE.CanvasTexture {
  return getCachedTexture('meadow_grass', () => {
  const canvas = createProceduralNoiseCanvas(512, 512, (ctx, w, h) => {
    // Rich gradient base
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#15803d');
    grad.addColorStop(0.5, '#16a34a');
    grad.addColorStop(1, '#22c55e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Dappled clover & turf speckles
    for (let i = 0; i < 3500; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const radius = 1 + Math.random() * 2.2;
      const greenTones = ['#14532d', '#166534', '#15803d', '#4ade80', '#86efac'];
      ctx.fillStyle = greenTones[Math.floor(Math.random() * greenTones.length)];
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Organic grass blade strokes
    ctx.lineWidth = 1.2;
    for (let j = 0; j < 600; j++) {
      const gx = Math.random() * w;
      const gy = Math.random() * h;
      const len = 4 + Math.random() * 6;
      ctx.strokeStyle = Math.random() > 0.4 ? '#4ade80' : '#14532d';
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + (Math.random() - 0.5) * 4, gy - len);
      ctx.stroke();
    }
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 8);
  return tex;
  });
}

// 2. Compacted Earthen Trail with Pebbles (Race track)
function createEarthenTrackTexture(): THREE.CanvasTexture {
  return getCachedTexture('earthen_track', () => {
  const canvas = createProceduralNoiseCanvas(512, 512, (ctx, w, h) => {
    // Warm ochre dirt base
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#b45309');
    grad.addColorStop(0.5, '#d97706');
    grad.addColorStop(1, '#92400e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Embedded smooth river pebbles
    for (let i = 0; i < 1800; i++) {
      const px = Math.random() * w;
      const py = Math.random() * h;
      const pr = 1 + Math.random() * 2.8;
      const pebbleColors = ['#78350f', '#92400e', '#fef3c7', '#fde68a', '#574026'];
      ctx.fillStyle = pebbleColors[Math.floor(Math.random() * pebbleColors.length)];
      ctx.beginPath();
      ctx.ellipse(px, py, pr, pr * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle track wheel & cart ruts
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.35)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(w * 0.28, 0);
    ctx.lineTo(w * 0.28, h);
    ctx.moveTo(w * 0.72, 0);
    ctx.lineTo(w * 0.72, h);
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 8);
  return tex;
  });
}

// 3. Volcanic Basalt & Obsidian Arena Floor Texture (Mountain Arena)
function createVolcanicBasaltTexture(): THREE.CanvasTexture {
  return getCachedTexture('volcanic_basalt', () => {
  const canvas = createProceduralNoiseCanvas(512, 512, (ctx, w, h) => {
    // Deep charcoal & dark obsidian base
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, w, h);

    // Chiseled volcanic flagstones pattern
    const cols = 8;
    const rows = 8;
    const cw = w / cols;
    const ch = h / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw;
        const y = r * ch;
        const shade = Math.floor(25 + Math.random() * 25);
        ctx.fillStyle = `rgb(${shade + 10}, ${shade + 18}, ${shade + 30})`;
        ctx.fillRect(x + 2, y + 2, cw - 4, ch - 4);

        // Stone fracture lines
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, cw - 4, ch - 4);

        // Tiny fiery cinder specs
        if (Math.random() > 0.75) {
          ctx.fillStyle = Math.random() > 0.5 ? '#ea580c' : '#f97316';
          ctx.beginPath();
          ctx.arc(x + Math.random() * cw, y + Math.random() * ch, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
  });
}

// 4. European Medieval Cobblestone Plaza Texture (City Market World)
function createCobblestonePlazaTexture(): THREE.CanvasTexture {
  return getCachedTexture('cobblestone_plaza', () => {
  const canvas = createProceduralNoiseCanvas(512, 512, (ctx, w, h) => {
    // Mortar bedding background
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, w, h);

    const stoneRows = 12;
    const rowH = h / stoneRows;

    for (let r = 0; r < stoneRows; r++) {
      const rowY = r * rowH;
      const offset = (r % 2) * (w / 16);
      const stoneCols = 10;
      const stoneW = w / stoneCols;

      for (let c = -1; c <= stoneCols; c++) {
        const stoneX = c * stoneW + offset;
        const sw = stoneW - 3;
        const sh = rowH - 3;

        // Realistic weathered stone tones
        const tones = ['#64748b', '#475569', '#94a3b8', '#52525b', '#71717a'];
        ctx.fillStyle = tones[Math.floor(Math.random() * tones.length)];

        // Rounded cobblestone block
        ctx.beginPath();
        ctx.roundRect(stoneX + 1.5, rowY + 1.5, sw, sh, [4, 4, 4, 4]);
        ctx.fill();

        // Highlight bevel
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
  });
}

// 5. River Canyon Rock & Sediment Strata Texture (River World)
function createRiverSedimentTexture(): THREE.CanvasTexture {
  return getCachedTexture('river_sediment', () => {
  const canvas = createProceduralNoiseCanvas(512, 512, (ctx, w, h) => {
    // Geological stratified layers
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#475569');
    grad.addColorStop(0.3, '#334155');
    grad.addColorStop(0.5, '#64748b');
    grad.addColorStop(0.8, '#475569');
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Weathered water erosion striations
    for (let y = 0; y < h; y += 4) {
      const alpha = 0.08 + Math.random() * 0.15;
      ctx.strokeStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(15,23,42,${alpha * 1.5})`;
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.33, y + Math.sin(y * 0.1) * 6, w * 0.66, y - Math.cos(y * 0.1) * 6, w, y);
      ctx.stroke();
    }
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 4);
  return tex;
  });
}

// 6. Royal Gothic Citadel Flagstone & Rune Texture (Castle World)
function createCastleCourtyardTexture(): THREE.CanvasTexture {
  return getCachedTexture('castle_courtyard', () => {
  const canvas = createProceduralNoiseCanvas(512, 512, (ctx, w, h) => {
    // Royal midnight slate base
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(0, 0, w, h);

    // Symmetrical monumental flagstone slabs
    const size = 64;
    for (let x = 0; x < w; x += size) {
      for (let y = 0; y < h; y += size) {
        ctx.fillStyle = (x + y) % (size * 2) === 0 ? '#312e81' : '#2e1065';
        ctx.fillRect(x + 2, y + 2, size - 4, size - 4);

        // Gold inlay corner accents
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 3, y + 3, size - 6, size - 6);

        // Center mystical runic diamond emblem
        ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
        ctx.beginPath();
        ctx.moveTo(x + size / 2, y + size * 0.25);
        ctx.lineTo(x + size * 0.75, y + size / 2);
        ctx.lineTo(x + size / 2, y + size * 0.75);
        ctx.lineTo(x + size * 0.25, y + size / 2);
        ctx.closePath();
        ctx.fill();
      }
    }
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
  });
}

// Ambient floating motes (pollen, fireflies, sparks)
function createAmbientParticles(count = 64, spread = 30): THREE.Points {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = 0.5 + Math.random() * 7;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xfef08a,
    size: 0.16,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geo, mat);
}

// Render/Update realistic suspension bridge spans across the river canyon
function renderBridgeSegments(
  group: THREE.Group,
  builtSegments: number,
  totalSegments: number
) {
  // Clear existing children
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
  }

  const totalSegs = Math.max(1, totalSegments || 5);
  const startX = -2.6;
  const endX = 2.6;
  const step = (endX - startX) / totalSegs;

  for (let i = 0; i < totalSegs; i++) {
    const isBuilt = i < builtSegments;
    const isNext = i === builtSegments;
    const segX = startX + step * i + step * 0.5;
    const segGroup = new THREE.Group();
    segGroup.position.set(segX, 0, 0);

    // 1. Stone Pillar Pier rising from canyon riverbed
    const pierHeight = isBuilt ? 1.5 : 0.75;
    const pierY = isBuilt ? 0.25 : -0.38;
    const pierGeo = new THREE.CylinderGeometry(0.18, 0.22, pierHeight, 10);
    const pierMat = new THREE.MeshStandardMaterial({
      color: isBuilt ? 0x475569 : 0x1e293b,
      roughness: 0.8,
    });
    const pier = new THREE.Mesh(pierGeo, pierMat);
    pier.position.y = pierY;
    segGroup.add(pier);

    // Stone capital collar under timber deck
    if (isBuilt) {
      const capGeo = new THREE.BoxGeometry(step * 0.9, 0.12, 1.2);
      const capMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = 0.92;
      segGroup.add(cap);
    }

    // 2. Timber Deck
    if (isBuilt) {
      // Solid Heavy Timber Deck
      const deckGeo = new THREE.BoxGeometry(step * 0.94, 0.18, 1.7);
      const deckMat = new THREE.MeshStandardMaterial({
        color: 0xb45309,
        roughness: 0.5,
        emissive: 0x451a03,
      });
      const deck = new THREE.Mesh(deckGeo, deckMat);
      deck.position.y = 1.02;
      segGroup.add(deck);

      // Wooden Plank Slat Lines on top of deck
      const numSlats = 4;
      for (let s = 0; s < numSlats; s++) {
        const slatX = (s - (numSlats - 1) / 2) * (step * 0.22);
        const slatGeo = new THREE.BoxGeometry(step * 0.2, 0.02, 1.66);
        const slatMat = new THREE.MeshStandardMaterial({
          color: s % 2 === 0 ? 0xd97706 : 0x92400e,
          roughness: 0.6,
        });
        const slat = new THREE.Mesh(slatGeo, slatMat);
        slat.position.set(slatX, 1.12, 0);
        segGroup.add(slat);
      }

      // Wooden Handrails, Support Posts & Suspension Ropes
      [-0.82, 0.82].forEach((zPos) => {
        // Vertical railing post
        const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.55, 6);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(0, 1.3, zPos);
        segGroup.add(post);

        // Horizontal handrail bar
        const railGeo = new THREE.BoxGeometry(step * 0.94, 0.07, 0.07);
        const rail = new THREE.Mesh(railGeo, postMat);
        rail.position.set(0, 1.55, zPos);
        segGroup.add(rail);

        // Vertical suspension rope from overhead main cable down to handrail post
        const cableY = 0.95 + 0.85 * Math.pow(segX / 3.0, 2);
        const ropeHeight = Math.max(0.15, cableY - 1.55);
        const ropeGeo = new THREE.CylinderGeometry(0.015, 0.015, ropeHeight, 6);
        const ropeMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
        const rope = new THREE.Mesh(ropeGeo, ropeMat);
        rope.position.set(0, 1.55 + ropeHeight / 2, zPos);
        segGroup.add(rope);
      });

      // Warm Golden Safety Lantern at the outer edge of completed segment
      const lanternGeo = new THREE.DodecahedronGeometry(0.08);
      const lanternMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xeab308,
        emissiveIntensity: 0.8,
        roughness: 0.2,
      });
      const lantern = new THREE.Mesh(lanternGeo, lanternMat);
      lantern.position.set(step * 0.35, 1.62, 0.82);
      segGroup.add(lantern);
    } else if (isNext) {
      // Next Plank Blueprint / Construction Preview Guide (semi-transparent guide)
      const guideGeo = new THREE.BoxGeometry(step * 0.92, 0.12, 1.6);
      const guideMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.4,
        wireframe: true,
      });
      const guide = new THREE.Mesh(guideGeo, guideMat);
      guide.position.y = 1.02;
      segGroup.add(guide);
    }

    group.add(segGroup);
  }
}

// Cañón de confeti 3D reutilizable para la celebración de victoria de un juego.
// Nota: Carrera ya tiene su propio confeti (más simple, hecho por otra sesión) y
// no se toca aquí para no arriesgar algo que ya funciona; esta función se usa
// solo para agregar el efecto a Batalla, Tienda, Puente y Detective, que no lo
// tenían.
function create3DConfettiGroup(centerPos: THREE.Vector3, count: number = 95): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(centerPos);
  const colors = [0xf59e0b, 0xef4444, 0x3b82f6, 0x10b981, 0xa855f7, 0xf43f5e, 0xfacc15, 0x38bdf8, 0xffffff];
  for (let c = 0; c < count; c++) {
    const isRibbon = c % 3 === 0;
    const geo = isRibbon
      ? new THREE.BoxGeometry(0.045, 0.22, 0.01)
      : new THREE.BoxGeometry(0.09, 0.09, 0.01);
    const piece = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: colors[c % colors.length], side: THREE.DoubleSide })
    );
    piece.position.set(
      (Math.random() - 0.5) * 5.2,
      Math.random() * 3.6,
      (Math.random() - 0.5) * 4.2
    );
    piece.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    group.add(piece);
  }
  group.visible = false;
  return group;
}

export const ThreeWorldCanvas: React.FC<ThreeWorldCanvasProps> = ({
  viewMode,
  currentRegionId,
  gameMode,
  questionIndex,
  totalQuestions,
  isCorrect,
  heroHp,
  enemyHp,
  bridgeBuiltSegments,
  raceProgress = 0,
  shopCartTotal = 0,
  cluesFound = 0,
  gameWon = false,
  gameOver = false,
  onSelectRegion,
  onWebGLError,
  unlockingRegionId,
  universeFinaleActive,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Keep onSelectRegion in ref so re-renders don't teardown WebGL
  const onSelectRegionRef = useRef(onSelectRegion);
  onSelectRegionRef.current = onSelectRegion;

  // FX 3D "Mario Galaxy" de región desbloqueada
  const unlockingRegionIdRef = useRef<string | null | undefined>(unlockingRegionId);
  unlockingRegionIdRef.current = unlockingRegionId;
  const galaxyUnlockFXRef = useRef<GalaxyUnlockFXData | null>(null);
  const galaxyUnlockStartTimeRef = useRef<number>(0);
  // Gran Final "universo completado" (FX en universeFinaleFX.ts)
  const universeFinaleActiveRef = useRef<boolean | undefined>(universeFinaleActive);
  universeFinaleActiveRef.current = universeFinaleActive;
  const universeFinaleFXRef = useRef<UniverseFinaleFX | null>(null);
  const universeFinaleStartTimeRef = useRef<number>(0);
  const isCorrectRef = useRef(isCorrect);
  isCorrectRef.current = isCorrect;
  const gameWonRef = useRef(gameWon);
  gameWonRef.current = gameWon;
  const gameOverRef = useRef(gameOver);
  gameOverRef.current = gameOver;
  // totalQuestions llega en 0 al entrar a un nivel y cambia a su valor real
  // apenas responde Supabase (ver fetchQuestionsForLevel). Antes ese cambio
  // estaba en las deps del efecto de reconstrucción de región (~2000 líneas)
  // y provocaba un SEGUNDO rebuild completo de toda la escena 3D justo al
  // terminar de cargar las preguntas (la sensación de "se traba al iniciar").
  // Con la ref, el efecto pesado usa siempre el valor más reciente sin volver
  // a dispararse por este cambio; el efecto liviano de abajo
  // (renderBridgeSegments) ya se encarga de refrescar el puente cuando
  // totalQuestions/bridgeBuiltSegments cambian.
  const totalQuestionsRef = useRef(totalQuestions);
  totalQuestionsRef.current = totalQuestions;
  // Mismo motivo que totalQuestionsRef: estos tres valores se leen dentro del
  // efecto "Handle Response Animation" (más abajo) pero NO deben estar en sus
  // dependencias. Antes lo estaban -- junto con heroHp/enemyHp/cluesFound/
  // shopCartTotal, que ni siquiera se usan ahí -- así que cualquier cambio de
  // esos valores (aunque isCorrect siguiera igual) relanzaba una animación de
  // ataque/carrera NUEVA por encima de la anterior sin cancelarla, dos loops
  // de requestAnimationFrame peleándose por la misma posición del personaje.
  // Eso es el bug visual reportado en Batalla (y presente, menos visible, en
  // los demás juegos) -- y por qué salir al mapa y volver "lo arreglaba": el
  // efecto de reconstrucción de región crea personajes nuevos y limpios.
  const raceProgressRef = useRef(raceProgress);
  raceProgressRef.current = raceProgress;
  const bridgeBuiltSegmentsRef = useRef(bridgeBuiltSegments);
  bridgeBuiltSegmentsRef.current = bridgeBuiltSegments;
  const questionIndexRef = useRef(questionIndex);
  questionIndexRef.current = questionIndex;

  // Dynamic references for animated scene objects
  const runnerCharRef = useRef<RunnerCharacterResult | null>(null);
  const heroCharRef = useRef<KnightHeroResult | null>(null);
  const enemyCharRef = useRef<GolemEnemyResult | null>(null);
  const merchantCharRef = useRef<MerchantCharacterResult | null>(null);
  const customerCharRef = useRef<CustomerCharacterResult | null>(null);
  const walkerCharRef = useRef<ExplorerCharacterResult | null>(null);
  const detectiveCharRef = useRef<DetectiveCharacterResult | null>(null);

  const runnerGroupRef = useRef<THREE.Group | null>(null);
  const runnerLeftLegRef = useRef<THREE.Group | THREE.Mesh | null>(null);
  const runnerRightLegRef = useRef<THREE.Group | THREE.Mesh | null>(null);
  const runnerStumbleActiveRef = useRef<boolean>(false);
  const trackPathMeshRef = useRef<THREE.Mesh | null>(null);
  const heroFighterRef = useRef<THREE.Group | null>(null);
  const enemyFighterRef = useRef<THREE.Group | null>(null);
  const bridgeSegmentsGroupRef = useRef<THREE.Group | null>(null);
  const bridgeWalkerRef = useRef<THREE.Group | null>(null);
  const castleRunesRef = useRef<THREE.Mesh[]>([]);

  // Shop 3D elements
  const shopMerchantRef = useRef<THREE.Group | null>(null);
  const shopMerchantHeadRef = useRef<THREE.Group | null>(null);
  const shopCustomerRef = useRef<THREE.Group | null>(null);
  const shopCoinsMeshRef = useRef<THREE.Mesh | null>(null);
  const shopProductMeshRef = useRef<THREE.Group | null>(null);
  const shopBasketGroupRef = useRef<THREE.Group | null>(null);
  const shopCashboxRef = useRef<THREE.Mesh | null>(null);

  // Castle 3D elements
  const castleDoorLeftRef = useRef<THREE.Group | null>(null);
  const castleDoorRightRef = useRef<THREE.Group | null>(null);
  const castleLockBarsRef = useRef<THREE.Mesh[]>([]);
  const castleDetectiveRef = useRef<THREE.Group | null>(null);
  const castleBeamMeshRef = useRef<THREE.Mesh | null>(null);
  const castleChestRef = useRef<THREE.Group | null>(null);
  const castleBannersRef = useRef<THREE.Mesh[]>([]);
  const castleRoseGlowRef = useRef<THREE.Mesh | null>(null);
  const castleBrazierFlamesRef = useRef<THREE.Mesh[]>([]);
  const shopScalesArmRef = useRef<THREE.Group | null>(null);
  const shopLanternLightRef = useRef<THREE.Group | null>(null);

  // Map Mode Floating Island Animated Elements
  const mapIslandCoresRef = useRef<{ core: THREE.Mesh; ring: THREE.Mesh; satellites: THREE.Mesh[] }[]>([]);

  // Dedicated Win/Lose scene animation elements
  const finishConfettiGroupRef = useRef<THREE.Group | null>(null);
  const runnerSweatRef = useRef<THREE.Group | null>(null);
  const finishRibbonRef = useRef<THREE.Mesh | null>(null);
  const golemCrumbleGroupRef = useRef<THREE.Group | null>(null);
  const heroVictoryAuraRef = useRef<THREE.Mesh | null>(null);
  const heroDizzyStarsRef = useRef<THREE.Group | null>(null);
  const shopCheerCoinsRef = useRef<THREE.Group | null>(null);
  const shopClosedSignRef = useRef<THREE.Mesh | null>(null);
  const shopCelebrationBagRef = useRef<THREE.Group | null>(null);
  const bridgeVictoryFlagRef = useRef<THREE.Group | null>(null);
  const bridgeBrokenPlankRef = useRef<THREE.Mesh | null>(null);
  const castlePortcullisRef = useRef<THREE.Mesh | null>(null);
  const castleSparklesRef = useRef<THREE.Group | null>(null);
  const castleQuestionMarksRef = useRef<THREE.Group | null>(null);
  // Haz de luz dorado tipo "bóveda" que sale por la puerta del castillo al
  // ganar el nivel completo de Detective (oculto hasta la victoria).
  const castleGateGlowRef = useRef<THREE.Mesh | null>(null);

  // "Foto" de cómo se ve cada mesh de victoria/derrota en reposo (posición,
  // rotación, visibilidad, opacidad), tomada una sola vez apenas se monta la
  // escena -- antes de cualquier animación de victoria/derrota. Se usa para
  // volver exactamente ahí al empezar un nivel nuevo, sin tener que hardcodear
  // valores a mano ni acordarse de actualizar una lista cada vez que se agregue
  // una animación nueva (ver ADR-014/ADR-015 en docs/DECISIONS.md).
  const finishMeshSnapshotsRef = useRef<Map<THREE.Object3D, FinishMeshSnapshot> | null>(null);

  // In-Scene 3D Dynamic Particle Systems
  const runnerDustGroupRef = useRef<THREE.Group | null>(null);
  const runnerDustDataRef = useRef<{ mesh: THREE.Mesh; life: number; speed: number; rotSpeed: number }[]>([]);
  const shopSparksGroupRef = useRef<THREE.Group | null>(null);
  const shopSparksDataRef = useRef<{ mesh: THREE.Mesh; initialY: number; speed: number; angle: number; radius: number }[]>([]);
  const battleSparksGroupRef = useRef<THREE.Group | null>(null);
  const battleSparksDataRef = useRef<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }[]>([]);
  const battleSlashArcRef = useRef<THREE.Mesh | null>(null);
  const battleShockwaveRef = useRef<THREE.Mesh | null>(null);

  const cloudsGroupRef = useRef<THREE.Group | null>(null);
  const skyDomeRef = useRef<THREE.Mesh | null>(null);
  const waterMeshRef = useRef<THREE.Mesh | null>(null);
  const floatingMotesRef = useRef<THREE.Points | null>(null);
  const magmaFissuresRef = useRef<THREE.Mesh[]>([]);
  const mapIslandsRef = useRef<{ id: string; group: THREE.Group; mesh: THREE.Mesh }[]>([]);

  // Camera targets for smooth lerp
  const targetCamPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 10, 15));
  const targetCamLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const currentCamLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  // Drag interaction for orbital panning in Map mode
  const isDragging = useRef(false);
  const prevMousePos = useRef({ x: 0, y: 0 });
  const mapRotationAngle = useRef(0);

  // Setup Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 450;

    // Detección simple de móvil/gama baja: pantallas angostas o sin mouse
    // fino (touch). En esos casos bajamos un poco la calidad del renderer
    // para mantener buenos FPS, sin cambiar nada del diseño ni la cámara.
    const isMobileOrLowEnd =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 768);

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#7dd3fc');
    scene.fog = new THREE.FogExp2('#93c5fd', 0.013);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 150);
    camera.position.set(0, 12, 16);
    cameraRef.current = camera;

    // 3. Renderer with safe WebGL creation
    let renderer: THREE.WebGLRenderer;
    let contextRestored = false;
    let contextLostFallbackTimer: number | undefined;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isMobileOrLowEnd,
        alpha: false,
        powerPreference: isMobileOrLowEnd ? 'default' : 'high-performance',
      });
    } catch (err) {
      console.warn('WebGL Renderer initialization failed, switching to illustrated mode:', err);
      onWebGLError?.();
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobileOrLowEnd ? 1.5 : 2));
    renderer.shadowMap.enabled = !isMobileOrLowEnd;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // Pérdida de contexto WebGL: pasa sobre todo en celulares cuando el
    // sistema necesita memoria de GPU para otra cosa (cambiar de app, quedarse
    // sin RAM, etc.). Sin esto, la escena queda congelada/a medias para
    // siempre. e.preventDefault() le pide al navegador la oportunidad de
    // restaurar el contexto; si no se restaura solo, caemos al modo 2D.
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      console.warn('[ThreeWorldCanvas] Se perdió el contexto WebGL (probablemente por memoria en el dispositivo).');
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      contextLostFallbackTimer = window.setTimeout(() => {
        if (!contextRestored) onWebGLError?.();
      }, 2000);
    };
    const handleContextRestored = () => {
      contextRestored = true;
      if (contextLostFallbackTimer) window.clearTimeout(contextLostFallbackTimer);
      console.info('[ThreeWorldCanvas] Contexto WebGL restaurado.');
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored, false);

    // 4. Procedural Gradient Sky Dome
    const skyDome = createProceduralSky();
    scene.add(skyDome);
    skyDomeRef.current = skyDome;

    // Golden Radiant Sun in the high sky
    const sunDisk = new THREE.Mesh(
      new THREE.SphereGeometry(3.6, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xfffbeb })
    );
    sunDisk.position.set(24, 40, -36);
    scene.add(sunDisk);

    // Warm Sun Coronal Halo
    const sunCorona = new THREE.Mesh(
      new THREE.RingGeometry(3.6, 8.8, 32),
      new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      })
    );
    sunCorona.position.set(23.9, 39.8, -35.8);
    sunCorona.lookAt(0, 10, 15);
    scene.add(sunCorona);

    // Distant Majestic Mountain Panorama on Horizon
    const mountains = createMountainPanorama();
    scene.add(mountains);

    // 5. Lighting with Soft Shadows and Rim Backlight
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff1d0, 1.45);
    sunLight.position.set(14, 24, 16);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0003;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 50;
    sunLight.shadow.camera.left = -18;
    sunLight.shadow.camera.right = 18;
    sunLight.shadow.camera.top = 18;
    sunLight.shadow.camera.bottom = -18;
    scene.add(sunLight);

    // Soft Rim / Silhouette Backlight
    const rimLight = new THREE.DirectionalLight(0xbae6fd, 0.7);
    rimLight.position.set(-15, 18, -14);
    scene.add(rimLight);

    // Realistic Sky/Ground Hemisphere Bounce
    const skyHemisphere = new THREE.HemisphereLight(0xe0f2fe, 0x78350f, 0.7);
    scene.add(skyHemisphere);

    // 6. Water Plane (Deep stylized shimmering ocean)
    const waterGeo = new THREE.PlaneGeometry(120, 120, 48, 48);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.16,
      metalness: 0.65,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = -2.5;
    waterMesh.receiveShadow = true;
    scene.add(waterMesh);
    waterMeshRef.current = waterMesh;

    // 7. Soft Volumetric Clouds (Pillowy multi-sphere clusters)
    const cloudsGroup = new THREE.Group();
    const cloudPositions = [
      { x: -22, y: 5.5, z: -18, s: 1.6 },
      { x: 18, y: 6.8, z: -22, s: 1.9 },
      { x: -5, y: 8.2, z: -30, s: 2.2 },
      { x: 26, y: 4.8, z: 10, s: 1.4 },
      { x: -25, y: 6.0, z: 8, s: 1.7 },
      { x: 4, y: 5.0, z: 22, s: 1.5 },
      { x: -14, y: 7.2, z: 24, s: 1.8 },
      { x: 32, y: 6.5, z: -8, s: 1.5 },
    ];
    cloudPositions.forEach((pos) => {
      const cloud = createVolumetricCloud(pos.s);
      cloud.position.set(pos.x, pos.y, pos.z);
      cloudsGroup.add(cloud);
    });
    scene.add(cloudsGroup);
    cloudsGroupRef.current = cloudsGroup;

    // 8. Ambient Drifting Motes (Sun pollen, magical sparkles)
    const motes = createAmbientParticles(75, 34);
    scene.add(motes);
    floatingMotesRef.current = motes;

    // Resize Handler via ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(w, h);
      }
    };

    window.addEventListener('resize', handleResize);

    // 7. Click / Tap raycaster for World Map Island selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Punto de contacto, ya sea de mouse o del primer dedo (touch), para que
    // arrastrar y tocar islas funcione igual en celular/tablet que en desktop.
    const pointFromEvent = (e: MouseEvent | TouchEvent): { x: number; y: number } => {
      if ('touches' in e) {
        const t = e.touches[0] ?? e.changedTouches[0];
        return { x: t.clientX, y: t.clientY };
      }
      return { x: e.clientX, y: e.clientY };
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      isDragging.current = true;
      prevMousePos.current = pointFromEvent(e);
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      const { x, y } = pointFromEvent(e);
      const deltaX = x - prevMousePos.current.x;
      mapRotationAngle.current += deltaX * 0.005;
      prevMousePos.current = { x, y };
    };

    const handlePointerUp = (e: MouseEvent | TouchEvent) => {
      isDragging.current = false;

      // Durante el Gran Final los toques los gestiona su overlay. Este manejador está en
      // `window`, así que recibe TODO soltar-clic de la página (también el de los botones
      // del overlay): sin esta guarda, pulsar "Explorar" sobre la silueta de una isla
      // entraría a un nivel por error.
      if (universeFinaleActiveRef.current) return;

      // Mientras la celebración de región desbloqueada está activa, tocar
      // en cualquier parte del mapa lanza directo esa región.
      if (unlockingRegionIdRef.current && onSelectRegionRef.current) {
        onSelectRegionRef.current(unlockingRegionIdRef.current);
        return;
      }

      // If tap/click was stationary, detect island click
      const { x, y } = pointFromEvent(e);
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((x - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((y - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const interactableMeshes = mapIslandsRef.current.map((item) => item.mesh);
      const intersects = raycaster.intersectObjects(interactableMeshes);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const matched = mapIslandsRef.current.find((item) => item.mesh === hit);
        if (matched && onSelectRegionRef.current) {
          onSelectRegionRef.current(matched.id);
        }
      }
    };

    const domEl = renderer.domElement;
    domEl.style.touchAction = 'none'; // evita que el navegador haga scroll/zoom al arrastrar
    domEl.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    domEl.addEventListener('touchstart', handlePointerDown, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      domEl.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      domEl.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      if (contextLostFallbackTimer) window.clearTimeout(contextLostFallbackTimer);

      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.remove();
        rendererRef.current.dispose();
      }
    };
  }, []);

  // Build the appropriate 3D region elements whenever viewMode or currentRegionId changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clean previous region objects (except base lights, water, and clouds)
    const toRemove: THREE.Object3D[] = [];
    scene.children.forEach((child) => {
      if (child.name.startsWith('custom_world_')) {
        toRemove.push(child);
      }
    });
    toRemove.forEach((c) => {
      scene.remove(c);
      disposeObjectHierarchy(c);
    });

    mapIslandsRef.current = [];
    runnerGroupRef.current = null;
    runnerCharRef.current = null;
    heroFighterRef.current = null;
    heroCharRef.current = null;
    enemyFighterRef.current = null;
    enemyCharRef.current = null;
    merchantCharRef.current = null;
    customerCharRef.current = null;
    walkerCharRef.current = null;
    detectiveCharRef.current = null;
    bridgeSegmentsGroupRef.current = null;
    castleRunesRef.current = [];
    // La escena se acaba de tirar y reconstruir de cero -- los meshes de
    // victoria/derrota de ADR-014/015 (confeti, bandera, puertas...) son
    // objetos nuevos ahora, distintos a los que había en la foto anterior. Sin
    // esto, esa foto nunca se vuelve a tomar (solo se captura la primera vez
    // en toda la sesión), así que el reset dejaría de proteger cualquier modo
    // de juego que no fuera el primero que se cargó al abrir la app.
    finishMeshSnapshotsRef.current = null;

    const rootGroup = new THREE.Group();
    rootGroup.name = 'custom_world_root';

    if (viewMode === 'map') {
      // Setup Map Camera with wider panoramic perspective for spaced islands
      targetCamPos.current.set(0, 15, 23);
      targetCamLookAt.current.set(0, 1.0, 0);

      mapIslandCoresRef.current = [];

      // Render all 5 interconnected floating islands with high-fidelity geology and biome dioramas
      REGIONS.forEach((region) => {
        const islandGroup = new THREE.Group();
        islandGroup.position.set(...region.islandPosition);

        // 1. GEOLOGICAL STRATA FOUNDATION
        // Sub-keel: Inverted jagged rock stalactite tip
        const keelGeo = new THREE.ConeGeometry(1.6, 2.2, 16);
        const keelMat = new THREE.MeshStandardMaterial({
          color: 0x292524,
          roughness: 0.9,
          flatShading: false,
        });
        const keelMesh = new THREE.Mesh(keelGeo, keelMat);
        keelMesh.rotation.x = Math.PI;
        keelMesh.position.y = -2.1;
        keelMesh.castShadow = true;
        islandGroup.add(keelMesh);

        // Lower Stratum: Deep earthen bedrock cone
        const lowerGeo = new THREE.CylinderGeometry(2.35, 1.45, 1.4, 24);
        const lowerMat = new THREE.MeshStandardMaterial({
          color: 0x44403c,
          roughness: 0.85,
        });
        const lowerMesh = new THREE.Mesh(lowerGeo, lowerMat);
        lowerMesh.position.y = -1.1;
        lowerMesh.castShadow = true;
        islandGroup.add(lowerMesh);

        // Middle Stratum: Clay & Sandstone mineral layer with sediment texture
        const islandSedimentTex = createRiverSedimentTexture();
        const midGeo = new THREE.CylinderGeometry(2.65, 2.3, 0.75, 24);
        const midMat = new THREE.MeshStandardMaterial({
          map: islandSedimentTex,
          color: 0x9a3412,
          roughness: 0.8,
        });
        const midMesh = new THREE.Mesh(midGeo, midMat);
        midMesh.position.y = -0.35;
        midMesh.castShadow = true;
        islandGroup.add(midMesh);

        // Upper Crust: Fertile Soil with overhanging roots & rock shelves
        const topSoilGeo = new THREE.CylinderGeometry(2.8, 2.6, 0.55, 24);
        const topSoilMat = new THREE.MeshStandardMaterial({
          map: islandSedimentTex,
          color: 0x78350f,
          roughness: 0.75,
        });
        const topSoilMesh = new THREE.Mesh(topSoilGeo, topSoilMat);
        topSoilMesh.position.y = 0.15;
        topSoilMesh.castShadow = true;
        islandGroup.add(topSoilMesh);

        // Top Lush Biome Plateau Turf with custom biome textures
        const grassGeo = new THREE.CylinderGeometry(2.78, 2.78, 0.22, 24);
        let islandPlateauTex: THREE.CanvasTexture;
        let islandColor = 0xffffff;

        if (region.id === 'bosque') {
          islandPlateauTex = createMeadowGrassTexture();
        } else if (region.id === 'montana') {
          islandPlateauTex = createVolcanicBasaltTexture();
          islandColor = 0xd97706;
        } else if (region.id === 'ciudad') {
          islandPlateauTex = createCobblestonePlazaTexture();
          islandColor = 0xc4b5fd;
        } else {
          islandPlateauTex = createCastleCourtyardTexture();
          islandColor = 0xa5b4fc;
        }

        const grassMat = new THREE.MeshStandardMaterial({
          map: islandPlateauTex,
          color: islandColor,
          roughness: 0.65,
          flatShading: false,
        });
        const grassMesh = new THREE.Mesh(grassGeo, grassMat);
        grassMesh.position.y = 0.42;
        grassMesh.castShadow = true;
        grassMesh.receiveShadow = true;
        islandGroup.add(grassMesh);

        // 2. MYTHICAL FLOATING CORE & ANCHOR CRYSTAL
        const coreCrystalMat = new THREE.MeshStandardMaterial({
          color: region.id === currentRegionId ? 0xfbbf24 : 0x38bdf8,
          emissive: region.id === currentRegionId ? 0xd97706 : 0x0284c7,
          emissiveIntensity: region.id === currentRegionId ? 0.9 : 0.6,
          roughness: 0.2,
          metalness: 0.8,
        });
        const coreCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), coreCrystalMat);
        coreCrystal.position.y = -3.2;
        coreCrystal.scale.set(0.85, 2.2, 0.85);
        islandGroup.add(coreCrystal);

        // Floating Rune Halo Ring beneath keel
        const coreHaloMat = new THREE.MeshStandardMaterial({
          color: region.id === currentRegionId ? 0xf59e0b : 0x60a5fa,
          emissive: region.id === currentRegionId ? 0xb45309 : 0x2563eb,
          roughness: 0.3,
          side: THREE.DoubleSide,
        });
        const coreHalo = new THREE.Mesh(new THREE.RingGeometry(0.65, 0.82, 16), coreHaloMat);
        coreHalo.rotation.x = Math.PI / 2;
        coreHalo.position.y = -3.1;
        islandGroup.add(coreHalo);

        // 3. FLUFFY CUMULUS CLOUD SKIRT AROUND ISLAND WAIST
        for (let puff = 0; puff < 8; puff++) {
          const pAng = (puff * Math.PI * 2) / 8;
          const puffMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.38 + (puff % 2) * 0.12, 10, 8),
            new THREE.MeshStandardMaterial({
              color: 0xffffff,
              roughness: 0.95,
              transparent: true,
              opacity: 0.8,
            })
          );
          puffMesh.position.set(Math.cos(pAng) * 2.45, -0.4 + (puff % 3) * 0.08, Math.sin(pAng) * 2.45);
          islandGroup.add(puffMesh);
        }

        // 4. EXPANDED FLOATING SATELLITE ROCKS (Multi-tiered Wide Orbit Asteroids)
        const satellites: THREE.Mesh[] = [];
        const satConfig = [
          { dist: 4.8, yOff: 0.3, size: 0.22, color: 0x574026 },
          { dist: 5.6, yOff: -0.4, size: 0.30, color: 0x44403c },
          { dist: 6.4, yOff: 0.8, size: 0.18, color: 0x78350f },
        ];
        satConfig.forEach((cfg, sIdx) => {
          const satRock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(cfg.size, 1),
            new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.85 })
          );
          const initAngle = (sIdx * Math.PI * 2) / 3;
          satRock.position.set(Math.cos(initAngle) * cfg.dist, cfg.yOff, Math.sin(initAngle) * cfg.dist);
          islandGroup.add(satRock);
          satellites.push(satRock);
        });

        // Faint Golden/Cyan Celestial Orbit Ring Guide (Cosmic orbital track)
        const orbitGuideMat = new THREE.MeshBasicMaterial({
          color: region.id === currentRegionId ? 0xf59e0b : 0x38bdf8,
          transparent: true,
          opacity: 0.18,
          side: THREE.DoubleSide,
        });
        const orbitGuide1 = new THREE.Mesh(new THREE.RingGeometry(4.75, 4.85, 36), orbitGuideMat);
        orbitGuide1.rotation.x = Math.PI / 2;
        orbitGuide1.position.y = -0.3;
        islandGroup.add(orbitGuide1);

        const orbitGuide2 = new THREE.Mesh(new THREE.RingGeometry(5.55, 5.65, 36), orbitGuideMat);
        orbitGuide2.rotation.x = Math.PI / 2;
        orbitGuide2.position.y = -0.4;
        islandGroup.add(orbitGuide2);

        mapIslandCoresRef.current.push({ core: coreCrystal, ring: coreHalo, satellites });

        // 5. RICH THEMATIC ARCHITECTURAL & BIOME DIORAMA ON TOP PLATEAU
        if (region.id === 'bosque') {
          // Lush Alpine Pines & Deciduous Canopy with Wild Mushrooms
          [-0.9, 0.4, 1.2].forEach((tx, tIdx) => {
            const tz = tIdx === 1 ? -0.8 : tIdx === 2 ? 0.6 : 0.1;
            const treeTrunk = new THREE.Mesh(
              new THREE.CylinderGeometry(0.12, 0.16, 0.8, 8),
              new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 })
            );
            treeTrunk.position.set(tx, 0.85, tz);

            // Tiered foliage cones
            const fol1 = new THREE.Mesh(
              new THREE.ConeGeometry(0.65, 0.8, 8),
              new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 })
            );
            fol1.position.y = 0.55;
            treeTrunk.add(fol1);

            const fol2 = new THREE.Mesh(
              new THREE.ConeGeometry(0.48, 0.7, 8),
              new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.6 })
            );
            fol2.position.y = 0.95;
            treeTrunk.add(fol2);

            islandGroup.add(treeTrunk);
          });

          // Winding Forest Path
          const fPath = new THREE.Mesh(
            new THREE.PlaneGeometry(0.6, 2.6),
            new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.85 })
          );
          fPath.rotation.x = -Math.PI / 2;
          fPath.rotation.z = 0.35;
          fPath.position.set(0, 0.54, 0);
          islandGroup.add(fPath);

          // Red Toadstool Mushrooms
          const shroom = new THREE.Mesh(
            new THREE.SphereGeometry(0.14, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 })
          );
          shroom.position.set(-0.35, 0.62, 0.85);
          islandGroup.add(shroom);
        } else if (region.id === 'montana') {
          // Dual Volcanic Peaks with Snow & Glowing Magma Vent
          const peakMain = new THREE.Mesh(
            new THREE.ConeGeometry(1.4, 2.2, 16),
            new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 })
          );
          peakMain.position.set(-0.3, 1.45, -0.3);
          islandGroup.add(peakMain);

          const snowMain = new THREE.Mesh(
            new THREE.ConeGeometry(0.72, 0.9, 16),
            new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
          );
          snowMain.position.set(-0.3, 2.05, -0.3);
          islandGroup.add(snowMain);

          const peakSmall = new THREE.Mesh(
            new THREE.ConeGeometry(0.9, 1.4, 16),
            new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 })
          );
          peakSmall.position.set(0.95, 1.05, 0.4);
          islandGroup.add(peakSmall);

          // Magma Caldera Crater with pulsing glow
          const caldera = new THREE.Mesh(
            new THREE.CylinderGeometry(0.35, 0.35, 0.1, 12),
            new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, roughness: 0.2 })
          );
          caldera.position.set(0.1, 0.56, 0.8);
          islandGroup.add(caldera);
        } else if (region.id === 'ciudad') {
          // Multi-Story Medieval Townhouses with Steep Terracotta Roofs & Clock Tower
          const house1 = new THREE.Mesh(
            new THREE.BoxGeometry(1.0, 1.4, 0.9),
            new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.7 })
          );
          house1.position.set(-0.65, 1.15, -0.2);
          islandGroup.add(house1);

          const roof1 = new THREE.Mesh(
            new THREE.ConeGeometry(0.85, 0.85, 4),
            new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.6 })
          );
          roof1.position.set(-0.65, 2.1, -0.2);
          roof1.rotation.y = Math.PI / 4;
          islandGroup.add(roof1);

          // Clock Tower
          const tower = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 2.2, 0.8),
            new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.6 })
          );
          tower.position.set(0.65, 1.55, 0.1);
          islandGroup.add(tower);

          const spireT = new THREE.Mesh(
            new THREE.ConeGeometry(0.65, 1.1, 4),
            new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 })
          );
          spireT.position.set(0.65, 3.05, 0.1);
          spireT.rotation.y = Math.PI / 4;
          islandGroup.add(spireT);

          // Tiny Awning Market Stall
          const stallMini = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 0.45, 0.45),
            new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 })
          );
          stallMini.position.set(0, 0.75, 0.95);
          islandGroup.add(stallMini);
        } else if (region.id === 'castillo') {
          // Imperial Fortress: Twin Turrets, Curtain Wall & Central Royal Keep
          const keep = new THREE.Mesh(
            new THREE.CylinderGeometry(0.7, 0.78, 2.4, 16),
            new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75 })
          );
          keep.position.set(0, 1.6, -0.3);
          islandGroup.add(keep);

          const keepSpire = new THREE.Mesh(
            new THREE.ConeGeometry(0.9, 1.4, 16),
            new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 })
          );
          keepSpire.position.set(0, 3.3, -0.3);
          islandGroup.add(keepSpire);

          // Flanking Watchtowers
          [-1.1, 1.1].forEach((wx) => {
            const turret = new THREE.Mesh(
              new THREE.CylinderGeometry(0.38, 0.42, 1.7, 12),
              new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.75 })
            );
            turret.position.set(wx, 1.3, 0.3);
            islandGroup.add(turret);

            const tRoof = new THREE.Mesh(
              new THREE.ConeGeometry(0.5, 0.8, 12),
              new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.4 })
            );
            tRoof.position.set(wx, 2.45, 0.3);
            islandGroup.add(tRoof);
          });
        }

        // 6. FLOATING WORLD STATUS BEACON GEM & ORBITING RING
        const beaconGeo = new THREE.OctahedronGeometry(0.38);
        const beaconMat = new THREE.MeshStandardMaterial({
          color: region.id === currentRegionId ? 0xfacc15 : 0xffffff,
          emissive: region.id === currentRegionId ? 0xeab308 : 0x475569,
          roughness: 0.2,
          metalness: 0.6,
        });
        const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
        beaconMesh.position.y = 3.6;
        islandGroup.add(beaconMesh);

        // Orbiting Golden Compass Ring around beacon
        const beaconRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.58, 0.035, 6, 20),
          new THREE.MeshStandardMaterial({
            color: region.id === currentRegionId ? 0xf59e0b : 0x94a3b8,
            emissive: region.id === currentRegionId ? 0xd97706 : 0x334155,
            metalness: 0.8,
            roughness: 0.2,
          })
        );
        beaconRing.position.y = 3.6;
        beaconRing.rotation.x = Math.PI / 3;
        islandGroup.add(beaconRing);

        rootGroup.add(islandGroup);
        mapIslandsRef.current.push({ id: region.id, group: islandGroup, mesh: grassMesh });
      });

      // Connecting luminous crystalline paths between islands
      const curveCoords: [number, number, number][] = [
        [-9.5, 0.6, 4.5],
        [-4.0, 2.5, -4.5],
        [4.2, 1.2, -6.0],
        [2.5, 4.2, 6.8],
        [-9.5, 0.6, 4.5],
      ];

      for (let i = 0; i < curveCoords.length - 1; i++) {
        const start = new THREE.Vector3(...curveCoords[i]);
        const end = new THREE.Vector3(...curveCoords[i + 1]);
        const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 1.5, 0));
        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const points = curve.getPoints(28);
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineDashedMaterial({
          color: 0xfde047,
          dashSize: 0.5,
          gapSize: 0.35,
          linewidth: 2,
        });
        const line = new THREE.Line(lineGeo, lineMat);
        line.computeLineDistances();
        rootGroup.add(line);
      }
    } else {
      // GAME MODE SCENE
      if (gameMode === 'race') {
        // WORLD 1: BOSQUE — Carrera 3D Track & Paisaje Natural Ondulado
        targetCamPos.current.set(0, 4.2, 8.5);
        targetCamLookAt.current.set(0, 1.2, 0);

        // Sculpted rolling meadow valley (Subdivided mesh with soft undulating elevations)
        const terrainGeo = new THREE.PlaneGeometry(24, 34, 36, 44);
        const posAttr = terrainGeo.attributes.position;
        for (let v = 0; v < posAttr.count; v++) {
          const vx = posAttr.getX(v);
          const vy = posAttr.getY(v); // in plane geometry, Y is the Z axis before rotation
          if (Math.abs(vx) > 1.45) {
            const distFromTrack = Math.abs(vx) - 1.45;
            const elevation = Math.pow(distFromTrack * 0.3, 1.35) * 1.8 + Math.sin(vy * 0.35) * 0.4 + Math.cos(vx * 0.65) * 0.25;
            posAttr.setZ(v, elevation);
          } else {
            posAttr.setZ(v, 0.02);
          }
        }
        terrainGeo.computeVertexNormals();

        const meadowTex = createMeadowGrassTexture();
        const terrainMat = new THREE.MeshStandardMaterial({
          map: meadowTex,
          color: 0xffffff,
          roughness: 0.85,
          flatShading: false,
        });
        const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
        terrainMesh.rotation.x = -Math.PI / 2;
        terrainMesh.position.set(0, 0, 0);
        terrainMesh.receiveShadow = true;
        rootGroup.add(terrainMesh);

        // Smooth Natural Earthen Trail with pebble textures and cart ruts
        const pathGeo = new THREE.PlaneGeometry(2.7, 34, 16, 44);
        const pathTex = createEarthenTrackTexture();
        const pathMat = new THREE.MeshStandardMaterial({
          map: pathTex,
          color: 0xffffff,
          roughness: 0.88,
        });
        const pathMesh = new THREE.Mesh(pathGeo, pathMat);
        pathMesh.rotation.x = -Math.PI / 2;
        pathMesh.position.set(0, 0.04, 0);
        pathMesh.receiveShadow = true;
        rootGroup.add(pathMesh);
        trackPathMeshRef.current = pathMesh;

        // Soft Rounded River Cobble Curbs along edges
        const curbMatRed = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 });
        const curbMatWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
        for (let cz = -13; cz <= 13; cz += 0.8) {
          const isRed = Math.floor((cz + 13) / 0.8) % 2 === 0;
          const mat = isRed ? curbMatRed : curbMatWhite;
          [-1.38, 1.38].forEach((cx) => {
            const curb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), mat);
            curb.scale.set(1.0, 0.6, 1.4);
            curb.position.set(cx, 0.07, cz);
            rootGroup.add(curb);
          });
        }

        // Realistic Multi-tiered Conifer Trees & Wild Flower Bushes
        for (let i = -11; i <= 11; i += 2.4) {
          [-2.3, 2.3].forEach((xSide, sideIdx) => {
            const treeGroup = new THREE.Group();
            treeGroup.position.set(xSide + (Math.random() - 0.5) * 0.3, 0.2, i);

            // Chiseled Bark Trunk
            const trunk = new THREE.Mesh(
              new THREE.CylinderGeometry(0.12, 0.16, 1.0, 7),
              new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 })
            );
            trunk.position.y = 0.5;
            treeGroup.add(trunk);

            // Layered Foliage Cones
            const foliageColors = [0x15803d, 0x166534, 0x14532d];
            const folColor = foliageColors[(Math.abs(Math.floor(i)) + sideIdx) % foliageColors.length];
            const folMat = new THREE.MeshStandardMaterial({ color: folColor, roughness: 0.6 });

            const coneBottom = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.9, 7), folMat);
            coneBottom.position.y = 1.1;
            treeGroup.add(coneBottom);

            const coneTop = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.8, 7), folMat);
            coneTop.position.y = 1.6;
            treeGroup.add(coneTop);

            // Small red forest mushroom on trunk root
            const mStem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.1), new THREE.MeshBasicMaterial({ color: 0xffffff }));
            mStem.position.set(0.18, 0.05, 0.1);
            treeGroup.add(mStem);
            const mCap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
            mCap.position.set(0.18, 0.1, 0.1);
            treeGroup.add(mCap);

            rootGroup.add(treeGroup);

            // Colorful Flower Patches along the grass
            if (Math.abs(i) % 3 < 1.5) {
              const flowerColors = [0xf43f5e, 0xfbbf24, 0x38bdf8, 0xa855f7];
              const fColor = flowerColors[Math.abs(Math.floor(i)) % flowerColors.length];
              const flower = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.12),
                new THREE.MeshStandardMaterial({ color: fColor, roughness: 0.3 })
              );
              flower.position.set(xSide * 0.75 + (Math.random() - 0.5) * 0.3, 0.25, i + 0.8);
              rootGroup.add(flower);
            }
          });
        }

        // Finish Line Banner at z = -10
        const postMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.8, roughness: 0.2 });
        const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.8), postMat);
        postL.position.set(-1.45, 1.4, -10);
        const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.8), postMat);
        postR.position.set(1.45, 1.4, -10);
        rootGroup.add(postL);
        rootGroup.add(postR);

        const banner = new THREE.Mesh(
          new THREE.BoxGeometry(2.9, 0.6, 0.06),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.2, metalness: 0.3 })
        );
        banner.position.set(0, 2.4, -10);
        rootGroup.add(banner);

        // Finish Line Checkered Ribbon (spans between posts, breaks on win)
        const ribbon = new THREE.Mesh(
          new THREE.BoxGeometry(2.8, 0.14, 0.02),
          new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 })
        );
        ribbon.position.set(0, 0.9, -10);
        rootGroup.add(ribbon);
        finishRibbonRef.current = ribbon;

        // Finish Confetti Cannons (Burst when gameWon is true)
        const confettiGroup = new THREE.Group();
        confettiGroup.position.set(0, 2.2, -10);
        const confettiColors = [0xf59e0b, 0xef4444, 0x3b82f6, 0x10b981, 0xa855f7, 0xf43f5e];
        for (let c = 0; c < 48; c++) {
          const piece = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.08, 0.01),
            new THREE.MeshBasicMaterial({ color: confettiColors[c % confettiColors.length] })
          );
          piece.position.set(
            (Math.random() - 0.5) * 3.2,
            Math.random() * 2.5,
            (Math.random() - 0.5) * 2.0
          );
          piece.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
          confettiGroup.add(piece);
        }
        confettiGroup.visible = false;
        rootGroup.add(confettiGroup);
        finishConfettiGroupRef.current = confettiGroup;

        // 3D Runner Character (Sculpted high-relief athletic model)
        const runnerObj = createRunnerCharacter();
        runnerObj.group.position.set(0, 0.2, 4);
        runnerLeftLegRef.current = runnerObj.leftLeg;
        runnerRightLegRef.current = runnerObj.rightLeg;
        rootGroup.add(runnerObj.group);
        runnerGroupRef.current = runnerObj.group;
        runnerCharRef.current = runnerObj;

        // Runner defeat sweat droplets (appear on defeat)
        const sweatGroup = new THREE.Group();
        sweatGroup.position.set(0, 1.5, 0);
        [-0.14, 0.14].forEach((sx) => {
          const drop = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, transparent: true, opacity: 0.85 })
          );
          drop.position.set(sx, 0, 0.2);
          drop.scale.set(0.8, 1.4, 0.8);
          sweatGroup.add(drop);
        });
        sweatGroup.visible = false;
        runnerObj.group.add(sweatGroup);
        runnerSweatRef.current = sweatGroup;

        // In-Scene 3D Footstep Dust Particle System
        const dustGroup = new THREE.Group();
        const dustData: { mesh: THREE.Mesh; life: number; speed: number; rotSpeed: number }[] = [];
        const dustMat = new THREE.MeshStandardMaterial({
          color: 0xd6b88e,
          transparent: true,
          opacity: 0.45,
          roughness: 0.9,
          depthWrite: false,
        });
        for (let dp = 0; dp < 18; dp++) {
          const dMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08, 1), dustMat);
          dMesh.visible = false;
          dustGroup.add(dMesh);
          dustData.push({
            mesh: dMesh,
            life: dp / 18,
            speed: 0.8 + Math.random() * 0.9,
            rotSpeed: (Math.random() - 0.5) * 2.5,
          });
        }
        rootGroup.add(dustGroup);
        runnerDustGroupRef.current = dustGroup;
        runnerDustDataRef.current = dustData;
      } else if (gameMode === 'battle') {
        // WORLD 2: MONTAÑA — Batalla en Arena Volcánica 3D & Picos Esculpidos
        targetCamPos.current.set(0, 5, 9);
        targetCamLookAt.current.set(0, 1.2, 0);

        // Volcanic Caldera Arena Plateau (Smooth beveled basalt rock with chiseled flagstone texture)
        const arenaGeo = new THREE.CylinderGeometry(5.2, 5.8, 1.2, 32);
        const basaltTex = createVolcanicBasaltTexture();
        const arenaMat = new THREE.MeshStandardMaterial({
          map: basaltTex,
          color: 0x94a3b8,
          roughness: 0.82,
          flatShading: false,
        });
        const arenaMesh = new THREE.Mesh(arenaGeo, arenaMat);
        arenaMesh.position.y = 0;
        arenaMesh.receiveShadow = true;
        rootGroup.add(arenaMesh);

        // Island Sub-Keel Inverted Bedrock for Floating Volcano Island
        const battleKeel = new THREE.Mesh(
          new THREE.ConeGeometry(5.2, 3.6, 24),
          new THREE.MeshStandardMaterial({ map: basaltTex, color: 0x334155, roughness: 0.95 })
        );
        battleKeel.rotation.x = Math.PI;
        battleKeel.position.y = -2.4;
        rootGroup.add(battleKeel);

        // Low Hanging Magma Shimmer Crystal at bottom of keel
        const battleCoreGem = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.7, 0),
          new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xc2410c, roughness: 0.2 })
        );
        battleCoreGem.position.y = -4.3;
        battleCoreGem.scale.set(0.8, 1.8, 0.8);
        rootGroup.add(battleCoreGem);

        // Smooth Inner Obsidian Flagstone Ring with chiseled volcanic texture
        const innerRingGeo = new THREE.CylinderGeometry(4.5, 4.5, 0.04, 32);
        const innerRingMat = new THREE.MeshStandardMaterial({
          map: basaltTex,
          color: 0x64748b,
          roughness: 0.65,
        });
        const innerRingMesh = new THREE.Mesh(innerRingGeo, innerRingMat);
        innerRingMesh.position.y = 0.61;
        innerRingMesh.receiveShadow = true;
        rootGroup.add(innerRingMesh);

        // Arena surface glowing golden battle boundary ring
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(2.6, 2.9, 32),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, roughness: 0.3, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.64;
        rootGroup.add(ring);

        // Glowing Pulsing Magma Fissures across the arena floor
        const magmaMat = new THREE.MeshStandardMaterial({
          color: 0xf97316,
          emissive: 0xea580c,
          roughness: 0.25,
        });
        magmaFissuresRef.current = [];
        [-1.2, 0, 1.2].forEach((fz, i) => {
          const crack = new THREE.Mesh(new THREE.BoxGeometry(3.2 + i * 0.4, 0.05, 0.16), magmaMat);
          crack.position.set(0, 0.64, fz);
          crack.rotation.y = (i - 1) * 0.38;
          rootGroup.add(crack);
          magmaFissuresRef.current.push(crack);
        });

        // Background Dramatic Volcanic Mountain Spire Peaks
        const bgPeakMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
        const bgSnowMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
        [-7, 0, 7].forEach((px, pIdx) => {
          const pH = 9 + (pIdx === 1 ? 3 : 0);
          const pR = 4.5 + (pIdx === 1 ? 1 : 0);
          const peak = new THREE.Mesh(new THREE.ConeGeometry(pR, pH, 16), bgPeakMat);
          peak.position.set(px * 1.5, pH / 2 - 2, -14);
          rootGroup.add(peak);

          const snow = new THREE.Mesh(new THREE.ConeGeometry(pR * 0.45, pH * 0.35, 16), bgSnowMat);
          snow.position.set(px * 1.5, pH * 0.7 - 2, -14);
          rootGroup.add(snow);
        });

        // Surrounding Natural Obsidian Boulders (smooth geometry with soft bevels)
        for (let i = 0; i < 9; i++) {
          const angle = (i * Math.PI * 2) / 9;
          const rock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.65 + Math.random() * 0.35, 2),
            new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8, flatShading: false })
          );
          rock.position.set(Math.cos(angle) * 5.5, 0.7, Math.sin(angle) * 5.5);
          rock.scale.set(1.1, 1.4, 0.9);
          rootGroup.add(rock);
        }

        // Hero Knight Fighter (Steel cuirass, pauldrons, plume & kite shield)
        const heroObj = createKnightHeroCharacter();
        heroObj.group.position.set(-2.2, 0.6, 0);
        heroObj.group.rotation.y = Math.PI / 2;
        rootGroup.add(heroObj.group);
        heroFighterRef.current = heroObj.group;
        heroCharRef.current = heroObj;

        // Hero Victory Light Aura (Golden cylinder beam shining down on victory)
        const victoryAura = new THREE.Mesh(
          new THREE.CylinderGeometry(1.2, 1.2, 6.0, 16, 1, true),
          new THREE.MeshBasicMaterial({
            color: 0xfbbf24,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
          })
        );
        victoryAura.position.set(-2.2, 3.2, 0);
        rootGroup.add(victoryAura);
        heroVictoryAuraRef.current = victoryAura;

        // Hero Defeat Dizzy Stars (3 golden stars orbiting hero's head on defeat)
        const dizzyGroup = new THREE.Group();
        dizzyGroup.position.set(0, 1.6, 0);
        for (let s = 0; s < 3; s++) {
          const starAngle = (s * Math.PI * 2) / 3;
          const star = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.12),
            new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308 })
          );
          star.position.set(Math.cos(starAngle) * 0.45, 0, Math.sin(starAngle) * 0.45);
          dizzyGroup.add(star);
        }
        dizzyGroup.visible = false;
        heroObj.group.add(dizzyGroup);
        heroDizzyStarsRef.current = dizzyGroup;

        // Enemy Mountain Golem (Chiseled bedrock, magma core & horns)
        const enemyObj = createGolemEnemyCharacter();
        enemyObj.group.position.set(2.2, 0.6, 0);
        enemyObj.group.rotation.y = -Math.PI / 2;
        rootGroup.add(enemyObj.group);
        enemyFighterRef.current = enemyObj.group;
        enemyCharRef.current = enemyObj;

        // Golem Crumble Boulders (8 shattered rock chunks that scatter on golem defeat)
        const crumbleGroup = new THREE.Group();
        crumbleGroup.position.set(2.2, 0.6, 0);
        const rockChunkMat = new THREE.MeshStandardMaterial({
          color: 0x334155,
          roughness: 0.9,
          flatShading: true,
        });
        for (let r = 0; r < 8; r++) {
          const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24 + Math.random() * 0.16, 0), rockChunkMat);
          chunk.position.set((Math.random() - 0.5) * 0.8, Math.random() * 0.8, (Math.random() - 0.5) * 0.8);
          crumbleGroup.add(chunk);
        }
        crumbleGroup.visible = false;
        rootGroup.add(crumbleGroup);
        golemCrumbleGroupRef.current = crumbleGroup;

        // Cañón de confeti 3D de victoria (Batalla)
        const battleConfetti = create3DConfettiGroup(new THREE.Vector3(-0.6, 2.8, 0), 100);
        rootGroup.add(battleConfetti);
        finishConfettiGroupRef.current = battleConfetti;

        // In-Scene 3D Battle Clash Sparks Particle System
        const bSparksGroup = new THREE.Group();
        const bSparksData: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }[] = [];
        const bSparkMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        for (let bs = 0; bs < 32; bs++) {
          const bsMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), bSparkMat);
          bsMesh.visible = false;
          bSparksGroup.add(bsMesh);
          bSparksData.push({
            mesh: bsMesh,
            vx: 0,
            vy: 0,
            vz: 0,
            life: 0,
          });
        }
        rootGroup.add(bSparksGroup);
        battleSparksGroupRef.current = bSparksGroup;
        battleSparksDataRef.current = bSparksData;

        // Visual FX: Glowing Cyan Crescent Sword Slash Trail
        const slashMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0,
        });
        const slashGeo = new THREE.RingGeometry(0.8, 1.25, 24, 1, 0, Math.PI * 0.85);
        const slashArc = new THREE.Mesh(slashGeo, slashMat);
        slashArc.position.set(1.4, 1.2, 0.2);
        slashArc.rotation.set(0.3, -Math.PI / 4, 0.4);
        slashArc.visible = false;
        rootGroup.add(slashArc);
        battleSlashArcRef.current = slashArc;

        // Visual FX: Fiery Magma Ground Shockwave Ring (for Golem smash)
        const shockwaveMat = new THREE.MeshBasicMaterial({
          color: 0xf97316,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0,
        });
        const shockwaveGeo = new THREE.RingGeometry(0.2, 0.55, 32);
        const shockwaveMesh = new THREE.Mesh(shockwaveGeo, shockwaveMat);
        shockwaveMesh.rotation.x = -Math.PI / 2;
        shockwaveMesh.position.set(-1.0, 0.65, 0);
        shockwaveMesh.visible = false;
        rootGroup.add(shockwaveMesh);
        battleShockwaveRef.current = shockwaveMesh;
      } else if (gameMode === 'shop') {
        // WORLD 3: CIUDAD — Mercado Real de Don Mateo 3D & Plaza Medieval
        targetCamPos.current.set(0, 4.4, 7.2);
        targetCamLookAt.current.set(0, 1.3, 0);

        // Smooth Cobblestone Town Square Ground (32-segment beveled disc with procedural stone paving)
        const cobblestoneTex = createCobblestonePlazaTexture();
        const plaza = new THREE.Mesh(
          new THREE.CylinderGeometry(6.4, 6.2, 0.5, 32),
          new THREE.MeshStandardMaterial({
            map: cobblestoneTex,
            color: 0xffffff,
            roughness: 0.75,
            flatShading: false,
          })
        );
        plaza.position.y = 0;
        plaza.receiveShadow = true;
        rootGroup.add(plaza);

        // Island Sub-Keel: Inverted Sandstone & Bedrock Cone for Floating Market
        const shopKeel = new THREE.Mesh(
          new THREE.ConeGeometry(5.8, 3.8, 24),
          new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 })
        );
        shopKeel.rotation.x = Math.PI;
        shopKeel.position.y = -2.1;
        rootGroup.add(shopKeel);

        // Cloud puffs around plaza island perimeter
        for (let cp = 0; cp < 8; cp++) {
          const cAng = (cp * Math.PI * 2) / 8;
          const cPuff = new THREE.Mesh(
            new THREE.SphereGeometry(0.8, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, transparent: true, opacity: 0.65 })
          );
          cPuff.position.set(Math.cos(cAng) * 6.3, -0.6, Math.sin(cAng) * 6.3);
          rootGroup.add(cPuff);
        }

        // Concentric Plaza Cobblestone Inlay Rings
        [2.6, 4.4].forEach((radius) => {
          const ringMesh = new THREE.Mesh(
            new THREE.RingGeometry(radius, radius + 0.18, 32),
            new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8, side: THREE.DoubleSide })
          );
          ringMesh.rotation.x = -Math.PI / 2;
          ringMesh.position.y = 0.26;
          rootGroup.add(ringMesh);
        });

        // Background Fairytale Half-Timbered Townhouses
        const houseGroup = new THREE.Group();
        houseGroup.position.set(0, 0, -4.8);

        // Center Townhouse (Warm cream plaster & terracotta roof)
        const hCenter = new THREE.Mesh(
          new THREE.BoxGeometry(3.2, 3.4, 1.8),
          new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.8 })
        );
        hCenter.position.set(0, 1.7, 0);
        houseGroup.add(hCenter);

        const roofCenter = new THREE.Mesh(
          new THREE.ConeGeometry(2.4, 1.8, 4),
          new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.7 })
        );
        roofCenter.position.set(0, 4.2, 0);
        roofCenter.rotation.y = Math.PI / 4;
        houseGroup.add(roofCenter);

        // Warm Glowing Dormer Window on roof
        const dormer = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.65, 0.3),
          new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xd97706, roughness: 0.2 })
        );
        dormer.position.set(0, 3.8, 0.85);
        houseGroup.add(dormer);

        // Left Townhouse (Royal lilac plaster)
        const hLeft = new THREE.Mesh(
          new THREE.BoxGeometry(2.6, 2.8, 1.6),
          new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.8 })
        );
        hLeft.position.set(-2.8, 1.4, 0.2);
        houseGroup.add(hLeft);

        const roofLeft = new THREE.Mesh(
          new THREE.ConeGeometry(1.9, 1.5, 4),
          new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 })
        );
        roofLeft.position.set(-2.8, 3.5, 0.2);
        roofLeft.rotation.y = Math.PI / 4;
        houseGroup.add(roofLeft);

        // Right Townhouse (Warm amber plaster)
        const hRight = new THREE.Mesh(
          new THREE.BoxGeometry(2.6, 3.0, 1.6),
          new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 })
        );
        hRight.position.set(2.8, 1.5, 0.2);
        houseGroup.add(hRight);

        const roofRight = new THREE.Mesh(
          new THREE.ConeGeometry(1.9, 1.6, 4),
          new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.7 })
        );
        roofRight.position.set(2.8, 3.7, 0.2);
        roofRight.rotation.y = Math.PI / 4;
        houseGroup.add(roofRight);

        rootGroup.add(houseGroup);

        // Ornate Wrought-Iron Streetlamps on plaza perimeter
        [-3.6, 3.6].forEach((lx) => {
          const lamp = new THREE.Group();
          lamp.position.set(lx, 0.25, 1.8);
          const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.08, 2.8),
            new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 })
          );
          post.position.y = 1.4;
          lamp.add(post);

          // Glowing glass globe
          const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 12, 10),
            new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfbbf24, roughness: 0.1 })
          );
          bulb.position.y = 2.85;
          lamp.add(bulb);
          rootGroup.add(lamp);
        });

        // Detailed Medieval Timber Market Stall with Counters & Side Shelves
        const stallGroup = new THREE.Group();
        stallGroup.position.set(0, 0, 0);

        // Main Market Stall Timber Counter
        const counter = new THREE.Mesh(
          new THREE.BoxGeometry(3.6, 0.95, 1.35),
          new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65 })
        );
        counter.position.set(0, 0.78, 0);
        counter.castShadow = true;
        counter.receiveShadow = true;
        stallGroup.add(counter);

        // Polished Oak Countertop Plank
        const counterTop = new THREE.Mesh(
          new THREE.BoxGeometry(3.8, 0.1, 1.45),
          new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.5 })
        );
        counterTop.position.set(0, 1.28, 0);
        stallGroup.add(counterTop);

        // Left Side Produce Display Table
        const sideTableL = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.7, 1.2),
          new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.7 })
        );
        sideTableL.position.set(-2.4, 0.65, 0.3);
        stallGroup.add(sideTableL);

        // Right Side Barrel & Goods Table
        const sideTableR = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.7, 1.2),
          new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.7 })
        );
        sideTableR.position.set(2.4, 0.65, 0.3);
        stallGroup.add(sideTableR);

        // Oak Barrels on Right Table
        [0, 0.4].forEach((bo, bIdx) => {
          const barrel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.24, 0.28, 0.65, 12),
            new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.6 })
          );
          barrel.position.set(2.2 + bo, 1.28, 0.2 + (bIdx === 0 ? -0.2 : 0.2));
          stallGroup.add(barrel);

          // Iron Hoops on barrel
          [-0.2, 0.2].forEach((hy) => {
            const hoop = new THREE.Mesh(
              new THREE.TorusGeometry(0.27, 0.02, 6, 12),
              new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 })
            );
            hoop.rotation.x = Math.PI / 2;
            hoop.position.set(2.2 + bo, 1.28 + hy, 0.2 + (bIdx === 0 ? -0.2 : 0.2));
            stallGroup.add(hoop);
          });
        });

        // 4 Carved Timber Support Columns for Canopy
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });
        [
          [-1.75, 0.55],
          [1.75, 0.55],
          [-1.75, -0.65],
          [1.75, -0.65],
        ].forEach(([px, pz]) => {
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.7, 8), poleMat);
          pole.position.set(px, 1.75, pz);
          stallGroup.add(pole);

          // Diagonal Wooden Bracket Supports
          const bracket = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.45, 0.06),
            poleMat
          );
          bracket.position.set(px > 0 ? px - 0.15 : px + 0.15, 2.8, pz);
          bracket.rotation.z = px > 0 ? -Math.PI / 4 : Math.PI / 4;
          stallGroup.add(bracket);
        });

        // Striped Cloth Awning Canopy with multi-color scallops
        const canopyGroup = new THREE.Group();
        canopyGroup.position.set(0, 2.95, 0);

        // Striped Awning Ribs (Purple and Golden Warm Stripes)
        const stripeColors = [0x8b5cf6, 0xfef08a, 0x8b5cf6, 0xfef08a, 0x8b5cf6, 0xfef08a, 0x8b5cf6];
        stripeColors.forEach((col, sIdx) => {
          const ribW = 0.56;
          const rib = new THREE.Mesh(
            new THREE.BoxGeometry(ribW, 0.08, 2.2),
            new THREE.MeshStandardMaterial({ color: col, roughness: 0.45 })
          );
          rib.position.set(-1.68 + sIdx * ribW, 0, 0.05);
          rib.rotation.x = 0.14;
          canopyGroup.add(rib);

          // Front Wavy Awning Scallop Fringe
          const fringe = new THREE.Mesh(
            new THREE.CylinderGeometry(ribW * 0.48, ribW * 0.48, 0.16, 12, 1, false, 0, Math.PI),
            new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 })
          );
          fringe.rotation.z = Math.PI;
          fringe.rotation.x = 0.14;
          fringe.position.set(-1.68 + sIdx * ribW, -0.22, 1.14);
          canopyGroup.add(fringe);
        });
        stallGroup.add(canopyGroup);

        // Hanging Medieval Brass Lantern on canopy center
        const lantern = new THREE.Group();
        lantern.position.set(0, 2.75, 0.5);
        const lWire = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22), new THREE.MeshBasicMaterial({ color: 0x1e293b }));
        lantern.add(lWire);
        const lRoof = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.12, 6), new THREE.MeshStandardMaterial({ color: 0x78350f, metalness: 0.6 }));
        lRoof.position.y = -0.12;
        lantern.add(lRoof);
        const lBody = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.2), new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, roughness: 0.2 }));
        lBody.position.y = -0.26;
        lantern.add(lBody);
        stallGroup.add(lantern);
        shopLanternLightRef.current = lantern;

        // Vintage Hanging Brass Scale Balance on Counter
        const scaleGroup = new THREE.Group();
        scaleGroup.position.set(1.2, 1.55, 0.25);

        // Scale stand & beam
        const sPost = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.03, 0.55),
          new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.2 })
        );
        scaleGroup.add(sPost);

        const sArmGroup = new THREE.Group();
        sArmGroup.position.y = 0.26;
        const sArm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.015, 0.45),
          new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85 })
        );
        sArm.rotation.z = Math.PI / 2;
        sArmGroup.add(sArm);

        // Two hanging weighing pans
        [-0.2, 0.2].forEach((px) => {
          const panCord = new THREE.Mesh(
            new THREE.CylinderGeometry(0.006, 0.006, 0.16),
            new THREE.MeshBasicMaterial({ color: 0x78350f })
          );
          panCord.position.set(px, -0.08, 0);
          sArmGroup.add(panCord);

          const pan = new THREE.Mesh(
            new THREE.CylinderGeometry(0.09, 0.06, 0.03, 10),
            new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.15 })
          );
          pan.position.set(px, -0.17, 0);
          sArmGroup.add(pan);
        });
        scaleGroup.add(sArmGroup);
        shopScalesArmRef.current = sArmGroup;
        stallGroup.add(scaleGroup);

        // 3 Detailed Wicker & Wooden Produce Display Crates/Baskets on Counters
        // Crate 1: Crisp Red Gala Apples & Green Pears on left counter
        const crate1 = new THREE.Mesh(
          new THREE.BoxGeometry(0.65, 0.26, 0.48),
          new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.75 })
        );
        crate1.position.set(-1.25, 1.46, -0.15);
        stallGroup.add(crate1);

        [-0.14, 0.14].forEach((ax) => {
          [-0.1, 0.1].forEach((az) => {
            const apple = new THREE.Mesh(
              new THREE.SphereGeometry(0.085, 8, 8),
              new THREE.MeshStandardMaterial({ color: ax < 0 ? 0xef4444 : 0x84cc16, roughness: 0.3 })
            );
            apple.position.set(-1.25 + ax, 1.62, -0.15 + az);
            stallGroup.add(apple);
          });
        });

        // Crate 2: Ripe Oranges on Left Produce Table
        const crate2 = new THREE.Mesh(
          new THREE.CylinderGeometry(0.38, 0.32, 0.28, 12),
          new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 })
        );
        crate2.position.set(-2.4, 1.15, 0.3);
        stallGroup.add(crate2);

        // Pile of oranges in wicker tub
        for (let o = 0; o < 6; o++) {
          const ang = (o * Math.PI * 2) / 5;
          const orange = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 })
          );
          orange.position.set(
            -2.4 + (o < 5 ? Math.cos(ang) * 0.18 : 0),
            1.32 + (o === 5 ? 0.08 : 0),
            0.3 + (o < 5 ? Math.sin(ang) * 0.18 : 0)
          );
          stallGroup.add(orange);
        }

        // Fresh Bakery Bread Loaves & Cheese Wheel on Stall Shelf
        const cheese = new THREE.Mesh(
          new THREE.CylinderGeometry(0.24, 0.24, 0.14, 12),
          new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.6 })
        );
        cheese.position.set(-0.45, 1.4, -0.2);
        stallGroup.add(cheese);

        const breadLoaf = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 })
        );
        breadLoaf.scale.set(1.5, 0.8, 0.9);
        breadLoaf.position.set(-0.45, 1.4, 0.2);
        stallGroup.add(breadLoaf);

        rootGroup.add(stallGroup);

        // Wooden "CERRADO" Sign on counter (appears on defeat)
        const closedSign = new THREE.Mesh(
          new THREE.BoxGeometry(0.8, 0.35, 0.06),
          new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.7 })
        );
        closedSign.position.set(0, 1.45, 0.3);
        closedSign.visible = false;
        rootGroup.add(closedSign);
        shopClosedSignRef.current = closedSign;

        // Don Mateo Celebration Coins Fountain (16 coins popping up on win)
        const cheerCoins = new THREE.Group();
        cheerCoins.position.set(0, 1.8, -1.2);
        const coinMat = new THREE.MeshStandardMaterial({
          color: 0xfbbf24,
          emissive: 0xd97706,
          metalness: 0.9,
          roughness: 0.2,
        });
        for (let c = 0; c < 16; c++) {
          const cAngle = (c * Math.PI * 2) / 16;
          const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 10), coinMat);
          coin.position.set(Math.cos(cAngle) * 0.7, (c % 4) * 0.2, Math.sin(cAngle) * 0.5);
          coin.rotation.x = Math.PI / 3;
          cheerCoins.add(coin);
        }
        cheerCoins.visible = false;
        rootGroup.add(cheerCoins);
        shopCheerCoinsRef.current = cheerCoins;

        // Customer's Giant Golden Celebration Bag (appears on win)
        const celebBag = new THREE.Group();
        celebBag.position.set(0.45, 1.35, 1.4);
        const bagBody = new THREE.Mesh(
          new THREE.SphereGeometry(0.32, 10, 10),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xb45309, roughness: 0.3 })
        );
        bagBody.scale.set(1.0, 1.3, 1.0);
        celebBag.add(bagBody);
        celebBag.visible = false;
        rootGroup.add(celebBag);
        shopCelebrationBagRef.current = celebBag;

        // Merchant Don Mateo (Sculpted apron with pocket, curled mustache, toque & cuffs)
        const merchantObj = createMerchantCharacter();
        merchantObj.group.position.set(0, 0.3, -1.2);
        rootGroup.add(merchantObj.group);
        shopMerchantRef.current = merchantObj.group;
        shopMerchantHeadRef.current = merchantObj.headGroup;
        merchantCharRef.current = merchantObj;

        // Wooden Cash Register / Coin Box on merchant counter (right side)
        const cashbox = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.3, 0.45),
          new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.5 })
        );
        cashbox.position.set(0.9, 1.45, -0.3);
        rootGroup.add(cashbox);
        shopCashboxRef.current = cashbox;

        // Customer's Detailed Hand-Woven Wicker Shopping Basket on front counter (left side)
        const basket = new THREE.Group();
        basket.position.set(-0.85, 1.35, 0.35);

        // Basket Outer Body (Tapered woven wicker)
        const bRim = new THREE.Mesh(
          new THREE.CylinderGeometry(0.38, 0.28, 0.32, 16),
          new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 })
        );
        basket.add(bRim);

        // Wicker Weave Texture Rings
        [-0.08, 0, 0.08].forEach((wy) => {
          const wRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.33 + wy * 0.2, 0.02, 6, 16),
            new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.9 })
          );
          wRing.rotation.x = Math.PI / 2;
          wRing.position.y = wy;
          basket.add(wRing);
        });

        // Cloth Checkered Napkin draped over edge
        const napkin = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 0.02, 0.36),
          new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.7 })
        );
        napkin.position.set(-0.16, 0.16, 0);
        napkin.rotation.z = -0.3;
        basket.add(napkin);

        // Braided Wicker Handle
        const handle = new THREE.Mesh(
          new THREE.TorusGeometry(0.32, 0.035, 8, 16, Math.PI),
          new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 })
        );
        handle.position.y = 0.18;
        handle.rotation.x = Math.PI / 2;
        basket.add(handle);

        // French Baguette sticking out of basket
        const baguette = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.04, 0.48, 8),
          new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.7 })
        );
        baguette.position.set(0.12, 0.22, -0.06);
        baguette.rotation.z = 0.35;
        baguette.rotation.x = -0.2;
        basket.add(baguette);

        // Visual items inside customer's basket
        const boughtCount = Math.max(0, shopCartTotal || questionIndex);
        for (let b = 0; b < Math.min(boughtCount, 6); b++) {
          const itemColors = [0xef4444, 0x38bdf8, 0x10b981, 0xf59e0b, 0xa855f7, 0xec4899];
          const itemInBasket = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 8, 8),
            new THREE.MeshStandardMaterial({ color: itemColors[b % itemColors.length], roughness: 0.35 })
          );
          itemInBasket.position.set((b % 2) * 0.14 - 0.07, 0.08 + Math.floor(b / 2) * 0.07, (b % 3) * 0.1 - 0.08);
          basket.add(itemInBasket);
        }

        rootGroup.add(basket);
        shopBasketGroupRef.current = basket;

        // Customer Avatar in foreground (Sculpted coat, satchel bag & boots)
        const customerObj = createCustomerCharacter();
        customerObj.group.position.set(0, 0.3, 1.8);
        rootGroup.add(customerObj.group);
        shopCustomerRef.current = customerObj.group;
        customerCharRef.current = customerObj;

        // Active Golden Coins stack (held by customer, ready to pay)
        const coinsGroup = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.2, 0.12, 12),
          new THREE.MeshStandardMaterial({
            color: 0xfbbf24,
            emissive: 0xd97706,
            metalness: 0.8,
            roughness: 0.2,
          })
        );
        coinsGroup.position.set(0.1, 1.25, 1.2);
        rootGroup.add(coinsGroup);
        shopCoinsMeshRef.current = coinsGroup;

        // Active Product being purchased (rests on merchant stand, ready to deliver)
        const productGroup = new THREE.Group();
        productGroup.position.set(0, 1.45, -0.2);

        // Glowing Apple / Potion item
        const appleMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 10, 10),
          new THREE.MeshStandardMaterial({
            color: 0xef4444,
            emissive: 0x991b1b,
            roughness: 0.3,
          })
        );
        productGroup.add(appleMesh);

        // Small stem
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 0.08),
          new THREE.MeshStandardMaterial({ color: 0x15803d })
        );
        stem.position.y = 0.18;
        productGroup.add(stem);

        rootGroup.add(productGroup);
        shopProductMeshRef.current = productGroup;

        // In-Scene 3D Golden Shop Sparkle Particles
        const shopSparksGroup = new THREE.Group();
        const shopSparksData: { mesh: THREE.Mesh; initialY: number; speed: number; angle: number; radius: number }[] = [];
        const sparkMat = new THREE.MeshStandardMaterial({
          color: 0xfbbf24,
          emissive: 0xd97706,
          emissiveIntensity: 0.8,
          roughness: 0.2,
          metalness: 0.9,
        });
        for (let sp = 0; sp < 14; sp++) {
          const sMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), sparkMat);
          sMesh.position.set(
            (Math.random() - 0.5) * 1.8,
            1.4 + Math.random() * 0.8,
            (Math.random() - 0.5) * 1.2
          );
          shopSparksGroup.add(sMesh);
          shopSparksData.push({
            mesh: sMesh,
            initialY: sMesh.position.y,
            speed: 1.2 + Math.random() * 1.5,
            angle: Math.random() * Math.PI * 2,
            radius: 0.4 + Math.random() * 0.8,
          });
        }
        rootGroup.add(shopSparksGroup);
        shopSparksGroupRef.current = shopSparksGroup;
        shopSparksDataRef.current = shopSparksData;

        // Cañón de confeti 3D de victoria (Tienda)
        const shopConfetti = create3DConfettiGroup(new THREE.Vector3(0, 2.8, 0), 100);
        rootGroup.add(shopConfetti);
        finishConfettiGroupRef.current = shopConfetti;
      } else if (gameMode === 'bridge') {
        // WORLD 4: RÍO — Puente Colgante en Cañón 3D & Relieves Rocosos
        targetCamPos.current.set(0, 5, 8.5);
        targetCamLookAt.current.set(0, 1.0, 0);

        // Sculpted River Canyon Gorge (Terraced natural rock shelves with geological sediment strata & lush meadows)
        const sedimentTex = createRiverSedimentTexture();
        const riverMeadowTex = createMeadowGrassTexture();
        [-5.2, 5.2].forEach((cx, cIdx) => {
          const cliffGroup = new THREE.Group();
          cliffGroup.position.set(cx, 0, 0);

          // Lower rock bluff (beveled smooth rock with layered sedimentary striations)
          const cliffBase = new THREE.Mesh(
            new THREE.BoxGeometry(4.4, 2.6, 7.6),
            new THREE.MeshStandardMaterial({
              map: sedimentTex,
              color: 0xffffff,
              roughness: 0.85,
              flatShading: false,
            })
          );
          cliffBase.position.set(0, 0.4, 0);
          cliffGroup.add(cliffBase);

          // Terraced intermediate stone ledge
          const ledge = new THREE.Mesh(
            new THREE.BoxGeometry(4.2, 0.5, 7.2),
            new THREE.MeshStandardMaterial({ map: sedimentTex, color: 0x94a3b8, roughness: 0.8 })
          );
          ledge.position.set(cIdx === 0 ? 0.3 : -0.3, 1.5, 0);
          cliffGroup.add(ledge);

          // Top Lush Sloping Meadow with grass blade texture
          const grassTop = new THREE.Mesh(
            new THREE.BoxGeometry(4.2, 0.35, 7.4),
            new THREE.MeshStandardMaterial({
              map: riverMeadowTex,
              color: 0xffffff,
              roughness: 0.7,
              flatShading: false,
            })
          );
          grassTop.position.set(0, 1.95, 0);
          cliffGroup.add(grassTop);

          // Alpine Wildflowers on cliff top
          const flowerColors = [0xfbbf24, 0xf43f5e, 0x38bdf8];
          for (let f = -3; f <= 3; f += 1.2) {
            const flower = new THREE.Mesh(
              new THREE.SphereGeometry(0.1, 8, 8),
              new THREE.MeshStandardMaterial({ color: flowerColors[Math.abs(Math.floor(f)) % flowerColors.length] })
            );
            flower.position.set((Math.random() - 0.5) * 1.5, 2.2, f + (Math.random() - 0.5) * 0.4);
            cliffGroup.add(flower);
          }

          // Shoreline River Boulders resting at water edge
          [-2.2, 0, 2.2].forEach((bz) => {
            const boulder = new THREE.Mesh(
              new THREE.DodecahedronGeometry(0.38 + Math.random() * 0.2, 2),
              new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 })
            );
            boulder.position.set(cIdx === 0 ? 2.0 : -2.0, -0.4, bz);
            cliffGroup.add(boulder);
          });

          rootGroup.add(cliffGroup);
        });

        // Water surface between cliffs with animated turquoise river flow
        const waterRiver = new THREE.Mesh(
          new THREE.PlaneGeometry(8, 9, 20, 20),
          new THREE.MeshStandardMaterial({
            color: 0x0284c7,
            roughness: 0.12,
            metalness: 0.75,
            transparent: true,
            opacity: 0.92,
          })
        );
        waterRiver.rotation.x = -Math.PI / 2;
        waterRiver.position.set(0, -0.55, 0);
        rootGroup.add(waterRiver);

        // Floating Water Lily Pads with Pink Blossoms
        [-1.6, 0.4, 1.5].forEach((lz, idx) => {
          const lily = new THREE.Mesh(
            new THREE.CylinderGeometry(0.24, 0.24, 0.02, 12),
            new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 })
          );
          lily.position.set(idx % 2 === 0 ? -0.8 : 0.8, -0.52, lz);
          rootGroup.add(lily);

          const flowerPink = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.3 })
          );
          flowerPink.position.set(idx % 2 === 0 ? -0.8 : 0.8, -0.46, lz);
          rootGroup.add(flowerPink);
        });

        // Suspension Bridge Steel/Rope Cables stretching between cliffs
        const cableMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
        [-0.85, 0.85].forEach((cz) => {
          const cableCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-3.0, 1.8, cz),
            new THREE.Vector3(0, 0.95, cz),
            new THREE.Vector3(3.0, 1.8, cz),
          ]);
          const cableGeo = new THREE.TubeGeometry(cableCurve, 20, 0.035, 6, false);
          const cableMesh = new THREE.Mesh(cableGeo, cableMat);
          rootGroup.add(cableMesh);

          // Anchorage posts on cliffs
          [-3.0, 3.0].forEach((px) => {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.2), cableMat);
            post.position.set(px, 1.6, cz);
            rootGroup.add(post);
          });
        });

        // Dynamic Bridge Segments Group
        const bridgeGroup = new THREE.Group();
        bridgeSegmentsGroupRef.current = bridgeGroup;
        renderBridgeSegments(bridgeGroup, bridgeBuiltSegments, totalQuestionsRef.current);
        rootGroup.add(bridgeGroup);

        // Victory Flag on Destination Cliff (Plants on win)
        const flagGroup = new THREE.Group();
        flagGroup.position.set(3.8, 2.1, 0);
        const fPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2), new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.8 }));
        fPole.position.y = 1.1;
        flagGroup.add(fPole);
        const fBanner = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.03), new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
        fBanner.position.set(0.4, 1.8, 0);
        flagGroup.add(fBanner);
        flagGroup.visible = false;
        rootGroup.add(flagGroup);
        bridgeVictoryFlagRef.current = flagGroup;

        // Broken Bridge Plank (Falls into the canyon on defeat)
        const brokenPlank = new THREE.Mesh(
          new THREE.BoxGeometry(0.8, 0.1, 0.45),
          new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9 })
        );
        brokenPlank.position.set(0, 0.8, 0);
        brokenPlank.visible = false;
        rootGroup.add(brokenPlank);
        bridgeBrokenPlankRef.current = brokenPlank;

        // Character walking across the bridge (Sculpted explorer with ranger hat, vest pockets, pack & staff)
        const walkerObj = createExplorerCharacter();
        const walkerX = -2.6 + (bridgeBuiltSegments / Math.max(1, totalQuestionsRef.current)) * 5.2;
        walkerObj.group.position.set(walkerX, 1.12, 0);
        walkerObj.group.rotation.y = Math.PI / 2;
        rootGroup.add(walkerObj.group);
        bridgeWalkerRef.current = walkerObj.group;
        walkerCharRef.current = walkerObj;

        // Cañón de confeti 3D de victoria (Puente)
        const bridgeConfetti = create3DConfettiGroup(new THREE.Vector3(3.8, 2.8, 0), 100);
        rootGroup.add(bridgeConfetti);
        finishConfettiGroupRef.current = bridgeConfetti;
      } else if (gameMode === 'detective') {
        // WORLD 5: CASTILLO — Gran Fortaleza Real, Torres Almenadas y Gran Portón Acorazado 3D
        targetCamPos.current.set(0, 4.6, 8.4);
        targetCamLookAt.current.set(0, 1.8, 0);

        // Fortress Royal Flagstone Courtyard Floor (32-segment beveled terrace with geometric rune inlay texture)
        const castleTex = createCastleCourtyardTexture();
        const courtyard = new THREE.Mesh(
          new THREE.CylinderGeometry(7.2, 6.8, 0.5, 32),
          new THREE.MeshStandardMaterial({
            map: castleTex,
            color: 0xffffff,
            roughness: 0.72,
            flatShading: false,
          })
        );
        courtyard.position.y = 0;
        courtyard.receiveShadow = true;
        rootGroup.add(courtyard);

        // Island Sub-Keel: Inverted Dark Slate Citadel Foundation & Floating Mana Core
        const castleKeel = new THREE.Mesh(
          new THREE.ConeGeometry(6.6, 4.4, 24),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.95 })
        );
        castleKeel.rotation.x = Math.PI;
        castleKeel.position.y = -2.4;
        rootGroup.add(castleKeel);

        const castleCoreMana = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.85, 0),
          new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x7e22ce, roughness: 0.15, metalness: 0.7 })
        );
        castleCoreMana.position.y = -5.0;
        castleCoreMana.scale.set(0.8, 2.0, 0.8);
        rootGroup.add(castleCoreMana);

        // Concentric Royal Gold & Obsidian Inlay Rings
        [2.8, 4.8, 6.2].forEach((radius) => {
          const ringMesh = new THREE.Mesh(
            new THREE.RingGeometry(radius, radius + 0.16, 32),
            new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xb45309, roughness: 0.4, side: THREE.DoubleSide })
          );
          ringMesh.rotation.x = -Math.PI / 2;
          ringMesh.position.y = 0.26;
          rootGroup.add(ringMesh);
        });

        // Massive Stone Fortress Structure Group
        const castleArchGroup = new THREE.Group();
        castleArchGroup.position.set(0, 0, 0);

        // Stone Texture Materials
        const stoneDark = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
        const stoneMedium = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
        const stoneTrim = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
        const goldRoyal = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0x78350f, metalness: 0.8, roughness: 0.3 });

        // Left & Right Flanking Curtain Walls
        const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(2.8, 5.6, 1.6), stoneMedium);
        wallLeft.position.set(-3.0, 2.8, -1.0);
        wallLeft.castShadow = true;
        castleArchGroup.add(wallLeft);

        const wallRight = new THREE.Mesh(new THREE.BoxGeometry(2.8, 5.6, 1.6), stoneMedium);
        wallRight.position.set(3.0, 2.8, -1.0);
        wallRight.castShadow = true;
        castleArchGroup.add(wallRight);

        // Heavy Slanted Stone Buttresses for architectural depth
        [-4.2, 4.2].forEach((bx) => {
          const buttress = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 4.2, 1.2),
            stoneDark
          );
          buttress.position.set(bx, 2.1, -0.4);
          buttress.rotation.x = 0.12;
          castleArchGroup.add(buttress);
        });

        // Twin Cylindrical Flanking Watchtowers
        [-4.3, 4.3].forEach((tx) => {
          const towerGroup = new THREE.Group();
          towerGroup.position.set(tx, 0, -1.0);

          // Tower Body
          const tCyl = new THREE.Mesh(
            new THREE.CylinderGeometry(1.05, 1.2, 7.2, 18),
            stoneMedium
          );
          tCyl.position.y = 3.6;
          tCyl.castShadow = true;
          towerGroup.add(tCyl);

          // Machicolation overhang platform
          const machicolation = new THREE.Mesh(
            new THREE.CylinderGeometry(1.25, 1.05, 0.45, 18),
            stoneTrim
          );
          machicolation.position.y = 7.2;
          towerGroup.add(machicolation);

          // Tower Crenellations / Battlements (Merlons)
          for (let m = 0; m < 8; m++) {
            const mAng = (m * Math.PI * 2) / 8;
            const merlon = new THREE.Mesh(
              new THREE.BoxGeometry(0.35, 0.45, 0.22),
              stoneDark
            );
            merlon.position.set(Math.cos(mAng) * 1.15, 7.6, Math.sin(mAng) * 1.15);
            merlon.rotation.y = -mAng;
            towerGroup.add(merlon);
          }

          // Conical Witch Hat Tower Spire (Deep Royal Slate Navy)
          const spire = new THREE.Mesh(
            new THREE.ConeGeometry(1.3, 2.8, 16),
            new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 })
          );
          spire.position.y = 8.8;
          towerGroup.add(spire);

          // Golden Crown Weather Vane on tower tip
          const vane = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.18, 0),
            goldRoyal
          );
          vane.position.y = 10.3;
          towerGroup.add(vane);

          castleArchGroup.add(towerGroup);
        });

        // 2 High Royal Heraldic Silk Banners hanging from curtain walls
        castleBannersRef.current = [];
        [-2.9, 2.9].forEach((bx) => {
          const banner = new THREE.Mesh(
            new THREE.BoxGeometry(0.85, 2.6, 0.04),
            new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.5 })
          );
          banner.position.set(bx, 3.4, -0.15);
          castleArchGroup.add(banner);
          castleBannersRef.current.push(banner);

          // Golden Lion Crest Emblem on Banner
          const emblem = new THREE.Mesh(
            new THREE.BoxGeometry(0.35, 0.35, 0.06),
            goldRoyal
          );
          emblem.position.set(bx, 3.8, -0.12);
          castleArchGroup.add(emblem);
        });

        // Romanesque Entrance Portal: Stepped Archivolts & Fluted Columns
        [-1.75, 1.75].forEach((px) => {
          const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.26, 0.32, 5.2, 16),
            stoneTrim
          );
          pillar.position.set(px, 2.6, -0.1);
          castleArchGroup.add(pillar);

          const capital = new THREE.Mesh(
            new THREE.BoxGeometry(0.75, 0.32, 0.75),
            stoneDark
          );
          capital.position.set(px, 5.2, -0.1);
          castleArchGroup.add(capital);
        });

        // Multi-Layered Arch Portal Header (Stepped Gothic Archivolt)
        const archTopOuter = new THREE.Mesh(
          new THREE.BoxGeometry(4.0, 1.4, 1.4),
          stoneDark
        );
        archTopOuter.position.set(0, 5.2, -0.8);
        castleArchGroup.add(archTopOuter);

        // Wall Crenellations on central rampart
        for (let cr = -3; cr <= 3; cr += 2) {
          const merlon = new THREE.Mesh(
            new THREE.BoxGeometry(0.65, 0.5, 0.45),
            stoneTrim
          );
          merlon.position.set(cr * 0.7, 6.15, -0.8);
          castleArchGroup.add(merlon);
        }

        // Glowing Gothic Rose Stained-Glass Window above archway
        const roseGlass = new THREE.Mesh(
          new THREE.CircleGeometry(0.95, 24),
          new THREE.MeshStandardMaterial({
            color: 0xc084fc,
            emissive: 0x9333ea,
            emissiveIntensity: 0.7,
            roughness: 0.1,
            side: THREE.DoubleSide,
          })
        );
        roseGlass.position.set(0, 5.2, -0.08);
        castleArchGroup.add(roseGlass);
        castleRoseGlowRef.current = roseGlass;

        // Rose Window Stone Tracery Spokes
        for (let r = 0; r < 8; r++) {
          const rAng = (r * Math.PI) / 4;
          const spoke = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 1.85, 0.08),
            stoneDark
          );
          spoke.position.set(0, 5.2, -0.05);
          spoke.rotation.z = rAng;
          castleArchGroup.add(spoke);
        }

        // Standing Stone Pedestals with Medieval Iron Braziers (Animated Fire)
        castleBrazierFlamesRef.current = [];
        [-3.6, 3.6].forEach((ux) => {
          const brazierGroup = new THREE.Group();
          brazierGroup.position.set(ux, 0.25, 1.4);

          // Carved Stone Pedestal
          const pedestal = new THREE.Mesh(
            new THREE.CylinderGeometry(0.4, 0.46, 0.9, 16),
            stoneTrim
          );
          pedestal.position.y = 0.45;
          brazierGroup.add(pedestal);

          // Iron Fire Bowl
          const bowl = new THREE.Mesh(
            new THREE.CylinderGeometry(0.48, 0.24, 0.35, 12),
            new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 })
          );
          bowl.position.y = 1.0;
          brazierGroup.add(bowl);

          // Animated Fire Flame
          const flame = new THREE.Mesh(
            new THREE.ConeGeometry(0.24, 0.55, 10),
            new THREE.MeshStandardMaterial({
              color: 0xf59e0b,
              emissive: 0xd97706,
              emissiveIntensity: 1.2,
              roughness: 0.2,
            })
          );
          flame.position.y = 1.35;
          brazierGroup.add(flame);
          castleBrazierFlamesRef.current.push(flame);

          castleArchGroup.add(brazierGroup);
        });

        rootGroup.add(castleArchGroup);

        // Heavy Iron Spiked Portcullis (Drops down on defeat)
        const portcullis = new THREE.Group();
        portcullis.position.set(0, 6.2, -0.65); // High above archway initially
        const ironBarMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });
        // 7 vertical bars with bottom spikes
        for (let b = -3; b <= 3; b++) {
          const vBar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 3.6), ironBarMat);
          vBar.position.set(b * 0.4, 0, 0);
          portcullis.add(vBar);
          const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.28, 4), ironBarMat);
          spike.position.set(b * 0.4, -1.9, 0);
          spike.rotation.x = Math.PI;
          portcullis.add(spike);
        }
        // 3 horizontal crossbeams
        [-1.0, 0, 1.0].forEach((hy) => {
          const hBar = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.09, 0.09), ironBarMat);
          hBar.position.set(0, hy, 0);
          portcullis.add(hBar);
        });
        portcullis.visible = false;
        rootGroup.add(portcullis);
        castlePortcullisRef.current = portcullis as unknown as THREE.Mesh;

        // Torches with fire on the wall sides
        [-2.0, 2.0].forEach((tx) => {
          const torchSconce = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.04, 0.5),
            new THREE.MeshStandardMaterial({ color: 0x78350f })
          );
          torchSconce.position.set(tx, 2.8, -0.15);
          rootGroup.add(torchSconce);

          const flame = new THREE.Mesh(
            new THREE.ConeGeometry(0.12, 0.28, 8),
            new THREE.MeshBasicMaterial({ color: 0xf59e0b })
          );
          flame.position.set(tx, 3.1, -0.15);
          rootGroup.add(flame);
          castleBrazierFlamesRef.current.push(flame);
        });

        // Interior Golden Vault Chamber (revealed when doors open)
        const chestGroup = new THREE.Group();
        chestGroup.position.set(0, 1.1, -2.4);

        const chestBase = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.6, 0.6),
          new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            emissive: 0xd97706,
            metalness: 0.85,
            roughness: 0.2,
          })
        );
        chestGroup.add(chestBase);

        const chestLid = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10, 1, false, 0, Math.PI),
          new THREE.MeshStandardMaterial({
            color: 0xfbbf24,
            emissive: 0xb45309,
            metalness: 0.9,
          })
        );
        chestLid.rotation.z = Math.PI / 2;
        chestLid.position.y = 0.3;
        chestGroup.add(chestLid);

        // Vault Floating Royal Treasures (Crown, Chalice, Diamond that rise up on win)
        const treasuresGroup = new THREE.Group();
        treasuresGroup.position.set(0, 0.5, 0);

        // Golden Royal Chalice
        const chalice = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.04, 0.25, 8),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.95, roughness: 0.1 })
        );
        chalice.position.set(-0.25, 0.2, 0);
        treasuresGroup.add(chalice);

        // Royal Crown
        const crown = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.14, 0.16, 8),
          new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xb45309, metalness: 0.9 })
        );
        crown.position.set(0.25, 0.2, 0);
        treasuresGroup.add(crown);

        // Sparkling Blue Diamond
        const diamond = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.15),
          new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, roughness: 0.1 })
        );
        diamond.position.set(0, 0.45, 0);
        treasuresGroup.add(diamond);

        treasuresGroup.visible = false;
        chestGroup.add(treasuresGroup);
        castleSparklesRef.current = treasuresGroup;

        rootGroup.add(chestGroup);
        castleChestRef.current = chestGroup;

        // Double Heavy Oak Vault Doors Reinforced with Iron Straps & Studs (hinged on left and right)
        const doorLeft = new THREE.Group();
        doorLeft.position.set(-1.5, 1.9, -0.8);
        const dMeshL = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 3.4, 0.24),
          new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 })
        );
        dMeshL.position.x = 0.75;
        doorLeft.add(dMeshL);

        // Iron reinforcement straps on Left Door
        [-1.0, 0, 1.0].forEach((sy) => {
          const strap = new THREE.Mesh(
            new THREE.BoxGeometry(1.4, 0.12, 0.28),
            ironBarMat
          );
          strap.position.set(0.75, sy, 0);
          doorLeft.add(strap);
        });

        rootGroup.add(doorLeft);
        castleDoorLeftRef.current = doorLeft;

        const doorRight = new THREE.Group();
        doorRight.position.set(1.5, 1.9, -0.8);
        const dMeshR = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 3.4, 0.24),
          new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 })
        );
        dMeshR.position.x = -0.75;
        doorRight.add(dMeshR);

        // Iron reinforcement straps on Right Door
        [-1.0, 0, 1.0].forEach((sy) => {
          const strap = new THREE.Mesh(
            new THREE.BoxGeometry(1.4, 0.12, 0.28),
            ironBarMat
          );
          strap.position.set(-0.75, sy, 0);
          doorRight.add(strap);
        });

        rootGroup.add(doorRight);
        castleDoorRightRef.current = doorRight;

        // Initial door rotation based on unlocked enigmas
        const currentUnlocked = cluesFound || questionIndex;
        if (currentUnlocked >= 5) {
          doorLeft.rotation.y = -1.2;
          doorRight.rotation.y = 1.2;
        } else {
          doorLeft.rotation.y = -currentUnlocked * 0.08;
          doorRight.rotation.y = currentUnlocked * 0.08;
        }

        // 5 Heavy Iron Cross-Bolts horizontally locking the doors
        castleLockBarsRef.current = [];
        const startY = 0.9;
        const boltSpacing = 0.5;

        for (let i = 0; i < 5; i++) {
          const isUnlocked = i < currentUnlocked;
          const isCurrent = i === questionIndex;

          const boltGeo = new THREE.BoxGeometry(1.8, 0.22, 0.28);
          const boltMat = new THREE.MeshStandardMaterial({
            color: isUnlocked ? 0x10b981 : isCurrent ? 0xf59e0b : 0x64748b,
            emissive: isUnlocked ? 0x065f46 : isCurrent ? 0x78350f : 0x000000,
            metalness: 0.7,
            roughness: 0.3,
          });
          const bolt = new THREE.Mesh(boltGeo, boltMat);
          bolt.position.set(isUnlocked ? 2.4 : 0, startY + i * boltSpacing, -0.65);
          rootGroup.add(bolt);
          castleLockBarsRef.current.push(bolt);
        }

        // Detective Character in left foreground (Trench coat with lapels, fedora hat, cipher wand & boots)
        const detObj = createDetectiveCharacter();
        detObj.group.position.set(-1.8, 0.3, 2.2);
        detObj.group.rotation.y = Math.PI / 4;
        rootGroup.add(detObj.group);
        castleDetectiveRef.current = detObj.group;
        detectiveCharRef.current = detObj;

        // Cañón de confeti 3D de victoria (Detective)
        const castleConfetti = create3DConfettiGroup(new THREE.Vector3(0, 3.0, 0.2), 110);
        rootGroup.add(castleConfetti);
        finishConfettiGroupRef.current = castleConfetti;

        // Detective Defeat Question Marks (3 question marks rotating on defeat)
        const qmGroup = new THREE.Group();
        qmGroup.position.set(0, 1.8, 0);
        for (let q = 0; q < 3; q++) {
          const qAngle = (q * Math.PI * 2) / 3;
          const qMark = new THREE.Mesh(
            new THREE.TorusGeometry(0.1, 0.03, 6, 8, Math.PI * 1.5),
            new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b })
          );
          qMark.position.set(Math.cos(qAngle) * 0.4, 0, Math.sin(qAngle) * 0.4);
          qmGroup.add(qMark);
        }
        qmGroup.visible = false;
        detObj.group.add(qmGroup);
        castleQuestionMarksRef.current = qmGroup;

        // Cipher Ray Light Beam (connecting wand to lock bar)
        const beamGeo = new THREE.CylinderGeometry(0.05, 0.08, 3.2, 8);
        const beamMat = new THREE.MeshBasicMaterial({
          color: 0xfbbf24,
          transparent: true,
          opacity: 0,
        });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.set(-0.9, 1.4, 0.8);
        beam.rotation.x = Math.PI / 2.6;
        beam.rotation.z = -Math.PI / 6;
        rootGroup.add(beam);
        castleBeamMeshRef.current = beam;

        // Haz de luz dorado tipo "bóveda" que sale por la puerta al ganar el
        // nivel completo (oculto hasta la secuencia de victoria, más abajo).
        const gateGlowMat = new THREE.MeshBasicMaterial({
          color: 0xfef08a,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const gateGlow = new THREE.Mesh(new THREE.ConeGeometry(2.4, 5.2, 16, 1, true), gateGlowMat);
        gateGlow.rotation.x = -Math.PI / 2;
        gateGlow.position.set(0, 1.8, -1.2);
        gateGlow.visible = false;
        rootGroup.add(gateGlow);
        castleGateGlowRef.current = gateGlow;
      }
    }

    scene.add(rootGroup);
    // totalQuestions se lee vía totalQuestionsRef (ver arriba) a propósito:
    // no debe estar aquí. Si se cambia, este efecto reconstruye TODA la
    // escena 3D (~2000 líneas de geometría) y no hace falta para ese cambio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, currentRegionId, gameMode]);

  // Montar/desmontar el FX 3D "Mario Galaxy" cuando entra o sale la
  // celebración de región desbloqueada. Efecto liviano y aparte del de
  // arriba: solo crea/destruye este grupo puntual, no reconstruye la escena.
  useEffect(() => {
    if (!sceneRef.current) return;

    if (galaxyUnlockFXRef.current) {
      sceneRef.current.remove(galaxyUnlockFXRef.current.group);
      disposeObjectHierarchy(galaxyUnlockFXRef.current.group);
      galaxyUnlockFXRef.current = null;
    }

    if (viewMode === 'map' && unlockingRegionId) {
      const targetRegion = REGIONS.find((r) => r.id === unlockingRegionId);
      if (targetRegion) {
        const fx = createMarioGalaxyUnlockFX(targetRegion.islandPosition, targetRegion.themeColor);
        sceneRef.current.add(fx.group);
        galaxyUnlockFXRef.current = { ...fx, targetRegionId: unlockingRegionId };
        galaxyUnlockStartTimeRef.current = performance.now();
      }
    }

    return () => {
      if (galaxyUnlockFXRef.current && sceneRef.current) {
        sceneRef.current.remove(galaxyUnlockFXRef.current.group);
        disposeObjectHierarchy(galaxyUnlockFXRef.current.group);
        galaxyUnlockFXRef.current = null;
      }
    };
  }, [viewMode, unlockingRegionId]);

  // Montar/desmontar el FX 3D del Gran Final "universo completado". Efecto aparte y liviano,
  // igual que el del desbloqueo de región: solo crea/destruye su propio grupo, no reconstruye
  // la escena. Se libera con disposeUniverseFinaleFX (la limpieza genérica de arriba solo
  // recorre Mesh y dejaría sin liberar los meteoros y el polvo estelar).
  useEffect(() => {
    if (!sceneRef.current) return;

    if (universeFinaleFXRef.current) {
      sceneRef.current.remove(universeFinaleFXRef.current.group);
      disposeUniverseFinaleFX(universeFinaleFXRef.current);
      universeFinaleFXRef.current = null;
    }

    if (viewMode === 'map' && universeFinaleActive) {
      const fx = createUniverseFinaleFX(
        REGIONS.map((r) => ({ id: r.id, position: r.islandPosition, color: r.themeColor })),
      );
      sceneRef.current.add(fx.group);
      universeFinaleFXRef.current = fx;
      universeFinaleStartTimeRef.current = performance.now();
    }

    return () => {
      if (universeFinaleFXRef.current && sceneRef.current) {
        sceneRef.current.remove(universeFinaleFXRef.current.group);
        disposeUniverseFinaleFX(universeFinaleFXRef.current);
        universeFinaleFXRef.current = null;
      }
    };
  }, [viewMode, universeFinaleActive]);

  // Update Dynamic Bridge Segments and advance walker when bridgeBuiltSegments changes
  useEffect(() => {
    if (gameMode !== 'bridge' || !bridgeSegmentsGroupRef.current) return;
    renderBridgeSegments(bridgeSegmentsGroupRef.current, bridgeBuiltSegments, totalQuestions);

    // Keep walker grounded on the bridge at current progress if not mid-leap
    if (bridgeWalkerRef.current && isCorrectRef.current === null) {
      const startX = -2.6;
      const endX = 2.6;
      const totalSegs = totalQuestions || 5;
      const targetWalkerX = startX + (bridgeBuiltSegments / totalSegs) * (endX - startX);
      bridgeWalkerRef.current.position.x = targetWalkerX;
      bridgeWalkerRef.current.position.y = 1.12;
    }
  }, [bridgeBuiltSegments, totalQuestions, gameMode]);

  // Update Castle Enigma Lock Bars when questionIndex or cluesFound changes
  useEffect(() => {
    if (gameMode !== 'detective' || castleLockBarsRef.current.length === 0) return;
    const currentUnlocked = cluesFound;
    castleLockBarsRef.current.forEach((bolt, i) => {
      const isUnlocked = i < currentUnlocked;
      const isCurrent = i === questionIndex;
      if (bolt.material instanceof THREE.MeshStandardMaterial) {
        bolt.material.color.setHex(isUnlocked ? 0x10b981 : isCurrent ? 0xf59e0b : 0x64748b);
        bolt.material.emissive.setHex(isUnlocked ? 0x065f46 : isCurrent ? 0x78350f : 0x000000);
      }
      if (!isUnlocked && bolt.position.x !== 0) {
        bolt.position.x = 0;
      } else if (isUnlocked && bolt.position.x !== 2.4) {
        bolt.position.x = 2.4;
      }
    });
  }, [questionIndex, cluesFound, gameMode]);

  // Handle Response Animation (Race real advance/retreat, Battle real contact strike, etc.)
  useEffect(() => {
    if (isCorrect === null) return;

    if (gameMode === 'race' && runnerGroupRef.current) {
      const runner = runnerGroupRef.current;
      const startZ = runner.position.z;
      const startTime = performance.now();

      if (isCorrect) {
        // Runner pushes forward with a sustained, powerful burst of speed (1300ms)
        // Stays at new position permanently, maintaining forward momentum
        runnerStumbleActiveRef.current = false;
        const targetZ = THREE.MathUtils.lerp(4, -8, Math.min(1, (raceProgressRef.current || 0) / 100));

        // Smoothly adjust camera along with runner to follow progress down the track
        targetCamPos.current.set(0, 4.2, Math.max(-4.5, targetZ + 4.5));
        targetCamLookAt.current.set(0, 1.2, targetZ - 4.0);

        const sprintAnim = (time: number) => {
          // Duration: 1300ms for a clear, readable forward surge
          const elapsed = (time - startTime) / 1300;

          if (elapsed < 1.0 && runnerGroupRef.current) {
            // Smooth easeOutCubic curve for realistic deceleration after dash
            const t = elapsed;
            const ease = 1 - Math.pow(1 - t, 3);

            runner.position.z = THREE.MathUtils.lerp(startZ, targetZ, ease);
            // Dynamic bobbing with ground contact realism
            runner.position.y = 0.2 + Math.abs(Math.sin(elapsed * Math.PI * 3.5)) * 0.12;
            // Aerodynamic forward sprint tilt
            runner.rotation.x = Math.sin(elapsed * Math.PI) * 0.22;
            runner.rotation.z = Math.sin(elapsed * Math.PI * 3.5) * 0.04;

            // Camera smoothly tracks runner
            const currentZ = runner.position.z;
            targetCamPos.current.set(0, 4.2, Math.max(-4.5, currentZ + 4.5));
            targetCamLookAt.current.set(0, 1.2, currentZ - 4.0);

            requestAnimationFrame(sprintAnim);
          } else if (runnerGroupRef.current) {
            // Keep the runner exactly at targetZ advancing forward; never reset or return backwards!
            runner.position.y = 0.2;
            runner.position.z = targetZ;
            runner.rotation.x = 0;
            runner.rotation.z = 0;
            targetCamPos.current.set(0, 4.2, Math.max(-4.5, targetZ + 4.5));
            targetCamLookAt.current.set(0, 1.2, targetZ - 4.0);
          }
        };
        requestAnimationFrame(sprintAnim);
      } else {
        // EN RESPUESTA INCORRECTA: El corredor tropieza levemente (slight stumble),
        // se desequilibra momentáneamente pero NO retrocede bruscamente por la pista.
        // Se recupera con gracia, mantiene su posición de carrera y reanuda el trote (1350ms).
        runnerStumbleActiveRef.current = true;
        const rc = runnerCharRef.current;

        const tripAnim = (time: number) => {
          // Duration: 1350ms for a realistic, slower and clearly visible stumble & recovery
          const elapsed = (time - startTime) / 1350;

          if (elapsed < 0.35) {
            // Phase 1: Leve tropiezo y pérdida momentánea de equilibrio (0ms - 470ms)
            const phase = elapsed / 0.35;
            // Desequilibrio hacia adelante / inclinación lateral leve
            runner.position.y = 0.2 - Math.sin(phase * Math.PI) * 0.08;
            runner.rotation.x = THREE.MathUtils.lerp(0, 0.38, phase); // Inclinación hacia adelante
            runner.rotation.z = THREE.MathUtils.lerp(0, -0.18, phase); // Desbalance lateral
            // El corredor solo se frena levemente en su sitio, no se devuelva hacia atrás
            runner.position.z = startZ + phase * 0.08;

            if (rc) {
              // Brazos abiertos intentando recuperar el equilibrio
              rc.leftArm.rotation.x = -0.4;
              rc.leftArm.rotation.z = -0.65;
              rc.rightArm.rotation.x = -0.4;
              rc.rightArm.rotation.z = 0.65;
              rc.leftLeg.rotation.x = 0.45;
              rc.rightLeg.rotation.x = -0.2;
              rc.chest.rotation.x = 0.35;
              rc.head.rotation.x = 0.25;
            }
          } else if (elapsed < 0.70) {
            // Phase 2: Apoyo de pie estabilizador (catch step) y recomposición (470ms - 945ms)
            const phase = (elapsed - 0.35) / 0.35;
            runner.position.y = 0.2 + Math.sin(phase * Math.PI) * 0.06;
            runner.rotation.x = THREE.MathUtils.lerp(0.38, 0.08, phase);
            runner.rotation.z = THREE.MathUtils.lerp(-0.18, 0.04, phase);

            if (rc) {
              rc.leftArm.rotation.x = THREE.MathUtils.lerp(-0.4, -0.8, phase);
              rc.leftArm.rotation.z = THREE.MathUtils.lerp(-0.65, -0.15, phase);
              rc.rightArm.rotation.x = THREE.MathUtils.lerp(-0.4, 0.5, phase);
              rc.rightArm.rotation.z = THREE.MathUtils.lerp(0.65, 0.15, phase);
              rc.leftLeg.rotation.x = THREE.MathUtils.lerp(0.45, -0.3, phase);
              rc.rightLeg.rotation.x = THREE.MathUtils.lerp(-0.2, 0.4, phase);
              rc.chest.rotation.x = THREE.MathUtils.lerp(0.35, 0.2, phase);
              rc.head.rotation.x = THREE.MathUtils.lerp(0.25, -0.05, phase);
            }
          } else if (elapsed < 1.0) {
            // Phase 3: Transición suave de vuelta al trote continuo (945ms - 1350ms)
            const phase = (elapsed - 0.70) / 0.30;
            runner.position.y = 0.2;
            runner.position.z = startZ;
            runner.rotation.x = THREE.MathUtils.lerp(0.08, 0, phase);
            runner.rotation.z = THREE.MathUtils.lerp(0.04, 0, phase);

            if (rc) {
              rc.leftArm.rotation.z = THREE.MathUtils.lerp(-0.15, 0, phase);
              rc.rightArm.rotation.z = THREE.MathUtils.lerp(0.15, 0, phase);
              rc.chest.rotation.x = THREE.MathUtils.lerp(0.2, 0.22, phase);
              rc.head.rotation.x = THREE.MathUtils.lerp(-0.05, 0, phase);
            }
          } else {
            // Recuperado totalmente: reanuda la carrera en su posición
            runner.position.y = 0.2;
            runner.position.z = startZ;
            runner.rotation.x = 0;
            runner.rotation.z = 0;
            runnerStumbleActiveRef.current = false;
            if (rc) {
              rc.leftArm.rotation.z = 0;
              rc.rightArm.rotation.z = 0;
              rc.head.rotation.x = 0;
            }
          }

          if (elapsed < 1.0) {
            requestAnimationFrame(tripAnim);
          } else {
            runnerStumbleActiveRef.current = false;
          }
        };
        requestAnimationFrame(tripAnim);
      }
    } else if (gameMode === 'battle') {
      if (isCorrect && heroFighterRef.current && enemyFighterRef.current) {
        // Hero athletic direct dash-slash contact attack (Slowed down to 1400ms for cinematic appreciation)
        const hero = heroFighterRef.current;
        const enemy = enemyFighterRef.current;
        const originalHeroX = -2.2;
        const originalHeroY = 0.6;
        const enemyOriginalX = 2.2;
        const clashX = 1.3;
        const slashArc = battleSlashArcRef.current;
        const startTime = performance.now();

        // Dramatic camera push-in towards the arena center to frame the strike
        targetCamPos.current.set(0.4, 3.8, 6.8);
        targetCamLookAt.current.set(0.4, 1.4, 0);

        const attackAnim = (time: number) => {
          // Duration: 1400ms total (slow, readable, realistic martial cadence)
          const elapsed = (time - startTime) / 1400;

          if (elapsed < 0.22) {
            // Phase 1: WIND-UP & PREPARATION (0ms - 308ms)
            // Hero steps back slightly, raises sword over right shoulder, shield braces forward
            const phase = elapsed / 0.22;
            hero.position.x = THREE.MathUtils.lerp(originalHeroX, originalHeroX - 0.25, phase);
            hero.position.y = originalHeroY;
            hero.rotation.z = phase * 0.15; // Bracing lean back
            if (heroCharRef.current) {
              const hc = heroCharRef.current;
              hc.rightArm.rotation.x = THREE.MathUtils.lerp(-0.42, -Math.PI / 1.35, phase);
              hc.rightArm.rotation.z = THREE.MathUtils.lerp(0.15, 0.45, phase);
              hc.rightElbow.rotation.x = THREE.MathUtils.lerp(0.65, 0.2, phase);
              hc.sword.rotation.x = THREE.MathUtils.lerp(Math.PI / 3, -Math.PI / 5, phase);
              hc.sword.rotation.z = phase * 0.3;
              hc.leftArm.rotation.x = THREE.MathUtils.lerp(0.26, 0.6, phase);
              hc.shield.rotation.y = -0.5;
              if (hc.bladeGlow.material && 'emissiveIntensity' in hc.bladeGlow.material) {
                (hc.bladeGlow.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.0 + phase * 1.5;
              }
            }
          } else if (elapsed < 0.46) {
            // Phase 2: DYNAMIC CHARGE / LEAP INTO MELEE RANGE (308ms - 644ms)
            const phase = (elapsed - 0.22) / 0.24;
            // Explosive leap forward with arc trajectory
            hero.position.x = THREE.MathUtils.lerp(originalHeroX - 0.25, clashX, phase);
            hero.position.y = originalHeroY + Math.sin(phase * Math.PI) * 0.65;
            hero.rotation.z = -Math.sin(phase * Math.PI) * 0.35; // Aerodynamic tilt forward
            if (heroCharRef.current) {
              const hc = heroCharRef.current;
              // Sword poised high ready to slice downwards
              hc.rightArm.rotation.x = -Math.PI / 1.4;
              hc.sword.rotation.x = -Math.PI / 4;
              hc.leftLeg.rotation.x = Math.sin(phase * Math.PI) * 0.8;
              hc.rightLeg.rotation.x = -Math.sin(phase * Math.PI) * 0.6;
            }
          } else if (elapsed < 0.68) {
            // Phase 3: SWORD SLASH IMPACT & ENEMY HIT STAGGER (644ms - 952ms)
            const phase = (elapsed - 0.46) / 0.22;
            hero.position.x = clashX;
            hero.position.y = originalHeroY;
            hero.rotation.z = -0.15; // Deep crouch strike landing

            // Show crescent energy slash arc
            if (slashArc) {
              slashArc.visible = true;
              slashArc.position.set(clashX + 0.35, 1.35, 0.1);
              slashArc.rotation.z = phase * Math.PI * 0.8;
              (slashArc.material as THREE.MeshBasicMaterial).opacity = Math.sin(phase * Math.PI) * 0.95;
            }

            // Golem reels back in pain from the heavy strike
            const staggerFactor = Math.sin(phase * Math.PI);
            enemy.position.x = THREE.MathUtils.lerp(enemyOriginalX, enemyOriginalX + 0.85, phase);
            enemy.rotation.z = Math.sin(phase * Math.PI * 3) * 0.3; // Stagger shudder
            enemy.position.y = 0.6 + staggerFactor * 0.2;

            if (heroCharRef.current) {
              const hc = heroCharRef.current;
              // Clean diagonal follow-through slash
              hc.rightArm.rotation.x = THREE.MathUtils.lerp(-Math.PI / 1.4, 0.45, phase);
              hc.rightArm.rotation.z = -0.2;
              hc.sword.rotation.x = 0.3;
              hc.sword.rotation.z = Math.PI / 2.2;
            }

            // Burst 3D sparks on contact impact
            if (battleSparksDataRef.current.length > 0 && phase < 0.3) {
              const impactX = clashX + 0.3;
              battleSparksDataRef.current.forEach((sp) => {
                sp.mesh.position.set(impactX, 1.35, (Math.random() - 0.5) * 0.3);
                const angle = Math.random() * Math.PI * 2;
                const spd = 0.08 + Math.random() * 0.14;
                sp.vx = Math.cos(angle) * spd;
                sp.vy = Math.sin(angle) * spd + 0.06;
                sp.vz = (Math.random() - 0.5) * spd;
                sp.life = 1.0;
                sp.mesh.visible = true;
              });
            }
          } else if (elapsed < 1.0) {
            // Phase 4: ACROBATIC RETREAT & RECOVERY TO COMBAT STANCE (952ms - 1400ms)
            const phase = (elapsed - 0.68) / 0.32;
            if (slashArc) {
              slashArc.visible = false;
              (slashArc.material as THREE.MeshBasicMaterial).opacity = 0;
            }

            // Hero backflips / springs backward to starting position
            hero.position.x = THREE.MathUtils.lerp(clashX, originalHeroX, phase);
            hero.position.y = originalHeroY + Math.sin(phase * Math.PI) * 0.4;
            hero.rotation.z = Math.sin((1 - phase) * Math.PI) * 0.2;

            // Enemy recovers and regains footing
            enemy.position.x = THREE.MathUtils.lerp(enemyOriginalX + 0.85, enemyOriginalX, phase);
            enemy.position.y = 0.6;
            enemy.rotation.z = 0;

            if (heroCharRef.current) {
              const hc = heroCharRef.current;
              hc.rightArm.rotation.x = THREE.MathUtils.lerp(0.45, -0.42, phase);
              hc.rightArm.rotation.z = THREE.MathUtils.lerp(-0.2, 0.15, phase);
              hc.sword.rotation.x = THREE.MathUtils.lerp(0.3, Math.PI / 3, phase);
              hc.sword.rotation.z = THREE.MathUtils.lerp(Math.PI / 2.2, 0, phase);
              hc.leftLeg.rotation.x = 0;
              hc.rightLeg.rotation.x = 0;
            }

            // Camera smoothly pulls back out
            targetCamPos.current.set(0, 5, 9);
            targetCamLookAt.current.set(0, 1.2, 0);
          } else {
            // FINISHED
            hero.position.x = originalHeroX;
            hero.position.y = originalHeroY;
            hero.rotation.z = 0;
            enemy.position.x = enemyOriginalX;
            enemy.position.y = 0.6;
            enemy.rotation.z = 0;
            if (slashArc) slashArc.visible = false;
            if (heroCharRef.current) {
              const hc = heroCharRef.current;
              hc.rightArm.rotation.x = -0.42;
              hc.rightArm.rotation.z = 0.15;
              hc.sword.rotation.x = Math.PI / 3;
              hc.sword.rotation.z = 0;
            }
            targetCamPos.current.set(0, 5, 9);
            targetCamLookAt.current.set(0, 1.2, 0);
          }
          if (elapsed < 1.0) requestAnimationFrame(attackAnim);
        };
        requestAnimationFrame(attackAnim);
      } else if (!isCorrect && heroFighterRef.current && enemyFighterRef.current) {
        // Enemy boulder slam direct smash counter-attack (Slowed down to 1450ms for realistic titan weight)
        const hero = heroFighterRef.current;
        const enemy = enemyFighterRef.current;
        const originalEnemyX = 2.2;
        const originalHeroX = -2.2;
        const slamX = -1.1;
        const shockwave = battleShockwaveRef.current;
        const startTime = performance.now();

        // Dramatic camera frame focused on the titan counter-attack
        targetCamPos.current.set(-0.4, 3.8, 6.8);
        targetCamLookAt.current.set(-0.4, 1.4, 0);

        const enemyAnim = (time: number) => {
          // Duration: 1450ms total (heavy, ominous, readable golem strike)
          const elapsed = (time - startTime) / 1450;

          if (elapsed < 0.28) {
            // Phase 1: HEAVY WIND-UP (0ms - 406ms)
            // Golem rears back, chest heaves, both colossal fists raised high overhead
            const phase = elapsed / 0.28;
            enemy.position.x = THREE.MathUtils.lerp(originalEnemyX, originalEnemyX + 0.3, phase);
            enemy.position.y = 0.6 + phase * 0.2;
            if (enemyCharRef.current) {
              const ec = enemyCharRef.current;
              ec.leftArm.rotation.x = THREE.MathUtils.lerp(0, -Math.PI / 1.25, phase);
              ec.rightArm.rotation.x = THREE.MathUtils.lerp(0, -Math.PI / 1.25, phase);
              ec.head.rotation.x = -phase * 0.3;
              // Veins flare super hot
              ec.magmaVeins.forEach((mesh) => {
                if (mesh.material && 'emissiveIntensity' in mesh.material) {
                  (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.0 + phase * 1.5;
                }
              });
            }
          } else if (elapsed < 0.48) {
            // Phase 2: COLOSSAL CHARGE STEP (406ms - 696ms)
            // Golem thunders across the arena into melee range
            const phase = (elapsed - 0.28) / 0.20;
            enemy.position.x = THREE.MathUtils.lerp(originalEnemyX + 0.3, slamX + 0.85, phase);
            enemy.position.y = 0.6 + Math.sin(phase * Math.PI) * 0.4;
            if (enemyCharRef.current) {
              const ec = enemyCharRef.current;
              ec.leftArm.rotation.x = -Math.PI / 1.25;
              ec.rightArm.rotation.x = -Math.PI / 1.25;
            }
          } else if (elapsed < 0.72) {
            // Phase 3: EARTH-SHATTERING DUAL FIST SMASH (696ms - 1044ms)
            const phase = (elapsed - 0.48) / 0.24;
            enemy.position.x = slamX + 0.85;
            enemy.position.y = 0.6 - Math.sin(phase * Math.PI) * 0.15; // Slam downwards

            // Fists crash straight down
            if (enemyCharRef.current) {
              const ec = enemyCharRef.current;
              ec.leftArm.rotation.x = THREE.MathUtils.lerp(-Math.PI / 1.25, 0.7, phase);
              ec.rightArm.rotation.x = THREE.MathUtils.lerp(-Math.PI / 1.25, 0.7, phase);
              ec.head.rotation.x = phase * 0.25;
            }

            // Expanding Magma Shockwave Ring on ground
            if (shockwave) {
              shockwave.visible = true;
              shockwave.position.set(slamX + 0.2, 0.65, 0);
              const scale = THREE.MathUtils.lerp(0.4, 2.4, phase);
              shockwave.scale.set(scale, scale, 1);
              (shockwave.material as THREE.MeshBasicMaterial).opacity = Math.sin(phase * Math.PI) * 0.9;
            }

            // Hero gets blown back into defensive guard, knocked backward
            const heroStagger = (elapsed - 0.52) / 0.20;
            if (heroStagger > 0) {
              hero.position.x = THREE.MathUtils.lerp(originalHeroX, originalHeroX - 0.95, Math.min(1.0, heroStagger));
              hero.position.y = 0.6 + Math.sin(Math.min(1.0, heroStagger) * Math.PI) * 0.2;
              hero.rotation.z = -Math.sin(Math.min(1.0, heroStagger) * Math.PI * 3) * 0.4;
            }
            if (heroCharRef.current) {
              const hc = heroCharRef.current;
              hc.leftArm.rotation.x = 0.2;
              hc.shield.rotation.y = -0.1;
            }

            // Fire sparks erupt from the impact point
            if (battleSparksDataRef.current.length > 0 && phase < 0.28) {
              const impactX = slamX + 0.3;
              battleSparksDataRef.current.forEach((sp) => {
                sp.mesh.position.set(impactX, 0.8, (Math.random() - 0.5) * 0.4);
                const angle = Math.random() * Math.PI * 2;
                const spd = 0.10 + Math.random() * 0.16;
                sp.vx = Math.cos(angle) * spd;
                sp.vy = Math.abs(Math.sin(angle) * spd) + 0.08;
                sp.vz = (Math.random() - 0.5) * spd;
                sp.life = 1.0;
                sp.mesh.visible = true;
              });
            }
          } else if (elapsed < 1.0) {
            // Phase 4: TITAN LUMBERS BACK & HERO RECOVERS (1044ms - 1450ms)
            const phase = (elapsed - 0.72) / 0.28;
            if (shockwave) {
              shockwave.visible = false;
              (shockwave.material as THREE.MeshBasicMaterial).opacity = 0;
            }

            // Golem steps back to origin
            enemy.position.x = THREE.MathUtils.lerp(slamX + 0.85, originalEnemyX, phase);
            enemy.position.y = 0.6;
            if (enemyCharRef.current) {
              const ec = enemyCharRef.current;
              ec.leftArm.rotation.x = THREE.MathUtils.lerp(0.7, 0, phase);
              ec.rightArm.rotation.x = THREE.MathUtils.lerp(0.7, 0, phase);
              ec.head.rotation.x = 0;
            }

            // Hero regains balance back to battle stance
            hero.position.x = THREE.MathUtils.lerp(originalHeroX - 0.95, originalHeroX, phase);
            hero.position.y = 0.6;
            hero.rotation.z = 0;

            // Camera pulls back smoothly
            targetCamPos.current.set(0, 5, 9);
            targetCamLookAt.current.set(0, 1.2, 0);
          } else {
            // FINISHED
            enemy.position.x = originalEnemyX;
            enemy.position.y = 0.6;
            hero.position.x = originalHeroX;
            hero.position.y = 0.6;
            hero.rotation.z = 0;
            if (shockwave) shockwave.visible = false;
            if (enemyCharRef.current) {
              enemyCharRef.current.leftArm.rotation.x = 0;
              enemyCharRef.current.rightArm.rotation.x = 0;
              enemyCharRef.current.head.rotation.x = 0;
            }
            targetCamPos.current.set(0, 5, 9);
            targetCamLookAt.current.set(0, 1.2, 0);
          }
          if (elapsed < 1.0) requestAnimationFrame(enemyAnim);
        };
        requestAnimationFrame(enemyAnim);
      }
    } else if (gameMode === 'bridge' && bridgeWalkerRef.current) {
      const walker = bridgeWalkerRef.current;
      const totalSegs = totalQuestionsRef.current || 5;
      const startX = -2.6;
      const endX = 2.6;
      const currentX = walker.position.x;
      const targetX = startX + (bridgeBuiltSegmentsRef.current / totalSegs) * (endX - startX);
      const startTime = performance.now();

      if (isCorrect) {
        // Physical leap across to the newly placed bridge span
        const leapAnim = (time: number) => {
          const elapsed = (time - startTime) / 500;
          if (elapsed < 1 && bridgeWalkerRef.current) {
            walker.position.x = THREE.MathUtils.lerp(currentX, targetX, elapsed);
            walker.position.y = 1.12 + Math.sin(elapsed * Math.PI) * 0.45;
            requestAnimationFrame(leapAnim);
          } else if (bridgeWalkerRef.current) {
            walker.position.x = targetX;
            walker.position.y = 1.12;
          }
        };
        requestAnimationFrame(leapAnim);
      } else {
        // Stumble backward away from the open canyon gap, remaining firmly on current solid plank
        const stumbleAnim = (time: number) => {
          const elapsed = (time - startTime) / 400;
          if (elapsed < 1 && bridgeWalkerRef.current) {
            walker.position.x = currentX - Math.sin(elapsed * Math.PI) * 0.25;
            walker.rotation.z = Math.sin(elapsed * Math.PI * 4) * 0.15;
            requestAnimationFrame(stumbleAnim);
          } else if (bridgeWalkerRef.current) {
            walker.position.x = currentX;
            walker.rotation.z = 0;
            walker.position.y = 1.12;
          }
        };
        requestAnimationFrame(stumbleAnim);
      }
    } else if (gameMode === 'shop' && shopCoinsMeshRef.current && shopProductMeshRef.current) {
      const coins = shopCoinsMeshRef.current;
      const product = shopProductMeshRef.current;
      const merchantHead = shopMerchantHeadRef.current;
      const startTime = performance.now();

      const initialCoinsPos = new THREE.Vector3(0.1, 1.25, 1.2);
      const targetCoinsPos = new THREE.Vector3(0.9, 1.5, -0.3); // into Don Mateo's cashbox

      const initialProdPos = new THREE.Vector3(0, 1.45, -0.2);
      const targetProdPos = new THREE.Vector3(-0.85, 1.4, 0.35); // into player's shopping basket

      if (isCorrect) {
        // Physical purchase transaction:
        // 1. Coins fly arc into merchant's register
        // 2. Purchased item arcs into customer's shopping basket
        // 3. Merchant nods head and gives item
        const anim = (time: number) => {
          const elapsed = (time - startTime) / 600;
          if (elapsed < 0.5) {
            const p = elapsed / 0.5;
            coins.position.lerpVectors(initialCoinsPos, targetCoinsPos, p);
            coins.position.y = initialCoinsPos.y + Math.sin(p * Math.PI) * 0.85;
            coins.rotation.z = p * Math.PI * 4;
          } else if (elapsed < 1.0) {
            coins.position.copy(targetCoinsPos);
            const p = (elapsed - 0.5) / 0.5;
            product.position.lerpVectors(initialProdPos, targetProdPos, p);
            product.position.y = initialProdPos.y + Math.sin(p * Math.PI) * 0.7;
            product.scale.set(1 + Math.sin(p * Math.PI) * 0.25, 1 + Math.sin(p * Math.PI) * 0.25, 1 + Math.sin(p * Math.PI) * 0.25);
            if (merchantHead) {
              merchantHead.rotation.x = Math.sin(p * Math.PI * 2) * 0.2;
            }
          } else {
            coins.position.copy(initialCoinsPos);
            coins.rotation.z = 0;
            product.position.copy(initialProdPos);
            product.scale.set(1, 1, 1);
            if (merchantHead) merchantHead.rotation.x = 0;
          }
          if (elapsed < 1.0) requestAnimationFrame(anim);
        };
        requestAnimationFrame(anim);
      } else {
        // Incorrect: Merchant shakes head 'No', coins bounce back, product remains unpurchased
        const anim = (time: number) => {
          const elapsed = (time - startTime) / 480;
          if (elapsed < 1.0) {
            if (merchantHead) {
              merchantHead.rotation.y = Math.sin(elapsed * Math.PI * 6) * 0.35;
            }
            coins.position.z = initialCoinsPos.z - Math.sin(elapsed * Math.PI) * 0.25;
            requestAnimationFrame(anim);
          } else {
            if (merchantHead) merchantHead.rotation.y = 0;
            coins.position.copy(initialCoinsPos);
          }
        };
        requestAnimationFrame(anim);
      }
    } else if (gameMode === 'detective' && castleLockBarsRef.current.length > 0) {
      const activeIdx = Math.min(questionIndexRef.current, 4);
      const activeBar = castleLockBarsRef.current[activeIdx];
      const beam = castleBeamMeshRef.current;
      const doorLeft = castleDoorLeftRef.current;
      const doorRight = castleDoorRightRef.current;
      const startTime = performance.now();

      if (isCorrect && activeBar) {
        // 1. Golden beam shoots from detective's cipher wand to active lock bar
        // 2. Lock bar mechanically slides into the right stone wall recess (x = 2.4)
        // 3. Castle vault doors creak open wider, revealing treasure chest chamber
        const startX = activeBar.position.x;
        const targetX = 2.4;

        const anim = (time: number) => {
          const elapsed = (time - startTime) / 650;
          if (beam) {
            (beam.material as THREE.MeshBasicMaterial).opacity = Math.sin(Math.min(elapsed, 1.0) * Math.PI) * 0.95;
          }

          if (elapsed < 1.0) {
            activeBar.position.x = THREE.MathUtils.lerp(startX, targetX, elapsed);
            if (activeBar.material instanceof THREE.MeshStandardMaterial) {
              activeBar.material.color.setHex(0xfbbf24);
              activeBar.material.emissive.setHex(0xd97706);
            }
            const openFactor = Math.min((questionIndexRef.current + 1) / 5, 1.0);
            const maxAngle = questionIndexRef.current >= 4 ? 1.25 : openFactor * 0.65;
            if (doorLeft) doorLeft.rotation.y = -THREE.MathUtils.lerp(0, maxAngle, elapsed);
            if (doorRight) doorRight.rotation.y = THREE.MathUtils.lerp(0, maxAngle, elapsed);

            requestAnimationFrame(anim);
          } else {
            activeBar.position.x = targetX;
            if (activeBar.material instanceof THREE.MeshStandardMaterial) {
              activeBar.material.color.setHex(0x10b981);
              activeBar.material.emissive.setHex(0x065f46);
            }
            if (beam) {
              (beam.material as THREE.MeshBasicMaterial).opacity = 0;
            }
          }
        };
        requestAnimationFrame(anim);
      } else if (!isCorrect && activeBar) {
        // Bolt rattles stubbornly against the oak gate with warning red vibration
        const originalX = activeBar.position.x;
        const anim = (time: number) => {
          const elapsed = (time - startTime) / 450;
          if (elapsed < 1.0) {
            activeBar.position.x = originalX + Math.sin(elapsed * Math.PI * 8) * 0.12;
            if (activeBar.material instanceof THREE.MeshStandardMaterial) {
              activeBar.material.color.setHex(0xef4444);
              activeBar.material.emissive.setHex(0x991b1b);
            }
            requestAnimationFrame(anim);
          } else {
            activeBar.position.x = originalX;
            if (activeBar.material instanceof THREE.MeshStandardMaterial) {
              activeBar.material.color.setHex(0xf59e0b);
              activeBar.material.emissive.setHex(0x78350f);
            }
          }
        };
        requestAnimationFrame(anim);
      }
    }
    // heroHp/enemyHp/cluesFound/shopCartTotal no se usan en este efecto (eran
    // dependencias espurias). raceProgress/bridgeBuiltSegments/questionIndex/
    // totalQuestions sí se usan pero se leen por ref (arriba) para que SOLO
    // una respuesta real (isCorrect null -> valor) dispare una animación:
    // antes, cualquiera de esos 8 valores cambiando volvía a ejecutar este
    // efecto con isCorrect todavía en true/false, lanzando un SEGUNDO loop de
    // requestAnimationFrame por encima del anterior (sin cancelarlo) sobre el
    // mismo personaje -- el bug visual de Batalla reportado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCorrect, gameMode]);

  // Handle Win/Loss Animations in 3D
  useEffect(() => {
    if (!gameWon && !gameOver) {
      // Nivel nuevo (o reiniciado): el canvas 3D no se vuelve a montar entre
      // niveles -- solo cambian las props -- así que sin este reset, el
      // confeti y las animaciones de victoria/derrota de la ronda anterior se
      // quedaban pegadas en el siguiente nivel (puente ya "construido",
      // puertas ya abiertas, confeti cayendo desde el segundo 0).
      const finishMeshes: (THREE.Object3D | null)[] = [
        finishRibbonRef.current,
        finishConfettiGroupRef.current,
        enemyFighterRef.current,
        golemCrumbleGroupRef.current,
        heroVictoryAuraRef.current,
        shopCheerCoinsRef.current,
        shopCelebrationBagRef.current,
        bridgeVictoryFlagRef.current,
        castleSparklesRef.current,
        castleGateGlowRef.current,
        castleDoorLeftRef.current,
        castleDoorRightRef.current,
        castleDetectiveRef.current,
        runnerSweatRef.current,
        runnerGroupRef.current,
        heroDizzyStarsRef.current,
        heroFighterRef.current,
        shopClosedSignRef.current,
        bridgeBrokenPlankRef.current,
        castleQuestionMarksRef.current,
        castlePortcullisRef.current,
        ...castleLockBarsRef.current,
      ];

      if (!finishMeshSnapshotsRef.current) {
        // Primera vez que corre este efecto -- es el montaje inicial, antes
        // de cualquier victoria/derrota, así que todo está todavía en su
        // posición de creación. Se guarda tal cual, una sola vez, para poder
        // volver exactamente ahí después de cada nivel sin tener que conocer
        // (ni mantener actualizados) los valores numéricos de cada mesh.
        const snapshots = new Map<THREE.Object3D, FinishMeshSnapshot>();
        finishMeshes.forEach((obj) => {
          if (obj) snapshots.set(obj, snapshotFinishMesh(obj));
        });
        finishMeshSnapshotsRef.current = snapshots;
        return;
      }

      finishMeshes.forEach((obj) => {
        if (!obj) return;
        const snap = finishMeshSnapshotsRef.current!.get(obj);
        if (snap) restoreFinishMesh(obj, snap);
      });
      return;
    }

    const startTime = performance.now();

    if (gameWon) {
      if (gameMode === 'race' && runnerGroupRef.current) {
        // Runner sprints across the finish line (z = -10.5), ribbon breaks, confetti bursts
        const runner = runnerGroupRef.current;
        const startZ = runner.position.z;
        const targetZ = -10.8;
        if (finishRibbonRef.current) finishRibbonRef.current.visible = false;
        if (finishConfettiGroupRef.current) finishConfettiGroupRef.current.visible = true;

        targetCamPos.current.set(0, 2.8, -7.0);
        targetCamLookAt.current.set(0, 1.4, -10.8);

        const anim = (time: number) => {
          const elapsed = (time - startTime) / 900;
          if (elapsed < 1.0 && runnerGroupRef.current) {
            runner.position.z = THREE.MathUtils.lerp(startZ, targetZ, elapsed);
            runner.position.y = 0.2 + Math.abs(Math.sin(elapsed * Math.PI * 4)) * 0.45;
            requestAnimationFrame(anim);
          } else if (runnerGroupRef.current) {
            runner.position.z = targetZ;
            runner.position.y = 0.4;
          }
        };
        requestAnimationFrame(anim);
      } else if (gameMode === 'battle') {
        // Hero delivers ultimate victory leap; Golem crumbles into shattered rock boulders; Aura shines
        const hero = heroFighterRef.current;
        const enemy = enemyFighterRef.current;
        if (enemy) enemy.visible = false;
        if (golemCrumbleGroupRef.current) golemCrumbleGroupRef.current.visible = true;
        if (finishConfettiGroupRef.current) finishConfettiGroupRef.current.visible = true;
        if (heroVictoryAuraRef.current) {
          (heroVictoryAuraRef.current.material as THREE.MeshBasicMaterial).opacity = 0.45;
        }

        targetCamPos.current.set(-1.0, 3.2, 4.2);
        targetCamLookAt.current.set(-1.0, 1.2, 0);

        if (hero) {
          const anim = (time: number) => {
            const elapsed = (time - startTime) / 800;
            if (elapsed < 1.0 && heroFighterRef.current) {
              hero.position.y = 0.6 + Math.sin(elapsed * Math.PI) * 0.8;
              hero.rotation.y = Math.PI / 2 + elapsed * Math.PI * 2;
              requestAnimationFrame(anim);
            } else if (heroFighterRef.current) {
              hero.position.y = 0.7;
              hero.rotation.y = Math.PI / 2;
            }
          };
          requestAnimationFrame(anim);
        }
      } else if (gameMode === 'shop') {
        // Don Mateo cheers / coins dance in fountain, customer holds celebration bag
        if (shopCheerCoinsRef.current) shopCheerCoinsRef.current.visible = true;
        if (shopCelebrationBagRef.current) shopCelebrationBagRef.current.visible = true;
        if (finishConfettiGroupRef.current) finishConfettiGroupRef.current.visible = true;
        targetCamPos.current.set(0, 3.8, 5.8);
        targetCamLookAt.current.set(0, 1.5, 0);

        const merchant = shopMerchantRef.current;
        if (merchant) {
          const anim = (time: number) => {
            const elapsed = (time - startTime) / 1000;
            if (elapsed < 1.0 && shopMerchantRef.current) {
              merchant.position.y = 0.3 + Math.abs(Math.sin(elapsed * Math.PI * 5)) * 0.3;
              requestAnimationFrame(anim);
            }
          };
          requestAnimationFrame(anim);
        }
      } else if (gameMode === 'bridge') {
        // Explorer reaches destination cliff (x = 3.8), plants red victory flag
        const walker = bridgeWalkerRef.current;
        if (bridgeVictoryFlagRef.current) bridgeVictoryFlagRef.current.visible = true;
        if (finishConfettiGroupRef.current) finishConfettiGroupRef.current.visible = true;
        targetCamPos.current.set(3.0, 4.5, 6.0);
        targetCamLookAt.current.set(3.8, 1.8, 0);

        if (walker) {
          const startX = walker.position.x;
          const targetX = 3.8;
          const anim = (time: number) => {
            const elapsed = (time - startTime) / 900;
            if (elapsed < 1.0 && bridgeWalkerRef.current) {
              walker.position.x = THREE.MathUtils.lerp(startX, targetX, elapsed);
              walker.position.y = 1.2 + Math.abs(Math.sin(elapsed * Math.PI * 4)) * 0.35;
              requestAnimationFrame(anim);
            } else if (bridgeWalkerRef.current) {
              walker.position.x = targetX;
              walker.position.y = 1.3;
            }
          };
          requestAnimationFrame(anim);
        }
      } else if (gameMode === 'detective') {
        // VICTORIA DEL CASTILLO: las barras del candado se deslizan y
        // desaparecen, las puertas se abren de par en par, sale el haz de
        // luz dorado de la bóveda y el detective salta triunfante hacia la
        // entrada con su lupa en alto.
        const doorLeft = castleDoorLeftRef.current;
        const doorRight = castleDoorRightRef.current;
        const det = castleDetectiveRef.current;

        // Deslizar y ocultar todas las barras del candado
        castleLockBarsRef.current.forEach((bolt) => {
          bolt.position.x = 4.0;
          bolt.visible = false;
        });

        if (castleSparklesRef.current) castleSparklesRef.current.visible = true;
        if (castleGateGlowRef.current) castleGateGlowRef.current.visible = true;
        if (finishConfettiGroupRef.current) finishConfettiGroupRef.current.visible = true;

        targetCamPos.current.set(0, 2.9, 4.6);
        targetCamLookAt.current.set(0, 1.6, -1.2);

        const startX = det ? det.position.x : -1.8;
        const startZ = det ? det.position.z : 2.2;
        const targetX = 0;
        const targetZ = 0.2;

        const anim = (time: number) => {
          const elapsed = (time - startTime) / 1400;
          if (elapsed < 1.0) {
            // Puertas de roble macizo abriéndose con easing cinematográfico
            const doorOpenEase = THREE.MathUtils.smoothstep(elapsed, 0, 0.85);
            if (doorLeft) doorLeft.rotation.y = -THREE.MathUtils.lerp(0, 1.65, doorOpenEase);
            if (doorRight) doorRight.rotation.y = THREE.MathUtils.lerp(0, 1.65, doorOpenEase);

            // Salto triunfal del detective hacia la entrada dorada
            if (det) {
              const jumpProgress = Math.min(1.0, elapsed * 1.15);
              det.position.x = THREE.MathUtils.lerp(startX, targetX, jumpProgress);
              det.position.z = THREE.MathUtils.lerp(startZ, targetZ, jumpProgress);
              det.position.y = 0.3 + Math.sin(jumpProgress * Math.PI) * 1.7;
              det.rotation.y = THREE.MathUtils.lerp(Math.PI / 4, 0, jumpProgress) + Math.sin(jumpProgress * Math.PI * 2) * 0.35;
            }
            requestAnimationFrame(anim);
          } else {
            if (doorLeft) doorLeft.rotation.y = -1.65;
            if (doorRight) doorRight.rotation.y = 1.65;
            if (det) {
              det.position.x = targetX;
              det.position.z = targetZ;
              det.position.y = 0.35;
              det.rotation.y = 0;
            }
          }
        };
        requestAnimationFrame(anim);
      }
    } else if (gameOver) {
      if (gameMode === 'race' && runnerGroupRef.current) {
        // Runner stumbles and drops down exhausted with sweat drops
        const runner = runnerGroupRef.current;
        if (runnerSweatRef.current) runnerSweatRef.current.visible = true;
        const anim = (time: number) => {
          const elapsed = (time - startTime) / 600;
          if (elapsed < 1.0 && runnerGroupRef.current) {
            runner.rotation.x = -elapsed * 0.6;
            runner.position.y = 0.2 - elapsed * 0.1;
            requestAnimationFrame(anim);
          }
        };
        requestAnimationFrame(anim);
      } else if (gameMode === 'battle') {
        // Hero knocked backward, collapses to knee, dizzy stars orbit
        const hero = heroFighterRef.current;
        if (heroDizzyStarsRef.current) heroDizzyStarsRef.current.visible = true;
        if (hero) {
          const anim = (time: number) => {
            const elapsed = (time - startTime) / 700;
            if (elapsed < 1.0 && heroFighterRef.current) {
              hero.rotation.z = -elapsed * 0.5;
              hero.position.y = 0.6 - elapsed * 0.2;
              requestAnimationFrame(anim);
            }
          };
          requestAnimationFrame(anim);
        }
      } else if (gameMode === 'shop') {
        // Closed sign drops on counter
        if (shopClosedSignRef.current) shopClosedSignRef.current.visible = true;
      } else if (gameMode === 'bridge') {
        // Broken plank tumbles down into the abyss
        const plank = bridgeBrokenPlankRef.current;
        if (plank) {
          plank.visible = true;
          const anim = (time: number) => {
            const elapsed = (time - startTime) / 900;
            if (elapsed < 1.0) {
              plank.position.y = 0.8 - elapsed * 4.0;
              plank.rotation.x = elapsed * Math.PI * 4;
              plank.rotation.z = elapsed * Math.PI * 2;
              requestAnimationFrame(anim);
            } else {
              plank.visible = false;
            }
          };
          requestAnimationFrame(anim);
        }
      } else if (gameMode === 'detective') {
        // Heavy iron portcullis drops down, question marks over detective
        const portcullis = castlePortcullisRef.current;
        if (castleQuestionMarksRef.current) castleQuestionMarksRef.current.visible = true;
        if (portcullis) {
          portcullis.visible = true;
          const anim = (time: number) => {
            const elapsed = (time - startTime) / 500;
            if (elapsed < 1.0) {
              portcullis.position.y = THREE.MathUtils.lerp(5.8, 2.2, elapsed);
              requestAnimationFrame(anim);
            } else {
              portcullis.position.y = 2.2;
            }
          };
          requestAnimationFrame(anim);
        }
      }
    }
  }, [gameWon, gameOver, gameMode]);

  // Main Render & Animation Loop
  useEffect(() => {
    let clock = new THREE.Clock();

    const renderFrame = () => {
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Smooth camera motion
      if (cameraRef.current) {
        if (viewMode === 'map') {
          if (universeFinaleActiveRef.current) {
            // Gran Final: barrido, acercamiento a la Gran Estrella y órbita libre.
            const finaleElapsed = (performance.now() - universeFinaleStartTimeRef.current) / 1000;
            const cam = universeFinaleCamera(finaleElapsed, mapRotationAngle.current + time * 0.035);
            targetCamPos.current.set(...cam.pos);
            targetCamLookAt.current.set(...cam.look);
          } else if (unlockingRegionIdRef.current) {
            // Zoom cinematográfico "Mario Galaxy": acercamiento suave a la
            // isla de la región recién desbloqueada, en vez de la órbita.
            const targetDef = REGIONS.find((r) => r.id === unlockingRegionIdRef.current);
            if (targetDef) {
              const [rx, ry, rz] = targetDef.islandPosition;
              targetCamPos.current.set(rx + 3.8, ry + 3.2, rz + 5.2);
              targetCamLookAt.current.set(rx, ry + 0.8, rz);
            }
          } else {
            // Orbiting camera around center based on mapRotationAngle with spacious panoramic orbit
            const orbitRadius = 24;
            const currentAngle = mapRotationAngle.current + time * 0.035;
            const cx = Math.sin(currentAngle) * orbitRadius;
            const cz = Math.cos(currentAngle) * orbitRadius;
            targetCamPos.current.set(cx, 16, cz);
            // La órbita normal solo fijaba la POSICIÓN: tras el zoom a una isla desbloqueada (o
            // tras el Gran Final) la mirada se quedaba apuntando a ese punto. Se restaura la
            // mirada por defecto del mapa (la misma que se fija al construir la escena).
            targetCamLookAt.current.set(0, 1.0, 0);
          }
        }

        const cinematic = universeFinaleActiveRef.current || unlockingRegionIdRef.current;
        const camLerp = cinematic ? 0.045 : 0.06;
        const lookLerp = cinematic ? 0.06 : 0.08;
        cameraRef.current.position.lerp(targetCamPos.current, camLerp);
        currentCamLookAt.current.lerp(targetCamLookAt.current, lookLerp);
        cameraRef.current.lookAt(currentCamLookAt.current);
      }

      // Animación cinemática del FX de región desbloqueada
      if (galaxyUnlockFXRef.current) {
        const fx = galaxyUnlockFXRef.current;
        const elapsed = (performance.now() - galaxyUnlockStartTimeRef.current) / 1000;

        // Rotación y pulso del haz de luz
        fx.beamMesh.rotation.y = time * 0.8;
        if (fx.beamMesh.material && 'opacity' in fx.beamMesh.material) {
          (fx.beamMesh.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(time * 5) * 0.2;
        }

        // Anillo de choque expandiéndose
        const ringProgress = (elapsed * 1.2) % 1;
        const ringScale = 1 + ringProgress * 2.2;
        fx.ringMesh.scale.set(ringScale, ringScale, ringScale);
        if (fx.ringMesh.material && 'opacity' in fx.ringMesh.material) {
          (fx.ringMesh.material as THREE.MeshBasicMaterial).opacity = (1 - ringProgress) * 0.8;
        }

        // Candado retumbando y luego explotando en fragmentos
        if (elapsed < 1.1) {
          fx.lockGroup.visible = true;
          fx.fragmentsGroup.visible = false;
          fx.lockGroup.position.x = (Math.random() - 0.5) * 0.08;
          fx.lockGroup.position.z = (Math.random() - 0.5) * 0.08;
          fx.lockGroup.position.y = 2.5 + Math.sin(time * 12) * 0.05;
          fx.lockGroup.rotation.y = Math.sin(time * 15) * 0.12;
        } else {
          if (fx.lockGroup.visible) {
            fx.lockGroup.visible = false;
            fx.fragmentsGroup.visible = true;
          }
          const fragTime = elapsed - 1.1;
          fx.fragments.forEach((f) => {
            f.mesh.position.x = f.vx * fragTime * 0.6;
            f.mesh.position.y = f.vy * fragTime * 0.6 - 0.5 * 9.8 * (fragTime * 0.6) ** 2;
            f.mesh.position.z = f.vz * fragTime * 0.6;
            f.mesh.rotation.x += f.rotSpd * 0.02;
            f.mesh.rotation.y += f.rotSpd * 0.03;
          });
        }

        // Estrellas orbitando la isla
        fx.starMeshes.forEach((star, sIdx) => {
          const starAngle = time * 1.8 + (sIdx * Math.PI * 2) / 5;
          const r = 2.8;
          star.position.x = Math.cos(starAngle) * r;
          star.position.z = Math.sin(starAngle) * r;
          star.position.y = Math.sin(time * 3 + sIdx) * 0.3;
          star.rotation.x += 0.03;
          star.rotation.y += 0.05;
        });

        // Flecha flotante indicando dónde tocar
        fx.pointerGroup.position.y = 3.6 + Math.sin(time * 4) * 0.25;
        fx.pointerGroup.rotation.y = time * 2;
      }

      // Animación del Gran Final "universo completado"
      if (universeFinaleFXRef.current) {
        const finaleElapsed = (performance.now() - universeFinaleStartTimeRef.current) / 1000;
        updateUniverseFinaleFX(universeFinaleFXRef.current, time, delta, finaleElapsed);
      }

      // Gentle cloud and sky dome drifting
      if (cloudsGroupRef.current) {
        cloudsGroupRef.current.rotation.y = time * 0.015;
      }
      if (skyDomeRef.current) {
        skyDomeRef.current.rotation.y = time * 0.002;
      }

      // Shimmering water surface ripple
      if (waterMeshRef.current) {
        waterMeshRef.current.position.y = -2.5 + Math.sin(time * 1.6) * 0.05;
      }

      // Ambient motes floating drifting
      if (floatingMotesRef.current) {
        floatingMotesRef.current.rotation.y = time * 0.02;
        const positions = floatingMotesRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 1; i < positions.length; i += 3) {
          positions[i] += Math.sin(time * 1.5 + i) * 0.003;
        }
        floatingMotesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // Magma fissures subtle pulsing glow
      if (magmaFissuresRef.current.length > 0) {
        const pulse = 0.7 + Math.sin(time * 3.5) * 0.3;
        magmaFissuresRef.current.forEach((mesh) => {
          if (mesh.material && 'emissiveIntensity' in mesh.material) {
            (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
          }
        });
      }

      // World Map Island Hovering Bobbing & Mystical Core Kinetics
      if (viewMode === 'map') {
        mapIslandsRef.current.forEach((item, idx) => {
          item.group.position.y = REGIONS[idx]?.islandPosition[1] + Math.sin(time * 1.8 + idx * 1.2) * 0.15;
          item.group.rotation.y = Math.sin(time * 0.4 + idx) * 0.05;
        });

        // Dynamic core crystal spin & orbiting satellite asteroids with spacious celestial paths
        if (mapIslandCoresRef.current.length > 0) {
          mapIslandCoresRef.current.forEach((coreObj, idx) => {
            if (coreObj.core) {
              coreObj.core.rotation.y = time * 1.2 + idx;
            }
            if (coreObj.ring) {
              coreObj.ring.rotation.z = -time * 0.8 + idx;
            }
            if (coreObj.satellites) {
              const orbitalRadii = [4.8, 5.6, 6.4];
              const speeds = [0.75, -0.6, 0.45];
              const tilts = [0.15, -0.22, 0.3];
              coreObj.satellites.forEach((sat, sIdx) => {
                const spd = speeds[sIdx % speeds.length];
                const radius = orbitalRadii[sIdx % orbitalRadii.length];
                const tilt = tilts[sIdx % tilts.length];
                const satAng = time * spd + idx * 1.5 + (sIdx * Math.PI * 2) / 3;

                sat.position.x = Math.cos(satAng) * radius;
                sat.position.z = Math.sin(satAng) * radius;
                sat.position.y = -0.3 + Math.sin(satAng) * (radius * tilt) + Math.sin(time * 2 + sIdx) * 0.15;
                sat.rotation.x += 0.015;
                sat.rotation.y += 0.025;
              });
            }
          });
        }
      }

      // Real Anatomical Skeletal Kinematics with Multi-Joint Articulations
      if (gameMode === 'race' && runnerCharRef.current) {
        const rc = runnerCharRef.current;
        if (gameWonRef.current) {
          // Fortnite Victory Emote: Side-to-side victory shuffle dance with arms pumping
          const danceCycle = time * 7.5;
          rc.group.position.y = 0.28 + Math.abs(Math.sin(danceCycle)) * 0.22;
          rc.group.rotation.y = Math.sin(time * 2.5) * 0.45;
          rc.hips.rotation.z = Math.sin(danceCycle) * 0.22;
          rc.spine.rotation.y = Math.sin(danceCycle) * 0.18;
          rc.chest.rotation.x = -0.05;
          rc.chest.rotation.y = Math.cos(danceCycle) * 0.24;
          rc.leftArm.rotation.x = -1.3 + Math.sin(danceCycle) * 0.7;
          rc.rightArm.rotation.x = -1.3 - Math.sin(danceCycle) * 0.7;
          rc.leftElbow.rotation.x = 0.85;
          rc.rightElbow.rotation.x = 0.85;
          rc.leftLeg.rotation.x = Math.sin(danceCycle) * 0.4;
          rc.rightLeg.rotation.x = -Math.sin(danceCycle) * 0.4;
          rc.leftKnee.rotation.x = Math.max(0, -Math.sin(danceCycle)) * 0.6;
          rc.rightKnee.rotation.x = Math.max(0, Math.sin(danceCycle)) * 0.6;
          rc.head.rotation.y = -Math.sin(time * 2.5) * 0.3;
        } else if (!runnerStumbleActiveRef.current) {
          // Dynamic Athletic Sprint Cycle with Genuine Biomechanical Kinematics
          const stride = time * 13.5;
          // Pelvis double-beat vertical bounce, hip roll & tilt
          rc.hips.position.y = 0.52 + Math.abs(Math.sin(stride)) * 0.08;
          rc.hips.rotation.z = Math.sin(stride) * 0.07;
          rc.hips.rotation.y = -Math.cos(stride) * 0.06;

          // Lumbar spine counter-twist & torso articulation
          rc.spine.rotation.y = Math.cos(stride) * 0.12;
          rc.chest.rotation.x = 0.22 + Math.sin(stride * 2) * 0.03; // athletic forward sprint lean
          rc.chest.rotation.y = -Math.cos(stride) * 0.08; // thoracic counter-rotation

          // Cervical neck gaze stabilization
          rc.neck.rotation.x = -0.12 - Math.sin(stride * 2) * 0.02;
          rc.neck.rotation.y = Math.cos(stride) * 0.04;

          // Hip Ball Joints & Thighs
          rc.leftLeg.rotation.x = Math.sin(stride) * 0.88;
          rc.rightLeg.rotation.x = -Math.sin(stride) * 0.88;

          // Knee Hinge Joints (Patella & Condyles) - sharp 78-degree flexion on back-kick
          rc.leftKnee.rotation.x = Math.max(0, -Math.sin(stride)) * 1.35;
          rc.rightKnee.rotation.x = Math.max(0, Math.sin(stride)) * 1.35;

          // Ankle Malleolus Joints (Dorsiflexion on forward swing, plantarflexion on push-off)
          rc.leftAnkle.rotation.x = Math.sin(stride) * 0.38;
          rc.rightAnkle.rotation.x = -Math.sin(stride) * 0.38;

          // Shoulder Ball Joints driving reciprocal arm swing
          rc.leftArm.rotation.x = -Math.sin(stride) * 0.95;
          rc.rightArm.rotation.x = Math.sin(stride) * 0.95;

          // Elbow Hinge Joints flexing dynamically between 70 and 100 degrees
          rc.leftElbow.rotation.x = 0.75 + Math.abs(Math.sin(stride)) * 0.42;
          rc.rightElbow.rotation.x = 0.75 + Math.abs(Math.sin(stride)) * 0.42;

          // Wrist Joints stabilizing hands with sprint momentum
          rc.leftWrist.rotation.x = Math.sin(stride) * 0.18;
          rc.rightWrist.rotation.x = -Math.sin(stride) * 0.18;

          // Glowing sneaker soles pulse with speed
          const pulse = 0.8 + Math.sin(stride * 2) * 0.4;
          rc.sneakerGlows.forEach((glow) => {
            if (glow.material && 'emissiveIntensity' in glow.material) {
              (glow.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
            }
          });

          // In-Scene 3D Footstep Dust billow animation
          if (runnerDustDataRef.current.length > 0 && runnerGroupRef.current) {
            const runnerPos = runnerGroupRef.current.position;
            runnerDustDataRef.current.forEach((dp, idx) => {
              dp.life += 0.038;
              if (dp.life > 1) {
                dp.life = 0;
                const footX = (idx % 2 === 0 ? 0.16 : -0.16) + (Math.random() - 0.5) * 0.06;
                dp.mesh.position.set(
                  runnerPos.x + footX,
                  runnerPos.y + 0.04,
                  runnerPos.z + 0.32 + Math.random() * 0.08
                );
                dp.mesh.scale.setScalar(0.35);
                dp.mesh.visible = true;
              } else {
                dp.mesh.position.y += 0.007;
                dp.mesh.position.z += 0.024 * dp.speed;
                const sc = 0.35 + dp.life * 1.5;
                dp.mesh.scale.setScalar(sc);
                dp.mesh.rotation.y += dp.rotSpeed * 0.04;
                dp.mesh.rotation.x += dp.rotSpeed * 0.02;
              }
            });
          }
        }
      } else if (gameMode === 'battle') {
        const hc = heroCharRef.current;
        const ec = enemyCharRef.current;

        if (hc) {
          if (gameWonRef.current) {
            // Victory Emote: sword held aloft with cyan energy beam radiating
            hc.chest.position.y = 0.16;
            hc.head.rotation.x = -0.35;
            hc.rightArm.rotation.x = -Math.PI / 1.45;
            hc.rightArm.rotation.z = -0.22;
            hc.rightElbow.rotation.x = 0.1;
            hc.sword.rotation.x = 0.1;
            hc.leftArm.rotation.x = 0.4;
            hc.shield.rotation.y = -0.6;
            hc.plume.rotation.z = Math.sin(time * 6) * 0.25;
            if (hc.bladeGlow.material && 'emissiveIntensity' in hc.bladeGlow.material) {
              (hc.bladeGlow.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.6 + Math.sin(time * 8) * 0.6;
            }
          } else if (isCorrectRef.current === null) {
            // Authentic Martial Arts Combat Guard Stance: knees flexed, hips grounded, shield guarding
            const breathe = Math.sin(time * 2.8) * 0.03;
            hc.hips.position.y = 0.50 + breathe;
            hc.spine.rotation.y = -0.14; // Coiled core towards opponent
            hc.chest.rotation.x = 0.08 + breathe * 0.3;

            // Lower limbs in balanced martial stance (front knee flexed, rear leg braced)
            hc.leftLeg.rotation.x = -0.15;
            hc.leftKnee.rotation.x = 0.32;
            hc.rightLeg.rotation.x = 0.22;
            hc.rightKnee.rotation.x = 0.24;

            // Left Shoulder & Elbow holding shield forward to defend vitals
            hc.leftArm.rotation.x = 0.26 + Math.sin(time * 2) * 0.05;
            hc.leftElbow.rotation.x = 0.45;
            hc.shield.rotation.y = -0.26 + Math.sin(time * 2) * 0.05;

            // Right Shoulder & Elbow holding broadsword ready in high-guard angle
            hc.rightArm.rotation.x = -0.42 + Math.sin(time * 2.5) * 0.05;
            hc.rightArm.rotation.z = 0.15;
            hc.rightElbow.rotation.x = 0.65;
            hc.sword.rotation.x = Math.PI / 3;

            // Plume fluttering in wind
            hc.plume.rotation.z = Math.sin(time * 4.5) * 0.18;
            // Plasma edge hum
            if (hc.bladeGlow.material && 'emissiveIntensity' in hc.bladeGlow.material) {
              (hc.bladeGlow.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8 + Math.sin(time * 5.5) * 0.4;
            }
          }
        }

        if (ec && isCorrectRef.current === null) {
          // Colossal Golem heavy breathing & magma pulse
          const gBreath = Math.sin(time * 2) * 0.04;
          ec.torso.position.y = 0.28 + gBreath;
          ec.torso.scale.set(1 + gBreath * 0.5, 1 + gBreath * 0.8, 1);
          ec.leftArm.rotation.x = Math.sin(time * 2) * 0.14;
          ec.rightArm.rotation.x = -Math.sin(time * 2) * 0.14;
          ec.head.rotation.y = Math.sin(time * 1.5) * 0.08;

          // Magma veins pulsating
          const mPulse = 0.9 + Math.sin(time * 3.5) * 0.5;
          ec.magmaVeins.forEach((mesh) => {
            if (mesh.material && 'emissiveIntensity' in mesh.material) {
              (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = mPulse;
            }
          });
        }

        // In-Scene 3D Battle Clash sparks decay & physics
        if (battleSparksDataRef.current.length > 0) {
          battleSparksDataRef.current.forEach((sp) => {
            if (sp.life > 0) {
              sp.life -= 0.035;
              sp.mesh.position.x += sp.vx;
              sp.mesh.position.y += sp.vy;
              sp.mesh.position.z += sp.vz;
              sp.vy -= 0.006;
              sp.mesh.scale.setScalar(Math.max(0.01, sp.life));
              if (sp.life <= 0) sp.mesh.visible = false;
            }
          });
        }
      } else if (gameMode === 'shop') {
        const mc = merchantCharRef.current;
        const cc = customerCharRef.current;

        // In-Scene 3D Shop golden sparkles orbiting
        if (shopSparksDataRef.current.length > 0) {
          shopSparksDataRef.current.forEach((sp) => {
            sp.angle += 0.028 * sp.speed;
            sp.mesh.position.x = Math.cos(sp.angle) * sp.radius;
            sp.mesh.position.z = Math.sin(sp.angle) * (sp.radius * 0.6);
            sp.mesh.position.y = sp.initialY + Math.sin(time * 3 + sp.angle) * 0.12;
            sp.mesh.rotation.y = time * 3;
            sp.mesh.rotation.x = time * 2;
          });
        }

        if (mc && isCorrectRef.current === null) {
          // Don Mateo animated cheerful gestures
          mc.group.position.y = 0.3 + Math.sin(time * 2.2) * 0.02;
          mc.headGroup.rotation.z = Math.sin(time * 2.5) * 0.06;
          mc.headGroup.rotation.y = Math.sin(time * 1.8) * 0.1;
          // Mustache wiggle
          mc.mustacheL.rotation.z = Math.PI / 1.3 + Math.sin(time * 5) * 0.06;
          mc.mustacheR.rotation.z = -Math.PI / 1.3 - Math.sin(time * 5) * 0.06;
          // Left arm gestures to items
          mc.leftArm.rotation.x = 0.2 + Math.sin(time * 2) * 0.15;
          // Right arm flips coin
          mc.rightArm.rotation.x = -0.1 + Math.sin(time * 2) * 0.08;
          mc.coinInHand.position.y = -0.42 + Math.abs(Math.sin(time * 3.5)) * 0.22;
          mc.coinInHand.rotation.y = time * 4;
        }

        if (cc && isCorrectRef.current === null) {
          // Customer observing items on counter
          cc.headGroup.rotation.x = 0.1 + Math.sin(time * 2.2) * 0.08;
          cc.headGroup.rotation.y = Math.sin(time * 1.6) * 0.12;
          cc.rightArm.rotation.x = 0.15 + Math.sin(time * 2) * 0.05;
        }

        if (shopCoinsMeshRef.current && isCorrectRef.current === null) {
          shopCoinsMeshRef.current.rotation.y = time * 0.8;
        }

        // Shop Antique Scale Balance subtle sway
        if (shopScalesArmRef.current) {
          shopScalesArmRef.current.rotation.z = Math.sin(time * 1.8) * 0.08;
        }

        // Shop Warm Lantern gentle breeze swing
        if (shopLanternLightRef.current) {
          shopLanternLightRef.current.rotation.z = Math.sin(time * 2.0) * 0.06;
          shopLanternLightRef.current.rotation.x = Math.cos(time * 1.7) * 0.04;
        }
      } else if (gameMode === 'bridge' && walkerCharRef.current) {
        const wc = walkerCharRef.current;
        if (gameWonRef.current) {
          // Victory staff twirl & cheer
          wc.staff.rotation.y = time * 5;
          wc.rightArm.rotation.x = -1.2;
          wc.leftArm.rotation.x = 0.5;
          wc.head.rotation.y = Math.sin(time * 3) * 0.2;
        } else if (isCorrectRef.current === true) {
          // Dynamic Bridge Step Kinematics during forward leap
          const walkCycle = time * 12;
          wc.hips.position.y = 0.48 + Math.abs(Math.sin(walkCycle)) * 0.05;
          wc.leftLeg.rotation.x = Math.sin(walkCycle) * 0.48;
          wc.leftKnee.rotation.x = Math.max(0, -Math.sin(walkCycle)) * 0.78;
          wc.rightLeg.rotation.x = -Math.sin(walkCycle) * 0.48;
          wc.rightKnee.rotation.x = Math.max(0, Math.sin(walkCycle)) * 0.78;

          wc.leftArm.rotation.x = -Math.sin(walkCycle) * 0.42;
          wc.leftElbow.rotation.x = 0.25 + Math.abs(Math.sin(walkCycle)) * 0.2;

          wc.rightArm.rotation.x = Math.sin(walkCycle) * 0.38;
          wc.rightElbow.rotation.x = 0.35 + Math.sin(walkCycle) * 0.2;
          wc.staff.position.z = 0.14 + Math.sin(walkCycle) * 0.06;
          wc.staffCrystal.rotation.y = time * 3.5;
        } else {
          // Calm, firmly grounded stance standing on the bridge deck
          const breath = Math.sin(time * 2) * 0.015;
          wc.hips.position.y = 0.48 + breath;
          wc.leftLeg.rotation.x = 0;
          wc.leftKnee.rotation.x = 0;
          wc.rightLeg.rotation.x = 0;
          wc.rightKnee.rotation.x = 0;

          wc.leftArm.rotation.x = 0.15 + breath * 2;
          wc.leftElbow.rotation.x = 0.2;
          wc.rightArm.rotation.x = -0.15;
          wc.rightElbow.rotation.x = 0.3;
          wc.staff.position.z = 0.14;

          wc.head.rotation.y = Math.sin(time * 1.5) * 0.08;
          wc.staffCrystal.rotation.y = time * 2.0;
          if (wc.staffCrystal.material && 'emissiveIntensity' in wc.staffCrystal.material) {
            (wc.staffCrystal.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8 + Math.sin(time * 4) * 0.3;
          }
        }
      } else if (gameMode === 'detective') {
        const dc = detectiveCharRef.current;
        if (dc && isCorrectRef.current === null) {
          // Detective sweeps cipher wand in holographic scan across the oak doors
          const scanTime = time * 2.2;
          dc.rightArm.rotation.y = Math.sin(scanTime) * 0.28;
          dc.rightArm.rotation.x = -0.15 + Math.cos(scanTime) * 0.12;
          dc.wandProjection.rotation.z = Math.sin(time * 3) * 0.12;
          if (dc.wandProjection.material && 'opacity' in dc.wandProjection.material) {
            (dc.wandProjection.material as THREE.MeshBasicMaterial).opacity = 0.22 + Math.sin(time * 4) * 0.12;
          }
          // Head attentively tracks scan beam
          dc.headGroup.rotation.y = Math.sin(scanTime) * 0.2;
          dc.headGroup.rotation.x = 0.08 + Math.cos(scanTime) * 0.06;
          dc.leftArm.rotation.x = 0.1 + Math.sin(time * 1.5) * 0.04;
        }

        if (castleChestRef.current) {
          castleChestRef.current.position.y = 1.1 + Math.sin(time * 3) * 0.03;
        }

        // Castle Royal Banners fluttering in atmospheric wind
        if (castleBannersRef.current.length > 0) {
          castleBannersRef.current.forEach((banner, bIdx) => {
            banner.rotation.x = Math.sin(time * 2.5 + bIdx) * 0.1;
            banner.rotation.z = Math.cos(time * 1.8 + bIdx) * 0.05;
          });
        }

        // Castle Gothic Rose Window glowing pulse
        if (castleRoseGlowRef.current && castleRoseGlowRef.current.material && 'emissiveIntensity' in castleRoseGlowRef.current.material) {
          (castleRoseGlowRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
            0.7 + Math.sin(time * 3.2) * 0.35;
        }

        // Castle Braziers & Wall Torches flickering flames
        if (castleBrazierFlamesRef.current.length > 0) {
          castleBrazierFlamesRef.current.forEach((flame, fIdx) => {
            flame.scale.y = 0.9 + Math.sin(time * 10 + fIdx * 2) * 0.25;
            flame.scale.x = 0.95 + Math.cos(time * 8 + fIdx) * 0.15;
            flame.scale.z = 0.95 + Math.sin(time * 7 + fIdx) * 0.15;
          });
        }
      }

      // Win/Loss Continuous Animation Tickers
      if (finishConfettiGroupRef.current && finishConfettiGroupRef.current.visible) {
        finishConfettiGroupRef.current.children.forEach((c, idx) => {
          c.rotation.x += 0.04 + (idx % 3) * 0.01;
          c.rotation.y += 0.05 + (idx % 2) * 0.01;
          c.position.y -= 0.012;
          if (c.position.y < -0.6) c.position.y = 2.4;
        });
      }

      if (heroDizzyStarsRef.current && heroDizzyStarsRef.current.visible) {
        heroDizzyStarsRef.current.rotation.y = time * 4.5;
      }

      if (castleGateGlowRef.current && castleGateGlowRef.current.visible) {
        castleGateGlowRef.current.rotation.z = time * 0.4;
        const beamPulse = 0.48 + Math.sin(time * 5.5) * 0.16;
        (castleGateGlowRef.current.material as THREE.MeshBasicMaterial).opacity = beamPulse;
      }

      if (heroVictoryAuraRef.current && heroVictoryAuraRef.current.visible) {
        heroVictoryAuraRef.current.rotation.y = -time * 1.2;
      }

      if (shopCheerCoinsRef.current && shopCheerCoinsRef.current.visible) {
        shopCheerCoinsRef.current.rotation.y = time * 3.0;
        shopCheerCoinsRef.current.children.forEach((coin, cIdx) => {
          coin.position.y = 0.2 + Math.abs(Math.sin(time * 4 + cIdx)) * 0.4;
        });
      }

      if (castleSparklesRef.current && castleSparklesRef.current.visible) {
        castleSparklesRef.current.position.y = 0.5 + Math.sin(time * 3) * 0.12;
        castleSparklesRef.current.rotation.y = time * 1.4;
      }

      if (castleQuestionMarksRef.current && castleQuestionMarksRef.current.visible) {
        castleQuestionMarksRef.current.rotation.y = time * 3.5;
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    // Un solo frame roto (por ejemplo, un personaje que todavía no terminó de
    // construirse cuando llega el primer frame -- más común en celulares más
    // lentos) ya no debe congelar el juego entero: si renderFrame() lanza un
    // error, lo registramos y seguimos programando el siguiente frame igual.
    const renderLoop = () => {
      try {
        renderFrame();
      } catch (err) {
        console.error('[ThreeWorldCanvas] Error en un frame, se continúa con el siguiente:', err);
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          try {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
          } catch {
            // si hasta el render de emergencia falla, no hay nada más que hacer este frame
          }
        }
      }
      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [viewMode, gameMode]);

  return (
    <div className="relative w-full h-[320px] sm:h-[380px] md:h-[440px] short:h-[46dvh] overflow-hidden rounded-2xl border border-slate-700/60 bg-[#142138] shadow-2xl select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating 3D Navigation Controls Overlay */}
      {viewMode === 'map' && !universeFinaleActive && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-slate-700/60 text-xs text-slate-300 pointer-events-none">
          <span>🔄 Arrastra para girar el mapa 3D</span>
          <span className="text-slate-500">·</span>
          <span>👆 Toca una isla para viajar</span>
        </div>
      )}

      {viewMode === 'game' && gameMode === 'battle' && (
        <div className="absolute top-3 left-4 right-4 flex justify-between items-center pointer-events-none z-10">
          <div className="bg-slate-900/85 backdrop-blur-md px-3 py-2 rounded-xl border border-blue-500/40 w-40">
            <div className="flex justify-between text-xs font-bold text-blue-300 mb-1">
              <span>Héroe (Tú)</span>
              <span>{Math.max(0, heroHp)}%</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${Math.max(0, heroHp)}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-900/85 backdrop-blur-md px-3 py-2 rounded-xl border border-amber-500/40 w-44 text-right">
            <div className="flex justify-between text-xs font-bold text-amber-300 mb-1">
              <span>Guardián</span>
              <span>{Math.max(0, enemyHp)}%</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-300 float-right"
                style={{ width: `${Math.max(0, enemyHp)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {viewMode === 'game' && gameMode === 'bridge' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/85 backdrop-blur-md px-4 py-1.5 rounded-full border border-sky-500/40 text-xs font-bold text-sky-200 pointer-events-none">
          Puente construido: {bridgeBuiltSegments} / {totalQuestions} bloques
        </div>
      )}

      {/* ========================================================= */}
      {/* PARTÍCULAS AMBIENTALES DE FONDO (CSS, SUTILES, POR REGIÓN) */}
      {/* ========================================================= */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Bosque de la Suma: hojas flotando en el fondo */}
        {viewMode === 'game' && currentRegionId === 'bosque' && (
          <div className="absolute inset-0">
            <span className="absolute left-[8%] -top-4 w-3.5 h-2 rounded-full bg-emerald-400/40 animate-leaf-1 blur-[0.3px]" />
            <span className="absolute left-[32%] -top-4 w-4 h-2.5 rounded-full bg-green-500/35 animate-leaf-2 blur-[0.4px]" />
            <span className="absolute right-[22%] -top-4 w-3 h-2 rounded-full bg-lime-400/35 animate-leaf-3 blur-[0.3px]" />
            <span className="absolute right-[8%] -top-4 w-4 h-2.5 rounded-full bg-emerald-600/30 animate-leaf-4 blur-[0.4px]" />
          </div>
        )}

        {/* Montaña de la Resta: neblina baja y suave */}
        {viewMode === 'game' && currentRegionId === 'montana' && (
          <div className="absolute inset-0">
            <div className="absolute -left-[30%] top-1/4 w-[160%] h-24 bg-gradient-to-r from-transparent via-orange-500/10 to-transparent blur-2xl animate-mist-slow" />
            <div className="absolute -left-[20%] top-1/2 w-[150%] h-28 bg-gradient-to-r from-transparent via-slate-400/10 to-transparent blur-3xl animate-mist-reverse" />
          </div>
        )}

        {/* Ciudad de la Multiplicación: chispas tenues de mercado */}
        {viewMode === 'game' && currentRegionId === 'ciudad' && (
          <div className="absolute inset-0">
            <span className="absolute left-[18%] bottom-14 w-2 h-2 rounded-full bg-amber-400/40 blur-[0.6px] animate-spark-1" />
            <span className="absolute left-[48%] bottom-16 w-1.5 h-1.5 rounded-full bg-orange-300/45 blur-[0.5px] animate-spark-2" />
            <span className="absolute right-[24%] bottom-12 w-2 h-2 rounded-full bg-yellow-300/35 blur-[0.7px] animate-spark-3" />
            <span className="absolute right-[10%] bottom-20 w-1.5 h-1.5 rounded-full bg-amber-500/30 blur-[0.6px] animate-spark-1" style={{ animationDelay: '-2.4s' }} />
          </div>
        )}

        {/* Castillo de la División: polvillo místico flotante */}
        {viewMode === 'game' && currentRegionId === 'castillo' && (
          <div className="absolute inset-0">
            <span className="absolute left-[12%] top-24 w-2.5 h-2.5 rounded-full bg-purple-400/30 blur-[0.8px] animate-mystic-1" />
            <span className="absolute left-[36%] top-36 w-2 h-2 rounded-full bg-indigo-300/35 blur-[0.6px] animate-mystic-2" />
            <span className="absolute right-[28%] top-20 w-2.5 h-2.5 rounded-full bg-violet-400/30 blur-[0.7px] animate-mystic-3" />
            <span className="absolute right-[14%] top-32 w-1.5 h-1.5 rounded-full bg-fuchsia-300/25 blur-[0.6px] animate-mystic-1" style={{ animationDelay: '-4.2s' }} />
          </div>
        )}
      </div>
    </div>
  );
};
