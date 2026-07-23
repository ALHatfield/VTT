# play-area: Line of Sight

## Covers

- `PM3` in [.project/features/play-area.md](c:/Users/Hatty/Desktop/VTT-2/.project/features/play-area.md)
- obstacle-aware visibility generation for fog and lighting systems

## Purpose

Move beyond open-circle reveals by generating visibility polygons that respect walls, corners, and obstacle boundaries. This is the CPU-side geometry step that feeds the GPU fog and lighting pipeline.

## Core Principle

Raycasting and `RenderTexture` masking are complementary, not competing, techniques:
- raycasting computes the visible polygon on the CPU
- the resulting polygon is rendered into the shared fog or light mask on the GPU

## Required Data Model Work

- scene obstacle or wall persistence must exist before this phase is practical
- the likely shared primitives are `WallSegment`, obstacle bounds, and visibility polygon types
- this needs a clear ownership decision between play-area and editor systems before implementation starts

## Implementation Outline

### 1. Segment Gathering

- collect relevant obstacle segments near the active reveal source
- do not scan the entire scene for every emitter on every update

### 2. Angle Collection

- gather angles from the source point to obstacle corners
- include tiny positive and negative angle offsets to avoid clipping at vertices

### 3. Ray Casting

- cast rays per angle
- find the nearest valid segment intersection
- cap the result to the current visibility radius when needed

### 4. Polygon Construction

- sort intersection points by angle
- build a counter-clockwise polygon
- hand that polygon to the mask rendering system instead of drawing it as an isolated overlay

## Performance Considerations

- use spatial partitioning or local obstacle buckets before ray testing
- throttle LOS recomputation rather than forcing full 60 Hz geometry updates when motion is small
- benchmark with several moving emitters and dense local obstacles, not just one actor on an empty map

## Open Questions

- where should authoritative obstacle geometry live long term?
- should observers inherit player LOS, DM LOS, or a separate visibility rule?

## Relationship To Later Phases

- `PM4` can reuse this obstacle geometry for wall-aware light clipping
- `PM6` depends on this phase to merge fog, light, and atmosphere with one coherent obstruction model