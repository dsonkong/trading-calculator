/**
 * Trading Calculator • Direct Serverless Yahoo Finance Data Module
 */

const TIMEFRAME_MAP = {
    '1D': { range: '1d', interval: '5m' },
    '1W': { range: '5d', interval: '15m' },
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
                const proxyUrl = makeProxyUrl(targetUrl);
                const res = await fetch(proxyUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (res.ok) {
                    const data = await res.json();
                    if (data?.chart?.result?.[0]) {
                        return data.chart.result[0];
                    }
                }
            } catch (err) {
                clearTimeout(timeoutId);
                console.warn(`[Market] Proxy attempt failed, trying fallback:`, err.message);
            }
        }
        throw new Error("Unable to fetch data directly from Yahoo Finance.");
    },

    async fetchQuoteAndMetrics(symbol) {
        const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`;
        const result = await this.fetchWithProxy(targetUrl);

        const meta = result.meta || {};
        const currentPrice = Number(meta.regularMarketPrice || meta.chartPreviousClose || 0);
        const previousClose = Number(meta.chartPreviousClose || currentPrice);
        const highOfDay = Number(meta.regularMarketDayHigh || currentPrice);
        const lowOfDay = Number(meta.regularMarketDayLow || currentPrice);

        // Derive 52-Week High from historical chart data or metadata
        let high52 = Number(meta.fiftyTwoWeekHigh || 0);
        if (!high52 && result.indicators?.quote?.[0]?.high) {
            const highs = result.indicators.quote[0].high.filter(v => typeof v === 'number' && !isNaN(v));
            if (highs.length > 0) high52 = Math.max(...highs);
        }
        if (!high52) high52 = Math.max(currentPrice, highOfDay);

        return {
            symbol: meta.symbol || symbol,
            currentPrice,
            previousClose,
            highOfDay,
            lowOfDay,
            high52: Number(high52.toFixed(2)),
            timestamp: Math.floor(Date.now() / 1000)
        };
    },

    async fetchCandles(symbol, timeframe = '52W_HIGH') {
        const tf = TIMEFRAME_MAP[timeframe] || TIMEFRAME_MAP['52W_HIGH'];
        const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${tf.range}&interval=${tf.interval}`;

        const result = await this.fetchWithProxy(targetUrl);
        const timestamps = result.timestamp || [];
        const closes = result.indicators?.quote?.[0]?.close || [];

        let candles = [];
        for (let i = 0; i < timestamps.length; i++) {
            const price = closes[i];
            if (typeof price === 'number' && !isNaN(price)) {
                candles.push({
                    date: new Date(timestamps[i] * 1000),
                    price: Number(price.toFixed(2))
                });
            }
        }

        if (timeframe === '52W_HIGH' && candles.length > 1) {
            let maxIdx = 0;
            let maxPrice = -1;
            for (let i = 0; i < candles.length; i++) {
                if (candles[i].price > maxPrice) {
                    maxPrice = candles[i].price;
                    maxIdx = i;
                }
            }
            if (maxIdx < candles.length - 1) {
                candles = candles.slice(maxIdx);
            }
        }

        return candles;
    },

    async fetchAll(symbol) {
        return await this.fetchQuoteAndMetrics(symbol);
    }
};

function showLoading(isFullRefresh = false) {
    $("loadingOverlay")?.classList.remove("hidden");
    if (isFullRefresh) setStatus("Fetching...", "status-loading");
}

function hideLoading() {
    $("loadingOverlay")?.classList.add("hidden");
}

function formatTimestamp(unixTime) {
    if (!unixTime) return "--";
    const dateObj = new Date(unixTime * 1000);
    const dateStr = dateObj.toLocaleDateString(CONFIG.locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });
    const timeStr = dateObj.toLocaleTimeString(CONFIG.locale, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
    return `${dateStr} ${timeStr}`;
}

async function refreshMarketData(symbol) {
    try {
        showLoading(true);
        const activeSymbol = symbol || (typeof getInputsFromScreen === "function" ? getInputsFromScreen().symbol : null) || CONFIG.defaultSymbol;
        const market = await Market.fetchAll(activeSymbol);
        window.marketData = market;

        setText("currentPrice", formatPrice(market.currentPrice));
        setText("high52", formatPrice(market.high52));
        setText("lastUpdated", formatTimestamp(market.timestamp));
        setStatus("Connected", "status-success");

        hideLoading();
        return market;
    } catch (error) {
        console.error("Market Data Error:", error);
        hideLoading();
        setStatus("Connection Error", "status-error");
        throw error;
    }
}