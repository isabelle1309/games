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
    const localCompletedProgress = new Map();

    for (const button of modeButtons) {
        const mode = button.dataset.gameMode;
        try {
            const savedState = localStorage.getItem(
                `bugguesser-daily-${mode}-r${dailyRosterRevision}-${dailyDate}`
            );
            if (savedState === null) continue;

            const state = JSON.parse(savedState);
            if (state?.version === dailyStateVersion
                && state.date === dailyDate
                && state.finished === true) {
                localCompletedProgress.set(mode, state);
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

        optionRow.classList.toggle("is-completed", isCompletedAnywhere);
        completionInfo.textContent = isCompletedAnywhere
            ? "Daily challenge completed"
            : "Daily challenge not yet completed";
        button.setAttribute(
            "aria-label",
            isCompletedAnywhere ? `${modeName}, daily challenge completed` : modeName
        );
    }
}

void updateCompletedModes();
window.addEventListener("pageshow", () => void updateCompletedModes());
window.addEventListener("accountchange", () => void updateCompletedModes());
