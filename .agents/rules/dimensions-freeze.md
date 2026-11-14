# Regra Estrita: Congelamento de Dimensões e Escala Visual (Design Freeze)

Esta regra é obrigatória e deve ser respeitada por qualquer agente que altere este repositório.

## Motivação
A proporção atual entre o carro do jogador, os carros rivais/multiplayer, os pedestres, motos, bicicletas e a grade do mapa (Mode 7) foi rigorosamente calibrada e aprovada pelo usuário. Qualquer alteração nessas proporções quebra a experiência visual tanto em desktop quanto em mobile (retrato e paisagem).

## Regras Obrigatórias:
1. **Nunca alterar `ENTITY_SCALE`** em `src/components/Game/Entities.ts` (deve ser 2.1).
2. **Nunca alterar a largura/altura base do carro** em `src/components/Game/PlayerCar.ts` (164px por 72px).
3. **Nunca alterar o `tileSize` (100px)** em `src/components/Game/TileMap.ts`.
4. **Nunca alterar as fórmulas de `carScale`, `focalLength` e parâmetros de câmera 3D** em `src/components/Game/GameCanvas.tsx` e `src/components/Game/PlayerCar.ts`.
5. Em qualquer teste de regressão, a razão de largura entre carros rivais e o carro do jogador deve permanecer entre 0.85 e 1.20.
