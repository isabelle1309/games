import { dailyRosterRevision, dailyStateVersion } from "./bugguesser-config.js";
import {
    getCurrentUser,
    loadTodayProgress,
    saveGameProgress,
    setAccountMessage
} from "./account.js";

const modeButtons = document.querySelectorAll("[data-game-mode]");
const dailyDate = new Date().toISOString().slice(0, 10);

async function updateCompletedModes() {
    let cloudCompletedModes = new Set();
    let cloudInProgressModes = new Set();
    const localCompletedProgress = new Map();
    const localInProgressModes = new Set();

    for (const button of modeButtons) {
        const mode = button.dataset.gameMode;
        try {
            const savedState = localStorage.getItem(
                `bugguesser-daily-${mode}-r${dailyRosterRevision}-${dailyDate}`
            );
            if (savedState === null) continue;

            const state = JSON.parse(savedState);
            if (state?.version === dailyStateVersion
                && state.date === dailyDate) {
                if (state.finished === true) {
                    localCompletedProgress.set(mode, state);
                } else if (state.finished === false
                    && Number.isFinite(state.current?.startedAt)) {
                    localInProgressModes.add(mode);
                }
            }
        } catch (error) {
            console.error(`Could not read the saved ${mode} daily challenge.`, error);
        }
    }

    try {
        if (await getCurrentUser()) {
            const progress = await loadTodayProgress(dailyDate);
            const progressByMode = new Map(progress.map((entry) => [entry.mode, entry]));

            for (const [mode, state] of localCompletedProgress) {
                const remoteRow = progressByMode.get(mode);
                const localUpdatedAt = Date.parse(state.updatedAt ?? "") || 0;
                const remoteUpdatedAt = Date.parse(
                    remoteRow?.state?.updatedAt ?? remoteRow?.updated_at ?? ""
                ) || 0;

                if (!remoteRow || localUpdatedAt > remoteUpdatedAt) {
                    await saveGameProgress(mode, dailyDate, state);
                    progressByMode.set(mode, { mode, state });
                }
            }

            cloudCompletedModes = new Set(
                [...progressByMode.values()]
                    .filter((entry) => entry.state?.finished === true)
                    .map((entry) => entry.mode)
            );
            cloudInProgressModes = new Set(
                [...progressByMode.values()]
                    .filter((entry) =>
                        entry.state?.finished === false
                        && Number.isFinite(entry.state.current?.startedAt)
                    )
                    .map((entry) => entry.mode)
            );
        }
    } catch (error) {
        console.error("Could not load or sync account progress for today's challenges.", error);
        setAccountMessage("Cloud progress could not load or sync. Local progress is unchanged.");
    }

    for (const button of modeButtons) {
        const mode = button.dataset.gameMode;
        const modeName = button.querySelector("span").textContent;
        const completionInfo = button.querySelector(".mode-completion-info");
        const optionRow = button.closest(".game-mode-option");
        const isCompleted = localCompletedProgress.has(mode);
        const isCompletedAnywhere = isCompleted || cloudCompletedModes.has(mode);
        const isInProgress = !isCompletedAnywhere
            && (localInProgressModes.has(mode) || cloudInProgressModes.has(mode));

        optionRow.classList.toggle("is-completed", isCompletedAnywhere);
        optionRow.classList.toggle("is-in-progress", isInProgress);
        completionInfo.textContent = isCompletedAnywhere
            ? "Daily challenge completed"
            : isInProgress
                ? "Daily challenge in progress"
                : "Daily challenge not yet started";
        button.setAttribute(
            "aria-label",
            isCompletedAnywhere
                ? `${modeName}, daily challenge completed`
                : isInProgress
                    ? `${modeName}, daily challenge in progress`
                    : modeName
        );
    }
}

void updateCompletedModes();
window.addEventListener("pageshow", () => void updateCompletedModes());
window.addEventListener("accountchange", () => void updateCompletedModes());
