import React from 'react'
import CirclePackingVisualization from './visualizations/CirclePackingVisualization'
import TreemapVisualization from './visualizations/TreemapVisualization'
import ForceTreeVisualization from './visualizations/ForceTreeVisualization'
import FlowerTreeVisualization from './visualizations/FlowerTreeVisualization'
import FolderVisualizationSelector from './FolderVisualizationSelector'
import InfoTip from '../common/InfoTip'
import './FolderVisualization.css'

const VISUALIZATION_HELP = {
  circle: "Circle packing visualization: The large hollow circle represents the folder. Inner circles represent files, sized by logical LOC (nloc) and colored by average complexity (green: low, red: high). Hover for details.",
  treemap: "Treemap visualization: Each rectangle represents a file, where the size shows the logical LOC and the color indicates average complexity (green: low, red: high). Hover for details.",
  tree: "Interactive tree visualization: Shows folder structure with files and functions. Nodes can be dragged, zoomed, and expanded/collapsed. Icons indicate type (📁 folder, 📄 file, ƒ function). Colors show complexity.",
  flower: "Flower tree visualization: Files are shown as stems with flowers representing functions. Flower size indicates lines of code, color shows complexity (red: high, pink: medium, white: low). Hover for details."
}

function FolderVisualization({ individualFiles, folderName }) {
  const [visualizationType, setVisualizationType] = React.useState('circle')

  const renderVisualization = () => {
    switch (visualizationType) {
      case 'circle':
        return (
          <CirclePackingVisualization 
            individualFiles={individualFiles}
            folderName={folderName}
          />
        )
      case 'treemap':
        return (
          <TreemapVisualization
            individualFiles={individualFiles}
            folderName={folderName}
          />
        )
      case 'tree':
        return (
          <ForceTreeVisualization
            individualFiles={individualFiles}
            folderName={folderName}
          />
        )
      case 'flower':
        return (
          <FlowerTreeVisualization
            individualFiles={individualFiles}
            folderName={folderName}
          />
        )
      default:
        return <div>Visualization type not implemented</div>
    }
  }

  if (!individualFiles?.length) return null

  return (
    <section className="results-card">
      <h2>Complexity Visualization</h2>
      <InfoTip text="Circle packing visualization: The large hollow circle represents the folder. Inner circles represent files, sized by logical LOC (nloc) and colored by average complexity (green: low, red: high). Hover for details." ariaLabel="Help: Complexity Visualization" />
        <section className="results-card">
        <div className="visualization-header">
            <h2>Complexity Visualization</h2>
            <FolderVisualizationSelector
            currentType={visualizationType}
            onTypeChange={setVisualizationType}
            />
        </div>
        <InfoTip 
            text={VISUALIZATION_HELP[visualizationType]} 
            ariaLabel={`Help: ${visualizationType} Visualization`}
        />
        {renderVisualization()}
        </section>
    </section>
  )
}

export default FolderVisualization
