import yfinance as yf
from models.stock_data import StockData
from database import db
from datetime import datetime, timedelta
import pandas as pd

def get_historical_data(company_symbol, months=3):
    """
    Fetch historical stock data using yfinance
    Args:
        company_symbol (str): Stock symbol (e.g., 'AAPL')
        months (int): Number of months of historical data to fetch
    Returns:
        pandas.DataFrame: Historical stock data or None if error
    """
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=months * 30)
        
        # Use yfinance Ticker for better error handling
        ticker = yf.Ticker(company_symbol)
        
        # Check if ticker is valid by trying to get info
        try:
            info = ticker.info
            if not info or info.get('regularMarketPrice') is None:
                print(f"Invalid ticker symbol: {company_symbol}")
                return None
        except Exception as e:
            print(f"Error validating ticker {company_symbol}: {e}")
            return None
        
        # Fetch historical data
        data = ticker.history(start=start_date, end=end_date)
        
        if data.empty:
            print(f"No data found for symbol: {company_symbol}")
            return None
            
        # Clean the data
        data = data.dropna()  # Remove any rows with NaN values
        
        print(f"Successfully fetched {len(data)} records for {company_symbol}")
        return data
        
    except Exception as e:
        print(f"Error fetching historical data for {company_symbol}: {e}")
        return None

def store_stock_data(company_symbol, data):
    """
    Store stock data in the database
    Args:
        company_symbol (str): Stock symbol
        data (pandas.DataFrame): Stock data to store
    Returns:
        bool: True if successful, False otherwise
    """
    if data is None or data.empty:
        print("No data to store")
        return False
    
    try:
        records_added = 0
        records_updated = 0
        
        for index, row in data.iterrows():
            # Handle volume with proper error checking
            try:
                volume_value = row.get('Volume')
                volume = None if pd.isna(volume_value) else int(volume_value)
            except (ValueError, TypeError):
                volume = None
            
            # Handle price values with better error checking
            try:
                open_price = None if pd.isna(row.get('Open')) else round(float(row.get('Open')), 2)
                high_price = None if pd.isna(row.get('High')) else round(float(row.get('High')), 2)
                low_price = None if pd.isna(row.get('Low')) else round(float(row.get('Low')), 2)
                close_price = None if pd.isna(row.get('Close')) else round(float(row.get('Close')), 2)
            except (ValueError, TypeError) as e:
                print(f"Error processing price data for {company_symbol} on {index.date()}: {e}")
                continue
            
            # Skip if all prices are None
            if all(price is None for price in [open_price, high_price, low_price, close_price]):
                continue
            
            # Check if record already exists
            existing_record = StockData.query.filter_by(
                company_symbol=company_symbol,
                date=index.date()
            ).first()
            
            if existing_record:
                # Update existing record
                existing_record.open_price = open_price
                existing_record.high_price = high_price
                existing_record.low_price = low_price
                existing_record.close_price = close_price
                existing_record.volume = volume
                existing_record.updated_at = db.func.now()
                records_updated += 1
            else:
                # Create new record
                stock_record = StockData(
                    company_symbol=company_symbol,
                    date=index.date(),
                    open_price=open_price,
                    high_price=high_price,
                    low_price=low_price,
                    close_price=close_price,
                    volume=volume
                )
                db.session.add(stock_record)
                records_added += 1
        
        db.session.commit()
        print(f"Successfully stored {records_added} new records and updated {records_updated} existing records for {company_symbol}")
        return True
        
    except Exception as e:
        db.session.rollback()
        print(f"Error storing stock data for {company_symbol}: {e}")
        return False

def get_stored_stock_data(company_symbol, start_date=None, end_date=None, limit=None):
    """
    Retrieve stored stock data from database
    Args:
        company_symbol (str): Stock symbol
        start_date (date): Start date filter (optional)
        end_date (date): End date filter (optional)
        limit (int): Maximum number of records to return (optional)
    Returns:
        list: List of StockData objects or None if error
    """
    try:
        query = StockData.query.filter(StockData.company_symbol == company_symbol)
        
        if start_date:
            query = query.filter(StockData.date >= start_date)
        if end_date:
            query = query.filter(StockData.date <= end_date)
        
        query = query.order_by(StockData.date.desc())
        
        if limit:
            query = query.limit(limit)
        
        return query.all()
        
    except Exception as e:
        print(f"Error retrieving stored stock data for {company_symbol}: {e}")
        return None

def get_stock_statistics(company_symbol, days=30):
    """
    Calculate statistics for a stock symbol
    Args:
        company_symbol (str): Stock symbol
        days (int): Number of days to calculate statistics for
    Returns:
        dict: Statistics dictionary or None if error
    """
    try:
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=days)
        
        records = get_stored_stock_data(company_symbol, start_date, end_date)
        
        if not records:
            return None
        
        # Filter out None values and sort by date
        prices = []
        volumes = []
        daily_changes = []
        
        for i, record in enumerate(reversed(records)):  # Reverse to get chronological order
            if record.close_price is not None:
                prices.append(record.close_price)
                
                # Calculate daily change percentage
                if i > 0 and record.open_price is not None:
                    daily_change = ((record.close_price - record.open_price) / record.open_price) * 100
                    daily_changes.append(daily_change)
            
            if record.volume is not None:
                volumes.append(record.volume)
        
        stats = {
            'symbol': company_symbol,
            'total_records': len(records),
            'date_range': {
                'start': records[-1].date.strftime('%Y-%m-%d') if records else None,
                'end': records[0].date.strftime('%Y-%m-%d') if records else None
            }
        }
        
        if prices:
            # Calculate price change from first to last
            price_change = prices[-1] - prices[0] if len(prices) > 1 else 0
            price_change_percent = (price_change / prices[0] * 100) if prices[0] != 0 else 0
            
            stats['price_stats'] = {
                'current': round(prices[-1], 2),
                'opening': round(prices[0], 2),
                'highest': round(max(prices), 2),
                'lowest': round(min(prices), 2),
                'average': round(sum(prices) / len(prices), 2),
                'change': round(price_change, 2),
                'change_percent': round(price_change_percent, 2)
            }
        
        if volumes:
            stats['volume_stats'] = {
                'average': int(sum(volumes) / len(volumes)),
                'highest': max(volumes),
                'total': sum(volumes)
            }
        
        if daily_changes:
            positive_days = len([x for x in daily_changes if x > 0])
            negative_days = len([x for x in daily_changes if x < 0])
            
            stats['performance_stats'] = {
                'positive_days': positive_days,
                'negative_days': negative_days,
                'positive_ratio': round(positive_days / len(daily_changes) * 100, 1) if daily_changes else 0,
                'avg_daily_change': round(sum(daily_changes) / len(daily_changes), 2) if daily_changes else 0
            }
        
        return stats
        
    except Exception as e:
        print(f"Error calculating statistics for {company_symbol}: {e}")
        return None

def get_company_info(company_symbol):
    """
    Get basic company information
    Args:
        company_symbol (str): Stock symbol
    Returns:
        dict: Company information or None if error
    """
    try:
        ticker = yf.Ticker(company_symbol)
        info = ticker.info
        
        if not info:
            return None
        
        company_info = {
            'symbol': company_symbol,
            'name': info.get('longName', 'N/A'),
            'sector': info.get('sector', 'N/A'),
            'industry': info.get('industry', 'N/A'),
            'market_cap': info.get('marketCap', 'N/A'),
            'currency': info.get('currency', 'USD'),
            'exchange': info.get('exchange', 'N/A')
        }
        
        return company_info
        
    except Exception as e:
        print(f"Error getting company info for {company_symbol}: {e}")
        return None

def validate_stock_symbol(company_symbol):
    """
    Validate if a stock symbol exists
    Args:
        company_symbol (str): Stock symbol to validate
    Returns:
        bool: True if valid, False otherwise
    """
    try:
        ticker = yf.Ticker(company_symbol)
        info = ticker.info
        return info is not None and info.get('regularMarketPrice') is not None
    except:
        return False