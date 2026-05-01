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

// Хранилище активных Binance-соединений (один на поток)
const binanceStreams = new Map(); // ключ: "btcusdt@kline_1m", значение: { ws, clients: Set, lastKline, lastTicker }

// Функция создания/переиспользования потока Binance
function getOrCreateBinanceStream(streamKey, symbol) {
  if (binanceStreams.has(streamKey)) {
    return binanceStreams.get(streamKey);
  }

  const [symbolLower, suffix] = streamKey.split('@');
  const streams = [`${symbolLower}@${suffix}`, `${symbolLower}@miniTicker`];
  const binanceUrl = `wss://fstream.binance.com/stream?streams=${streams.join('/')}`;

  const streamObj = {
    ws: null,
    clients: new Set(),
    lastKline: null,
    lastTicker: null,
    reconnectAttempts: 0,
    reconnectTimer: null,
    closed: false,
  };

  const maxDelay = 30000;

  const connect = () => {
    if (streamObj.closed) return;
    if (streamObj.reconnectTimer) clearTimeout(streamObj.reconnectTimer);

    const ws = new WebSocket(binanceUrl);
    streamObj.ws = ws;

    ws.onopen = () => {
      console.log(`✅ Binance поток открыт: ${streamKey}`);
      streamObj.reconnectAttempts = 0;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('📨 Сообщение от Binance:', JSON.stringify(msg).slice(0, 150)); // <-- ВОТ ЭТА СТРОКА
        if (msg.data) {
          if (msg.data.e === 'kline') {
            const kline = msg.data.k;
            streamObj.lastKline = kline;
            // Рассылаем всем клиентам, подписанным на этот поток
            streamObj.clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'kline', data: kline }));
              }
            });
          } else if (msg.data.e === '24hrMiniTicker') {
            streamObj.lastTicker = msg.data;
            streamObj.clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'miniTicker', data: msg.data }));
              }
            });
          }
        }
      } catch (err) {}
    };

    ws.onclose = (event) => {
      if (!streamObj.closed && event.code !== 1000) {
        const delay = Math.min(1000 * 2 ** streamObj.reconnectAttempts, maxDelay);
        streamObj.reconnectAttempts++;
        console.log(`Binance поток ${streamKey} закрыт, переподключение через ${delay}мс`);
        streamObj.reconnectTimer = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {};
  };

  connect();
  binanceStreams.set(streamKey, streamObj);
  return streamObj;
}

// Обработка подключения клиента
wss.on('connection', (clientWs, req) => {
  const urlParams = new URLSearchParams(req.url.slice(1));
  const symbol = urlParams.get('symbol') || 'BTCUSDT';
  const interval = urlParams.get('interval') || '1h';

  const streamKey = `${symbol.toLowerCase()}@kline_${interval}`;
  console.log(`Клиент подключился → ${streamKey}`);

  const streamObj = getOrCreateBinanceStream(streamKey, symbol);
  streamObj.clients.add(clientWs);

  // Сразу шлём последние известные данные, если есть
  if (streamObj.lastKline) {
    clientWs.send(JSON.stringify({ type: 'kline', data: streamObj.lastKline }));
  }
  if (streamObj.lastTicker) {
    clientWs.send(JSON.stringify({ type: 'miniTicker', data: streamObj.lastTicker }));
  }

  // Пинг-понг каждые 30 секунд
  const pingInterval = setInterval(() => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.ping();
    }
  }, 30000);

  clientWs.on('close', () => {
    clearInterval(pingInterval);
    streamObj.clients.delete(clientWs);
    console.log(`Клиент отключился от ${streamKey}`);

    // Если клиентов не осталось, можно закрыть Binance-соединение (опционально, чтобы экономить ресурсы)
    if (streamObj.clients.size === 0) {
      // Не закрываем, чтобы кэш оставался – можно закомментировать, если нужно экономить порты
      // streamObj.closed = true;
      // streamObj.ws.close();
      // binanceStreams.delete(streamKey);
    }
  });

  clientWs.on('error', (err) => {
    console.error('Ошибка клиента:', err.message);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Приложение доступно на http://localhost:${PORT}`);
  console.log(`🔗 WebSocket: ws://localhost:${PORT}`);
});