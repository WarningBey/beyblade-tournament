// src/model.js
export const POINTS_TO_WIN = 4;
export const STORAGE_KEY = "bey_manager_pro_v4";

export const initialState = {
  players: [],
  groups: [],
  knockoutMatches: [],
  desiredGroupCount: 1,
  phase: "registration",
  roundsSetting: 1,
};

export function createStore() {
  let state = structuredClone(initialState);

  function getState() {
    return state;
  }

  function setState(next) {
    state = next;
    saveState();
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return state;
    try {
      state = { ...structuredClone(initialState), ...JSON.parse(saved) };
    } catch (e) {
      console.error("Error loadState", e);
    }
    return state;
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    state = structuredClone(initialState);
  }

  return { getState, setState, loadState, reset };
}
