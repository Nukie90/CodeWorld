import React, { useState } from 'react';

function BarChartVisualization({ individualFiles, onFunctionClick, onFileClick, fixedFileOrder, isDarkMode }) {
  const [hoveredFunction, setHoveredFunction] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  if (!individualFiles || individualFiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No files to visualize
      </div>
    );
  }

  // Calculate max height for scaling (max total lloc across all files)
  const maxTotalLloc = Math.max(
    ...individualFiles.map(file => {
      const functions = file.functions || [];
      return functions.reduce((sum, fn) => sum + (fn.lloc || 0), 0);
    }),
    1
  );

  // Calculate complexity range for color scaling
  const allComplexities = [];
  individualFiles.forEach(file => {
    const functions = file.functions || [];
    functions.forEach(fn => {
      if (fn.cyclomatic_complexity !== undefined && fn.cyclomatic_complexity !== null) {
        allComplexities.push(fn.cyclomatic_complexity);
      }
      if (fn.cognitive_complexity !== undefined && fn.cognitive_complexity !== null) {
        allComplexities.push(fn.cognitive_complexity);
      }
    });
  });

  const minComplexity = allComplexities.length > 0 ? Math.min(...allComplexities) : 1;
  const maxComplexity = allComplexities.length > 0 ? Math.max(...allComplexities) : 10;

  // Color scale: green (low) to red (high)
  const getComplexityColor = (complexity) => {
    if (complexity === undefined || complexity === null) {
      return '#9ca3af'; // gray for undefined
    }
    // Discrete bands for complexity (Low = Good, High = Bad)
    if (isDarkMode) {
      if (complexity >= 20) return '#ef4444'; // Red (Bad)
      if (complexity >= 15) return '#ec4899'; // Pink
      if (complexity >= 10) return '#a855f7'; // Purple
      return '#06b6d4'; // Cyan (Good)
    } else {
      if (complexity >= 20) return '#ef4444'; // Bright Red
      if (complexity >= 15) return '#f97316'; // Bright Orange
      if (complexity >= 10) return '#facc15'; // Bright Yellow
      return '#22c55e'; // Bright Green (Good)
    }
  };

  const barWidth = '60px';

  const handleMouseEnter = (event, functionData) => {
    setHoveredFunction(functionData);
    setTooltipPosition({
      x: event.clientX,
      y: event.clientY
    });
  };

  const handleMouseMove = (event) => {
    if (hoveredFunction) {
      setTooltipPosition({
        x: event.clientX,
        y: event.clientY
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredFunction(null);
  };

  return (
    <div className="relative w-full h-full overflow-x-auto flex flex-col justify-end">
      <div className="inline-flex min-w-full h-full items-end pb-8">
        <div
          className="flex items-end justify-start gap-3 px-4 h-full"
          onMouseMove={handleMouseMove}
        >
          {(fixedFileOrder || individualFiles).map((baseFile, fileIdx) => {
            const fileName = baseFile.filename;
            // Find current file data if it exists
            const file = individualFiles.find(f => f.filename === fileName);
            const functions = file?.functions || [];

            // Calculate total LLOC for this file to normalize local bar heights
            const fileTotalLloc = functions.reduce((sum, fn) => sum + (fn.lloc || 0), 0);
            const fileHeightPercentage = (fileTotalLloc / maxTotalLloc) * 100;

            return (
              <div
                key={baseFile.filename || fileIdx}
                className="flex flex-col items-center justify-end flex-shrink-0 transition-all duration-500 ease-in-out group h-full justify-end"
                style={{ width: barWidth }}
              >
                <div
                  className="w-full flex flex-col-reverse relative"
                  style={{ height: `${Math.max(fileHeightPercentage, 1)}%`, minHeight: '1px' }}
                >
                  {functions.map((fn, fnIdx) => {
                    const fnHeightPercentage = fileTotalLloc > 0 ? ((fn.lloc || 0) / fileTotalLloc) * 100 : 0;
                    // const complexity = fn.cyclomatic_complexity;
                    const complexity = fn.total_cognitive_complexity;
                    const color = getComplexityColor(complexity);

                    return (
                      <div
                        key={fn.name || fnIdx}
                        className="w-full transition-all duration-500 ease-in-out cursor-pointer hover:opacity-80"
                        style={{
                          height: `${fnHeightPercentage}%`,
                          backgroundColor: color
                        }}
                        onMouseEnter={(e) => handleMouseEnter(e, {
                          name: fn.name || 'Unknown',
                          cc: complexity !== undefined && complexity !== null ? complexity : 'N/A',
                          lloc: fn.lloc || 0
                        })}
                        onMouseLeave={handleMouseLeave}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent duplicate calls if we add file click handler

                          // Trigger file selection for detailed view
                          if (onFileClick && file) {
                            onFileClick(file);
                          }

                          if (onFunctionClick && fn.start_line && file) {
                            onFunctionClick({
                              filename: file.filename,
                              functionName: fn.name || 'Unknown',
                              startLine: fn.start_line,
                              lloc: fn.lloc || 0,
                              complexity: complexity
                            });
                          }
                        }}
                      />
                    );
                  })}
                  {file && functions.length === 0 && (
                    // Placeholder for empty files
                    <div
                      className="w-full bg-gray-200 rounded-t"
                      style={{ height: '2px' }}
                    />
                  )}
                </div>

                {/* File Label */}
                <span
                  className="text-xs text-gray-500 text-center break-words mt-2 w-full truncate block"
                  title={fileName}
                >
                  {fileName?.split('/').pop() || `File ${fileIdx + 1}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tooltip */}
      {hoveredFunction && (
        <div
          className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-3 pointer-events-none"
          style={{
            left: `${tooltipPosition.x + 10}px`,
            top: `${tooltipPosition.y - 10}px`,
            transform: 'translateY(-100%)'
          }}
        >
          <div className="text-sm">
            <div className="font-semibold text-gray-900 mb-1">
              {hoveredFunction.name}
            </div>
            <div className="text-gray-600">
              <div>CC: <span className="font-medium">{hoveredFunction.cc}</span></div>
              <div>lloc: <span className="font-medium">{hoveredFunction.lloc}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BarChartVisualization;

