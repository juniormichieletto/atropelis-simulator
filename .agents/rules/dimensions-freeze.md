# Regra Estrita: Congelamento de Dimensões e Escala Visual (Design Freeze)

Esta regra é obrigatória e deve ser respeitada por qualquer agente que altere este repositório.

## Motivação
A proporção atual entre o carro do jogador, os carros rivais/multiplayer, os pedestres, motos, bicicletas e a grade do mapa (Mode 7) foi rigorosamente calibrada e aprovada pelo usuário. Qualquer alteração nessas proporções quebra a experiência visual tanto em desktop quanto em mobile (retrato e paisagem).

## Regras Obrigatórias:
1. **Nunca alterar `ENTITY_SCALE`** em `src/components/Game/Entities.ts` (deve ser 2.1).
2. **Nunca alterar a largura/altura base do carro** em `src/components/Game/PlayerCar.ts` (164px por 72px).
3. **Nunca alterar o `tileSize` (100px)** em `src/components/Game/TileMap.ts`.
4. **Nunca alterar as fórmulas de `getVisualDimensions` (`roadSpan / 284` no desktop e `canvasHeight / 450` no mobile horizontal), `focalLength`, clamping próximo `Math.max(tz, 76)`, teto `48` e parâmetros de câmera 3D** em `src/components/Game/GameCanvas.tsx`, `src/components/Game/PlayerCar.ts` e `src/components/Game/Entities.ts`.
5. Em qualquer teste de regressão, as razões de largura e altura entre carros rivais (na profundidade `tz = 82`) e o carro do jogador devem permanecer entre 0.85 e 1.00 em todas as resoluções desktop e mobile.
