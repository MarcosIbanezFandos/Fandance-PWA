import yfinance as yf
tickers = {
    "S&P 500": "SXR8.DE",
    "MSCI Europe": "SMEA.DE",
    "MSCI World Small Cap": "IUSN.DE",
    "FTSE Emerging": "VFEA.DE",
    "FTSE Japan": "VJPA.DE"
}
for name, ticker in tickers.items():
    try:
        t = yf.Ticker(ticker)
        price = t.history(period="1d")["Close"].iloc[-1]
        print(f"{name} ({ticker}): {price} EUR")
    except Exception as e:
        print(f"Error {name} ({ticker}): {e}")
