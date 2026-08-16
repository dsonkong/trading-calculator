/**
 * Trading Calculator • Storage & Formatting Module
 */

function formatWithThousandSeparator(value) {
    if (value === null || value === undefined || value === "") return "";

    const str = String(value);
    const clean = str.replace(/[^\d.]/g, "");
    if (!clean) return "";

    const [intPart, ...decimalParts] = clean.split(".");
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const decimalPart = decimalParts.length ? `.${decimalParts.join("")}` : "";

    return `${formattedInt}${decimalPart}`;
}

function parseFormattedNumber(value) {
    if (value === null || value === undefined || value === "") return 0;

    const clean = String(value).replace(/,/g, "").trim();
    const num = Number(clean);

    return Number.isFinite(num) ? num : 0;
}

const Storage = {
    save(inputs) {
        if (!inputs) return;

        try {
            if (inputs.symbol) localStorage.setItem(CONFIG.storage.symbol, inputs.symbol);
            localStorage.setItem(CONFIG.storage.previousPrice, String(inputs.previousPrice));
            localStorage.setItem(CONFIG.storage.previousQuantity, String(inputs.previousQuantity));
            localStorage.setItem(CONFIG.storage.reserve, String(inputs.reserve));
        } catch (error) {
            console.warn("localStorage unavailable:", error);
        }
    },

    load() {
        return {
            symbol: localStorage.getItem(CONFIG.storage.symbol) || CONFIG.defaultSymbol,
            previousPrice: this.getNumber(CONFIG.storage.previousPrice),
            previousQuantity: this.getNumber(CONFIG.storage.previousQuantity),
            reserve: this.getNumber(CONFIG.storage.reserve)
        };
    },

    getNumber(key) {
        try {
            const value = localStorage.getItem(key);
            if (value === null || value === "") return null;

            const num = Number(value);
            return Number.isFinite(num) ? num : null;
        } catch (error) {
            return null;
        }
    }
};

function loadInputsToScreen() {
    const data = Storage.load();

    const fields = {
        symbolInput: data.symbol,
        previousPrice: data.previousPrice,
        previousQuantity: data.previousQuantity,
        reserve: data.reserve
    };

    Object.entries(fields).forEach(([id, value]) => {
        const el = $(id);
        if (!el || value === null || value === undefined) return;

        const formatted =
            id === "symbolInput" ? value : formatWithThousandSeparator(value);

        el.value = formatted;
    });
}

function getInputsFromScreen() {
    return {
        symbol: ($("symbolInput")?.value || CONFIG.defaultSymbol).trim().toUpperCase(),
        previousPrice: parseFormattedNumber($("previousPrice")?.value || 0),
        previousQuantity: parseFormattedNumber($("previousQuantity")?.value || 0),
        reserve: parseFormattedNumber($("reserve")?.value || 0)
    };
}

function validateInputs(inputs) {
    if (!inputs.symbol) throw new Error("Please enter a valid ticker symbol.");
    if (!isPositiveNumber(inputs.previousPrice)) throw new Error("Enter a valid Previous Trade Price.");
    if (!isPositiveNumber(inputs.previousQuantity)) throw new Error("Enter a valid Previous Trade Quantity.");
    if (!isNonNegativeNumber(inputs.reserve)) throw new Error("Reserve cannot be negative.");

    return true;
}