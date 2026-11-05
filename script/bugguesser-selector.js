const modeButtons = document.querySelectorAll("[data-game-mode]");
const dailyDate = new Date().toISOString().slice(0, 10);
const dailyRosterRevision = 3;

function updateCompletedModes() {
    for (const button of modeButtons) {
        const mode = button.dataset.gameMode;
        const modeName = button.querySelector("span").textContent;
        const selectionInfo = button.querySelector(".mode-selection-info");
        const completionInfo = button.querySelector(".mode-completion-info");
        const optionRow = button.closest(".game-mode-option");
        const playLink = optionRow.querySelector("[data-play-link]");
        let isCompleted = false;

        try {
            const savedState = localStorage.getItem(
                `bugguesser-daily-${mode}-r${dailyRosterRevision}-${dailyDate}`
            );
            if (savedState !== null) {
                const state = JSON.parse(savedState);
                isCompleted = state?.version === 1
                    && state.date === dailyDate
                    && state.finished === true;
            }
        } catch (error) {
            console.error(`Could not read the saved ${mode} daily challenge.`, error);
        }

        optionRow.classList.toggle("is-completed", isCompleted);
        completionInfo.textContent = isCompleted
            ? "Daily challenge completed"
            : "Daily challenge not yet completed";
        playLink.textContent = isCompleted ? "View Results" : "Play";
        button.setAttribute(
            "aria-label",
            isCompleted ? `${modeName}, daily challenge completed` : modeName
        );
    }
}

modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const mode = button.dataset.gameMode;
        const modeName = button.querySelector("span").textContent;

        modeButtons.forEach((option) => {
            const optionRow = option.closest(".game-mode-option");
            const playLink = optionRow.querySelector("[data-play-link]");
            const selectionInfo = option.querySelector(".mode-selection-info");
            const isSelected = option === button;

            option.setAttribute("aria-pressed", String(isSelected));
            optionRow.classList.toggle("is-selected", isSelected);
            selectionInfo.textContent = isSelected
                ? `${modeName} daily challenge selected.`
                : "";
            selectionInfo.hidden = !isSelected;
            playLink.href = `bugguesser-game.html?mode=${encodeURIComponent(mode)}`;
            playLink.hidden = !isSelected;
        });
    });
});

updateCompletedModes();
window.addEventListener("pageshow", updateCompletedModes);
