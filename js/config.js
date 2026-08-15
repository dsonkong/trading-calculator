/**
 * Trading Calculator • Configuration & Helpers
 */

function resolveApiBaseUrl() {
    const host = window.location.hostname || "127.0.0.1";
    const protocol = window.location.protocol;

    // If running inside VS Code Dev Tunnels (e.g. 4mqf17sd-5500.asse.devtunnels.ms)
    if (host.includes("devtunnels.ms")) {
        const backendHost = host.replace("-5500", "-5000");
        return `${protocol}//${backendHost}/api`;
    }

    // Standard local / Wi-Fi access
    return `http://${host}:5000/api`;
}

const CONFIG = Object.freeze({
    apiBaseUrl: resolveApiBaseUrl(),
    defaultSymbol: "VT",
    defaultTimeframe: "52W_HIGH",

    minQuantity: 30,
    maxQuantity: 60,

    currency: "USD",
    locale: "en-US",
    priceDecimals: 2,
    amountDecimals: 0,
    percentageDecimals: 1,

    storage: {
        symbol: "vt_symbol",
        previousPrice: "vt_previousPrice",
        previousQuantity: "vt_previousQuantity",
        reserve: "vt_reserve"
    }
});

const PRICE_FORMATTER = new Intl.NumberFormat(CONFIG.locale, {
    style: "currency",
    currency: CONFIG.currency,
    minimumFractionDigits: CONFIG.priceDecimals,
    maximumFractionDigits: CONFIG.priceDecimals
});

const AMOUNT_FORMATTER = new Intl.NumberFormat(CONFIG.locale, {
    style: "currency",
    currency: CONFIG.currency,
    minimumFractionDigits: CONFIG.amountDecimals,
    maximumFractionDigits: CONFIG.amountDecimals
});

const INTEGER_FORMATTER = new Intl.NumberFormat(CONFIG.locale);

const formatPrice = val => (!Number.isFinite(val) ? "--" : PRICE_FORMATTER.format(val));
const formatAmount = val => (!Number.isFinite(val) ? "--" : AMOUNT_FORMATTER.format(val));
const formatQuantity = val => (!Number.isFinite(val) ? "--" : INTEGER_FORMATTER.format(val));
const formatPercentage = val => (!Number.isFinite(val) ? "--" : `${val.toFixed(CONFIG.percentageDecimals)}%`);

const $ = id => document.getElementById(id);

function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
}

function setStatus(msg, className = "") {
    const el = $("connectionStatus");
    if (!el) return;
    el.textContent = msg;
    el.className = `status-badge ${className}`;
}

const isPositiveNumber = val => Number.isFinite(val) && val > 0;
const isNonNegativeNumber = val => Number.isFinite(val) && val >= 0;