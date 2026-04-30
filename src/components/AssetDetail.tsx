import React, { useEffect, useState } from 'react';
import { X, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Asset, AssetHistory } from '../types';
import { formatNumber, formatPrice } from '../utils';

interface AssetDetailProps {
  asset: Asset;
  onClose: () => void;
}

export const AssetDetail: React.FC<AssetDetailProps> = ({ asset, onClose }) => {
  const [history, setHistory] = useState<AssetHistory[]>([]);
  const changePercent = parseFloat(asset.changePercent24Hr);
  const isPositive = changePercent > 0;

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch(
          `https://api.coincap.io/v2/assets/${asset.id}/history?interval=h1`
        );
        const data = await response.json();
        setHistory(data.data);
      } catch (error) {
        console.error('Error fetching history:', error);
      }
    };
    fetchHistory();
  }, [asset.id]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] 
                    w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-3xl font-bold">{asset.name}</h2>
            <p className="text-xl text-gray-600">{asset.symbol}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X size={24} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="space-y-4">
            <div>
              <p className="text-gray-600">Current Price</p>
              <p className="text-3xl font-bold font-mono">{formatPrice(asset.priceUsd)}</p>
            </div>
            <div className={`flex items-center gap-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
              <span className="text-xl font-bold">{Math.abs(changePercent).toFixed(2)}%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-600">Market Cap</p>
              <p className="text-xl font-bold font-mono">${formatNumber(asset.marketCapUsd)}</p>
            </div>
            <div>
              <p className="text-gray-600">Volume (24h)</p>
              <p className="text-xl font-bold font-mono">${formatNumber(asset.volumeUsd24Hr)}</p>
            </div>
            <div>
              <p className="text-gray-600">Supply</p>
              <p className="text-xl font-bold font-mono">{formatNumber(asset.supply)} {asset.symbol}</p>
            </div>
            {asset.maxSupply && (
              <div>
                <p className="text-gray-600">Max Supply</p>
                <p className="text-xl font-bold font-mono">{formatNumber(asset.maxSupply)} {asset.symbol}</p>
              </div>
            )}
          </div>
        </div>

        <div className="h-[400px] border-4 border-black p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <XAxis 
                dataKey="time"
                tickFormatter={(time) => new Date(time).toLocaleDateString()}
              />
              <YAxis 
                dataKey="priceUsd"
                domain={['auto', 'auto']}
                tickFormatter={(value) => formatPrice(value)}
              />
              <Tooltip 
                formatter={(value: any) => formatPrice(value)}
                labelFormatter={(label) => new Date(label).toLocaleString()}
              />
              <Line 
                type="monotone"
                dataKey="priceUsd"
                stroke="#000"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};