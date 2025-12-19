// src/view.js
export function getEls() {
  return {
    views: {
      registration: document.getElementById("view-registration"),
      groups: document.getElementById("view-groups"),
      knockout: document.getElementById("view-knockout"),
      winner: document.getElementById("view-winner"),
    },
    inputPlayer: document.getElementById("input-player"),
    playersList: document.getElementById("players-list"),
    playerCounter: document.getElementById("player-counter"),
    btnStart: document.getElementById("btn-start"),
    groupConfig: document.getElementById("group-config"),
    groupSlider: document.getElementById("group-slider"),
    groupCountDisplay: document.getElementById("group-count-display"),
    roundsInput: document.getElementById("rounds-input"),
    roundsMaxMsg: document.getElementById("rounds-max-msg"),
    groupsContainer: document.getElementById("groups-container"),
    globalStandingsBody: document.getElementById("global-standings-body"),
    knockoutSizeSelect: document.getElementById("knockout-size-select"),
    bracketContainer: document.getElementById("bracket-container"),
    roundBadge: document.getElementById("round-badge"),
    toast: document.getElementById("toast"),
    championName: document.getElementById("champion-name"),
    thirdPlaceContainer: document.getElementById("third-place-container"),
    thirdPlaceName: document.getElementById("third-place-name"),
  };
}

export function hideAllViews(els) {
  Object.values(els.views).forEach(v => v.classList.add("hidden"));
}

export function showView(els, phase) {
  hideAllViews(els);
  els.views[phase].classList.remove("hidden");
}
