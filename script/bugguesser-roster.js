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

export function shuffleForSeed(items, seed) {
    const random = createSeededRandom(hashSeed(seed));
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index--) {
        const otherIndex = Math.floor(random() * (index + 1));
        [shuffled[index], shuffled[otherIndex]] = [shuffled[otherIndex], shuffled[index]];
    }
    return shuffled;
}

export function getAcceptedNames(character) {
    return [character.name, ...(character.aliases ?? [])]
        .map((name) => name.trim().toLocaleLowerCase())
        .filter(Boolean);
}

function getUniqueCharacters(characters) {
    const seenImages = new Set();
    const seenNames = new Set();

    return characters.filter((character) => {
        const names = getAcceptedNames(character);
        if (seenImages.has(character.image) || names.some((name) => seenNames.has(name))) {
            return false;
        }

        seenImages.add(character.image);
        names.forEach((name) => seenNames.add(name));
        return true;
    });
}

export function getDailyRosters(date, gameModes, roundCount, rosterRevision) {
    const modeEntries = Object.entries(gameModes).map(([mode, game]) => ({
        mode,
        characters: getUniqueCharacters(game.characters),
    }));
    const orderedModes = shuffleForSeed(
        modeEntries,
        `${date}:r${rosterRevision}:mode-order`
    ).sort((first, second) => first.characters.length - second.characters.length);
    const usedImages = new Set();
    const usedNames = new Set();
    const dailyRosters = {};

    for (const { mode, characters } of orderedModes) {
        const available = characters.filter((character) =>
            !usedImages.has(character.image)
            && !getAcceptedNames(character).some((name) => usedNames.has(name))
        );
        const roster = shuffleForSeed(
            available,
            `${date}:r${rosterRevision}:${mode}`
        ).slice(0, roundCount);

        if (roster.length !== roundCount) {
            throw new Error(`Not enough unique characters to create the daily roster for ${mode} on ${date}.`);
        }

        dailyRosters[mode] = roster;
        for (const character of roster) {
            usedImages.add(character.image);
            getAcceptedNames(character).forEach((name) => usedNames.add(name));
        }
    }

    return dailyRosters;
}
