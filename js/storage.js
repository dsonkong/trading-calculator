/**
 * Trading Calculator • Storage & Formatting Module
 */

function formatWithThousandSeparator(val) {
    if (val === null || val === undefined || val === "") return "";
    const str = String(val);
    
    let clean = "";
    let hasDecimal = false;
    for (const char of str) {
        if (/\d/.test(char)) clean += char;
        else if (char === "." && !hasDecimal) {
            clean += char;
            hasDecimal = true;
        }
    }
    if (!clean) return "";

    const parts = clean.split(".");
    let integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const decimalPart = parts.length > 1 ? "." + parts.slice(1).join("") : "";

    return integerPart + decimalPart;
}

function parseFormattedNumber(val) {
    if (val === null || val === undefined || val === "") return 0;
    const cleanVal = String(val).replace(/,/g, "").trim();
    const num = Number(cleanVal);
    return Number.isFinite(num) ? num : 0;
}

const Storage = {
    save(inputs) {
        if (!inputs) return;
        try {
            if (inputs.symbol) localStorage.setItem(CONFIG.storage.symbol, inputs.symbol);
            localStorage.setItem(CONFIG.storage.previousPrice, inputs.previousPrice);
            localStorage.setItem(CONFIG.storage.previousQuantity, inputs.previousQuantity);
            localStorage.setItem(CONFIG.storage.reserve, inputs.reserve);
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
            const val = localStorage.getItem(key);
            if (val === null || val === "") return null;
            const num = Number(val);
            return Number.isFinite(num) ? num : null;
        } catch (e) {
            return null;
        }
    }
};

function loadInputsToScreen() {
    const data = Storage.load();
    const sym = $("symbolInput");
    const pPrice = $("previousPrice");
    const pQty = $("previousQuantity");
    const res = $("reserve");

    if (sym && data.symbol) sym.value = data.symbol;
    if (pPrice && data.previousPrice !== null) pPrice.value = formatWithThousandSeparator(data.previousPrice);
    if (pQty && data.previousQuantity !== null) pQty.value = formatWithThousandSeparator(data.previousQuantity);
    if (res && data.reserve !== null) res.value = formatWithThousandSeparator(data.reserve);
}

function getInputsFromScreen() {
    const sym = $("symbolInput");
    const pPrice = $("previousPrice");
    const pQty = $("previousQuantity");
    const res = $("reserve");

    return {
        symbol: sym ? sym.value.trim().toUpperCase() : CONFIG.defaultSymbol,
        previousPrice: parseFormattedNumber(pPrice ? pPrice.value : 0),
        previousQuantity: parseFormattedNumber(pQty ? pQty.value : 0),
        reserve: parseFormattedNumber(res ? res.value : 0)
    };
}

function validateInputs(inputs) {
    if (!inputs.symbol) throw new Error("Please enter a valid ticker symbol.");
    if (!isPositiveNumber(inputs.previousPrice)) throw new Error("Enter a valid Previous Trade Price.");
    if (!isPositiveNumber(inputs.previousQuantity)) throw new Error("Enter a valid Previous Trade Quantity.");
    if (!isNonNegativeNumber(inputs.reserve)) throw new Error("Reserve cannot be negative.");
    return true;
}