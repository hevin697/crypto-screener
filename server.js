import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;

// Express приложение
const app = express();

// Раздаём статические файлы из папки dist (сборка React)
app.use(express.static(join(__dirname, 'dist')));

// Для любого другого маршрута отдаём index.html (SPA)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// HTTP сервер (нужен для WebSocket)
const server = createServer(app);

// WebSocket сервер на том же порту
const wss = new WebSocketServer({ server });

console.log(`🔌 Сервер запущен на порту ${PORT}`);

// Обработка клиентских WebSocket подключений
wss.on('connection', (clientWs, req) => {
  // Извлекаем параметры из URL запроса (например, ?symbol=BTCUSDT&interval=1m)
  const urlParams = new URLSearchParams(req.url.slice(1));
  const symbol = urlParams.get('symbol') || 'BTCUSDT';
  const interval = urlParams.get('interval') || '1h';

  console.log(`Клиент подключился → ${symbol}@${interval}`);

  let binanceWs = null;
  let reconnectAttempts = 0;
  const maxDelay = 30000;
  let closedIntentionally = false;

  const connectBinance = () => {
    if (binanceWs) {
      binanceWs.onclose = null;
      binanceWs.close(1000);
    }

    const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
    const binanceUrl = `wss://fstream.binance.com/stream?streams=${streamName}`;

    binanceWs = new WebSocket(binanceUrl);
    console.log(`Подключение к Binance: ${streamName}`);

    binanceWs.onopen = () => {
      console.log(`✅ Binance открыт: ${streamName}`);
      reconnectAttempts = 0;
    };

    binanceWs.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      // Пересылаем только данные о свечах, если клиент ещё открыт
      if (clientWs.readyState === WebSocket.OPEN && msg.data?.e === 'kline') {
        clientWs.send(JSON.stringify(msg.data.k));
      }
    };

    binanceWs.onclose = (event) => {
      if (!closedIntentionally && clientWs.readyState === WebSocket.OPEN) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxDelay);
        reconnectAttempts++;
        setTimeout(connectBinance, delay);
      }
    };

    binanceWs.onerror = (err) => {
      console.error('Ошибка Binance WebSocket:', err.message);
      binanceWs.close();
    };
  };

  connectBinance();

  // Когда клиент отключается, разрываем соединение с Binance
  clientWs.on('close', () => {
    console.log('Клиент отключился');
    closedIntentionally = true;
    if (binanceWs) {
      binanceWs.onclose = null;
      binanceWs.close(1000);
    }
  });

  clientWs.on('error', (err) => {
    console.error('Ошибка клиентского WebSocket:', err.message);
  });
});

// Запуск сервера
server.listen(PORT, () => {
  console.log(`🚀 Приложение доступно на http://localhost:${PORT}`);
  console.log(`🔗 WebSocket: ws://localhost:${PORT}`);
});