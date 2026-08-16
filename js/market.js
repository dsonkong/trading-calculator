/**
 * Trading Calculator • Direct Serverless Yahoo Finance Data Module
 */

const TIMEFRAME_MAP = {
    '1D': { range: '1d', interval: '5m' },
    '1W': { range: '7d', interval: '15m' },
    '1M': { range: '1mo', interval: '1h' },
    '3M': { range: '3mo', interval: '1d' },
    '6M': { range: '6mo', interval: '1d' },
    '1Y': { range: '1y', interval: '1d' },
    '52W_HIGH': { range: '1y', interval: '1h' },
    '5Y': { range: '5y', interval: '1wk' },
    '10Y': { range: '10y', interval: '1wk' }
};

const Market = {
    async fetchWithProxy(targetUrl, timeoutMs = 10000) {
        const proxies = [
            url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
            url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
        ];

        for (const makeProxyUrl of proxies) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            try {
                const res = await fetch(makeProxyUrl(targetUrl), { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!res.ok) continue;

                const data = await res.json();
                if (data?.chart?.result?.[0]) return data.chart.result[0];
            } catch (err) {
                clearTimeout(timeoutId);
                console.warn("[Market] Proxy attempt failed, trying fallback:", err.message);
            }
        }

        throw new Error("Unable to fetch data directly from Yahoo Finance.");
    },

    async fetchQuoteAndMetrics(symbol) {
        const result = await this.fetchWithProxy(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`
        );

        const meta = result.meta || {};
        const quote = result.indicators?.quote?.[0] || {};
        const currentPrice = Number(meta.regularMarketPrice || meta.chartPreviousClose || 0);
        const dailyHigh = Number(meta.regularMarketDayHigh || currentPrice);
        const dailyLow = Number(meta.regularMarketDayLow || currentPrice);

        const highs = (quote.high || []).filter(v => typeof v === "number" && !Number.isNaN(v));
        const high52 = Number(
            (meta.fiftyTwoWeekHigh || (highs.length ? Math.max(...highs) : Math.max(currentPrice, dailyHigh))).toFixed(2)
        );

        return {
            symbol: meta.symbol || symbol,
            currentPrice,
            previousClose: Number((meta.chartPreviousClose || currentPrice).toFixed(2)),
            highOfDay: Number(dailyHigh.toFixed(2)),
            lowOfDay: Number(dailyLow.toFixed(2)),
            high52,
            timestamp: Math.floor(Date.now() / 1000)
        };
    },

    async fetchCandles(symbol, timeframe = "52W_HIGH") {
        const tf = TIMEFRAME_MAP[timeframe] || TIMEFRAME_MAP["52W_HIGH"];
        const result = await this.fetchWithProxy(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${tf.range}&interval=${tf.interval}`
        );

        const timestamps = result.timestamp || [];
        const closes = result.indicators?.quote?.[0]?.close || [];
        let candles = [];

        for (let i = 0; i < timestamps.length; i++) {
            const price = closes[i];
            if (typeof price === "number" && !Number.isNaN(price)) {
                candles.push({
                    date: new Date(timestamps[i] * 1000),
                    price: Number(price.toFixed(2))
                });
            }
        }

        if (timeframe === "52W_HIGH" && candles.length > 1) {
            let maxIndex = 0;
            let maxPrice = candles[0].price;

            for (let i = 1; i < candles.length; i++) {
                if (candles[i].price > maxPrice) {
                    maxPrice = candles[i].price;
                    maxIndex = i;
                }
            }

            candles = candles.slice(maxIndex);
        }

        return candles;
    },

    async fetchAll(symbol) {
        return this.fetchQuoteAndMetrics(symbol);
    }
};

function showLoading(isFullRefresh = false) {
    const overlay = $("loadingOverlay");
    overlay?.classList.remove("hidden");

    if (isFullRefresh) setStatus("Fetching...", "status-loading");
}

function hideLoading() {
    $("loadingOverlay")?.classList.add("hidden");
}

function formatTimestamp(unixTime) {
    if (!unixTime) return "--";

    const dateObj = new Date(unixTime * 1000);
    return [
        dateObj.toLocaleDateString(CONFIG.locale, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }),
        dateObj.toLocaleTimeString(CONFIG.locale, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        })
    ].join(" ");
}

async function refreshMarketData(symbol) {
    try {
        showLoading(true);

        const activeSymbol =
            symbol ||
            (typeof getInputsFromScreen === "function" ? getInputsFromScreen().symbol : null) ||
            CONFIG.defaultSymbol;

        const market = await Market.fetchAll(activeSymbol);
        window.marketData = market;

        setText("currentPrice", formatPrice(market.currentPrice));
        setText("high52", formatPrice(market.high52));
        setText("lastUpdated", formatTimestamp(market.timestamp));
        setStatus("Connected", "status-success");

        return market;
    } catch (error) {
        console.error("Market Data Error:", error);
        setStatus("Connection Error", "status-error");
        throw error;
    } finally {
        hideLoading();
    }
}