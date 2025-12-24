import { state, saveState } from "../nucleo/estado.js";
import { startContinuousConfetti } from "../servicios/confeti.js";

export function startKnockout() {
  // toma top 8 por puntos (o menos si hay menos jugadores)
  const ranked = state.players.slice().sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  const pool = ranked.slice(0, Math.min(8, ranked.length));

  // pares simples 1v8, 2v7...
  const matches = [];
  let round = 1;

  for (let i = 0; i < Math.floor(pool.length / 2); i++) {
    const a = pool[i];
    const b = pool[pool.length - 1 - i];
    matches.push({
      id: `R${round}-${a.id}-${b.id}`,
      round,
      a: { id: a.id, name: a.name, score: 0 },
      b: { id: b.id, name: b.name, score: 0 },
      done: false,
    });
  }

  state.knockoutMatches = matches;
  state.phase = "knockout";

  saveState();
  window.restoreUI?.();
}

export function selectKnockoutRound(value) {
  // solo re-render
  window.renderBracket?.();
}

export function advanceRound() {
  // si queda 1 match -> ganador
  if (state.knockoutMatches.length === 1) {
    const m = state.knockoutMatches[0];
    const winner = m.a.score >= m.b.score ? m.a : m.b;
    state.winner = { id: winner.id, name: winner.name };
    state.phase = "winner";
    saveState();

    startContinuousConfetti();
    window.restoreUI?.();
    return;
  }

  // generar siguiente ronda a partir de ganadores
  const winners = state.knockoutMatches.map((m) => (m.a.score >= m.b.score ? m.a : m.b));
  const nextRound = (state.knockoutMatches[0].round || 1) + 1;

  const next = [];
  for (let i = 0; i < Math.floor(winners.length / 2); i++) {
    const a = winners[i];
    const b = winners[winners.length - 1 - i];
    next.push({
      id: `R${nextRound}-${a.id}-${b.id}`,
      round: nextRound,
      a: { ...a, score: 0 },
      b: { ...b, score: 0 },
      done: false,
    });
  }

  state.knockoutMatches = next;
  saveState();

  window.updateKnockoutSelector?.();
  window.renderBracket?.();
}
