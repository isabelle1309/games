import { dailyChallengeStartDate } from "./bugguesser-config.js";

const modeEditions = [
    {
        title: "Hollow Knight",
        modes: [
            { id: "hk-enemies", title: "Enemies" },
            { id: "hk-npcs", title: "NPCs" },
            { id: "hk-bosses", title: "Bosses" },
            { id: "hk-npcs-bosses", title: "NPCs & bosses" }
        ]
    },
    {
        title: "Silksong",
        modes: [
            { id: "hkss-enemies", title: "Enemies" },
            { id: "hkss-npcs", title: "NPCs" },
            { id: "hkss-bosses", title: "Bosses" },
            { id: "hkss-npcs-bosses", title: "NPCs & bosses" }
        ]
    },
    {
        title: "Hollow Knight + Silksong",
        modes: [
            { id: "hk-hkss-enemies", title: "Enemies" },
            { id: "hk-hkss-npcs", title: "NPCs" },
            { id: "hk-hkss-bosses", title: "Bosses" },
            { id: "hk-hkss-npcs-bosses", title: "NPCs & bosses" }
        ]
    }
];
const today = new Date().toISOString().slice(0, 10);
const startDate = new Date(`${dailyChallengeStartDate}T00:00:00.000Z`);
const currentDate = new Date(`${today}T00:00:00.000Z`);
let displayedMonth = new Date(Date.UTC(
    currentDate.getUTCFullYear(),
    currentDate.getUTCMonth(),
    1
));
let selectedDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

const calendarTitle = document.getElementById("calendarTitle");
const archiveDays = document.getElementById("archiveDays");
const previousMonth = document.getElementById("previousMonth");
const nextMonth = document.getElementById("nextMonth");
const archiveDateStatus = document.getElementById("archiveDateStatus");
const archiveChallengeOptions = document.getElementById("archiveChallengeOptions");
const selectedDateTitle = document.getElementById("selectedDateTitle");
const archiveModeList = document.getElementById("archiveModeList");

function formatDate(date) {
    return new Intl.DateTimeFormat("en", {
        dateStyle: "long",
        timeZone: "UTC"
    }).format(date);
}

function getChallengeNumber(date) {
    return Math.floor((date.getTime() - startDate.getTime()) / 86400000) + 1;
}

function createDateButton(date) {
    const dateString = date.toISOString().slice(0, 10);
    const isAvailable = dateString >= dailyChallengeStartDate && dateString < today;
    const item = document.createElement("li");
    const button = document.createElement("button");
    const dayNumber = document.createElement("span");

    button.className = "archive-day";
    button.type = "button";
    button.disabled = !isAvailable;
    button.id = `archive-date-${dateString}`;
    button.setAttribute("aria-pressed", String(dateString === selectedDate));
    button.setAttribute(
        "aria-label",
        isAvailable
            ? `${formatDate(date)}, Bugguesser number ${getChallengeNumber(date)}`
            : formatDate(date)
    );
    dayNumber.className = "archive-day-number";
    dayNumber.textContent = String(date.getUTCDate());
    button.append(dayNumber);

    if (isAvailable) {
        const challengeNumber = document.createElement("small");
        challengeNumber.textContent = `#${getChallengeNumber(date)}`;
        button.append(challengeNumber);
        button.addEventListener("click", () => {
            selectedDate = dateString;
            render();
            document.getElementById(`archive-date-${dateString}`).focus();
        });
    }

    item.append(button);
    return item;
}

function renderCalendar() {
    calendarTitle.textContent = new Intl.DateTimeFormat("en", {
        month: "long",
        year: "numeric",
        timeZone: "UTC"
    }).format(displayedMonth);
    archiveDays.replaceChildren();

    const firstWeekday = (displayedMonth.getUTCDay() + 6) % 7;
    for (let index = 0; index < firstWeekday; index++) {
        const emptyDay = document.createElement("li");
        emptyDay.className = "archive-day-empty";
        emptyDay.setAttribute("aria-hidden", "true");
        archiveDays.append(emptyDay);
    }

    const daysInMonth = new Date(
        Date.UTC(displayedMonth.getUTCFullYear(), displayedMonth.getUTCMonth() + 1, 0)
    ).getUTCDate();
    for (let day = 1; day <= daysInMonth; day++) {
        archiveDays.append(createDateButton(new Date(Date.UTC(
            displayedMonth.getUTCFullYear(),
            displayedMonth.getUTCMonth(),
            day
        ))));
    }

    const earliestMonth = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1);
    const latestMonth = Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1);
    const monthValue = displayedMonth.getTime();
    previousMonth.disabled = monthValue <= earliestMonth;
    nextMonth.disabled = monthValue >= latestMonth;
}

function renderSelectedDate() {
    const date = new Date(`${selectedDate}T00:00:00.000Z`);
    const challengeNumber = getChallengeNumber(date);
    selectedDateTitle.textContent =
        `Bugguesser #${challengeNumber} · ${formatDate(date)}`;
    archiveModeList.replaceChildren();

    for (const edition of modeEditions) {
        const section = document.createElement("section");
        const heading = document.createElement("h3");
        const modeLinks = document.createElement("div");

        section.className = "archive-mode-edition";
        heading.textContent = edition.title;
        modeLinks.className = "archive-edition-modes";

        for (const mode of edition.modes) {
            const link = document.createElement("a");
            link.className = "archive-mode-link";
            link.href = `bugguesser-game.html?mode=${encodeURIComponent(mode.id)}&date=${selectedDate}`;
            link.textContent = mode.title;
            modeLinks.append(link);
        }

        section.append(heading, modeLinks);
        archiveModeList.append(section);
    }

    archiveDateStatus.textContent = `Selected Bugguesser #${challengeNumber} — ${formatDate(date)}.`;
    archiveChallengeOptions.hidden = false;
}

function render() {
    renderCalendar();
    if (selectedDate >= dailyChallengeStartDate && selectedDate < today) {
        renderSelectedDate();
    } else {
        archiveChallengeOptions.hidden = true;
        archiveDateStatus.textContent = "Select a date to choose a challenge.";
    }
}

previousMonth.addEventListener("click", () => {
    displayedMonth = new Date(Date.UTC(
        displayedMonth.getUTCFullYear(),
        displayedMonth.getUTCMonth() - 1,
        1
    ));
    selectedDate = "";
    render();
});

nextMonth.addEventListener("click", () => {
    displayedMonth = new Date(Date.UTC(
        displayedMonth.getUTCFullYear(),
        displayedMonth.getUTCMonth() + 1,
        1
    ));
    selectedDate = "";
    render();
});

if (selectedDate < dailyChallengeStartDate || selectedDate >= today) selectedDate = "";
render();
