// assets/js/ui/judge-view.js
//
// Vista de juez — corre en el celular del juez, completamente separada del admin.
// Activada cuando la URL tiene ?mode=judge&session=XXXX
// No accede a state global del admin. Todo va por Firebase.
//
import {
  loadSessionForJudge,
  subscribeToMatchesForJudge,
  claimMatchAsJudge,
  releaseMatchAsJudge,
  submitMatchResultAsJudge,
} from "../servicios/sync.js";

// ─── Constantes (mismas reglas que admin) ────────────────────────────────────
const MAX_SCORE = 6;
const WIN_THRESHOLD = 4;
const LOSER_MAX = 3;

// ─── Estado módulo ────────────────────────────────────────────────────────────
let _sessionId = null;
let _judgeId = null;
let _judgeName = "";
let _snapshot = null;     // { groups, players }
let _matches = {};        // { [firebaseKey]: fbMatch }
let _activeMatchId = null;
let _aScore = 0;
let _bScore = 0;
let _unsubscribe = null;

// ─── Judge ID persistente por tab ─────────────────────────────────────────────
function getOrCreateJudgeId() {
  let id = sessionStorage.getItem("wbm_judgeId");
  if (!id) {
    id = "J-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    sessionStorage.setItem("wbm_judgeId", id);
  }
  return id;
}

// ─── Escape helpers ──────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])
  );
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export async function initJudgeMode(sessionId) {
  _sessionId = sessionId;
  _judgeId = getOrCreateJudgeId();
  _judgeName = sessionStorage.getItem("wbm_judgeName") || "";

  // Ocultar vistas admin, mostrar vista juez
  ["view-registration", "view-groups", "view-knockout", "view-winner"].forEach((id) => {
    document.getElementById(id)?.classList.add("hidden");
  });
  const viewEl = document.getElementById("view-judge");
  viewEl?.classList.remove("hidden");

  renderJudgeStatus("Conectando a Firebase...");

  const result = await loadSessionForJudge(sessionId);

  if (!result.ok) {
    renderJudgeStatus(
      result.reason === "session_not_found"
        ? "❌ Sesión no encontrada o ya finalizada."
        : `❌ Error: ${result.reason}`
    );
    return;
  }

  _snapshot = result.snapshot;
  _matches = result.matches || {};

  renderJudgeView();

  // Suscribir a cambios en tiempo real
  _unsubscribe = await subscribeToMatchesForJudge(sessionId, (newMatches) => {
    _matches = newMatches || {};
    // Si estoy en combate activo y otro juez o admin lo cambió, actualizar estado local
    if (_activeMatchId) {
      const m = findFbMatch(_activeMatchId);
      if (m && m.status === "corrected_by_admin") {
        // Admin corrigió — abandonar combate activo
        _activeMatchId = null;
      }
    }
    refreshMatchList();
  });

  bindWindowHandlers();
}

function findFbMatch(matchId) {
  return Object.values(_matches).find((m) => m.matchId === matchId) || null;
}

// ─── Render principal ─────────────────────────────────────────────────────────
function renderJudgeStatus(msg) {
  const el = document.getElementById("view-judge");
  if (el) el.innerHTML = `<div class="judge-container"><p class="judge-status-msg">${esc(msg)}</p></div>`;
}

function renderJudgeView() {
  const el = document.getElementById("view-judge");
  if (!el) return;

  el.innerHTML = `
    <div class="judge-container">
      <div class="judge-header">
        <div class="judge-header-title">Modo Juez</div>
        <div class="judge-session-badge">Sesión: ${esc(_sessionId)}</div>
      </div>

      <div class="judge-name-row">
        <input
          type="text"
          id="judge-name-input"
          class="input-dark"
          style="flex:1;margin:0;"
          placeholder="Tu nombre (opcional)"
          value="${esc(_judgeName)}"
        />
        <button class="btn btn-ghost btn-small" id="btn-judge-set-name">Guardar</button>
      </div>

      <div id="judge-main-content">
        ${_activeMatchId ? buildActiveMatchHtml() : buildGroupsListHtml()}
      </div>
    </div>
  `;

  attachJudgeEventListeners();
}

function refreshMatchList() {
  // Actualiza solo la sección de combates sin re-renderizar todo
  const content = document.getElementById("judge-main-content");
  if (!content) return;

  if (_activeMatchId) {
    content.innerHTML = buildActiveMatchHtml();
  } else {
    content.innerHTML = buildGroupsListHtml();
  }
  attachMatchButtons();
}

// ─── HTML builders ────────────────────────────────────────────────────────────
function buildGroupsListHtml() {
  if (!_snapshot?.groups?.length) {
    return '<p class="judge-status-msg muted">Sin grupos disponibles.</p>';
  }

  return _snapshot.groups
    .map((g) => {
      const groupMatches = Object.values(_matches)
        .filter((m) => m.groupId === g.id)
        .sort((a, b) => String(a.matchId).localeCompare(String(b.matchId)));

      const pending = groupMatches.filter((m) => (m.status ?? "pending") === "pending").length;

      return `
        <div class="judge-group-card">
          <div class="judge-group-header">
            <span class="judge-group-name">Grupo ${esc(g.name)}</span>
            <span class="judge-group-badge ${pending > 0 ? "judge-group-badge--active" : ""}">
              ${pending} pendiente${pending !== 1 ? "s" : ""}
            </span>
          </div>
          <div class="judge-match-list">
            ${groupMatches.map(buildMatchRowHtml).join("") || '<p class="muted tiny" style="padding:8px 0;">Sin combates</p>'}
          </div>
        </div>
      `;
    })
    .join("");
}

function buildMatchRowHtml(m) {
  const status = m.status ?? "pending";
  const isMine = m.judgeId === _judgeId;

  let badgeHtml = "";
  let actionHtml = "";

  if (status === "pending") {
    badgeHtml = `<span class="judge-badge judge-badge--pending">Pendiente</span>`;
    actionHtml = `<button class="btn btn-primary btn-small judge-claim-btn" data-match-id="${esc(m.matchId)}">Tomar</button>`;
  } else if (status === "in_progress") {
    if (isMine) {
      badgeHtml = `<span class="judge-badge judge-badge--mine">En juego (vos)</span>`;
      actionHtml = `<button class="btn btn-warning btn-small judge-resume-btn" data-match-id="${esc(m.matchId)}">Continuar</button>`;
    } else {
      badgeHtml = `<span class="judge-badge judge-badge--inprogress">En juego — ${esc(m.judgeName || "otro juez")}</span>`;
    }
  } else if (status === "completed" || status === "corrected_by_admin") {
    badgeHtml = `<span class="judge-badge judge-badge--done">✓ ${m.aScore ?? 0} : ${m.bScore ?? 0}</span>`;
  } else if (status === "locked") {
    badgeHtml = `<span class="judge-badge judge-badge--locked">Bloqueado</span>`;
  }

  return `
    <div class="judge-match-row">
      <div class="judge-match-names">${esc(m.aName)} <span class="judge-vs-sep">vs</span> ${esc(m.bName)}</div>
      <div class="judge-match-meta">
        ${badgeHtml}
        ${actionHtml}
      </div>
    </div>
  `;
}

function buildActiveMatchHtml() {
  const m = findFbMatch(_activeMatchId);
  if (!m) return buildGroupsListHtml();

  const aWins = _aScore >= WIN_THRESHOLD && _aScore > _bScore;
  const bWins = _bScore >= WIN_THRESHOLD && _bScore > _aScore;
  const canSubmit = aWins || bWins;

  return `
    <div class="judge-active-match">
      <div class="judge-active-header">
        <span class="judge-active-title">Combate en curso</span>
        <button class="btn btn-ghost btn-small" id="btn-judge-abandon">Abandonar</button>
      </div>

      <div class="judge-active-players">
        <div class="judge-active-player ${aWins ? "judge-active-player--winner" : ""}">
          <div class="judge-player-name">${esc(m.aName)}</div>
          <div class="judge-score-controls">
            <button class="btn judge-score-btn" id="btn-a-minus">−</button>
            <div class="judge-score-display ${aWins ? "judge-score--winner" : ""}" id="score-a-judge">${_aScore}</div>
            <button class="btn judge-score-btn" id="btn-a-plus">+</button>
          </div>
        </div>

        <div class="judge-vs-divider">VS</div>

        <div class="judge-active-player ${bWins ? "judge-active-player--winner" : ""}">
          <div class="judge-player-name">${esc(m.bName)}</div>
          <div class="judge-score-controls">
            <button class="btn judge-score-btn" id="btn-b-minus">−</button>
            <div class="judge-score-display ${bWins ? "judge-score--winner" : ""}" id="score-b-judge">${_bScore}</div>
            <button class="btn judge-score-btn" id="btn-b-plus">+</button>
          </div>
        </div>
      </div>

      <button
        class="btn btn-success w-100"
        style="margin-top:20px; font-size:1.1rem; padding:14px;"
        id="btn-judge-submit"
        ${canSubmit ? "" : "disabled"}
      >
        Guardar Resultado
      </button>

      ${!canSubmit ? '<p class="muted tiny" style="text-align:center;margin-top:8px;">Alguien debe llegar a 4 puntos para guardar</p>' : ""}
    </div>
  `;
}

// ─── Event listeners ──────────────────────────────────────────────────────────
function attachJudgeEventListeners() {
  document.getElementById("btn-judge-set-name")?.addEventListener("click", () => {
    const input = document.getElementById("judge-name-input");
    _judgeName = input ? input.value.trim() : "";
    sessionStorage.setItem("wbm_judgeName", _judgeName);
  });

  attachMatchButtons();
}

function attachMatchButtons() {
  // Claim buttons
  document.querySelectorAll(".judge-claim-btn").forEach((btn) => {
    btn.addEventListener("click", () => judgeClaim(btn.dataset.matchId));
  });

  // Resume buttons
  document.querySelectorAll(".judge-resume-btn").forEach((btn) => {
    btn.addEventListener("click", () => judgeResume(btn.dataset.matchId));
  });

  // Active match controls
  document.getElementById("btn-judge-abandon")?.addEventListener("click", judgeAbandon);
  document.getElementById("btn-judge-submit")?.addEventListener("click", judgeSubmit);
  document.getElementById("btn-a-minus")?.addEventListener("click", () => judgeAdjust(0, -1));
  document.getElementById("btn-a-plus")?.addEventListener("click", () => judgeAdjust(0, 1));
  document.getElementById("btn-b-minus")?.addEventListener("click", () => judgeAdjust(1, -1));
  document.getElementById("btn-b-plus")?.addEventListener("click", () => judgeAdjust(1, 1));
}

// ─── Acciones del juez ────────────────────────────────────────────────────────
async function judgeClaim(matchId) {
  const judge = { judgeId: _judgeId, judgeName: _judgeName || _judgeId };
  const result = await claimMatchAsJudge(_sessionId, matchId, judge);
  if (!result.ok) {
    alert(result.reason === "match_not_available" ? "Este combate ya fue tomado" : `Error: ${result.reason}`);
    return;
  }
  _activeMatchId = matchId;
  _aScore = 0;
  _bScore = 0;
  refreshMatchList();
}

function judgeResume(matchId) {
  const m = findFbMatch(matchId);
  _activeMatchId = matchId;
  _aScore = m ? Number(m.aScore ?? 0) : 0;
  _bScore = m ? Number(m.bScore ?? 0) : 0;
  refreshMatchList();
}

async function judgeAbandon() {
  if (!_activeMatchId) return;
  await releaseMatchAsJudge(_sessionId, _activeMatchId, _judgeId);
  _activeMatchId = null;
  refreshMatchList();
}

function judgeAdjust(side, delta) {
  if (side === 0) {
    const maxA = _bScore >= WIN_THRESHOLD ? LOSER_MAX : MAX_SCORE;
    _aScore = Math.max(0, Math.min(maxA, _aScore + delta));
  } else {
    const maxB = _aScore >= WIN_THRESHOLD ? LOSER_MAX : MAX_SCORE;
    _bScore = Math.max(0, Math.min(maxB, _bScore + delta));
  }

  const aWins = _aScore >= WIN_THRESHOLD && _aScore > _bScore;
  const bWins = _bScore >= WIN_THRESHOLD && _bScore > _aScore;

  // Actualizar displays sin re-render completo
  const scoreA = document.getElementById("score-a-judge");
  const scoreB = document.getElementById("score-b-judge");
  if (scoreA) {
    scoreA.textContent = _aScore;
    scoreA.className = `judge-score-display ${aWins ? "judge-score--winner" : ""}`;
  }
  if (scoreB) {
    scoreB.textContent = _bScore;
    scoreB.className = `judge-score-display ${bWins ? "judge-score--winner" : ""}`;
  }

  const submitBtn = document.getElementById("btn-judge-submit");
  if (submitBtn) submitBtn.disabled = !aWins && !bWins;

  const players = document.querySelectorAll(".judge-active-player");
  players[0]?.classList.toggle("judge-active-player--winner", aWins);
  players[1]?.classList.toggle("judge-active-player--winner", bWins);
}

async function judgeSubmit() {
  const aWins = _aScore >= WIN_THRESHOLD && _aScore > _bScore;
  const bWins = _bScore >= WIN_THRESHOLD && _bScore > _aScore;
  if (!aWins && !bWins) return;

  const submitBtn = document.getElementById("btn-judge-submit");
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Guardando..."; }

  const result = await submitMatchResultAsJudge(
    _sessionId,
    _activeMatchId,
    { aScore: _aScore, bScore: _bScore },
    _judgeId
  );

  if (!result.ok) {
    alert(`Error al guardar: ${result.reason}`);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Guardar Resultado"; }
    return;
  }

  _activeMatchId = null;
  _aScore = 0;
  _bScore = 0;
  refreshMatchList();
}

// Expose window handlers para compatibilidad (no necesario con event listeners, pero por si acaso)
function bindWindowHandlers() {
  // Vacío — todos los handlers están como event listeners
}
