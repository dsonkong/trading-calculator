/**
 * Trading Calculator • Resilient Market Data Module
 */

const Market = {
    async fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            return res;
        } catch (err) {
            clearTimeout(timeoutId);
            throw err;
        }
    },

    async fetchQuote(symbol) {
        const url = `${CONFIG.apiBaseUrl}/quote?symbol=${encodeURIComponent(symbol)}`;
        const res = await this.fetchWithTimeout(url);
        if (!res.ok) throw new Error(`yfinance Quote Error (${res.status})`);
        const data = await res.json();
        
        if (!data || data.currentPrice === undefined) {
            throw new Error("Invalid quote response.");
        }
        
        return {
            symbol: data.symbol || symbol,
            currentPrice: Number(data.currentPrice),
            previousClose: Number(data.previousClose),
            highOfDay: Number(data.highOfDay),
            lowOfDay: Number(data.lowOfDay),
            timestamp: Number(data.timestamp) || Math.floor(Date.now() / 1000)
        };
    },

    async fetchMetrics(symbol) {
        const url = `${CONFIG.apiBaseUrl}/metrics?symbol=${encodeURIComponent(symbol)}`;
        const res = await this.fetchWithTimeout(url);
        if (!res.ok) throw new Error(`yfinance Metrics Error (${res.status})`);
        const data = await res.json();
        
        const high52 = Number(data.high52);
        if (!high52 || isNaN(high52)) throw new Error("52-week high metric unavailable");
        
        return { high52 };
    },

    async fetchCandles(symbol, timeframe = '52W_HIGH') {
        const url = `${CONFIG.apiBaseUrl}/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`;
        
        try {
            const res = await this.fetchWithTimeout(url, {}, 8000);
            const data = await res.json();
            
            if (data.status === 'ok' && Array.isArray(data.candles) && data.candles.length > 0) {
                return data.candles.map(item => ({
                    date: new Date(item.timestamp * 1000),
                    price: Number(item.price)
                }));
            }
            throw new Error(data.error || "No historical candle data returned");
        } catch (error) {
            console.error(`[Market] Candle fetch failed for ${timeframe}:`, error.message);
            throw error;
        }
    },

    async fetchAll(symbol) {
        const [quoteResult, metricsResult] = await Promise.allSettled([
            this.fetchQuote(symbol),
            this.fetchMetrics(symbol)
        ]);

        if (quoteResult.status === "rejected") throw quoteResult.reason;

        const quote = quoteResult.value;
        const high52 = metricsResult.status === "fulfilled" 
            ? metricsResult.value.high52 
            : Math.max(quote.currentPrice, quote.highOfDay || 0);

        return { ...quote, high52 };
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