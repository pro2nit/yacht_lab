(() => {
  "use strict";

  if (globalThis.__YachtLabOverlayLoaded) return;
  globalThis.__YachtLabOverlayLoaded = true;

  const engine = globalThis.YachtLabStrategy;
  if (!engine) return;

  let panel;
  let updateTimer;
  let lastSignature = "";
  const analysisCache = new Map();
  const POSITION_KEY = "yachtLabPanelPosition";
  const POSITION_PRESETS = ["top-right", "bottom-right", "bottom-left", "top-left"];
  let positionPresetIndex = 0;

  function createPanel() {
    panel = document.createElement("section");
    panel.id = "yl-overlay";
    panel.className = "yl-panel";
    panel.setAttribute("aria-label", "Yacht Lab 야찌 추천");
    panel.innerHTML =
      '<header class="yl-header" title="드래그해서 위치 이동">' +
        '<div class="yl-brand"><span class="yl-logo">YL</span><div><strong>YACHT LAB</strong><small><i></i>AUTO READ</small></div></div>' +
        '<div class="yl-actions">' +
          '<button id="yl-position" type="button" aria-label="패널을 다른 모서리로 이동" title="다른 모서리로 이동">↗</button>' +
          '<button id="yl-collapse" type="button" aria-label="추천 패널 접기" aria-expanded="true">−</button>' +
        '</div>' +
      '</header>' +
      '<div class="yl-collapsed-line"><span>BEST</span><b id="yl-mini-title">게임 감지 중</b></div>' +
      '<div class="yl-body">' +
        '<div class="yl-status"><span id="yl-status-dot"></span><b id="yl-status">게임 화면을 확인하고 있습니다</b></div>' +
        '<div class="yl-dice-readout" id="yl-dice-readout">— · — · — · — · —</div>' +
        '<div class="yl-kicker">BEST MOVE <span>01</span></div>' +
        '<h2 id="yl-title">게임 시작을 기다리는 중</h2>' +
        '<p id="yl-description">게임이 시작되면 주사위와 점수판을 자동으로 읽습니다.</p>' +
        '<div class="yl-metrics">' +
          '<div><span id="yl-primary-label">현재 턴 기대점수</span><strong id="yl-primary-value">—</strong></div>' +
          '<div><span>야찌 가능성</span><strong id="yl-yahtzee-value">—</strong></div>' +
        '</div>' +
        '<div class="yl-alternatives"><div class="yl-section-label">NEXT BEST</div><div id="yl-option-list"></div></div>' +
        '<div class="yl-note"><i>↕</i><span>상단 바를 드래그해 패널 위치를 옮길 수 있습니다.</span></div>' +
      '</div>';

    document.documentElement.appendChild(panel);

    panel.querySelector("#yl-collapse").addEventListener("click", (event) => {
      const collapsed = panel.classList.toggle("yl-collapsed");
      event.currentTarget.textContent = collapsed ? "+" : "−";
      event.currentTarget.setAttribute("aria-expanded", String(!collapsed));
      event.currentTarget.setAttribute(
        "aria-label",
        collapsed ? "추천 패널 펼치기" : "추천 패널 접기"
      );
      requestAnimationFrame(() => keepPanelOnScreen(true));
    });

    panel.querySelector("#yl-position").addEventListener("click", () => {
      positionPresetIndex = (positionPresetIndex + 1) % POSITION_PRESETS.length;
      applyPositionPreset(POSITION_PRESETS[positionPresetIndex], true);
    });

    setupPanelDragging();
    restorePanelPosition();
  }

  function clampPosition(left, top) {
    const width = panel.offsetWidth || 316;
    const height = panel.offsetHeight || 120;
    const maxLeft = Math.max(8, window.innerWidth - width - 8);
    const maxTop = Math.max(8, window.innerHeight - height - 8);
    return {
      left: Math.min(Math.max(8, left), maxLeft),
      top: Math.min(Math.max(8, top), maxTop)
    };
  }

  function placePanel(left, top, shouldSave) {
    const position = clampPosition(left, top);
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.left = position.left + "px";
    panel.style.top = position.top + "px";

    if (
      shouldSave &&
      globalThis.chrome &&
      chrome.storage &&
      chrome.storage.local
    ) {
      chrome.storage.local.set({
        [POSITION_KEY]: position
      });
    }
  }

  function applyPositionPreset(preset, shouldSave) {
    const gap = 16;
    const width = panel.offsetWidth || 316;
    const height = panel.offsetHeight || 120;
    const left = preset.endsWith("right")
      ? window.innerWidth - width - gap
      : gap;
    const top = preset.startsWith("bottom")
      ? window.innerHeight - height - gap
      : 82;
    placePanel(left, top, shouldSave);
  }

  function restorePanelPosition() {
    requestAnimationFrame(() => {
      if (
        globalThis.chrome &&
        chrome.storage &&
        chrome.storage.local
      ) {
        chrome.storage.local.get(POSITION_KEY, (result) => {
          const saved = result && result[POSITION_KEY];
          if (
            saved &&
            Number.isFinite(saved.left) &&
            Number.isFinite(saved.top)
          ) {
            placePanel(saved.left, saved.top, false);
          } else {
            applyPositionPreset("top-right", false);
          }
        });
      } else {
        applyPositionPreset("top-right", false);
      }
    });
  }

  function keepPanelOnScreen(shouldSave) {
    const rect = panel.getBoundingClientRect();
    placePanel(rect.left, rect.top, shouldSave);
  }

  function setupPanelDragging() {
    const handle = panel.querySelector(".yl-header");
    let dragState = null;

    handle.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      const rect = panel.getBoundingClientRect();
      dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top
      };
      handle.setPointerCapture(event.pointerId);
      panel.classList.add("yl-dragging");
      event.preventDefault();
    });

    handle.addEventListener("pointermove", (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      placePanel(
        dragState.left + event.clientX - dragState.startX,
        dragState.top + event.clientY - dragState.startY,
        false
      );
    });

    function finishDrag(event) {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      if (handle.hasPointerCapture(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId);
      }
      dragState = null;
      panel.classList.remove("yl-dragging");
      keepPanelOnScreen(true);
    }

    handle.addEventListener("pointerup", finishDrag);
    handle.addEventListener("pointercancel", finishDrag);
    handle.addEventListener("dblclick", (event) => {
      if (event.target.closest("button")) return;
      positionPresetIndex = 0;
      applyPositionPreset("top-right", true);
    });
  }

  function isVisible(element) {
    if (!element) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function readRollsLeft() {
    return [2, 3].filter((number) => {
      const marker = document.getElementById("roll-" + number);
      if (!marker) return false;
      return marker.textContent.trim() !== "●";
    }).length;
  }

  function readScoreValue(cell) {
    if (!cell) return 0;
    const valueElement = [...cell.querySelectorAll('[aria-hidden="true"]')].find(
      (element) => /^\s*\d+\s*$/.test(element.textContent || "")
    );
    return valueElement ? Number(valueElement.textContent.trim()) : 0;
  }

  function readGameState() {
    const newGameModal = document.getElementById("new-game-modal");
    const setupOpen = isVisible(newGameModal) && newGameModal.classList.contains("show");
    const headers = [
      ...document.querySelectorAll(".cell.player-col.player-info")
    ];
    const meIndex = headers.findIndex((header) =>
      header.classList.contains("me-info")
    );
    const currentIndex = headers.findIndex((header) =>
      header.classList.contains("current-turn")
    );
    const playerIndex = meIndex >= 0 ? meIndex : currentIndex;
    const diceElements = [0, 1, 2, 3, 4].map((index) =>
      document.getElementById("die-" + index)
    );
    const dice = diceElements.map((element) =>
      Number(element && element.getAttribute("data-roll"))
    );
    const validDice = dice.length === 5 && dice.every((value) => value >= 1 && value <= 6);
    const usedRows = [];
    const openKeys = [];
    let upperSubtotal = 0;

    if (playerIndex >= 0) {
      engine.CATEGORIES.forEach((category) => {
        const cell = document.getElementById(
          "player-" + playerIndex + "-scoreboard-row-" + category.row
        );
        const used = Boolean(cell && cell.classList.contains("selected"));
        if (used) {
          usedRows.push(category.row);
          if (category.row <= 5) upperSubtotal += readScoreValue(cell);
        } else if (cell) {
          openKeys.push(category.key);
        }
      });
    }

    return {
      setupOpen,
      headers,
      meIndex,
      currentIndex,
      playerIndex,
      diceElements,
      dice,
      validDice,
      rollsLeft: readRollsLeft(),
      openKeys,
      usedRows,
      upperSubtotal
    };
  }

  function clearGuidance() {
    document.querySelectorAll(".yl-dice-col.yl-keep").forEach((element) => {
      element.classList.remove("yl-keep");
    });
    document.querySelectorAll(".player-score.yl-score-choice").forEach((element) => {
      element.classList.remove("yl-score-choice");
    });
  }

  function ensureDiceBadges(diceElements) {
    diceElements.forEach((die) => {
      const column = die && die.parentElement;
      if (!column) return;
      column.classList.add("yl-dice-col");
      if (!column.querySelector(".yl-die-badge")) {
        const badge = document.createElement("span");
        badge.className = "yl-die-badge";
        badge.textContent = "KEEP";
        badge.setAttribute("aria-hidden", "true");
        column.appendChild(badge);
      }
    });
  }

  function setPanelText(selector, text) {
    const element = panel.querySelector(selector);
    if (element) element.textContent = text;
  }

  function renderAlternatives(items) {
    const list = panel.querySelector("#yl-option-list");
    list.replaceChildren();

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "yl-option-empty";
      empty.textContent = "비교할 선택지가 없습니다";
      list.appendChild(empty);
      return;
    }

    items.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "yl-option";
      const rank = document.createElement("span");
      rank.textContent = "0" + (index + 2);
      const label = document.createElement("b");
      label.textContent = item.label;
      const value = document.createElement("strong");
      value.textContent = item.value;
      row.append(rank, label, value);
      list.appendChild(row);
    });
  }

  function renderWaiting(title, description, status) {
    clearGuidance();
    panel.classList.add("yl-waiting");
    setPanelText("#yl-status", status);
    setPanelText("#yl-dice-readout", "— · — · — · — · —");
    setPanelText("#yl-title", title);
    setPanelText("#yl-mini-title", title);
    setPanelText("#yl-description", description);
    setPanelText("#yl-primary-label", "현재 턴 기대점수");
    setPanelText("#yl-primary-value", "—");
    setPanelText("#yl-yahtzee-value", "—");
    renderAlternatives([]);
  }

  function applyDiceGuidance(state, mask) {
    ensureDiceBadges(state.diceElements);
    state.diceElements.forEach((die, index) => {
      const column = die && die.parentElement;
      if (column) column.classList.toggle("yl-keep", Boolean(mask & (1 << index)));
    });
  }

  function applyScoreGuidance(state, row) {
    const cell = document.getElementById(
      "player-" + state.playerIndex + "-scoreboard-row-" + row
    );
    if (cell) cell.classList.add("yl-score-choice");
  }

  function renderAnalysis(state, analysis) {
    clearGuidance();
    panel.classList.remove("yl-waiting");
    const bestPlan = analysis.options[0];
    const bestScore = analysis.scoreChoices[0];
    const diceText = state.dice.join(" · ");
    const remainingLabel =
      state.rollsLeft > 0
        ? state.rollsLeft + "회 남음"
        : "점수 기록 차례";

    setPanelText(
      "#yl-status",
      remainingLabel + " · 빈 점수칸 " + state.openKeys.length + "개"
    );
    setPanelText("#yl-dice-readout", diceText);

    if (state.rollsLeft > 0 && bestPlan) {
      const title = engine.holdLabel(state.dice, bestPlan.mask);
      applyDiceGuidance(state, bestPlan.mask);
      setPanelText("#yl-title", title);
      setPanelText("#yl-mini-title", title);
      setPanelText(
        "#yl-description",
        engine.planReason(state.dice, bestPlan.mask, state.openKeys)
      );
      setPanelText("#yl-primary-label", "현재 턴 기대점수");
      setPanelText("#yl-primary-value", bestPlan.expected.toFixed(1) + "점");
      renderAlternatives(
        analysis.options.slice(1, 3).map((plan) => ({
          label: engine.holdLabel(state.dice, plan.mask).replace("하세요", ""),
          value: plan.expected.toFixed(1) + "점"
        }))
      );
    } else if (bestScore) {
      const title =
        "“" + bestScore.label + "”에 " + bestScore.rawScore + "점을 기록하세요";
      applyScoreGuidance(state, bestScore.row);
      setPanelText("#yl-title", title);
      setPanelText("#yl-mini-title", title);
      setPanelText(
        "#yl-description",
        "현재 주사위와 남은 점수칸을 비교했을 때 가장 높은 기록입니다."
      );
      setPanelText("#yl-primary-label", "이번 기록 점수");
      setPanelText("#yl-primary-value", bestScore.score.toFixed(0) + "점");
      renderAlternatives(
        analysis.scoreChoices.slice(1, 3).map((choice) => ({
          label: choice.label,
          value: choice.rawScore + "점"
        }))
      );
    } else {
      renderWaiting(
        "점수판이 모두 찼습니다",
        "새 게임을 시작하면 다시 자동으로 분석합니다.",
        "게임 완료"
      );
      return;
    }

    setPanelText(
      "#yl-yahtzee-value",
      (engine.yahtzeeChance(state.dice, state.rollsLeft) * 100).toFixed(2) + "%"
    );
  }

  function update() {
    if (!panel || !document.documentElement.contains(panel)) createPanel();
    const state = readGameState();
    const signature = JSON.stringify({
      setupOpen: state.setupOpen,
      meIndex: state.meIndex,
      currentIndex: state.currentIndex,
      dice: state.dice,
      rollsLeft: state.rollsLeft,
      usedRows: state.usedRows,
      upperSubtotal: state.upperSubtotal
    });

    if (signature === lastSignature) return;
    lastSignature = signature;

    if (state.setupOpen) {
      renderWaiting(
        "게임 시작을 기다리는 중",
        "이름과 방을 입력해 게임을 시작하면 주사위와 내 점수판을 자동으로 읽습니다.",
        "BuddyBoardGames 연결됨"
      );
      return;
    }

    if (
      state.meIndex >= 0 &&
      state.currentIndex >= 0 &&
      state.meIndex !== state.currentIndex
    ) {
      renderWaiting(
        "상대 차례입니다",
        "내 차례가 시작되면 추천 주사위를 즉시 강조합니다.",
        "게임 감지 중"
      );
      return;
    }

    if (!state.validDice || state.playerIndex < 0 || !state.openKeys.length) {
      renderWaiting(
        "첫 굴림을 기다리는 중",
        "주사위가 멈추면 현재 숫자를 자동으로 읽고 추천을 표시합니다.",
        "내 차례 확인됨"
      );
      return;
    }

    const cacheKey = [
      state.dice.join(""),
      state.rollsLeft,
      state.openKeys.join(","),
      state.upperSubtotal
    ].join("|");
    let analysis = analysisCache.get(cacheKey);
    if (!analysis) {
      analysis = engine.analyzeTurn(
        state.dice,
        state.rollsLeft,
        state.openKeys,
        state.upperSubtotal
      );
      if (analysisCache.size > 48) analysisCache.clear();
      analysisCache.set(cacheKey, analysis);
    }
    renderAnalysis(state, analysis);
  }

  function scheduleUpdate() {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(update, 220);
  }

  createPanel();
  update();

  const observer = new MutationObserver((mutations) => {
    const externalChange = mutations.some((mutation) => {
      const target =
        mutation.target.nodeType === Node.ELEMENT_NODE
          ? mutation.target
          : mutation.target.parentElement;
      return !target || (!target.closest("#yl-overlay") && !target.closest(".yl-die-badge"));
    });
    if (externalChange) scheduleUpdate();
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
    attributeFilter: ["class", "data-roll", "aria-pressed", "style"]
  });

  window.addEventListener("resize", () => keepPanelOnScreen(true));
})();
