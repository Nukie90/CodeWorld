import React, { useState } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';
import './RadarChartVisualization.css';

// Normalize value to 0-100 scale
const normalizeValue = (value, maxValue) => {
  return (value / maxValue) * 100;
};

function RadarChartVisualization({ individualFiles }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [filesPerPage, setFilesPerPage] = useState(5);
  const [zoomLevel, setZoomLevel] = useState(150);
  
  // Find maximum values for normalization
  const maxValues = {
    lloc: Math.max(...individualFiles.map(f => f.total_lloc || f.total_loc || 0)),
    complexity: Math.max(...individualFiles.map(f => f.total_complexity || 0)),
    functions: Math.max(...individualFiles.map(f => f.function_count || 0)),
    maxComplexity: Math.max(...individualFiles.map(f => f.complexity_max || 0)),
    avgFunctionSize: Math.max(...individualFiles.map(f => 
      f.total_lloc && f.function_count ? f.total_lloc / f.function_count : 0
    ))
  };

  // Process data for visualization
  const chartData = individualFiles.map(file => ({
    name: file.filename,
    'Lines of Code': normalizeValue(file.total_lloc || file.total_loc || 0, maxValues.lloc),
    'Avg Complexity': normalizeValue(file.total_complexity || 0, maxValues.complexity),
    'Function Count': normalizeValue(file.function_count || 0, maxValues.functions),
    'Max Complexity': normalizeValue(file.complexity_max || 0, maxValues.maxComplexity),
    'Avg Function Size': normalizeValue(
      file.total_lloc && file.function_count ? file.total_lloc / file.function_count : 0,
      maxValues.avgFunctionSize
    ),
    // Store original values for tooltip
    original: {
      'Lines of Code': file.total_lloc || file.total_loc || 0,
      'Avg Complexity': file.total_complexity || 0,
      'Function Count': file.function_count || 0,
      'Max Complexity': file.complexity_max || 0,
      'Avg Function Size': file.total_lloc && file.function_count 
        ? Math.round((file.total_lloc / file.function_count) * 10) / 10 
        : 0
    }
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="radar-tooltip" style={{
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}>
          <p style={{ margin: '0 0 5px' }}><strong>{data.name}</strong></p>
          {Object.entries(data.original).map(([key, value]) => (
            <p key={key} style={{ margin: '2px 0' }}>
              {key}: {value.toFixed(1)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Pagination logic
  const totalPages = Math.ceil(individualFiles.length / filesPerPage);
  const startIndex = currentPage * filesPerPage;
  const paginatedData = chartData.slice(startIndex, startIndex + filesPerPage);

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
  };

  return (
    <div>
      <div className="radar-controls">
        <div className="zoom-control">
          <label>Zoom:</label>
          <input
            type="range"
            min="50"
            max="250"
            value={zoomLevel}
            onChange={(e) => setZoomLevel(Number(e.target.value))}
          />
        </div>
        <div className="files-per-page">
          <label>Files per view:</label>
          <select 
            value={filesPerPage}
            onChange={(e) => {
              setFilesPerPage(Number(e.target.value));
              setCurrentPage(0); // Reset to first page when changing files per page
            }}
          >
            <option value={3}>3 files</option>
            <option value={5}>5 files</option>
            <option value={8}>8 files</option>
            <option value={10}>10 files</option>
          </select>
        </div>
        <div className="file-pagination">
          <button 
            onClick={handlePrevPage}
            disabled={currentPage === 0}
          >
            Previous
          </button>
          <span>Page {currentPage + 1} of {totalPages}</span>
          <button
            onClick={handleNextPage}
            disabled={currentPage >= totalPages - 1}
          >
            Next
          </button>
        </div>
      </div>
      
      <div style={{ width: '100%', height: '500px' }}>
        <ResponsiveContainer>
          <RadarChart outerRadius={zoomLevel} data={paginatedData}>
            <PolarGrid />
          <PolarAngleAxis dataKey="name" tick={{ fill: '#666', fontSize: 12 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} />
          
          <Radar
            name="Lines of Code"
            dataKey="Lines of Code"
            stroke="#8884d8"
            fill="#8884d8"
            fillOpacity={0.5}
          />
          <Radar
            name="Avg Complexity"
            dataKey="Avg Complexity"
            stroke="#82ca9d"
            fill="#82ca9d"
            fillOpacity={0.5}
          />
          <Radar
            name="Function Count"
            dataKey="Function Count"
            stroke="#ffc658"
            fill="#ffc658"
            fillOpacity={0.5}
          />
          <Radar
            name="Max Complexity"
            dataKey="Max Complexity"
            stroke="#ff7300"
            fill="#ff7300"
            fillOpacity={0.5}
          />
          <Radar
            name="Avg Function Size"
            dataKey="Avg Function Size"
            stroke="#0088fe"
            fill="#0088fe"
            fillOpacity={0.5}
          />
          
          <Tooltip content={<CustomTooltip />} />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
    </div>
  );
}

export default RadarChartVisualization;