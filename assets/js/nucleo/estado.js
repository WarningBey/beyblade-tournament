import { STORAGE_KEY } from "./constantes.js";

export const initialState = {
  players: [],
  groups: [],
  knockoutMatches: [],
  desiredGroupCount: 1,
  phase: "registration",
  roundsSetting: 1,
};

export let state = JSON.parse(JSON.stringify(initialState));

export function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.players && parsed.phase) {
      state = { ...state, ...parsed };
    }
  } catch {
    // si está corrupto, lo ignoramos
  }
}

export function hardReset(confirmar = false) {
  if (confirmar && !confirm("¿Seguro que deseas reiniciar el torneo?")) return;

  state = JSON.parse(JSON.stringify(initialState));
  localStorage.removeItem(STORAGE_KEY);

  if (window.showToast) window.showToast("Reiniciado");
  if (window.restoreUI) window.restoreUI();
}