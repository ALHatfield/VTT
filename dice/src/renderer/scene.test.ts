import type { Material } from 'three';
import { Quaternion, Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

import { createStandardDie } from '../engine/dice.js';
import { createDieMesh } from './geometry.js';
import { swapFaceMaterials, topFaceIndex } from './scene.js';

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

describe('topFaceIndex', () => {
  it('returns the face whose rotated normal points most upward', () => {
    const { faceNormals } = createDieMesh(createStandardDie(6));
    // BoxGeometry group 2 has normal +Y — identity rotation keeps it on top
    expect(topFaceIndex(faceNormals, new Quaternion())).toBe(2);
    // Rotate 180° around Z: +Y face now points down, -Y face (group 3) is up
    const flip = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI);
    expect(topFaceIndex(faceNormals, flip)).toBe(3);
    // Rotate -90° around Z: +X face (group 0) rotates onto +Y
    const quarter = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2);
    expect(topFaceIndex(faceNormals, quarter)).toBe(0);
  });
});

describe('swapFaceMaterials', () => {
  it('stamps the result label onto the landed face', () => {
    const { mesh } = createDieMesh(createStandardDie(20));
    const original = [...(mesh.material as Material[])];
    const landed = 4; // physics landed face "5" up
    const result = 13; // server rolled 14

    swapFaceMaterials(mesh, landed, result);

    const mats = mesh.material as Material[];
    // The landed face now renders the authoritative result texture
    expect(mats[landed]).toBe(original[result]);
    expect(mats[result]).toBe(original[landed]);
    // All other faces untouched
    for (let i = 0; i < mats.length; i++) {
      if (i !== landed && i !== result) expect(mats[i]).toBe(original[i]);
    }
  });

  it('is a no-op when the die landed on the result face already', () => {
    const { mesh } = createDieMesh(createStandardDie(6));
    const original = [...(mesh.material as Material[])];
    swapFaceMaterials(mesh, 3, 3);
    const mats = mesh.material as Material[];
    for (let i = 0; i < mats.length; i++) {
      expect(mats[i]).toBe(original[i]);
    }
  });
});
