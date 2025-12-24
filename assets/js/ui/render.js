import { state, saveState } from "../nucleo/estado.js";

export function showToast(msg = "Guardado") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.innerText = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1500);
}

function computeMaxGroups(playerCount) {
  // regla simple y segura: evitar grupos de 1 (ideal: mínimo 2 por grupo)
  // Ej: 2->1, 3->1, 4->2, 5->2, 6->3, 7->3, 8->4 ...
  return Math.max(1, Math.floor(playerCount / 2));
}

function syncGroupSlider() {
  const slider = document.getElementById("group-slider");
  const label = document.getElementById("group-count-label");
  if (!slider || !label) return;

  const players = state.players.length;

  const maxGroups = computeMaxGroups(players);
  slider.min = "1";
  slider.max = String(maxGroups);

  // clamp value / state
  const desired = Number(state.desiredGroupCount || 1);
  const clamped = Math.max(1, Math.min(maxGroups, desired));

  state.desiredGroupCount = clamped;
  slider.value = String(clamped);
  label.textContent = String(clamped);

  // persistimos por si recarga (mínimo impacto)
  saveState();
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

  // ✅ aquí actualizamos max/value/label del slider
  if (state.players.length >= 2) {
    syncGroupSlider();
  }

  const msg = document.getElementById("rounds-max-msg");
  if (msg && !msg.textContent.trim()) {
    msg.textContent = "(Máx recom: 5)";
  }

  const btnStart = document.getElementById("btn-start");
  if (btnStart) btnStart.disabled = state.players.length < 2;
}

export function renderGroups() {
  const cont = document.getElementById("groups-container");
  if (!cont) return;

  cont.innerHTML = "";
  state.groups.forEach((g) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<h3 class="card-title">Grupo ${g.name}</h3><div id="matches-${g.id}"></div>`;
    cont.appendChild(card);

    const matches = card.querySelector(`#matches-${g.id}`);
    g.matches.forEach((m) => {
      const line = document.createElement("div");
      line.className = "row gap wrap";
      line.innerHTML = `
        <span class="pill">${escapeHtml(m.a.name)} (${m.a.score})</span>
        <span class="label">VS</span>
        <span class="pill">${escapeHtml(m.b.name)} (${m.b.score})</span>
        <button class="btn" onclick="adjustScore(${g.id}, '${m.id}', 0, 1)">+A</button>
        <button class="btn" onclick="adjustScore(${g.id}, '${m.id}', 0, -1)">-A</button>
        <button class="btn" onclick="adjustScore(${g.id}, '${m.id}', 1, 1)">+B</button>
        <button class="btn" onclick="adjustScore(${g.id}, '${m.id}', 1, -1)">-B</button>
      `;
      matches.appendChild(line);
    });
  });
}

export function renderGlobalStandings() {
  const box = document.getElementById("global-standings");
  if (!box) return;

  const rows = [...state.players]
    .map((p) => ({ ...p }))
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0));

  box.innerHTML = rows
    .map(
      (r, i) =>
        `<div class="row gap wrap"><span class="pill">#${i + 1}</span><b>${escapeHtml(
          r.name
        )}</b><span class="label">Pts: ${r.points ?? 0}</span></div>`
    )
    .join("");
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

  const round = document.getElementById("knockout-round-select")?.value;
  const matches = state.knockoutMatches.filter((m) => String(m.round) === String(round));

  cont.innerHTML = matches
    .map(
      (m) => `
    <div class="card">
      <div class="row gap wrap">
        <span class="pill">${escapeHtml(m.a.name)} (${m.a.score})</span>
        <span class="label">VS</span>
        <span class="pill">${escapeHtml(m.b.name)} (${m.b.score})</span>
      </div>
    </div>
  `
    )
    .join("");
}

export function renderWinnerView() {
  const card = document.getElementById("winner-card");
  if (!card) return;

  const w = state.winner;
  if (!w) {
    card.innerHTML = "<b>No hay ganador</b>";
    return;
  }

  card.innerHTML = `
    <h3>🏆 ${escapeHtml(w.name)}</h3>
    <p class="label">Felicitaciones</p>
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
