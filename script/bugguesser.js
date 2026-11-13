import { characters as enemyCharacters } from "./hk/enemy.js";
import { characters as npcCharacters } from "./hk/npc.js";
import { characters as bossCharacters } from "./hk/boss.js";
import { characters as hkssEnemyCharacters } from "./hkss/enemy.js";
import { characters as hkssNpcCharacters } from "./hkss/npc.js";
import { characters as hkssBossCharacters } from "./hkss/boss.js";
import {
    getAcceptedNames,
    getDailyRosters,
    shuffleForSeed,
} from "./bugguesser-roster.js";
import { dailyRosterRevision, dailyStateVersion } from "./bugguesser-config.js";

const dailyRoundCount = 10;
const summaryNumberStart = Date.UTC(2026, 10, 9);
const millisecondsPerDay = 24 * 60 * 60 * 1000;
const characterWikiPageTitles = {
    "Mantis Lord": "Mantis Lords",
    "Oro or Mato": "Brothers Oro & Mato",
    "Moth Ghost": "Unnamed Moth",
    "Ductsucker Charge": "Ductsucker",
    "Beastling": "Beastlings"
};
const gameModes = {
    "hk-enemies": {
        title: "Hollow Knight - Enemies",
        summaryTitle: "HK Enemies",
        characters: enemyCharacters
    },
    "hk-npcs": {
        title: "Hollow Knight - NPCs",
        summaryTitle: "HK NPCs",
        characters: npcCharacters
    },
    "hk-bosses": {
        title: "Hollow Knight - Bosses",
        summaryTitle: "HK Bosses",
        characters: bossCharacters
    },
    "hk-npcs-bosses": {
        title: "Hollow Knight - NPCs & bosses",
        summaryTitle: "HK NPCs & Bosses",
        characters: [...npcCharacters, ...bossCharacters]
    },
    "hkss-enemies": {
        title: "Silksong - Enemies",
        summaryTitle: "Silksong Enemies",
        characters: hkssEnemyCharacters
    },
    "hkss-bosses": {
        title: "Silksong - Bosses",
        summaryTitle: "Silksong Bosses",
        characters: hkssBossCharacters
    },
    "hkss-npcs": {
        title: "Silksong - NPCs",
        summaryTitle: "Silksong NPCs",
        characters: hkssNpcCharacters
    },
    "hkss-npcs-bosses": {
        title: "Silksong - NPCs & bosses",
        summaryTitle: "Silksong NPCs & Bosses",
        characters: [...hkssNpcCharacters, ...hkssBossCharacters]
    }
};

const scoreElement = document.getElementById("score");
const roundElement = document.getElementById("round");
const guessCountElement = document.getElementById("guessCount");
const characterRevealCountElement = document.getElementById("characterRevealCount");
const sprite = document.getElementById("characterSprite");
const gameStatus = document.getElementById("gameStatus");
const guessForm = document.getElementById("guessForm");
const guessInput = document.getElementById("guessInput");
const guessButton = guessForm.querySelector("button");
const namePattern = document.getElementById("namePattern");
const revealCharacterButton = document.getElementById("revealCharacterButton");
const revealNameButton = document.getElementById("revealNameButton");
const nextButton = document.getElementById("nextButton");
const roundContent = document.getElementById("roundContent");
const setupNote = document.getElementById("setupNote");
const gameCard = document.getElementById("gameCard");
const dailySummary = document.getElementById("dailySummary");
const dailySummaryBody = document.getElementById("dailySummaryBody");
const summaryDate = document.getElementById("summaryDate");
const summaryShareText = document.getElementById("summaryShareText");
const copySummaryButton = document.getElementById("copySummaryButton");

if ("virtualKeyboard" in navigator) {
    navigator.virtualKeyboard.overlaysContent = false;
}

let dailyCharacters = [];
let dailyDate = "";
let dailyState;
let answer;
let selectedMode = "";
let storageUnavailable = false;
let characterNameTooltipId = 0;
const characterTooltips = new Set();

function createInitialState() {
    return {
        version: dailyStateVersion,
        date: dailyDate,
        order: dailyCharacters.map((character) => character.image),
        round: 0,
        score: 0,
        totalGuesses: 0,
        totalCharactersRevealed: 0,
        results: [],
        current: {
            startedAt: null,
            guesses: 0,
            charactersRevealed: 0,
            hintPenalty: 0,
            outcome: null,
            points: 0
        },
        finished: false
    };
}

function isValidDailyState(state) {
    return state
        && state.version === dailyStateVersion
        && state.date === dailyDate
        && Array.isArray(state.order)
        && state.order.length === dailyRoundCount
        && state.order.every((image, index) => image === dailyCharacters[index]?.image)
        && Number.isInteger(state.round)
        && state.round >= 0
        && state.round < dailyRoundCount
        && Number.isFinite(state.score)
        && Number.isInteger(state.totalGuesses)
        && Number.isInteger(state.totalCharactersRevealed)
        && Array.isArray(state.results)
        && state.results.length === state.round + (state.current?.outcome ? 1 : 0)
        && state.results.every((result) =>
            result
            && typeof result.name === "string"
            && Number.isFinite(result.elapsedMs)
            && Number.isInteger(result.guesses)
            && Number.isInteger(result.charactersRevealed)
            && result.charactersRevealed >= 0
            && result.charactersRevealed <= getRevealableCharacterCount(result.name)
            && ["correct", "revealed", "skipped"].includes(result.outcome)
        )
        && state.current
        && (state.current.startedAt === null || Number.isFinite(state.current.startedAt))
        && Number.isInteger(state.current.guesses)
        && Number.isInteger(state.current.charactersRevealed)
        && state.current.charactersRevealed >= 0
        && Number.isFinite(state.current.hintPenalty)
        && state.current.hintPenalty >= 0
        && state.current.charactersRevealed <= getRevealableCharacterCount(
            dailyCharacters[state.round]?.name ?? ""
        )
        && [null, "correct", "revealed", "skipped"].includes(state.current.outcome)
        && Number.isFinite(state.current.points)
        && typeof state.finished === "boolean"
        && state.finished === (state.round === dailyRoundCount - 1
            && state.current.outcome !== null);
}

function restoreSavedRoster(state) {
    if (!Array.isArray(state?.order) || state.order.length !== dailyRoundCount) return;
    if (state.order.every((image, index) => image === dailyCharacters[index]?.image)) return;

    const savedCharacters = state.order.map(
        (image) => dailyCharacters.find((character) => character.image === image)
    );
    const savedImages = new Set(state.order);
    const savedNames = new Set();
    const hasUniqueNames = savedCharacters.every((character) => {
        if (!character) return false;
        const names = getAcceptedNames(character);
        if (names.some((name) => savedNames.has(name))) return false;
        names.forEach((name) => savedNames.add(name));
        return true;
    });

    if (savedImages.size === dailyRoundCount && hasUniqueNames) {
        dailyCharacters = savedCharacters;
    }
}

function migrateSavedState(state) {
    if (!state || typeof state !== "object") return state;

    const { totalHints, current, results, ...stateWithoutLegacyCount } = state;
    const migrateCurrent = (round) => {
        if (!round || typeof round !== "object") return round;
        const { hints, hintPenalty, ...roundWithoutLegacyCount } = round;
        delete roundWithoutLegacyCount.hintsUsed;
        const charactersRevealed = hints ?? roundWithoutLegacyCount.charactersRevealed;
        return {
            ...roundWithoutLegacyCount,
            charactersRevealed,
            hintPenalty: hintPenalty ?? charactersRevealed * 2
        };
    };
    const migrateResult = (round) => {
        if (!round || typeof round !== "object") return round;
        const { hints, ...roundWithoutLegacyCount } = round;
        return {
            ...roundWithoutLegacyCount,
            charactersRevealed: hints ?? roundWithoutLegacyCount.charactersRevealed
        };
    };
    const hasLegacyHintCount = Object.hasOwn(state, "totalHints");

    return {
        ...stateWithoutLegacyCount,
        ...(hasLegacyHintCount ? { totalCharactersRevealed: totalHints } : {}),
        current: migrateCurrent(current),
        results: Array.isArray(results) ? results.map(migrateResult) : results
    };
}

function getDailyStorageKey() {
    return `bugguesser-daily-${selectedMode}-r${dailyRosterRevision}-${dailyDate}`;
}

function saveDailyState() {
    if (storageUnavailable) return false;

    try {
        localStorage.setItem(getDailyStorageKey(), JSON.stringify(dailyState));
        return true;
    } catch (error) {
        console.error("Could not save the daily Bugguesser attempt.", error);
        storageUnavailable = true;
        gameStatus.textContent =
            "Daily progress could not be saved. The game is paused to protect this attempt.";
        setRoundControlsDisabled(true);
        return false;
    }
}

function setRoundControlsDisabled(disabled) {
    guessInput.disabled = disabled;
    guessButton.disabled = disabled;
    revealCharacterButton.disabled = disabled;
    revealNameButton.disabled = disabled;
    nextButton.disabled = disabled;
}

function updateStats() {
    scoreElement.textContent = formatScore(dailyState.score);
    roundElement.textContent = `${dailyState.round + 1} / ${dailyRoundCount}`;
    guessCountElement.textContent = String(dailyState.totalGuesses);
    characterRevealCountElement.textContent = String(dailyState.totalCharactersRevealed);
}

function formatScore(score) {
    return String(Number(score.toFixed(2)));
}

function getRevealableCharacterCount(name) {
    return Array.from(name).filter((character) => character.trim() !== "").length;
}

function getCharactersPerHint(name) {
    return getRevealableCharacterCount(name) >= 10 ? 2 : 1;
}

function getNextHintCharacterCount(name, charactersRevealed) {
    const charactersRemaining = getRevealableCharacterCount(name) - charactersRevealed;
    if (charactersRevealed === 0) return Math.min(1, charactersRemaining);
    return Math.min(getCharactersPerHint(name), charactersRemaining);
}

function getHintCost(charactersToReveal) {
    return charactersToReveal === 1 ? 2 : 1;
}

function updateHintButton() {
    const charactersRemaining =
        getRevealableCharacterCount(answer.name) - dailyState.current.charactersRevealed;
    const charactersToReveal =
        getNextHintCharacterCount(answer.name, dailyState.current.charactersRevealed);
    const pointCost = getHintCost(charactersToReveal);
    const letterLabel = charactersToReveal === 1 ? "letter" : "letters";
    const pointLabel = pointCost === 1 ? "point" : "points";

    revealCharacterButton.textContent =
        `Reveal ${charactersToReveal} ${letterLabel} (-${pointCost} ${pointLabel})`;
    revealCharacterButton.disabled = charactersRemaining <= 0;
}

function fadeOutSprite() {
    if (!sprite.classList.contains("is-visible")) return Promise.resolve();

    sprite.classList.remove("is-visible");
    return new Promise((resolve) => {
        let timeoutId;

        function finishFade(event) {
            if (event && event.propertyName !== "opacity") return;
            clearTimeout(timeoutId);
            sprite.removeEventListener("transitionend", finishFade);
            resolve();
        }

        sprite.addEventListener("transitionend", finishFade);
        timeoutId = setTimeout(() => finishFade(), 700);
    });
}

function renderCurrentRound() {
    hideCharacterTooltips();
    answer = dailyCharacters[dailyState.round];
    updateStats();
    sprite.classList.remove("is-revealed");
    sprite.alt = "Black silhouette of a character";
    sprite.src = answer.silhouette ?? answer.image;
    guessForm.reset();
    renderNamePattern();

    if (sprite.complete && sprite.naturalWidth > 0) {
        requestAnimationFrame(() => sprite.classList.add("is-visible"));
    }

    if (dailyState.current.outcome) {
        renderResolvedRound();
        return;
    }

    gameStatus.textContent = "Type your guess. Guesses are not case-sensitive.";
    guessInput.disabled = false;
    guessButton.disabled = false;
    updateHintButton();
    revealNameButton.disabled = false;
    nextButton.hidden = true;
    guessInput.focus();
}

function renderNamePattern() {
    const characters = Array.from(answer.name);
    if (dailyState.current.charactersRevealed === 0) {
        namePattern.textContent = "?";
        return;
    }

    const revealedCharacters = new Set(
        getCharacterRevealOrder().slice(0, dailyState.current.charactersRevealed)
    );
    const pattern = characters.map((character, index) => {
        if (character.trim() === "") return character;
        return revealedCharacters.has(index) ? character : "_";
    }).join("");
    namePattern.textContent = pattern;
}

function getCharacterRevealOrder() {
    const revealableIndices = Array.from(answer.name, (character, index) =>
        character.trim() === "" ? -1 : index
    ).filter((index) => index >= 0);

    return [
        ...revealableIndices.slice(0, 1),
        ...shuffleForSeed(
            revealableIndices.slice(1),
            `${dailyDate}:${answer.image}:letter-reveals`
        ),
    ];
}

function createCharacterName(name, className = "") {
    const character = dailyCharacters.find((entry) => entry.name === name);
    const nameLink = document.createElement("a");
    const visibleName = document.createElement("span");

    nameLink.className = "character-name-link";
    const wikiPageTitle = characterWikiPageTitles[name] ?? name;
    nameLink.href = `https://hollowknight.wiki/w/${encodeURIComponent(wikiPageTitle.trim().replace(/\s+/g, "_"))}`;
    nameLink.target = "_blank";
    nameLink.rel = "noopener noreferrer";
    visibleName.className = className;
    visibleName.textContent = name;
    nameLink.append(visibleName);

    if (!character?.aliases?.length) {
        return nameLink;
    }

    const nameWithAliases = document.createElement("span");
    const aliasButton = document.createElement("button");
    const tooltip = document.createElement("span");
    const tooltipId = `character-name-tooltip-${++characterNameTooltipId}`;
    let hideTimeout;
    let isPinned = false;

    nameWithAliases.className = "character-name-with-aliases";
    nameLink.classList.add("has-aliases");
    aliasButton.className = "character-alias-button";
    aliasButton.type = "button";
    aliasButton.setAttribute("aria-label", `Show aliases for ${name}`);
    aliasButton.setAttribute("aria-describedby", tooltipId);
    aliasButton.setAttribute("aria-expanded", "false");
    const pencilIcon = document.createElement("span");
    pencilIcon.className = "character-alias-icon";
    pencilIcon.setAttribute("aria-hidden", "true");
    pencilIcon.textContent = "✎";
    aliasButton.append(pencilIcon);
    tooltip.id = tooltipId;
    tooltip.className = "character-name-aliases";
    tooltip.setAttribute("role", "tooltip");
    const aliasLabel = character.aliases.length === 1 ? "Alias" : "Aliases";
    tooltip.textContent = `${aliasLabel}: ${character.aliases.join(", ")}`;
    const hideTooltip = () => {
        tooltip.classList.remove("is-visible");
        aliasButton.setAttribute("aria-expanded", "false");
    };

    aliasButton.addEventListener("pointerenter", () => {
        clearTimeout(hideTimeout);
        showCharacterTooltip(aliasButton, tooltip);
    });
    aliasButton.addEventListener("pointerleave", () => {
        if (!isPinned) hideTimeout = setTimeout(hideTooltip, 150);
    });
    aliasButton.addEventListener("click", () => {
        isPinned = !isPinned;
        if (isPinned) {
            clearTimeout(hideTimeout);
            showCharacterTooltip(aliasButton, tooltip);
        } else {
            hideTooltip();
        }
    });
    aliasButton.addEventListener("focus", () => {
        showCharacterTooltip(aliasButton, tooltip);
    });
    aliasButton.addEventListener("blur", () => {
        clearTimeout(hideTimeout);
        isPinned = false;
        hideTooltip();
    });
    tooltip.addEventListener("pointerenter", () => clearTimeout(hideTimeout));
    tooltip.addEventListener("pointerleave", () => {
        if (!isPinned) hideTimeout = setTimeout(hideTooltip, 100);
    });
    nameWithAliases.append(nameLink, aliasButton);
    document.body.append(tooltip);
    characterTooltips.add(tooltip);
    return nameWithAliases;
}

function hideCharacterTooltips() {
    for (const tooltip of characterTooltips) {
        tooltip.classList.remove("is-visible");
        tooltip.remove();
    }
    characterTooltips.clear();
}

function showCharacterTooltip(trigger, tooltip) {
    tooltip.classList.add("is-visible");
    trigger.setAttribute("aria-expanded", "true");
    positionCharacterTooltip(trigger, tooltip);
}

function positionCharacterTooltip(trigger, tooltip) {
    const triggerBounds = trigger.getBoundingClientRect();
    const tooltipBounds = tooltip.getBoundingClientRect();
    const edgePadding = 8;
    const halfWidth = tooltipBounds.width / 2;
    const center = triggerBounds.left + triggerBounds.width / 2;
    const left = Math.max(
        halfWidth + edgePadding,
        Math.min(window.innerWidth - halfWidth - edgePadding, center)
    );
    const fitsAbove = triggerBounds.top >= tooltipBounds.height + edgePadding * 2;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${fitsAbove ? triggerBounds.top - edgePadding : triggerBounds.bottom + edgePadding}px`;
    tooltip.style.transform = fitsAbove ? "translate(-50%, -100%)" : "translate(-50%, 0)";
}

function renderResolvedRound() {
    const result = dailyState.results.at(-1);
    sprite.src = answer.image;
    sprite.classList.add("is-revealed");
    guessInput.disabled = true;
    guessButton.disabled = true;
    revealCharacterButton.disabled = true;
    revealNameButton.disabled = true;
    nextButton.disabled = false;

    if (result.outcome === "correct") {
        gameStatus.replaceChildren(
            "Correct! ",
            createCharacterName(result.name),
            ` — ${result.guesses} ${result.guesses === 1 ? "guess" : "guesses"}, `
            + `${result.charactersRevealed} ${result.charactersRevealed === 1 ? "character" : "characters"} revealed. +${formatScore(result.points)} points.`
        );
    } else if (result.outcome === "revealed") {
        gameStatus.replaceChildren(
            "The character was ",
            createCharacterName(result.name, "revealed-name"),
            `. 10 points deducted. ${result.guesses} ${result.guesses === 1 ? "guess" : "guesses"} and `
            + `${result.charactersRevealed} ${result.charactersRevealed === 1 ? "character" : "characters"} revealed.`
        );
    } else {
        gameStatus.replaceChildren(
            "Could not load ",
            createCharacterName(result.name),
            "'s image. This round was skipped."
        );
    }

    if (dailyState.finished) {
        nextButton.textContent = "Continue to summary";
        nextButton.hidden = false;
        nextButton.focus();
        return;
    }

    nextButton.textContent = "Next character";
    nextButton.hidden = false;
    nextButton.focus();
}

function showDailySummary() {
    gameCard.hidden = true;
    setupNote.hidden = true;
    dailySummary.hidden = false;
    document.getElementById("summaryTitle").textContent =
        `${gameModes[selectedMode].title} complete`;
    summaryDate.textContent = `${gameModes[selectedMode].title} · ${dailyDate} (UTC)`;
    summaryShareText.textContent = createDailySummaryText();
    dailySummaryBody.replaceChildren();

    for (const [index, result] of dailyState.results.entries()) {
        const row = document.createElement("tr");
        const roundCell = document.createElement("td");
        const nameCell = document.createElement("td");
        const timeCell = document.createElement("td");
        const guessesCell = document.createElement("td");
        const charactersRevealedCell = document.createElement("td");

        roundCell.textContent = `${index + 1}.`;
        nameCell.append(createCharacterName(result.name));
        timeCell.textContent = formatDuration(result.elapsedMs);
        guessesCell.textContent = String(result.guesses);
        charactersRevealedCell.textContent = String(result.charactersRevealed);
        row.append(roundCell, nameCell, timeCell, guessesCell, charactersRevealedCell);
        dailySummaryBody.append(row);
    }
}

function getRoundResultEmoji(result) {
    if (result.outcome === "revealed") return "❌";
    if (result.outcome === "skipped") return "⏭️";
    if (result.charactersRevealed > 0) return "💡";
    return "🟩";
}

function createDailySummaryText() {
    const totalElapsedMs = dailyState.results.reduce(
        (total, result) => total + result.elapsedMs,
        0
    );
    const challengeNumber = Math.floor(
        (Date.parse(`${dailyDate}T00:00:00.000Z`) - summaryNumberStart) / millisecondsPerDay
    ) + 1;
    const resultRows = [0, 1].map((rowIndex) =>
        dailyState.results
            .slice(rowIndex * 5, rowIndex * 5 + 5)
            .map(getRoundResultEmoji)
            .join("")
    );

    return [
        `BugGuesser #${challengeNumber}`,
        `${gameModes[selectedMode].summaryTitle} in ${formatDuration(totalElapsedMs)}`,
        `Guesses: ${dailyState.totalGuesses} | Score: ${formatScore(dailyState.score)}`,
        "",
        ...resultRows,
    ].join("\n");
}

async function copyDailySummary() {
    const summary = createDailySummaryText();

    try {
        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(summary);
            } catch {
                copyWithTemporaryTextarea(summary);
            }
        } else {
            copyWithTemporaryTextarea(summary);
        }
        copySummaryButton.textContent = "Copied!";
    } catch (error) {
        console.error("Could not copy the daily Bugguesser summary.", error);
        copySummaryButton.textContent = "Error! :c";
    }
}

function copyWithTemporaryTextarea(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    try {
        textarea.select();
        if (!document.execCommand("copy")) {
            throw new Error("The browser did not allow copying to the clipboard.");
        }
    } finally {
        textarea.remove();
    }
}

function formatDuration(milliseconds) {
    const totalSeconds = milliseconds / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(1);
    return minutes ? `${minutes}m ${seconds.padStart(4, "0")}s` : `${seconds}s`;
}

async function startNextRound() {
    if (dailyState.finished) {
        showDailySummary();
        return;
    }

    hideCharacterTooltips();
    nextButton.disabled = true;
    await fadeOutSprite();
    dailyState.round++;
    dailyState.current = {
        startedAt: Date.now(),
        guesses: 0,
        charactersRevealed: 0,
        hintPenalty: 0,
        outcome: null,
        points: 0
    };
    if (!saveDailyState()) return;
    nextButton.hidden = true;
    renderCurrentRound();
}

function resolveRound(outcome, points = 0) {
    if (dailyState.current.outcome) return;

    dailyState.current.outcome = outcome;
    dailyState.current.points = points;
    const result = {
        name: answer.name,
        elapsedMs: Math.max(0, Date.now() - dailyState.current.startedAt),
        guesses: dailyState.current.guesses,
        charactersRevealed: dailyState.current.charactersRevealed,
        outcome,
        points
    };
    dailyState.results.push(result);
    dailyState.finished = dailyState.round === dailyRoundCount - 1;
    if (!saveDailyState()) return;
    renderResolvedRound();
}

function submitGuess(event) {
    event.preventDefault();
    if (dailyState.current.outcome) return;

    const guess = guessInput.value.trim();
    if (!guess) return;

    dailyState.current.guesses++;
    dailyState.totalGuesses++;
    updateStats();

    const isCorrect = getAcceptedNames(answer).includes(guess.toLocaleLowerCase());

    if (!isCorrect) {
        gameStatus.textContent = "Not quite. Try another name, or reveal a character.";
        saveDailyState();
        guessInput.select();
        return;
    }

    const pointsEarned = Math.max(0, 10 - dailyState.current.hintPenalty);
    dailyState.score += pointsEarned;
    resolveRound("correct", pointsEarned);
}

function revealNextCharacter() {
    if (
        dailyState.current.outcome
        || dailyState.current.charactersRevealed >= getRevealableCharacterCount(answer.name)
    ) return;

    const charactersToReveal = getNextHintCharacterCount(
        answer.name,
        dailyState.current.charactersRevealed
    );
    dailyState.current.hintPenalty += getHintCost(charactersToReveal);
    dailyState.current.charactersRevealed += charactersToReveal;
    dailyState.totalCharactersRevealed += charactersToReveal;
    updateStats();
    renderNamePattern();
    if (dailyState.current.charactersRevealed >= getRevealableCharacterCount(answer.name)) {
        revealName();
        return;
    }

    updateHintButton();
    saveDailyState();
}

function revealName() {
    if (dailyState.current.outcome) return;

    dailyState.score = Math.max(0, dailyState.score - 10);
    updateStats();
    resolveRound("revealed", -10);
}

function handleSpriteError() {
    resolveRound("skipped");
}

function disableGame(message) {
    roundContent.hidden = false;
    gameStatus.textContent = message;
    setRoundControlsDisabled(true);
}

function startGame() {
    roundContent.hidden = false;

    if (dailyState.current.startedAt === null) {
        dailyState.current.startedAt = Date.now();
        if (!saveDailyState()) {
            disableGame("Daily progress could not be saved. The game is paused to protect your attempt.");
            return;
        }
    }

    renderCurrentRound();
}

sprite.addEventListener("error", handleSpriteError);
sprite.addEventListener("load", () => sprite.classList.add("is-visible"));
guessForm.addEventListener("submit", submitGuess);
revealCharacterButton.addEventListener("click", revealNextCharacter);
revealNameButton.addEventListener("click", revealName);
nextButton.addEventListener("click", startNextRound);
copySummaryButton.addEventListener("click", copyDailySummary);
let viewportScrollTimeout;
window.visualViewport?.addEventListener("resize", () => {
    if (document.activeElement !== guessInput) return;

    clearTimeout(viewportScrollTimeout);
    viewportScrollTimeout = setTimeout(() => {
        if (document.activeElement === guessInput) {
            guessButton.scrollIntoView({ block: "center", behavior: "instant" });
        }
    }, 100);
});

function isValidRoster(characters) {
    return Array.isArray(characters)
        && characters.length >= dailyRoundCount
        && characters.every((character) =>
            character
            && typeof character.name === "string"
            && character.name.trim()
            && typeof character.image === "string"
            && character.image.trim()
        );
}

function selectGameMode(mode) {
    const game = gameModes[mode];
    if (!game) {
        disableGame("This game mode is unavailable. Return to game selection and choose an available mode.");
        return;
    }

    selectedMode = mode;
    document.title = `${game.title} | Bugguesser`;
    document.getElementById("gameIntro").textContent =
        `${game.title}: identify each character from its silhouette.`;
    gameCard.hidden = false;
    roundContent.hidden = true;
    dailySummary.hidden = true;
    setupNote.hidden = true;

    if (!isValidRoster(game.characters)) {
        disableGame("This game mode does not have enough valid character data yet.");
        return;
    }

    dailyDate = new Date().toISOString().slice(0, 10);
    dailyCharacters = getDailyRosters(
        dailyDate,
        gameModes,
        dailyRoundCount,
        dailyRosterRevision
    )[mode];
    let storedState;
    try {
        storedState = localStorage.getItem(getDailyStorageKey());
        dailyState = storedState
            ? migrateSavedState(JSON.parse(storedState))
            : createInitialState();
    } catch (error) {
        console.error("Could not load the saved daily Bugguesser attempt.", error);
        disableGame("Saved daily progress could not be read. This attempt was not reset.");
        return;
    }

    restoreSavedRoster(dailyState);
    if (!isValidDailyState(dailyState)) {
        console.error("Saved daily Bugguesser attempt has an invalid format.");
        disableGame("Saved daily progress is invalid. This attempt was not reset.");
    } else if (!storedState && !saveDailyState()) {
        disableGame("Daily progress could not be saved. The game is paused to protect your attempt.");
    } else if (dailyState.finished) {
        showDailySummary();
    } else if (dailyState.current.outcome) {
        roundContent.hidden = false;
        renderCurrentRound();
    } else {
        startGame();
    }
}

const requestedMode = new URLSearchParams(window.location.search).get("mode");
selectGameMode(requestedMode);
