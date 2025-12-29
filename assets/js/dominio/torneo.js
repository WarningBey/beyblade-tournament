import { state, saveState } from "../nucleo/estado.js";
import { SoundFX } from "../servicios/audio.js";

let nextId = 1;

function syncNextId() {
  const maxId = state.players.reduce((acc, p) => Math.max(acc, Number(p.id || 0)), 0);
  nextId = Math.max(nextId, maxId + 1);
}

function computeMaxGroups(playerCount) {
  return Math.max(1, Math.floor(playerCount / 2));
}

/**
 * ✅ Formato actual: grupos
 * (Cuando implementes suizo: state.format = "swiss")
 */
function getTournamentFormat() {
  return state.format || "groups";
}

/**
 * ✅ Rondas automáticas para GRUPOS (calendario round-robin):
 * - maxGroupSize = ceil(players / groups)
 * - si maxGroupSize es par => rondas = N-1
 * - si maxGroupSize es impar => rondas = N (1 descanso por ronda)
 */
function computeAutoRoundsForGroups(playerCount, groupCount) {
  const g = Math.max(1, Number(groupCount || 1));
  const maxGroupSize = Math.ceil(Math.max(0, playerCount) / g);
  const n = Math.max(2, maxGroupSize);
  return n % 2 === 0 ? n - 1 : n;
}

function applyAutoRoundsIfGroups() {
  if (getTournamentFormat() !== "groups") return;

  const players = state.players.length;
  const groups = Number(state.desiredGroupCount || 1);

  state.roundsSetting = computeAutoRoundsForGroups(players, groups);
}

export function addPlayer() {
  const input = document.getElementById("input-player");
  const name = input?.value?.trim();
  if (!name) return SoundFX.error?.();

  syncNextId();
  state.players.push({ id: nextId++, name, points: 0 });

  if (input) input.value = "";

  // Ajustes derivados: clamp de grupos
  const maxGroups = computeMaxGroups(state.players.length);
  state.desiredGroupCount = Math.max(1, Math.min(maxGroups, Number(state.desiredGroupCount || 1)));

  applyAutoRoundsIfGroups();

  saveState();
  window.renderPlayerList?.();
  SoundFX.add?.();
}

export function removePlayer(id) {
  state.players = state.players.filter((p) => p.id !== id);

  // clamp groups si bajan jugadores
  const maxGroups = computeMaxGroups(state.players.length);
  state.desiredGroupCount = Math.max(1, Math.min(maxGroups, Number(state.desiredGroupCount || 1)));

  applyAutoRoundsIfGroups();

  saveState();
  window.renderPlayerList?.();
}

export function editPlayerName(id) {
  const p = state.players.find((x) => x.id === id);
  if (!p) return;

  const newName = prompt("Nuevo nombre:", p.name);
  if (!newName) return;

  p.name = newName.trim();
  saveState();
  window.renderPlayerList?.();
}

/**
 * Slider de grupos
 */
export function updateGroupCount(val) {
  const maxGroups = computeMaxGroups(state.players.length);
  const n = Math.max(1, Math.min(maxGroups, Number(val || 1)));

  state.desiredGroupCount = n;

  const slider = document.getElementById("group-slider");
  if (slider) {
    slider.max = String(maxGroups);
    slider.value = String(n);
  }

  const label = document.getElementById("group-count-label");
  if (label) label.textContent = String(n);

  // ✅ en grupos, recalcula rondas automáticas cuando cambias grupos
  applyAutoRoundsIfGroups();

  saveState();
  window.renderPlayerList?.(); // refresca msg (Calendario | Cada jugador)
}

/**
 * Input "Rondas"
 * - En GRUPOS: ignorado (automático)
 * - En SUIZO (futuro): editable
 */
export function setRounds(val) {
  const format = getTournamentFormat();

  if (format === "groups") {
    applyAutoRoundsIfGroups();
    saveState();
    window.renderPlayerList?.();
    return;
  }

  // swiss (futuro)
  const n = Math.max(1, Math.min(10, Number(val || 1)));
  state.roundsSetting = n;
  saveState();
}
