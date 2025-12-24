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

export function addPlayer() {
  const input = document.getElementById("input-player");
  const name = input?.value?.trim();
  if (!name) return SoundFX.error?.();

  syncNextId();
  state.players.push({ id: nextId++, name, points: 0 });
  if (input) input.value = "";

  saveState();
  window.renderPlayerList?.();
  SoundFX.add?.();
}

export function removePlayer(id) {
  state.players = state.players.filter((p) => p.id !== id);

  // clamp groups si bajan jugadores
  const maxGroups = computeMaxGroups(state.players.length);
  state.desiredGroupCount = Math.max(1, Math.min(maxGroups, Number(state.desiredGroupCount || 1)));

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

  saveState();
}

export function setRounds(val) {
  const n = Math.max(1, Math.min(10, Number(val || 1)));
  state.roundsSetting = n;
  saveState();
}
