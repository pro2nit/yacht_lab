(() => {
  const categories = [
    ["ONES", 0, 3],
    ["TWOS", 1, 4],
    ["THREES", 2, 9],
    ["FOURS", 3, 12],
    ["FIVES", 4, null],
    ["SIXES", 5, null],
    ["BONUS", 6, null],
    ["3 OF A KIND", 7, null],
    ["4 OF A KIND", 8, null],
    ["FULL HOUSE", 9, 25],
    ["SM. STRAIGHT", 10, 30],
    ["LG. STRAIGHT", 11, null],
    ["YAHTZEE", 12, null],
    ["CHANCE", 13, 22],
    ["TOTAL", 14, 105]
  ];
  const opponentScores = [
    [2, 6], [6, 8], [9, 12], [8, 16], [15, 20], [18, 24],
    [0, 0], [19, 21], [0, 22], [25, 0], [30, 30], [0, 40],
    [0, 0], [21, 25], [173, 224]
  ];
  const scoreRows = document.getElementById("score-rows");

  categories.forEach(([label, row, myScore], index) => {
    const line = document.createElement("div");
    line.className = "board-grid score-line";
    const category = document.createElement("div");
    category.className = "category-label";
    category.innerHTML = "<b>" + label + "</b><small>" + (row < 6 ? "UPPER" : row === 6 ? "BONUS" : "LOWER") + "</small>";

    const mine = document.createElement("div");
    mine.id = "player-0-scoreboard-row-" + row;
    mine.className =
      "cell player-col player-score" +
      (myScore !== null && row !== 6 && row !== 14 ? " selected" : "") +
      (row === 14 ? " noninteractive" : "");
    const shownScore =
      row === 6 ? "28 / 63" : myScore === null ? "0" : String(myScore);
    mine.innerHTML =
      '<span class="bbg-sr-only">' + label + ", Alex, " +
      (myScore === null ? "not scored yet" : "already scored, " + myScore + " points") +
      '</span><span aria-hidden="true">' + shownScore + "</span>";

    const opponentOne = document.createElement("div");
    opponentOne.className = "cell player-col opponent-score";
    opponentOne.textContent = opponentScores[index][0] || "—";
    const opponentTwo = document.createElement("div");
    opponentTwo.className = "cell player-col opponent-score";
    opponentTwo.textContent = opponentScores[index][1] || "—";
    line.append(category, mine, opponentOne, opponentTwo);
    scoreRows.appendChild(line);
  });

  const dice = [6, 6, 4, 3, 6];
  const pipMap = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
  };
  const diceRow = document.getElementById("dice-row");

  dice.forEach((value, index) => {
    const column = document.createElement("div");
    column.className = "die-column";
    column.id = "dice-col-" + index;
    const die = document.createElement("ol");
    die.className = "die-list";
    die.id = "die-" + index;
    die.dataset.roll = String(value);
    die.setAttribute("role", "button");
    die.setAttribute("tabindex", "0");
    die.setAttribute("aria-label", "Die " + (index + 1) + ", " + value + ", not held");
    const face = document.createElement("li");
    face.className = "demo-die-face";
    for (let pip = 0; pip < 9; pip += 1) {
      const dot = document.createElement("i");
      dot.className = pipMap[value].includes(pip) ? "dot on" : "dot";
      face.appendChild(dot);
    }
    die.appendChild(face);
    column.appendChild(die);
    diceRow.appendChild(column);
  });
})();

