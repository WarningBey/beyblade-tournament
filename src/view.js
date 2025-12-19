// src/view.js
export function getEls() {
  return {
    views: {
      registration: document.getElementById("view-registration"),
      groups: document.getElementById("view-groups"),
      knockout: document.getElementById("view-knockout"),
      winner: document.getElementById("view-winner"),
    },

    // Header
    btnBackup: document.getElementById("btn-backup"),
    btnHome: document.getElementById("btn-home"),

    // Registration
    inputPlayer: document.getElementById("input-player"),
    btnAddPlayer: document.getElementById("btn-add-player"),
    playersList: document.getElementById("players-list"),
    playerCounter: document.getElementById("player-counter"),
    btnStart: document.getElementById("btn-start"),
    groupConfig: document.getElementById("group-config"),
    groupSlider: document.getElementById("group-slider"),
    groupCountDisplay: document.getElementById("group-count-display"),
    roundsInput: document.getElementById("rounds-input"),
    roundsMaxMsg: document.getElementById("rounds-max-msg"),
    groupInfo: document.getElementById("group-info"),

    // Groups
    groupsContainer: document.getElementById("groups-container"),
    globalStandingsBody: document.getElementById("global-standings-body"),
    knockoutSizeSelect: document.getElementById("knockout-size-select"),
    btnToKnockout: document.getElementById("btn-to-knockout"),

    // Knockout
    bracketContainer: document.getElementById("bracket-container"),
    roundBadge: document.getElementById("round-badge"),
    btnAdvance: document.getElementById("btn-advance"),

    // Winner
    championName: document.getElementById("champion-name"),
    thirdPlaceContainer: document.getElementById("third-place-container"),
    thirdPlaceName: document.getElementById("third-place-name"),
    btnNewTournament: document.getElementById("btn-new-tournament"),

    // Toast
    toast: document.getElementById("toast"),
  };
}

export function hideAllViews(els) {
  Object.values(els.views).forEach(v => v.classList.add("hidden"));
}

export function showView(els, phase) {
  hideAllViews(els);
  els.views[phase]?.classList.remove("hidden");
}

export function showToast(els, msg = "Guardado") {
  if (!els.toast) return;
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  window.setTimeout(() => els.toast.classList.remove("show"), 1500);
}
