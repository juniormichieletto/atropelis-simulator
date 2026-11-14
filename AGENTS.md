# REGRAS DO PROJETO & DIRETRIZES DE DESIGN (ATROPELIS SIMULATOR)

> [!IMPORTANT]
> **REGRA ESTRITA: CONGELAMENTO DE DIMENSÕES E PROPORÇÕES FÍSICAS (DESIGN & DIMENSION FREEZE)**
> A configuração de escala e proporções visuais dos veículos, pedestres, mapa e câmera foi calibrada e **aprovada definitivamente pelo usuário**.
> 
> **É ESTRITAMENTE PROIBIDO alterar o tamanho dos carros, pessoas, veículos de 2 rodas, blocos do mapa ou parâmetros de câmera 3D**, independentemente de o jogo estar rodando em Desktop, Mobile Vertical ou Mobile Horizontal (Modo Paisagem).

---

## 1. Escala Mundial de Entidades (`ENTITY_SCALE`)
- Arquivo: `src/components/Game/Entities.ts`
- Constante: `export const ENTITY_SCALE = 2.1;`
- **Regra**:
  - `ENTITY_SCALE` deve permanecer fixo em `2.1`.
  - A largura e a altura de qualquer carro rival ou jogador remoto na profundidade do jogador (`tz = 82`) em relação ao carro do jogador devem manter proporção entre **0.85 e 1.00** (nunca parecer maiores que o carro do jogador, tanto em 720p quanto em 1080p/1440p).
  - Pedestres (`PERSON`) em pé devem ser visualmente mais altos que a altura do teto do carro esportivo (~1.1x a 1.4x a altura do carro).
  - Motocicletas e bicicletas devem ter comprimento proporcional realista em relação à largura do carro.
  - O teto de aproximação máxima de escala de renderização deve permanecer em `48` (`28` sem `ENTITY_SCALE` em `RemotePlayerManager.ts`) com clamping de profundidade próxima `Math.max(tz, 76)`.

## 2. Dimensões do Carro do Jogador (`PlayerCar.ts`)
- Arquivo: `src/components/Game/PlayerCar.ts`
- Dimensões base do sprite:
  - Largura base: `164px` (para-choque de `-82` a `+82`).
  - Altura base: `72px` (de `-72` a `0`).
- Fórmulas de escala responsiva (`getVisualDimensions`):
  - **Desktop (`H >= 520`)**:
    - `roadSpan`: `(canvasHeight - 92) - Math.floor(canvasHeight * 0.38)`
    - Escala: `Math.max(0.85, Math.min(canvasWidth / 900, roadSpan / 284))`
    - Posição `carBottomY`: `canvasHeight - 78`
  - **Mobile Paisagem / Telas compactas (`canvasHeight < 520`)**:
    - Escala: `Math.max(0.65, Math.min(1.0, canvasHeight / 450))`
    - Posição `carBottomY`: `canvasHeight - 52`

## 3. Câmera 3D e Projeção de Perspectiva (`GameCanvas.tsx`)
- Arquivo: `src/components/Game/GameCanvas.tsx` -> `getCameraParams`
- Parâmetros travados:
  - `camHeight = 52`
  - `baseCamDist = 82`
  - `baseHorizonY`: `Math.floor(H * (isLandscapeMobile ? 0.35 : 0.38))`
  - `carContactY`: `isLandscapeMobile ? H - 64 : H - 92`
  - `focalLength`: `Math.max(isLandscapeMobile ? 420 : 320, ((carContactY - baseHorizonY) * baseCamDist) / camHeight)`
  - Clamping de profundidade próxima na projeção e colisão: `Math.max(tz, 76)` com teto de escala `48` (`Entities.ts`, `GameCanvas.tsx`) / `28` (`RemotePlayerManager.ts`)

## 4. Escala do Mapa e Pistas (`TileMap.ts`)
- Arquivo: `src/components/Game/TileMap.ts`
- Constante: `tileSize = 100` px.
- As proporções das vias (ruas de 1 a 2 faixas com 100px a 200px de largura) e dos prédios não devem ser alteradas.

---

## 5. Qualidade de Código e Testes
- Nunca quebrar os testes automatizados de proporção física em `src/components/Game/__tests__/Entities.test.ts`.
- Manter cobertura de testes acima de 90% e zero erros de ESLint em todos os commits.
