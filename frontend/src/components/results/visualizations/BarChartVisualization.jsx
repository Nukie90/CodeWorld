import React, { useState } from 'react';

function BarChartVisualization({ individualFiles, onFunctionClick, onFileClick, fixedFileOrder }) {
  const [hoveredFunction, setHoveredFunction] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  if (!individualFiles || individualFiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No files to visualize
      </div>
    );
  }

  // Calculate max height for scaling (max total nloc across all files)
  const maxTotalNloc = Math.max(
    ...individualFiles.map(file => {
      const functions = file.functions || [];
      return functions.reduce((sum, fn) => sum + (fn.nloc || 0), 0);
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
    });
  });

  const minComplexity = allComplexities.length > 0 ? Math.min(...allComplexities) : 1;
  const maxComplexity = allComplexities.length > 0 ? Math.max(...allComplexities) : 10;

  // Color scale: green (low) to red (high)
  const getComplexityColor = (complexity) => {
    if (complexity === undefined || complexity === null) {
      return '#9ca3af'; // gray for undefined
    }
    if (maxComplexity === minComplexity) {
      return '#22c55e'; // green if all same
    }
    const normalized = (complexity - minComplexity) / (maxComplexity - minComplexity);
    // Interpolate between green and red
    const red = Math.round(34 + normalized * 221); // 34 (green) to 255 (red)
    const green = Math.round(197 - normalized * 175); // 197 (green) to 22 (red)
    const blue = Math.round(34 - normalized * 12); // 34 (green) to 22 (red)
    return `rgb(${red}, ${green}, ${blue})`;
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

            // Calculate total NLOC for this file to normalize local bar heights
            const fileTotalNloc = functions.reduce((sum, fn) => sum + (fn.nloc || 0), 0);
            const fileHeightPercentage = (fileTotalNloc / maxTotalNloc) * 100;

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
                    // Height of this function relative to the file's total height
                    const fnHeightPercentage = fileTotalNloc > 0 ? ((fn.nloc || 0) / fileTotalNloc) * 100 : 0;

                    const complexity = fn.cyclomatic_complexity;
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
                          nloc: fn.nloc || 0
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
                              nloc: fn.nloc || 0,
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
              <div>nloc: <span className="font-medium">{hoveredFunction.nloc}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BarChartVisualization;

