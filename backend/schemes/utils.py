import pandas as pd
import re

def load_schemes_data():
    df = pd.read_csv('./clean/latest_schemes_data.csv')
    
    numeric_columns = [
        'min_investment',
        'returns_3yr',
        'returns_5yr',
        'expense_ratio',
        'fund_size'
    ]
    
    for col in numeric_columns:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    
    return df

def extract_filters(query):
    pattern = r"\['([^']+?)'\]"
    matches = re.findall(pattern, query)
    return matches 