function ScreenerTable({ tickers, minVolume, onSelect, activeSymbol }) {
  const filtered = tickers.filter(t => t.quoteVolume >= minVolume);

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
              <td>{t.lastPrice?.toFixed(4)}</td>
              <td>{(t.quoteVolume / 1e6).toFixed(2)}M</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ScreenerTable;