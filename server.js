import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static(join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

console.log(`🔌 Сервер запущен на порту ${PORT}`);

// Кэш последних данных по символам
const cache = new Map(); // symbol -> { kline, ticker }

wss.on('connection', (clientWs, req) => {
  const urlParams = new URLSearchParams(req.url.slice(1));
  const symbol = urlParams.get('symbol') || 'BTCUSDT';
  const interval = urlParams.get('interval') || '1h';

  console.log(`Клиент подключился → ${symbol}@${interval}`);

  // Если уже есть кэш для этого символа, сразу отправляем последние данные
  const cached = cache.get(symbol);
  if (cached) {
    if (cached.kline) clientWs.send(JSON.stringify({ type: 'kline', data: cached.kline }));
    if (cached.ticker) clientWs.send(JSON.stringify({ type: 'miniTicker', data: cached.ticker }));
  }

  // Создаём комбинированный поток к Binance, если его ещё нет для этого символа
  const key = `${symbol}@${interval}`;
  if (!cache.has(key)) {
    const streams = [`${symbol.toLowerCase()}@kline_${interval}`, `${symbol.toLowerCase()}@miniTicker`];
    const binanceUrl = `wss://fstream.binance.com/stream?streams=${streams.join('/')}`;

    let binanceWs = new WebSocket(binanceUrl);
    let reconnectAttempts = 0;
    const maxDelay = 30000;

    const connectBinance = () => {
      binanceWs.onopen = () => {
        console.log(`✅ Binance WebSocket открыт для ${symbol}`);
        reconnectAttempts = 0;
      };

      binanceWs.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.data) {
            // Старый формат { stream, data }
            if (msg.data.e === 'kline') {
              const kline = msg.data.k;
              cache.set(symbol, { ...cache.get(symbol), kline });
              // Рассылаем всем клиентам, подписанным на этот символ и интервал
              wss.clients.forEach(c => {
                if (c.readyState === WebSocket.OPEN && c._symbol === symbol && c._interval === interval) {
                  c.send(JSON.stringify({ type: 'kline', data: kline }));
                }
              });
            } else if (msg.data.e === '24hrMiniTicker') {
              const ticker = msg.data;
              cache.set(symbol, { ...cache.get(symbol), ticker });
              wss.clients.forEach(c => {
                if (c.readyState === WebSocket.OPEN && c._symbol === symbol) {
                  c.send(JSON.stringify({ type: 'miniTicker', data: ticker }));
                }
              });
            }
          }
        } catch (err) {}
      };

      binanceWs.onclose = (event) => {
        if (event.code !== 1000) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxDelay);
          reconnectAttempts++;
          setTimeout(connectBinance, delay);
        }
      };

      binanceWs.onerror = () => {};
    };

    connectBinance();
    cache.set(key, binanceWs);
  }

  // Сохраняем на клиенте параметры для рассылки
  clientWs._symbol = symbol;
  clientWs._interval = interval;

  // Ping‑pong для удержания соединения (каждые 30 секунд)
  const pingInterval = setInterval(() => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.ping();
    }
  }, 30000);

  clientWs.on('pong', () => {
    // Можно логировать, что клиент жив
  });

  clientWs.on('close', () => {
    clearInterval(pingInterval);
    console.log(`Клиент отключился → ${symbol}`);
  });

  clientWs.on('error', (err) => {
    console.error('Ошибка клиентского WebSocket:', err.message);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Приложение доступно на http://localhost:${PORT}`);
  console.log(`🔗 WebSocket: ws://localhost:${PORT}`);
});