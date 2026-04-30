import { useState, useEffect } from 'react';
import { fetch24hrTickers } from '../utils/api';

function ScreenerTable({ minVolume, onSelect, activeSymbol }) {
  const [tickers, setTickers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Загружаем и обновляем тикеры
  useEffect(() => {
    const load = () => {
      fetch24hrTickers()
        .then(data => {
          setTickers(data);
          setLoading(false);
        })
        .catch(err => {
          console.error('Ошибка загрузки тикеров', err);
          setLoading(false);
        });
    };

    load(); // первый запуск сразу
    const interval = setInterval(load, 2000); // каждые 5 секунд

    return () => clearInterval(interval); // очистка при размонтировании
  }, []);

  const filtered = tickers.filter(t => t.quoteVolume >= minVolume);

  if (loading) return <div>Загрузка списка пар...</div>;

  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      <table className="screener-table">
        <thead>
          <tr>
            <th>Пара</th>
            <th>Цена</th>
            <th>Объём (24ч)</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(t => (
            <tr
              key={t.symbol}
              onClick={() => onSelect(t.symbol)}
              className={activeSymbol === t.symbol ? 'active' : ''}
            >
              <td>{t.symbol}</td>
              <td>{t.lastPrice.toFixed(4)}</td>
              <td>{(t.quoteVolume / 1e6).toFixed(2)}M</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ScreenerTable;