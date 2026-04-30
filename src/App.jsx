import { useState, useEffect, useCallback } from 'react';
import ScreenerTable from './components/ScreenerTable';
import ChartComponent from './components/ChartComponent';
import { fetchKlines } from './utils/api';
import { useBinanceWebSocket } from './utils/useBinanceWebSocket';
import './App.css';

function App() {
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [interval, setIntervalState] = useState('1h');
  const [minVolume, setMinVolume] = useState(10000000);
  const [candles, setCandles] = useState([]);

  useEffect(() => {
    if (!selectedSymbol) return;
    const loadHistory = async () => {
      const data = await fetchKlines(selectedSymbol, interval);
      setCandles(data);
    };
    loadHistory();
  }, [selectedSymbol, interval]);

  const handleKlineMessage = useCallback((kline) => {
    const newCandle = {
      time: kline.t / 1000,
      open: parseFloat(kline.o),
      high: parseFloat(kline.h),
      low: parseFloat(kline.l),
      close: parseFloat(kline.c),
      volume: parseFloat(kline.v),
    };

    setCandles(prev => {
      if (prev.length === 0) return [newCandle];
      const last = prev[prev.length - 1];
      if (newCandle.time === last.time) {
        const updated = [...prev];
        updated[prev.length - 1] = newCandle;
        return updated;
      } else if (newCandle.time > last.time) {
        return [...prev, newCandle];
      }
      return prev;
    });
  }, []);

  useBinanceWebSocket(selectedSymbol, interval, handleKlineMessage);

  const intervalsList = ['1m', '5m', '15m', '1h', '4h', '1d'];

  return (
    <div className="app">
      <div className="screener-panel">
        <div style={{ marginBottom: '10px' }}>
          <label>Мин. объём (USDT): </label>
          <input
            type="number"
            value={minVolume}
            onChange={(e) => setMinVolume(Number(e.target.value))}
            style={{ width: '120px', marginLeft: '5px' }}
          />
        </div>
        <ScreenerTable
          minVolume={minVolume}
          onSelect={setSelectedSymbol}
          activeSymbol={selectedSymbol}
        />
      </div>

      <div className="chart-panel">
        <div className="interval-buttons">
          {intervalsList.map(tf => (
            <button
              key={tf}
              onClick={() => setIntervalState(tf)}
              className={interval === tf ? 'active' : ''}
            >
              {tf}
            </button>
          ))}
        </div>

        {selectedSymbol ? (
          <div style={{ flex: 1, position: 'relative' }}>
            <ChartComponent candles={candles} />
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>
            Выберите пару из таблицы слева
          </div>
        )}
      </div>
    </div>
  );
}

export default App;