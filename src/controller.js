// src/controller.js
import { createStore } from "./model.js";
import { getEls, showView } from "./view.js";

const store = createStore();
const els = getEls();

function bootstrap() {
  store.loadState();
  bindEvents();
  render();
}

function bindEvents() {
  // Enter agrega jugador
  els.inputPlayer?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      // TODO: store.addPlayer(...)
    }
  });

  // TODO: bind botones con addEventListener en lugar de onclick inline
}

function render() {
  const state = store.getState();
  showView(els, state.phase);

  // TODO: switch por fase y llamar renderers
  // if (state.phase === "registration") renderRegistration(...)
}

bootstrap();
