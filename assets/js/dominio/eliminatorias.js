// assets/js/dominio/eliminatorias.js
import { state, saveState } from "../nucleo/estado.js";
import { startContinuousConfetti } from "../servicios/confeti.js";

const TARGET = 4;

function getTotalRealPlayers() {
  return Array.isArray(state.players) ? state.players.length : 0;
}

function floorPowerOfTwo(n) {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

function seedOrder(n) {
  let order = [1, 2];
  for (let size = 4; size <= n; size *= 2) {
    order = order.flatMap((x) => [x, size + 1 - x]);
  }
  return order;
}

/**
 * ✅ Ranking global con MÉTRICAS DEFINITIVAS:
 * Orden: PT desc → PL desc → PC asc → (wins desc) → name asc
 *
 * Importante:
 * - PT = p.pf
 * - PL = p.points
 * - PC = p.pc
 */
function buildRankedPlayers() {
  const rows = (state.players || []).map((p) => ({
    id: p.id,
    name: p.name,
    PL: Number(p.points ?? 0),
    PT: Number(p.pf ?? 0),
    PC: Number(p.pc ?? 0),
    WIN: Number(p.wins ?? 0),
  }));

  rows.sort((a, b) => {
    if (b.PL !== a.PL) return b.PL - a.PL;
    if (b.PT !== a.PT) return b.PT - a.PT;
    if (a.PC !== b.PC) return a.PC - b.PC;
    if (b.WIN !== a.WIN) return b.WIN - a.WIN;
    return String(a.name).localeCompare(String(b.name), "es");
  });

  return rows;
}

function getAvailableKnockoutSizes(totalPlayers) {
  const base = [2, 4, 8];
  if (totalPlayers >= 30) base.push(16);
  if (totalPlayers >= 60) base.push(32);
  if (totalPlayers >= 120) base.push(64);
  return base.filter((n) => n <= totalPlayers);
}

function clampKnockoutSize(desired, totalPlayers) {
  const avail = getAvailableKnockoutSizes(totalPlayers);
  if (!avail.length) return 2;

  const d = Number(desired || avail[avail.length - 1]);
  if (avail.includes(d)) return d;

  return avail[avail.length - 1];
}

function getRoundLabel(roundNumber, bracketSize, isFinales = false) {
  const alive = bracketSize / Math.pow(2, roundNumber - 1);

  if (isFinales) return "Finales";
  if (alive === 2) return "Final";
  if (alive === 4) return "Semifinales";
  if (alive === 8) return "Cuartos";
  if (alive === 16) return "Octavos";
  if (alive === 32) return "Dieciseisavos";
  if (alive === 64) return "Treintaidosavos";
  return `Ronda ${roundNumber}`;
}

export function setKnockoutSize(val) {
  const total = getTotalRealPlayers();
  state.knockoutSize = clampKnockoutSize(val, total);
  saveState();
}

export function startKnockout() {
  const ranked = buildRankedPlayers();
  const total = ranked.length;

  const topSelected = clampKnockoutSize(state.knockoutSize || 8, total);
  const prelim = ranked.slice(0, Math.min(topSelected, total));

  const bracketSize = floorPowerOfTwo(prelim.length);
  const pool = prelim.slice(0, bracketSize);

  if (pool.length < 2) return;

  state.knockoutBracketSize = bracketSize;

  const order = seedOrder(bracketSize);
  const matches = [];
  const round = 1;

  for (let i = 0; i < order.length; i += 2) {
    const seedA = order[i];
    const seedB = order[i + 1];

    const a = pool[seedA - 1];
    const b = pool[seedB - 1];

    matches.push({
      id: `R${round}-${a.id}-${b.id}`,
      round,
      type: "NORMAL",
      a: { id: a.id, name: a.name, score: 0, seed: seedA },
      b: { id: b.id, name: b.name, score: 0, seed: seedB },
      winner: null,
    });
  }

  state.knockoutRounds = [
    {
      round: 1,
      label: getRoundLabel(1, bracketSize),
      isFinales: false,
      matches,
    },
  ];

  state.knockoutMatches = matches;
  state.phase = "knockout";

  saveState();
  window.restoreUI?.();

  updateKnockoutRoundSelect();
  window.renderBracket?.();
}

function updateKnockoutRoundSelect() {
  const sel = document.getElementById("knockout-round-select");
  if (!sel) return;

  const rounds = (state.knockoutRounds || []).map((r) => r.round);
  sel.innerHTML = rounds.map((r) => `<option value="${r}">${r}</option>`).join("");

  if (!sel.value && rounds[0]) sel.value = String(rounds[0]);

  const badge = document.getElementById("round-badge");
  const roundObj = (state.knockoutRounds || []).find((r) => String(r.round) === String(sel.value));
  if (badge) badge.textContent = roundObj?.label || `Ronda ${sel.value || 1}`;
}

export function selectKnockoutRound(value) {
  const badge = document.getElementById("round-badge");
  const roundObj = (state.knockoutRounds || []).find((r) => String(r.round) === String(value));
  if (badge) badge.textContent = roundObj?.label || `Ronda ${value}`;
  window.renderBracket?.();
}

export function adjustKnockoutScore(matchId, side, delta) {
  const roundSel = document.getElementById("knockout-round-select");
  const currentRound = Number(roundSel?.value || 1);

  const roundObj = (state.knockoutRounds || []).find((r) => Number(r.round) === currentRound);
  if (!roundObj) return;

  const match = (roundObj.matches || []).find((m) => String(m.id) === String(matchId));
  if (!match) return;

  const A = match.a;
  const B = match.b;

  const aNow = Number(A.score ?? 0);
  const bNow = Number(B.score ?? 0);

  // ✅ Si el rival ya ganó (>=TARGET), tú solo puedes subir hasta TARGET-1 (3)
  const maxA = (bNow >= TARGET) ? (TARGET - 1) : 6;
  const maxB = (aNow >= TARGET) ? (TARGET - 1) : 6;

  if (side === 0) {
    const next = Number(A.score ?? 0) + delta;
    A.score = Math.max(0, Math.min(maxA, next));
  } else {
    const next = Number(B.score ?? 0) + delta;
    B.score = Math.max(0, Math.min(maxB, next));
  }

  // Recalcular ganador
  match.winner = null;

  const aS = Number(A.score ?? 0);
  const bS = Number(B.score ?? 0);

  if (aS >= TARGET && aS > bS) match.winner = { id: A.id, name: A.name };
  else if (bS >= TARGET && bS > aS) match.winner = { id: B.id, name: B.name };

  saveState();
  window.renderBracket?.();
}


export function advanceRound() {
  const roundSel = document.getElementById("knockout-round-select");
  const currentRound = Number(roundSel?.value || 1);

  const roundObj = (state.knockoutRounds || []).find((r) => Number(r.round) === currentRound);
  if (!roundObj) return;

  const matches = roundObj.matches || [];
  if (!matches.length) return;

  const pending = matches.some((m) => !m.winner);
  if (pending) {
    alert("Faltan combates por terminar.");
    return;
  }

  if (roundObj.isFinales) {
    const finalMatch = matches.find((m) => m.type === "FINAL");
    const thirdMatch = matches.find((m) => m.type === "THIRD");

    if (!finalMatch?.winner) {
      alert("Falta terminar la Gran Final.");
      return;
    }
    if (!thirdMatch?.winner) {
      alert("Falta terminar el combate por el 3er lugar.");
      return;
    }

    const champ = { id: finalMatch.winner.id, name: finalMatch.winner.name };

    const second =
      finalMatch.winner.id === finalMatch.a.id
        ? { id: finalMatch.b.id, name: finalMatch.b.name }
        : { id: finalMatch.a.id, name: finalMatch.a.name };

    const third = { id: thirdMatch.winner.id, name: thirdMatch.winner.name };

    state.winner = champ;
    state.podium = { first: champ, second, third };

    state.phase = "winner";
    saveState();

    startContinuousConfetti();
    window.restoreUI?.();
    return;
  }

  const winners = matches.map((m) => ({
    id: m.winner.id,
    name: m.winner.name,
    score: 0,
  }));

  if (winners.length === 1) {
    state.winner = { id: winners[0].id, name: winners[0].name };
    state.phase = "winner";
    saveState();

    startContinuousConfetti();
    window.restoreUI?.();
    return;
  }

  const nextRound = currentRound + 1;
  const nextMatches = [];

  const isSemis = matches.length === 2 && !roundObj.isFinales;

  if (isSemis) {
    const losers = matches.map((m) => {
      const aIsWinner = m.winner.id === m.a.id;
      const loser = aIsWinner ? m.b : m.a;
      return { id: loser.id, name: loser.name, score: 0 };
    });

    nextMatches.push({
      id: `R${nextRound}-FINAL-${winners[0].id}-${winners[1].id}`,
      round: nextRound,
      type: "FINAL",
      a: { ...winners[0], score: 0 },
      b: { ...winners[1], score: 0 },
      winner: null,
    });

    nextMatches.push({
      id: `R${nextRound}-THIRD-${losers[0].id}-${losers[1].id}`,
      round: nextRound,
      type: "THIRD",
      a: { ...losers[0], score: 0 },
      b: { ...losers[1], score: 0 },
      winner: null,
    });

    const bracketSize = Number(state.knockoutBracketSize || 0);

    state.knockoutRounds = [
      ...(state.knockoutRounds || []),
      {
        round: nextRound,
        label: getRoundLabel(nextRound, bracketSize, true),
        isFinales: true,
        matches: nextMatches,
      },
    ];

    state.knockoutMatches = nextMatches;
    saveState();
    window.restoreUI?.();

    const sel = document.getElementById("knockout-round-select");
    if (sel) sel.value = String(nextRound);

    const badge = document.getElementById("round-badge");
    if (badge) badge.textContent = "Finales";

    window.renderBracket?.();
    return;
  }

  for (let i = 0; i < winners.length; i += 2) {
    const a = winners[i];
    const b = winners[i + 1];

    nextMatches.push({
      id: `R${nextRound}-${a.id}-${b.id}`,
      round: nextRound,
      type: "NORMAL",
      a: { ...a, score: 0 },
      b: { ...b, score: 0 },
      winner: null,
    });
  }

  const bracketSize = Number(state.knockoutBracketSize || 0);

  state.knockoutRounds = [
    ...(state.knockoutRounds || []),
    {
      round: nextRound,
      label: getRoundLabel(nextRound, bracketSize),
      isFinales: false,
      matches: nextMatches,
    },
  ];

  state.knockoutMatches = nextMatches;
  saveState();
  window.restoreUI?.();

  const sel = document.getElementById("knockout-round-select");
  if (sel) sel.value = String(nextRound);

  const badge = document.getElementById("round-badge");
  const roundNew = state.knockoutRounds.find((r) => r.round === nextRound);
  if (badge) badge.textContent = roundNew?.label || `Ronda ${nextRound}`;

  window.renderBracket?.();
}
