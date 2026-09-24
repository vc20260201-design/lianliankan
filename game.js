(() => {
  const TILES = [
    { icon: "🍎", bg: "#ffe2dd" },
    { icon: "🍊", bg: "#ffe4c7" },
    { icon: "🍋", bg: "#fff4b8" },
    { icon: "🍇", bg: "#f0e1ff" },
    { icon: "🍓", bg: "#ffd4de" },
    { icon: "🍉", bg: "#d9ffe4" },
    { icon: "🍑", bg: "#ffe0d2" },
    { icon: "🍒", bg: "#ffd6d6" },
    { icon: "🥝", bg: "#e5f7c8" },
    { icon: "🍌", bg: "#fff2b0" },
    { icon: "🍍", bg: "#fff0c9" },
    { icon: "🥥", bg: "#f3e6d8" },
    { icon: "🥕", bg: "#ffe0c2" },
    { icon: "🌽", bg: "#fff5c5" },
    { icon: "🍅", bg: "#ffd5d0" },
    { icon: "🥑", bg: "#e3f5d4" },
    { icon: "🌸", bg: "#ffe4ef" },
    { icon: "🍀", bg: "#d8f5de" },
    { icon: "⭐", bg: "#fff3c4" },
    { icon: "🌙", bg: "#e4ecff" },
  ];

  const LAYOUTS = {
    "6x8": { rows: 6, cols: 8, types: 8, hints: 5, shuffles: 3 },
    "8x10": { rows: 8, cols: 10, types: 12, hints: 4, shuffles: 3 },
    "8x12": { rows: 8, cols: 12, types: 16, hints: 4, shuffles: 2 },
    "8x20": { rows: 8, cols: 20, types: 20, hints: 5, shuffles: 3 },
    "10x20": { rows: 10, cols: 20, types: 20, hints: 6, shuffles: 3 },
  };
  const SCORE_TIME = 600;

  const MODE_COPY = {
    practice: "练习模式不计时，可按自己的节奏连线",
    score: "积分模式统一 10 分钟，时间耗尽则结束",
  };

  const GRAVITY_MODES = [
    { id: "down", name: "向下", mark: "↓", hint: "消除后，悬空方块向下落" },
    { id: "up", name: "向上", mark: "↑", hint: "消除后，悬空方块向上浮" },
    { id: "left", name: "向左", mark: "←", hint: "消除后，悬空方块向左靠" },
    { id: "right", name: "向右", mark: "→", hint: "消除后，悬空方块向右靠" },
    { id: "splitX", name: "向两侧", mark: "←|→", hint: "中心竖轴左侧向左，右侧向右" },
    { id: "splitY", name: "向上下", mark: "↑|↓", hint: "水平横轴上侧向上，下侧向下" },
  ];
  const GRAVITY_MS = 320;

  const homeScreen = document.getElementById("home-screen");
  const gameScreen = document.getElementById("game-screen");
  const boardEl = document.getElementById("board");
  const boardStage = document.getElementById("board-stage");
  const pathSvg = document.getElementById("path-svg");
  const comboPop = document.getElementById("combo-pop");
  const scoreEl = document.getElementById("score");
  const timeEl = document.getElementById("time");
  const remainEl = document.getElementById("remain");
  const timeBar = document.getElementById("time-bar");
  const hintBtn = document.getElementById("hint-btn");
  const shuffleBtn = document.getElementById("shuffle-btn");
  const pauseBtn = document.getElementById("pause-btn");
  const muteBtn = document.getElementById("mute-btn");
  const hintCountEl = document.getElementById("hint-count");
  const shuffleCountEl = document.getElementById("shuffle-count");
  const modeDesc = document.getElementById("mode-desc");
  const gravityBar = document.getElementById("gravity-bar");
  const gravityNameEl = document.getElementById("gravity-name");
  const gravityMarkEl = document.getElementById("gravity-mark");
  const gravityHintEl = document.getElementById("gravity-hint");
  const overlay = document.getElementById("overlay");
  const modalKicker = document.getElementById("modal-kicker");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalPrimary = document.getElementById("modal-primary");
  const modalSecondary = document.getElementById("modal-secondary");

  const state = {
    mode: "practice",
    layoutKey: "6x8",
    config: LAYOUTS["6x8"],
    timed: false,
    board: [],
    selected: null,
    score: 0,
    remain: 0,
    hints: 0,
    shuffles: 0,
    timeLeft: 0,
    timeMax: 0,
    combo: 0,
    lastMatchAt: 0,
    locked: false,
    paused: false,
    muted: false,
    running: false,
    timerId: null,
    audio: null,
    gravity: GRAVITY_MODES[0],
  };

  let modalMode = "pause";

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function empty(r, c) {
    const row = state.board[r];
    return row && row[c] === 0;
  }

  function inBounds(r, c) {
    return r >= 0 && c >= 0 && r < state.board.length && c < state.board[0].length;
  }

  function lineClear(r1, c1, r2, c2) {
    if (r1 !== r2 && c1 !== c2) return false;
    if (r1 === r2) {
      const [a, b] = c1 < c2 ? [c1, c2] : [c2, c1];
      for (let c = a + 1; c < b; c += 1) {
        if (state.board[r1][c] !== 0) return false;
      }
      return true;
    }
    const [a, b] = r1 < r2 ? [r1, r2] : [r2, r1];
    for (let r = a + 1; r < b; r += 1) {
      if (state.board[r][c1] !== 0) return false;
    }
    return true;
  }

  function uniquePath(points) {
    const out = [];
    for (const p of points) {
      const last = out[out.length - 1];
      if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
    }
    return out;
  }

  function findPath(a, b) {
    if (!a || !b) return null;
    if (a.r === b.r && a.c === b.c) return null;
    if (state.board[a.r][a.c] !== state.board[b.r][b.c]) return null;
    if (state.board[a.r][a.c] === 0) return null;

    if (lineClear(a.r, a.c, b.r, b.c)) {
      return uniquePath([
        [a.r, a.c],
        [b.r, b.c],
      ]);
    }

    const oneTurn = [
      [a.r, b.c],
      [b.r, a.c],
    ];
    for (const [r, c] of oneTurn) {
      if (!inBounds(r, c)) continue;
      if (!empty(r, c)) continue;
      if (lineClear(a.r, a.c, r, c) && lineClear(r, c, b.r, b.c)) {
        return uniquePath([
          [a.r, a.c],
          [r, c],
          [b.r, b.c],
        ]);
      }
    }

    const rows = state.board.length;
    const cols = state.board[0].length;

    for (let c = 0; c < cols; c += 1) {
      const ok1 = c === a.c || empty(a.r, c);
      const ok2 = c === b.c || empty(b.r, c);
      if (!ok1 || !ok2) continue;
      if (
        lineClear(a.r, a.c, a.r, c) &&
        lineClear(a.r, c, b.r, c) &&
        lineClear(b.r, c, b.r, b.c)
      ) {
        return uniquePath([
          [a.r, a.c],
          [a.r, c],
          [b.r, c],
          [b.r, b.c],
        ]);
      }
    }

    for (let r = 0; r < rows; r += 1) {
      const ok1 = r === a.r || empty(r, a.c);
      const ok2 = r === b.r || empty(r, b.c);
      if (!ok1 || !ok2) continue;
      if (
        lineClear(a.r, a.c, r, a.c) &&
        lineClear(r, a.c, r, b.c) &&
        lineClear(r, b.c, b.r, b.c)
      ) {
        return uniquePath([
          [a.r, a.c],
          [r, a.c],
          [r, b.c],
          [b.r, b.c],
        ]);
      }
    }

    return null;
  }

  function listTiles() {
    const tiles = [];
    for (let r = 1; r < state.board.length - 1; r += 1) {
      for (let c = 1; c < state.board[0].length - 1; c += 1) {
        if (state.board[r][c]) tiles.push({ r, c, type: state.board[r][c] });
      }
    }
    return tiles;
  }

  function findMatch() {
    const tiles = listTiles();
    const groups = new Map();
    for (const tile of tiles) {
      if (!groups.has(tile.type)) groups.set(tile.type, []);
      groups.get(tile.type).push(tile);
    }
    for (const group of groups.values()) {
      for (let i = 0; i < group.length; i += 1) {
        for (let j = i + 1; j < group.length; j += 1) {
          const path = findPath(group[i], group[j]);
          if (path) return { a: group[i], b: group[j], path };
        }
      }
    }
    return null;
  }

  function createBoard(config) {
    const pairCount = (config.rows * config.cols) / 2;
    const types = [];
    for (let i = 0; i < pairCount; i += 1) {
      types.push((i % config.types) + 1);
    }
    const values = shuffle(types.concat(types));
    const board = Array.from({ length: config.rows + 2 }, () =>
      Array(config.cols + 2).fill(0)
    );
    let k = 0;
    for (let r = 1; r <= config.rows; r += 1) {
      for (let c = 1; c <= config.cols; c += 1) {
        board[r][c] = values[k];
        k += 1;
      }
    }
    return board;
  }

  function reshuffleRemaining() {
    const tiles = listTiles();
    const values = shuffle(tiles.map((t) => t.type));
    tiles.forEach((tile, i) => {
      state.board[tile.r][tile.c] = values[i];
    });
  }

  function columnCells(c, r0, r1) {
    const cells = [];
    for (let r = r0; r <= r1; r += 1) cells.push({ r, c });
    return cells;
  }

  function rowCells(r, c0, c1) {
    const cells = [];
    for (let c = c0; c <= c1; c += 1) cells.push({ r, c });
    return cells;
  }

  function pack(cells, toward) {
    const filled = [];
    for (const pos of cells) {
      const type = state.board[pos.r][pos.c];
      if (type) filled.push({ r: pos.r, c: pos.c, type });
    }
    const targets =
      toward === "start" ? cells.slice(0, filled.length) : cells.slice(cells.length - filled.length);
    const moves = [];
    filled.forEach((src, i) => {
      const dst = targets[i];
      if (!dst || (src.r === dst.r && src.c === dst.c)) return;
      moves.push({ fromR: src.r, fromC: src.c, toR: dst.r, toC: dst.c, type: src.type });
    });
    return moves;
  }

  function computeGravityMoves() {
    const { rows, cols } = state.config;
    const mode = state.gravity.id;
    const moves = [];
    const addColumns = (c0, c1, r0, r1, toward) => {
      for (let c = c0; c <= c1; c += 1) moves.push(...pack(columnCells(c, r0, r1), toward));
    };
    const addRows = (r0, r1, c0, c1, toward) => {
      for (let r = r0; r <= r1; r += 1) moves.push(...pack(rowCells(r, c0, c1), toward));
    };

    if (mode === "down") addColumns(1, cols, 1, rows, "end");
    else if (mode === "up") addColumns(1, cols, 1, rows, "start");
    else if (mode === "left") addRows(1, rows, 1, cols, "start");
    else if (mode === "right") addRows(1, rows, 1, cols, "end");
    else if (mode === "splitX") {
      const leftEnd = Math.floor(cols / 2);
      const rightStart = leftEnd + 1 + (cols % 2);
      addRows(1, rows, 1, leftEnd, "start");
      addRows(1, rows, rightStart, cols, "end");
    } else if (mode === "splitY") {
      const topEnd = Math.floor(rows / 2);
      const bottomStart = topEnd + 1 + (rows % 2);
      addColumns(1, cols, 1, topEnd, "start");
      addColumns(1, cols, bottomStart, rows, "end");
    }
    return moves;
  }

  function commitMoves(moves) {
    if (!moves.length) return;
    const next = state.board.map((row) => row.slice());
    for (const move of moves) next[move.fromR][move.fromC] = 0;
    for (const move of moves) next[move.toR][move.toC] = move.type;
    state.board = next;
  }

  function updateGravityBar() {
    const gravity = state.gravity;
    gravityBar.dataset.gravity = gravity.id;
    gravityNameEl.textContent = gravity.name;
    gravityMarkEl.textContent = gravity.mark;
    gravityHintEl.textContent = gravity.hint;
  }

  function pickGravity() {
    return GRAVITY_MODES[Math.floor(Math.random() * GRAVITY_MODES.length)];
  }

  async function applyGravity() {
    const moves = computeGravityMoves();
    if (!moves.length) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      commitMoves(moves);
      renderBoard();
      return;
    }

    const origins = new Map();
    for (const move of moves) {
      const el = tileButton(move.fromR, move.fromC);
      if (!el) continue;
      origins.set(`${move.toR},${move.toC}`, el.getBoundingClientRect());
    }
    commitMoves(moves);
    renderBoard();

    const flying = [];
    for (const move of moves) {
      const btn = tileButton(move.toR, move.toC);
      const from = origins.get(`${move.toR},${move.toC}`);
      if (!btn || !from) continue;
      const to = btn.getBoundingClientRect();
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (dx === 0 && dy === 0) continue;
      btn.classList.add("is-falling");
      btn.style.transition = "none";
      btn.style.transform = `translate(${dx}px, ${dy}px)`;
      flying.push(btn);
    }
    if (!flying.length) return;
    boardEl.offsetHeight;
    for (const btn of flying) {
      btn.style.transition = `transform ${GRAVITY_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
      btn.style.transform = "translate(0px, 0px)";
    }
    await wait(GRAVITY_MS + 20);
    for (const btn of flying) {
      btn.style.transition = "none";
      btn.style.transform = "";
      btn.classList.remove("is-falling");
    }
    boardEl.offsetHeight;
    for (const btn of flying) btn.style.transition = "";
  }

  function ensurePlayable(maxTries = 40) {
    for (let i = 0; i < maxTries; i += 1) {
      if (findMatch()) return true;
      reshuffleRemaining();
    }
    return Boolean(findMatch());
  }

  function cellEl(r, c) {
    return boardEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
  }

  function layoutBoard() {
    const { rows, cols } = state.config;
    const logicalRows = rows + 2;
    const logicalCols = cols + 2;
    const rect = boardStage.getBoundingClientRect();
    const pad = 20;
    const minTile = logicalCols >= 18 ? 18 : 26;
    const maxTile = logicalCols >= 18 ? 46 : 64;
    const gap = logicalCols >= 18 ? 3 : logicalCols >= 14 ? 4 : 6;
    const tile = Math.max(
      minTile,
      Math.min(
        maxTile,
        Math.floor((rect.width - pad * 2 - gap * (logicalCols - 1)) / logicalCols),
        Math.floor((rect.height - pad * 2 - gap * (logicalRows - 1)) / logicalRows)
      )
    );
    boardEl.style.setProperty("--tile-size", `${tile}px`);
    boardEl.style.setProperty("--gap", `${gap}px`);
    boardEl.style.gridTemplateColumns = `repeat(${logicalCols}, ${tile}px)`;
  }

  function renderBoard() {
    layoutBoard();
    const { rows, cols } = state.config;
    const frag = document.createDocumentFragment();
    for (let r = 0; r < rows + 2; r += 1) {
      for (let c = 0; c < cols + 2; c += 1) {
        const wrap = document.createElement("div");
        wrap.className = "cell";
        wrap.dataset.r = String(r);
        wrap.dataset.c = String(c);
        const type = state.board[r][c];
        if (type) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "tile";
          btn.style.background = TILES[type - 1].bg;
          const icon = document.createElement("span");
          icon.className = "tile-icon";
          icon.textContent = TILES[type - 1].icon;
          btn.appendChild(icon);
          btn.setAttribute("aria-label", `图案 ${type}`);
          btn.addEventListener("click", () => onTileClick(r, c));
          wrap.appendChild(btn);
        }
        frag.appendChild(wrap);
      }
    }
    boardEl.replaceChildren(frag);
    clearPath();
  }

  function updateHud() {
    const limitText = (value) => (Number.isFinite(value) ? String(value) : "∞");
    scoreEl.textContent = String(state.score);
    remainEl.textContent = String(state.remain);
    hintCountEl.textContent = limitText(state.hints);
    shuffleCountEl.textContent = limitText(state.shuffles);
    hintBtn.disabled = state.hints <= 0;
    shuffleBtn.disabled = state.shuffles <= 0;
    if (state.timed) {
      const m = Math.floor(state.timeLeft / 60);
      const s = state.timeLeft % 60;
      timeEl.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      const ratio = state.timeMax ? state.timeLeft / state.timeMax : 0;
      timeBar.style.transform = `scaleX(${Math.max(0, ratio)})`;
      timeBar.parentElement.classList.toggle("is-low", state.timeLeft <= 30);
    }
  }

  function formatTime(total) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m} 分 ${String(s).padStart(2, "0")} 秒`;
  }

  function ensureAudio() {
    if (state.muted) return null;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!state.audio) state.audio = new Ctx();
    if (state.audio.state === "suspended") state.audio.resume();
    return state.audio;
  }

  function tone(freq, duration, type = "sine", gain = 0.05, delay = 0) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t = ctx.currentTime + delay;
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  }

  function sfx(kind) {
    if (kind === "select") tone(520, 0.08, "triangle", 0.04);
    if (kind === "error") tone(170, 0.16, "square", 0.04);
    if (kind === "match") {
      tone(620, 0.1, "triangle", 0.05);
      tone(880, 0.14, "sine", 0.04, 0.07);
    }
    if (kind === "combo") {
      tone(740, 0.08, "triangle", 0.05);
      tone(980, 0.12, "sine", 0.045, 0.06);
      tone(1240, 0.16, "sine", 0.04, 0.12);
    }
    if (kind === "win") {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, "sine", 0.05, i * 0.12));
    }
    if (kind === "lose") {
      tone(300, 0.2, "sawtooth", 0.03);
      tone(180, 0.35, "sawtooth", 0.03, 0.12);
    }
  }

  function cellCenter(r, c) {
    const el = cellEl(r, c);
    const stage = boardStage.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left - stage.left + rect.width / 2,
      y: rect.top - stage.top + rect.height / 2,
    };
  }

  function clearPath() {
    pathSvg.replaceChildren();
  }

  function drawPath(path) {
    const pts = path.map(([r, c]) => cellCenter(r, c));
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    pathSvg.setAttribute("viewBox", `0 0 ${boardStage.clientWidth} ${boardStage.clientHeight}`);
    pathSvg.setAttribute("width", String(boardStage.clientWidth));
    pathSvg.setAttribute("height", String(boardStage.clientHeight));

    const ns = "http://www.w3.org/2000/svg";
    const defs = document.createElementNS(ns, "defs");
    const grad = document.createElementNS(ns, "linearGradient");
    grad.id = "path-grad";
    grad.setAttribute("x1", "0%");
    grad.setAttribute("y1", "0%");
    grad.setAttribute("x2", "100%");
    grad.setAttribute("y2", "0%");
    const s1 = document.createElementNS(ns, "stop");
    s1.setAttribute("offset", "0%");
    s1.setAttribute("stop-color", "#ffe08a");
    const s2 = document.createElementNS(ns, "stop");
    s2.setAttribute("offset", "100%");
    s2.setAttribute("stop-color", "#46d39a");
    grad.append(s1, s2);
    defs.appendChild(grad);

    const line = document.createElementNS(ns, "path");
    line.setAttribute("d", d);
    line.setAttribute("class", "path-line");
    pathSvg.replaceChildren(defs, line);
    const length = line.getTotalLength();
    line.style.strokeDasharray = String(length);
    line.style.strokeDashoffset = String(length);
    line.getBoundingClientRect();
    line.style.transition = "stroke-dashoffset 0.22s ease";
    line.style.strokeDashoffset = "0";
  }

  function showCombo(text, path) {
    const mid = path[Math.floor(path.length / 2)];
    const pt = cellCenter(mid[0], mid[1]);
    comboPop.textContent = text;
    comboPop.style.left = `${pt.x}px`;
    comboPop.style.top = `${pt.y}px`;
    comboPop.classList.remove("is-show");
    void comboPop.offsetWidth;
    comboPop.classList.add("is-show");
  }

  function clearSelection() {
    document.querySelectorAll(".tile.is-selected").forEach((el) => el.classList.remove("is-selected"));
    state.selected = null;
  }

  function tileButton(r, c) {
    const cell = cellEl(r, c);
    return cell ? cell.querySelector(".tile") : null;
  }

  async function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function onTileClick(r, c) {
    if (state.locked || state.paused || !state.running) return;
    if (!state.board[r][c]) return;
    const current = { r, c };

    if (!state.selected) {
      state.selected = current;
      tileButton(r, c)?.classList.add("is-selected");
      sfx("select");
      return;
    }

    if (state.selected.r === r && state.selected.c === c) {
      clearSelection();
      return;
    }

    const first = state.selected;
    const secondBtn = tileButton(r, c);
    secondBtn?.classList.add("is-selected");

    const path = findPath(first, current);
    if (!path) {
      sfx("error");
      tileButton(first.r, first.c)?.classList.add("is-wrong");
      secondBtn?.classList.add("is-wrong");
      state.locked = true;
      await wait(280);
      tileButton(first.r, first.c)?.classList.remove("is-wrong");
      secondBtn?.classList.remove("is-wrong");
      clearSelection();
      state.selected = current;
      secondBtn?.classList.add("is-selected");
      state.locked = false;
      return;
    }

    await clearPair(first, current, path);
  }

  async function clearPair(a, b, path) {
    state.locked = true;
    drawPath(path);

    const now = Date.now();
    state.combo = now - state.lastMatchAt < 2800 ? state.combo + 1 : 1;
    state.lastMatchAt = now;
    const gained = 10 * state.combo + state.combo * 5;
    state.score += gained;
    if (state.timed) {
      state.timeLeft = Math.min(state.timeMax, state.timeLeft);
    }
    state.remain -= 2;

    showCombo(state.combo > 1 ? `连击 x${state.combo}  +${gained}` : `+${gained}`, path);
    sfx(state.combo > 1 ? "combo" : "match");

    await wait(200);
    tileButton(a.r, a.c)?.classList.add("is-clearing");
    tileButton(b.r, b.c)?.classList.add("is-clearing");
    await wait(240);

    state.board[a.r][a.c] = 0;
    state.board[b.r][b.c] = 0;
    const aCell = cellEl(a.r, a.c);
    const bCell = cellEl(b.r, b.c);
    if (aCell) aCell.replaceChildren();
    if (bCell) bCell.replaceChildren();
    clearPath();
    clearSelection();
    updateHud();

    if (state.remain <= 0) {
      endGame(true);
      return;
    }

    await applyGravity();
    if (!state.running) return;

    if (!findMatch()) {
      ensurePlayable();
      renderBoard();
      updateHud();
      showToast("没有可连接的牌，已自动重排");
    }

    state.locked = false;
  }

  function showToast(text) {
    showCombo(text, [[Math.ceil(state.config.rows / 2), Math.ceil(state.config.cols / 2)]]);
  }

  function startTimer() {
    stopTimer();
    if (!state.timed) return;
    state.timerId = setInterval(() => {
      if (!state.running || state.paused) return;
      state.timeLeft -= 1;
      updateHud();
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        updateHud();
        endGame(false);
      }
    }, 1000);
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function startGame() {
    const layout = LAYOUTS[state.layoutKey];
    const timed = state.mode === "score";
    state.config = layout;
    state.timed = timed;
    state.board = createBoard(layout);
    ensurePlayable();
    state.selected = null;
    state.score = 0;
    state.remain = layout.rows * layout.cols;
    state.hints = timed ? layout.hints : Infinity;
    state.shuffles = timed ? layout.shuffles : Infinity;
    state.timeLeft = timed ? SCORE_TIME : 0;
    state.timeMax = timed ? SCORE_TIME : 0;
    state.combo = 0;
    state.lastMatchAt = 0;
    state.gravity = pickGravity();
    state.locked = false;
    state.paused = false;
    state.running = true;
    homeScreen.classList.add("is-hidden");
    gameScreen.classList.remove("is-hidden");
    gameScreen.classList.toggle("is-practice", !timed);
    document.body.classList.add("is-playing");
    hideOverlay();
    updateGravityBar();
    renderBoard();
    updateHud();
    startTimer();
    pauseBtn.textContent = "暂停";
  }

  function backHome() {
    stopTimer();
    state.running = false;
    state.paused = false;
    hideOverlay();
    document.body.classList.remove("is-playing");
    gameScreen.classList.add("is-hidden");
    gameScreen.classList.remove("is-practice");
    homeScreen.classList.remove("is-hidden");
  }

  function endGame(won) {
    state.running = false;
    state.locked = true;
    stopTimer();
    sfx(won ? "win" : "lose");
    const layoutLabel = `${state.config.rows} × ${state.config.cols} · 重力${state.gravity.name}`;
    const winBody = state.timed
      ? `${layoutLabel} · 得分 ${state.score}，剩余时间 ${formatTime(state.timeLeft)}`
      : `${layoutLabel} · 练习完成，得分 ${state.score}`;
    const loseBody = `${layoutLabel} · 得分 ${state.score}，还剩 ${state.remain} 个图案`;
    showOverlay({
      mode: "end",
      kicker: won ? "全部消除" : "时间到",
      title: won ? "胜利" : "再试一次",
      body: won ? winBody : loseBody,
      primary: "再来一局",
      secondary: "返回首页",
    });
  }

  function showOverlay({ mode, kicker, title, body, primary, secondary }) {
    modalMode = mode;
    modalKicker.textContent = kicker;
    modalTitle.textContent = title;
    modalBody.textContent = body;
    modalPrimary.textContent = primary;
    modalSecondary.textContent = secondary;
    overlay.classList.remove("is-hidden");
  }

  function hideOverlay() {
    overlay.classList.add("is-hidden");
  }

  async function useHint() {
    if (state.locked || state.paused || !state.running || state.hints <= 0) return;
    const match = findMatch();
    if (!match) {
      ensurePlayable();
      renderBoard();
      return;
    }
    state.hints -= 1;
    state.locked = true;
    updateHud();
    tileButton(match.a.r, match.a.c)?.classList.add("is-hint");
    tileButton(match.b.r, match.b.c)?.classList.add("is-hint");
    await wait(1600);
    tileButton(match.a.r, match.a.c)?.classList.remove("is-hint");
    tileButton(match.b.r, match.b.c)?.classList.remove("is-hint");
    state.locked = false;
  }

  function useShuffle() {
    if (state.locked || state.paused || !state.running || state.shuffles <= 0) return;
    state.shuffles -= 1;
    reshuffleRemaining();
    ensurePlayable();
    clearSelection();
    renderBoard();
    updateHud();
  }

  function togglePause() {
    if (!state.running) return;
    if (state.paused) {
      state.paused = false;
      hideOverlay();
      pauseBtn.textContent = "暂停";
      return;
    }
    state.paused = true;
    pauseBtn.textContent = "继续";
    showOverlay({
      mode: "pause",
      kicker: "稍作休息",
      title: "已暂停",
      body: `重力${state.gravity.name}，当前得分 ${state.score}，剩余 ${state.remain} 个图案`,
      primary: "继续游戏",
      secondary: "返回首页",
    });
  }

  function selectButton(group, current) {
    group.forEach((el) => el.classList.toggle("is-active", el === current));
  }

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectButton(document.querySelectorAll(".mode-btn"), btn);
      state.mode = btn.dataset.mode;
      modeDesc.textContent = MODE_COPY[state.mode];
    });
  });

  document.querySelectorAll(".layout-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectButton(document.querySelectorAll(".layout-btn"), btn);
      state.layoutKey = btn.dataset.layout;
    });
  });

  document.getElementById("start-btn").addEventListener("click", () => {
    ensureAudio();
    startGame();
  });
  hintBtn.addEventListener("click", useHint);
  shuffleBtn.addEventListener("click", useShuffle);
  pauseBtn.addEventListener("click", togglePause);
  muteBtn.addEventListener("click", () => {
    state.muted = !state.muted;
    muteBtn.textContent = state.muted ? "静音" : "音效";
  });

  modalPrimary.addEventListener("click", () => {
    if (modalMode === "pause") {
      togglePause();
      return;
    }
    startGame();
  });
  modalSecondary.addEventListener("click", backHome);

  window.addEventListener("resize", () => {
    if (!gameScreen.classList.contains("is-hidden")) {
      layoutBoard();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.running && !state.paused) togglePause();
  });
})();
