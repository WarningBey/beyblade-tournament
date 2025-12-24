import { state, loadState } from "./estado.js";
import { STORAGE_KEY } from "./constantes.js";

export function downloadBackup() {
  try {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(state, null, 2));

    const a = document.createElement("a");
    a.href = dataStr;

    const fileName = `beyblade_torneo_${new Date().toISOString().slice(0, 10)}`;
    a.download = fileName + ".json";
    a.click();

    window.showToast?.("Archivo Exportado");
  } catch {
    alert("No se pudo exportar el archivo.");
  }
}

export function loadTournamentFile(input) {
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);

      if (data.players && data.phase && data.groups) {
        // ✅ Usar la misma key de la app
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

        // recargar state desde storage
        loadState();

        window.restoreUI?.();
        window.showToast?.("Torneo Cargado Exitosamente");
      } else {
        alert("Error: El archivo no es válido o está dañado.");
      }
    } catch {
      alert("Error al leer el archivo.");
    }
  };

  reader.readAsText(file);
  input.value = "";
}
