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
  // Правильный URL (новый формат Binance 2024+)
  const binanceUrl = `wss://fstream.binance.com/ws/${streamName}`;

  let binanceWs = null;
  let reconnectAttempts = 0;
  const maxDelay = 30000;
  let clientClosed = false;

  const connectBinance = () => {
    if (binanceWs) {
      binanceWs.onclose = null;
      binanceWs.close(1000);
    }

    console.log(`Подключение к Binance (попытка ${reconnectAttempts + 1}): ${streamName}`);
    binanceWs = new WebSocket(binanceUrl);

    binanceWs.onopen = () => {
      console.log(`✅ Binance WebSocket открыт: ${streamName}`);
      reconnectAttempts = 0;
    };

    binanceWs.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (clientWs.readyState === WebSocket.OPEN && msg?.e === 'kline') {
          clientWs.send(JSON.stringify(msg.k));
        }
      } catch (err) {
        console.error('Ошибка парсинга сообщения от Binance:', err.message);
      }
    };

    binanceWs.onclose = (event) => {
      console.log(`Binance WebSocket закрыт (код ${event.code})`);
      if (!clientClosed && clientWs.readyState === WebSocket.OPEN) {
        const delay = Math.min(1000 * 2 ** reconnectAttempts, maxDelay);
        reconnectAttempts++;
        setTimeout(connectBinance, delay);
      }
    };

    binanceWs.onerror = (err) => {
      console.error('Ошибка Binance WebSocket:', err.message || 'неизвестная ошибка');
      // Закрытие вызовет onclose, где произойдет переподключение
      binanceWs.close();
    };
  };

  connectBinance();

  clientWs.on('close', () => {
    console.log('Клиент отключился');
    clientClosed = true;
    if (binanceWs) {
      binanceWs.onclose = null;
      binanceWs.close(1000);
    }
  });

  clientWs.on('error', (err) => {
    console.error('Ошибка клиентского WebSocket:', err.message);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Приложение доступно на http://localhost:${PORT}`);
  console.log(`🔗 WebSocket: ws://localhost:${PORT}`);
});