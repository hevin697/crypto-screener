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
        if (binanceWs.readyState === WebSocket.OPEN) {
          binanceWs.close(1000, 'Client disconnect');
        } else if (binanceWs.readyState === WebSocket.CONNECTING) {
          binanceWs.onopen = () => binanceWs.close(1000);
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
        const raw = event.data.toString();
        console.log(`📩 Получено сырое сообщение от Binance: ${raw.slice(0, 200)}`);
        const msg = JSON.parse(raw);
        let kline = null;
        if (msg?.data?.k) {
          kline = msg.data.k;
        } else if (msg?.k) {
          kline = msg.k;
        }
        if (kline) {
          console.log('📤 Отправка свечи клиенту:', kline.t);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify(kline));
          }
        }
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
      // Не закрываем принудительно, onclose вызовется сам
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