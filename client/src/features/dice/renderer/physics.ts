import {
    Body,
    Box,
    ContactMaterial,
    ConvexPolyhedron,
    Material,
    NaiveBroadphase,
    Plane,
    Sphere,
    Vec3,
    World,
} from 'cannon-es';

// ---------------------------------------------------------------------------
// Collider factories — vertices scaled to match the Three.js mesh circumradii
// ---------------------------------------------------------------------------

/**
 * For a convex shape centred at the origin, every outward-facing triangular
 * face satisfies  n · v₀ > 0. Reverses any face that violates this.
 * Only correct for triangular faces.
 */
function fixWindings(vertices: Vec3[], faces: number[][]): number[][] {
  return faces.map((face) => {
    const a = vertices[face[0]];
    const b = vertices[face[1]];
    const c = vertices[face[2]];
    const nx = (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y);
    const ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
    const nz = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    return nx * a.x + ny * a.y + nz * a.z < 0 ? [face[0], face[2], face[1]] : face;
  });
}

/** Regular tetrahedron (d4). Uses alternating cube corners so circumradius = s√3 = 1.3. */
function makeTetrahedronShape(): ConvexPolyhedron {
  const s = 1.3 / Math.sqrt(3);
  const vertices = [
    new Vec3(s, s, s),
    new Vec3(s, -s, -s),
    new Vec3(-s, s, -s),
    new Vec3(-s, -s, s),
  ];
  const faces = [
    [0, 1, 2],
    [0, 3, 1],
    [0, 2, 3],
    [1, 3, 2],
  ];
  return new ConvexPolyhedron({ vertices, faces });
}

/** Regular octahedron (d8). Circumradius = 1.3. */
function makeOctahedronShape(): ConvexPolyhedron {
  const r = 1.3;
  const vertices = [
    new Vec3(r, 0, 0),
    new Vec3(-r, 0, 0),
    new Vec3(0, r, 0),
    new Vec3(0, -r, 0),
    new Vec3(0, 0, r),
    new Vec3(0, 0, -r),
  ];
  const faces = [
    [2, 4, 0], [2, 1, 4], [2, 5, 1], [2, 0, 5],
    [3, 0, 4], [3, 4, 1], [3, 1, 5], [3, 5, 0],
  ];
  return new ConvexPolyhedron({ vertices, faces });
}

/** Pentagonal trapezohedron (d10). Vertices match buildD10Geometry() exactly. */
function makeD10Shape(): ConvexPolyhedron {
  const APEX_H = 1.4;
  const cos36 = Math.cos(Math.PI / 5);
  const RING_H = (APEX_H * (1 - cos36)) / (1 + cos36);
  const RING_R = 1.05;
  const T = new Vec3(0, APEX_H, 0);
  const B = new Vec3(0, -APEX_H, 0);
  const U = Array.from(
    { length: 5 },
    (_, k) =>
      new Vec3(
        RING_R * Math.cos((2 * Math.PI * k) / 5),
        RING_H,
        RING_R * Math.sin((2 * Math.PI * k) / 5),
      ),
  );
  const L = Array.from(
    { length: 5 },
    (_, k) =>
      new Vec3(
        RING_R * Math.cos((2 * Math.PI * k) / 5 + Math.PI / 5),
        -RING_H,
        RING_R * Math.sin((2 * Math.PI * k) / 5 + Math.PI / 5),
      ),
  );
  // Indices: T=0, B=1, U[k]=2+k, L[k]=7+k
  const vertices = [T, B, ...U, ...L];
  const faces: number[][] = [];
  for (let k = 0; k < 5; k++) {
    const nk = (k + 1) % 5;
    faces.push([0, 2 + nk, 7 + k, 2 + k]);
    faces.push([1, 7 + k, 2 + nk, 7 + nk]);
  }
  return new ConvexPolyhedron({ vertices, faces });
}

/**
 * Regular dodecahedron (d12). Vertices and face winding match Three.js DodecahedronGeometry.
 * Circumradius = s√3 = 1.3.
 */
function makeDodecahedronShape(): ConvexPolyhedron {
  const t = (1 + Math.sqrt(5)) / 2;
  const r = 1 / t;
  const s = 1.3 / Math.sqrt(3);
  const v = (x: number, y: number, z: number): Vec3 => new Vec3(x * s, y * s, z * s);
  const vertices = [
    v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, -1), v(-1, 1, 1),
    v(1, -1, -1), v(1, -1, 1), v(1, 1, -1), v(1, 1, 1),
    v(0, -r, -t), v(0, -r, t), v(0, r, -t), v(0, r, t),
    v(-r, -t, 0), v(-r, t, 0), v(r, -t, 0), v(r, t, 0),
    v(-t, 0, -r), v(-t, 0, r), v(t, 0, -r), v(t, 0, r),
  ];
  const faces = [
    [3, 11, 7], [3, 7, 15], [3, 15, 13],
    [7, 19, 17], [7, 17, 6], [7, 6, 15],
    [17, 4, 8], [17, 8, 10], [17, 10, 6],
    [8, 0, 16], [8, 16, 2], [8, 2, 10],
    [0, 12, 1], [0, 1, 18], [0, 18, 16],
    [6, 10, 2], [6, 2, 13], [6, 13, 15],
    [2, 16, 18], [2, 18, 3], [2, 3, 13],
    [18, 1, 9], [18, 9, 11], [18, 11, 3],
    [4, 14, 12], [4, 12, 0], [4, 0, 8],
    [11, 9, 5], [11, 5, 19], [11, 19, 7],
    [19, 5, 14], [19, 14, 4], [19, 4, 17],
    [1, 12, 14], [1, 14, 5], [1, 5, 9],
  ];
  return new ConvexPolyhedron({ vertices, faces: fixWindings(vertices, faces) });
}

/**
 * Regular icosahedron (d20) with rounded corners. Vertices match
 * buildRoundedD20Geometry() in geometry.ts: a hull shrunk toward the centre
 * plus a sphere at each of the 12 corners. The die lands and pivots on the
 * corner spheres, so it tumbles onward smoothly instead of catching on sharp
 * points — and rolls noticeably further, as a real rounded d20 does.
 */
function addRoundedIcosahedronShapes(body: Body): void {
  const R = 1.3; // circumradius — must match D20_RADIUS in geometry.ts
  const CORNER_R = 0.25; // must match D20_CORNER_RADIUS in geometry.ts
  const t = (1 + Math.sqrt(5)) / 2;
  const s = R / Math.sqrt(1 + t * t);
  const vertices = [
    new Vec3(-s, s * t, 0), new Vec3(s, s * t, 0),
    new Vec3(-s, -s * t, 0), new Vec3(s, -s * t, 0),
    new Vec3(0, -s, s * t), new Vec3(0, s, s * t),
    new Vec3(0, -s, -s * t), new Vec3(0, s, -s * t),
    new Vec3(s * t, 0, -s), new Vec3(s * t, 0, s),
    new Vec3(-s * t, 0, -s), new Vec3(-s * t, 0, s),
  ];
  const faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  // Shrink so a face-down die rests on its 3 corner spheres at the original
  // inradius height — keeps the rendered mesh flush with the ground plane.
  const a = vertices[faces[0][0]];
  const b = vertices[faces[0][1]];
  const c = vertices[faces[0][2]];
  const nx = (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y);
  const ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
  const nz = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
  const inradius = Math.abs((nx * a.x + ny * a.y + nz * a.z) / nLen);
  const shrink = 1 - CORNER_R / inradius;

  const scaled = vertices.map((vtx) => vtx.scale(shrink));
  body.addShape(new ConvexPolyhedron({ vertices: scaled, faces: fixWindings(scaled, faces) }));
  for (const vtx of scaled) {
    body.addShape(new Sphere(CORNER_R), vtx.clone());
  }
}

// Heavy-feel tuning: strong gravity keeps arcs low and impacts hard. The floor
// stays low-restitution (no pop-ups) but grippy, so skids convert into tumbling
// that carries the die forward. Walls act like a dice tray's banks — springy
// and slick — so ricochets preserve momentum and keep the die rolling.
/** World gravity (units/s²) — also used by the visual throw arc in scene.ts. */
export const GRAVITY = -45;
const GROUND_FRICTION = 0.25;
const GROUND_RESTITUTION = 0.2;
const WALL_FRICTION = 0.05;
const WALL_RESTITUTION = 0.75;
const DIE_FRICTION = 0.1;
const DIE_RESTITUTION = 0.5;
const SETTLE_VELOCITY_THRESHOLD = 0.3;
// Settle assist: below this speed the die is no longer tumbling, just rocking
// on a face — heavy damping kicks in so it plants like a weighty die instead
// of oscillating. Fast dice keep the low base damping and roll freely.
const SETTLE_ASSIST_SPEED = 3;
const SETTLE_ASSIST_LINEAR_DAMPING = 0.5;
const SETTLE_ASSIST_ANGULAR_DAMPING = 0.8;
const BASE_LINEAR_DAMPING = 0.01;
const BASE_ANGULAR_DAMPING = 0.03;
// Once a die stays below this speed for this long, physics freezes it —
// kills the residual micro-bounces after it has landed on a face.
const SLEEP_SPEED_LIMIT = 0.5;
const SLEEP_TIME_LIMIT_S = 0.2;

/** World-space height of the physics ground plane where dice come to rest. */
export const GROUND_Y = -1.5;

/** Axis-aligned play-area limits on the ground plane; dice bounce off these walls. */
export interface ArenaBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export class PhysicsWorld {
  private readonly _world: World;
  private readonly _dieMat: Material;
  private readonly _wallMat: Material;
  private _wallBodies: Body[] = [];
  private _dieBodies: Body[] = [];

  constructor() {
    this._world = new World();
    this._world.gravity.set(0, GRAVITY, 0);
    this._world.broadphase = new NaiveBroadphase();
    this._world.allowSleep = true;

    const groundMat = new Material('ground');
    const groundBody = new Body({ mass: 0, material: groundMat });
    groundBody.addShape(new Plane());
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    groundBody.position.set(0, GROUND_Y, 0);
    this._world.addBody(groundBody);

    this._dieMat = new Material('die');
    this._wallMat = new Material('wall');

    this._world.addContactMaterial(
      new ContactMaterial(groundMat, this._dieMat, {
        friction: GROUND_FRICTION,
        restitution: GROUND_RESTITUTION,
      }),
    );
    this._world.addContactMaterial(
      new ContactMaterial(this._wallMat, this._dieMat, {
        friction: WALL_FRICTION,
        restitution: WALL_RESTITUTION,
      }),
    );
    this._world.addContactMaterial(
      new ContactMaterial(this._dieMat, this._dieMat, {
        friction: DIE_FRICTION,
        restitution: DIE_RESTITUTION,
      }),
    );
  }

  /**
   * Install (or replace) four invisible static walls so dice bounce off the
   * visible canvas boundaries instead of sliding out of view.
   */
  setBounds(bounds: ArenaBounds): void {
    for (const body of this._wallBodies) {
      this._world.removeBody(body);
    }
    this._wallBodies = [];

    // Plane's default normal is +z; rotate each to face into the arena
    const walls: Array<{ pos: [number, number, number]; eulerY: number }> = [
      { pos: [bounds.minX, 0, 0], eulerY: Math.PI / 2 },  // left → normal +x
      { pos: [bounds.maxX, 0, 0], eulerY: -Math.PI / 2 }, // right → normal -x
      { pos: [0, 0, bounds.minZ], eulerY: 0 },            // far → normal +z
      { pos: [0, 0, bounds.maxZ], eulerY: Math.PI },      // near → normal -z
    ];
    for (const { pos, eulerY } of walls) {
      const body = new Body({ mass: 0, material: this._wallMat });
      body.addShape(new Plane());
      body.quaternion.setFromEuler(0, eulerY, 0);
      body.position.set(pos[0], pos[1], pos[2]);
      this._world.addBody(body);
      this._wallBodies.push(body);
    }
  }

  /**
   * Create and register a rigid body for a die at the given position.
   * Each supported die type uses a ConvexPolyhedron matching its rendered
   * geometry; unsupported side counts fall back to a Sphere.
   */
  createDieBody(sides: number, x: number, y: number, z: number): Body {
    const body = new Body({
      // Mass matters for die-vs-die impacts and inertia against friction —
      // the "weight" against the static table comes from GRAVITY.
      mass: 3,
      material: this._dieMat,
      // Minimal damping — momentum bleeds off through contacts, not air drag,
      // so the die keeps tumbling until friction genuinely stops it.
      linearDamping: BASE_LINEAR_DAMPING,
      angularDamping: BASE_ANGULAR_DAMPING,
    });
    body.allowSleep = true;
    body.sleepSpeedLimit = SLEEP_SPEED_LIMIT;
    body.sleepTimeLimit = SLEEP_TIME_LIMIT_S;

    switch (sides) {
      case 4: body.addShape(makeTetrahedronShape()); break;
      case 6: body.addShape(new Box(new Vec3(0.75, 0.75, 0.75))); break;
      case 8: body.addShape(makeOctahedronShape()); break;
      case 10: body.addShape(makeD10Shape()); break;
      case 12: body.addShape(makeDodecahedronShape()); break;
      case 20: addRoundedIcosahedronShapes(body); break;
      default: body.addShape(new Sphere(1.1)); break;
    }

    body.position.set(x, y, z);
    this._world.addBody(body);
    this._dieBodies.push(body);
    return body;
  }

  removeBody(body: Body): void {
    this._world.removeBody(body);
    this._dieBodies = this._dieBodies.filter((b) => b !== body);
  }

  /** Advance one fixed 60 Hz step — used by the deterministic pre-simulation. */
  stepFixed(): void {
    // Settle assist — slow dice get heavy damping so they plant on a face
    // instead of rocking; anything knocked back up to speed rolls freely again.
    for (const body of this._dieBodies) {
      const slow =
        body.velocity.length() < SETTLE_ASSIST_SPEED &&
        body.angularVelocity.length() < SETTLE_ASSIST_SPEED;
      body.linearDamping = slow ? SETTLE_ASSIST_LINEAR_DAMPING : BASE_LINEAR_DAMPING;
      body.angularDamping = slow ? SETTLE_ASSIST_ANGULAR_DAMPING : BASE_ANGULAR_DAMPING;
    }
    this._world.step(1 / 60);
  }

  /** Returns true when the body has effectively stopped moving. */
  isSettled(body: Body): boolean {
    return (
      body.sleepState === Body.SLEEPING ||
      (body.velocity.length() < SETTLE_VELOCITY_THRESHOLD &&
        body.angularVelocity.length() < SETTLE_VELOCITY_THRESHOLD)
    );
  }
}
