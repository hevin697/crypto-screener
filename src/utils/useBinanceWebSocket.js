import { useEffect, useRef, useCallback } from 'react';

export function useBinanceWebSocket(symbol, interval, onMessage) {
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (!symbol || !interval) return;

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close(1000);
      wsRef.current = null;
    }

    // Для продакшена используем wss:// + текущий хост
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/?symbol=${symbol}&interval=${interval}`;

    console.log('Подключение к серверу:', url);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => console.log('✅ WebSocket к серверу открыт');

    ws.onmessage = (event) => {
      try {
        const kline = JSON.parse(event.data);
        console.log('📈 Получена свеча:', kline);
        onMessageRef.current(kline);
      } catch (err) {
        console.error('Ошибка парсинга:', err);
      }
    };

    let attempts = 0;
    const maxDelay = 30000;

    const scheduleReconnect = () => {
      const delay = Math.min(1000 * Math.pow(2, attempts), maxDelay);
      reconnectTimerRef.current = setTimeout(() => {
        attempts++;
        connect();
      }, delay);
    };

    ws.onclose = (event) => {
      console.log('Соединение с сервером закрыто');
      if (event.code !== 1000) {
        scheduleReconnect();
      }
    };

    ws.onerror = (err) => {
      console.error('Ошибка WebSocket:', err);
      ws.close();
    };
  }, [symbol, interval]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close(1000);
        wsRef.current = null;
      }
    };
  }, [connect]);

  return null;
}