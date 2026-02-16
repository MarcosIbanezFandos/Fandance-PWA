import os
import urllib.parse
import math
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
import yfinance as yf
import pandas as pd
import numpy as np
import feedparser
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv

# --- CONFIGURACIÓN ---
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

app = FastAPI(title="Fandance API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise Exception("Faltan credenciales en .env")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"❌ Error Supabase: {e}")

# --- UTILIDADES ---
def safe_float(val):
    if val is None: return 0.0
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f): return 0.0
        return f
    except: return 0.0

# --- MODELOS ---
class CreatePortfolioInput(BaseModel):
    user_id: str
    name: str

class RenamePortfolioInput(BaseModel):
    portfolio_id: str
    name: str

class DuplicatePortfolioInput(BaseModel):
    portfolio_id: str
    user_id: str
    new_name: str

class AddAssetInput(BaseModel):
    portfolio_id: str
    ticker: str
    name: Optional[str] = ""

class UpdateItemInput(BaseModel):
    item_id: str
    units_held: float
    target_weight: float

class RebalanceInput(BaseModel):
    portfolio_id: str
    contribution: float

class ApplyRebalanceInput(BaseModel):
    portfolio_id: str
    contribution: float
    orders: List[Dict[str, Any]]

class HistoryInput(BaseModel):
    portfolio_id: str
    period: str = "1mo" 

class SimulationInput(BaseModel):
    portfolio_ids: List[str]
    years: int
    initial_capital: float
    monthly_contribution: float
    contribution_mode: str 
    growth_rate: float = 0.0 
    tax_rate: bool 
    sim_type: str 

class NewsInput(BaseModel):
    assets: List[dict] 

# --- DATA FETCHING ---
def get_asset_metadata(ticker: str):
    clean_ticker = ticker.strip().upper()
    if clean_ticker == "BTC": clean_ticker = "BTC-EUR"
    try:
        t = yf.Ticker(clean_ticker)
        try:
            info = t.info
            name = info.get('longName') or info.get('shortName') or ticker
            qtype = info.get('quoteType', 'EQUITY')
            sector = info.get('sector') or 'General'
            country = info.get('country') or 'Global'
            currency = info.get('currency') or 'USD'
        except:
            name = ticker; qtype = 'EQUITY'; sector = 'General'; country = 'Global'; currency = 'USD'
            
        clean_type = 'Stock'
        if 'ETF' in str(qtype).upper(): clean_type = 'ETF'
        elif 'CRYPTO' in str(qtype).upper(): clean_type = 'Crypto'
        elif 'FUND' in str(qtype).upper(): clean_type = 'Fund'
        
        return { "name": name, "type": clean_type, "sector": sector, "country": country, "currency": currency, "real_ticker": clean_ticker }
    except:
        return { "name": ticker, "type": "Stock", "sector": "Unknown", "country": "Unknown", "currency": "USD", "real_ticker": clean_ticker }

def fetch_live_price(ticker: str):
    if not ticker: return 0.0
    try:
        t = yf.Ticker(ticker)
        price = t.fast_info.last_price
        if price is None:
            hist = t.history(period="1d")
            if not hist.empty: price = hist["Close"].iloc[-1]
        return safe_float(price)
    except: return 0.0

def calculate_rsi(ticker: str):
    try:
        df = yf.download(ticker, period="1mo", interval="1d", progress=False)
        if df.empty or len(df) < 14: return 50
        if isinstance(df, pd.DataFrame) and 'Close' in df.columns: close = df['Close']
        else: close = df.iloc[:, 0]
        delta = close.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        return round(safe_float(rsi.iloc[-1]))
    except: return 50

def get_sentiment_label(score):
    if score >= 70: return "Sobrecompra (RSI)", "very_green"
    if score >= 60: return "Alcista (RSI)", "green"
    if score <= 30: return "Sobreventa (RSI)", "red"
    if score <= 40: return "Bajista (RSI)", "orange"
    return "Neutral (RSI)", "yellow"

# --- ENDPOINTS ---
@app.post("/portfolios/create")
def create_portfolio(data: CreatePortfolioInput):
    try:
        res = supabase.table("portfolios").insert({"user_id": data.user_id, "name": data.name}).execute()
        return res.data[0]
    except Exception as e: raise HTTPException(500, str(e))

@app.get("/portfolios/list")
def list_portfolios(user_id: str):
    res = supabase.table("portfolios").select("*").eq("user_id", user_id).order('created_at').execute()
    return res.data

@app.put("/portfolios/rename")
def rename_portfolio(data: RenamePortfolioInput):
    supabase.table("portfolios").update({"name": data.name}).eq("id", data.portfolio_id).execute()
    return {"msg": "OK"}

@app.post("/portfolios/duplicate")
def duplicate_portfolio(data: DuplicatePortfolioInput):
    try:
        res = supabase.table("portfolios").insert({"user_id": data.user_id, "name": data.new_name}).execute()
        new_id = res.data[0]["id"]
        items = supabase.table("portfolio_items").select("*").eq("portfolio_id", data.portfolio_id).execute()
        if items.data:
            new_items = [{"portfolio_id": new_id, "asset_id": i["asset_id"], "units_held": i["units_held"], "target_weight": i["target_weight"]} for i in items.data]
            supabase.table("portfolio_items").insert(new_items).execute()
        return {"msg": "Duplicated"}
    except Exception as e: raise HTTPException(500, str(e))

@app.delete("/portfolios/delete/{portfolio_id}")
def delete_portfolio(portfolio_id: str):
    supabase.table("portfolios").delete().eq("id", portfolio_id).execute()
    return {"msg": "OK"}

@app.put("/portfolios/update_contribution")
def update_contribution(portfolio_id: str, amount: float):
    supabase.table("portfolios").update({"last_contribution": amount}).eq("id", portfolio_id).execute()
    return {"msg": "Updated"}

@app.get("/assets/search")
def search_assets(q: str):
    if not q or len(q) < 2: return []
    results = []
    try:
        y_res = yf.Search(q, max_results=8).quotes
        for quote in y_res:
            sym = quote.get('symbol')
            if not sym: continue
            qtype = quote.get('quoteType', 'EQUITY')
            dtype = "Acción"
            if 'ETF' in str(qtype): dtype = "ETF"
            elif 'CRYPTO' in str(qtype): dtype = "Cripto"
            elif 'FUND' in str(qtype): dtype = "Fondo"
            results.append({ "ticker": sym, "name": quote.get('shortname') or quote.get('longname') or sym, "type_display": dtype, "exchange": quote.get('exchange', '') })
    except: pass
    return results

@app.post("/portfolio/add")
def add_asset(data: AddAssetInput):
    try:
        meta = get_asset_metadata(data.ticker)
        final_ticker = meta['real_ticker']
        asset_id = None
        existing = supabase.table("assets").select("id").eq("ticker", final_ticker).execute()
        if existing.data:
            asset_id = existing.data[0]["id"]
        else:
            try:
                new_asset = supabase.table("assets").insert({
                    "ticker": final_ticker, "name": meta["name"], "type": meta["type"], "sector": meta["sector"], "country": meta["country"], "currency": meta["currency"]
                }).execute()
                if new_asset.data: asset_id = new_asset.data[0]["id"]
            except:
                r = supabase.table("assets").select("id").eq("ticker", final_ticker).execute()
                if r.data: asset_id = r.data[0]["id"]
        if not asset_id: raise HTTPException(500, "Error crítico: ID")
        exists_item = supabase.table("portfolio_items").select("id").eq("portfolio_id", data.portfolio_id).eq("asset_id", asset_id).execute()
        if not exists_item.data:
            supabase.table("portfolio_items").insert({"portfolio_id": data.portfolio_id, "asset_id": asset_id, "units_held": 0, "target_weight": 0}).execute()
        return {"status": "ok", "asset_name": meta["name"]}
    except Exception as e: raise HTTPException(500, str(e))

@app.get("/portfolio/{portfolio_id}")
def get_portfolio(portfolio_id: str):
    try:
        items = supabase.table("portfolio_items").select("id, units_held, target_weight, asset:assets(id, name, ticker, type, sector)").eq("portfolio_id", portfolio_id).execute()
        data = []
        for i in items.data:
            if not i.get('asset'): continue
            ticker = i['asset']['ticker']
            price = fetch_live_price(ticker)
            val = safe_float(float(i['units_held']) * price)
            data.append({**i, "current_price": price, "value": round(val, 2)})
        total = sum(x["value"] for x in data)
        for x in data: x["real_weight"] = round(x["value"]/total*100, 2) if total > 0 else 0
        return data
    except: return []

@app.put("/portfolio/update")
def update_item(data: UpdateItemInput):
    supabase.table("portfolio_items").update({"units_held": data.units_held, "target_weight": data.target_weight}).eq("id", data.item_id).execute()
    return {"msg": "OK"}

@app.delete("/portfolio/delete/{item_id}")
def delete_item(item_id: str):
    supabase.table("portfolio_items").delete().eq("id", item_id).execute()
    return {"msg": "OK"}

# --- REBALANCEO ---
@app.post("/portfolio/rebalance")
def calculate_rebalance(data: RebalanceInput):
    port = get_portfolio(data.portfolio_id)
    total = safe_float(sum(x["value"] for x in port))
    future = total + data.contribution
    orders = []
    for x in port:
        price = x["current_price"]
        if price <= 0: continue
        target_val = future * (x["target_weight"] / 100)
        diff = target_val - x["value"]
        orders.append({ 
            "id": x["id"], 
            "asset_name": x["asset"]["name"], 
            "ticker": x["asset"]["ticker"], 
            "action": "BUY" if diff > 0 else "SELL", 
            "units_to_trade": round(diff / price, 4), 
            "diff_val": round(diff, 2), 
            "price": price 
        })
    return {"current_total": total, "contribution": data.contribution, "future_total": future, "orders": orders}

@app.post("/portfolio/apply_rebalance")
def apply_rebalance(data: ApplyRebalanceInput):
    try:
        port_items = get_portfolio(data.portfolio_id)
        val_before = sum(i['value'] for i in port_items)
        val_after = val_before + data.contribution
        
        hist = supabase.table("rebalance_history").insert({
            "portfolio_id": data.portfolio_id, 
            "contribution": data.contribution, 
            "total_value_before": val_before, 
            "total_value_after": val_after
        }).execute()
        hist_id = hist.data[0]['id']
        
        hist_items_data = []
        for order in data.orders:
            units_diff = safe_float(order.get('units_to_trade') or order.get('unitsToTrade'))
            diff_val = safe_float(order.get('diff_val') or order.get('diffVal'))
            price = safe_float(order.get('price'))
            
            if abs(units_diff) > 0.00001:
                hist_items_data.append({
                    "history_id": hist_id, 
                    "asset_name": order.get('asset_name', 'Desconocido'), 
                    "ticker": order.get('ticker', ''), 
                    "action": order.get('action'), 
                    "units": abs(units_diff), 
                    "amount": abs(diff_val), 
                    "price": price
                })
                
                item_id = order.get('id')
                if item_id:
                    curr = supabase.table("portfolio_items").select("units_held").eq("id", item_id).execute()
                    if curr.data:
                        actual = safe_float(curr.data[0]['units_held'])
                        new_h = max(0.0, actual + units_diff)
                        supabase.table("portfolio_items").update({"units_held": new_h}).eq("id", item_id).execute()
        
        if hist_items_data: 
            supabase.table("rebalance_history_items").insert(hist_items_data).execute()
            
        supabase.table("portfolios").update({"last_contribution": data.contribution}).eq("id", data.portfolio_id).execute()
        return {"msg": "Applied"}
    except Exception as e:
        print(f"APPLY ERROR: {e}")
        raise HTTPException(500, str(e))

@app.post("/portfolio/history/undo")
def undo_rebalance_operation(data: Dict[str, str]):
    history_id = data.get("history_id")
    if not history_id: raise HTTPException(400, "Missing history_id")
    try:
        header = supabase.table("rebalance_history").select("portfolio_id").eq("id", history_id).execute()
        if not header.data: raise HTTPException(404, "History not found")
        portfolio_id = header.data[0]['portfolio_id']
        
        items = supabase.table("rebalance_history_items").select("*").eq("history_id", history_id).execute()
        
        for item in items.data:
            ticker = item['ticker']
            units = safe_float(item['units'])
            action = item['action']
            
            asset_res = supabase.table("assets").select("id").eq("ticker", ticker).execute()
            if not asset_res.data: continue
            asset_id = asset_res.data[0]['id']
            
            p_item = supabase.table("portfolio_items").select("id, units_held").eq("portfolio_id", portfolio_id).eq("asset_id", asset_id).execute()
            if not p_item.data: continue
            
            current_units = safe_float(p_item.data[0]['units_held'])
            item_id = p_item.data[0]['id']
            
            if action == 'BUY':
                new_units = max(0.0, current_units - units)
            else:
                new_units = current_units + units
                
            supabase.table("portfolio_items").update({"units_held": new_units}).eq("id", item_id).execute()
            
        supabase.table("rebalance_history").delete().eq("id", history_id).execute()
        return {"msg": "Undone successfully"}
    except Exception as e: 
        print(f"UNDO ERROR: {e}")
        raise HTTPException(500, str(e))

@app.delete("/portfolio/history/delete/{history_id}")
def delete_history_entry(history_id: str):
    try:
        supabase.table("rebalance_history").delete().eq("id", history_id).execute()
        return {"msg": "Deleted"}
    except Exception as e: raise HTTPException(500, str(e))

@app.get("/portfolio/history/{portfolio_id}")
def get_rebalance_history(portfolio_id: str):
    try:
        hists = supabase.table("rebalance_history").select("*").eq("portfolio_id", portfolio_id).order('created_at', desc=True).execute()
        if not hists.data: return []
        res = []
        for h in hists.data:
            items = supabase.table("rebalance_history_items").select("*").eq("history_id", h['id']).execute()
            res.append({**h, "items": items.data})
        return res
    except: return []

# --- CHART & NEWS (LÓGICA MEJORADA) ---
@app.post("/portfolio/history_chart")
def get_chart_data(data: HistoryInput):
    try:
        items = supabase.table("portfolio_items").select("units_held, asset:assets(ticker)").eq("portfolio_id", data.portfolio_id).gt("units_held", 0).execute()
        
        if not items.data: return {"history": [], "change_pct": 0, "change_val": 0}
        
        tickers_map = {}
        for i in items.data:
            if i.get('asset') and i['asset'].get('ticker'):
                tickers_map[i['asset']['ticker']] = float(i['units_held'])
        
        if not tickers_map: return {"history": [], "change_pct": 0, "change_val": 0}
        
        # Ajustar intervalo según periodo para mejor resolución
        interval = "1d"
        if data.period in ["1d", "5d"]: interval = "15m"
        elif data.period in ["1mo", "3mo"]: interval = "1h"
        
        df = yf.download(list(tickers_map.keys()), period=data.period, interval=interval, progress=False)["Close"]
        
        # Normalización robusta
        if isinstance(df, pd.Series): 
            df = df.to_frame(name=list(tickers_map.keys())[0])
        elif len(tickers_map) == 1:
            df.columns = [list(tickers_map.keys())[0]]
            
        # Eliminar zona horaria y rellenar huecos
        df.index = df.index.tz_localize(None)
        df = df.ffill().bfill().fillna(0) # CRÍTICO: Rellena hacia adelante y atrás para evitar ceros

        # Calcular total
        total_series = pd.Series(0.0, index=df.index)
        for ticker, units in tickers_map.items():
            if ticker in df.columns:
                total_series += df[ticker] * units
                
        # Limpiar datos vacíos
        total_series = total_series[total_series > 0]
        
        if total_series.empty: return {"history": [], "change_pct": 0, "change_val": 0}
        
        history = [{"date": d.isoformat(), "value": round(safe_float(v), 2)} for d, v in total_series.items()]
        
        start = history[0]["value"]
        end = history[-1]["value"]
        diff = end - start
        pct = (diff / start * 100) if start > 0 else 0
        
        return {"history": history, "change_val": round(diff, 2), "change_pct": round(pct, 2)}
    except Exception as e:
        print(f"Chart Error: {e}")
        return {"history": [], "change_pct": 0, "change_val": 0}

@app.post("/portfolio/news")
def get_news(data: NewsInput):
    news_map = {}
    sentiments = {}
    total_score = 0; count = 0
    import re
    
    def clean_asset_name(name, ticker):
        # 1. Remove common ETF/fund terms
        cleaned = re.sub(r'(?i)(UCITS|ETF|Acc|Dist|EUR|USD|Class|\(.*\)|Corp|Bond|Index|Fund|iShares|Vanguard|Amundi|Xtrackers|SPDR|Invesco)', '', name)
        # 2. Remove extra spaces
        cleaned = " ".join(cleaned.split())
        # 3. If result is too short, use ticker, else use cleaned name
        return cleaned if len(cleaned) > 3 else ticker

    for asset in data.assets:
        ticker = asset.get('ticker')
        name = asset.get('name', '')
        if not ticker: continue
        
        query_term = clean_asset_name(name, ticker)
        
        # Search for the asset name + "finance" or "stock"
        rss_url = f"https://news.google.com/rss/search?q={urllib.parse.quote(query_term + ' finance news')}&hl=en-US&gl=US&ceid=US:en"
        
        try:
            feed = feedparser.parse(rss_url)
            items = []
            for e in feed.entries[:4]: # Limit to 4 items per asset
                items.append({
                    "title": e.title, 
                    "link": e.link, 
                    "publisher": e.source.title if hasattr(e,'source') else "News", 
                    "time": e.published if hasattr(e,'published') else "Reciente"
                })
            news_map[ticker] = items
        except: news_map[ticker] = []
        
        # RSI Logic remains as requested
        score = calculate_rsi(ticker)
        lbl, col = get_sentiment_label(score)
        sentiments[ticker] = {"score": score, "label": lbl, "color": col}
        total_score += score; count += 1
        
    avg = round(total_score/count) if count > 0 else 50
    albl, acol = get_sentiment_label(avg)
    return {"news": news_map, "sentiments": sentiments, "aggregate": {"score": avg, "label": albl, "color": acol}}

@app.post("/simulations/run")
def run_sim(data: SimulationInput):
    results = []
    base_rate = 0.07 
    volatility = 0.0 
    
    if data.sim_type == 'pessimistic': base_rate = 0.04 
    elif data.sim_type == 'montecarlo': volatility = 0.15 
        
    monthly_rate = base_rate / 12
    monthly_vol = volatility / (12 ** 0.5)
    
    for pid in data.portfolio_ids:
        port = get_portfolio(pid)
        current_val = sum(x['value'] for x in port)
        if current_val == 0: current_val = data.initial_capital
        
        points = []
        curr = current_val
        invested = current_val
        monthly_contrib = data.monthly_contribution
        
        for m in range(data.years * 12 + 1):
            if m > 0:
                if data.contribution_mode == 'growing' and m % 12 == 0:
                    monthly_contrib *= (1 + (data.growth_rate / 100))
                
                pct_change = monthly_rate
                if data.sim_type == 'montecarlo':
                    pct_change += np.random.normal(0, monthly_vol)
                
                curr = curr * (1 + pct_change) + monthly_contrib
                invested += monthly_contrib
            
            if m % 12 == 0: 
                points.append({"year": m/12, "value": round(curr)})
        
        gain = curr - invested
        tax_paid = 0
        if data.tax_rate and gain > 0: tax_paid = gain * 0.19 
        final_net = curr - tax_paid
        
        results.append({ 
            "portfolio_id": pid, "portfolio_name": "Cartera", 
            "data": points, "final_gross": round(curr), "final_net": round(final_net), 
            "total_invested": round(invested), "tax_paid": round(tax_paid), "gain": round(gain) 
        })
    return results