import type { BufferGeometry, Mesh } from 'three';
import { Quaternion, Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

import { createStandardDie } from '../engine/dice.js';
import { createDieMesh, quaternionForFace } from './geometry.js';

const UP = new Vector3(0, 1, 0);
// Mirrors DiceScene's flatten step: the landed face rotates exactly upright,
// with screen-up (world XZ projection for the camera at (0, 28, 10)) keeping
// the label readable
const SETTLE_DIR = UP;
const SETTLE_UP = new Vector3(0, 0, -1);

// Minimal document stub so makeTexture works in the node test environment
beforeAll(() => {
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => null,
    }),
  };
});

/** Area-weighted outward normal of one geometry group, computed from raw triangles. */
function geometricGroupNormal(geo: BufferGeometry, groupIndex: number): Vector3 {
  const group = geo.groups[groupIndex];
  const pos = geo.attributes.position;
  const index = geo.index;
  const normal = new Vector3();
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();

  for (let i = group.start; i < group.start + group.count; i += 3) {
    const ia = index ? index.getX(i) : i;
    const ib = index ? index.getX(i + 1) : i + 1;
    const ic = index ? index.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, ia);
    b.fromBufferAttribute(pos, ib);
    c.fromBufferAttribute(pos, ic);
    // Cross product magnitude = 2×area, direction = winding normal
    normal.add(b.clone().sub(a).cross(c.clone().sub(a)));
  }
  return normal.normalize();
}

/** Index of the group whose geometric normal points most toward dir after rotation. */
function facingGroupIndex(geo: BufferGeometry, quat: Quaternion, dir: Vector3): number {
  let best = -Infinity;
  let bestIdx = -1;
  for (let g = 0; g < geo.groups.length; g++) {
    const d = geometricGroupNormal(geo, g).applyQuaternion(quat).dot(dir);
    if (d > best) {
      best = d;
      bestIdx = g;
    }
  }
  return bestIdx;
}

describe.each([4, 6, 8, 10, 12, 20])('d%i face orientation', (sides) => {
  it('faceNormals[i] matches the geometric normal of material group i', () => {
    const die = createStandardDie(sides);
    const { mesh, faceNormals } = createDieMesh(die);
    const geo = (mesh as Mesh).geometry;

    expect(geo.groups.length).toBe(sides);
    expect(faceNormals).toHaveLength(sides);

    for (let i = 0; i < sides; i++) {
      const geometric = geometricGroupNormal(geo, i);
      // Same physical face: normals must agree (label texture i sits on group i)
      expect(geometric.dot(faceNormals[i])).toBeGreaterThan(0.99);
    }
  });

  it('flatten quaternion puts the landed face exactly upright for every face', () => {
    const die = createStandardDie(sides);
    const { mesh, faceNormals, faceUps } = createDieMesh(die);
    const geo = (mesh as Mesh).geometry;

    for (let faceIndex = 0; faceIndex < sides; faceIndex++) {
      const quat = quaternionForFace(
        faceNormals[faceIndex],
        SETTLE_DIR,
        faceUps[faceIndex] ?? null,
        SETTLE_UP,
      );
      // The rotated face normal must align exactly with the settle direction
      const rotated = faceNormals[faceIndex].clone().applyQuaternion(quat);
      expect(rotated.dot(SETTLE_DIR)).toBeGreaterThan(0.999);
      // And no other face may point more toward the camera than the result face
      expect(facingGroupIndex(geo, quat, SETTLE_DIR)).toBe(faceIndex);
    }
  });
});
