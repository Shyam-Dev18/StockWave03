# models/stock_data.py
from database import db
from datetime import datetime

class StockData(db.Model):
    __tablename__ = 'stock_data'
    
    id = db.Column(db.Integer, primary_key=True)
    company_symbol = db.Column(db.String(10), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False, index=True)
    open_price = db.Column(db.Float)
    high_price = db.Column(db.Float)
    low_price = db.Column(db.Float)
    close_price = db.Column(db.Float)
    volume = db.Column(db.BigInteger)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Composite index for better query performance
    __table_args__ = (
        db.Index('idx_symbol_date', 'company_symbol', 'date'),
        db.UniqueConstraint('company_symbol', 'date', name='uq_symbol_date')
    )
    
    def to_dict(self):
        """Convert model instance to dictionary"""
        return {
            'id': self.id,
            'company_symbol': self.company_symbol,
            'date': self.date.strftime('%Y-%m-%d') if self.date else None,
            'open_price': self.open_price,
            'high_price': self.high_price,
            'low_price': self.low_price,
            'close_price': self.close_price,
            'volume': self.volume,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def __repr__(self):
        return f'<StockData {self.company_symbol} {self.date} ${self.close_price}>'