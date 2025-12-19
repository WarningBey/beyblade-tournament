// src/controller.js
import { createStore, POINTS_TO_WIN } from "./model.js";
import { getEls, showView, showToast } from "./view.js";

const store = createStore();
const els = getEls();

// ---------------------------
// Bootstrap
// ---------------------------
bootstrap();

function bootstrap() {
  store.loadState();
  bindEvents();
  renderAll();
}

// ---------------------------
// Events
// ---------------------------
function bindEvents() {
  // Enter agrega jugador
  els.inputPlayer?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") addPlayer();
  });

  els.btnAddPlayer?.addEventListener("click", addPlayer);

  els.btnStart?.addEventListener("click", generateGroups);

  els.groupSlider?.addEventListener("input", () => {
    updateGroupCount(els.groupSlider.value);
    store.update(s => { s.desiredGroupCount = parseInt(els.groupSlider.value, 10) || 1; });
    // no toast aquí, solo UX
  });

  els.roundsInput?.addEventListener("change", () => {
    validateRounds();
    store.update(s => { s.roundsSetting = parseInt(els.roundsInput.value, 10) || 1; });
    // no toast aquí, solo UX
  });

  els.knockoutSizeSelect?.addEventListener("change", () => {
    renderGlobalStandings();
  });

  els.btnToKnockout?.addEventListener("click", startKnockout);

  els.btnAdvance?.addEventListener("click", advanceRound);

  els.btnBackup?.addEventListener("click", downloadBackup);

  els.btnHome?.addEventListener("click", goHome);

  els.btnNewTournament?.addEventListener("click", () => hardReset(true));

  // Delegación: remove player (click en X)
  els.playersList?.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("[data-remove-player]");
    if (!btn) return;
    const id = Number(btn.getAttribute("data-remove-player"));
    removePlayer(id);
  });

  // Delegación: score buttons (grupos)
  els.groupsContainer?.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("[data-score]");
    if (!btn) return;

    const gId = Number(btn.getAttribute("data-gid"));
    const mId = btn.getAttribute("data-mid");
    const pNum = Number(btn.getAttribute("data-pnum"));
    const delta = Number(btn.getAttribute("data-delta"));

    adjustScore(gId, mId, pNum, delta);
  });

  // Delegación: score buttons (knockout)
  els.bracketContainer?.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("[data-koscore]");
    if (!btn) return;

    const rIdx = Number(btn.getAttribute("data-ridx"));
    const mIdx = Number(btn.getAttribute("data-midx"));
    const pNum = Number(btn.getAttribute("data-pnum"));
    const delta = Number(btn.getAttribute("data-delta"));

    adjustKnockoutScore(rIdx, mIdx, pNum, delta);
  });
}

// ---------------------------
// Navigation / Reset
// ---------------------------
function goHome() {
  const state = store.getState();
  if (state.players.length > 0) {
    if (confirm("¿Deseas volver al inicio?\n\n¡CUIDADO! Se borrará todo el progreso actual.")) {
      hardReset(true);
    }
  } else {
    hardReset(true);
  }
}

function hardReset(force = false) {
  if (!force && !confirm("¿Estás seguro de borrar todo y empezar de cero?")) return;
  store.reset();
  window.location.reload();
}

// ---------------------------
// Registration
// ---------------------------
function addPlayer() {
  const input = els.inputPlayer;
  if (!input) return;

  const name = input.value.trim();
  if (!name) return;

  store.update((s) => {
    s.players.push({ id: Date.now(), name });

    // Ajusta automáticamente el número de grupos sugerido
    const maxGroups = Math.max(1, Math.floor(s.players.length / 2));
    if (s.desiredGroupCount > maxGroups) s.desiredGroupCount = maxGroups;

    // Persist roundsSetting (si input existe)
    const r = parseInt(els.roundsInput?.value || `${s.roundsSetting}`, 10);
    if (Number.isFinite(r)) s.roundsSetting = r;
  });

  input.value = "";
  input.focus();

  showToast(els, "Jugador agregado");
  renderAll();
}

function removePlayer(id) {
  store.update((s) => {
    s.players = s.players.filter(p => p.id !== id);
    const maxGroups = Math.max(1, Math.floor(s.players.length / 2));
    if (s.desiredGroupCount > maxGroups) s.desiredGroupCount = maxGroups;
  });

  showToast(els, "Jugador eliminado");
  renderAll();
}

// ---------------------------
// Groups config UI helpers
// ---------------------------
function updateGroupCount(val) {
  const state = store.getState();
  const groups = parseInt(val, 10) || 1;

  if (els.groupCountDisplay) els.groupCountDisplay.textContent = String(groups);

  const perGroup = state.players.length / groups;
  const maxP = Math.ceil(perGroup);

  // Berger: si impar, sumar fantasma
  const effectiveSize = (maxP % 2 === 0) ? maxP : (maxP + 1);
  const maxRounds = Math.max(1, effectiveSize - 1);

  if (els.roundsInput) {
    els.roundsInput.max = String(maxRounds);

    const cur = parseInt(els.roundsInput.value, 10) || 1;
    if (cur > maxRounds) els.roundsInput.value = String(maxRounds);
    if (cur < 1) els.roundsInput.value = "1";
  }
  if (els.roundsMaxMsg) els.roundsMaxMsg.textContent = `(Máx: ${maxRounds})`;
}

function validateRounds() {
  if (!els.roundsInput) return;
  const max = parseInt(els.roundsInput.max || "1", 10) || 1;
  let v = parseInt(els.roundsInput.value || "1", 10);
  if (!Number.isFinite(v)) v = 1;
  if (v > max) v = max;
  if (v < 1) v = 1;
  els.roundsInput.value = String(v);
}

// ---------------------------
// Generate groups (Berger)
// ---------------------------
function generateGroups() {
  const state = store.getState();
  if (state.players.length < 2) return;

  const numGroups = state.desiredGroupCount || 1;
  const roundsLimit = parseInt(els.roundsInput?.value || `${state.roundsSetting}`, 10) || 1;

  store.update((s) => {
    // 1) Shuffle
    const shuffled = [...s.players].sort(() => 0.5 - Math.random());

    // 2) Groups
    s.groups = Array.from({ length: numGroups }, (_, i) => ({
      id: i,
      name: `Grupo ${String.fromCharCode(65 + i)}`,
      players: [],
      matches: [],
    }));

    // 3) Snake distribution (simple i % groups)
    shuffled.forEach((p, i) => {
      s.groups[i % numGroups].players.push({ ...p, stats: { wins: 0, pts: 0 } });
    });

    // 4) Berger matches
    s.groups.forEach((g) => {
      const pList = [...g.players];
      if (pList.length % 2 !== 0) pList.push({ id: "GHOST", isGhost: true });

      const N = pList.length;
      let indices = pList.map((_, i) => i);

      for (let r = 0; r < Math.min(roundsLimit, N - 1); r++) {
        for (let i = 0; i < N / 2; i++) {
          const p1 = pList[indices[i]];
          const p2 = pList[indices[N - 1 - i]];
          if (!p1?.isGhost && !p2?.isGhost) {
            g.matches.push({
              id: `${g.id}-R${r}-${p1.id}-${p2.id}`,
              p1Id: p1.id, p1Name: p1.name,
              p2Id: p2.id, p2Name: p2.name,
              s1: 0, s2: 0, played: false,
            });
          }
        }
        indices.splice(1, 0, indices.pop());
      }
    });

    s.phase = "groups";
    s.roundsSetting = roundsLimit;
  });

  showToast(els, "Torneo iniciado");
  renderAll();
}

// ---------------------------
// Score (groups)
// ---------------------------
function adjustScore(gId, mId, playerNum, delta) {
  store.update((s) => {
    const group = s.groups.find(g => g.id === gId);
    if (!group) return;

    const match = group.matches.find(m => m.id === mId);
    if (!match) return;

    if (playerNum === 1) match.s1 = clamp(match.s1 + delta, 0, 6);
    else match.s2 = clamp(match.s2 + delta, 0, 6);

    match.played = true;

    // Recalc stats
    group.players.forEach(p => { p.stats.wins = 0; p.stats.pts = 0; });

    group.matches.forEach(m => {
      const p1 = group.players.find(p => p.id === m.p1Id);
      const p2 = group.players.find(p => p.id === m.p2Id);
      if (!p1 || !p2) return;

      p1.stats.pts += m.s1;
      p2.stats.pts += m.s2;

      if (m.s1 >= POINTS_TO_WIN && m.s1 > m.s2) p1.stats.wins++;
      else if (m.s2 >= POINTS_TO_WIN && m.s2 > m.s1) p2.stats.wins++;
    });
  });

  renderGroups();
  renderGlobalStandings();
}

// ---------------------------
// Knockout
// ---------------------------
function updateKnockoutSelector() {
  const state = store.getState();
  const select = els.knockoutSizeSelect;
  if (!select) return;

  select.innerHTML = "";

  const total = state.players.length;
  let val = 2;
  const powers = [];
  while (val <= total) { powers.push(val); val *= 2; }

  powers.forEach(p => {
    const opt = document.createElement("option");
    opt.value = String(p);
    opt.textContent = `Top ${p}`;
    select.appendChild(opt);
  });

  if (powers.length > 0) select.value = String(powers[powers.length - 1]);
}

function startKnockout() {
  const state = store.getState();
  const targetCount = parseInt(els.knockoutSizeSelect?.value || "2", 10);

  store.update((s) => {
    let allPlayers = [];
    s.groups.forEach(g => allPlayers.push(...g.players));

    allPlayers.sort((a, b) => (b.stats.wins - a.stats.wins) || (b.stats.pts - a.stats.pts));
    const qualified = allPlayers.slice(0, targetCount);

    const matches = [];
    for (let i = 0; i < qualified.length / 2; i++) {
      matches.push({
        id: `KO_R1_${i}`,
        p1: qualified[i],
        p2: qualified[qualified.length - 1 - i],
        s1: 0, s2: 0, winner: null,
      });
    }

    s.knockoutMatches = [{ round: 1, matches }];
    s.phase = "knockout";
  });

  showToast(els, "Llaves generadas");
  renderAll();
}

function adjustKnockoutScore(rIdx, mIdx, pNum, delta) {
  store.update((s) => {
    const round = s.knockoutMatches[rIdx];
    if (!round) return;

    const match = round.matches[mIdx];
    if (!match) return;

    // bloquear si ya tiene ganador (igual que tu lógica opcional)
    if (match.winner) return;

    if (pNum === 1) match.s1 = clamp(match.s1 + delta, 0, 6);
    else match.s2 = clamp(match.s2 + delta, 0, 6);

    if (match.s1 >= POINTS_TO_WIN && match.s1 > match.s2) match.winner = match.p1;
    else if (match.s2 >= POINTS_TO_WIN && match.s2 > match.s1) match.winner = match.p2;
    else match.winner = null;
  });

  renderBracket();
}

function advanceRound() {
  const state = store.getState();
  const curRound = state.knockoutMatches[state.knockoutMatches.length - 1];
  if (!curRound) return;

  if (curRound.matches.some(m => !m.winner)) {
    alert("Faltan combates por terminar (4 puntos min).");
    return;
  }

  // Final simple (solo 1 match y no es third)
  if (curRound.matches.length === 1 && !curRound.matches[0].isThird) {
    store.update(s => { s.phase = "winner"; });
    renderAll();
    return;
  }

  // Si es ronda de finales (final + third)
  if (curRound.matches.some(m => m.isFinal)) {
    store.update(s => { s.phase = "winner"; });
    renderAll();
    return;
  }

  store.update((s) => {
    const current = s.knockoutMatches[s.knockoutMatches.length - 1];
    const winners = current.matches.map(m => m.winner);

    // Semis => finales
    if (current.matches.length === 2) {
      const m1 = current.matches[0];
      const m2 = current.matches[1];

      const w1 = m1.winner;
      const w2 = m2.winner;

      const l1 = (m1.winner.id === m1.p1.id) ? m1.p2 : m1.p1;
      const l2 = (m2.winner.id === m2.p1.id) ? m2.p2 : m2.p1;

      s.knockoutMatches.push({
        round: s.knockoutMatches.length + 1,
        label: "Finales",
        matches: [
          { id: "FINAL", p1: w1, p2: w2, s1: 0, s2: 0, winner: null, isFinal: true },
          { id: "THIRD", p1: l1, p2: l2, s1: 0, s2: 0, winner: null, isThird: true },
        ],
      });
      return;
    }

    // Normal: armar siguiente ronda con ganadores
    const nextMatches = [];
    for (let i = 0; i < winners.length; i += 2) {
      nextMatches.push({
        id: `KO_R${s.knockoutMatches.length}_${i}`,
        p1: winners[i],
        p2: winners[i + 1],
        s1: 0, s2: 0, winner: null,
      });
    }

    s.knockoutMatches.push({ round: s.knockoutMatches.length + 1, matches: nextMatches });
  });

  renderAll();
}

// ---------------------------
// Rendering (all)
// ---------------------------
function renderAll() {
  const state = store.getState();
  showView(els, state.phase);

  if (state.phase === "registration") {
    renderRegistration();
  } else if (state.phase === "groups") {
    updateKnockoutSelector();
    renderGroups();
    renderGlobalStandings();
  } else if (state.phase === "knockout") {
    renderBracket();
  } else if (state.phase === "winner") {
    renderWinnerView();
  }
}

function renderRegistration() {
  const state = store.getState();

  // counter
  if (els.playerCounter) els.playerCounter.textContent = String(state.players.length);

  // list
  if (!els.playersList) return;
  els.playersList.innerHTML = "";

  if (state.players.length === 0) {
    els.playersList.innerHTML = `<p class="placeholder text-center">Agrega jugadores para comenzar</p>`;
  } else {
    state.players.forEach(p => {
      const el = document.createElement("div");
      el.className = "player-item";
      el.innerHTML = `
        <span>${escapeHtml(p.name)}</span>
        <span class="player-remove" data-remove-player="${p.id}">✕</span>
      `;
      els.playersList.appendChild(el);
    });
  }

  // config visibility
  if (state.players.length >= 2) {
    els.groupConfig?.classList.remove("hidden");
    if (els.btnStart) els.btnStart.disabled = false;

    const maxGroups = Math.max(1, Math.floor(state.players.length / 2));
    if (els.groupSlider) {
      els.groupSlider.max = String(maxGroups);
      els.groupSlider.value = String(state.desiredGroupCount);
    }
    if (els.roundsInput) {
      els.roundsInput.value = String(state.roundsSetting || 1);
    }
    updateGroupCount(state.desiredGroupCount);
  } else {
    els.groupConfig?.classList.add("hidden");
    if (els.btnStart) els.btnStart.disabled = true;
  }
}

function renderGlobalStandings() {
  const state = store.getState();
  const tbody = els.globalStandingsBody;
  const selector = els.knockoutSizeSelect;
  if (!tbody || !selector) return;

  const cutoff = parseInt(selector.value || "2", 10) || 2;

  let allPlayers = [];
  state.groups.forEach(g => {
    g.players.forEach(p => allPlayers.push({ ...p, groupName: g.name }));
  });

  allPlayers.sort((a, b) => (b.stats.wins - a.stats.wins) || (b.stats.pts - a.stats.pts));

  tbody.innerHTML = "";

  allPlayers.forEach((p, idx) => {
    const tr = document.createElement("tr");
    if (idx < cutoff) tr.classList.add("qualified");
    if (idx === cutoff - 1 && idx < allPlayers.length - 1) tr.classList.add("cut-line");

    tr.innerHTML = `
      <td style="color:var(--text-muted); font-weight:bold;">${idx + 1}</td>
      <td style="font-weight:bold;">${escapeHtml(p.name)}</td>
      <td style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(p.groupName)}</td>
      <td class="text-center" style="color:${p.stats.wins > 0 ? "var(--success)" : ""}">${p.stats.wins}</td>
      <td class="text-center" style="color:var(--gold); font-family:monospace;">${p.stats.pts}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderGroups() {
  const state = store.getState();
  const container = els.groupsContainer;
  if (!container) return;
  container.innerHTML = "";

  state.groups.forEach(g => {
    const sorted = [...g.players].sort((a, b) => (b.stats.wins - a.stats.wins) || (b.stats.pts - a.stats.pts));

    let matchesHTML = g.matches.length
      ? ""
      : `<div class="text-center" style="padding:10px; color:gray;">Sin partidos</div>`;

    g.matches.forEach(m => {
      const done = (m.s1 >= POINTS_TO_WIN || m.s2 >= POINTS_TO_WIN);
      const p1Win = done && m.s1 > m.s2;
      const p2Win = done && m.s2 > m.s1;

      matchesHTML += `
        <div class="match-row" style="background:${done ? "rgba(0,0,0,0.2)" : "transparent"}">
          <div style="flex:1; text-align:right; font-weight:${p1Win ? "bold" : "normal"}; color:${p1Win ? "var(--success)" : "white"};" class="player-name-match">
            ${escapeHtml(m.p1Name)}
          </div>

          <div style="display:flex; gap:8px; align-items:center; margin:0 10px;">
            <div class="score-wrapper">
              <button class="btn-score" data-score data-gid="${g.id}" data-mid="${m.id}" data-pnum="1" data-delta="-1">-</button>
              <div class="score-display ${p1Win ? "winner" : ""}">${m.s1}</div>
              <button class="btn-score" data-score data-gid="${g.id}" data-mid="${m.id}" data-pnum="1" data-delta="1">+</button>
            </div>

            <span style="color:gray; font-weight:bold;">:</span>

            <div class="score-wrapper">
              <button class="btn-score" data-score data-gid="${g.id}" data-mid="${m.id}" data-pnum="2" data-delta="-1">-</button>
              <div class="score-display ${p2Win ? "winner" : ""}">${m.s2}</div>
              <button class="btn-score" data-score data-gid="${g.id}" data-mid="${m.id}" data-pnum="2" data-delta="1">+</button>
            </div>
          </div>

          <div style="flex:1; text-align:left; font-weight:${p2Win ? "bold" : "normal"}; color:${p2Win ? "var(--success)" : "white"};" class="player-name-match">
            ${escapeHtml(m.p2Name)}
          </div>
        </div>
      `;
    });

    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <div class="group-header">
        <h3 style="margin:0;">${escapeHtml(g.name)}</h3>
      </div>

      <table class="mini-table">
        <thead><tr><th>#</th><th>Blader</th><th>W</th><th>Pts</th></tr></thead>
        <tbody>
          ${sorted.map((p, i) => `
            <tr>
              <td style="color:gray;">${i + 1}</td>
              <td style="font-weight:bold;">${escapeHtml(p.name)}</td>
              <td style="color:${p.stats.wins > 0 ? "var(--success)" : "gray"}">${p.stats.wins}</td>
              <td style="color:var(--gold)">${p.stats.pts}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <div style="margin-top:10px; border-top:1px solid #334155; padding-top:10px;">
        ${matchesHTML}
      </div>
    `;
    container.appendChild(div);
  });
}

function renderBracket() {
  const state = store.getState();
  const container = els.bracketContainer;
  if (!container) return;

  container.innerHTML = "";

  const curRound = state.knockoutMatches[state.knockoutMatches.length - 1];
  if (!curRound) return;

  if (els.roundBadge) {
    els.roundBadge.textContent = curRound.label || `Ronda ${curRound.round}`;
  }

  const rIdx = state.knockoutMatches.length - 1;

  curRound.matches.forEach((m, idx) => {
    const p1Win = m.winner?.id === m.p1.id;
    const p2Win = m.winner?.id === m.p2.id;

    const label = m.isFinal ? "GRAN FINAL" : (m.isThird ? "Por el 3er Lugar" : "");
    const extraClass = m.isFinal ? "final-match" : (m.isThird ? "bronze-match" : "");

    const div = document.createElement("div");
    div.className = `match-card ${extraClass}`;
    div.innerHTML = `
      ${label ? `<div class="match-header">${label}</div>` : ""}

      <div class="match-body">
        <div class="match-player" style="text-align:right; color:${p1Win ? "var(--success)" : "white"}; opacity:${m.winner && !p1Win ? 0.5 : 1}">
          ${escapeHtml(m.p1.name)} ${p1Win ? '<div style="font-size:0.7rem">GANADOR</div>' : ""}
        </div>

        <div style="display:flex; gap:5px; align-items:center; margin:0 10px;">
          <div class="score-wrapper">
            <button class="btn-score" data-koscore data-ridx="${rIdx}" data-midx="${idx}" data-pnum="1" data-delta="-1">-</button>
            <div class="score-display ${p1Win ? "winner" : ""}">${m.s1}</div>
            <button class="btn-score" data-koscore data-ridx="${rIdx}" data-midx="${idx}" data-pnum="1" data-delta="1">+</button>
          </div>

          <div class="match-vs">VS</div>

          <div class="score-wrapper">
            <button class="btn-score" data-koscore data-ridx="${rIdx}" data-midx="${idx}" data-pnum="2" data-delta="-1">-</button>
            <div class="score-display ${p2Win ? "winner" : ""}">${m.s2}</div>
            <button class="btn-score" data-koscore data-ridx="${rIdx}" data-midx="${idx}" data-pnum="2" data-delta="1">+</button>
          </div>
        </div>

        <div class="match-player" style="text-align:left; color:${p2Win ? "var(--success)" : "white"}; opacity:${m.winner && !p2Win ? 0.5 : 1}">
          ${escapeHtml(m.p2.name)} ${p2Win ? '<div style="font-size:0.7rem">GANADOR</div>' : ""}
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

function renderWinnerView() {
  const state = store.getState();
  const finalRound = state.knockoutMatches[state.knockoutMatches.length - 1];
  if (!finalRound) return;

  const finalMatch = finalRound.matches.find(m => m.isFinal) || finalRound.matches[0];
  const bronzeMatch = finalRound.matches.find(m => m.isThird);

  if (finalMatch?.winner && els.championName) {
    els.championName.textContent = finalMatch.winner.name;
  }

  if (bronzeMatch?.winner && els.thirdPlaceContainer && els.thirdPlaceName) {
    els.thirdPlaceContainer.classList.remove("hidden");
    els.thirdPlaceName.textContent = bronzeMatch.winner.name;
  } else {
    els.thirdPlaceContainer?.classList.add("hidden");
  }
}

// ---------------------------
// Backup
// ---------------------------
function downloadBackup() {
  const state = store.getState();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
  const a = document.createElement("a");
  a.href = dataStr;
  a.download = "torneo_bey_" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  showToast(els, "Backup descargado");
}

// ---------------------------
// Helpers
// ---------------------------
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
