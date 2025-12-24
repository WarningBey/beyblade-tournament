// assets/js/dominio/ranking.js
import { state } from "../nucleo/estado.js";

/**
 * Recalcula puntos (y opcionalmente desempates) en base a los matches de grupos.
 * Regla simple:
 *  - ganador del match = +1 punto
 *  - empate = 0 (puedes cambiarlo a 0.5 si quieres)
 *  - además acumula "diferencia" como desempate (score a - score b)
 */
export function recalcularRankingDesdeGrupos() {
  // Inicializar métricas
  const mapa = new Map();
  state.players.forEach((p) => {
    mapa.set(p.id, {
      id: p.id,
      name: p.name,
      puntos: 0,
      jugados: 0,
      ganados: 0,
      perdidos: 0,
      diferencia: 0, // desempate
    });
  });

  // Recorrer todos los matches de todos los grupos
  (state.groups || []).forEach((g) => {
    (g.matches || []).forEach((m) => {
      const a = mapa.get(m.a.id);
      const b = mapa.get(m.b.id);
      if (!a || !b) return;

      const sa = Number(m.a.score ?? 0);
      const sb = Number(m.b.score ?? 0);

      a.jugados += 1;
      b.jugados += 1;

      a.diferencia += (sa - sb);
      b.diferencia += (sb - sa);

      if (sa > sb) {
        a.puntos += 1;
        a.ganados += 1;
        b.perdidos += 1;
      } else if (sb > sa) {
        b.puntos += 1;
        b.ganados += 1;
        a.perdidos += 1;
      } else {
        // empate: por defecto 0 puntos, ajusta si quieres
      }
    });
  });

  // Persistir en state.players (para que UI y knockout lo usen)
  state.players = state.players.map((p) => {
    const r = mapa.get(p.id);
    if (!r) return p;
    return {
      ...p,
      points: r.puntos,
      played: r.jugados,
      wins: r.ganados,
      losses: r.perdidos,
      diff: r.diferencia,
    };
  });

  return obtenerRankingGlobal();
}

/**
 * Devuelve el ranking ordenado (sin mutar).
 * Orden: points desc, diff desc, wins desc, name asc
 */
export function obtenerRankingGlobal() {
  return [...(state.players || [])].sort((a, b) => {
    const pa = Number(a.points ?? 0), pb = Number(b.points ?? 0);
    if (pb !== pa) return pb - pa;

    const da = Number(a.diff ?? 0), db = Number(b.diff ?? 0);
    if (db !== da) return db - da;

    const wa = Number(a.wins ?? 0), wb = Number(b.wins ?? 0);
    if (wb !== wa) return wb - wa;

    return String(a.name).localeCompare(String(b.name), "es");
  });
}

/** Top N para llaves (ej: top 8) */
export function obtenerTopN(n = 8) {
  return obtenerRankingGlobal().slice(0, Math.max(0, n));
}
