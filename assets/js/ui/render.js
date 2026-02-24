// assets/js/ui/render.js
import { state, saveState } from "../nucleo/estado.js";

export function showToast(msg = "Guardado") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.innerText = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1500);
}

function computeMaxGroups(playerCount) {
  return Math.max(1, Math.floor(playerCount / 2));
}

function getMaxGroupSize(playerCount, groupCount) {
  const g = Math.max(1, Number(groupCount || 1));
  return Math.ceil(Math.max(0, playerCount) / g);
}

function computeScheduleRoundsForGroups(maxGroupSize) {
  const n = Math.max(2, Number(maxGroupSize || 2));
  return n % 2 === 0 ? n - 1 : n;
}

function computeMatchesPerPlayer(maxGroupSize) {
  const n = Math.max(2, Number(maxGroupSize || 2));
  return n - 1;
}

function getTournamentFormat() {
  return "groups";
}

function syncGroupSlider() {
  const slider = document.getElementById("group-slider");
  const label = document.getElementById("group-count-label");
  if (!slider || !label) return;

  const players = state.players.length;
  const maxGroups = computeMaxGroups(players);

  slider.min = "1";
  slider.max = String(maxGroups);

  const desired = Number(state.desiredGroupCount || 1);
  const clamped = Math.max(1, Math.min(maxGroups, desired));

  state.desiredGroupCount = clamped;
  slider.value = String(clamped);
  label.textContent = String(clamped);

  saveState();
}

function applyRoundsModeUI() {
  const format = getTournamentFormat();

  const roundsRow = document.getElementById("rounds-config-row");
  const roundsInput = document.getElementById("rounds-input");
  const roundsMsg = document.getElementById("rounds-max-msg");

  if (!roundsInput) return;

  if (format === "groups") {
    const players = state.players.length;
    const groupCount = Number(state.desiredGroupCount || 1);

    const maxSize = getMaxGroupSize(players, groupCount);
    const scheduleRounds = computeScheduleRoundsForGroups(maxSize);
    const perPlayer = computeMatchesPerPlayer(maxSize);

    state.roundsSetting = scheduleRounds;

    roundsInput.value = String(scheduleRounds);
    roundsInput.disabled = true;
    roundsInput.title = "En fase de grupos el calendario es automático (todos contra todos).";

    if (roundsMsg) {
      roundsMsg.textContent = `(Cada Participante jugara: ${perPlayer} partidas)`;
    }

    roundsRow?.classList.remove("hidden");
    saveState();
    return;
  }

  roundsRow?.classList.remove("hidden");
  roundsInput.disabled = false;
  roundsInput.title = "";

  if (roundsMsg && !roundsMsg.textContent.trim()) {
    roundsMsg.textContent = "(Máx recom: 5)";
  }
}

function getAllowedTopOptions(totalPlayers) {
  const base = [2, 4, 8];
  if (totalPlayers >= 30) base.push(16);
  if (totalPlayers >= 60) base.push(32);
  if (totalPlayers >= 120) base.push(64);
  return base.filter((n) => n <= totalPlayers && n >= 2);
}

function pickDefaultTop(totalPlayers, allowed) {
  if (!allowed.length) return Math.min(2, Math.max(2, totalPlayers));
  return allowed[allowed.length - 1];
}

function syncTopSelectOptions() {
  const sel = document.getElementById("knockout-size-select");
  if (!sel) return;

  const total = Number(state.players?.length || 0);
  const allowed = getAllowedTopOptions(total);
  const safeAllowed = allowed.length ? allowed : [2];

  const currentOptions = Array.from(sel.options).map((o) => Number(o.value));
  const same =
    currentOptions.length === safeAllowed.length &&
    currentOptions.every((v, i) => v === safeAllowed[i]);

  if (!same) {
    sel.innerHTML = safeAllowed.map((n) => `<option value="${n}">Top ${n}</option>`).join("");
  }

  const currentState = Number(state.knockoutSize || 0);
  const isValid = safeAllowed.includes(currentState);

  const nextValue = isValid ? currentState : pickDefaultTop(total, safeAllowed);

  sel.value = String(nextValue);

  if (state.knockoutSize !== nextValue) {
    state.knockoutSize = nextValue;
    saveState();
  }
}

function getTopN() {
  const total = Number(state.players?.length || 0);
  const allowed = getAllowedTopOptions(total);
  const fallback = pickDefaultTop(total, allowed);

  const n = Number(state.knockoutSize || fallback);
  if (allowed.includes(n)) return n;
  return fallback;
}

export function renderPlayerList() {
  const list = document.getElementById("player-list");
  if (!list) return;

  list.innerHTML = "";
  list.className = "lista-inscritos";

  state.players.forEach((p) => {
    const item = document.createElement("div");
    item.className = "inscrito-item";

    const nombre = document.createElement("div");
    nombre.className = "inscrito-nombre";
    nombre.textContent = p.name;

    const btn = document.createElement("button");
    btn.className = "btn-x";
    btn.type = "button";
    btn.title = "Eliminar";
    btn.textContent = "×";
    btn.addEventListener("click", () => window.removePlayer(p.id));

    item.appendChild(nombre);
    item.appendChild(btn);
    list.appendChild(item);
  });

  const counter = document.getElementById("player-counter");
  if (counter) counter.textContent = String(state.players.length);

  const cfg = document.getElementById("group-config");
  if (cfg) {
    if (state.players.length >= 2) cfg.classList.remove("hidden");
    else cfg.classList.add("hidden");
  }

  if (state.players.length >= 2) syncGroupSlider();
  applyRoundsModeUI();

  const btnStart = document.getElementById("btn-start");
  if (btnStart) btnStart.disabled = state.players.length < 2;
}

export function renderGroups() {
  const cont = document.getElementById("groups-container");
  if (!cont) return;

  cont.innerHTML = "";
  const TARGET = 4;

  (state.groups || []).forEach((g) => {
    const card = document.createElement("div");
    card.className = "group-card";

    const stats = buildGroupStatsFromMatches(g);

    // Para mini-tabla por grupo: orden simple (WIN desc, PT desc, name asc)
    const tableRows = [...stats.values()]
      .sort((a, b) => (b.win - a.win) || (b.pt - a.pt) || a.name.localeCompare(b.name))
      .map((s, i) => {
        return `
          <tr>
            <td class="muted">${i + 1}</td>
            <td style="font-weight:bold;" class="${s.isGhost ? "is-ghost" : ""}">${escapeHtml(s.name)}</td>
            <td class="pt" style="font-weight:bold; color:var(--success)">${s.win}</td>
            <td class="pf">${s.pt}</td>
          </tr>
        `;
      })
      .join("");

    card.innerHTML = `
      <div class="group-card__header">
        <h3 class="group-card__title">Grupo ${escapeHtml(g.name)}</h3>
        <span class="group-card__meta">${(g.matches || []).length} matches</span>
      </div>

      <table class="mini-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Blader</th>
            <th title="Victorias" style="color:var(--success)">WIN</th>
            <th title="PT (Puntos Totales)" style="color:var(--gold)">PT</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <div class="group-matches" id="matches-${g.id}"></div>
    `;

    cont.appendChild(card);

    const matchesHost = card.querySelector(`#matches-${g.id}`);
    const matches = [...(g.matches || [])].sort((a, b) => (a.round ?? 0) - (b.round ?? 0));
    let currentRound = null;

    matches.forEach((m) => {
      const round = Number(m.round ?? 0);

      if (round && round !== currentRound) {
        currentRound = round;
        const sep = document.createElement("div");
        sep.className = "round-separator";
        sep.textContent = `RONDA ${round}`;
        matchesHost.appendChild(sep);
      }

      const line = document.createElement("div");
      line.className = "match-row";

      const aScore = m.a.score ?? 0;
      const bScore = m.b.score ?? 0;

      const aWins = aScore >= TARGET && aScore > bScore;
      const bWins = bScore >= TARGET && bScore > aScore;

      const done = aScore >= TARGET || bScore >= TARGET;

      const aGhost = !!m.a.isGhost;
      const bGhost = !!m.b.isGhost;

      line.style.background = done ? "rgba(0,0,0,0.2)" : "transparent";

      line.innerHTML = `
        <div class="match-row__name match-row__name--right player-name-match ${aGhost ? "is-ghost" : ""} ${aWins ? "winner" : ""}"
             title="${escapeHtml(m.a.name)}">
          ${escapeHtml(m.a.name)}
        </div>

        <div class="score-box">
          <button class="score-btn" onclick="adjustScore(${g.id}, '${m.id}', 0, -1)">−</button>
          <div class="score-num score-display ${aWins ? "winner" : ""}">${aScore}</div>
          <button class="score-btn" onclick="adjustScore(${g.id}, '${m.id}', 0, 1)">+</button>
        </div>

        <div class="vs-sep">:</div>

        <div class="score-box">
          <button class="score-btn" onclick="adjustScore(${g.id}, '${m.id}', 1, -1)">−</button>
          <div class="score-num score-display ${bWins ? "winner" : ""}">${bScore}</div>
          <button class="score-btn" onclick="adjustScore(${g.id}, '${m.id}', 1, 1)">+</button>
        </div>

        <div class="match-row__name match-row__name--left player-name-match ${bGhost ? "is-ghost" : ""} ${bWins ? "winner" : ""}"
             title="${escapeHtml(m.b.name)}">
          ${escapeHtml(m.b.name)}
        </div>
      `;

      matchesHost.appendChild(line);
    });
  });
}

function buildGroupStatsFromMatches(g) {
  const map = new Map();

  function ensure(id, name, isGhost = false) {
    const displayName = isGhost ? "Fantasma (F)" : name;

    if (!map.has(id)) {
      map.set(id, {
        id,
        name: displayName,
        win: 0,
        pt: 0, // ✅ PT (suma de puntos hechos en rondas)
        isGhost,
      });
    }
    return map.get(id);
  }

  (g.matches || []).forEach((m) => {
    const a = ensure(m.a.id, m.a.name, !!m.a.isGhost);
    const b = ensure(m.b.id, m.b.name, !!m.b.isGhost);

    const aScore = Number(m.a.score ?? 0);
    const bScore = Number(m.b.score ?? 0);

    a.pt += aScore;
    b.pt += bScore;

    if (aScore > bScore) a.win += 1;
    else if (bScore > aScore) b.win += 1;
  });

  return map;
}

/**
 * ✅ TABLA GENERAL (OFICIAL)
 * Orden: PT desc → PL desc → PC asc (→ WIN desc → name asc)
 *
 * Mapeo:
 * - PT = p.pf
 * - PL = p.points
 * - PC = p.pc
 */
export function renderGeneralTable() {
  const box = document.getElementById("general-table");
  if (!box) return;

  syncTopSelectOptions();

  const rows = [...(state.players || [])].map((p) => ({
    id: p.id,
    name: p.name,
    group: p.group || "-",
    PT: Number(p.pf ?? 0),
    PL: Number(p.points ?? 0),
    PC: Number(p.pc ?? 0),
    WIN: Number(p.wins ?? 0),
  }));

  rows.sort((a, b) => {
    if (b.PL !== a.PL) return b.PL - a.PL;
    if (b.PT !== a.PT) return b.PT - a.PT;
    if (a.PC !== b.PC) return a.PC - b.PC;
    if (b.WIN !== a.WIN) return b.WIN - a.WIN;
    return String(a.name).localeCompare(String(b.name), "es");
  });

  const topN = getTopN();
  const cutIndex = Math.min(topN, rows.length);

  box.innerHTML = `
    <div class="global-standings">
      <table class="global-table">
        <thead>
          <tr>
            <th style="width:44px;">#</th>
            <th>BLADER (EDITAR)</th>
            <th style="width:110px;">GRUPO</th>
            <th style="width:70px;">PL</th>
            <th style="width:70px;">PT</th>
            <th style="width:70px;">PC</th>
            <th style="width:70px;">WIN</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((r, i) => {
              const cutRow = i === cutIndex - 1 && rows.length > cutIndex ? "cut-line" : "";
              const okRow = i < cutIndex ? "qualified" : "";
              const idSafe = typeof r.id === "string" ? `'${r.id}'` : r.id;

              return `
                <tr class="${okRow} ${cutRow}">
                  <td class="muted">${i + 1}</td>
                  <td class="name-cell">
                    <span class="name">${escapeHtml(r.name)}</span>
                    <button class="edit-btn" type="button" onclick="editPlayerName(${idSafe})" title="Editar">✎</button>
                  </td>
                  <td class="muted">Grupo ${escapeHtml(r.group)}</td>
                  <td class="pf">${r.PL}</td>
                  <td class="pt">${r.PT}</td>
                  <td class="pc">${r.PC}</td>
                  <td class="win">${r.WIN}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>

      <div class="legend">
        <span class="legend-dot ok"></span> Clasifican (Top ${cutIndex})
      </div>
    </div>
  `;
}

export function renderGlobalStandings() {
  const box = document.getElementById("global-standings");
  if (!box) return;

  syncTopSelectOptions();
  const topN = getTopN();

  const rows = [...(state.players || [])]
    .map((p) => ({
      name: p.name,
      PL: Number(p.points ?? 0),
      PT: Number(p.pf ?? 0),
      PC: Number(p.pc ?? 0),
    }))
    .sort((a, b) => {
      if (b.PL !== a.PL) return b.PL - a.PL;
      if (b.PT !== a.PT) return b.PT - a.PT;
      if (a.PC !== b.PC) return a.PC - b.PC;
      return String(a.name).localeCompare(String(b.name), "es");
    })
    .slice(0, topN);

  box.innerHTML = `
    <div class="global-standings">
      <table class="global-table">
        <thead>
          <tr>
            <th style="width:44px;">#</th>
            <th>Blader</th>
            <th style="width:70px;">PL</th>
            <th style="width:70px;">PT</th>
            <th style="width:70px;">PC</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r, i) => `
            <tr>
              <td class="muted">${i + 1}</td>
              <td><strong>${escapeHtml(r.name)}</strong></td>
              <td class="pf">${r.PL}</td>
              <td class="pt">${r.PT}</td>
              <td class="pc">${r.PC}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function updateKnockoutSelector() {
  const sel = document.getElementById("knockout-round-select");
  if (!sel) return;

  const rounds = [...new Set(state.knockoutMatches.map((m) => m.round))];
  sel.innerHTML = rounds.map((r) => `<option value="${r}">${r}</option>`).join("");

  if (!sel.value && rounds[0]) sel.value = rounds[0];
}

export function renderBracket() {
  const cont = document.getElementById("knockout-container");
  if (!cont) return;

  const roundSel = document.getElementById("knockout-round-select");
  const round = Number(roundSel?.value || 1);

  const roundObj = (state.knockoutRounds || []).find((r) => Number(r.round) === round);
  const matches = roundObj?.matches || [];

  const badge = document.getElementById("round-badge");
  if (badge) badge.textContent = roundObj?.label || `Ronda ${round}`;

  cont.innerHTML = matches
    .map((m) => {
      const aS = Number(m.a.score ?? 0);
      const bS = Number(m.b.score ?? 0);

      const aWins = !!m.winner && m.winner.id === m.a.id;
      const bWins = !!m.winner && m.winner.id === m.b.id;

      const headerText =
        m.type === "FINAL"
          ? "GRAN FINAL"
          : m.type === "THIRD"
          ? "POR EL 3ER LUGAR"
          : "";

      const cardClass =
        m.type === "FINAL"
          ? "match-card match-card--final"
          : m.type === "THIRD"
          ? "match-card match-card--third"
          : "match-card";

      return `
        <div class="${cardClass}">
          ${headerText ? `<div class="match-headline">${headerText}</div>` : ""}

          <div class="match-body">
            <div class="match-player" style="text-align:right; ${aWins ? "color: var(--success);" : ""}">
              ${escapeHtml(m.a.name)}
            </div>

            <div class="match-center">
              <div class="score-wrapper">
                <button class="btn-score" onclick="adjustKnockoutScore('${m.id}', 0, -1)">-</button>
                <div class="score-display ${aWins ? "winner" : ""}">${aS}</div>
                <button class="btn-score" onclick="adjustKnockoutScore('${m.id}', 0, 1)">+</button>
              </div>

              <div class="match-vs">VS</div>

              <div class="score-wrapper">
                <button class="btn-score" onclick="adjustKnockoutScore('${m.id}', 1, -1)">-</button>
                <div class="score-display ${bWins ? "winner" : ""}">${bS}</div>
                <button class="btn-score" onclick="adjustKnockoutScore('${m.id}', 1, 1)">+</button>
              </div>
            </div>

            <div class="match-player" style="text-align:left; ${bWins ? "color: var(--success);" : ""}">
              ${escapeHtml(m.b.name)}
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

export function renderWinnerView() {
  const card = document.getElementById("winner-card");
  if (!card) return;

  const podium = state.podium;

  if (!podium?.first) {
    const w = state.winner;
    card.innerHTML = w
      ? `<div class="winner-panel">
           <div class="winner-title">🏆 GANADOR</div>
           <div class="winner-name">${escapeHtml(w.name)}</div>
         </div>`
      : "<b>No hay ganador</b>";
    return;
  }

  card.innerHTML = `
    <div class="winner-panel">
      <div class="winner-crown">👑</div>
      <div class="winner-super">GRAN CAMPEÓN</div>
      <div class="winner-name">${escapeHtml(podium.first.name)}</div>

      <div class="podium">
        <div class="podium-row">
          <div class="podium-medal">🥈</div>
          <div class="podium-label">2do Lugar</div>
          <div class="podium-player">${escapeHtml(podium.second?.name || "-")}</div>
        </div>

        <div class="podium-row">
          <div class="podium-medal">🥉</div>
          <div class="podium-label podium-label--third">3er Lugar</div>
          <div class="podium-player">${escapeHtml(podium.third?.name || "-")}</div>
        </div>
      </div>

      <div class="winner-actions">
        <button class="btn btn-ghost" onclick="hardReset(true)">Iniciar Nuevo Torneo</button>
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[m])
  );
}
