import React from 'react'
import SingleFileResults from './SingleFileResults'
import FolderResults from './FolderResults'

function Results({ analysisResult, onBack, token, setAnalysisResult }) {
  if (!analysisResult) return null
  const isFolder = analysisResult.analysis?.folder_metrics !== undefined
  return isFolder ? (
    <FolderResults analysisResult={analysisResult} onBack={onBack} token={token} setAnalysisResult={setAnalysisResult} />
  ) : (
    <SingleFileResults analysisResult={analysisResult} onBack={onBack} />
  )
}

export default Results