import numpy as np
from services import data_services

def predict(symbol, horizon='day'):
    """
    Predict next day or next month close price using 1 year of historical data.
    Replace the logic below with a real LSTM model for production.
    """
    # Get last 1 year (365 days) of data
    records = data_services.get_stored_stock_data(symbol, limit=365)
    closes = np.array([r.close_price for r in records if r.close_price is not None])

    if len(closes) < 60:
        return None

    # Placeholder: Use last N days moving average as prediction
    if horizon == 'day':
        window = 30
        pred = closes[-window:].mean() if len(closes) >= window else closes.mean()
    elif horizon == 'month':
        window = 90
        pred = closes[-window:].mean() if len(closes) >= window else closes.mean()
    else:
        pred = closes[-1]

    # Add a small random noise to simulate model uncertainty
    pred = pred * (1 + np.random.normal(0, 0.01 if horizon == 'day' else 0.03))

    return {
        'symbol': symbol,
        'horizon': horizon,
        'predicted_close': round(float(pred), 2)
    }