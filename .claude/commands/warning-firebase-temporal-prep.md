# Warning BeyManager — Firebase Temporal Prep

Invoke before any work intended to prepare for future Firebase integration. Firebase is NOT implemented yet and must NOT be added without explicit authorization.

---

## Absolute Prohibitions (never add these)

- Firebase SDK imports (`firebase/app`, `firebase/database`, etc.)
- Firebase credentials, API keys, project IDs, or config objects in any file
- `.env` files with Firebase config
- CDN `<script>` tags for Firebase in `index.html`
- Any backend server, API routes, or server-side logic
- Login or authentication of any kind
- Persistent player history or official rankings
- Portal Warning integration or logic
- Public spectator views or player-facing pages
- Any new npm/CDN dependency without explicit approval

---

## What Firebase May Be (When Authorized)

Firebase Realtime Database as a **temporary active-tournament sync layer only**:

- Holds the state of the current active tournament in memory
- Syncs between the admin screen and judge phones in real time
- Allows judges to register match scores from their phones
- Locks a match while a judge is entering results (prevents concurrent edits)
- Discards all data when the tournament ends

Firebase is NOT a historical database, NOT a ranking system, NOT Portal Warning.

---

## Two Future Roles (not implemented yet)

**Admin** — uses the main screen:
- Creates tournament, registers players, generates groups
- Shows QR code for judges
- Corrects results, overrides locked matches
- Starts knockout, finalizes and closes tournament

**Judge** — uses phone after scanning QR:
- Sees assigned group and its pending matches
- Registers match scores
- Cannot modify players, groups, or start knockout
- Cannot override admin corrections

---

## Future Match States to Design For

```
pending → in_progress → completed → locked → corrected_by_admin
```

When refactoring match objects, including a `status: "pending"` field is additive and safe. It does not break existing logic and prepares for the future sync layer.

---

## What to Prepare Now (Without Firebase)

### 1. Add `status` field to match objects (additive, low risk)

When touching match creation in `grupos.js` or `eliminatorias.js`, add:

```js
{
  id: "...",
  round: 1,
  a: { id, name, score },
  b: { id, name, score },
  winner: null,
  status: "pending"   // pending | in_progress | completed | locked | corrected_by_admin
}
```

### 2. Create a sync adapter stub (do not wire it up yet)

When the `servicios/` layer is being organized, create `assets/js/servicios/sync.js` as an empty adapter:

```js
// Sync adapter — no-op stub. Replace internals with Firebase when authorized.
export const SyncAdapter = {
  push: async (state) => {},
  pull: async () => null,
  subscribe: (callback) => () => {},
  close: async () => {},
};
```

`saveState()` in `nucleo/estado.js` remains as-is (localStorage only). The sync adapter is a future side-effect layer, not a replacement for localStorage.

### 3. Keep domain functions pure and callable

The following functions should remain pure input/output — easy to call from any future sync handler without coupling:

- `recalcularStatsGlobales()` — takes state, returns nothing (mutates in place)
- `obtenerRankingGlobal()` — returns sorted player array
- `obtenerTopN(n)` — returns top N ranked players

Do not add DOM calls or localStorage calls inside these functions.

---

## Future API Surface (names only — do not implement)

When the Firebase authorization is given, these will be thin wrappers around the sync adapter:

```
saveTournamentState()            push current state to Firebase
loadTournamentState()            pull state from Firebase on join
updateMatchResult(matchId, a, b) update one match result and notify
recalculateTournament()          recalc ranking after remote update
createJudgeQr()                  generate QR with tournament session ID
openJudgeMode()                  initialize judge session
selectJudgeGroup(groupId)        judge picks their group
getAvailableMatchesByGroup()     returns pending matches for a group
lockMatchForJudge(matchId)       mark match as in_progress
saveJudgeMatchResult(matchId)    judge submits final result
correctMatchByAdmin(matchId)     admin overrides a locked/completed match
syncTournamentState()            full state reconciliation on reconnect
subscribeToTournamentChanges()   real-time listener for state changes
closeTournament()                finalize tournament, stop sync
deleteTemporaryTournament()      discard all Firebase data after close
```

None of these should be implemented until explicitly authorized.

---

## Verification After Any "Prep" Work

- `index.html` has no new external `<script>` tags
- No Firebase package appears in any `import` statement
- App works fully offline (open `index.html` with no internet connection)
- `localStorage` is still the sole persistence mechanism
- No credentials or API keys appear anywhere in the codebase
- GitHub Pages deployment still works (static only, no server required)
