# Project State

## Current Context
Project "Atropelis Simulator" is functionally complete with all requested features. The game is a responsive, GTA 1-inspired top-down driver.

## Recent Achievements
- **2026-04-14:** Implemented `SoundService` using Web Audio API for procedural collision sounds.
- **2026-04-14:** Enhanced Pixel Art for all entities (shading, shadows, and specific details like windows/lights).
- **2026-04-14:** Implemented 1.5x Camera Zoom for better visibility and a "closer" feel.
- **2026-04-14:** Fixed desktop movement by correcting InputManager initialization and spawn positioning.

## Decisions
- **Stack:** React + TypeScript + Canvas API (Vanilla).
- **Architecture:** Class-based game entities (`PlayerCar`, `Entity`, `EntityManager`, `TileMap`) driven by a `useGameLoop` hook.
- **Persistence:** Local Storage for `user_name` and `scores`.
- **UI:** Desktop-first menu system with mobile-responsive overlays and on-screen controls.

## Blockers
None.

## Todo
- [x] Project implementation complete.
- [ ] (Optional) Add background music.
- [ ] (Optional) Implement different city layouts or "levels".

## Technical Lessons
- Using `ctx.scale(zoom, zoom)` requires adjusting `ctx.translate` logic to keep the player centered.
- Procedural audio via `OscillatorNode` is an excellent zero-asset solution for simple game sounds.
- Input event listeners must be cleaned up in `useEffect` to avoid memory leaks and ghost inputs.
