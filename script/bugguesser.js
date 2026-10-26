import { characters } from "./bugguesser-data.js";

const hintQuestion = "How does this bug move?";
const maxHintsPerRound = 2;
const dailyRoundCount = 10;
const dailyStateVersion = 1;
// Keep the schedule reproducible for every visitor while applying the seven-day exclusion rule.
const dailyScheduleStart = Date.UTC(2020, 0, 1);
const millisecondsPerDay = 24 * 60 * 60 * 1000;

const scoreElement = document.getElementById("score");
const roundElement = document.getElementById("round");
const guessCountElement = document.getElementById("guessCount");
const hintCountElement = document.getElementById("hintCount");
const sprite = document.getElementById("characterSprite");
const gameStatus = document.getElementById("gameStatus");
const guessForm = document.getElementById("guessForm");
const guessInput = document.getElementById("guessInput");
const guessButton = guessForm.querySelector("button");
const hintsList = document.getElementById("hintsList");
const hintButton = document.getElementById("hintButton");
const revealNameButton = document.getElementById("revealNameButton");
const nextButton = document.getElementById("nextButton");
const gameReady = document.getElementById("gameReady");
const readyButton = document.getElementById("readyButton");
const roundContent = document.getElementById("roundContent");
const setupNote = document.getElementById("setupNote");
const gameCard = document.getElementById("gameCard");
const dailySummary = document.getElementById("dailySummary");
const dailySummaryBody = document.getElementById("dailySummaryBody");
const summaryDate = document.getElementById("summaryDate");
const copySummaryButton = document.getElementById("copySummaryButton");
const copySummaryStatus = document.getElementById("copySummaryStatus");

let dailyCharacters = [];
let dailyDate = "";
let dailyState;
let answer;
let storageUnavailable = false;

function hashSeed(value) {
    let hash = 2166136261;
    for (const character of value) {
        hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    }
    return hash >>> 0;
}

function createSeededRandom(seed) {
    let state = seed;
    return () => {
        state += 0x6D2B79F5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffleForDate(items, date) {
    const random = createSeededRandom(hashSeed(date));
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index--) {
        const otherIndex = Math.floor(random() * (index + 1));
        [shuffled[index], shuffled[otherIndex]] = [shuffled[otherIndex], shuffled[index]];
    }
    return shuffled;
}

function getDailyCharacters(date) {
    const seenNames = new Set();
    const uniqueCharacters = characters.filter((character) => {
        const acceptedNames = [character.name, ...(character.aliases ?? [])]
            .map((name) => name.trim().toLocaleLowerCase());
        if (acceptedNames.some((name) => seenNames.has(name))) return false;
        acceptedNames.forEach((name) => seenNames.add(name));
        return true;
    });

    const targetDay = Date.parse(`${date}T00:00:00.000Z`);
    if (!Number.isFinite(targetDay) || targetDay < dailyScheduleStart) {
        throw new RangeError(`Daily roster date must be on or after 2020-01-01: ${date}`);
    }

    let recentRosters = [];
    for (let day = dailyScheduleStart; day <= targetDay; day += millisecondsPerDay) {
        const currentDate = new Date(day).toISOString().slice(0, 10);
        const recentlyUsed = new Set(
            recentRosters.flatMap((roster) => roster.map((character) => character.image))
        );
        const available = uniqueCharacters.filter(
            (character) => !recentlyUsed.has(character.image)
        );
        const roster = shuffleForDate(available, currentDate).slice(0, dailyRoundCount);

        if (roster.length !== dailyRoundCount) {
            throw new Error(`Not enough eligible characters to create the daily roster for ${currentDate}.`);
        }

        recentRosters = [...recentRosters, roster].slice(-7);
    }

    return recentRosters.at(-1);
}

function createInitialState() {
    return {
        version: dailyStateVersion,
        date: dailyDate,
        order: dailyCharacters.map((character) => character.image),
        round: 0,
        score: 0,
        totalGuesses: 0,
        totalHints: 0,
        results: [],
        current: {
            startedAt: null,
            guesses: 0,
            hints: 0,
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
        && Number.isInteger(state.totalHints)
        && Array.isArray(state.results)
        && state.results.length === state.round + (state.current?.outcome ? 1 : 0)
        && state.results.every((result) =>
            result
            && typeof result.name === "string"
            && Number.isFinite(result.elapsedMs)
            && Number.isInteger(result.guesses)
            && Number.isInteger(result.hints)
            && ["correct", "revealed", "skipped"].includes(result.outcome)
        )
        && state.current
        && (state.current.startedAt === null || Number.isFinite(state.current.startedAt))
        && Number.isInteger(state.current.guesses)
        && Number.isInteger(state.current.hints)
        && state.current.hints >= 0
        && state.current.hints <= maxHintsPerRound
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
        (image) => characters.find((character) => character.image === image)
    );
    const savedImages = new Set(state.order);
    const savedNames = new Set();
    const hasUniqueNames = savedCharacters.every((character) => {
        if (!character) return false;
        const names = [character.name, ...(character.aliases ?? [])]
            .map((name) => name.trim().toLocaleLowerCase());
        if (names.some((name) => savedNames.has(name))) return false;
        names.forEach((name) => savedNames.add(name));
        return true;
    });

    if (savedImages.size === dailyRoundCount && hasUniqueNames) {
        dailyCharacters = savedCharacters;
    }
}

function saveDailyState() {
    if (storageUnavailable) return false;

    try {
        localStorage.setItem(`bugguesser-daily-${dailyDate}`, JSON.stringify(dailyState));
        return true;
    } catch (error) {
        console.error("Could not save the daily Bugguesser attempt.", error);
        storageUnavailable = true;
        gameStatus.textContent =
            "Daily progress could not be saved. The game is paused to avoid losing your one attempt.";
        setRoundControlsDisabled(true);
        return false;
    }
}

function setRoundControlsDisabled(disabled) {
    guessInput.disabled = disabled;
    guessButton.disabled = disabled;
    hintButton.disabled = disabled;
    revealNameButton.disabled = disabled;
    nextButton.disabled = disabled;
}

function updateStats() {
    scoreElement.textContent = String(dailyState.score);
    roundElement.textContent = `${dailyState.round + 1} / ${dailyRoundCount}`;
    guessCountElement.textContent = String(dailyState.totalGuesses);
    hintCountElement.textContent = String(dailyState.totalHints);
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
    answer = dailyCharacters[dailyState.round];
    updateStats();
    sprite.classList.remove("is-revealed");
    sprite.alt = "Black silhouette of a character";
    sprite.src = answer.image;
    guessForm.reset();
    hintsList.replaceChildren();

    for (let index = 0; index < dailyState.current.hints; index++) {
        appendHint(index);
    }

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
    hintButton.disabled = dailyState.current.hints >= maxHintsPerRound;
    hintButton.hidden = false;
    hintButton.textContent = dailyState.current.hints === 0
        ? "Reveal movement hint (−2 points)"
        : "Reveal name pattern (−2 points)";
    revealNameButton.disabled = false;
    nextButton.hidden = true;
    guessInput.focus();
}

function appendHint(index) {
    const hint = document.createElement("li");
    const question = document.createElement("span");
    const answerText = document.createElement("strong");
    question.className = "hint-question";
    answerText.className = "hint-answer";

    if (index === 0) {
        question.textContent = hintQuestion;
        answerText.textContent = answer.hints[0];
    } else {
        question.textContent = "Name pattern:";
        answerText.textContent = Array.from(answer.name, (character) =>
            character === " " ? " " : "_"
        ).join("");
        answerText.classList.add("name-pattern");
    }

    hint.append(question, " ", answerText);
    hintsList.append(hint);
}

function renderResolvedRound() {
    const result = dailyState.results.at(-1);
    sprite.classList.add("is-revealed");
    guessInput.disabled = true;
    guessButton.disabled = true;
    hintButton.disabled = true;
    revealNameButton.disabled = true;
    nextButton.disabled = false;

    if (result.outcome === "correct") {
        gameStatus.textContent =
            `Correct! ${result.name} — ${result.guesses} ${result.guesses === 1 ? "guess" : "guesses"}, `
            + `${result.hints} ${result.hints === 1 ? "hint" : "hints"} used. +${result.points} points.`;
    } else if (result.outcome === "revealed") {
        const revealedName = document.createElement("strong");
        revealedName.className = "revealed-name";
        revealedName.textContent = result.name;
        gameStatus.replaceChildren(
            "The bug was ",
            revealedName,
            `. 10 points deducted. ${result.guesses} ${result.guesses === 1 ? "guess" : "guesses"} and `
            + `${result.hints} ${result.hints === 1 ? "hint" : "hints"} used.`
        );
    } else {
        gameStatus.textContent = `Could not load ${result.name}'s sprite. This round was skipped.`;
    }

    if (dailyState.finished) {
        nextButton.textContent = "Continue to summary";
        nextButton.hidden = false;
        nextButton.focus();
        return;
    }

    nextButton.textContent = "Next bug";
    nextButton.hidden = false;
    nextButton.focus();
}

function showDailySummary() {
    gameCard.hidden = true;
    setupNote.hidden = true;
    dailySummary.hidden = false;
    summaryDate.textContent = `${dailyDate} (UTC)`;
    dailySummaryBody.replaceChildren();

    for (const [index, result] of dailyState.results.entries()) {
        const row = document.createElement("tr");
        const roundCell = document.createElement("td");
        const nameCell = document.createElement("td");
        const timeCell = document.createElement("td");
        const guessesCell = document.createElement("td");
        const hintsCell = document.createElement("td");

        roundCell.textContent = `${index + 1}.`;
        nameCell.textContent = result.name;
        timeCell.textContent = formatDuration(result.elapsedMs);
        guessesCell.textContent = String(result.guesses);
        hintsCell.textContent = String(result.hints);
        row.append(roundCell, nameCell, timeCell, guessesCell, hintsCell);
        dailySummaryBody.append(row);
    }
}

function createDailySummaryText() {
    const rounds = dailyState.results.map((result, index) =>
        `${index + 1}. ${formatDuration(result.elapsedMs)}, ${result.guesses}, ${result.hints}`
    );

    return [
        `Bugguesser - ${dailyDate} (UTC)`,
        `Score: ${dailyState.score} | Guesses: ${dailyState.totalGuesses} | Hints: ${dailyState.totalHints}`,
        "",
        ...rounds
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
        copySummaryStatus.textContent = "Summary copied to clipboard.";
    } catch (error) {
        console.error("Could not copy the daily Bugguesser summary.", error);
        copySummaryStatus.textContent = "Could not copy the summary. Please try again.";
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

    nextButton.disabled = true;
    await fadeOutSprite();
    dailyState.round++;
    dailyState.current = {
        startedAt: Date.now(),
        guesses: 0,
        hints: 0,
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
        hints: dailyState.current.hints,
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

    const acceptedNames = [answer.name, ...(answer.aliases ?? [])];
    const isCorrect = acceptedNames.some(
        (name) => guess.toLocaleLowerCase() === name.toLocaleLowerCase()
    );

    if (!isCorrect) {
        gameStatus.textContent = "Not quite. Try another name, or reveal a hint.";
        saveDailyState();
        guessInput.select();
        return;
    }

    const pointsEarned = Math.max(0, 10 - dailyState.current.hints * 2);
    dailyState.score += pointsEarned;
    resolveRound("correct", pointsEarned);
}

function revealHint() {
    if (dailyState.current.outcome || dailyState.current.hints >= maxHintsPerRound) return;

    appendHint(dailyState.current.hints);
    dailyState.current.hints++;
    dailyState.totalHints++;
    updateStats();
    if (dailyState.current.hints === maxHintsPerRound) {
        hintButton.disabled = true;
        hintButton.textContent = "No more hints";
    } else {
        hintButton.textContent = "Reveal name pattern (−2 points)";
    }
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
    gameReady.hidden = true;
    roundContent.hidden = false;
    gameStatus.textContent = message;
    setRoundControlsDisabled(true);
}

function startGame() {
    gameReady.hidden = true;
    roundContent.hidden = false;
    readyButton.disabled = true;

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
hintButton.addEventListener("click", revealHint);
revealNameButton.addEventListener("click", revealName);
nextButton.addEventListener("click", startNextRound);
readyButton.addEventListener("click", startGame);
copySummaryButton.addEventListener("click", copyDailySummary);

const rosterIsValid = Array.isArray(characters)
    && characters.length >= dailyRoundCount
    && characters.every((character) =>
        character
        && typeof character.name === "string"
        && character.name.trim()
        && typeof character.image === "string"
        && character.image.trim()
        && Array.isArray(character.hints)
        && character.hints.length === 1
        && character.hints.every((hint) => typeof hint === "string" && hint.trim())
    );

if (!rosterIsValid) {
    gameReady.hidden = true;
    roundContent.hidden = false;
    gameStatus.textContent = "The roster is empty or contains invalid character data.";
    setupNote.hidden = false;
    roundElement.textContent = "0";
} else {
    dailyDate = new Date().toISOString().slice(0, 10);
    dailyCharacters = getDailyCharacters(dailyDate);
    setupNote.hidden = true;
    document.getElementById("gameIntro").textContent =
        ``;

    let storedState;
    try {
        storedState = localStorage.getItem(`bugguesser-daily-${dailyDate}`);
        dailyState = storedState ? JSON.parse(storedState) : createInitialState();
    } catch (error) {
        console.error("Could not load the saved daily Bugguesser attempt.", error);
        disableGame("Saved daily progress could not be read. This attempt was not reset.");
    }

    if (dailyState) restoreSavedRoster(dailyState);

    if (dailyState && !isValidDailyState(dailyState)) {
        console.error("Saved daily Bugguesser attempt has an invalid format.");
        disableGame("Saved daily progress is invalid. This attempt was not reset.");
    } else if (dailyState) {
        if (!storedState && !saveDailyState()) {
            disableGame("Daily progress could not be saved. The game is paused to protect your attempt.");
        } else {
            if (dailyState.current.outcome) {
                gameReady.hidden = true;
                roundContent.hidden = false;
                renderCurrentRound();
            } else {
                gameStatus.textContent = "Your daily challenge is ready. Select Ready when you'd like to begin.";
            }
        }
    }
}
