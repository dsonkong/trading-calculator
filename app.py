"""
==========================================================
Trading Calculator • Python yfinance Backend Proxy
==========================================================
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import yfinance as yf
import pandas as pd
import datetime

app = Flask(__name__)
CORS(app)

TIMEFRAME_MAP = {
    '1D': ('5d', '5m'),
    '1W': ('7d', '15m'),
    '1M': ('1mo', '1h'),
    '3M': ('3mo', '1d'),
    '6M': ('6mo', '1d'),
    '1Y': ('1y', '1d'),
    '52W_HIGH': ('1y', '1h'),
    '5Y': ('5y', '1wk'),
    '10Y': ('10y', '1wk')
}

@app.route('/api/quote', methods=['GET'])
def get_quote():
    symbol = request.args.get('symbol', 'VT').strip().upper()
    try:
        ticker = yf.Ticker(symbol)
        fast_info = ticker.fast_info
        
        current_price = float(fast_info.last_price) if fast_info.last_price else None
        prev_close = float(fast_info.previous_close) if fast_info.previous_close else None
        
        if current_price is None:
            hist = ticker.history(period='2d')
            if not hist.empty:
                current_price = float(hist['Close'].iloc[-1])
                prev_close = float(hist['Close'].iloc[-2]) if len(hist) > 1 else current_price

        return jsonify({
            'symbol': symbol,
            'currentPrice': round(current_price, 2),
            'previousClose': round(prev_close, 2) if prev_close else round(current_price, 2),
            'highOfDay': round(float(fast_info.day_high or current_price), 2),
            'lowOfDay': round(float(fast_info.day_low or current_price), 2),
            'timestamp': int(datetime.datetime.now(datetime.timezone.utc).timestamp())
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    symbol = request.args.get('symbol', 'VT').strip().upper()
    try:
        ticker = yf.Ticker(symbol)
        fast_info = ticker.fast_info
        
        high_52 = float(fast_info.year_high) if fast_info.year_high else None
        
        if high_52 is None:
            hist = ticker.history(period='1y')
            if not hist.empty:
                high_52 = float(hist['High'].max())

        return jsonify({'symbol': symbol, 'high52': round(high_52, 2)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/candles', methods=['GET'])
def get_candles():
    symbol = request.args.get('symbol', 'VT').strip().upper()
    timeframe = request.args.get('timeframe', '52W_HIGH').upper()

    period, interval = TIMEFRAME_MAP.get(timeframe, ('1y', '1d'))

    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=period, interval=interval)

        if hist.empty:
            return jsonify({'error': 'No historical data found'}), 404

        if isinstance(hist.columns, pd.MultiIndex):
            hist.columns = hist.columns.get_level_values(0)

        if timeframe == '1D':
            last_date = hist.index[-1].date()
            hist = hist[hist.index.date == last_date]

        candles = []
        for idx, row in hist.iterrows():
            close_price = row['Close']
            if pd.notna(close_price):
                candles.append({
                    'timestamp': int(idx.timestamp()),
                    'price': round(float(close_price), 2)
                })

        if timeframe == '52W_HIGH' and len(candles) > 1:
            max_idx = max(range(len(candles)), key=lambda i: candles[i]['price'])
            if max_idx < len(candles) - 1:
                candles = candles[max_idx:]

        return jsonify({'status': 'ok', 'symbol': symbol, 'candles': candles})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("Starting yfinance Proxy Backend Service on http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000, debug=True)