import { state, saveState } from "../nucleo/estado.js";

export function hideAllViews() {
  ["view-registration", "view-groups", "view-knockout", "view-winner"].forEach((id) => {
    document.getElementById(id)?.classList.add("hidden");
  });
}

export function restoreUI() {
  hideAllViews();

  if (state.phase === "registration") {
    document.getElementById("view-registration")?.classList.remove("hidden");
    window.renderPlayerList?.();
  }

  if (state.phase === "groups") {
    document.getElementById("view-groups")?.classList.remove("hidden");
    window.renderGroups?.();
    window.renderGlobalStandings?.();
  }

  if (state.phase === "knockout") {
    document.getElementById("view-knockout")?.classList.remove("hidden");
    window.updateKnockoutSelector?.();
    window.renderBracket?.();
  }

  if (state.phase === "winner") {
    document.getElementById("view-winner")?.classList.remove("hidden");
    window.renderWinnerView?.();
  }
}

export function goHome() {
  state.phase = "registration";
  saveState();
  restoreUI();
}

export function goBackStep() {
  if (state.phase === "winner") state.phase = "knockout";
  else if (state.phase === "knockout") state.phase = "groups";
  else if (state.phase === "groups") state.phase = "registration";

  saveState();
  restoreUI();
}
