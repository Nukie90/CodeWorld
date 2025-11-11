import React from 'react'

const visualizationTypes = [
  { id: 'circle', label: 'Circle Packing' },
  { id: 'bar', label: 'Complexity Bars'},
  { id: 'treemap', label: 'Treemap'},
  { id: 'tree', label: 'Force Tree' },
  // { id: 'interactive', label: 'Interactive Packing' },
  { id: 'radar', label: 'Radar Chart' }
]

function FolderVisualizationSelector({ currentType = 'circle', onTypeChange = () => {} }) {
  return (
    <div className="visualization-selector" role="tablist" aria-label="Visualization types">
      <span className="visualization-label">View as:</span>
      <div className="visualization-buttons">
        {visualizationTypes.map(type => (
          <button
            key={type.id}
            role="tab"
            aria-selected={currentType === type.id}
            className={`viz-button ${currentType === type.id ? 'active' : ''}`}
            onClick={() => onTypeChange(type.id)}
            title={type.label}
          >
            <span className="viz-icon" aria-hidden>{type.icon}</span>
            <span className="viz-text">{type.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default FolderVisualizationSelector
