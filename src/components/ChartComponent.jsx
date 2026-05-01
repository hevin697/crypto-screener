import { useRef, useEffect } from 'react';
import { createChart } from 'lightweight-charts';

function ChartComponent({ candles }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  // Инициализация графика один раз
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { color: '#1e1e1e' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2B2B43' },
        horzLines: { color: '#2B2B43' },
      },
      timeScale: {
        borderColor: '#485c7b',
        timeVisible: true,
      },
      crosshair: {
        mode: 0, // обычный курсор
      },
    });

    // Настройка отображения цены с 5 знаками после запятой
    chart.applyOptions({
      localization: {
        priceFormatter: (price) => price.toFixed(5),
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderDownColor: '#ef5350',
      borderUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      wickUpColor: '#26a69a',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // При изменении размера окна перерисовываем
    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove(); // удаляем график при размонтировании
    };
  }, []);

  // Когда приходят новые данные свечей — обновляем график
  useEffect(() => {
    if (seriesRef.current && candles.length > 0) {
      seriesRef.current.setData(candles);
    }
  }, [candles]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

export default ChartComponent;