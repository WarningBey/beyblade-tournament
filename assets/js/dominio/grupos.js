import { state, saveState } from "../nucleo/estado.js";
import { SoundFX } from "../servicios/audio.js";

function computeMaxGroups(playerCount) {
  return Math.max(1, Math.floor(playerCount / 2));
}

export function generateGroups() {
  if (state.players.length < 2) return;

  const shuffled = [...state.players].sort(() => Math.random() - 0.5);

  const maxGroups = computeMaxGroups(shuffled.length);
  const desired = Number(state.desiredGroupCount || 1);
  const groupCount = Math.max(1, Math.min(desired, maxGroups));

  // mantener consistente el state
  state.desiredGroupCount = groupCount;

  const groups = Array.from({ length: groupCount }, (_, i) => ({
    id: i + 1,
    name: String.fromCharCode(65 + i),
    matches: [],
    players: [],
  }));

  shuffled.forEach((p, idx) => groups[idx % groupCount].players.push(p));

  // round-robin simple por grupo
  groups.forEach((g) => {
    const ps = g.players;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        g.matches.push({
          id: `${g.id}-${ps[i].id}-${ps[j].id}`,
          a: { id: ps[i].id, name: ps[i].name, score: 0 },
          b: { id: ps[j].id, name: ps[j].name, score: 0 },
        });
      }
    }
  });

  state.groups = groups;
  state.phase = "groups";

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

  const side = sideIndex === 0 ? m.a : m.b;
  side.score = Math.max(0, (side.score || 0) + delta);

  recalcularPuntos();

  saveState();
  window.renderGroups?.();
  window.renderGlobalStandings?.();
}

function recalcularPuntos() {
  state.players.forEach((p) => (p.points = 0));

  state.groups.forEach((g) => {
    g.matches.forEach((m) => {
      if (m.a.score > m.b.score) {
        const p = state.players.find((x) => x.id === m.a.id);
        if (p) p.points += 1;
      } else if (m.b.score > m.a.score) {
        const p = state.players.find((x) => x.id === m.b.id);
        if (p) p.points += 1;
      }
    });
  });
}

export async function copyStandingsToClipboard() {
  try {
    const text = state.players
      .slice()
      .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
      .map((p, i) => `${i + 1}. ${p.name} - ${p.points ?? 0} pts`)
      .join("\n");

    await navigator.clipboard.writeText(text);
    window.showToast?.("Tabla copiada ✅");
  } catch {
    alert("No se pudo copiar. Revisa permisos del navegador.");
  }
}
