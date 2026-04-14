# Design: Core Gameplay & Engine

## Architecture Overview
The application will be a React-based single-page app (SPA). The game logic will live within a custom `useGameLoop` hook, which drives a HTML5 Canvas.

### Components
1.  **App:** Root component, manages high-level state (User Name, Current View).
2.  **MenuView:** Main menu (New Game, Scoreboard, Settings).
3.  **NameEntryView:** Modal/overlay for nickname entry.
4.  **GameView:** The active game session, contains the Canvas and HUD.
5.  **ScoreboardView:** Displays a list of saved scores from Local Storage.
6.  **HUD:** Heads-Up Display (Timer, Score, Speedometer).
7.  **MobileControls:** Virtual joystick/buttons for mobile devices.

### Game Engine (Canvas)
- **Renderer:** Custom 2D context renderer.
- **Physics Engine:** Simple vector-based physics for the car (velocity, rotation, friction).
- **Entity Manager:** Handles spawning, movement, and collision detection for NPCs (People, Bikes, Motors, Cars).
- **Camera:** Follows the player's car, centered.

### Data Schema
- **Local Storage:**
  - `user_name`: string
  - `scores`: array of `{ date: string, name: string, points: number }`

## Art Style & Assets
- **Visuals:** Top-down, **pixel art** style (original GTA 1 aesthetic).
- **Player Car:** White rectangle with pixel-art details (headlights, roof).
- **NPCs:** Pixel-art sprites for people, bikes, motors, and cars.
- **City:** A grid-based layout with roads, sidewalks, and buildings using pixel-art tiles.

## Gray Areas / Decisions
1.  **City Layout:** Fixed map (Decided).
2.  **Mobile Controls:** On-screen buttons (D-pad/accelerator) (Decided).
3.  **Visual Style:** Pixel art (Decided).
