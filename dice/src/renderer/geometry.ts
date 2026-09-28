import type { BufferAttribute, InterleavedBufferAttribute, Texture } from 'three';
import {
    BoxGeometry,
    BufferGeometry,
    CanvasTexture,
    DodecahedronGeometry,
    Float32BufferAttribute,
    Mesh,
    MeshStandardMaterial,
    OctahedronGeometry,
    Quaternion,
    SphereGeometry,
    TetrahedronGeometry,
    Vector3,
} from 'three';

import type { DiceDefinition } from '../engine/dice.js';

const TEXTURE_SIZE = 512;
const TEXTURE_BG = '#1e3a5f';
const TEXTURE_BORDER = '#4a90e2';
const TEXTURE_FG = '#ffffff';

/** Die side counts that have dedicated polyhedron geometry + physics colliders. */
export const SUPPORTED_GEOMETRY_SIDES = [4, 6, 8, 10, 12, 20] as const;

export interface DieMeshResult {
  mesh: Mesh;
  /** Outward face normal per face index, at identity rotation. */
  faceNormals: Vector3[];
  /** "Texture up" direction per face index, at identity rotation. */
  faceUps: Vector3[];
  disposables: Array<Texture | MeshStandardMaterial>;
}

type PositionAttribute = BufferAttribute | InterleavedBufferAttribute;

// Known outward normals for BoxGeometry groups (indices 0–5)
const BOX_NORMALS = [
  new Vector3(1, 0, 0),
  new Vector3(-1, 0, 0),
  new Vector3(0, 1, 0),
  new Vector3(0, -1, 0),
  new Vector3(0, 0, 1),
  new Vector3(0, 0, -1),
];

// "Texture up" direction in world space (at identity rotation) for each BoxGeometry face.
// Derived from Three.js BoxGeometry UV layout: UV V=1 maps to the canvas top (flipY=true).
const BOX_UPS = [
  new Vector3(0, 1, 0),
  new Vector3(0, 1, 0),
  new Vector3(0, 0, -1),
  new Vector3(0, 0, 1),
  new Vector3(0, 1, 0),
  new Vector3(0, 1, 0),
];

// Per-face UV patterns — centroid of each pattern sits at (0.5, 0.5) where the label is drawn.
const TRI_UV: Array<[number, number]> = [
  [0.5, 0.92],
  [0.14, 0.29],
  [0.86, 0.29],
];
const KITE_UV_UPPER: Array<[number, number]> = [
  [0.5, 0.92], [0.05, 0.5], [0.5, 0.08],
  [0.5, 0.92], [0.5, 0.08], [0.95, 0.5],
];
const KITE_UV_LOWER: Array<[number, number]> = [
  [0.5, 0.08], [0.05, 0.5], [0.5, 0.92],
  [0.5, 0.08], [0.95, 0.5], [0.05, 0.5],
];
const PENT_UV: Array<[number, number]> = [
  [0.5, 0.92], [0.9, 0.63], [0.75, 0.16],
  [0.5, 0.92], [0.75, 0.16], [0.25, 0.16],
  [0.5, 0.92], [0.25, 0.16], [0.1, 0.63],
];

/**
 * Overwrite the UV attribute so every face uses the same UV pattern,
 * placing the texture label centred on each face regardless of spherical UVs.
 */
function setPerFaceUVs(
  geo: BufferGeometry,
  faceCount: number,
  uvPattern: Array<[number, number]>,
): void {
  const vertsPerFace = uvPattern.length;
  const uvs = new Float32Array(faceCount * vertsPerFace * 2);
  for (let i = 0; i < faceCount; i++) {
    for (let v = 0; v < vertsPerFace; v++) {
      uvs[(i * vertsPerFace + v) * 2] = uvPattern[v][0];
      uvs[(i * vertsPerFace + v) * 2 + 1] = uvPattern[v][1];
    }
  }
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
}

/** Compute the "texture up" direction for a single face from a position attribute. */
function computeFaceUp(
  pos: PositionAttribute,
  startVertex: number,
  vertCount: number,
  normal: Vector3,
  topIdx: number,
): Vector3 {
  const centroid = new Vector3();
  for (let i = 0; i < vertCount; i++) {
    centroid.x += pos.getX(startVertex + i);
    centroid.y += pos.getY(startVertex + i);
    centroid.z += pos.getZ(startVertex + i);
  }
  centroid.divideScalar(vertCount);
  const apex = new Vector3(
    pos.getX(startVertex + topIdx),
    pos.getY(startVertex + topIdx),
    pos.getZ(startVertex + topIdx),
  );
  return apex.sub(centroid).projectOnPlane(normal).normalize();
}

function makeTexture(label: string, fontScale = 0.42): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // jsdom / headless — return an undrawn texture rather than crashing
    return new CanvasTexture(canvas);
  }

  ctx.fillStyle = TEXTURE_BG;
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  ctx.strokeStyle = TEXTURE_BORDER;
  ctx.lineWidth = 18;
  ctx.strokeRect(9, 9, TEXTURE_SIZE - 18, TEXTURE_SIZE - 18);

  ctx.fillStyle = TEXTURE_FG;
  const maxWidth = TEXTURE_SIZE * 0.78;
  let fontSize = Math.floor(TEXTURE_SIZE * fontScale);
  ctx.font = `bold ${fontSize.toString()}px system-ui, sans-serif`;
  while (ctx.measureText(label).width > maxWidth && fontSize > 20) {
    fontSize -= 4;
    ctx.font = `bold ${fontSize.toString()}px system-ui, sans-serif`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, TEXTURE_SIZE / 2, TEXTURE_SIZE / 2);

  return new CanvasTexture(canvas);
}

function makeMaterials(
  faces: string[],
  disposables: Array<Texture | MeshStandardMaterial>,
  fontScale = 0.42,
): MeshStandardMaterial[] {
  return faces.map((label) => {
    const tex = makeTexture(label, fontScale);
    disposables.push(tex);
    const mat = new MeshStandardMaterial({ map: tex });
    disposables.push(mat);
    return mat;
  });
}

/**
 * Compute the outward face normal from consecutive position entries.
 * Works for convex polyhedra centred at the origin (normal ≈ centroid direction).
 */
function computeFaceNormal(posAttr: PositionAttribute, start: number, count: number): Vector3 {
  const c = new Vector3();
  for (let i = start; i < start + count; i++) {
    c.x += posAttr.getX(i);
    c.y += posAttr.getY(i);
    c.z += posAttr.getZ(i);
  }
  return c.divideScalar(count).normalize();
}

/** Add one group per triangular face for non-indexed PolyhedronGeometry subclasses. */
function addTriangleGroups(geo: BufferGeometry, faceCount: number): void {
  for (let i = 0; i < faceCount; i++) {
    geo.addGroup(i * 3, 3, i);
  }
}

/** Add one group per pentagonal face (3 triangles / face) for DodecahedronGeometry. */
function addPentagonGroups(geo: BufferGeometry, faceCount: number): void {
  for (let i = 0; i < faceCount; i++) {
    geo.addGroup(i * 9, 9, i);
  }
}

interface PolyGeometry {
  geo: BufferGeometry;
  faceNormals: Vector3[];
  faceUps: Vector3[];
}

/**
 * Build a pentagonal trapezohedron (d10) geometry with planar kite faces.
 * Ring height satisfies: RING_H / APEX_H = (1 - cos(PI/5)) / (1 + cos(PI/5))
 */
function buildD10Geometry(): PolyGeometry {
  const APEX_H = 1.4;
  const cos36 = Math.cos(Math.PI / 5);
  const RING_H = (APEX_H * (1 - cos36)) / (1 + cos36);
  const RING_R = 1.05;

  const T: [number, number, number] = [0, APEX_H, 0];
  const B: [number, number, number] = [0, -APEX_H, 0];

  const U: Array<[number, number, number]> = Array.from({ length: 5 }, (_, k) => [
    RING_R * Math.cos((2 * Math.PI * k) / 5),
    RING_H,
    RING_R * Math.sin((2 * Math.PI * k) / 5),
  ]);
  const L: Array<[number, number, number]> = Array.from({ length: 5 }, (_, k) => [
    RING_R * Math.cos((2 * Math.PI * k) / 5 + Math.PI / 5),
    -RING_H,
    RING_R * Math.sin((2 * Math.PI * k) / 5 + Math.PI / 5),
  ]);

  const positions: number[] = [];
  const faceNormals: Vector3[] = [];
  const faceUps: Vector3[] = [];

  // Upper 5 faces (share top apex T). KITE_UV_UPPER vertex 0 (T) is the UV top.
  for (let k = 0; k < 5; k++) {
    const nk = (k + 1) % 5;
    positions.push(...T, ...U[nk], ...L[k], ...T, ...L[k], ...U[k]);
    const normal = new Vector3(
      (T[0] + U[k][0] + L[k][0] + U[nk][0]) / 4,
      (T[1] + U[k][1] + L[k][1] + U[nk][1]) / 4,
      (T[2] + U[k][2] + L[k][2] + U[nk][2]) / 4,
    ).normalize();
    faceNormals.push(normal);
    const cx = (T[0] + U[k][0] + L[k][0] + U[nk][0]) / 4;
    const cy = (T[1] + U[k][1] + L[k][1] + U[nk][1]) / 4;
    const cz = (T[2] + U[k][2] + L[k][2] + U[nk][2]) / 4;
    faceUps.push(
      new Vector3(T[0] - cx, T[1] - cy, T[2] - cz).projectOnPlane(normal).normalize(),
    );
  }

  // Lower 5 faces (share bottom apex B). KITE_UV_LOWER vertex 2 (L[nk]) is the UV top.
  for (let k = 0; k < 5; k++) {
    const nk = (k + 1) % 5;
    positions.push(...B, ...U[nk], ...L[nk], ...B, ...L[k], ...U[nk]);
    const normal = new Vector3(
      (B[0] + L[k][0] + U[nk][0] + L[nk][0]) / 4,
      (B[1] + L[k][1] + U[nk][1] + L[nk][1]) / 4,
      (B[2] + L[k][2] + U[nk][2] + L[nk][2]) / 4,
    ).normalize();
    faceNormals.push(normal);
    const cx = (B[0] + L[k][0] + U[nk][0] + L[nk][0]) / 4;
    const cy = (B[1] + L[k][1] + U[nk][1] + L[nk][1]) / 4;
    const cz = (B[2] + L[k][2] + U[nk][2] + L[nk][2]) / 4;
    faceUps.push(
      new Vector3(L[nk][0] - cx, L[nk][1] - cy, L[nk][2] - cz)
        .projectOnPlane(normal)
        .normalize(),
    );
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  for (let i = 0; i < 10; i++) {
    geo.addGroup(i * 6, 6, i);
  }
  geo.computeVertexNormals();

  const uvData = new Float32Array(10 * 6 * 2);
  for (let i = 0; i < 5; i++) {
    for (let v = 0; v < 6; v++) {
      uvData[(i * 6 + v) * 2] = KITE_UV_UPPER[v][0];
      uvData[(i * 6 + v) * 2 + 1] = KITE_UV_UPPER[v][1];
    }
  }
  for (let i = 0; i < 5; i++) {
    for (let v = 0; v < 6; v++) {
      uvData[((i + 5) * 6 + v) * 2] = KITE_UV_LOWER[v][0];
      uvData[((i + 5) * 6 + v) * 2 + 1] = KITE_UV_LOWER[v][1];
    }
  }
  geo.setAttribute('uv', new Float32BufferAttribute(uvData, 2));

  return { geo, faceNormals, faceUps };
}

/** d20 circumradius — must match makeRoundedIcosahedronBody() in physics.ts. */
export const D20_RADIUS = 1.3;
/** Corner rounding radius — must match makeRoundedIcosahedronBody() in physics.ts. */
export const D20_CORNER_RADIUS = 0.25;
// Subdivisions per icosahedron edge — controls how smooth the rounded corners look
const D20_EDGE_DIVISIONS = 12;

/**
 * Icosahedron (d20) with rounded corners: each flat face is subdivided into a
 * barycentric grid and vertices beyond the clip radius are pulled onto a
 * sphere, producing spherical caps at the 12 corners while faces stay planar
 * (so labels are undistorted). The clip radius is derived so the visual shape
 * matches the physics compound (shrunk hull + corner spheres): resting face
 * height and corner reach agree exactly.
 */
function buildRoundedD20Geometry(): PolyGeometry {
  const t = (1 + Math.sqrt(5)) / 2;
  const s = D20_RADIUS / Math.sqrt(1 + t * t);
  const v = (x: number, y: number, z: number): Vector3 => new Vector3(x * s, y * s, z * s);
  const verts = [
    v(-1, t, 0), v(1, t, 0), v(-1, -t, 0), v(1, -t, 0),
    v(0, -1, t), v(0, 1, t), v(0, -1, -t), v(0, 1, -t),
    v(t, 0, -1), v(t, 0, 1), v(-t, 0, -1), v(-t, 0, 1),
  ];
  const faceIdx = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  // Inradius (distance from centre to a face plane) and the matching clip radius
  const [a0, b0, c0] = faceIdx[0].map((i) => verts[i]);
  const n0 = new Vector3().subVectors(b0, a0).cross(new Vector3().subVectors(c0, a0)).normalize();
  const inradius = Math.abs(n0.dot(a0));
  const shrink = 1 - D20_CORNER_RADIUS / inradius;
  const clipR = shrink * D20_RADIUS + D20_CORNER_RADIUS;

  const n = D20_EDGE_DIVISIONS;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const faceNormals: Vector3[] = [];
  const faceUps: Vector3[] = [];

  const pushVert = (bary: [number, number, number], a: Vector3, b: Vector3, c: Vector3, fn: Vector3): void => {
    const [u, w, x] = bary;
    const p = new Vector3()
      .addScaledVector(a, u)
      .addScaledVector(b, w)
      .addScaledVector(c, x);
    const len = p.length();
    if (len > clipR) {
      p.multiplyScalar(clipR / len);
      const d = p.clone().normalize();
      normals.push(d.x, d.y, d.z);
    } else {
      normals.push(fn.x, fn.y, fn.z);
    }
    positions.push(p.x, p.y, p.z);
    uvs.push(
      u * TRI_UV[0][0] + w * TRI_UV[1][0] + x * TRI_UV[2][0],
      u * TRI_UV[0][1] + w * TRI_UV[1][1] + x * TRI_UV[2][1],
    );
  };

  for (const [ia, ib, ic] of faceIdx) {
    const a = verts[ia];
    const b = verts[ib];
    const c = verts[ic];
    let fn = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();
    const centroid = new Vector3().add(a).add(b).add(c).divideScalar(3);
    // Ensure outward winding (matches fixWindings in physics.ts)
    if (fn.dot(centroid) < 0) fn = fn.negate();
    faceNormals.push(fn.clone());
    faceUps.push(a.clone().sub(centroid).projectOnPlane(fn).normalize());

    // Barycentric grid: row i from vertex a toward edge bc
    const bary = (i: number, j: number): [number, number, number] => [
      (n - i) / n,
      (i - j) / n,
      j / n,
    ];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        pushVert(bary(i, j), a, b, c, fn);
        pushVert(bary(i + 1, j), a, b, c, fn);
        pushVert(bary(i + 1, j + 1), a, b, c, fn);
        if (j < i) {
          pushVert(bary(i, j), a, b, c, fn);
          pushVert(bary(i + 1, j + 1), a, b, c, fn);
          pushVert(bary(i, j + 1), a, b, c, fn);
        }
      }
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  const vertsPerFace = n * n * 3;
  for (let i = 0; i < 20; i++) {
    geo.addGroup(i * vertsPerFace, vertsPerFace, i);
  }

  return { geo, faceNormals, faceUps };
}

/** Build a die mesh with per-face label textures. */
export function createDieMesh(die: DiceDefinition): DieMeshResult {
  const disposables: Array<Texture | MeshStandardMaterial> = [];

  // Unsupported side counts fall back to a labelled sphere (single face normal)
  if (!(SUPPORTED_GEOMETRY_SIDES as readonly number[]).includes(die.sides)) {
    const geo = new SphereGeometry(1.2, 32, 32);
    const tex = makeTexture(die.name);
    disposables.push(tex);
    const mat = new MeshStandardMaterial({ map: tex });
    disposables.push(mat);
    const mesh = new Mesh(geo, mat);
    return {
      mesh,
      faceNormals: [new Vector3(0, 1, 0)],
      faceUps: [new Vector3(0, 0, -1)],
      disposables,
    };
  }

  const materials = makeMaterials(
    die.faces,
    disposables,
    die.sides === 6 ? 0.42 : die.sides === 10 ? 0.35 : die.sides === 12 ? 0.33 : 0.3,
  );
  let geo: BufferGeometry;
  let faceNormals: Vector3[];
  let faceUps: Vector3[];

  switch (die.sides) {
    case 4: {
      geo = new TetrahedronGeometry(1.3);
      addTriangleGroups(geo, 4);
      setPerFaceUVs(geo, 4, TRI_UV);
      const pos = geo.attributes.position;
      faceNormals = Array.from({ length: 4 }, (_, i) => computeFaceNormal(pos, i * 3, 3));
      faceUps = Array.from({ length: 4 }, (_, i) =>
        computeFaceUp(pos, i * 3, 3, faceNormals[i], 0),
      );
      break;
    }
    case 6: {
      geo = new BoxGeometry(1.5, 1.5, 1.5);
      faceNormals = BOX_NORMALS.map((n) => n.clone());
      faceUps = BOX_UPS.map((n) => n.clone());
      break;
    }
    case 8: {
      geo = new OctahedronGeometry(1.3);
      addTriangleGroups(geo, 8);
      setPerFaceUVs(geo, 8, TRI_UV);
      const pos = geo.attributes.position;
      faceNormals = Array.from({ length: 8 }, (_, i) => computeFaceNormal(pos, i * 3, 3));
      faceUps = Array.from({ length: 8 }, (_, i) =>
        computeFaceUp(pos, i * 3, 3, faceNormals[i], 0),
      );
      break;
    }
    case 10: {
      ({ geo, faceNormals, faceUps } = buildD10Geometry());
      break;
    }
    case 12: {
      geo = new DodecahedronGeometry(1.3);
      addPentagonGroups(geo, 12);
      setPerFaceUVs(geo, 12, PENT_UV);
      const pos = geo.attributes.position;
      faceNormals = Array.from({ length: 12 }, (_, i) => computeFaceNormal(pos, i * 9, 9));
      faceUps = Array.from({ length: 12 }, (_, i) =>
        computeFaceUp(pos, i * 9, 9, faceNormals[i], 0),
      );
      break;
    }
    default: {
      ({ geo, faceNormals, faceUps } = buildRoundedD20Geometry());
      break;
    }
  }

  const mesh = new Mesh(geo, materials);
  return { mesh, faceNormals, faceUps, disposables };
}

/**
 * Return the quaternion that rotates faceNormal onto targetDir, with an optional
 * second constraint that aligns faceUp with desiredUp (rotation around targetDir).
 */
export function quaternionForFace(
  faceNormal: Vector3,
  targetDir: Vector3,
  faceUp?: Vector3 | null,
  desiredUp?: Vector3 | null,
): Quaternion {
  const Q1 = new Quaternion().setFromUnitVectors(faceNormal, targetDir);
  if (!faceUp || !desiredUp) return Q1;

  const rotatedUp = faceUp.clone().applyQuaternion(Q1);
  const along = rotatedUp.dot(targetDir);
  rotatedUp.addScaledVector(targetDir, -along);
  if (rotatedUp.lengthSq() < 1e-8) return Q1;
  rotatedUp.normalize();

  const Q2 = new Quaternion().setFromUnitVectors(rotatedUp, desiredUp);
  return Q2.multiply(Q1);
}
