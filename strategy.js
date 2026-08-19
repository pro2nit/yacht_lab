(() => {
  "use strict";

  const CATEGORIES = [
    { key: "ones", label: "에이스", row: 0 },
    { key: "twos", label: "듀스", row: 1 },
    { key: "threes", label: "트레이", row: 2 },
    { key: "fours", label: "포", row: 3 },
    { key: "fives", label: "파이브", row: 4 },
    { key: "sixes", label: "식스", row: 5 },
    { key: "threeKind", label: "트리플", row: 7 },
    { key: "fourKind", label: "포카드", row: 8 },
    { key: "fullHouse", label: "풀하우스", row: 9 },
    { key: "smallStraight", label: "스몰 스트레이트", row: 10 },
    { key: "largeStraight", label: "라지 스트레이트", row: 11 },
    { key: "yahtzee", label: "야찌", row: 12 },
    { key: "chance", label: "찬스", row: 13 }
  ];

  const UPPER_FACE = {
    ones: 1,
    twos: 2,
    threes: 3,
    fours: 4,
    fives: 5,
    sixes: 6
  };

  function buildOutcomes(diceCount) {
    if (diceCount === 0) return [{ dice: [], probability: 1 }];

    const results = [];
    const counts = Array(6).fill(0);
    const factorial = [1, 1, 2, 6, 24, 120];

    function visit(face, left) {
      if (face === 5) {
        counts[5] = left;
        const permutations =
          factorial[diceCount] /
          counts.reduce((product, value) => product * factorial[value], 1);
        const dice = [];
        counts.forEach((amount, index) => {
          for (let i = 0; i < amount; i += 1) dice.push(index + 1);
        });
        results.push({
          dice,
          probability: permutations / 6 ** diceCount
        });
        return;
      }

      for (let amount = 0; amount <= left; amount += 1) {
        counts[face] = amount;
        visit(face + 1, left - amount);
      }
    }

    visit(0, diceCount);
    return results;
  }

  const OUTCOMES = Array.from({ length: 6 }, (_, count) =>
    buildOutcomes(count)
  );

  function scoreDice(dice, key) {
    const counts = Array(7).fill(0);
    dice.forEach((die) => {
      counts[die] += 1;
    });
    const total = dice.reduce((sum, die) => sum + die, 0);
    const unique = new Set(dice);
    const countValues = counts.slice(1).filter(Boolean).sort((a, b) => a - b);

    if (UPPER_FACE[key]) {
      const face = UPPER_FACE[key];
      return counts[face] * face;
    }

    switch (key) {
      case "threeKind":
        return counts.some((count) => count >= 3) ? total : 0;
      case "fourKind":
        return counts.some((count) => count >= 4) ? total : 0;
      case "fullHouse":
        return countValues.length === 2 &&
          countValues[0] === 2 &&
          countValues[1] === 3
          ? 25
          : 0;
      case "smallStraight": {
        const windows = [
          [1, 2, 3, 4],
          [2, 3, 4, 5],
          [3, 4, 5, 6]
        ];
        return windows.some((window) =>
          window.every((face) => unique.has(face))
        )
          ? 30
          : 0;
      }
      case "largeStraight":
        return [1, 2, 3, 4, 5].every((face) => unique.has(face)) ||
          [2, 3, 4, 5, 6].every((face) => unique.has(face))
          ? 40
          : 0;
      case "yahtzee":
        return counts.some((count) => count === 5) ? 50 : 0;
      case "chance":
        return total;
      default:
        return 0;
    }
  }

  function scoreWithBonus(dice, key, upperSubtotal) {
    const score = scoreDice(dice, key);
    const earnsBonus =
      UPPER_FACE[key] && upperSubtotal < 63 && upperSubtotal + score >= 63;
    return score + (earnsBonus ? 35 : 0);
  }

  function uniqueHolds(dice) {
    const holds = new Map();
    for (let mask = 0; mask < 32; mask += 1) {
      const held = dice
        .filter((_, index) => Boolean(mask & (1 << index)))
        .sort((a, b) => a - b);
      const key = held.join("");
      if (!holds.has(key)) holds.set(key, { held, mask });
    }
    return [...holds.values()];
  }

  function analyzeTurn(dice, rollsLeft, openKeys, upperSubtotal = 0) {
    const openCategories = CATEGORIES.filter((category) =>
      openKeys.includes(category.key)
    );
    const scoreChoices = openCategories
      .map((category) => ({
        ...category,
        rawScore: scoreDice(dice, category.key),
        score: scoreWithBonus(dice, category.key, upperSubtotal)
      }))
      .sort((a, b) => b.score - a.score);

    if (!openCategories.length) {
      return { options: [], scoreChoices, states: 0 };
    }

    const memo = new Map();

    function terminalValue(nextDice) {
      return Math.max(
        ...openCategories.map((category) =>
          scoreWithBonus(nextDice, category.key, upperSubtotal)
        )
      );
    }

    function bestExpected(nextDice, rolls) {
      const sorted = [...nextDice].sort((a, b) => a - b);
      const key = `${rolls}|${sorted.join("")}`;
      if (memo.has(key)) return memo.get(key);

      if (rolls === 0) {
        const value = terminalValue(sorted);
        memo.set(key, value);
        return value;
      }

      let best = -Infinity;
      uniqueHolds(sorted).forEach(({ held }) => {
        const rerollCount = 5 - held.length;
        let expected = 0;
        OUTCOMES[rerollCount].forEach((outcome) => {
          expected +=
            outcome.probability *
            bestExpected([...held, ...outcome.dice], rolls - 1);
        });
        best = Math.max(best, expected);
      });

      memo.set(key, best);
      return best;
    }

    if (rollsLeft === 0) {
      return { options: [], scoreChoices, states: memo.size };
    }

    const options = uniqueHolds(dice)
      .map(({ held, mask }) => {
        const rerollCount = 5 - held.length;
        let expected = 0;
        OUTCOMES[rerollCount].forEach((outcome) => {
          expected +=
            outcome.probability *
            bestExpected([...held, ...outcome.dice], rollsLeft - 1);
        });
        return { held, mask, expected };
      })
      .sort(
        (a, b) =>
          b.expected - a.expected || b.held.length - a.held.length
      );

    return { options, scoreChoices, states: memo.size };
  }

  function holdLabel(dice, mask) {
    const held = dice.filter((_, index) => Boolean(mask & (1 << index)));
    if (!held.length) return "전부 다시 굴리세요";
    if (held.length === 5) return "다섯 개 모두 보류하세요";

    const counts = new Map();
    held.forEach((die) => counts.set(die, (counts.get(die) || 0) + 1));
    if (counts.size === 1) {
      const [face, count] = [...counts.entries()][0];
      return `${face} 눈 ${count}개를 보류하세요`;
    }
    return `${held.join(" · ")}를 보류하세요`;
  }

  function planReason(dice, mask, openKeys) {
    const held = dice.filter((_, index) => Boolean(mask & (1 << index)));
    const counts = new Map();
    held.forEach((die) => counts.set(die, (counts.get(die) || 0) + 1));
    const largestGroup = Math.max(0, ...counts.values());
    const unique = [...new Set(held)].sort((a, b) => a - b);
    let currentSequence = 0;
    let maxSequence = 0;
    unique.forEach((value, index) => {
      currentSequence =
        index > 0 && value === unique[index - 1] + 1
          ? currentSequence + 1
          : 1;
      maxSequence = Math.max(maxSequence, currentSequence);
    });

    if (!held.length) {
      return "현재 조합을 유지하는 것보다 다섯 개를 모두 다시 굴리는 편이 유리합니다.";
    }
    if (
      largestGroup >= 3 &&
      ["yahtzee", "fourKind", "threeKind"].some((key) =>
        openKeys.includes(key)
      )
    ) {
      return "같은 눈을 확장해 야찌와 다이스 조합을 함께 노릴 수 있습니다.";
    }
    if (
      maxSequence >= 3 &&
      ["smallStraight", "largeStraight"].some((key) =>
        openKeys.includes(key)
      )
    ) {
      return "연속 숫자를 지키면 두 스트레이트 칸을 함께 열어 둘 수 있습니다.";
    }
    if (held.length === 5) {
      return "현재 조합을 유지하는 편이 남은 점수칸의 기대값을 가장 잘 지킵니다.";
    }
    return "남은 결과와 다음 선택까지 계산했을 때 이 보류 조합의 평균 점수가 가장 높습니다.";
  }

  function yahtzeeChance(dice, rollsLeft) {
    if (rollsLeft === 0) return new Set(dice).size === 1 ? 1 : 0;
    const counts = Array(7).fill(0);
    dice.forEach((die) => {
      counts[die] += 1;
    });
    const bestGroup = Math.max(...counts);
    return (1 - (5 / 6) ** rollsLeft) ** (5 - bestGroup);
  }

  globalThis.YachtLabStrategy = Object.freeze({
    CATEGORIES,
    analyzeTurn,
    holdLabel,
    planReason,
    scoreDice,
    yahtzeeChance,
    version: "1.1.0"
  });
})();
