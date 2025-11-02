import React from 'react'

const visualizationTypes = [
  { id: 'circle', label: 'Circle Packing' },
  { id: 'treemap', label: 'Treemap' },
  // Add more visualization types here as they are implemented
  // Example: { id: 'sunburst', label: 'Sunburst' },
]

function FolderVisualizationSelector({ currentType, onTypeChange }) {
  return (
    <div className="visualization-selector">
      <span className="visualization-label">View as: </span>
      <div className="visualization-buttons">
        {visualizationTypes.map(type => (
          <button
            key={type.id}
            className={`viz-button ${currentType === type.id ? 'active' : ''}`}
            onClick={() => onTypeChange(type.id)}
          >
            {type.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default FolderVisualizationSelector
