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

## Full Flow: Modo Torneo en Vivo con QR

```
Admin PC                          Judge Phone (via QR)
─────────────────────────────     ──────────────────────────────────
1. Registra jugadores
2. Genera grupos + fixtures
3. [Live mode] Muestra QR  ──→  4. Juez escanea QR
                                 5. Entra a vista de juez
                                 6. Ve cards de grupos
                                 7. Toca un grupo
                                 8. Ve lista de combates con estados
                                 9. Toca "Tomar combate" en uno PENDING
10. Admin ve combate → IN_PROGRESS
                                10. Combate queda bloqueado para otros
                                11. Juez ingresa puntos
                                    (misma lógica: 4 pts, caps actuales)
                                12. Juez guarda resultado → COMPLETED
13. Admin ve resultado actualizado
    en tabla de grupo + ranking
14. Admin puede corregir
    (sets status = corrected_by_admin)
15. Fin del torneo: admin cierra
    sesión, Firebase descarta datos
```

---

## Two Roles (not implemented yet)

**Admin** — usa la pantalla principal (PC):
- Crea torneo, registra jugadores, genera grupos
- Muestra QR para jueces
- Ve todos los combates y sus estados
- Corrige resultados, sobreescribe combates bloqueados
- Inicia eliminatoria, finaliza torneo

**Judge** — usa celular tras escanear QR:
- Ve grupos y combates pendientes
- Toma un combate (lo bloquea)
- Ingresa puntos con la misma lógica actual
- Envía resultado
- No puede modificar jugadores, grupos, ni iniciar eliminatoria

---

## Match Status Lifecycle

```
pending → in_progress → completed → (locked) → corrected_by_admin
```

| Status | Quién lo setea | Significado |
|--------|---------------|-------------|
| `pending` | Sistema al crear | Disponible para ser tomado |
| `in_progress` | Juez al tomar combate | Bloqueado para otros jueces |
| `completed` | Juez al guardar | Resultado final del juez |
| `locked` | Sistema opcional | Admin bloqueó edición por juez |
| `corrected_by_admin` | Admin al corregir | Admin sobreescribió el resultado |

**Backward compatibility:** Matches sin campo `status` (guardados antes de FASE 10) deben tratarse como `pending`. El código que lea `status` debe usar `m.status ?? "pending"`.

---

## Match Object Structure (current + future fields)

Campos actuales de negocio (no cambiar):
```js
{
  id, round, type,
  a: { id, name, score, isGhost, ... },
  b: { id, name, score, isGhost, ... },
  winner, meta
}
```

Campos aditivos de FASE 10 (todos opcionales para código existente):
```js
{
  status: "pending",          // pending | in_progress | completed | locked | corrected_by_admin
  judgeId: null,              // string | null — ID del juez que tomó el combate
  judgeName: null,            // string | null — nombre legible del juez
  lockedAt: null,             // ISO timestamp | null — cuándo se bloqueó
  completedAt: null,          // ISO timestamp | null — cuándo se completó
  updatedAt: null,            // ISO timestamp | null — última modificación
  source: "admin",            // "admin" | "judge" — quién ingresó el resultado
}
```

---

## Sync Adapter: `assets/js/servicios/sync.js` (FASE 10 ✅)

Archivo creado como stub no-op. Ninguna función hace llamadas reales.

| Función | Propósito futuro |
|---------|-----------------|
| `createTournamentSession()` | Admin inicia sesión live, Firebase crea nodo |
| `getTournamentSession()` | Obtiene metadata de la sesión activa |
| `publishTournamentState(state)` | Empuja snapshot completo del state |
| `subscribeToTournamentState(cb)` | Escucha cambios remotos (onValue) |
| `refreshTournamentState()` | Pull manual del estado (admin o juez) |
| `closeTournamentSession()` | Cierra sesión y descarta datos de Firebase |
| `claimMatchForJudge(matchId, judge)` | Transacción atómica → status = in_progress |
| `releaseMatchFromJudge(matchId)` | Reset → status = pending |
| `updateMatchResult(matchId, scores)` | Juez envía puntajes |
| `completeJudgeMatch(matchId)` | Juez finaliza → status = completed |
| `createJudgeQrPayload()` | Devuelve `{ sessionId, url }` para renderizar QR |
| `getJudgeAccessUrl()` | URL de entrada del juez |
| `openJudgeMode()` | Entrada a la vista de juez |

Para reemplazar un stub con Firebase real: solo cambiar el cuerpo de la función. La firma pública no cambia.

---

## What to Prepare Now (Without Firebase)

### ✅ Done in FASE 10

1. `assets/js/servicios/sync.js` creado — stub completo, sin Firebase, sin deps
2. Campos `status`, `judgeId`, `judgeName`, `lockedAt`, `completedAt`, `updatedAt`, `source` agregados a todos los matches nuevos en `grupos.js` y `eliminatorias.js`
3. Esta documentación actualizada

### Still needed (not yet done)

4. Vista de juez — HTML/JS minimal, mobile-first (FASE 12)
5. Panel QR en pantalla admin (FASE 12)
6. Indicadores de `status` en `renderGroups()` para pantalla admin (FASE 12)
7. Reemplazar stubs de `sync.js` con Firebase real (FASE 12, requiere autorización)

---

## Future API Surface (names only — do not implement)

When Firebase authorization is given, these will be thin wrappers:

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

## What FASE 12 Would Require

1. Firebase project setup (explicit authorization required)
2. Firebase Realtime Database config (stored securely, NOT in repo)
3. Implementar cuerpos de funciones en `sync.js`
4. Vista HTML/JS de juez (`assets/judge/index.html`) — mobile-first, sin framework
5. Panel de QR en pantalla admin
6. Indicadores visuales de `status` en `renderGroups()` para admin
7. `claimMatchForJudge()` usando Firebase transaction (atomic lock)
8. Reconciliación de estado al reconectar (juez o admin que vuelve)
9. `correctMatchByAdmin()` con sobreescritura segura de match locked

---

## Verification After Any "Prep" Work

- `index.html` has no new external `<script>` tags
- No Firebase package appears in any `import` statement
- App works fully offline (open `index.html` with no internet connection)
- `localStorage` is still the sole persistence mechanism
- No credentials or API keys appear anywhere in the codebase
- GitHub Pages deployment still works (static only, no server required)
- Matches without `status` field (legacy saves) are treated as `"pending"` by reading code
