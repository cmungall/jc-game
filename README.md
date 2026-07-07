# Jasper & Clementine Go Mental

A mobile-friendly arcade game. Monsters are boiling up out of the **River Tay** and
marching on **Dundee** — pick your hero and hurl treats to drive them back before the
city falls.

## Play

Open `index.html` in any modern browser (desktop or mobile). No build step, no
dependencies — it's plain HTML/CSS/JS on a `<canvas>`.

Or serve it locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## How to play

1. **Choose a hero:**
   - **Jasper** — fast, single-shot rapid fire.
   - **Clementine** — slower, heavy three-way splash shots.
2. **Drag** anywhere to move along the Dundee shore. Your hero fires automatically.
3. **Catch the marmalade jar** 🍊 — monsters sometimes drop a jar of Dundee marmalade
   that drifts down. Grab it to go into a temporary **marmalade boost**: faster fire,
   bigger shots, and a chunk of SPECIAL. Krakens always drop one.
4. **Blast the giant Irn-Bru can** 🥫 — every hit fizzes out a splash of Irn-Bru that
   restores a little of Dundee's health, with a bigger top-up when you burst it.
5. **Don't sink the Taymara boat** ⛵ — it sails *across* the river from one side to the
   other. Since you auto-fire straight up, slide aside to let it pass (it can take a
   couple of stray knocks, shown by its heart meter, but too many and it sinks). If it
   makes it across, a pod of **Tay dolphins** leaps out and pelts the monsters with fish
   for a few seconds before swimming off.
6. **Tap** to unleash your **SPECIAL** mega-blast once the meter is full (killing
   monsters — especially the Kraken — fills it).
7. Don't let monsters reach the city — every one that lands chips away at Dundee's
   health. When it hits zero, Dundee falls.

### Dundee landmarks

The waterfront is watched over by real Dundee sights: the **Tay Bridge**, **The Law**
(with its war memorial), the **RRS Discovery**, **Caird Hall**, **V&A Dundee**, and
**Cox's Stack**.

Survive escalating waves and beat your best score (saved locally).

Desktop controls: arrow keys / `A`,`D` to move, `Space` for special, `P` to pause.

## Enemies

| Monster | Trait |
| ------- | ----- |
| Blob    | Weak, common cannon fodder |
| Eel     | Fast and wiggly |
| Crab    | Tougher, takes several hits |
| Kraken  | Boss — huge, slow, tanky, big reward |

## Files

- `index.html` — markup, HUD and menus
- `style.css` — layout and responsive styling
- `game.js` — game loop, rendering, and logic
