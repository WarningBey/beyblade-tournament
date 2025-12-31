// assets/js/dominio/grupos.js
import { state, saveState } from "../nucleo/estado.js";
import { SoundFX } from "../servicios/audio.js";

const TARGET = 6;

// PL (Puntos de Liga)
const WIN_PL = 3;
const LOSS_PL = 1;
const DRAW_PL = 0;

function computeMaxGroups(playerCount) {
  return Math.max(1, Math.floor(playerCount / 2));
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * ✅ Reparto BALANCEADO:
 * 12 en 2 => [6,6]
 * 13 en 2 => [7,6]
 * 25 en 4 => [7,6,6,6]
 */
function distributeBalanced(players, groupCount) {
  const total = players.length;
  const base = Math.floor(total / groupCount);
  const extra = total % groupCount;

  const groups = Array.from({ length: groupCount }, (_, i) => ({
    id: i + 1,
    name: String.fromCharCode(65 + i),
    matches: [],
    players: [],
  }));

  let idx = 0;
  for (let i = 0; i < groupCount; i++) {
    const size = base + (i < extra ? 1 : 0);
    groups[i].players = players.slice(idx, idx + size);
    idx += size;
  }

  return groups;
}

/**
 * ✅ Genera rondas round-robin (circle method)
 * - Rellena con "PAD_BYE" hasta targetSize (esto será tu FANTASMA en grupos chicos)
 * - Si queda impar, agrega "SCHED_BYE" SOLO para paridad del algoritmo (NO se convierte en fantasma)
 */
function buildRoundRobinRounds(players, { targetSize, groupId }) {
  const list = [...players];

  // 1) Relleno por diferencia de tamaño (estos SÍ deben volverse Fantasma)
  const missing = Math.max(0, (targetSize ?? list.length) - list.length);
  for (let i = 0; i < missing; i++) {
    list.push({
      id: `PAD_BYE_G${groupId}_S${i + 1}`,
      name: "BYE",
      isBye: true,
      isPadBye: true,
    });
  }

  // 2) BYE técnico para paridad (NO debe volverse Fantasma)
  if (list.length % 2 !== 0) {
    list.push({
      id: `SCHED_BYE_G${groupId}`,
      name: "BYE",
      isBye: true,
      isSchedBye: true,
    });
  }

  const n = list.length;
  const rounds = n - 1;
  const half = n / 2;

  const fixed = list[0];
  let rotating = list.slice(1);

  const out = [];
  for (let r = 0; r < rounds; r++) {
    const roundPairs = [];
    const left = [fixed, ...rotating.slice(0, half - 1)];
    const right = rotating.slice(half - 1).reverse();

    for (let i = 0; i < half; i++) {
      roundPairs.push([left[i], right[i]]);
    }

    out.push(roundPairs);

    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, rotating.length - 1)];
  }

  return out;
}

function buildExternalPoolFromLocalGroups(allGroups, currentGroupId) {
  const pool = [];
  allGroups.forEach((g) => {
    if (g.id === currentGroupId) return;
    (g.players || []).forEach((p) => {
      if (!p) return;
      if (p?.isGhost) return;
      if (p?.isBye) return;
      pool.push(p);
    });
  });
  return pool;
}

/**
 * ✅ Fantasma estable por SLOT (anti duplicados)
 * - Si el grupo chico necesita 1 fantasma, será SIEMPRE el mismo ID
 */
function makeGhostOpponent(externalPlayer, groupName, byeSlotId) {
  const nameBase = externalPlayer?.name ? externalPlayer.name : `Fantasma ${groupName}`;
  return {
    id: `GHOST_${groupName}_${byeSlotId}`,
    name: `${nameBase} (F)`,
    score: 0,
    isGhost: true,
    ghostOf: externalPlayer?.id || null,
  };
}

export function generateGroups() {
  if (state.players.length < 2) return;

  const shuffled = shuffle(state.players);

  const maxGroups = computeMaxGroups(shuffled.length);
  const desired = Number(state.desiredGroupCount || 1);
  const groupCount = Math.max(1, Math.min(desired, maxGroups));
  state.desiredGroupCount = groupCount;

  const groups = distributeBalanced(shuffled, groupCount);

  // label de grupo en player
  groups.forEach((g) => {
    g.players.forEach((p) => {
      p.group = g.name;
    });
  });

  // tamaño del grupo más grande (solo reales)
  const targetSize = Math.max(...groups.map((g) => (g.players || []).length));

  // fixtures
  groups.forEach((g) => {
    const rounds = buildRoundRobinRounds(g.players, { targetSize, groupId: g.id });
    const externalPool = buildExternalPoolFromLocalGroups(groups, g.id);
    const groupName = g.name;

    rounds.forEach((pairs, roundIndex) => {
      pairs.forEach(([a, b]) => {
        if (!a || !b) return;

        const aIsBye = !!a.isBye;
        const bIsBye = !!b.isBye;

        // BYE técnico => NO match
        if ((aIsBye && a.isSchedBye) || (bIsBye && b.isSchedBye)) return;

        // PAD_BYE => Fantasma
        if (aIsBye || bIsBye) {
          const real = aIsBye ? b : a;
          const byeSlot = aIsBye ? a : b;

          if (!byeSlot?.isPadBye) return;
          if (!real || real.isBye) return;

          const ext = pickRandom(externalPool);
          const ghost = makeGhostOpponent(ext, groupName, byeSlot.id);

          const matchId = `${g.id}-R${roundIndex + 1}-${real.id}-${ghost.id}`;

          g.matches.push({
            id: matchId,
            round: roundIndex + 1,
            a: { id: real.id, name: real.name, score: 0, isGhost: false },
            b: { id: ghost.id, name: ghost.name, score: 0, isGhost: true, ghostOf: ghost.ghostOf },
            meta: { hasGhost: true, padGhost: true, byeSlotId: byeSlot.id },
          });

          return;
        }

        // match normal
        const matchId = `${g.id}-R${roundIndex + 1}-${a.id}-${b.id}`;
        g.matches.push({
          id: matchId,
          round: roundIndex + 1,
          a: { id: a.id, name: a.name, score: 0, isGhost: false },
          b: { id: b.id, name: b.name, score: 0, isGhost: false },
          meta: { hasGhost: false },
        });
      });
    });
  });

  state.groups = groups;
  state.phase = "groups";

  recalcularStatsGlobales();

  saveState();
  window.restoreUI?.();
  SoundFX.click?.();
}

export function redistributeGroups() {
  generateGroups();
}

export function adjustScore(groupId, matchId, sideIndex, delta) {
  const g = state.groups.find((x) => x.id === Number(groupId));
  if (!g) return;

  const m = g.matches.find((x) => x.id === matchId);
  if (!m) return;

  const MAX_SCORE = 6;       // tope absoluto por match en grupos
  const WIN_THRESHOLD = 4;   // desde aquí “ya ganó” (modo KO)
  const LOSER_MAX = 3;       // si el rival ya ganó, tú solo puedes llegar a 3

  const me = sideIndex === 0 ? m.a : m.b;
  const other = sideIndex === 0 ? m.b : m.a;

  const meNow = Number(me.score ?? 0);
  const otherNow = Number(other.score ?? 0);

  const next = meNow + delta;

  // ✅ Si el rival ya está en 4+ y yo estoy intentando SUBIR, cap a 3
  const maxAllowed = (delta > 0 && otherNow >= WIN_THRESHOLD) ? LOSER_MAX : MAX_SCORE;

  me.score = Math.max(0, Math.min(maxAllowed, next));

  recalcularStatsGlobales();

  saveState();
  window.renderGroups?.();
  window.renderGeneralTable?.();
  window.renderGlobalStandings?.();
}

/**
 * ✅ Mapeo de métricas definitivo (sin romper compat):
 * - PT = puntos hechos en rondas => state.players[].pf   (conceptualmente PT)
 * - PL = puntos de liga          => state.players[].points
 * - PC = puntos en contra        => state.players[].pc
 */
function ensurePlayerStats(p) {
  p.points = Number(p.points ?? 0); // PL
  p.wins = Number(p.wins ?? 0);     // wins (aux)
  p.pf = Number(p.pf ?? 0);         // PT (conceptual)
  p.pc = Number(p.pc ?? 0);         // PC
}

function recalcularStatsGlobales() {
  // reset
  state.players.forEach((p) => {
    p.points = 0; // PL
    p.wins = 0;
    p.pf = 0;     // PT
    p.pc = 0;     // PC
  });

  (state.groups || []).forEach((g) => {
    (g.matches || []).forEach((m) => {
      const a = m.a;
      const b = m.b;

      const aScore = Number(a.score ?? 0);
      const bScore = Number(b.score ?? 0);

      const pA = state.players.find((x) => x.id === a.id);
      if (pA) {
        ensurePlayerStats(pA);
        // PT suma siempre (haya victoria o derrota)
        pA.pf += aScore;
        // PC
        pA.pc += bScore;
      }

      // B solo si es real
      const pB = !b.isGhost ? state.players.find((x) => x.id === b.id) : null;
      if (pB) {
        ensurePlayerStats(pB);
        pB.pf += bScore; // PT
        pB.pc += aScore; // PC
      }

      // PL (liga)
      if (aScore > bScore) {
        if (pA) {
          pA.wins += 1;
          pA.points += WIN_PL;
        }
        if (pB) pB.points += LOSS_PL;
      } else if (bScore > aScore) {
        if (pB) {
          pB.wins += 1;
          pB.points += WIN_PL;
        }
        if (pA) pA.points += LOSS_PL;
      } else {
        if (pA) pA.points += DRAW_PL;
        if (pB) pB.points += DRAW_PL;
      }
    });
  });
}

export async function copyStandingsToClipboard() {
  try {
    const rows = state.players
      .slice()
      .map((p) => ({
        name: p.name,
        PT: Number(p.pf ?? 0),
        PL: Number(p.points ?? 0),
        PC: Number(p.pc ?? 0),
      }))
      .sort((a, b) => {
        if (b.PT !== a.PT) return b.PT - a.PT;
        if (b.PL !== a.PL) return b.PL - a.PL;
        if (a.PC !== b.PC) return a.PC - b.PC;
        return String(a.name).localeCompare(String(b.name), "es");
      });

    const text = rows
      .map((r, i) => `${i + 1}. ${r.name} - PT ${r.PT} | PL ${r.PL} | PC ${r.PC}`)
      .join("\n");

    await navigator.clipboard.writeText(text);
    window.showToast?.("Tabla copiada ✅");
  } catch {
    alert("No se pudo copiar. Revisa permisos del navegador.");
  }
}
