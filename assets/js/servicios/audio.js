// assets/js/servicios/audio.js
let audioCtx = null;
let masterGain = null;

let isMuted = false;
const DEFAULT_VOL = 0.12;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = DEFAULT_VOL;
    masterGain.connect(audioCtx.destination);
  }
  return audioCtx;
}

function setMasterVolume(vol) {
  if (!masterGain) return;
  masterGain.gain.value = Math.max(0, Math.min(1, Number(vol)));
}

export function toggleMute() {
  isMuted = !isMuted;

  const icon = document.getElementById("sound-icon");
  if (icon) icon.innerText = isMuted ? "🔇" : "🔊";

  // Si ya existe el contexto, suspendemos al mutear para evitar ruidos/CPU
  if (audioCtx) {
    if (isMuted) audioCtx.suspend?.();
    else audioCtx.resume?.();
  }
}

function playTone(freq, type, duration, delay = 0) {
  if (isMuted) return;

  const ctx = getCtx();

  // iOS/Chrome: puede estar suspendido hasta gesto del usuario
  if (ctx.state === "suspended") ctx.resume?.();

  const t0 = ctx.currentTime + delay;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);

  // Attack corto para evitar "click/pop"
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(0.09, t0 + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(gain);
  gain.connect(masterGain);

  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const SoundFX = {
  click: () => playTone(560, "square", 0.06),
  add: () => playTone(740, "triangle", 0.09),
  error: () => playTone(160, "sawtooth", 0.12),
  win: () => {
    playTone(523, "triangle", 0.10, 0);
    playTone(659, "triangle", 0.12, 0.10);
    playTone(784, "triangle", 0.14, 0.22);
  },

  // opcional si quieres ajustar volumen
  setVolume: (v) => setMasterVolume(v),
};
