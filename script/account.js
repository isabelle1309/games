import { supabasePublishableKey, supabaseUrl } from "./supabase-config.js";

let supabase;
let currentUser = null;
let resolveAuthReady;
let authIsReady = false;
let creatingAccount = false;
let accountMessageText = "";
const authReady = new Promise((resolve) => {
    resolveAuthReady = resolve;
});
const progressSaveQueues = new Map();
const accountDialog = document.getElementById("accountDialog");

function updateAccountUi(user) {
    const accountToggle = document.getElementById("accountToggle");

    if (accountToggle) {
        accountToggle.textContent = user ? "Log out" : "Sign in";
        accountToggle.setAttribute("aria-label", user ? "Log out" : "Sign in");
    }

    if (user && accountDialog?.open) accountDialog.close();
}

function updateAccountNotice() {
    const notice = document.getElementById("accountNotice");
    if (!notice) return;

    notice.textContent = accountMessageText;
    notice.hidden = !accountMessageText || Boolean(accountDialog?.open);
}

export function setAccountMessage(message) {
    accountMessageText = message;
    const dialogMessage = document.getElementById("accountMessage");
    if (dialogMessage) dialogMessage.textContent = message;
    updateAccountNotice();
}

function setAccountButtonsDisabled(disabled) {
    for (const id of ["accountToggle", "accountSubmit", "accountModeToggle"]) {
        const button = document.getElementById(id);
        if (button) button.disabled = disabled;
    }
}

function updateAccountFormMode() {
    const title = document.getElementById("accountDialogTitle");
    const description = document.getElementById("accountDialogDescription");
    const submit = document.getElementById("accountSubmit");
    const modeToggle = document.getElementById("accountModeToggle");
    const password = document.getElementById("accountPassword");

    if (title) title.textContent = creatingAccount ? "Create account" : "Sign in";
    if (description) {
        description.textContent = creatingAccount
            ? "Create an account to sync daily progress across devices."
            : "Sign in to sync your daily progress across devices.";
    }
    if (submit) submit.textContent = creatingAccount ? "Create account" : "Sign in";
    if (modeToggle) {
        modeToggle.textContent = creatingAccount
            ? "Back to sign in"
            : "Create an account";
    }
    if (password) password.autocomplete = creatingAccount ? "new-password" : "current-password";
}

function getAuthErrorMessage(error, isCreatingAccount) {
    const message = error.message?.toLowerCase() ?? "";
    if (message.includes("invalid login credentials")) {
        return "Email or password is incorrect.";
    }
    if (message.includes("already registered")) {
        return "An account already uses this email. Sign in instead.";
    }
    if (message.includes("password") && message.includes("characters")) {
        return "Choose a stronger password.";
    }
    if (message.includes("email not confirmed")) {
        return "Confirm your email address before signing in.";
    }
    return isCreatingAccount
        ? "Could not create the account. Please try again."
        : "Could not sign in. Check your email and password, then try again.";
}

function reloadGamePage() {
    if (document.getElementById("gameCard")) window.location.reload();
}

async function authenticate() {
    const form = document.getElementById("accountForm");
    if (!form.reportValidity()) return;

    const email = document.getElementById("accountEmail").value.trim();
    const password = document.getElementById("accountPassword").value;
    setAccountButtonsDisabled(true);
    setAccountMessage("");

    try {
        await authReady;
        if (!supabase) throw new Error("Supabase Auth could not be initialized.");

        if (creatingAccount) {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: new URL("./bugguesser.html", window.location.href).href
                }
            });
            if (error) throw error;
            if (!data.session) {
                setAccountMessage("Check your email to confirm the new account, then sign in.");
                return;
            }
            setAccountMessage("");
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            setAccountMessage("");
        }

        if (accountDialog?.open) accountDialog.close();
        reloadGamePage();
    } catch (error) {
        console.error(creatingAccount
            ? "Could not create the Supabase account."
            : "Could not sign in to Supabase.", error);
        setAccountMessage(error.status
            ? getAuthErrorMessage(error, creatingAccount)
            : "Account service is unavailable. Check your Supabase configuration and try again.");
    } finally {
        setAccountButtonsDisabled(false);
    }
}

document.getElementById("accountToggle")?.addEventListener("click", async () => {
    if (!currentUser) {
        setAccountMessage("");
        if (accountDialog && !accountDialog.open) accountDialog.showModal();
        return;
    }

    setAccountButtonsDisabled(true);
    setAccountMessage("");
    try {
        await authReady;
        if (!supabase) throw new Error("Supabase Auth could not be initialized.");
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    } catch (error) {
        console.error("Could not sign out.", error);
        setAccountMessage("Sign-out failed. Please try again.");
    } finally {
        setAccountButtonsDisabled(false);
    }
});

document.getElementById("accountForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void authenticate();
});

document.getElementById("accountModeToggle")?.addEventListener("click", () => {
    creatingAccount = !creatingAccount;
    setAccountMessage("");
    updateAccountFormMode();
});

document.getElementById("accountClose")?.addEventListener("click", () => {
    accountDialog?.close();
});

accountDialog?.addEventListener("click", (event) => {
    if (event.target === accountDialog) accountDialog.close();
});
accountDialog?.addEventListener("close", () => {
    creatingAccount = false;
    updateAccountFormMode();
    updateAccountNotice();
});

async function initializeSupabase() {
    try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        supabase = createClient(supabaseUrl, supabasePublishableKey);
        supabase.auth.onAuthStateChange((_event, session) => {
            currentUser = session?.user ?? null;
            updateAccountUi(currentUser);

            if (!authIsReady) {
                authIsReady = true;
                resolveAuthReady(currentUser);
            }

            window.setTimeout(() => {
                window.dispatchEvent(new Event("accountchange"));
            }, 0);
        });
    } catch (error) {
        console.error("Could not initialize Supabase account support.", error);
        updateAccountUi(null);
        setAccountMessage("Account services could not load. Local game progress is still available.");
        if (!authIsReady) {
            authIsReady = true;
            resolveAuthReady(null);
        }
    }
}

updateAccountFormMode();
void initializeSupabase();

export async function getCurrentUser() {
    await authReady;
    return currentUser;
}

export function getCachedUser() {
    return currentUser;
}

export async function loadGameProgress(mode, challengeDate) {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from("bugguesser_progress")
        .select("state, updated_at")
        .eq("user_id", user.id)
        .eq("mode", mode)
        .eq("challenge_date", challengeDate)
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function loadTodayProgress(challengeDate) {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from("bugguesser_progress")
        .select("mode, state")
        .eq("user_id", user.id)
        .eq("challenge_date", challengeDate);

    if (error) throw error;
    return data;
}

export function saveGameProgress(mode, challengeDate, state) {
    const user = currentUser;
    if (!user || !supabase) return Promise.resolve();

    const key = `${user.id}:${mode}:${challengeDate}`;
    const previousSave = progressSaveQueues.get(key) ?? Promise.resolve();
    const stateSnapshot = JSON.parse(JSON.stringify(state));
    const save = previousSave.catch(() => {}).then(async () => {
        const { error } = await supabase
            .from("bugguesser_progress")
            .upsert({
                user_id: user.id,
                mode,
                challenge_date: challengeDate,
                state: stateSnapshot,
                updated_at: stateSnapshot.updatedAt ?? new Date().toISOString()
            }, {
                onConflict: "user_id,mode,challenge_date"
            });

        if (error) throw error;
    });

    progressSaveQueues.set(key, save);
    save.then(
        () => {
            if (progressSaveQueues.get(key) === save) progressSaveQueues.delete(key);
        },
        () => {
            if (progressSaveQueues.get(key) === save) progressSaveQueues.delete(key);
        }
    );
    return save;
}
