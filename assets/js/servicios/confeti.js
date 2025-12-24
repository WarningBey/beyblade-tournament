// ---- MODAL SORTEO ----
export function openToss() {
  document.getElementById("toss-modal")?.classList.add("open");
  const res = document.getElementById("toss-result");
  if (res) res.innerText = "...";
}

export function closeToss() {
  document.getElementById("toss-modal")?.classList.remove("open");
}

export function spinToss() {
  const icon = document.getElementById("coin-icon");
  const res = document.getElementById("toss-result");
  if (!icon || !res) return;

  icon.classList.add("spinning");
  res.innerText = "Sorteando...";

  setTimeout(() => {
    icon.classList.remove("spinning");
    const result = Math.random() < 0.5 ? "Jugador A parte" : "Jugador B parte";
    res.innerText = result;
    fireConfettiBurst();
  }, 900);
}

// ---- CONFETI (Canvas) ----
const confettiCanvas = document.getElementById("confetti-canvas");
const ctx = confettiCanvas.getContext("2d");

let confettiParticles = [];
let confettiAnimationId = null;

function resizeCanvas() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function createConfettiParticle(isContinuous) {
  const colors = ["#eab308", "#ef4444", "#3b82f6", "#22c55e", "#ffffff"];
  return {
    x: isContinuous ? Math.random() * confettiCanvas.width : confettiCanvas.width / 2,
    y: isContinuous ? -10 : confettiCanvas.height / 2,
    size: Math.random() * 6 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    speedX: (Math.random() - 0.5) * 10,
    speedY: Math.random() * 6 + 3,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 8,
    life: 1,
  };
}

function updateConfetti() {
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

  confettiParticles.forEach((p) => {
    p.x += p.speedX;
    p.y += p.speedY;
    p.rotation += p.rotationSpeed;
    p.life -= 0.01;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((p.rotation * Math.PI) / 180);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();
  });

  confettiParticles = confettiParticles.filter((p) => p.life > 0 && p.y < confettiCanvas.height + 50);

  if (confettiParticles.length > 0) {
    confettiAnimationId = requestAnimationFrame(updateConfetti);
  } else {
    cancelAnimationFrame(confettiAnimationId);
    confettiAnimationId = null;
  }
}

export function fireConfettiBurst() {
  for (let i = 0; i < 140; i++) confettiParticles.push(createConfettiParticle(false));
  if (!confettiAnimationId) updateConfetti();
}

export function startContinuousConfetti() {
  const interval = setInterval(() => {
    for (let i = 0; i < 12; i++) confettiParticles.push(createConfettiParticle(true));
    if (!confettiAnimationId) updateConfetti();
  }, 240);

  setTimeout(() => clearInterval(interval), 2000);
}