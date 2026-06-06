// assets/js/servicios/sync.js
//
// ─── SYNC ADAPTER — Firebase Realtime Database ────────────────────────────────
//
// Modo Torneo en Vivo con QR.
// Firebase se carga via dynamic import (CDN ESM) solo cuando live mode se activa.
// Si Firebase falla o no hay internet, la app sigue funcionando con localStorage.
//
// Datos en Firebase (volátiles — se borran al cerrar sesión):
//   /sessions/{sessionId}/meta           — metadata de la sesión
//   /sessions/{sessionId}/snapshot       — estado al iniciar (jugadores, grupos)
//   /sessions/{sessionId}/matches/{key}  — estado dinámico de cada combate
//
// localStorage sigue siendo la única fuente de verdad del admin.
// ──────────────────────────────────────────────────────────────────────────────

let _db = null;
let _sessionId = null;
let _unsubscribe = null;

// Firebase CDN ESM (v10)
const FB_CDN = "https://www.gstatic.com/firebasejs/10.12.2";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function encodeFirebaseKey(key) {
  // Firebase keys no pueden contener: . # $ / [ ]
  return String(key).replace(/[.#$/[\]]/g, "_");
}

function generateSessionId() {
  return "WBM-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function loadFirebase() {
  if (_db) return _db;

  const { firebaseConfig } = await import("./firebase-config.js");
  if (!firebaseConfig || firebaseConfig.apiKey === "REPLACE_ME") {
    throw new Error(
      "Firebase no configurado. Pegá tu config en assets/js/servicios/firebase-config.js"
    );
  }

  const { initializeApp, getApps } = await import(`${FB_CDN}/firebase-app.js`);
  const { getDatabase } = await import(`${FB_CDN}/firebase-database.js`);

  const existingApps = getApps();
  const app = existingApps.length ? existingApps[0] : initializeApp(firebaseConfig);
  _db = getDatabase(app);
  return _db;
}

async function fb() {
  const db = await loadFirebase();
  const utils = await import(`${FB_CDN}/firebase-database.js`);
  return { db, ...utils };
}

// ─── Consultas públicas de estado ────────────────────────────────────────────

export function isLiveModeActive() {
  return _sessionId !== null;
}

export function getCurrentSessionId() {
  return _sessionId;
}

// ─── Sesión admin ─────────────────────────────────────────────────────────────

export async function createTournamentSession(appState) {
  try {
    const { db, ref, set } = await fb();
    const sessionId = generateSessionId();

    const matchesMap = {};
    (appState.groups || []).forEach((g) => {
      (g.matches || []).forEach((m) => {
        const key = encodeFirebaseKey(m.id);
        matchesMap[key] = {
          matchId: m.id,
          groupId: g.id,
          groupName: g.name,
          aId: m.a.id,
          aName: m.a.name,
          bId: m.b.id,
          bName: m.b.name,
          aScore: Number(m.a.score ?? 0),
          bScore: Number(m.b.score ?? 0),
          status: m.status ?? "pending",
          judgeId: null,
          judgeName: null,
          lockedAt: null,
          completedAt: null,
          updatedAt: Date.now(),
          source: "admin",
        };
      });
    });

    await set(ref(db, `sessions/${sessionId}/meta`), {
      createdAt: Date.now(),
      status: "active",
    });

    await set(ref(db, `sessions/${sessionId}/snapshot`), {
      phase: appState.phase,
      players: (appState.players || []).map((p) => ({
        id: p.id,
        name: p.name,
        group: p.group,
      })),
      groups: (appState.groups || []).map((g) => ({
        id: g.id,
        name: g.name,
        players: (g.players || []).map((p) => ({ id: p.id, name: p.name })),
      })),
    });

    await set(ref(db, `sessions/${sessionId}/matches`), matchesMap);

    _sessionId = sessionId;
    return { ok: true, sessionId };
  } catch (err) {
    console.error("[sync] createTournamentSession:", err);
    return { ok: false, reason: err.message };
  }
}

export async function getTournamentSession() {
  if (!_sessionId) return null;
  try {
    const { db, ref, get } = await fb();
    const snap = await get(ref(db, `sessions/${_sessionId}/meta`));
    return snap.exists() ? { sessionId: _sessionId, ...snap.val() } : null;
  } catch {
    return null;
  }
}

export async function publishTournamentState(appState) {
  if (!_sessionId) return { ok: false, reason: "no_session" };
  try {
    const { db, ref, set } = await fb();
    const matchesMap = {};
    (appState.groups || []).forEach((g) => {
      (g.matches || []).forEach((m) => {
        const key = encodeFirebaseKey(m.id);
        matchesMap[key] = {
          matchId: m.id,
          groupId: g.id,
          groupName: g.name,
          aScore: Number(m.a.score ?? 0),
          bScore: Number(m.b.score ?? 0),
          status: m.status ?? "pending",
          judgeId: m.judgeId ?? null,
          judgeName: m.judgeName ?? null,
          updatedAt: Date.now(),
          source: m.source ?? "admin",
        };
      });
    });
    await set(ref(db, `sessions/${_sessionId}/matches`), matchesMap);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

export function subscribeToTournamentState(callback) {
  if (!_sessionId) return () => {};
  let unsub = () => {};

  fb()
    .then(({ db, ref, onValue }) => {
      const unsubFn = onValue(
        ref(db, `sessions/${_sessionId}/matches`),
        (snapshot) => {
          callback(snapshot.exists() ? snapshot.val() : {});
        }
      );
      unsub = unsubFn;
      _unsubscribe = unsubFn;
    })
    .catch((err) => console.error("[sync] subscribe:", err));

  return () => unsub();
}

export async function refreshTournamentState() {
  if (!_sessionId) return { ok: false, reason: "no_session" };
  try {
    const { db, ref, get } = await fb();
    const snap = await get(ref(db, `sessions/${_sessionId}/matches`));
    return { ok: true, data: snap.exists() ? snap.val() : {} };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

export async function closeTournamentSession() {
  if (!_sessionId) return { ok: false, reason: "no_session" };
  try {
    const { db, ref, remove } = await fb();
    if (_unsubscribe) {
      _unsubscribe();
      _unsubscribe = null;
    }
    await remove(ref(db, `sessions/${_sessionId}`));
    _sessionId = null;
    return { ok: true };
  } catch (err) {
    _sessionId = null;
    return { ok: false, reason: err.message };
  }
}

// ─── Match updates desde admin ────────────────────────────────────────────────

export async function syncMatchUpdate(matchId, match) {
  if (!_sessionId) return;
  try {
    const { db, ref, update } = await fb();
    const key = encodeFirebaseKey(matchId);
    await update(ref(db, `sessions/${_sessionId}/matches/${key}`), {
      aScore: Number(match.a?.score ?? 0),
      bScore: Number(match.b?.score ?? 0),
      status: "corrected_by_admin",
      source: "admin",
      updatedAt: Date.now(),
      judgeId: null,
      judgeName: null,
    });
  } catch (err) {
    console.warn("[sync] syncMatchUpdate:", err.message);
  }
}

// ─── Match judging (admin-side stubs, para compatibilidad) ────────────────────

export async function claimMatchForJudge(matchId, judge) {
  if (!_sessionId) return { ok: false, reason: "no_session" };
  try {
    const { db, ref, runTransaction } = await fb();
    const key = encodeFirebaseKey(matchId);
    const result = await runTransaction(
      ref(db, `sessions/${_sessionId}/matches/${key}`),
      (current) => {
        if (!current || current.status !== "pending") return;
        return {
          ...current,
          status: "in_progress",
          judgeId: judge.judgeId,
          judgeName: judge.judgeName,
          lockedAt: Date.now(),
          updatedAt: Date.now(),
        };
      }
    );
    if (!result.committed) return { ok: false, reason: "match_not_available" };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

export async function releaseMatchFromJudge(matchId) {
  if (!_sessionId) return { ok: false, reason: "no_session" };
  try {
    const { db, ref, update } = await fb();
    const key = encodeFirebaseKey(matchId);
    await update(ref(db, `sessions/${_sessionId}/matches/${key}`), {
      status: "pending",
      judgeId: null,
      judgeName: null,
      lockedAt: null,
      updatedAt: Date.now(),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

export async function updateMatchResult(matchId, scores) {
  if (!_sessionId) return { ok: false, reason: "no_session" };
  try {
    const { db, ref, update } = await fb();
    const key = encodeFirebaseKey(matchId);
    await update(ref(db, `sessions/${_sessionId}/matches/${key}`), {
      aScore: Number(scores.aScore ?? 0),
      bScore: Number(scores.bScore ?? 0),
      updatedAt: Date.now(),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

export async function completeJudgeMatch(matchId) {
  return { ok: false, reason: "use_submitMatchResultAsJudge" };
}

// ─── QR / Judge access ────────────────────────────────────────────────────────

export function createJudgeQrPayload() {
  if (!_sessionId) return null;
  const url = getJudgeAccessUrl();
  return { sessionId: _sessionId, url };
}

export function getJudgeAccessUrl() {
  if (!_sessionId) return null;
  const base = window.location.origin + window.location.pathname;
  return `${base}?mode=judge&session=${_sessionId}`;
}

export function openJudgeMode() {
  const url = getJudgeAccessUrl();
  if (url) window.open(url, "_blank");
}

// ─── Judge-side: cargar sesión ────────────────────────────────────────────────

export async function loadSessionForJudge(sessionId) {
  try {
    const { db, ref, get } = await fb();
    const [metaSnap, snapSnap, matchesSnap] = await Promise.all([
      get(ref(db, `sessions/${sessionId}/meta`)),
      get(ref(db, `sessions/${sessionId}/snapshot`)),
      get(ref(db, `sessions/${sessionId}/matches`)),
    ]);

    if (!metaSnap.exists()) return { ok: false, reason: "session_not_found" };

    return {
      ok: true,
      meta: metaSnap.val(),
      snapshot: snapSnap.exists() ? snapSnap.val() : null,
      matches: matchesSnap.exists() ? matchesSnap.val() : {},
    };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

export async function subscribeToMatchesForJudge(sessionId, callback) {
  try {
    const { db, ref, onValue } = await fb();
    const unsubFn = onValue(
      ref(db, `sessions/${sessionId}/matches`),
      (snapshot) => {
        callback(snapshot.exists() ? snapshot.val() : {});
      }
    );
    return unsubFn;
  } catch (err) {
    console.error("[sync] subscribeToMatchesForJudge:", err);
    return () => {};
  }
}

export async function claimMatchAsJudge(sessionId, matchId, judge) {
  try {
    const { db, ref, runTransaction } = await fb();
    const key = encodeFirebaseKey(matchId);
    const result = await runTransaction(
      ref(db, `sessions/${sessionId}/matches/${key}`),
      (current) => {
        if (!current || current.status !== "pending") return;
        return {
          ...current,
          status: "in_progress",
          judgeId: judge.judgeId,
          judgeName: judge.judgeName,
          lockedAt: Date.now(),
          updatedAt: Date.now(),
        };
      }
    );
    if (!result.committed) return { ok: false, reason: "match_not_available" };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

export async function releaseMatchAsJudge(sessionId, matchId, judgeId) {
  try {
    const { db, ref, runTransaction } = await fb();
    const key = encodeFirebaseKey(matchId);
    const result = await runTransaction(
      ref(db, `sessions/${sessionId}/matches/${key}`),
      (current) => {
        if (!current || current.judgeId !== judgeId) return;
        return {
          ...current,
          status: "pending",
          judgeId: null,
          judgeName: null,
          lockedAt: null,
          updatedAt: Date.now(),
        };
      }
    );
    return { ok: result.committed };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

export async function submitMatchResultAsJudge(sessionId, matchId, scores, judgeId) {
  try {
    const { db, ref, runTransaction } = await fb();
    const key = encodeFirebaseKey(matchId);
    const result = await runTransaction(
      ref(db, `sessions/${sessionId}/matches/${key}`),
      (current) => {
        if (!current || current.judgeId !== judgeId) return;
        return {
          ...current,
          status: "completed",
          aScore: Number(scores.aScore ?? 0),
          bScore: Number(scores.bScore ?? 0),
          completedAt: Date.now(),
          updatedAt: Date.now(),
          source: "judge",
        };
      }
    );
    if (!result.committed) return { ok: false, reason: "not_your_match" };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}
