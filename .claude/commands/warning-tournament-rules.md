# Warning Tournament Rules

Quick reference for all business rules of Warning BeyManager. Invoke this before touching scoring, ranking, ghost, or knockout logic.

---

## Points System

| Symbol | Name | Field in `state.players[]` | Description |
|--------|------|--------------------------|-------------|
| PL | Puntos de Liga | `p.points` | League points: Win=3, Loss=1, Draw=0 |
| PT | Puntos Totales | `p.pf` | Points scored by this player across all matches |
| PC | Puntos en Contra | `p.pc` | Points received from opponents |
| WIN | Victorias | `p.wins` | Number of match victories |

Win threshold (group matches): **4 points** (`WIN_THRESHOLD = 4` inside `adjustScore()` in `dominio/grupos.js`).
Score ceiling: **6** (`MAX_SCORE = 6`). If opponent has 4+, you can only reach 3 (`LOSER_MAX = 3`).

Win threshold (knockout): **4 points** (`TARGET = 4` in `dominio/eliminatorias.js:5`).

---

## Ranking Order

1. Higher PL
2. Higher PT
3. Lower PC
4. Higher WIN
5. Name ascending — Spanish locale (`localeCompare("es")`) — **stable technical tiebreaker, do not change**

Implemented in: `dominio/ranking.js:82-96`, `dominio/eliminatorias.js:44-50`.

Stats are fully recalculated from match data on every change (`recalcularStatsGlobales()` in `dominio/grupos.js:278`). Never cache partial stats.

---

## Draw / Empate

`DRAW_PL = 0` is defined in `dominio/grupos.js:10`. A draw occurs when `aScore === bScore` — both players get 0 PL.

**Draws are a code edge case, not a tournament rule.** They can only happen if the operator manually leaves both scores equal without either reaching 4. No draw button exists in the UI. Do not add draw logic without explicit approval.

---

## Ghost Player Rules

A ghost occupies an empty match slot in smaller groups. It may show a real player's name from another group for display purposes, but it is NOT a real competitor.

### Who gets stats?

| Party | Gets stats? | Why |
|-------|------------|-----|
| Real player who **plays against** the ghost | ✅ Yes — full PL/PT/PC/WIN | Normal match logic applies |
| Ghost slot itself | ❌ No | Excluded by `!b.isGhost` guard (`grupos.js:305`) |
| Source player whose name was borrowed (`ghostOf`) | ❌ No | `ghostOf` is stored but never written back to `state.players` |

### Mandatory rules (currently upheld)

- Ghost never appears in global ranking or knockout cut (not in `state.players`)
- Ghost source is never from the same group (`buildExternalPoolFromLocalGroups()` at `grupos.js:107`)
- Same source player not reused per generation (`usedGhostSources` Set at `grupos.js:141`)
- Ghost IDs use `GHOST_` prefix — no collision with numeric real player IDs

### Current ghost object structure

```js
{
  id: "GHOST_{groupName}_{byeSlotId}",
  name: "{sourceName} (F)",
  score: 0,
  isGhost: true,
  ghostOf: sourcePlayer.id   // numeric ID of source player
  // MISSING: sourceGroupId, targetGroupId
}
```

`sourceGroupId` and `targetGroupId` are required by business rules but not yet implemented. Adding them is additive — plan this before any refactor of ghost generation.

---

## Knockout Rules

- Generated from global ranking via `startKnockout()` in `dominio/eliminatorias.js`
- Ghosts never enter — they are not in `state.players`
- Cut sizes: powers of 2 up to player count (Top 4, 8, 16, 32 — when player count allows)
- Seeding: seed 1 vs last, seed 2 vs second-last, etc. — `seedOrder()` in `eliminatorias.js:16`
- Semifinals generate FINAL + THIRD PLACE match (`isFinales` round, `advanceRound()` at `eliminatorias.js:276`)
- Do not change seeding behavior without explicit approval

HTML shows Top 2/4/8 by default, but `syncTopSelectOptions()` overrides dynamically at runtime.

---

## Known Bugs — Do Not Refactor Affected Modules Until Resolved

| ID | Description | Location |
|----|-------------|----------|
| ~~B1~~ ✅ | ~~`TARGET = 6` unused~~ — **Resuelto FASE 3**, eliminado de `grupos.js` | — |
| ~~B2~~ ✅ | ~~`renderGlobalStandings()` sin DOM target~~ — **Resuelto FASE 3**, función y callers eliminados | — |
| B3 | Ghost object missing `sourceGroupId` and `targetGroupId` | `dominio/grupos.js:125-134` |

---

## Project Boundary Reminder

Warning BeyManager ≠ Portal Warning.

Never add: login, backend, persistent rankings, player history, public spectator mode, or Portal Warning logic.

Firebase (if authorized in the future) = temporary sync layer for the active tournament only.
