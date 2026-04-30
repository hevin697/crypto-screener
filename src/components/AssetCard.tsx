import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Asset } from '../types';
import { formatNumber, formatPrice } from '../utils';

interface AssetCardProps {
  asset: Asset;
  onClick: () => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({ asset, onClick }) => {
  const changePercent = parseFloat(asset.changePercent24Hr);
  const isPositive = changePercent > 0;

  return (
    <div 
      onClick={onClick}
      className="bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] 
                hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer
                p-6 flex flex-col gap-4"
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-2xl font-bold">{asset.name}</h3>
          <p className="text-gray-600">{asset.symbol}</p>
        </div>
        <span className="text-lg font-mono">#{asset.rank}</span>
      </div>
      
      <div className="flex justify-between items-end">
        <div>
          <p className="text-sm text-gray-600">Price</p>
          <p className="text-xl font-bold font-mono">{formatPrice(asset.priceUsd)}</p>
        </div>
        <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          <span className="font-bold">{Math.abs(changePercent).toFixed(2)}%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-2">
        <div>
          <p className="text-sm text-gray-600">Market Cap</p>
          <p className="font-mono font-bold">${formatNumber(asset.marketCapUsd)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Volume (24h)</p>
          <p className="font-mono font-bold">${formatNumber(asset.volumeUsd24Hr)}</p>
        </div>
      </div>
    </div>
  );
};