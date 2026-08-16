/**
 * Trading Calculator • Configuration & Helpers
 */

const CONFIG = Object.freeze({
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

const formatters = {
    price: new Intl.NumberFormat(CONFIG.locale, {
        style: "currency",
        currency: CONFIG.currency,
        minimumFractionDigits: CONFIG.priceDecimals,
        maximumFractionDigits: CONFIG.priceDecimals
    }),
    amount: new Intl.NumberFormat(CONFIG.locale, {
        style: "currency",
        currency: CONFIG.currency,
        minimumFractionDigits: CONFIG.amountDecimals,
        maximumFractionDigits: CONFIG.amountDecimals
    }),
    integer: new Intl.NumberFormat(CONFIG.locale)
};

const $ = id => document.getElementById(id);

const formatPrice = val => (Number.isFinite(val) ? formatters.price.format(val) : "--");
const formatAmount = val => (Number.isFinite(val) ? formatters.amount.format(val) : "--");
const formatQuantity = val => (Number.isFinite(val) ? formatters.integer.format(val) : "--");
const formatPercentage = val => (Number.isFinite(val) ? `${val.toFixed(CONFIG.percentageDecimals)}%` : "--");

function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
}

function setStatus(msg, className = "") {
    const el = $("connectionStatus");
    if (!el) return;

    el.textContent = msg;
    el.className = `status-badge ${className}`.trim();
}

const isPositiveNumber = val => Number.isFinite(val) && val > 0;
const isNonNegativeNumber = val => Number.isFinite(val) && val >= 0;