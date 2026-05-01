import { useState, useEffect, useRef, useCallback } from 'react';
import ScreenerTable from './components/ScreenerTable';
import ChartComponent from './components/ChartComponent';
import { fetchKlines, fetch24hrTickers } from './utils/api';
import './App.css';

function App() {
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [interval, setIntervalState] = useState('1h');
  const [minVolume, setMinVolume] = useState(10000000);
  const [candles, setCandles] = useState([]);
  const [tickers, setTickers] = useState([]); // хранилище для таблицы

  // Первоначальная загрузка тикеров
  useEffect(() => {
    fetch24hrTickers().then(data => {
      setTickers(data.filter(t => t.lastPrice > 0 && t.quoteVolume > 0));
    });
  }, []);

  // Загрузка истории при смене пары или таймфрейма
  useEffect(() => {
    if (!selectedSymbol) return;
    fetchKlines(selectedSymbol, interval).then(setCandles);
  }, [selectedSymbol, interval]);

  // WebSocket с прокси-сервера (обновлённый useRef для хранения ws)
  const wsRef = useRef(null);
  const onMessageRef = useRef(null);

  useEffect(() => {
    if (!selectedSymbol) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/?symbol=${selectedSymbol}&interval=${interval}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => console.log('✅ WebSocket к серверу открыт');

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'kline') {
        const kline = msg.data;
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
          if (newCandle.time > last.time) return [...prev, newCandle];
          if (newCandle.time === last.time) {
            const updated = [...prev];
            updated[prev.length - 1] = newCandle;
            return updated;
          }
          return prev;
        });
      } else if (msg.type === 'miniTicker') {
        const tick = msg.data;
        // Обновляем цену и объём для выбранного символа в таблице (без пересоздания массива)
        setTickers(prev => {
          const idx = prev.findIndex(t => t.symbol === tick.s);
          if (idx === -1) return prev;
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            lastPrice: parseFloat(tick.c),
            quoteVolume: parseFloat(tick.q), // quote asset volume
          };
          return updated;
        });
      }
    };

    ws.onclose = () => console.log('WebSocket закрыт');

    return () => {
      ws.close();
    };
  }, [selectedSymbol, interval]);

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
          tickers={tickers}
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