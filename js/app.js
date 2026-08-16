/**
 * VT Trading Calculator • Application Controller
 */

window.marketData = null;
let priceChartInstance = null;
let currentTimeframe = CONFIG.defaultTimeframe || "52W_HIGH";
let cachedCandles = null;
let inputTimer = null;

async function recalculateLocal(fetchNewCandles = false) {
    try {
        if (!window.marketData) return;

        const inputs = getInputsFromScreen();

        if (fetchNewCandles || !cachedCandles) {
            try {
                const symbol = inputs.symbol || window.marketData?.symbol || CONFIG.defaultSymbol;
                cachedCandles = await Market.fetchCandles(symbol, currentTimeframe);
            } catch (err) {
                console.warn("Real chart candles unavailable:", err.message);
                cachedCandles = [];
            }
        }

        if (!(inputs.previousPrice && inputs.previousQuantity)) {
            updateChart(null, inputs?.previousPrice || null, cachedCandles);
            return;
        }

        validateInputs(inputs);

        inputs.currentPrice = window.marketData.currentPrice;
        inputs.high52 = window.marketData.high52;

        Storage.save(inputs);

        const result = calculate(inputs);
        const coveredRow = getCoveredRow(result.quantityTable, inputs.reserve, inputs.previousPrice);

        updateResults(result);
        renderQuantityTable(result.quantityTable, inputs.previousPrice, coveredRow?.price);
        updateChart(result, inputs.previousPrice, cachedCandles);
    } catch (error) {
        console.warn("Calculation notice:", error.message);
    }
}

async function refreshFull() {
    try {
        const inputs = getInputsFromScreen();
        await refreshMarketData(inputs.symbol);
        await recalculateLocal(true);
    } catch (error) {
        console.warn("Could not retrieve live price automatically.");
    }
}

function scheduleRecalc() {
    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => recalculateLocal(false), 150);
}

function updateResults(result) {
    const fieldMap = {
        buyPrice: result.buy.price,
        buyQuantity: result.buy.quantity,
        buyAmount: result.buy.amount,
        sellPrice: result.sell.price,
        sellQuantity: result.sell.quantity,
        sellAmount: result.sell.amount,
        safetyLevel: result.safetyLevel * 100,
        margin: typeof result.margin === "string" ? result.margin : result.margin * 100
    };

    Object.entries(fieldMap).forEach(([id, value]) => {
        const el = $(id);
        if (!el) return;

        if (id === "safetyLevel" || id === "margin") {
            el.textContent = formatPercentage(value);
            return;
        }

        el.textContent = id.includes("Price")
            ? formatPrice(value)
            : id.includes("Quantity")
                ? formatQuantity(value)
                : formatAmount(value);
    });
}

function getCoveredRow(rows, reserve, previousPrice) {
    return findCoveredRow(rows, reserve, previousPrice);
}

function renderQuantityTable(rows, previousPrice, coveredPrice = null) {
    const tbody = $("quantityTable")?.querySelector("tbody");
    if (!tbody) return;

    const html = rows.map(row => {
        const highlight =
            row.price === previousPrice ? "prev" :
            row.price === coveredPrice ? "covered" :
            "";

        const prevTag = highlight === "prev"
            ? '<span class="prev-tag">Previous Trade</span>'
            : "";

        const coveredTag = highlight === "covered"
            ? '<span class="covered-tag">Reserve Covered</span>'
            : "";

        return `
            <tr class="${highlight ? `highlight-row ${highlight}` : ""}">
                <td>${formatQuantity(row.quantity)}${prevTag}</td>
                <td>${formatPrice(row.price)}</td>
                <td class="text-center">
                    ${row.reserveRequired > 0 ? formatAmount(row.reserveRequired) : "--"}
                    ${coveredTag}
                </td>
                <td class="text-center">${row.reserveRequired > 0 ? formatPercentage(row.safetyLevel * 100) : "--"}</td>
            </tr>
        `;
    }).join("");

    tbody.innerHTML = html;
}

function updateChart(result, previousPrice, candles) {
    const ctx = $("priceChart")?.getContext("2d");
    if (!ctx) return;

    if (priceChartInstance) {
        priceChartInstance.destroy();
        priceChartInstance = null;
    }

    if (!candles || candles.length === 0) return;

    const annotations = {};

    if (previousPrice && isFinite(previousPrice) && previousPrice > 0) {
        annotations.linePrev = createHorizontalLine(previousPrice, "#ca8a04", "Prev Trade");
    }

    if (result?.buy?.price && isFinite(result.buy.price) && result.buy.price > 0) {
        annotations.lineBuy = createHorizontalLine(result.buy.price, "#22c55e", "Buy Order");
    }

    if (result?.sell?.price && isFinite(result.sell.price) && result.sell.price > 0) {
        annotations.lineSell = createHorizontalLine(result.sell.price, "#ef4444", "Sell Order");
    }

    const labels = candles.map(c => {
        if (currentTimeframe === "1D") {
            return c.date.toLocaleTimeString(CONFIG.locale, { hour: "2-digit", minute: "2-digit" });
        }

        if (currentTimeframe === "5Y" || currentTimeframe === "10Y") {
            return c.date.toLocaleDateString(CONFIG.locale, { year: "numeric", month: "short" });
        }

        return c.date.toLocaleDateString(CONFIG.locale, {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    });

    const prices = candles.map(c => c.price);

    priceChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: `${window.marketData?.symbol || CONFIG.defaultSymbol} Real Price ($USD)`,
                data: prices,
                borderColor: "#2563eb",
                backgroundColor: "rgba(37, 99, 235, 0.08)",
                pointRadius: 0,
                pointHoverRadius: 6,
                borderWidth: 2.5,
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: ctx => ` Price: $${ctx.parsed.y.toFixed(2)}` }
                },
                annotation: { annotations }
            },
            scales: {
                x: {
                    ticks: {
                        color: "#64748b",
                        font: { size: 10, weight: "500" },
                        maxTicksLimit: 8
                    },
                    grid: { display: false }
                },
                y: {
                    ticks: {
                        color: "#64748b",
                        font: { size: 11, weight: "600" },
                        callback: val => "$" + Number(val)
                    },
                    grid: { color: "rgba(0, 0, 0, 0.06)" }
                }
            }
        }
    });
}

function createHorizontalLine(value, color, labelText) {
    return {
        type: "line",
        yMin: value,
        yMax: value,
        borderColor: color,
        borderWidth: 2,
        borderDash: [6, 6],
        label: {
            display: true,
            content: `${labelText}: $${value.toFixed(2)}`,
            position: "end",
            backgroundColor: color,
            color: "white",
            font: { size: 11, weight: "bold" },
            padding: { x: 8, y: 4 }
        }
    };
}

function attachTimeframeEvents() {
    const buttons = document.querySelectorAll(".time-btn");

    buttons.forEach(btn => {
        btn.addEventListener("click", async (e) => {
            buttons.forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");

            currentTimeframe = e.target.getAttribute("data-timeframe") || "52W_HIGH";

            showLoading(false);
            await recalculateLocal(true);
            hideLoading();
        });
    });
}

function attachThousandSeparatorFormatting(inputEl) {
    if (!inputEl) return;

    inputEl.addEventListener("input", () => {
        const cursorPosition = inputEl.selectionStart || 0;
        const rawVal = inputEl.value;
        const formatted = formatWithThousandSeparator(rawVal);

        const commasBeforeOld = (rawVal.slice(0, cursorPosition).match(/,/g) || []).length;
        const commasBeforeNew = (formatted.slice(0, cursorPosition).match(/,/g) || []).length;
        const offset = commasBeforeNew - commasBeforeOld;

        inputEl.value = formatted;

        const newPos = Math.max(0, cursorPosition + offset);
        if (typeof inputEl.setSelectionRange === "function") {
            inputEl.setSelectionRange(newPos, newPos);
        }

        recalculateLocal(false);
    });
}

function attachEvents() {
    $("refreshButton")?.addEventListener("click", refreshFull);
    $("symbolInput")?.addEventListener("change", refreshFull);

    ["previousPrice", "previousQuantity", "reserve"].forEach(id => {
        const inputEl = $(id);
        if (!inputEl) return;

        inputEl.addEventListener("input", scheduleRecalc);
        inputEl.addEventListener("blur", () => {
            clearTimeout(inputTimer);
            recalculateLocal(false);
        });
    });

    attachTimeframeEvents();
}

async function init() {
    try {
        loadInputsToScreen();
        attachEvents();
        await refreshFull();
    } catch (e) {
        console.error("Initialization Failed:", e);
        if (typeof setStatus === "function") {
            setStatus("Connection Error", "status-error");
        }
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}