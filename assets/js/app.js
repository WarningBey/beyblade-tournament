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
import {
  isLiveModeActive,
  getCurrentSessionId,
  createTournamentSession,
  closeTournamentSession,
  subscribeToTournamentState,
  syncMatchUpdate,
  getJudgeAccessUrl,
  createJudgeQrPayload,
  openJudgeMode,
} from "./servicios/sync.js";

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
  renderLiveModePanel,
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
import { generateGroups, redistributeGroups, adjustScore, copyStandingsToClipboard, applyExternalResult } from "./dominio/grupos.js";
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
// LIVE MODE (Modo Torneo en Vivo)
// =========================
let _liveUnsubscribe = null;

async function startLiveMode() {
  if (isLiveModeActive()) {
    showToast("Ya hay una sesión activa");
    return;
  }
  showToast("Iniciando Modo Juez...");
  const result = await createTournamentSession(state);
  if (!result.ok) {
    showToast("❌ " + result.reason);
    return;
  }

  _liveUnsubscribe = subscribeToTournamentState(handleRemoteMatchUpdate);
  renderLiveModePanel?.();
  showToast("✅ Modo Juez activo — Sesión: " + result.sessionId);
}

async function stopLiveMode() {
  if (_liveUnsubscribe) { _liveUnsubscribe(); _liveUnsubscribe = null; }
  await closeTournamentSession();
  renderLiveModePanel?.();
  showToast("Modo Juez desactivado");
}

function handleRemoteMatchUpdate(matchesData) {
  let anyJudgeResult = false;

  Object.values(matchesData || {}).forEach((fbMatch) => {
    const { matchId, aScore, bScore, status, judgeId, judgeName, source } = fbMatch;
    if (!matchId) return;

    if (source === "judge" && status === "completed") {
      applyExternalResult(matchId, aScore, bScore, { status, judgeId, judgeName, source });
      anyJudgeResult = true;
    } else {
      // Solo actualizar metadata de status (sin cambiar scores)
      for (const g of state.groups) {
        const m = g.matches.find((x) => x.id === matchId);
        if (m) {
          m.status = status ?? m.status;
          m.judgeId = judgeId ?? m.judgeId;
          m.judgeName = judgeName ?? m.judgeName;
          break;
        }
      }
    }
  });

  if (anyJudgeResult) {
    window.renderGeneralTable?.();
  }
  window.renderGroups?.();
}

// Hook llamado desde adjustScore() en grupos.js cuando admin cambia un score en live mode
window.onMatchScoreChanged = (matchId, match) => {
  if (!isLiveModeActive()) return;
  syncMatchUpdate(matchId, match).catch(() => {});
};

async function copyJudgeLink() {
  const url = getJudgeAccessUrl();
  if (!url) { showToast("❌ Activá el Modo Juez primero"); return; }
  try {
    await navigator.clipboard.writeText(url);
    showToast("Link copiado ✅");
  } catch {
    showToast("❌ No se pudo copiar — copialo manualmente");
  }
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

    // Live mode
    startLiveMode,
    stopLiveMode,
    copyJudgeLink,
    isLiveModeActive,
    getCurrentSessionId,
    getJudgeAccessUrl,
    openJudgeMode,
    renderLiveModePanel,
    createJudgeQrPayload,
  });
}

// =========================
// INICIALIZACIÓN APP
// =========================
async function inicializarApp() {
  loadState();
  registrarEventosUI?.();

  // Detectar modo juez por URL params
  const params = new URLSearchParams(window.location.search);
  if (params.get("mode") === "judge") {
    const sessionId = params.get("session");
    if (sessionId) {
      const { initJudgeMode } = await import("./ui/judge-view.js");
      initJudgeMode(sessionId);
      return; // judge-view.js toma el control del render
    }
  }

  restoreUI();
}

// =========================
// BOOTSTRAP
// =========================
exponerAPI();
window.addEventListener("DOMContentLoaded", inicializarApp);

