# 🍉 Fruit Ninja

A Fruit Ninja game for the web, built with **Three.js** and vanilla JavaScript. Fruit are rendered meshes that get sliced into tumbling halves with exposed flesh cross-sections, juice sprays out and splatters the "lens," and the game uses the **authentic Fruit Ninja sound effects**.

## Play

Because it loads ES modules and audio, serve the folder over HTTP (don't open the file directly):

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open the printed URL. Works with mouse and touch.

## How to play

- **Drag** (mouse or finger) to swing your blade through the fruit.
- **Don't slice bombs** 💣 — one hit ends the game.
- **Don't drop fruit** — letting 3 fruits fall ends the game.
- Slice **3+ fruits in one swipe** for a combo bonus.
- Random **critical hits** award +5.
- Best score is saved locally.

## Features

- Rendering with Three.js: perspective camera, multi-light setup (key/warm/rim), glossy Phong-shaded fruit
- 8 fruits — watermelon, orange, apple, plum, kiwi, coconut, strawberry (with leaf), pineapple (with crown) — each with procedurally generated rind **and** flesh textures
- Fruit split into **two half-meshes** showing the cut flesh face, flying apart along the slice direction with tumble spin
- Juice droplets + juice splatter decals on the screen, fading over time
- Bombs with cap, fuse, and live spark particles; slicing one triggers an explosion, screen flash, and camera shake
- Glowing blade trail rendered on a 2D overlay
- **Authentic Fruit Ninja audio**: per-fruit slice impacts, sword swipes, splatter, throws, bomb fuse/explosion, combo stingers, game-start/over jingles, and UI sounds
- Combo banners, critical-hit and score popups, lives HUD, persistent best score
- Difficulty ramps over time (faster waves, more fruit, more bombs)

## Project layout

```
index.html          markup + screens/HUD
style.css           Fruit Ninja-style UI and logo
game.js             Three.js game (ES module)
lib/                vendored Three.js build
assets/sounds/      authentic .wav sound effects
```

## Credits

Sound effects are the original Fruit Ninja sound assets, used here for a personal/educational project. Three.js is MIT licensed.
