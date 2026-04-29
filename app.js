"use strict";

const laneNames = ["Lane 0 North", "Lane 1 East", "Lane 2 South", "Lane 3 West"];
const laneShortNames = ["North", "East", "South", "West"];
const colors = ["#d84c4c", "#2d74da", "#17a36f", "#f0b43c", "#6e7682", "#c85cb0", "#39a9b7"];

const canvas = document.getElementById("trafficCanvas");
const ctx = canvas.getContext("2d");
const clockEl = document.getElementById("clock");
const form = document.getElementById("trafficForm");
const vehicleInput = document.getElementById("vehicleInput");
const laneInputs = Array.from(document.querySelectorAll(".lane-count"));
const runButton = document.getElementById("runButton");
const pauseButton = document.getElementById("pauseButton");
const emergencyButton = document.getElementById("emergencyButton");
const emergencyLaneEl = document.getElementById("emergencyLane");
const emergencyTypeEl = document.getElementById("emergencyType");
const speedRange = document.getElementById("speedRange");
const signalStatus = document.getElementById("signalStatus");
const visibleCount = document.getElementById("visibleCount");
const modeStatus = document.getElementById("modeStatus");
const totalVehiclesEl = document.getElementById("totalVehicles");
const cycleCountEl = document.getElementById("cycleCount");
const greedyOpsEl = document.getElementById("greedyOps");
const dpOpsEl = document.getElementById("dpOps");
const greedyBar = document.getElementById("greedyBar");
const pqBar = document.getElementById("pqBar");
const dpBar = document.getElementById("dpBar");
const systemOutput = document.getElementById("systemOutput");
const scheduleList = document.getElementById("scheduleList");

const state = {
  counts: [16, 8, 11, 5],
  vehicles: [],
  signalOrder: [],
  cycleIndex: 0,
  currentGreenLane: -1,
  mode: "normal",
  status: "Ready",
  paused: false,
  activeSince: 0,
  nextCycleAt: 0,
  emergencyVehicle: null,
  emergencyLane: -1,
  emergencyType: "ambulance",
  totalInitial: 40,
  lastTime: performance.now(),
  flash: false,
  flashTimer: 0,
  layout: null
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseCountsFromText(value) {
  const matches = value
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((value) => Number.isFinite(value));

  if (matches.length === 0) {
    return null;
  }

  const counts = [0, 0, 0, 0];
  for (let index = 0; index < counts.length; index += 1) {
    counts[index] = clamp(matches[index] || 0, 0, 240);
  }
  return counts;
}

function readCounts() {
  const typedCounts = parseCountsFromText(vehicleInput.value);
  const counts = typedCounts || laneInputs.map((input) => clamp(Number.parseInt(input.value, 10) || 0, 0, 240));
  syncInputs(counts);
  return counts;
}

function syncInputs(counts) {
  laneInputs.forEach((input, index) => {
    input.value = counts[index];
  });
  vehicleInput.value = counts.join(", ");
}

function getSignalOrder(counts) {
  const queue = counts.map((count, lane) => ({ count, lane }));
  const order = [];

  while (queue.length > 0) {
    queue.sort((a, b) => {
      if (b.count === a.count) {
        return a.lane - b.lane;
      }
      return b.count - a.count;
    });

    const current = queue.shift();
    if (!current || current.count <= 0) {
      continue;
    }

    const pass = Math.min(current.count, 10);
    current.count -= pass;
    order.push(current.lane);

    if (current.count > 0) {
      queue.push(current);
    }
  }

  return order;
}

function createVehicles(counts) {
  const vehicles = [];
  let id = 0;

  counts.forEach((count, lane) => {
    for (let index = 0; index < count; index += 1) {
      vehicles.push({
        id: id += 1,
        lane,
        orderIndex: index,
        state: "queued",
        progress: 0,
        delay: 0,
        color: colors[(lane * 2 + index) % colors.length],
        kind: index % 9 === 0 ? "bus" : "car"
      });
    }
  });

  return vehicles;
}

function resetSimulation(counts, mode) {
  state.counts = counts.slice(0, 4);
  state.totalInitial = state.counts.reduce((sum, count) => sum + count, 0);
  state.vehicles = createVehicles(state.counts);
  state.signalOrder = getSignalOrder(state.counts);
  state.cycleIndex = 0;
  state.currentGreenLane = -1;
  state.mode = mode;
  state.status = "Ready";
  state.paused = false;
  state.emergencyVehicle = null;
  state.emergencyLane = -1;
  pauseButton.innerHTML = '<span class="pause-symbol" aria-hidden="true"></span>Pause';
  updateAnalysis(false);
  renderSchedule();
  startNextCycle();
}

function buildSystemOutput(isEmergency) {
  const lines = [];
  const n = state.counts.length;
  const greedyOps = n * Math.floor(Math.log2(Math.max(n, 2)));
  const dpOps = n * n;

  lines.push("Traffic Input:");
  state.counts.forEach((count, lane) => {
    lines.push(`Lane ${lane}: ${count}`);
  });
  lines.push("");

  if (isEmergency) {
    lines.push("Emergency Mode Activated!");
    lines.push(`${laneNames[state.emergencyLane]} is cleared first for the ${formatEmergencyType(state.emergencyType)}.`);
    lines.push("");
  }

  lines.push("Signal Processing Order:");
  state.signalOrder.forEach((lane) => {
    lines.push(`Lane ${lane} -> GREEN`);
  });
  lines.push("");
  lines.push("===== COMPLEXITY ANALYSIS =====");
  lines.push(`Input Size (n): ${n}`);
  lines.push("");
  lines.push("Greedy Approach:");
  lines.push("Time Complexity: O(n log n)");
  lines.push(`Estimated Operations: ${greedyOps}`);
  lines.push("");
  lines.push("Priority Queue:");
  lines.push("Time Complexity: O(n log n)");
  lines.push(`Estimated Operations: ${greedyOps}`);
  lines.push("");
  lines.push("Dynamic Programming:");
  lines.push("Time Complexity: O(n^2)");
  lines.push(`Estimated Operations: ${dpOps}`);
  lines.push("");
  lines.push("Conclusion:");
  lines.push("Greedy + Priority Queue is more efficient for real-time traffic systems.");

  systemOutput.textContent = lines.join("\n");
}

function updateAnalysis(isEmergency) {
  const n = state.counts.length;
  const total = state.totalInitial;
  const greedyOps = n * Math.floor(Math.log2(Math.max(n, 2)));
  const dpOps = n * n;
  const maxOps = Math.max(greedyOps, dpOps, 1);

  totalVehiclesEl.textContent = total.toString();
  cycleCountEl.textContent = state.signalOrder.length.toString();
  greedyOpsEl.textContent = greedyOps.toString();
  dpOpsEl.textContent = dpOps.toString();

  greedyBar.style.height = `${clamp((greedyOps / maxOps) * 230, 18, 230)}px`;
  pqBar.style.height = `${clamp((greedyOps / maxOps) * 230, 18, 230)}px`;
  dpBar.style.height = `${clamp((dpOps / maxOps) * 230, 18, 230)}px`;
  buildSystemOutput(isEmergency);
}

function renderSchedule() {
  scheduleList.innerHTML = "";

  if (state.signalOrder.length === 0) {
    const chip = document.createElement("span");
    chip.className = "schedule-chip";
    chip.textContent = "No vehicles waiting";
    scheduleList.appendChild(chip);
    return;
  }

  state.signalOrder.forEach((lane, index) => {
    const chip = document.createElement("span");
    chip.className = "schedule-chip";
    chip.textContent = `${index + 1}. ${laneShortNames[lane]}`;
    scheduleList.appendChild(chip);
  });
}

function startNextCycle() {
  if (state.mode === "emergency") {
    return;
  }

  if (state.cycleIndex >= state.signalOrder.length) {
    state.currentGreenLane = -1;
    state.mode = "complete";
    state.status = "Complete";
    return;
  }

  const lane = state.signalOrder[state.cycleIndex];
  state.currentGreenLane = lane;
  state.status = `${laneShortNames[lane]} green`;
  state.activeSince = performance.now() / 1000;
  releaseBatch(lane);

  const laneCount = Math.max(state.counts[lane], 1);
  const greenMs = Math.min(5000, 500 + laneCount * 200);
  state.nextCycleAt = state.activeSince + greenMs / 1000 / getSpeed();
  state.cycleIndex += 1;
}

function releaseBatch(lane) {
  const queued = state.vehicles
    .filter((vehicle) => vehicle.lane === lane && vehicle.state === "queued")
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .slice(0, 10);

  queued.forEach((vehicle, index) => {
    vehicle.state = "moving";
    vehicle.progress = -index * 0.13;
    vehicle.delay = index * 0.13;
  });
}

function startEmergency() {
  const counts = readCounts();
  resetSimulation(counts, "emergency");

  const lane = Number.parseInt(emergencyLaneEl.value, 10) || 0;
  state.mode = "emergency";
  state.emergencyLane = clamp(lane, 0, 3);
  state.emergencyType = emergencyTypeEl.value;
  state.currentGreenLane = -1;
  state.status = `${laneShortNames[state.emergencyLane]} emergency`;
  state.emergencyVehicle = {
    lane: state.emergencyLane,
    progress: -0.08,
    type: state.emergencyType
  };

  updateAnalysis(true);
}

function getSpeed() {
  return Number.parseFloat(speedRange.value) || 1;
}

function activeMovingVehicles() {
  return state.vehicles.filter((vehicle) => vehicle.state === "moving");
}

function updateSimulation(deltaSeconds, nowSeconds) {
  state.flashTimer += deltaSeconds;
  if (state.flashTimer > 0.24) {
    state.flash = !state.flash;
    state.flashTimer = 0;
  }

  if (state.paused) {
    return;
  }

  const speed = getSpeed();

  if (state.mode === "emergency" && state.emergencyVehicle) {
    state.emergencyVehicle.progress += deltaSeconds * 0.42 * speed;
    state.status = `${laneShortNames[state.emergencyLane]} emergency`;

    if (state.emergencyVehicle.progress > 1.18) {
      state.emergencyVehicle = null;
      state.mode = "normal";
      state.status = "Emergency cleared";
      state.nextCycleAt = nowSeconds + 0.45;
      startNextCycle();
    }
    return;
  }

  activeMovingVehicles().forEach((vehicle) => {
    vehicle.progress += deltaSeconds * 0.34 * speed;
    if (vehicle.progress > 1.08) {
      vehicle.state = "done";
    }
  });

  if (state.mode === "normal" && nowSeconds >= state.nextCycleAt && activeMovingVehicles().length === 0) {
    startNextCycle();
  }
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(520, Math.floor(rect.height));

  if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function getLayout(width, height) {
  const roadWidth = clamp(Math.min(width, height) * 0.29, 150, 285);
  const cx = width / 2;
  const cy = height / 2;
  const stopGap = roadWidth * 0.52;

  return {
    width,
    height,
    cx,
    cy,
    roadWidth,
    laneOffset: roadWidth * 0.23,
    stopTop: cy - stopGap,
    stopBottom: cy + stopGap,
    stopLeft: cx - stopGap,
    stopRight: cx + stopGap
  };
}

function drawScene() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const layout = getLayout(width, height);
  state.layout = layout;

  ctx.clearRect(0, 0, width, height);
  drawCityBase(ctx, layout);
  drawRoads(ctx, layout);
  drawCrosswalks(ctx, layout);
  drawLaneLabels(ctx, layout);
  drawSignals(ctx, layout);
  drawVehicles(ctx, layout);
  drawEmergencyVehicle(ctx, layout);
  updateHud();
}

function drawCityBase(context, layout) {
  const { width, height, cx, cy, roadWidth } = layout;
  const blockColor = "#d7dfd7";
  const plazaColor = "#d9d2c5";

  context.fillStyle = blockColor;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#c8dac8";
  context.fillRect(0, 0, cx - roadWidth * 0.62, cy - roadWidth * 0.62);
  context.fillRect(cx + roadWidth * 0.62, cy + roadWidth * 0.62, width, height);

  context.fillStyle = plazaColor;
  context.fillRect(cx + roadWidth * 0.62, 0, width, cy - roadWidth * 0.62);
  context.fillRect(0, cy + roadWidth * 0.62, cx - roadWidth * 0.62, height);

  drawBuildings(context, layout);
}

function drawBuildings(context, layout) {
  const { width, height, cx, cy, roadWidth } = layout;
  const buildings = [
    [24, 24, 118, 72, "#e9e1c8"],
    [158, 36, 88, 118, "#cfd8df"],
    [width - 174, 30, 122, 92, "#d7c9bd"],
    [width - 116, 156, 82, 118, "#ccd8d2"],
    [30, height - 180, 120, 120, "#d6dce7"],
    [width - 198, height - 160, 142, 96, "#e4d5cb"]
  ];

  buildings.forEach(([x, y, w, h, color]) => {
    if (x < cx + roadWidth && x + w > cx - roadWidth && y < cy + roadWidth && y + h > cy - roadWidth) {
      return;
    }
    context.save();
    context.shadowColor = "rgba(33, 38, 44, 0.18)";
    context.shadowBlur = 18;
    context.shadowOffsetY = 12;
    roundedRect(context, x, y, w, h, 7);
    context.fillStyle = color;
    context.fill();
    context.shadowColor = "transparent";
    context.fillStyle = "rgba(255, 255, 255, 0.42)";
    for (let wx = x + 14; wx < x + w - 12; wx += 24) {
      for (let wy = y + 14; wy < y + h - 10; wy += 24) {
        context.fillRect(wx, wy, 10, 8);
      }
    }
    context.restore();
  });
}

function drawRoads(context, layout) {
  const { width, height, cx, cy, roadWidth } = layout;
  const half = roadWidth / 2;

  context.save();
  context.shadowColor = "rgba(0, 0, 0, 0.22)";
  context.shadowBlur = 28;
  context.shadowOffsetY = 10;

  context.fillStyle = "#2d3238";
  context.fillRect(cx - half, 0, roadWidth, height);
  context.fillRect(0, cy - half, width, roadWidth);
  context.fillStyle = "#363c43";
  context.fillRect(cx - half, cy - half, roadWidth, roadWidth);

  context.restore();

  drawAsphaltTexture(context, layout);

  context.strokeStyle = "rgba(255, 255, 255, 0.62)";
  context.lineWidth = 3;
  context.setLineDash([30, 24]);
  context.beginPath();
  context.moveTo(cx, 0);
  context.lineTo(cx, cy - half - 18);
  context.moveTo(cx, cy + half + 18);
  context.lineTo(cx, height);
  context.moveTo(0, cy);
  context.lineTo(cx - half - 18, cy);
  context.moveTo(cx + half + 18, cy);
  context.lineTo(width, cy);
  context.stroke();
  context.setLineDash([]);

  context.strokeStyle = "#f1ca49";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(cx - layout.laneOffset * 1.98, 0);
  context.lineTo(cx - layout.laneOffset * 1.98, cy - half);
  context.moveTo(cx + layout.laneOffset * 1.98, cy + half);
  context.lineTo(cx + layout.laneOffset * 1.98, height);
  context.moveTo(0, cy + layout.laneOffset * 1.98);
  context.lineTo(cx - half, cy + layout.laneOffset * 1.98);
  context.moveTo(cx + half, cy - layout.laneOffset * 1.98);
  context.lineTo(width, cy - layout.laneOffset * 1.98);
  context.stroke();
}

function drawAsphaltTexture(context, layout) {
  const { width, height, cx, cy, roadWidth } = layout;
  const half = roadWidth / 2;
  context.save();
  context.globalAlpha = 0.16;
  context.fillStyle = "#ffffff";
  for (let i = 0; i < 120; i += 1) {
    const vertical = i % 2 === 0;
    const x = vertical ? cx - half + ((i * 37) % roadWidth) : (i * 73) % width;
    const y = vertical ? (i * 61) % height : cy - half + ((i * 29) % roadWidth);
    context.fillRect(x, y, 1.2, 1.2);
  }
  context.restore();
}

function drawCrosswalks(context, layout) {
  const { cx, cy, roadWidth, stopTop, stopBottom, stopLeft, stopRight } = layout;
  const stripe = Math.max(6, roadWidth * 0.045);
  context.fillStyle = "rgba(255, 255, 255, 0.82)";

  for (let offset = -roadWidth * 0.42; offset < roadWidth * 0.44; offset += stripe * 2) {
    context.fillRect(cx + offset, stopTop - stripe * 2.4, stripe, stripe * 2);
    context.fillRect(cx + offset, stopBottom + stripe * 0.4, stripe, stripe * 2);
    context.fillRect(stopLeft - stripe * 2.4, cy + offset, stripe * 2, stripe);
    context.fillRect(stopRight + stripe * 0.4, cy + offset, stripe * 2, stripe);
  }

  context.strokeStyle = "rgba(255, 255, 255, 0.9)";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(cx - roadWidth * 0.46, stopTop);
  context.lineTo(cx + roadWidth * 0.46, stopTop);
  context.moveTo(cx - roadWidth * 0.46, stopBottom);
  context.lineTo(cx + roadWidth * 0.46, stopBottom);
  context.moveTo(stopLeft, cy - roadWidth * 0.46);
  context.lineTo(stopLeft, cy + roadWidth * 0.46);
  context.moveTo(stopRight, cy - roadWidth * 0.46);
  context.lineTo(stopRight, cy + roadWidth * 0.46);
  context.stroke();
}

function drawLaneLabels(context, layout) {
  const { width, height, cx, cy, roadWidth } = layout;
  const labels = [
    [cx - roadWidth * 0.43, 30, "0"],
    [width - 38, cy - roadWidth * 0.43, "1"],
    [cx + roadWidth * 0.34, height - 28, "2"],
    [28, cy + roadWidth * 0.34, "3"]
  ];

  context.save();
  context.font = "800 18px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";

  labels.forEach(([x, y, label]) => {
    context.fillStyle = "rgba(16, 18, 22, 0.72)";
    roundedRect(context, x - 15, y - 15, 30, 30, 7);
    context.fill();
    context.fillStyle = "#ffffff";
    context.fillText(label, x, y);
  });
  context.restore();
}

function drawSignals(context, layout) {
  const { cx, cy, roadWidth, stopTop, stopBottom, stopLeft, stopRight } = layout;
  const positions = [
    [cx + roadWidth * 0.42, stopTop - 28, 0],
    [stopRight + 28, cy + roadWidth * 0.42, 1],
    [cx - roadWidth * 0.42, stopBottom + 28, 2],
    [stopLeft - 28, cy - roadWidth * 0.42, 3]
  ];

  positions.forEach(([x, y, lane]) => {
    const green = state.currentGreenLane === lane && state.mode !== "emergency";
    drawSignalHead(context, x, y, green);
  });
}

function drawSignalHead(context, x, y, green) {
  context.save();
  context.translate(x, y);
  context.shadowColor = "rgba(0, 0, 0, 0.26)";
  context.shadowBlur = 12;
  context.shadowOffsetY = 7;
  roundedRect(context, -11, -24, 22, 48, 6);
  context.fillStyle = "#1d2328";
  context.fill();
  context.shadowColor = "transparent";

  drawBulb(context, 0, -13, green ? "#5b2424" : "#f04444", !green);
  drawBulb(context, 0, 0, "#654f1b", false);
  drawBulb(context, 0, 13, green ? "#21dd86" : "#1f4e3b", green);
  context.restore();
}

function drawBulb(context, x, y, color, glowing) {
  context.save();
  if (glowing) {
    context.shadowColor = color;
    context.shadowBlur = 12;
  }
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, 5, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawVehicles(context, layout) {
  const queuedByLane = [0, 1, 2, 3].map((lane) => state.vehicles
    .filter((vehicle) => vehicle.lane === lane && vehicle.state === "queued")
    .sort((a, b) => a.orderIndex - b.orderIndex));

  queuedByLane.forEach((vehicles, lane) => {
    const laneTotal = Math.max(state.counts[lane], vehicles.length, 1);
    vehicles.forEach((vehicle, index) => {
      const position = getQueuedPosition(layout, lane, index, laneTotal);
      drawVehicle(context, position.x, position.y, position.angle, vehicle.color, position.scale, vehicle.kind, false);
    });
  });

  state.vehicles
    .filter((vehicle) => vehicle.state === "moving")
    .forEach((vehicle) => {
      const position = getPathPosition(layout, vehicle.lane, vehicle.progress);
      drawVehicle(context, position.x, position.y, position.angle, vehicle.color, 1, vehicle.kind, false);
    });
}

function drawEmergencyVehicle(context, layout) {
  if (!state.emergencyVehicle) {
    return;
  }

  const position = getPathPosition(layout, state.emergencyVehicle.lane, state.emergencyVehicle.progress);
  drawVehicle(context, position.x, position.y, position.angle, "#ffffff", 1.1, state.emergencyVehicle.type, true);
}

function getQueuedPosition(layout, lane, index, laneTotal) {
  const { width, height, cx, cy, laneOffset, stopTop, stopBottom, stopLeft, stopRight } = layout;
  let available;
  let grid;
  let row;
  let cross;
  let spacing;
  let scale;

  if (lane === 0) {
    available = Math.max(44, stopTop - 22);
    grid = getQueueGrid(layout, laneTotal, available);
    row = Math.floor(index / grid.columns);
    cross = getQueueCrossOffset(layout, lane, index % grid.columns, grid.columns);
    spacing = grid.spacing;
    scale = grid.scale;
    return {
      x: cross,
      y: stopTop - 24 - row * spacing,
      angle: Math.PI / 2,
      scale
    };
  }

  if (lane === 2) {
    available = Math.max(44, height - stopBottom - 22);
    grid = getQueueGrid(layout, laneTotal, available);
    row = Math.floor(index / grid.columns);
    cross = getQueueCrossOffset(layout, lane, index % grid.columns, grid.columns);
    spacing = grid.spacing;
    scale = grid.scale;
    return {
      x: cross,
      y: stopBottom + 24 + row * spacing,
      angle: -Math.PI / 2,
      scale
    };
  }

  if (lane === 1) {
    available = Math.max(44, width - stopRight - 22);
    grid = getQueueGrid(layout, laneTotal, available);
    row = Math.floor(index / grid.columns);
    cross = getQueueCrossOffset(layout, lane, index % grid.columns, grid.columns);
    spacing = grid.spacing;
    scale = grid.scale;
    return {
      x: stopRight + 24 + row * spacing,
      y: cross,
      angle: Math.PI,
      scale
    };
  }

  available = Math.max(44, stopLeft - 22);
  grid = getQueueGrid(layout, laneTotal, available);
  row = Math.floor(index / grid.columns);
  cross = getQueueCrossOffset(layout, lane, index % grid.columns, grid.columns);
  spacing = grid.spacing;
  scale = grid.scale;
  return {
    x: stopLeft - 24 - row * spacing,
    y: cross,
    angle: 0,
    scale
  };
}

function getQueueGrid(layout, laneTotal, available) {
  const columns = clamp(Math.ceil(laneTotal / 12), 1, 6);
  const rows = Math.max(1, Math.ceil(laneTotal / columns));
  const spacing = Math.min(54, available / rows);
  const crossFit = (layout.roadWidth * 0.31) / Math.max(1, columns);
  const scale = clamp(Math.min(spacing / 50, crossFit / 26), 0.14, 1);
  return { columns, rows, spacing, scale };
}

function getQueueCrossOffset(layout, lane, column, columns) {
  const { cx, cy, laneOffset, roadWidth } = layout;
  const span = roadWidth * 0.31;
  const centered = columns === 1 ? 0 : (column / (columns - 1) - 0.5) * span;

  if (lane === 0) {
    return cx - laneOffset + centered;
  }
  if (lane === 2) {
    return cx + laneOffset + centered;
  }
  if (lane === 1) {
    return cy - laneOffset + centered;
  }
  return cy + laneOffset + centered;
}

function getPathPosition(layout, lane, rawProgress) {
  const { width, height, cx, cy, laneOffset, stopTop, stopBottom, stopLeft, stopRight } = layout;
  const progress = clamp(rawProgress, -0.2, 1.25);
  const ease = progress < 0 ? progress : progress * progress * (3 - 2 * progress);

  if (lane === 0) {
    return {
      x: cx - laneOffset,
      y: stopTop - 24 + (height + 120 - (stopTop - 24)) * ease,
      angle: Math.PI / 2
    };
  }

  if (lane === 2) {
    return {
      x: cx + laneOffset,
      y: stopBottom + 24 + (-120 - (stopBottom + 24)) * ease,
      angle: -Math.PI / 2
    };
  }

  if (lane === 1) {
    return {
      x: stopRight + 24 + (-120 - (stopRight + 24)) * ease,
      y: cy - laneOffset,
      angle: Math.PI
    };
  }

  return {
    x: stopLeft - 24 + (width + 120 - (stopLeft - 24)) * ease,
    y: cy + laneOffset,
    angle: 0
  };
}

function drawVehicle(context, x, y, angle, color, scale, kind, emergency) {
  const length = (kind === "bus" ? 62 : 48) * scale;
  const width = (kind === "bus" ? 24 : 25) * scale;
  const roofLength = length * 0.48;
  const roofWidth = width * 0.64;

  context.save();
  context.translate(x, y);
  context.rotate(angle);

  context.shadowColor = "rgba(0, 0, 0, 0.36)";
  context.shadowBlur = 9 * scale;
  context.shadowOffsetX = -2 * scale;
  context.shadowOffsetY = 6 * scale;
  roundedRect(context, -length / 2, -width / 2, length, width, 7 * scale);
  context.fillStyle = emergency ? getEmergencyColor(kind) : color;
  context.fill();
  context.shadowColor = "transparent";

  context.fillStyle = emergency ? "#f8fbff" : "rgba(255, 255, 255, 0.2)";
  roundedRect(context, -roofLength / 2, -roofWidth / 2, roofLength, roofWidth, 4 * scale);
  context.fill();

  context.fillStyle = "#1e2933";
  context.globalAlpha = 0.9;
  roundedRect(context, -length * 0.24, -roofWidth / 2 + 2 * scale, roofLength * 0.28, roofWidth - 4 * scale, 2 * scale);
  context.fill();
  roundedRect(context, length * 0.02, -roofWidth / 2 + 2 * scale, roofLength * 0.28, roofWidth - 4 * scale, 2 * scale);
  context.fill();
  context.globalAlpha = 1;

  context.fillStyle = "#121519";
  context.fillRect(-length * 0.32, -width * 0.55, length * 0.2, width * 0.1);
  context.fillRect(length * 0.12, -width * 0.55, length * 0.2, width * 0.1);
  context.fillRect(-length * 0.32, width * 0.45, length * 0.2, width * 0.1);
  context.fillRect(length * 0.12, width * 0.45, length * 0.2, width * 0.1);

  context.fillStyle = "#fff4bd";
  context.fillRect(length * 0.41, -width * 0.31, 4 * scale, 5 * scale);
  context.fillRect(length * 0.41, width * 0.14, 4 * scale, 5 * scale);

  if (emergency) {
    drawEmergencyMarkings(context, length, width, scale, kind);
  }

  context.restore();
}

function getEmergencyColor(type) {
  if (type === "fire") {
    return "#cf2f32";
  }
  if (type === "police") {
    return "#f7f9fb";
  }
  return "#ffffff";
}

function drawEmergencyMarkings(context, length, width, scale, type) {
  const flashA = state.flash ? "#ff3232" : "#1d6cff";
  const flashB = state.flash ? "#1d6cff" : "#ff3232";

  context.fillStyle = type === "fire" ? "#ffe9a8" : "#d93b3b";
  if (type === "police") {
    context.fillStyle = "#1c2630";
    context.fillRect(-length * 0.12, -width / 2, length * 0.24, width);
  } else {
    context.fillRect(-length * 0.1, -2 * scale, length * 0.2, 4 * scale);
    context.fillRect(-2 * scale, -width * 0.28, 4 * scale, width * 0.56);
  }

  context.shadowColor = state.flash ? "#ff3232" : "#1d6cff";
  context.shadowBlur = 14 * scale;
  context.fillStyle = flashA;
  context.fillRect(-length * 0.12, -width * 0.08, length * 0.12, width * 0.16);
  context.fillStyle = flashB;
  context.fillRect(0, -width * 0.08, length * 0.12, width * 0.16);
  context.shadowColor = "transparent";
}

function roundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.max(0, Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2));
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function updateHud() {
  const visibleRegular = state.vehicles.filter((vehicle) => vehicle.state !== "done").length;
  const visibleTotal = visibleRegular + (state.emergencyVehicle ? 1 : 0);
  const denominator = state.totalInitial + (state.emergencyVehicle ? 1 : 0);

  signalStatus.textContent = state.status;
  visibleCount.textContent = `${visibleTotal} / ${denominator}`;
  modeStatus.textContent = formatMode();
}

function formatMode() {
  if (state.paused) {
    return "Paused";
  }
  if (state.mode === "emergency") {
    return "Emergency";
  }
  if (state.mode === "complete") {
    return "Complete";
  }
  return "Normal";
}

function formatEmergencyType(type) {
  if (type === "fire") {
    return "fire truck";
  }
  if (type === "police") {
    return "police vehicle";
  }
  return "ambulance";
}

function tick(now) {
  resizeCanvas();
  const deltaSeconds = Math.min(0.05, (now - state.lastTime) / 1000);
  state.lastTime = now;
  updateSimulation(deltaSeconds, now / 1000);
  drawScene();
  window.requestAnimationFrame(tick);
}

function updateClock() {
  const now = new Date();
  clockEl.dateTime = now.toISOString();
  clockEl.textContent = now.toLocaleString([], {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

laneInputs.forEach((input) => {
  input.addEventListener("input", () => {
    const counts = laneInputs.map((field) => clamp(Number.parseInt(field.value, 10) || 0, 0, 240));
    vehicleInput.value = counts.join(", ");
  });
});

vehicleInput.addEventListener("change", () => {
  const counts = parseCountsFromText(vehicleInput.value);
  if (counts) {
    syncInputs(counts);
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  resetSimulation(readCounts(), "normal");
});

emergencyButton.addEventListener("click", () => {
  startEmergency();
});

pauseButton.addEventListener("click", () => {
  state.paused = !state.paused;
  pauseButton.innerHTML = state.paused
    ? '<span class="button-symbol" aria-hidden="true"></span>Resume'
    : '<span class="pause-symbol" aria-hidden="true"></span>Pause';
});

window.addEventListener("resize", () => {
  resizeCanvas();
});

syncInputs(state.counts);
resetSimulation(state.counts, "normal");
updateClock();
window.setInterval(updateClock, 1000);
window.requestAnimationFrame(tick);
