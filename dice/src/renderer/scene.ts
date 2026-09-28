import type { Mesh, MeshStandardMaterial, Texture } from 'three';
import {
    AmbientLight,
    CanvasTexture,
    Clock,
    DirectionalLight,
    PerspectiveCamera,
    Quaternion,
    Scene,
    Sprite,
    SpriteMaterial,
    Vector3,
    WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import type { DiceDefinition } from '../engine/dice.js';
import { createDieMesh, quaternionForFace } from './geometry.js';
import type { ArenaBounds } from './physics.js';
import { GRAVITY, GROUND_Y, PhysicsWorld } from './physics.js';

// Shorter duration = faster throw: the arc must cover the same distance in
// less time, so both the visual arc and the derived launch velocity speed up.
const THROW_DURATION_S = 0.22;
// Deliberately aggressive — the spin carries into the physics handoff, so a
// fast tumble in the air means more chaotic rolling on the table.
const THROW_SPIN_SPEED = 32; // rad/s during arc
const SETTLE_MIN_FRAMES = 8; // consecutive pre-sim steps below velocity threshold
const SETTLE_SLERP_FACTOR = 0.14;
const SETTLE_EPSILON = 0.001; // rad — close enough to target quaternion
// Keep walls one die-radius inside the visible edge so dice never clip off-screen
const ARENA_MARGIN = 1.4;
// Fallback arena when frustum intersection is degenerate (e.g. zero-size canvas)
const FALLBACK_BOUNDS: ArenaBounds = { minX: -9, maxX: 9, minZ: -6, maxZ: 6 };
const MIN_ARENA_SPAN = 4;

// Pre-simulation: fixed 60 Hz steps, capped at 10 simulated seconds. Runs
// synchronously on the main thread — typical rolls settle in 2–4s of sim time,
// and the flatten phase corrects any die that hits the cap mid-tumble.
const PRESIM_STEP_S = 1 / 60;
const PRESIM_MAX_STEPS = 600;

// Random offset applied to each throw start so arcs (and launch velocities) vary per die
const THROW_START_JITTER = 1;
// How far the forward-roll spin axis may randomly tilt (0 = perfectly aligned)
const SPIN_AXIS_JITTER = 0.25;
// Keep release points at least this far inside the arena walls
const RELEASE_MARGIN = 1;

// Gold glow applied to the result face once the die has settled
const GLOW_COLOR = 0xd4af37;
const GLOW_INTENSITY = 0.75;

// Name tag rendered under the dice cluster while a roll is on screen
const LABEL_CANVAS_W = 512;
const LABEL_CANVAS_H = 128;
const LABEL_WORLD_WIDTH = 4.5;
const LABEL_MAX_CHARS = 20;
const LABEL_Y = 0.5; // hover just above the ground plane
const LABEL_SCREEN_DOWN_OFFSET = 2.4; // world units below the dice on screen

// Concurrent rolls: each roll's release cluster is shifted into its own region
// so simultaneous throws from different players don't pile onto one spot
const ROLL_SLOT_OFFSETS = [
  { x: 0, z: 0 },
  { x: -7, z: 0 },
  { x: 0, z: -4 },
  { x: -7, z: -4 },
];
/** Max rolls kept on the table at once — the oldest is evicted beyond this. */
const MAX_ACTIVE_ROLLS = ROLL_SLOT_OFFSETS.length;
/** Default time settled dice stay visible before auto-clearing. */
const DEFAULT_LINGER_MS = 6000;

const UP = new Vector3(0, 1, 0);

// World-space release positions — spread so multiple dice don't start overlapping
const RELEASE_POSITIONS = [
  new Vector3(5.0, 3.0, 2.0),
  new Vector3(3.5, 3.2, 1.5),
  new Vector3(6.5, 3.4, 1.5),
  new Vector3(3.5, 3.6, 2.5),
  new Vector3(6.5, 3.8, 2.5),
  new Vector3(5.0, 3.2, 3.0),
  new Vector3(4.5, 3.4, 1.0),
  new Vector3(5.5, 3.6, 3.0),
];

/** Number of distinct release positions — the max dice a roll can animate without overlap. */
export const MAX_CONCURRENT_DICE = RELEASE_POSITIONS.length;

/** A die to animate plus the face it must show when settled (consumer-authoritative). */
export interface DieRoll {
  definition: DiceDefinition;
  /** Index into definition.faces of the authoritative result. */
  faceIndex: number;
}

export interface RollOptions {
  /** Name tag rendered under the dice (e.g. the rolling player's username). */
  label?: string;
}

export interface DiceSceneOptions {
  /**
   * Called once every die in a roll has settled with its result face up.
   * Not called for rolls evicted by newer rolls or removed via clear()/
   * dispose() — consumers needing a guarantee should pair this with a timeout.
   */
  onRollComplete?: (rollId: string) => void;
  /**
   * How long settled dice stay visible before auto-clearing.
   * Defaults to 6000ms — rolls share the table, so they must expire.
   */
  lingerMs?: number;
}

interface TrackedMesh {
  mesh: Mesh;
  disposables: Array<Texture | MeshStandardMaterial>;
}

/** One recorded pre-simulation step for playback. */
interface SimFrame {
  pos: Vector3;
  quat: Quaternion;
}

type AnimPhase = 'throw' | 'playback' | 'settle';

interface DieAnimState {
  phase: AnimPhase;
  mesh: Mesh;
  /** Recorded physics frames replayed after the throw arc. */
  frames: SimFrame[];
  /** Seconds elapsed inside the playback phase. */
  playbackT: number;
  /** Final flatten target — landed face rotated exactly upright. */
  targetQuat: Quaternion;
  /** Material rendered on the landed (result) face — receives the gold glow. */
  glowMaterial: MeshStandardMaterial | null;
  throwT: number;
  throwStart: Vector3;
  /** Initial ballistic velocity of the throw arc (gravity acts on Y). */
  throwVel: Vector3;
  throwAngVel: Vector3;
  /** Exact orientation the pre-sim body started with — snapped at arc end. */
  throwEndQuat: Quaternion;
}

interface LabelSprite {
  sprite: Sprite;
  material: SpriteMaterial;
  texture: CanvasTexture;
}

/** One roll's dice, name tag, and animation state — rolls coexist on the table. */
interface ActiveRoll {
  rollId: string;
  states: DieAnimState[];
  meshes: TrackedMesh[];
  label: LabelSprite | null;
  settled: boolean;
  lingerTimeout: ReturnType<typeof setTimeout> | null;
}

/** Billboard sprite with the roller's name on a translucent pill. */
function createLabelSprite(text: string): LabelSprite | null {
  const canvas = document.createElement('canvas');
  canvas.width = LABEL_CANVAS_W;
  canvas.height = LABEL_CANVAS_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const display =
    text.length > LABEL_MAX_CHARS ? `${text.slice(0, LABEL_MAX_CHARS - 1)}…` : text;
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const padX = 28;
  const pillW = Math.min(LABEL_CANVAS_W, ctx.measureText(display).width + padX * 2);
  const pillH = 88;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  ctx.beginPath();
  ctx.roundRect((LABEL_CANVAS_W - pillW) / 2, (LABEL_CANVAS_H - pillH) / 2, pillW, pillH, pillH / 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(display, LABEL_CANVAS_W / 2, LABEL_CANVAS_H / 2);

  const texture = new CanvasTexture(canvas);
  const material = new SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new Sprite(material);
  sprite.scale.set(LABEL_WORLD_WIDTH, LABEL_WORLD_WIDTH * (LABEL_CANVAS_H / LABEL_CANVAS_W), 1);
  sprite.renderOrder = 10; // always readable, even when a die rolls over it
  return { sprite, material, texture };
}

function randomAngVel(speed: number): Vector3 {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return new Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.sin(phi) * Math.sin(theta),
    Math.cos(phi),
  ).multiplyScalar(speed);
}

function randomQuat(): Quaternion {
  return new Quaternion().setFromAxisAngle(
    randomAngVel(1).normalize(),
    Math.random() * Math.PI * 2,
  );
}

/**
 * Angular velocity that tumbles the die end-over-end in its direction of
 * travel (axis = up × velocity, like a rolling wheel), with a small random
 * tilt so multiple dice don't rotate in lockstep.
 */
function rollingAngVel(vel: Vector3, speed: number): Vector3 {
  const axis = new Vector3(0, 1, 0).cross(new Vector3(vel.x, 0, vel.z));
  if (axis.lengthSq() < 1e-6) return randomAngVel(speed);
  axis.normalize();
  axis.add(randomAngVel(SPIN_AXIS_JITTER)).normalize();
  return axis.multiplyScalar(speed);
}

/** World-space position where die i begins its throw arc. */
function throwStartForIndex(i: number): Vector3 {
  return new Vector3(12 - i * 0.4, 3 + i * 0.2, 6 + i * 0.3);
}

/**
 * Initial velocity of the projectile arc from start to end over the given
 * duration: constant horizontal velocity, vertical solved so gravity carries
 * the die to the endpoint exactly at t = duration.
 */
function ballisticVelocity(start: Vector3, end: Vector3, duration: number): Vector3 {
  return new Vector3(
    (end.x - start.x) / duration,
    (end.y - start.y) / duration - (GRAVITY * duration) / 2,
    (end.z - start.z) / duration,
  );
}

/** Index of the face whose normal points most upward under the given rotation. */
export function topFaceIndex(faceNormals: Vector3[], quat: Quaternion): number {
  let best = -Infinity;
  let bestIdx = 0;
  for (let i = 0; i < faceNormals.length; i++) {
    const y = faceNormals[i].clone().applyQuaternion(quat).y;
    if (y > best) {
      best = y;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Swap the materials rendered on two faces. Used to stamp the authoritative
 * result label onto whichever face physics landed up — the die itself never
 * has to be reoriented to a predetermined face.
 */
export function swapFaceMaterials(mesh: Mesh, a: number, b: number): void {
  if (a === b || !Array.isArray(mesh.material)) return;
  const mats = mesh.material;
  [mats[a], mats[b]] = [mats[b], mats[a]];
}

/**
 * Renders authoritative dice rolls on a transparent WebGL canvas.
 *
 * The physics simulation runs to completion invisibly before any animation
 * starts. The face that actually lands up gets the authoritative result label
 * stamped onto it (materials swapped before the first visible frame), so the
 * value shown is correct by construction. The recorded simulation is then
 * played back in real time, finished with a small flatten rotation and a gold
 * glow on the result face.
 */
export class DiceScene {
  private readonly _canvas: HTMLCanvasElement;
  private readonly _renderer: WebGLRenderer;
  private readonly _scene: Scene;
  private readonly _camera: PerspectiveCamera;
  /** Screen-up projected onto the ground plane — keeps settled labels upright. */
  private readonly _cameraXZUp: Vector3;
  private readonly _controls: OrbitControls;
  private readonly _clock: Clock;
  private readonly _physics: PhysicsWorld;
  private readonly _resizeObserver: ResizeObserver;
  private readonly _onRollComplete: ((rollId: string) => void) | null;
  /** How long settled dice linger before their roll is removed from the table. */
  private readonly _lingerMs: number;
  private readonly _boundLoop: () => void;

  private _raf: number | null = null;
  private _rolls: ActiveRoll[] = [];
  /** Cycles the landing-region slots so concurrent rolls spread out. */
  private _slotCounter = 0;
  private _controlsEnabled = false;
  private _disposed = false;
  private _bounds: ArenaBounds = FALLBACK_BOUNDS;

  constructor(canvas: HTMLCanvasElement, options: DiceSceneOptions = {}) {
    this._canvas = canvas;
    this._onRollComplete = options.onRollComplete ?? null;
    this._lingerMs = options.lingerMs ?? DEFAULT_LINGER_MS;

    this._renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // updateStyle=false — CSS owns the canvas size; inline px styles would freeze it
    this._renderer.setSize(
      canvas.clientWidth || canvas.width,
      canvas.clientHeight || canvas.height,
      false,
    );

    this._scene = new Scene();

    this._camera = new PerspectiveCamera(
      45,
      (canvas.clientWidth || canvas.width) / (canvas.clientHeight || canvas.height),
      0.1,
      100,
    );
    // Top-down view. camera.up must be set off +Y — lookAt straight down is
    // degenerate with the default up vector.
    this._camera.position.set(0, 28, 0);
    this._camera.up.set(0, 0, -1);
    this._camera.lookAt(0, 0, 0);

    // Direction that appears as "up" on screen — with a straight-down camera
    // this is exactly camera.up. Settled labels are aligned to it.
    this._cameraXZUp = this._camera.up.clone();

    this._scene.add(new AmbientLight(0xffffff, 0.7));
    const sun = new DirectionalLight(0xffffff, 1.2);
    sun.position.set(5, 10, 7);
    this._scene.add(sun);

    // Camera controls stay disabled in normal play; toggled for development only
    this._controls = new OrbitControls(this._camera, this._renderer.domElement);
    this._controls.enableDamping = true;
    this._controls.dampingFactor = 0.06;
    this._controls.enableZoom = false;
    this._controls.enableRotate = false;
    this._controls.enablePan = false;

    this._clock = new Clock();
    this._physics = new PhysicsWorld();
    this._boundLoop = this._loop.bind(this);

    this._updateArenaBounds();

    this._resizeObserver = new ResizeObserver(() => {
      this._onResize();
    });
    this._resizeObserver.observe(canvas);

    // Render one frame so the transparent canvas initializes; the loop only
    // runs while there is animation or camera-control activity.
    this._renderer.render(this._scene, this._camera);
  }

  /** True while any roll animation is in flight. */
  isRolling(): boolean {
    return this._rolls.some((r) => !r.settled);
  }

  /**
   * Throw the given dice; each die's landed face shows its supplied result.
   * Rolls are additive — simultaneous rolls from different players share the
   * table, each landing in its own region with its own name tag.
   */
  roll(rollId: string, dice: DieRoll[], options: RollOptions = {}): void {
    if (this._disposed) return;
    if (dice.length === 0 || this._rolls.some((r) => r.rollId === rollId)) return;

    // Evict the oldest roll(s) when the table is full
    while (this._rolls.length >= MAX_ACTIVE_ROLLS) {
      this._removeRoll(this._rolls[0]);
    }

    const bounds = this._bounds;
    const slot = ROLL_SLOT_OFFSETS[this._slotCounter % ROLL_SLOT_OFFSETS.length];
    this._slotCounter += 1;
    const rollMeshes: TrackedMesh[] = [];

    // --- Stage 1: build meshes and deterministic throw parameters ------------
    const preps = dice.map(({ definition, faceIndex }, i) => {
      const { mesh, faceNormals, faceUps, disposables } = createDieMesh(definition);
      this._scene.add(mesh);
      rollMeshes.push({ mesh, disposables });

      // Physics starts at the release point — it must sit inside the arena walls
      const releasePos = RELEASE_POSITIONS[i % RELEASE_POSITIONS.length].clone();
      releasePos.x += slot.x;
      releasePos.z += slot.z;
      releasePos.x = Math.min(
        Math.max(releasePos.x, bounds.minX + RELEASE_MARGIN),
        bounds.maxX - RELEASE_MARGIN,
      );
      releasePos.z = Math.min(
        Math.max(releasePos.z, bounds.minZ + RELEASE_MARGIN),
        bounds.maxZ - RELEASE_MARGIN,
      );

      const startQuat = randomQuat();

      // Arcs stay in the roll's landing lane so concurrent throws don't cross
      const throwStart = throwStartForIndex(i);
      throwStart.z += slot.z;
      throwStart.x += (Math.random() * 2 - 1) * THROW_START_JITTER;
      throwStart.z += (Math.random() * 2 - 1) * THROW_START_JITTER;
      mesh.position.copy(throwStart);
      mesh.quaternion.copy(startQuat);

      // Arc velocity doubles as the physics launch velocity for a seamless handoff
      const throwVel = ballisticVelocity(throwStart, releasePos, THROW_DURATION_S);

      // Spin tumbles the die forward along its direction of travel
      const throwAngVel = rollingAngVel(throwVel, THROW_SPIN_SPEED);
      // Orientation the visible throw arc will end at — the pre-sim starts
      // there. World-space premultiply matches how angular velocity applies.
      const spin = new Quaternion().setFromAxisAngle(
        throwAngVel.clone().normalize(),
        throwAngVel.length() * THROW_DURATION_S,
      );
      const endQuat = spin.clone().multiply(startQuat);

      return {
        mesh,
        faceNormals,
        faceUps,
        sides: definition.sides,
        // Guard out-of-range indices from external callers
        resultIndex: Math.min(Math.max(faceIndex, 0), definition.sides - 1),
        releasePos,
        throwStart,
        throwVel,
        throwAngVel,
        endQuat,
      };
    });

    // --- Stage 2: run the full physics roll invisibly, recording every step --
    const bodies = preps.map((p) => {
      const body = this._physics.createDieBody(
        p.sides,
        p.releasePos.x,
        p.releasePos.y,
        p.releasePos.z,
      );
      // Launch with the arc's exact end velocity — momentum carries through
      // the handoff with no visible speed change.
      body.velocity.set(
        p.throwVel.x,
        p.throwVel.y + GRAVITY * THROW_DURATION_S,
        p.throwVel.z,
      );
      // Carry the visual throw spin into the physics for a seamless handoff
      body.angularVelocity.set(p.throwAngVel.x, p.throwAngVel.y, p.throwAngVel.z);
      body.quaternion.set(p.endQuat.x, p.endQuat.y, p.endQuat.z, p.endQuat.w);
      return body;
    });

    const frames: SimFrame[][] = preps.map(() => []);
    const settledSteps = new Array<number>(bodies.length).fill(0);
    // First step at which each die reached rest — used to trim trailing frames
    const restAt = new Array<number>(bodies.length).fill(-1);

    for (let step = 0; step < PRESIM_MAX_STEPS; step++) {
      this._physics.stepFixed();
      let allSettled = true;
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        frames[i].push({
          pos: new Vector3(b.position.x, b.position.y, b.position.z),
          quat: new Quaternion(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w),
        });
        if (this._physics.isSettled(b)) {
          settledSteps[i] += 1;
          if (settledSteps[i] === SETTLE_MIN_FRAMES) restAt[i] = step;
        } else {
          settledSteps[i] = 0;
          restAt[i] = -1;
        }
        if (settledSteps[i] < SETTLE_MIN_FRAMES) allSettled = false;
      }
      if (allSettled) break;
    }
    for (const body of bodies) this._physics.removeBody(body);
    // Each die's playback ends at its own rest moment instead of the slowest die's
    for (let i = 0; i < frames.length; i++) {
      if (restAt[i] >= 0) frames[i].length = restAt[i] + 1;
    }

    // --- Stage 3: stamp the result label onto the landed face -----------------
    const states = preps.map((p, i) => {
      const dieFrames = frames[i];
      const rest = dieFrames[dieFrames.length - 1];
      const landed = topFaceIndex(p.faceNormals, rest.quat);

      // The landed face now shows the authoritative label — before any frame renders
      swapFaceMaterials(p.mesh, landed, p.resultIndex);
      const glowMaterial = Array.isArray(p.mesh.material)
        ? (p.mesh.material[landed] as MeshStandardMaterial)
        : null;

      return {
        phase: 'throw' as AnimPhase,
        mesh: p.mesh,
        frames: dieFrames,
        playbackT: 0,
        // Small flatten correction: rotate the landed face exactly upright
        targetQuat: quaternionForFace(
          p.faceNormals[landed],
          UP,
          p.faceUps[landed] ?? null,
          this._cameraXZUp,
        ),
        glowMaterial,
        throwT: 0,
        throwStart: p.throwStart,
        throwVel: p.throwVel,
        throwAngVel: p.throwAngVel,
        throwEndQuat: p.endQuat,
      };
    });

    const roll: ActiveRoll = {
      rollId,
      states,
      meshes: rollMeshes,
      label: null,
      settled: false,
      lingerTimeout: null,
    };

    if (options.label) {
      const label = createLabelSprite(options.label);
      if (label) {
        roll.label = label;
        this._scene.add(label.sprite);
      }
    }

    this._rolls.push(roll);
    this._updateLabelPosition(roll);
    this._startLoop();
  }

  /** Remove all dice from the scene immediately. */
  clear(): void {
    this._clearAllRolls();
    this._renderFrame();
  }

  /** Enable/disable orbit + zoom camera controls (development aid). */
  setCameraControlsEnabled(enabled: boolean): void {
    this._controls.enableZoom = enabled;
    this._controls.enableRotate = enabled;
    this._controlsEnabled = enabled;
    if (enabled) this._startLoop();
  }

  /** Tear down the renderer, physics, observers, and RAF loop. */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this._stopLoop();
    this._clearAllRolls();
    this._resizeObserver.disconnect();
    this._controls.dispose();
    this._renderer.dispose();
  }

  private _startLoop(): void {
    if (this._disposed || this._raf !== null) return;
    this._clock.getDelta(); // reset delta so the first frame isn't a huge step
    this._raf = requestAnimationFrame(this._boundLoop);
  }

  private _stopLoop(): void {
    if (this._raf !== null) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
  }

  private _renderFrame(): void {
    if (this._disposed) return;
    this._renderer.render(this._scene, this._camera);
  }

  private _loop(): void {
    if (this._disposed) return;

    // Stop when nothing is animating — lingering dice stay on the last frame
    if (!this._rolls.some((r) => !r.settled) && !this._controlsEnabled) {
      this._raf = null;
      this._renderFrame();
      return;
    }

    this._raf = requestAnimationFrame(this._boundLoop);
    const delta = this._clock.getDelta();

    this._controls.update();

    for (const roll of this._rolls) {
      if (roll.settled) continue;
      let allDone = true;
      for (const state of roll.states) {
        if (!this._stepState(state, delta)) allDone = false;
      }
      this._updateLabelPosition(roll);
      if (allDone) this._onRollSettled(roll);
    }

    this._renderFrame();
  }

  /** Keep a roll's name tag under its dice cluster, clamped inside the arena. */
  private _updateLabelPosition(roll: ActiveRoll): void {
    if (!roll.label || roll.meshes.length === 0) return;
    let cx = 0;
    let cz = 0;
    for (const { mesh } of roll.meshes) {
      cx += mesh.position.x;
      cz += mesh.position.z;
    }
    cx /= roll.meshes.length;
    cz /= roll.meshes.length;
    // "Under" on screen — opposite the camera's projected up direction
    const pos = new Vector3(cx, 0, cz).addScaledVector(this._cameraXZUp, -LABEL_SCREEN_DOWN_OFFSET);
    pos.x = Math.min(Math.max(pos.x, this._bounds.minX), this._bounds.maxX);
    pos.z = Math.min(Math.max(pos.z, this._bounds.minZ), this._bounds.maxZ);
    pos.y = LABEL_Y;
    roll.label.sprite.position.copy(pos);
  }

  /** Advance one die's animation by one frame. Returns true once settled. */
  private _stepState(state: DieAnimState, delta: number): boolean {
    if (state.phase === 'throw') {
      state.throwT = Math.min(1, state.throwT + delta / THROW_DURATION_S);
      // Projectile kinematics: p = p₀ + v₀t + ½gt²
      const tS = state.throwT * THROW_DURATION_S;
      const pos = state.throwStart.clone().addScaledVector(state.throwVel, tS);
      pos.y += 0.5 * GRAVITY * tS * tS;
      state.mesh.position.copy(pos);

      const angle = state.throwAngVel.length() * delta;
      if (angle > 0) {
        const q = new Quaternion().setFromAxisAngle(state.throwAngVel.clone().normalize(), angle);
        // World-space rotation — the spin axis is a world direction
        state.mesh.quaternion.premultiply(q);
      }

      if (state.throwT >= 1) {
        // Snap to the exact orientation the pre-sim body started with
        state.mesh.quaternion.copy(state.throwEndQuat);
        state.phase = 'playback';
        state.playbackT = 0;
      }
      return false;
    }

    if (state.phase === 'playback') {
      state.playbackT += delta;
      const frames = state.frames;
      const exact = state.playbackT / PRESIM_STEP_S;
      const idx = Math.floor(exact);

      if (idx >= frames.length - 1) {
        const rest = frames[frames.length - 1];
        state.mesh.position.copy(rest.pos);
        state.mesh.quaternion.copy(rest.quat);
        // Glow the result face the moment the die lands, before it flattens upright
        if (state.glowMaterial) {
          state.glowMaterial.emissive.setHex(GLOW_COLOR);
          state.glowMaterial.emissiveIntensity = GLOW_INTENSITY;
          state.glowMaterial = null;
        }
        state.phase = 'settle';
        return false;
      }

      const a = frames[idx];
      const b = frames[idx + 1];
      const alpha = exact - idx;
      state.mesh.position.copy(a.pos).lerp(b.pos, alpha);
      state.mesh.quaternion.copy(a.quat).slerp(b.quat, alpha);
      return false;
    }

    // settle phase — small rotation that flattens the landed face exactly upright
    state.mesh.quaternion.slerp(state.targetQuat, SETTLE_SLERP_FACTOR);
    if (state.mesh.quaternion.angleTo(state.targetQuat) < SETTLE_EPSILON) {
      state.mesh.quaternion.copy(state.targetQuat);
      return true;
    }
    return false;
  }

  private _onRollSettled(roll: ActiveRoll): void {
    roll.settled = true;
    roll.states = [];

    // Each roll expires independently so the shared table never crowds up
    roll.lingerTimeout = setTimeout(() => {
      roll.lingerTimeout = null;
      this._removeRoll(roll);
      this._renderFrame(); // erase the lingering dice; the loop then stops itself
    }, this._lingerMs);

    if (this._onRollComplete) {
      this._onRollComplete(roll.rollId);
    }
  }

  /** Remove one roll's dice and name tag from the table, disposing resources. */
  private _removeRoll(roll: ActiveRoll): void {
    if (roll.lingerTimeout !== null) {
      clearTimeout(roll.lingerTimeout);
      roll.lingerTimeout = null;
    }
    for (const { mesh, disposables } of roll.meshes) {
      this._scene.remove(mesh);
      mesh.geometry.dispose();
      for (const d of disposables) d.dispose();
    }
    roll.meshes = [];
    roll.states = [];
    roll.settled = true;
    if (roll.label) {
      this._scene.remove(roll.label.sprite);
      roll.label.material.dispose();
      roll.label.texture.dispose();
      roll.label = null;
    }
    const idx = this._rolls.indexOf(roll);
    if (idx !== -1) this._rolls.splice(idx, 1);
  }

  private _clearAllRolls(): void {
    while (this._rolls.length > 0) {
      this._removeRoll(this._rolls[this._rolls.length - 1]);
    }
  }

  private _onResize(): void {
    const w = this._canvas.clientWidth;
    const h = this._canvas.clientHeight;
    if (w === 0 || h === 0) return;
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(w, h, false);
    this._updateArenaBounds();
    this._renderFrame();
  }

  /**
   * Intersect the camera frustum corners with the ground plane and install
   * physics walls at the inner rectangle of the visible area, so dice bounce
   * off the canvas boundaries instead of sliding out of view.
   */
  private _updateArenaBounds(): void {
    const cam = this._camera;
    // unproject reads matrixWorld, which is otherwise only refreshed at render time
    cam.updateMatrixWorld();
    const corners: Array<[number, number]> = [
      [-1, 1],  // top-left (far row)
      [1, 1],   // top-right (far row)
      [-1, -1], // bottom-left (near row)
      [1, -1],  // bottom-right (near row)
    ];

    const points: Vector3[] = [];
    for (const [nx, ny] of corners) {
      const dir = new Vector3(nx, ny, 0.5).unproject(cam).sub(cam.position).normalize();
      if (dir.y >= -1e-3) {
        this._applyBounds(FALLBACK_BOUNDS);
        return;
      }
      const t = (GROUND_Y - cam.position.y) / dir.y;
      points.push(cam.position.clone().addScaledVector(dir, t));
    }

    const [tl, tr, bl, br] = points;
    const bounds: ArenaBounds = {
      minX: Math.max(tl.x, bl.x) + ARENA_MARGIN,
      maxX: Math.min(tr.x, br.x) - ARENA_MARGIN,
      minZ: Math.max(tl.z, tr.z) + ARENA_MARGIN,
      maxZ: Math.min(bl.z, br.z) - ARENA_MARGIN,
    };

    if (
      !Number.isFinite(bounds.minX) ||
      !Number.isFinite(bounds.maxZ) ||
      bounds.maxX - bounds.minX < MIN_ARENA_SPAN ||
      bounds.maxZ - bounds.minZ < MIN_ARENA_SPAN
    ) {
      this._applyBounds(FALLBACK_BOUNDS);
      return;
    }
    this._applyBounds(bounds);
  }

  private _applyBounds(bounds: ArenaBounds): void {
    this._bounds = bounds;
    this._physics.setBounds(bounds);
  }
}
