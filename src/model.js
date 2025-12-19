// src/model.js
export const POINTS_TO_WIN = 4;
export const STORAGE_KEY = "bey_manager_pro_v4";

export const initialState = {
  players: [],            // [{id, name}]
  groups: [],             // [{id, name, players:[{id,name,stats}], matches:[...]}]
  knockoutMatches: [],    // [{round,label?,matches:[...]}]
  desiredGroupCount: 1,
  phase: "registration",  // registration | groups | knockout | winner
  roundsSetting: 1,
};

// structuredClone fallback simple (por si acaso)
function clone(obj) {
  if (typeof structuredClone === "function") return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

export function createStore() {
  let state = clone(initialState);

  function getState() {
    return state;
  }

  function setState(next) {
    state = next;
    saveState();
  }

  function update(mutatorFn) {
    const next = clone(state);
    mutatorFn(next);
    setState(next);
    return state;
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return state;
    try {
      state = { ...clone(initialState), ...JSON.parse(saved) };
    } catch (e) {
      console.error("Error loadState", e);
      state = clone(initialState);
    }
    return state;
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    state = clone(initialState);
  }

  return { getState, setState, update, loadState, reset };
}
