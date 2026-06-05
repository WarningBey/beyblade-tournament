# Warning BeyManager — Safe Refactor Checklist

Invoke before any structural change. Work incrementally — one module, one responsibility at a time.

---

## Pre-Flight Checks

Before touching any module:

1. Read `/warning-tournament-rules` — confirm business rules in scope for this change
2. Confirm the change does NOT add: login, backend, Firebase SDK, npm dependencies, Portal Warning logic
3. Identify which `window.*` calls the target module receives or makes (check `app.js:exponerAPI()`)
4. Resolve any of B1/B2/B3 that affect the target module before refactoring it (see below)
5. Confirm you know which layer the module belongs to (see layering rules)

---

## Layer Rules (enforce strictly)

| Layer | May access DOM? | May import from |
|-------|----------------|-----------------|
| `nucleo/` | No | Nothing from this project |
| `dominio/` | **No** — use `window.*` for UI triggers | `nucleo/` only |
| `ui/` | Yes | `nucleo/`, `dominio/`, `servicios/` |
| `servicios/` | No | `nucleo/` only |
| `app.js` | No | Everything (orchestrator) |

`dominio/` must never call `document.*`, `getElementById`, or any DOM API. If a domain function needs to trigger a re-render, it calls `window.renderGroups?.()` etc.

---

## `window.*` Pattern — Do Not Break

`index.html` uses inline `onclick="..."` handlers. All module functions are exposed globally via `app.js:exponerAPI()`.

Before moving or renaming any function:
- Update `exponerAPI()` in `app.js`
- Update any inline `onclick` in `index.html` that references that function
- Test all four views after the change

Do not eliminate the `window.*` pattern without a full migration plan.

---

## Known Issues — Resolve Before Refactoring Affected Modules

| Bug | Location | Action required |
|-----|----------|----------------|
| ~~B1: `TARGET = 6` unused~~ | ~~`dominio/grupos.js:5`~~ | ✅ **Resuelto FASE 3** |
| ~~B2: `renderGlobalStandings()` sin DOM target~~ | ~~`ui/render.js:425`~~ | ✅ **Resuelto FASE 3** |
| ~~B3: Ghost missing `sourceGroupId` y `targetGroupId`~~ | ~~`dominio/grupos.js`~~ | ✅ **Resuelto FASE 6** |

---

## Change Process

1. State what you will change and why
2. State the risk (what could break, what depends on it)
3. Make the smallest working change
4. Run the manual verification cycle (see below)
5. Confirm PL/PT/PC/WIN still calculate correctly
6. Report what changed

Do not batch multiple module changes into a single step.

---

## Performance Rules (50+ players target)

- Do not re-render the entire app for a single score change — update only the affected section
- Do not register event listeners inside render functions (causes listener duplication on each render)
- `eventos.js` uses `dataset.hooked` guards — extend this pattern to every new listener
- Do not compute rankings inside render functions — calculate once, pass result to renderer
- Minimize DOM operations per update
- No external network calls, no CDN dependencies, no heavy assets
- App must load and work fully offline

---

## Verification Cycle (run after every change)

Open `index.html` in a browser and complete a full tournament cycle:

1. Register 6+ players
2. Generate groups (test 2 groups and 3 groups)
3. Adjust some match scores — confirm the general table updates
4. Check that PL/PT/PC/WIN values are correct
5. Confirm no ghost appears in the general standings
6. Confirm the real player who faced the ghost has their stats updated
7. Start knockout (Top 4 or Top 8)
8. Confirm bracket seeding: 1 vs last, 2 vs second-last
9. Advance rounds to the Final
10. Confirm winner/podium screen
11. Export backup JSON, reload page, confirm state restores correctly
12. Open browser console — confirm zero errors

For larger changes, test with 20+ players and 4+ groups.

---

## Ghost-Specific Verification

After any change touching groups, fixtures, or ranking:

- Ghost names end with "(F)"
- No ghost appears in the general standings table or knockout bracket
- The real player who played against the ghost has updated PL/PT/PC/WIN
- The source player (whose name was borrowed) has unchanged stats compared to their other matches
- No `NaN` or `undefined` values in any score or stat field

---

## What Requires Explicit Approval Before Proceeding

- Changing ranking tiebreaker order (including the name-ascending final tiebreaker)
- Changing or removing draw handling
- Changing ghost isolation rules or stat attribution
- Changing seeding or bracket generation logic
- Changing the `state` schema in a way that breaks saved JSON backups
- Changing `STORAGE_KEY` (breaks all existing saves)
- Adding any external dependency (npm package, CDN link, SDK)
- Adding Firebase, login, or any backend integration
