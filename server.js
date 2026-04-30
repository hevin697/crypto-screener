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

  const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
  const binanceUrl = `wss://fstream.binance.com/ws/${streamName}`;

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
      } catch (e) {}
      binanceWs = null;
    }
  };

  const connectBinance = () => {
    safeCloseBinance();
    console.log(`Подключение к Binance (попытка ${reconnectAttempts + 1}): ${streamName}`);
    try {
      binanceWs = new WebSocket(binanceUrl);
    } catch (err) {
      console.error('Ошибка создания WebSocket:', err.message);
      scheduleReconnect();
      return;
    }

    binanceWs.onopen = () => {
      console.log(`✅ Binance WebSocket открыт: ${streamName}`);
      reconnectAttempts = 0;
    };

    binanceWs.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        // Пытаемся извлечь свечу из обоих форматов
        let kline = null;
        if (msg?.data?.k) {
          kline = msg.data.k;   // старый формат: {data:{e:"kline", k:{...}}}
        } else if (msg?.k) {
          kline = msg.k;        // новый формат: {e:"kline", k:{...}}
        }
        if (clientWs.readyState === WebSocket.OPEN && kline) {
          clientWs.send(JSON.stringify(kline));
          console.log('📤 Свеча отправлена клиенту:', kline.t);
        }
      } catch (err) {
        console.error('Ошибка обработки сообщения от Binance:', err.message);
      }
    };

    binanceWs.onclose = (event) => {
      console.log(`Binance WebSocket закрыт (код ${event.code})`);
      if (!clientClosed && clientWs.readyState === WebSocket.OPEN) {
        scheduleReconnect();
      }
    };

    binanceWs.onerror = (err) => {
      console.error('Ошибка Binance WebSocket:', err.message || 'Network error');
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