import { useEffect, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Asset } from './types';
import { AssetCard } from './components/AssetCard';
import { AssetDetail } from './components/AssetDetail';

function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [marketCapFilter, setMarketCapFilter] = useState('100000000'); // 默认1亿
  const [volumeFilter, setVolumeFilter] = useState('10000000');  // 默认1000万
  const [changeFilter, setChangeFilter] = useState('10');  // 默认10%

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const response = await fetch('https://api.coincap.io/v2/assets');
        const data = await response.json();
        setAssets(data.data);
        setLoading(false);
      } catch (error) {
        setError('Failed to fetch data. Please try again later.');
        setLoading(false);
      }
    };

    fetchAssets();
    const interval = setInterval(fetchAssets, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    const meetsThresholds = parseFloat(asset.marketCapUsd) > parseFloat(marketCapFilter) &&
                           parseFloat(asset.volumeUsd24Hr) > parseFloat(volumeFilter) &&
                           parseFloat(asset.changePercent24Hr) > parseFloat(changeFilter);
    return matchesSearch && meetsThresholds;
  });

  if (error) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8">
          <p className="text-xl font-bold text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 搜索和筛选区域 */}
        <div className="bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 space-y-4">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name or symbol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-2 border-black rounded-none focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {/* 筛选选项 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 市值筛选 */}
            <div>
              <label className="block text-sm font-bold mb-2">Market Cap (USD)</label>
              <select
                value={marketCapFilter}
                onChange={(e) => setMarketCapFilter(e.target.value)}
                className="w-full p-2 border-2 border-black rounded-none focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="100000000">{">"} $100M</option>
                <option value="1000000000">{">"} $1B</option>
                <option value="10000000000">{">"} $10B</option>
              </select>
            </div>

            {/* 交易量筛选 */}
            <div>
              <label className="block text-sm font-bold mb-2">24h Volume (USD)</label>
              <select
                value={volumeFilter}
                onChange={(e) => setVolumeFilter(e.target.value)}
                className="w-full p-2 border-2 border-black rounded-none focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="10000000">{">"} $10M</option>
                <option value="100000000">{">"} $100M</option>
                <option value="1000000000">{">"} $1B</option>
              </select>
            </div>

            {/* 价格变化筛选 */}
            <div>
              <label className="block text-sm font-bold mb-2">24h Change (%)</label>
              <select
                value={changeFilter}
                onChange={(e) => setChangeFilter(e.target.value)}
                className="w-full p-2 border-2 border-black rounded-none focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="5">{">"} 5%</option>
                <option value="10">{">"} 10%</option>
                <option value="15">{">"} 15%</option>
                <option value="20">{">"} 20%</option>
              </select>
            </div>
          </div>
        </div>

        {/* 加载状态显示 */}
        {loading ? (
          <div className="flex justify-center items-center p-12">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAssets.map(asset => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onClick={() => setSelectedAsset(asset)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 资产详情弹窗 */}
      {selectedAsset && (
        <AssetDetail
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
        />
      )}
    </div>
  );
}

export default App;