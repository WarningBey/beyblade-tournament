// assets/js/ui/eventos.js
import { addPlayer, updateGroupCount, setRounds } from "../dominio/torneo.js";
import { closeToss } from "../servicios/confeti.js";

export function registrarEventosUI() {
  // Enter en input de jugador -> agregar (con guard para no duplicar)
  const input = document.getElementById("input-player");
  if (input && !input.dataset.enterHooked) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addPlayer();
    });
    input.dataset.enterHooked = "1";
  }

  // Escape -> cerrar modal sorteo
  if (!document.body.dataset.escapeHooked) {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeToss();
    });
    document.body.dataset.escapeHooked = "1";
  }

  // Slider grupos
  const slider = document.getElementById("group-slider");
  if (slider && !slider.dataset.hooked) {
    slider.addEventListener("input", (e) => {
      const val = e.target.value;
      // preferimos llamar directo al módulo, no a window
      updateGroupCount(val);
    });
    slider.dataset.hooked = "1";
  }

  // Rondas
  const rounds = document.getElementById("rounds-input");
  if (rounds && !rounds.dataset.hooked) {
    rounds.addEventListener("change", (e) => {
      const val = e.target.value;
      setRounds(val);
    });
    rounds.dataset.hooked = "1";
  }
}
