import { dailyRosterRevision, dailyStateVersion } from "./bugguesser-config.js";
import {
    getCurrentUser,
    loadTodayProgress,
    setAccountMessage
} from "./account.js";

const modeButtons = document.querySelectorAll("[data-game-mode]");
const dailyDate = new Date().toISOString().slice(0, 10);

async function updateCompletedModes() {
    let cloudCompletedModes = new Set();

    try {
        if (await getCurrentUser()) {
            const progress = await loadTodayProgress(dailyDate);
            cloudCompletedModes = new Set(
                progress
                    .filter((entry) => entry.state?.finished === true)
                    .map((entry) => entry.mode)
            );
        }
    } catch (error) {
        console.error("Could not load account progress for today's challenges.", error);
        setAccountMessage("Cloud progress is unavailable. Local progress is unchanged.");
    }

    for (const button of modeButtons) {
        const mode = button.dataset.gameMode;
        const modeName = button.querySelector("span").textContent;
        const completionInfo = button.querySelector(".mode-completion-info");
        const optionRow = button.closest(".game-mode-option");
        let isCompleted = false;

        try {
            const savedState = localStorage.getItem(
                `bugguesser-daily-${mode}-r${dailyRosterRevision}-${dailyDate}`
            );
            if (savedState !== null) {
                const state = JSON.parse(savedState);
                isCompleted = state?.version === dailyStateVersion
                    && state.date === dailyDate
                    && state.finished === true;
            }
        } catch (error) {
            console.error(`Could not read the saved ${mode} daily challenge.`, error);
        }
        isCompleted ||= cloudCompletedModes.has(mode);

        optionRow.classList.toggle("is-completed", isCompleted);
        completionInfo.textContent = isCompleted
            ? "Daily challenge completed"
            : "Daily challenge not yet completed";
        button.setAttribute(
            "aria-label",
            isCompleted ? `${modeName}, daily challenge completed` : modeName
        );
    }
}

void updateCompletedModes();
window.addEventListener("pageshow", () => void updateCompletedModes());
window.addEventListener("accountchange", () => void updateCompletedModes());
