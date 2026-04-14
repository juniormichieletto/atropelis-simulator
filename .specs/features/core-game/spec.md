# Feature Spec: Core Gameplay & Menu System

## Requirements

### R1: Initial Name Entry
- **R1.1:** On first load, user must provide a name/nickname.
- **R1.2:** Name must be stored in Local Storage.
- **R1.3:** If a name exists, skip entry but allow changing it from the menu.

### R2: Main Menu
- **R2.1:** **New Game:** Starts the 1-minute game loop.
- **R2.2:** **Scoreboard:** Displays high scores (Date, Name, Points) from Local Storage.
- **R2.3:** **Change Name:** Option to update the current nickname.

### R3: Game Loop
- **R3.1:** Timer starts at 1:00 and counts down to 0:00.
- **R3.2:** Game ends when timer reaches zero or user exits.
- **R3.3:** Final score is saved to Local Storage if it's a new high score or just added to history.

### R4: Driving Mechanics (GTA 1 Style)
- **R4.1:** Top-down camera view centered on the player's white car.
- **R4.2:** Desktop controls: Arrow keys or WASD for acceleration, braking, and steering.
- **R4.3:** Mobile controls: Virtual joystick or touch-based steering/acceleration.
- **R4.4:** Physics: Momentum, friction, and collision with boundaries/objects.

### R5: Entities & Scoring
- **R5.1:** **Person (Pedestrian):** +1 point on collision.
- **R5.2:** **Bike:** +2 points on collision.
- **R5.3:** **Motorcycle:** +5 points on collision.
- **R5.4:** **Other Car (Traffic):** -5 points on collision.
- **R5.5:** Entities must spawn/despawn dynamically within the city.

### R6: Responsiveness
- **R6.1:** Canvas must resize to fit the browser window (Mobile/Desktop).
- **R6.2:** UI elements must be legible and interactive on small screens.
