const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let arrows = [];
let targets = [];
let kills = 0;
let totalTargets = 0;
let damage = 10;
let flamingArrows = false;
let electricArrows = false;

let flameDamage = 1; // 🔥 damage per second
let bullseyeChance = 0.2;
let doubleShotChance = 0.0;

let sliding = false;
let slideProgress = 0;
let pausedForUpgrade = false;
let autoUpgrade = false;

// 🎯 Bow animation controls attack speed
let bowState = "idle";
let bowTimer = 0;
let drawDuration = 1000;  // lower = faster attack speed
let releaseDuration = 200;

// 🕒 Timer
let startTime = Date.now();
let elapsedTime = 0;

// Bow visual constants
const bowCenter = { x: 120, y: canvas.height / 2 };
const bowHeight = 150;
const arrowSpeed = 10;

function createTarget(x) {
  totalTargets++;
  const isBoss = totalTargets % 5 === 0;
  return {
    x,
    y: canvas.height / 2,
    hp: isBoss ? 150 : 50,
    maxHp: isBoss ? 150 : 50,
    width: isBoss ? 60 : 40,
    height: isBoss ? 120 : 80,
    burning: false,
    burnTimer: 0,
    isBoss,
  };
}

for (let i = 0; i < 5; i++) targets.push(createTarget(500 + i * 100));

// 🎯 Arrow spawn + aiming
function shootArrow() {
  const target = targets[0];
  if (!target) return;

  const dx = target.x - bowCenter.x;
  const dy = target.y - bowCenter.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const vx = (dx / dist) * arrowSpeed;
  const vy = (dy / dist) * arrowSpeed;

  arrows.push({ x: bowCenter.x, y: bowCenter.y, vx, vy });

  // 🎯 Chance to shoot an extra arrow
  if (Math.random() < doubleShotChance) {
    arrows.push({ x: bowCenter.x, y: bowCenter.y, vx, vy });
  }
}

// 🏹 Draw the giant bow
function drawBow(delta) {
  const drawPercent =
    bowState === "drawing"
      ? Math.min(1, bowTimer / drawDuration)
      : bowState === "releasing"
      ? 1 - Math.min(1, bowTimer / releaseDuration)
      : 0;

  const stringPull = drawPercent * 30;

  // Draw bow limbs
  ctx.strokeStyle = "brown";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(bowCenter.x, bowCenter.y - bowHeight / 2);
  ctx.quadraticCurveTo(
    bowCenter.x - 20,
    bowCenter.y,
    bowCenter.x,
    bowCenter.y + bowHeight / 2
  );
  ctx.stroke();

  // Draw bowstring
  ctx.strokeStyle = "gray";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bowCenter.x, bowCenter.y - bowHeight / 2);
  ctx.lineTo(bowCenter.x - stringPull, bowCenter.y);
  ctx.lineTo(bowCenter.x, bowCenter.y + bowHeight / 2);
  ctx.stroke();

  // Draw arrow while bow is drawn
  if (bowState !== "idle") {
    ctx.fillStyle = flamingArrows
      ? "orange"
      : electricArrows
      ? "cyan"
      : "white";
    ctx.fillRect(bowCenter.x - stringPull - 15, bowCenter.y - 2, 15, 4);
  }

  // Animation logic
  if (bowState === "drawing") {
    bowTimer += delta;
    if (bowTimer >= drawDuration) {
      bowState = "releasing";
      bowTimer = 0;
      shootArrow();
    }
  } else if (bowState === "releasing") {
    bowTimer += delta;
    if (bowTimer >= releaseDuration) {
      bowState = "idle";
      bowTimer = 0;
    }
  }

  // Restart drawing automatically
  if (!pausedForUpgrade && !sliding && bowState === "idle") {
    bowState = "drawing";
    bowTimer = 0;
  }
}

function drawTargets() {
  for (let t of targets) {
    ctx.fillStyle = t.isBoss ? "#aa0000" : t.burning ? "orange" : "red";
    ctx.fillRect(t.x, t.y - t.height / 2, t.width, t.height);
    ctx.fillStyle = "yellow";
    ctx.fillRect(t.x + t.width / 3, t.y - 10, t.width / 3, 20);
    ctx.fillStyle = "gray";
    ctx.fillRect(t.x, t.y + t.height / 2 + 5, t.width, 5);
    ctx.fillStyle = "lime";
    ctx.fillRect(t.x, t.y + t.height / 2 + 5, (t.width * t.hp) / t.maxHp, 5);
  }
}

function drawArrows() {
  for (let a of arrows) {
    ctx.fillStyle = flamingArrows ? "orange" : electricArrows ? "cyan" : "white";
    ctx.fillRect(a.x, a.y - 2, 15, 4);
  }
}

function updateArrows(delta) {
  if (pausedForUpgrade) return;

  for (let a of arrows) {
    a.x += a.vx;
    a.y += a.vy;
  }

  for (let a of arrows) {
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (
        a.x >= t.x &&
        a.x <= t.x + t.width &&
        a.y >= t.y - t.height / 2 &&
        a.y <= t.y + t.height / 2
      ) {
        const bullseye = Math.random() < bullseyeChance;
        const dmg = bullseye ? damage * 2 : damage;
        t.hp -= dmg;

        if (flamingArrows) {
          t.burning = true;
          t.burnTimer = 3;
        }

        if (electricArrows && i + 1 < targets.length) {
          targets[i + 1].hp -= damage * 0.25;
        }

        a.hit = true;
        break;
      }
    }
  }

  arrows = arrows.filter(
    (a) => !a.hit && a.x < canvas.width && a.y > 0 && a.y < canvas.height
  );
}

function updateTargets(delta) {
  if (pausedForUpgrade) return;

  // Smooth slide animation while other targets move up
  if (sliding) {
    const slideSpeed = 100 / 300; // 100px over ~0.3s
    slideProgress += delta * slideSpeed;
    for (let t of targets) t.x -= delta * slideSpeed;
    if (slideProgress >= 100) {
      sliding = false;
      slideProgress = 0;
    }
    return;
  }

  // Burn damage
  for (let t of targets) {
    if (t.burning) {
      t.hp -= flameDamage * (delta / 1000);
      t.burnTimer -= delta / 1000;
      if (t.burnTimer <= 0) t.burning = false;
    }
  }

  // Handle target destruction instantly (no pause)
  if (targets.length > 0 && targets[0].hp <= 0) {
    kills++;
    targets.shift();
    const lastX = targets.length > 0 ? targets[targets.length - 1].x : 500;
    targets.push(createTarget(lastX + 100));
    checkUpgrade();
    sliding = true;
  }
}

// 🧠 All possible upgrades
const upgradeList = [
  { name: "Draw Speed", apply: () => (drawDuration = Math.max(200, drawDuration - 150)) },
  { name: "Flaming Arrows", apply: () => (flamingArrows = true) },
  { name: "Electric Arrows", apply: () => (electricArrows = true) },
  { name: "Flame Damage", apply: () => (flameDamage += 0.5) },
  { name: "Bullseye Chance", apply: () => (bullseyeChance = Math.min(1, bullseyeChance + 0.05)) },
  { name: "Arrow Damage", apply: () => (damage += 2) },
  { name: "Double Shot", apply: () => (doubleShotChance = Math.min(1, doubleShotChance + 0.05)) },
];

function getRandomUpgrades(n = 2) {
  const copy = [...upgradeList];
  const chosen = [];
  while (chosen.length < n && copy.length > 0) {
    const index = Math.floor(Math.random() * copy.length);
    chosen.push(copy.splice(index, 1)[0]);
  }
  return chosen;
}

function checkUpgrade() {
  if (kills % 5 === 0) {
    pausedForUpgrade = true;
    const upgradeText = document.getElementById("upgrade");
    const choices = getRandomUpgrades(2);
    upgradeText.innerHTML =
      `<h2>🎁 Choose an Upgrade</h2>` +
      choices.map((u, i) => `<button id="up${i}">${u.name}</button>`).join("");

    if (autoUpgrade) {
      const randomChoice = Math.floor(Math.random() * choices.length);
      setTimeout(() => {
        choices[randomChoice].apply();
        resumeGame(`Auto: ${choices[randomChoice].name} upgraded!`);
      }, 1000);
      return;
    }

    choices.forEach((u, i) => {
      document.getElementById(`up${i}`).onclick = () => {
        u.apply();
        resumeGame(`${u.name} upgraded!`);
      };
    });
  }
}

function resumeGame(msg) {
  const upgradeText = document.getElementById("upgrade");
  upgradeText.textContent = msg;
  pausedForUpgrade = false;
}

function drawInfo() {
  elapsedTime = Date.now() - startTime;
  const totalSeconds = Math.floor(elapsedTime / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const timeString = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;

  const current = targets[0];
  const hpText = current
    ? `Target HP: ${Math.max(0, current.hp.toFixed(0))} / ${current.maxHp}`
    : "";

  document.getElementById("info").textContent =
    `⏱️ Time: ${timeString} | Kills: ${kills} | Draw Speed: ${(drawDuration / 1000).toFixed(
      2
    )}s | Damage: ${damage} | Bullseye: ${(bullseyeChance * 100).toFixed(
      0
    )}% | 🔥 ${flameDamage.toFixed(1)}/s | ⚡ ${electricArrows ? "ON" : "OFF"} | 🎯 ${hpText}`;
}

function toggleAutoUpgrade() {
  autoUpgrade = !autoUpgrade;
  document.getElementById("autoToggle").textContent =
    `Auto Upgrade: ${autoUpgrade ? "ON ✅" : "OFF ❌"}`;
}

let lastTime = performance.now();
function gameLoop(timestamp) {
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBow(delta);
  drawTargets();
  drawArrows();
  drawInfo();

  updateArrows(delta);
  updateTargets(delta);

  requestAnimationFrame(gameLoop);
}

// 🔘 Add auto-upgrade toggle button
window.onload = () => {
  const toggleBtn = document.createElement("button");
  toggleBtn.id = "autoToggle";
  toggleBtn.textContent = "Auto Upgrade: OFF ❌";
  toggleBtn.style.marginTop = "10px";
  toggleBtn.onclick = toggleAutoUpgrade;
  document.body.insertBefore(toggleBtn, document.getElementById("gameCanvas"));
};

requestAnimationFrame(gameLoop);
