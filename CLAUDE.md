# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

No build system, no package manager. This is a pure static site.

Open directly in a browser:
- Double-click `index.html`

Recommended local server:
```
python -m http.server
```

Alternative (requires npm):
```
npx serve .
```

No tests, no lint config, no npm scripts exist.

## Architecture

Warning BeyManager is a vanilla JS SPA. No framework, no bundler, no backend. State is persisted to `localStorage`. Entry point: `assets/js/app.js` (loaded as ES module from `index.html`).

### Layer Structure

```
assets/js/
├── app.js              # Bootstrap: imports all modules, exposes global API on window.*, initializes app
├── nucleo/             # Core
│   ├── constantes.js   # STORAGE_KEY = "bey_manager_ult_v11_9_refined"
│   ├── estado.js       # Singleton state object + save/load/reset via localStorage
│   └── almacenamiento.js # JSON export (download) and import (file upload)
├── dominio/            # Business logic — must NOT access the DOM directly
│   ├── torneo.js       # Player CRUD, group count slider, auto-rounds calculation
│   ├── grupos.js       # Round-robin fixture generation, score adjustment, stats recalc
│   ├── eliminatorias.js # Knockout bracket build, round advancement, podium resolution
│   └── ranking.js      # Global ranking recalculation utilities
├── ui/                 # Presentation — owns all DOM access and event listeners
│   ├── vistas.js       # Phase-based view switching (restoreUI, goHome, goBackStep)
│   ├── render.js       # All DOM rendering functions
│   └── eventos.js      # Keyboard and input event listener registration
└── servicios/          # Auxiliary services
    ├── audio.js        # Sound effects
    └── confeti.js      # Confetti animation and toss modal
```

### Global API Pattern (`window.*`)

`index.html` uses inline `onclick="..."` handlers. To avoid circular imports between `dominio/` and `ui/`, `app.js` exports every function to `window.*` via `exponerAPI()`. All cross-layer calls that trigger UI updates must go through `window.*` (e.g., `window.renderGroups?.()`).

Do not move functions or break this pattern without a full migration plan covering `app.js:exponerAPI()` and all inline `onclick` handlers in `index.html`.

### State Machine

`state.phase` drives which view is shown:

```
registration → groups → knockout → winner
```

`restoreUI()` in `ui/vistas.js` reads `state.phase` and shows the correct section. `goBackStep()` steps the phase backwards.

### Persistence

`localStorage` only. Key: `STORAGE_KEY = "bey_manager_ult_v11_9_refined"` (defined in `nucleo/constantes.js`).

**Never convert this to a backend or historical database.** Always call `saveState()` immediately after mutating `state`.

State shape (defined in `nucleo/estado.js`):
- `players[]` — all registered players with stats
- `groups[]` — group fixtures, match results, and player lists
- `knockoutMatches[]` / `knockoutRounds[]` — bracket data
- `phase` — current tournament phase string
- `roundsSetting`, `desiredGroupCount`, `knockoutSize`, `knockoutBracketSize`
- `winner`, `podium`

---

## Project Boundaries

Warning BeyManager is not Portal Warning.

Warning BeyManager is a free/static tournament manager intended to run on GitHub Pages. It must remain a lightweight frontend-only app for quick tournament execution.

Do not add:

* backend server;
* login;
* historical database;
* persistent official rankings;
* player history;
* public spectator mode;
* Portal Warning logic;
* Firebase implementation without explicit authorization.

Future Firebase support, if added later, must only work as a temporary synchronization layer for the active tournament. See `/warning-firebase-temporal-prep` for guardrails.

---

## Critical Business Rules

### Ranking

Ranking order — implemented in `dominio/ranking.js:82-96` and `dominio/eliminatorias.js:44-50`:

1. Higher PL.
2. Higher PT.
3. Lower PC.
4. Higher WIN.
5. **Name ascending (Spanish locale)** — stable technical tiebreaker. Do not change without explicit approval. (`ranking.js:95`, `eliminatorias.js:49`)

Where:

* PL = Puntos de Liga. Stored as `p.points`.
  * Win = 3 PL (`WIN_PL = 3`, `grupos.js:7`).
  * Loss = 1 PL (`LOSS_PL = 1`, `grupos.js:8`).
* PT = Puntos Totales (points scored by the player). Stored as `p.pf`.
* PC = Puntos en Contra (points received from opponents). Stored as `p.pc`.
* WIN = number of victories. Stored as `p.wins`.

Stats are recalculated from scratch on every score change via `recalcularStatsGlobales()` (`grupos.js:278`). Do not cache partial stats.

### Draws / Empate

The code defines `DRAW_PL = 0` (`grupos.js:10`) and handles the equal-score case (`grupos.js:325-327`), awarding 0 PL to both players.

**Draws are a code edge case, not a tournament rule.** They can only occur if the operator manually leaves both scores equal without either player reaching the win threshold (4 points). No draw button exists in the UI.

Do not introduce or modify draw behavior without explicit approval.

### Ghost Player

A ghost is a temporary match slot used when groups have unequal sizes. It may display the name of a real player from another group, but it is not a real player.

**Key rule:** The real player who faces the ghost receives full PL/PT/PC/WIN from that match. The source player (whose name was borrowed for display) receives nothing.

**Currently upheld isolation rules:**

| Rule | Code location |
|------|--------------|
| Ghost never gets PL/PT/PC/WIN | `grupos.js:305` — `const pB = !b.isGhost ? state.players.find(...) : null` |
| Source player (`ghostOf`) gets no stats from ghost match | `ghostOf` is stored but never used to write back stats |
| Ghost ID never collides with real player ID | Ghost IDs use `GHOST_` string prefix; real player IDs are numeric |
| Ghost source is never from the same group | `buildExternalPoolFromLocalGroups()` filters own group (`grupos.js:107`) |
| Same source player not reused per generation | `usedGhostSources` Set in `generateGroups()` (`grupos.js:141`) |
| Ghost never enters ranking or knockout | Ghosts are not in `state.players` |

**Current ghost object fields:** `id`, `name`, `score`, `isGhost`, `ghostOf`.

**Missing fields (not yet implemented, required by business rules):** `sourceGroupId`, `targetGroupId`. This is additive — plan before touching ghost generation logic.

Ghost ID format: `GHOST_{groupName}_{byeSlotId}`.

### Knockout

Knockout is generated from the valid global ranking (`eliminatorias.js:startKnockout()`). Ghosts are never in `state.players`, so they cannot enter the cut.

Win threshold: 4 points (`TARGET = 4` in `eliminatorias.js:5`).

Cut sizes are dynamically generated as powers of 2 up to player count (`render.js:getAllowedTopOptions()`). The HTML hardcodes `Top 2 / Top 4 / Top 8` as a fallback, but `syncTopSelectOptions()` overrides this at runtime — Top 16 and Top 32 become available when player count allows.

Seeding: seed 1 vs last, seed 2 vs second-last, etc. (`seedOrder()` in `eliminatorias.js:16`).

Semifinals produce a FINAL + THIRD PLACE match in an `isFinales` round (`advanceRound()` in `eliminatorias.js:276`).

Do not change seeding behavior without explicit approval.

---

## Known Issues — Resolve Before Refactoring

These bugs exist in the current codebase. Document and fix them in a controlled phase before refactoring the surrounding code.

### ~~B1 — Dead constant: `TARGET = 6`~~ ✅ Resuelto en FASE 3

Eliminado de `dominio/grupos.js`. El umbral de victoria activo es `WIN_THRESHOLD = 4` dentro de `adjustScore()`.

### ~~B2 — Dead render: `renderGlobalStandings()`~~ ✅ Resuelto en FASE 3

Función eliminada de `ui/render.js`. Todas las referencias limpiadas en `vistas.js`, `grupos.js`, `app.js` e `index.html`.

### ~~B3 — Ghost missing `sourceGroupId` and `targetGroupId`~~ ✅ Resuelto en FASE 6

`makeGhostOpponent()` ahora recibe y almacena `sourceGroupId` y `targetGroupId`. Ambos campos se propagan al `b` side del match. El `sourceGroupId` se resuelve en `generateGroups()` buscando el grupo del jugador fuente por nombre (`dominio/grupos.js`).

### B4 — State is a mutable singleton

Any module that imports `state` and mutates it directly bypasses `saveState()`. All mutations must be immediately followed by `saveState()`. Review on each refactor.

---

## Refactor Guardrails

Work incrementally. Use `/warning-beymanager-refactor` before starting any structural change.

Before large changes:

* explain what will be touched;
* explain why;
* identify risk;
* preserve current behavior;
* avoid changing business rules.

Do not add dependencies without approval.

Keep the app compatible with GitHub Pages.

Target: support 50+ players without visible performance degradation.

---

## Plugin Usage Guidance

Use Superpower for planning, task decomposition, context control and skill generation.

Use Front Design for visual stability, responsive behavior, tables, buttons, overflow and TV/main-screen usability.

Use Code Man or equivalent refactor tooling for dead code, duplicated logic, mixed responsibilities and event/listener issues.

Use Security as a guardrail against secrets, hardcoded credentials, unsafe Firebase setup, unnecessary dependencies and unsafe data handling.
