// =========================
// IMPORTS - SERVICIOS
// =========================
import { toggleMute, SoundFX } from "./servicios/audio.js";
import {
  openToss,
  closeToss,
  spinToss,
  fireConfettiBurst,
  startContinuousConfetti,
} from "./servicios/confeti.js";

// =========================
// IMPORTS - NÚCLEO
// =========================
import { STORAGE_KEY } from "./nucleo/constantes.js";
import { initialState, state, loadState, saveState, hardReset } from "./nucleo/estado.js";
import { downloadBackup, loadTournamentFile } from "./nucleo/almacenamiento.js";

// =========================
// IMPORTS - UI
// =========================
import { goHome, goBackStep, hideAllViews, restoreUI } from "./ui/vistas.js";
import {
  showToast,
  renderPlayerList,
  renderGroups,
  renderGeneralTable,
  renderBracket,
  renderWinnerView,
  updateKnockoutSelector,
  renderMatchRow,
} from "./ui/render.js";

import { registrarEventosUI } from "./ui/eventos.js";

// =========================
// IMPORTS - DOMINIO
// =========================
import { addPlayer, removePlayer, editPlayerName, setRounds, updateGroupCount } from "./dominio/torneo.js";
import { generateGroups, redistributeGroups, adjustScore, copyStandingsToClipboard } from "./dominio/grupos.js";
import { startKnockout, advanceRound, selectKnockoutRound, setKnockoutSize, adjustKnockoutScore } from "./dominio/eliminatorias.js";
import { recalcularRankingDesdeGrupos, obtenerRankingGlobal, obtenerTopN } from "./dominio/ranking.js";

// =========================
// WRAPPERS UI (leen DOM, luego delegan a dominio)
// =========================
function editPlayerNameUI(id) {
  const p = state.players.find((x) => x.id === id);
  if (!p) return;
  const newName = prompt("Nuevo nombre:", p.name);
  if (newName) editPlayerName(id, newName);
}

// =========================
// API GLOBAL (para onclick del HTML)
// =========================
function exponerAPI() {
  Object.assign(window, {
    STORAGE_KEY,
    initialState,
    state,
    loadState,
    saveState,
    hardReset,
    renderGeneralTable,
    showToast,
    hideAllViews,
    restoreUI,
    goHome,
    goBackStep,

    toggleMute,
    SoundFX,
    openToss,
    closeToss,
    spinToss,
    fireConfettiBurst,
    startContinuousConfetti,

    addPlayer,
    removePlayer,
    editPlayerName,
    editPlayerNameUI,
    setRounds,
    updateGroupCount,

    generateGroups,
    redistributeGroups,
    adjustScore,
    copyStandingsToClipboard,

    startKnockout,
    selectKnockoutRound,
    advanceRound,
    setKnockoutSize,
    adjustKnockoutScore,
    downloadBackup,
    loadTournamentFile,

    renderPlayerList,
    renderGroups,
    renderMatchRow,
    renderBracket,
    renderWinnerView,
    updateKnockoutSelector,

    recalcularRankingDesdeGrupos,
    obtenerRankingGlobal,
    obtenerTopN,
  });
}

// =========================
// INICIALIZACIÓN APP
// =========================
function inicializarApp() {
  loadState();

  // Engancha listeners (con guards adentro)
  registrarEventosUI?.();

  // Pintar vista según fase
  restoreUI();
}

// =========================
// BOOTSTRAP
// =========================
exponerAPI();
window.addEventListener("DOMContentLoaded", inicializarApp);

