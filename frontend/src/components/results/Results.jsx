import React from 'react'
import SingleFileResults from './SingleFileResults'
import FolderResults from './FolderResults'

function Results({ analysisResult, onBack }) {
  if (!analysisResult) return null
  const isFolder = analysisResult.analysis?.folder_metrics !== undefined
  return isFolder ? (
    <FolderResults analysisResult={analysisResult} onBack={onBack} />
  ) : (
    <SingleFileResults analysisResult={analysisResult} onBack={onBack} />
  )
}

export default Results 