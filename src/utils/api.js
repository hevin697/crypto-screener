// Базовая ссылка на REST API фьючерсов Binance
const BASE_URL = 'https://fapi.binance.com/fapi/v1';

// Получаем список всех тикеров за 24 часа
export async function fetch24hrTickers() {
  const response = await fetch(`${BASE_URL}/ticker/24hr`);
  const data = await response.json();
  // Оставляем только пары, оканчивающиеся на USDT,
  // и берём нужные поля, сортируем по объёму (самые активные сверху)
  return data
    .filter(item => item.symbol.endsWith('USDT'))
    .map(item => ({
      symbol: item.symbol,
      lastPrice: parseFloat(item.lastPrice),
      quoteVolume: parseFloat(item.quoteVolume), // объём в USDT
    }))
    .sort((a, b) => b.quoteVolume - a.quoteVolume);
}

// Загружаем исторические свечи (klines)
export async function fetchKlines(symbol, interval, limit = 500) {
  const response = await fetch(
    `${BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  );
  const data = await response.json();
  // Превращаем ответ Binance в удобный формат для графика
  return data.map(k => ({
    time: k[0] / 1000, // время открытия свечи (переводим мс → секунды)
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}