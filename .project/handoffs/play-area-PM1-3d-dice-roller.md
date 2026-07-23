# Handoff — Dice Roller

Current state and known issues for the four main subsystems a new developer needs to understand. The throwing arc animation is explicitly excluded — that area is slated for a full rework and is not described here.

---

## 1. Three.js Canvas

### What exists

`src/renderer/scene.js` owns a `SceneManager` class that is instantiated once in `src/main.js` and passed into the UI modules. It manages:

- A `WebGLRenderer` with `alpha: true` (transparent background so the page background shows through).
- A `PerspectiveCamera` at `(0, 28, 10)` looking at the origin. Orbit controls are enabled (rotate + zoom, pan disabled).
- Two lights: an `AmbientLight` at 0.7 intensity and a `DirectionalLight` at `(5, 10, 7)`.
- A `ResizeObserver` that calls `_onResize()` to keep the renderer and camera aspect ratio in sync with the canvas element.
- A single `requestAnimationFrame` loop (`_loop`) that drives orbit controls, shake animation, throw/settle animation, and normal idle rendering.

The canvas element is `<canvas id="dice-canvas">` in `index.html`. Two custom DOM events are dispatched on it:

| Event | Payload (`detail`) | Meaning |
|---|---|---|
| `settled` | `RollResult` | Single-die roll animation finished |
| `allSettled` | `RollResult[]` | All dice in a multi-die roll have settled |

### Known state / gaps

- The canvas does not respond to `pointer-events` when a roll animation is in progress. There is no guard preventing the user from re-rolling mid-animation; the roll button is manually disabled in the UI layer after each roll and re-enabled on `allSettled`/`settled`.
- `_onResize` must be called manually after any layout change that alters the canvas's CSS size (e.g. a panel collapsing). Currently this is handled only by the `ResizeObserver`.
- Camera position is hardcoded. There is no way to reset the camera from the UI after the user has orbited.

---

## 2. Preset Dice

### What exists

Standard D&D presets (d4, d6, d8, d10, d12, d20, d100) are defined as hardcoded `DiceDefinition` objects in `src/main.js`. They are instantiated on `DOMContentLoaded` and passed into both the designer panel and the multi-roller as the initial die set.

`src/ui/designer.js` renders each preset as a button in `#preset-dice-list`. Clicking a preset button:
1. Calls `setDie(def)` on the `SceneManager` — swaps the rendered geometry.
2. Populates the designer form fields so the user can inspect or modify the preset.

Preset dice are **not** written to `localStorage`. They are recreated from code on every page load. Custom dice (saved from the designer) are stored separately under `localStorage['DICE_CUSTOM_SETS']`.

The d10 and d100 are special cases in `src/renderer/diceGeometry.js`: they use a custom `BufferGeometry` built from kite-shaped faces rather than one of Three.js's built-in polyhedra.

### Known state / gaps

- There is no "reset to default" for a preset that has been edited in the designer — closing and reopening the page is the only recovery path.
- d100 is rendered as a pentagonal trapezohedron (same shape as d10, scaled). There is no dedicated d100 geometry with 100 faces.
- Adding a new preset requires editing `src/main.js` directly; there is no data-driven preset registry.

---

## 3. Multi-Roll and Dice Pool

### What exists

**Engine (`src/engine/rng.js`)**: `rollMulti(dice: DiceDefinition[]): RollResult[]` — maps `roll()` over an array of dice, returning one result per die. No side effects.

**UI (`src/ui/multiRoller.js`)**: `init({ addEntry, sceneManager })` wires the pool panel. Key state:

```
pool[]           — DiceDefinition objects currently in the pool (mutable)
lastRolledPool[] — snapshot of pool at the moment Roll was triggered
```

Pool chips are rendered in `#multi-dice-tray`. Each chip has a label and an `×` remove button. The tray also accepts clicks from outside (the preset/saved-die buttons call `addToPool(die)` which is returned from `init()`).

The **Roll** button (`#multi-roll-btn`) orchestrates the sequence:

1. `mousedown` / `touchstart` → calls `sceneManager.shakePool([...pool])` (visual feedback).
2. `mouseup` / `touchend` → calls `rollMulti`, then `sceneManager.animateMultiRoll(pairs)`, disables the button.
3. Canvas fires `allSettled` → UI re-enables the button, writes all results to history, updates `#multi-roll-result`.

The **Reset** button clears `pool`, `lastRolledPool`, and the result display; calls `renderPool()` which shows the hint text and calls `sceneManager.previewPool([])` to restore the single-die view.

### Known state / gaps

- There is no maximum pool size enforced in the UI. The renderer has 8 pre-defined `RELEASE_POSITIONS`; any die beyond index 7 wraps around with `% 8`, so dice can overlap on large pools.
- `rollBtn.disabled` is set to `false` after `allSettled` only if `pool.length > 0`. If the user resets the pool while a roll is in flight, `throwInProgress` remains `true` but the button is never re-enabled because `pool.length === 0` at settlement time. A page reload is required to recover.
- The aggregate total in `formatDisplay` uses `parseInt` — non-numeric face labels (e.g. a custom die with labels like "Hit"/"Miss") contribute 0 to the total without any warning.
- Removing a die from the pool mid-animation does nothing to the active animation; the animation and `lastRolledPool` continue using the snapshot taken at roll time.

---

## 4. Shake Pool

### What exists

`SceneManager.shakePool(dice)` is called when the Roll button is held. It:

1. Cancels any in-progress animation.
2. Hides the main single-die mesh.
3. Creates one `createDieMesh` per die, places each at a `throwStartForIndex(i)` position (off to the right of the scene, roughly `(12, 3, 6)` staggered).
4. Sets a random initial Euler rotation on each mesh.
5. Sets `_isShaking = true` and starts a `setInterval` at 150 ms that randomises each mesh's rotation.

Inside `_loop`, while `_isShaking` is true, each mesh is additionally rotated by its `_shakeAngVels[i]` vector scaled by `delta`, giving a continuous spin between the interval ticks.

When the Roll button is released (`mouseup`/`touchend`), `_isShaking` is set to `false` in the UI layer before `doRoll()` is called. `animateMultiRoll` then calls `_cancelAllAnimations()` and `_clearMultiMeshes()`, which clears the interval and removes the shake meshes before building the throw animation states.

If the button is released outside the element (`mouseleave` while `isShaking` is true), the UI calls `sceneManager.previewPool([...pool])` instead of rolling, which also clears the shake state.

### Known state / gaps

- The `setInterval` handle is stored in `_shakeTickInterval`. If `shakePool` is called again before the previous interval is cleared (e.g. rapid re-press), `_clearMultiMeshes` is responsible for clearing it. Verify `_clearMultiMeshes` always calls `clearInterval(_shakeTickInterval)` — currently it does, but this is a fragile pattern.
- Shake meshes are placed at `throwStartForIndex(i)` — off to the right edge of the default camera view. On narrow viewports or after the user has orbited the camera, the shaking dice may be partially or entirely out of frame.
- There is no haptic feedback on mobile. The `touchstart`/`touchend` path calls the same visual shake but there is no `navigator.vibrate` call.
- The 150 ms rotation-randomiser interval and the per-frame angular velocity spin run simultaneously. The interval snap-rotates the die to a fully random orientation, overriding the smooth spin from `_loop`. This is intentional for a "rattling cup" feel but can look choppy on low-refresh displays.

---

## File Quick-Reference

| File | Responsibility |
|---|---|
| `src/renderer/scene.js` | `SceneManager`: canvas setup, animation loop, shake, preview, multi-roll, settle detection |
| `src/renderer/diceGeometry.js` | Geometry + face-label textures for all die types; `quaternionForFace` utility |
| `src/renderer/physics.js` | `PhysicsWorld` wrapper around cannon-es; collider factories per die type |
| `src/engine/dice.js` | `DiceDefinition` model and validation |
| `src/engine/rng.js` | `roll()`, `rollMulti()`, weighted RNG |
| `src/ui/designer.js` | Preset buttons, designer form, localStorage save/load |
| `src/ui/multiRoller.js` | Pool chip tray, Roll/Reset buttons, `addToPool` export |
| `src/ui/history.js` | Roll log entries, statistics bar chart |
| `src/main.js` | Entry point — wires all modules; defines preset `DiceDefinition` objects |
