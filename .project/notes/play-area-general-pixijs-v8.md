# play-area: PixiJS v8 Integration Gotchas

## Canvas Ownership

PixiJS v8 **must** own its canvas element. Do not pass a React-managed `<canvas>` ref to `app.init()`.

**Wrong:**
```tsx
const canvasRef = useRef<HTMLCanvasElement>(null);
await app.init({ canvas: canvasRef.current, ... });
```

**Correct:**
```tsx
const containerRef = useRef<HTMLDivElement>(null);
await app.init({ preference: 'webgl', resizeTo: containerRef.current, ... });
containerRef.current.appendChild(app.canvas);
```

Passing a React-managed canvas causes WebGL shader compilation to fail with:
`Cannot read properties of null (reading 'split')` in `logPrettyShaderError`.

## Renderer Preference

Always set `preference: 'webgl'` in `app.init()`. PixiJS v8 tries WebGPU first by default, which fails in many desktop browser/dev environments without a clear error message.

## React Strict Mode + Async Init

React Strict Mode double-invokes effects in dev (mount → cleanup → remount). If `app.destroy()` runs before `app.init()` resolves, PixiJS crashes with:
`this._cancelResize is not a function`

**Fix:** Store the init Promise and chain destroy off it:
```ts
const initPromise = manager.init(container);
return () => {
  initPromise.then(() => manager.destroy()).catch(() => {});
};
```

## destroy() API in v8

PixiJS v8 changed `Application.destroy()` signature. Use the options object form:
```ts
// PixiJS v8 — correct
app.destroy({ removeView: true });   // if Pixi owns the canvas
app.destroy({ removeView: false });  // if React owns the DOM element

// PixiJS v7 — wrong for v8
app.destroy(false, { children: true, texture: true });
```
