import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, HelpCircle, Upload, Expand, Play, GripVertical } from 'lucide-react';

function HomePage() {
  const [activeTab, setActiveTab] = useState('bar');
  const [graphWidth, setGraphWidth] = useState(16.666); // 2/12 = 16.666%
  const [visualizationWidth, setVisualizationWidth] = useState(58.333); // 7/12 = 58.333%
  const [isDragging, setIsDragging] = useState(null);
  const containerRef = useRef(null);

  const mockData = [
    { name: 'mock.js', blue: 180, green: 120, pink: 80 },
    { name: 'mock.js', blue: 60, green: 40, pink: 50 },
    { name: 'mock.js', blue: 20, green: 15, pink: 10 },
    { name: 'mock.js', blue: 220, green: 160, pink: 70 },
    { name: 'mock.js', blue: 100, green: 130, pink: 40 }
  ];

  const summaryData = {
    'Total files': 6,
    'Total lines': 566,
    'Logical LOC': 566,
    'Total function': 28,
    'Avg. complexity': 1.89,
    'Max complexity': 7
  };

  const handleMouseDown = (divider) => {
    setIsDragging(divider);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !containerRef.current) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const mouseX = e.clientX - containerRect.left;
    const percentage = (mouseX / containerWidth) * 100;

    if (isDragging === 'first') {
      // Dragging between Graph and Visualization
      const newGraphWidth = Math.max(10, Math.min(40, percentage));
      const newVisualizationWidth = Math.max(30, Math.min(70, 100 - newGraphWidth - (100 - graphWidth - visualizationWidth)));
      setGraphWidth(newGraphWidth);
      setVisualizationWidth(newVisualizationWidth);
    } else if (isDragging === 'second') {
      // Dragging between Visualization and Raw code
      const newVisualizationWidth = Math.max(30, Math.min(70, percentage - graphWidth));
      setVisualizationWidth(newVisualizationWidth);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  return (
    <div 
      className="min-h-screen bg-slate-100"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header - Outside of container */}
      <header className="bg-blue-300 text-black py-4 shadow-sm">
        <div className="container mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold hover:opacity-90 transition-opacity">
            CodeWorld
          </Link>
          <Link
            to="/analyze"
            className="flex items-center gap-2 bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors text-sm"
          >
            <Upload size={16} />
            Analyze Code
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Title Section - Outside blocks */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Github Analysis Result</h1>
          <p className="text-gray-600">Metrics from folder <span className="font-semibold">src</span></p>
        </div>

        {/* Main Layout with Resizable Panels */}
        <div ref={containerRef} className="flex gap-0 mb-6 relative">
          {/* Left Panel - Graph */}
          <div style={{ width: `${graphWidth}%` }} className="pr-3">
            <div className="bg-white rounded-lg shadow p-4 h-full min-h-[500px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Graph</h3>
                <div className="flex gap-1">
                  <button className="text-gray-400 hover:text-gray-600">
                    <ChevronLeft size={16} />
                  </button>
                  <button className="text-gray-400 hover:text-gray-600">
                    <Play size={16} />
                  </button>
                  <button className="text-gray-400 hover:text-gray-600">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm">
                <option>Branch</option>
                <option>Main</option>
                <option>Feature</option>
              </select>
            </div>
          </div>

          {/* First Divider */}
          <div 
            className="flex items-center justify-center cursor-col-resize hover:bg-blue-100 transition-colors group relative z-10"
            style={{ width: '12px', flexShrink: 0 }}
            onMouseDown={() => handleMouseDown('first')}
          >
            <div className="h-full w-1 bg-gray-200 group-hover:bg-blue-400 transition-colors"></div>
            <GripVertical size={16} className="absolute text-gray-400 group-hover:text-blue-600" />
          </div>

          {/* Center Panel - Visualization + Summary */}
          <div style={{ width: `${visualizationWidth}%` }} className="px-3">
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex items-center gap-2 mb-6">
                <h3 className="text-lg font-semibold">Visualization</h3>
                <HelpCircle size={16} className="text-gray-400" />
              </div>

              {/* Tab Navigation */}
              <div className="flex gap-6 mb-6 border-b border-gray-200">
                {['bar', 'block', 'tree', 'treemap', 'flower'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-3 px-1 font-medium transition-colors capitalize text-sm ${
                      activeTab === tab
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab === 'bar' ? 'Bar' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Bar Chart Visualization */}
              <div className="h-96 flex items-end justify-around gap-3 px-4">
                {mockData.map((item, idx) => {
                  const maxHeight = 320;
                  const scale = maxHeight / 450;

                  return (
                    <div key={idx} className="flex flex-col items-center flex-1">
                      <div className="w-full flex flex-col-reverse" style={{ height: `${maxHeight}px` }}>
                        <div
                          className="w-full bg-pink-300 rounded-t transition-all"
                          style={{ height: `${item.pink * scale}px` }}
                        />
                        <div
                          className="w-full bg-green-300"
                          style={{ height: `${item.green * scale}px` }}
                        />
                        <div
                          className="w-full bg-blue-400"
                          style={{ height: `${item.blue * scale}px` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 mt-3">{item.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Folder Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-6">
                <h3 className="text-xl font-semibold">Folder summary</h3>
                <HelpCircle size={16} className="text-gray-400" />
              </div>

              {/* Two-column grid with vertical divider */}
              <div className="grid grid-cols-2 gap-x-16 gap-y-4 relative">
                {/* vertical divider */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-200 -translate-x-1/2"></div>

                {Object.entries(summaryData).map(([key, value], index) => (
                  <div
                    key={key}
                    className={`flex justify-between items-center pb-3 ${
                      index % 2 === 0 ? 'pr-8' : 'pl-8'
                    }`}
                  >
                    <span className="text-gray-700 text-sm font-medium">{key}</span>
                    <span className="text-gray-900 font-bold text-lg">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Second Divider */}
          <div 
            className="flex items-center justify-center cursor-col-resize hover:bg-blue-100 transition-colors group relative z-10"
            style={{ width: '12px', flexShrink: 0 }}
            onMouseDown={() => handleMouseDown('second')}
          >
            <div className="h-full w-1 bg-gray-200 group-hover:bg-blue-400 transition-colors"></div>
            <GripVertical size={16} className="absolute text-gray-400 group-hover:text-blue-600" />
          </div>

          {/* Right Panel - Raw Code */}
          <div style={{ width: `${100 - graphWidth - visualizationWidth}%` }} className="pl-3">
            <div className="bg-gray-100 rounded-lg shadow p-4 h-full min-h-[500px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Raw code</h3>
                <button className="text-gray-400 hover:text-gray-600">
                  <Expand size={20} />
                </button>
              </div>
              <div className="bg-white rounded-lg p-4 flex-1 overflow-auto">
                <p className="text-gray-400 text-sm">Select a file to view its contents...</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default HomePage;