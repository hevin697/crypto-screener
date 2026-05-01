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

wss.on('connection', (clientWs, req) => {
  const urlParams = new URLSearchParams(req.url.slice(1));
  const symbol = urlParams.get('symbol') || 'BTCUSDT';
  const interval = urlParams.get('interval') || '1h';

  console.log(`Клиент подключился → ${symbol}@${interval}`);

  // Создаём комбинированный поток: kline + miniTicker
  const streams = [
    `${symbol.toLowerCase()}@kline_${interval}`,
    `${symbol.toLowerCase()}@miniTicker`
  ];
  const binanceUrl = `wss://fstream.binance.com/stream?streams=${streams.join('/')}`;

  let binanceWs = null;
  let reconnectAttempts = 0;
  const maxDelay = 30000;
  let clientClosed = false;
  let reconnectTimer = null;

  const safeCloseBinance = () => {
    if (binanceWs) {
      try {
        binanceWs.onopen = null;
        binanceWs.onmessage = null;
        binanceWs.onclose = null;
        binanceWs.onerror = null;
        if (binanceWs.readyState === WebSocket.OPEN || binanceWs.readyState === WebSocket.CONNECTING) {
          binanceWs.close(1000, 'Client disconnect');
        }
      } catch (e) {
        console.error('safeCloseBinance error:', e.message);
      }
      binanceWs = null;
    }
  };

  const connectBinance = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    safeCloseBinance();

    console.log(`Подключение к Binance (попытка ${reconnectAttempts + 1}): ${streams.join(', ')}`);
    try {
      binanceWs = new WebSocket(binanceUrl);
    } catch (err) {
      console.error('Ошибка создания WebSocket:', err.message);
      scheduleReconnect();
      return;
    }

    binanceWs.onopen = () => {
      console.log(`✅ Binance WebSocket открыт`);
      reconnectAttempts = 0;
    };

    binanceWs.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        // Обработка комбинированного потока (streams)
        if (msg.data) {
          // Старый формат: { stream: "...", data: {...} }
          const type = msg.stream.split('@').pop();
          if (type === `kline_${interval}`) {
            const kline = msg.data.k;
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'kline', data: kline }));
            }
          } else if (type === 'miniTicker') {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'miniTicker', data: msg.data }));
            }
          }
        } else if (msg.e) {
          // Новый формат: { e: "kline", ... }
          if (msg.e === 'kline') {
            const kline = msg.k;
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'kline', data: kline }));
            }
          } else if (msg.e === '24hrMiniTicker') {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'miniTicker', data: msg }));
            }
          }
        }
        // Игнорируем системные сообщения (ping и т.д.)
      } catch (err) {
        console.error('Ошибка обработки сообщения Binance:', err.message);
      }
    };

    binanceWs.onclose = (event) => {
      console.log(`Binance WebSocket закрыт (код ${event.code})`);
      if (!clientClosed && clientWs.readyState === WebSocket.OPEN) {
        scheduleReconnect();
      }
    };

    binanceWs.onerror = (err) => {
      console.error('Ошибка Binance WebSocket:', err.message || 'Неизвестная ошибка');
    };
  };

  const scheduleReconnect = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxDelay);
    reconnectAttempts++;
    reconnectTimer = setTimeout(connectBinance, delay);
  };

  connectBinance();

  clientWs.on('close', () => {
    console.log('Клиент отключился');
    clientClosed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    safeCloseBinance();
  });

  clientWs.on('error', (err) => {
    console.error('Ошибка клиентского WebSocket:', err.message);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Приложение доступно на http://localhost:${PORT}`);
  console.log(`🔗 WebSocket: ws://localhost:${PORT}`);
});