# Atropelis Simulator

Atropelis Simulator is a top-down driving game inspired by the classic GTA 1. Players navigate a city in a white car, scoring points by hitting pedestrians, bikes, and motorcycles while avoiding collisions with other vehicles.

## 🚀 Vision
A high-performance, responsive browser-based simulator built with React and the Canvas API. Experience smooth top-down driving mechanics, a dynamic city environment, and competitive scoring.

## ✨ Key Features
- **GTA 1-Style Driving:** Realistic momentum, friction, and top-down camera view.
- **Dynamic Entities:** AI-controlled pedestrians (+1 pt), bikes (+2 pts), and motorcycles (+5 pts).
- **Collision Consequences:** Hitting other cars results in a point penalty (-5 pts).
- **Persistent Leaderboard:** Nicknames and high scores are saved locally for long-term competition.
- **Cross-Platform:** Full support for both desktop (keyboard) and mobile (touch/joystick) controls.
- **1-Minute Game Loop:** Quick, intense gameplay sessions.

## 🛠️ Tech Stack
- **Frontend:** React 19 (TypeScript)
- **Styling:** Vanilla CSS
- **Game Engine:** HTML5 Canvas API
- **Build Tool:** Vite
- **Persistence:** Local Storage API

## 🚦 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/atropelis-simulator.git
   ```
2. Navigate to the project directory:
   ```bash
   cd atropelis-simulator
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### Development
Start the development server:
```bash
npm run dev
```

### Build
Create a production build:
```bash
npm run build
```

### Preview
Preview the production build locally:
```bash
npm run preview
```

## 🎮 Controls
- **Desktop:**
  - `W` / `Arrow Up`: Accelerate
  - `S` / `Arrow Down`: Brake / Reverse
  - `A` / `Arrow Left`: Steer Left
  - `D` / `Arrow Right`: Steer Right
- **Mobile:**
  - Use the on-screen virtual controls for steering and acceleration.

## 📝 License
This project is for educational and entertainment purposes.
