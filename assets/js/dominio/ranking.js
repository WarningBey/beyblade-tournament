// assets/js/dominio/ranking.js
import { state } from "../nucleo/estado.js";

/**
 * Recalcula métricas oficiales desde matches de grupos:
 * - PT = puntos hechos (suma de score propio) => se guarda en p.pf (compat)
 * - PL = puntos liga (W=3 / L=1 / D=0)        => se guarda en p.points
 * - PC = puntos recibidos                     => se guarda en p.pc
 *
 * Orden oficial (para obtenerRankingGlobal):
 * PT desc → PL desc → PC asc
 */
export function recalcularRankingDesdeGrupos() {
  const mapa = new Map();

  state.players.forEach((p) => {
    mapa.set(p.id, {
      id: p.id,
      name: p.name,
      PT: 0,
      PL: 0,
      PC: 0,
      WIN: 0,
    });
  });

  (state.groups || []).forEach((g) => {
    (g.matches || []).forEach((m) => {
      const a = mapa.get(m.a.id);
      const b = mapa.get(m.b.id);

      // si b es fantasma no está en mapa -> ignoramos como jugador real
      if (!a) return;

      const sa = Number(m.a.score ?? 0);
      const sb = Number(m.b.score ?? 0);

      a.PT += sa;
      a.PC += sb;

      if (b) {
        b.PT += sb;
        b.PC += sa;
      }

      // PL
      if (sa > sb) {
        a.PL += 3;
        a.WIN += 1;
        if (b) b.PL += 1;
      } else if (sb > sa) {
        if (b) {
          b.PL += 3;
          b.WIN += 1;
        }
        a.PL += 1;
      } else {
        // empate
        a.PL += 0;
        if (b) b.PL += 0;
      }
    });
  });

  state.players = state.players.map((p) => {
    const r = mapa.get(p.id);
    if (!r) return p;
    return {
      ...p,
      pf: r.PT,      // ✅ PT (compat)
      points: r.PL,  // ✅ PL
      pc: r.PC,      // ✅ PC
      wins: r.WIN,
    };
  });

  return obtenerRankingGlobal();
}

export function obtenerRankingGlobal() {
  return [...(state.players || [])].sort((a, b) => {
    const PTa = Number(a.pf ?? 0), PTb = Number(b.pf ?? 0);
    if (PTb !== PTa) return PTb - PTa;

    const PLa = Number(a.points ?? 0), PLb = Number(b.points ?? 0);
    if (PLb !== PLa) return PLb - PLa;

    const PCa = Number(a.pc ?? 0), PCb = Number(b.pc ?? 0);
    if (PCa !== PCb) return PCa - PCb;

    return String(a.name).localeCompare(String(b.name), "es");
  });
}

export function obtenerTopN(n = 8) {
  return obtenerRankingGlobal().slice(0, Math.max(0, n));
}
