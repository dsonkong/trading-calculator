/**
 * VT Trading Calculator • Application Controller
 */

window.marketData = null;
let priceChartInstance = null;
let currentTimeframe = CONFIG.defaultTimeframe || "52W_HIGH";
let cachedCandles = null;

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

        let result = null;

        if (inputs.previousPrice && inputs.previousQuantity) {
            validateInputs(inputs);

            inputs.currentPrice = window.marketData.currentPrice;
            inputs.high52 = window.marketData.high52;

            Storage.save(inputs);

            result = calculate(inputs);
            updateResults(result);
            renderQuantityTable(result.quantityTable, inputs.previousPrice);
        }
        
        updateChart(result, inputs?.previousPrice || null, cachedCandles);
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

function updateResults(result) {
    setText("buyPrice", formatPrice(result.buy.price));
    setText("buyQuantity", formatQuantity(result.buy.quantity));
    setText("buyAmount", formatAmount(result.buy.amount));

    setText("sellPrice", formatPrice(result.sell.price));
    setText("sellQuantity", formatQuantity(result.sell.quantity));
    setText("sellAmount", formatAmount(result.sell.amount));

    setText("safetyLevel", formatPercentage(result.safetyLevel * 100));
    setText("margin", typeof(result.margin) === "string" ? result.margin : formatPercentage(result.margin * 100));

    if (result.reserveRequired) {
        setText("reserve80Req", formatAmount(result.reserveRequired.reserve80));
        setText("reserve90Req", formatAmount(result.reserveRequired.reserve90));
        setText("reserve100Req", formatAmount(result.reserveRequired.reserve100));
    }
}

function createCheckBadge(tierClass, labelText) {
    return `
        <span class="tier-badge ${tierClass}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            ${labelText}
        </span>
    `;
}

function renderQuantityTable(rows, previousPrice) {
    const tbody = $("quantityTable")?.querySelector("tbody");
    if (!tbody) return;

    const html = rows.map(row => {
        const isHighlight = row.price === previousPrice;
        const rowClass = isHighlight ? ' class="highlight-row"' : '';
        const prevTag = isHighlight ? '<span class="prev-tag">Prev Trade</span>' : '';

        const q80 = row.qualifies80 ? createCheckBadge("badge-80", "80%") : '<span class="badge-inactive">—</span>';
        const q90 = row.qualifies90 ? createCheckBadge("badge-90", "90%") : '<span class="badge-inactive">—</span>';
        const q100 = row.qualifies100 ? createCheckBadge("badge-100", "100%") : '<span class="badge-inactive">—</span>';

        return `
            <tr${rowClass}>
                <td>${formatQuantity(row.quantity)}${prevTag}</td>
                <td>${formatPrice(row.price)}</td>
                <td class="text-center">${q80}</td>
                <td class="text-center">${q90}</td>
                <td class="text-center">${q100}</td>
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

    const textColor = "#64748b";
    const gridColor = "rgba(0, 0, 0, 0.06)";

    const labels = candles.map(c => {
        if (currentTimeframe === '1D') {
            return c.date.toLocaleTimeString(CONFIG.locale, { hour: '2-digit', minute: '2-digit' });
        }
        if (currentTimeframe === '5Y' || currentTimeframe === '10Y') {
            return c.date.toLocaleDateString(CONFIG.locale, { year: 'numeric', month: 'short' });
        }
        return c.date.toLocaleDateString(CONFIG.locale, { year: 'numeric', month: 'short', day: 'numeric' });
    });

    const prices = candles.map(c => c.price);
    const annotations = {};

    if (previousPrice && isFinite(previousPrice) && previousPrice > 0) {
        annotations.linePrev = createHorizontalLine(previousPrice, '#ca8a04', 'Prev Trade');
    }

    if (result?.buy?.price && isFinite(result.buy.price) && result.buy.price > 0) {
        annotations.lineBuy = createHorizontalLine(result.buy.price, '#22c55e', 'Buy Order');
    }

    if (result?.sell?.price && isFinite(result.sell.price) && result.sell.price > 0) {
        annotations.lineSell = createHorizontalLine(result.sell.price, '#ef4444', 'Sell Order');
    }

    priceChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${window.marketData?.symbol || CONFIG.defaultSymbol} Real Price ($USD)`,
                data: prices,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
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
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: ctx => ` Price: $${ctx.parsed.y.toFixed(2)}` }
                },
                annotation: { annotations: annotations }
            },
            scales: {
                x: {
                    ticks: { color: textColor, font: { size: 10, weight: '500' }, maxTicksLimit: 8 },
                    grid: { display: false }
                },
                y: {
                    ticks: {
                        color: textColor,
                        font: { size: 11, weight: '600' },
                        callback: val => '$' + Number(val)
                    },
                    grid: { color: gridColor }
                }
            }
        }
    });
}

function createHorizontalLine(value, color, labelText) {
    return {
        type: 'line',
        yMin: value,
        yMax: value,
        borderColor: color,
        borderWidth: 2,
        borderDash: [6, 6],
        label: {
            display: true,
            content: `${labelText}: $${value.toFixed(2)}`,
            position: 'end',
            backgroundColor: color,
            color: 'white',
            font: { size: 11, weight: 'bold' },
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
        attachThousandSeparatorFormatting($(id));
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