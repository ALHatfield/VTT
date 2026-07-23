# play-area: Environmental Effects

## Covers

- `PM5` in [.project/features/play-area.md](c:/Users/Hatty/Desktop/VTT-2/.project/features/play-area.md)
- particle and filter-driven atmosphere systems for the play-area canvas

## Purpose

Establish a reusable scene-effects pipeline for weather and environmental distortion without compromising token readability, interaction clarity, or frame rate.

## Candidate Effect Families

- rain
- snow
- drifting ash or dust
- scene haze or mist
- heat shimmer and similar displacement-style distortion

## PixiJS Patterns Used

- particle containers or emitter libraries for dense repeated sprites
- scene-level filters or displacement effects where a particle system is not enough
- per-scene presets so environmental effects are configured as authored scene state, not ad hoc runtime experiments

## Implementation Outline

### 1. Preset-Driven Weather

- start with authored presets for rain, snow, and haze
- keep the first pass constrained rather than trying to solve every cinematic effect at once

### 2. Reduced-Motion and Quality Scaling

- expose intensity and quality controls for low-end devices and accessibility needs
- treat heavy particles and distortion filters as separate quality knobs

### 3. Layer Ordering

- ensure weather stays visually behind or around tokens where appropriate
- keep chat, hover cards, and other DOM overlays readable regardless of scene atmosphere

## Performance Considerations

- particle count ceilings need to be scene-tested, not just library-tested
- displacement and filter effects should be benchmarked separately from particle emitters because they stress different parts of the pipeline
- avoid introducing environmental effects that conflict with fog readability or destroy contrast on busy maps

## Open Questions

- is PM5 limited to visual atmosphere, or should later systems let weather influence visibility or gameplay?
- which effects deserve dedicated authored scene data versus a shared preset catalog?

## Relationship To Later Phases

- `PM6` is the final point where weather, fog, LOS, and lights must be validated together in one full-scene render stack