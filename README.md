# 🍉 Fruit Ninja

A complete Fruit Ninja web game built with vanilla HTML, CSS, and JavaScript — no frameworks, no build step, no external assets. All fruit artwork is drawn procedurally on a `<canvas>`, and every sound effect is synthesized live with the Web Audio API.

## Play

Open `index.html` in any modern browser, or serve the folder:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Works with mouse and touch (mobile friendly).

## How to play

- **Swipe** (click-drag or touch-drag) across fruit to slice it.
- **Don't slice bombs** 💣 — one hit ends the game instantly.
- **Don't drop fruit** — letting 3 fruits fall unsliced ends the game.
- Slice **3+ fruits in a single swipe** for a combo bonus.
- Random **critical hits** award +5 bonus points.
- Your **best score** is saved locally between sessions.

## Features

- Realistic projectile physics with gravity, spin, and screen-size scaling
- Fruits split into two halves that tumble apart along the slice angle
- Juice splatter particles and fading splat stains on the cutting board
- 6 fruit types (watermelon, orange, apple, lemon, kiwi, peach), each with unique whole and cut-face artwork
- Bombs with burning fuses, sparks, screen shake, and an explosion flash
- Glowing blade trail that follows your swipe
- Combo, critical-hit, and score popups
- Difficulty ramps up over time (faster waves, more fruit, more bombs)
- Synthesized sound effects: swoosh, splat, throw, fuse, explosion, combo jingle, game over
- Menu and game-over screens, lives HUD, persistent best score (`localStorage`)
