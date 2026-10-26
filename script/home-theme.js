const themeStorageKey = "home-theme";
const savedTheme = localStorage.getItem(themeStorageKey);

if (savedTheme === "light") {
    document.documentElement.dataset.theme = "light";
}

document.addEventListener("DOMContentLoaded", () => {
    const themeToggle = document.getElementById("themeToggle");
    const themeIcon = document.getElementById("themeIcon");

    function updateToggle(theme) {
        const isDark = theme !== "light";
        themeIcon.src = isDark ? "images/moon.svg" : "images/lightbulb.svg";
        themeToggle.title = `Switch to ${isDark ? "light" : "dark"} mode`;
        themeToggle.setAttribute("aria-pressed", String(isDark));
        themeToggle.setAttribute(
            "aria-label",
            `Switch to ${isDark ? "light" : "dark"} mode`
        );
    }

    updateToggle(document.documentElement.dataset.theme);

    themeToggle.addEventListener("click", () => {
        const nextTheme =
            document.documentElement.dataset.theme === "light" ? "dark" : "light";
        document.documentElement.dataset.theme = nextTheme;
        updateToggle(nextTheme);
        localStorage.setItem(themeStorageKey, nextTheme);
    });
});
