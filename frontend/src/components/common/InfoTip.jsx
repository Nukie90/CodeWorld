import React, { useState, useRef } from 'react'

function InfoTip({ text, ariaLabel }) {
  const [visible, setVisible] = useState(false)
  const tipRef = useRef(null)
  const temp = useState(true)

  return (
    <span
      className="info-tip"
      aria-label={ariaLabel || 'More info'}
      role="button"
      tabIndex={0}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      ref={tipRef}
    >
      <span className="info-tip-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <circle cx="12" cy="8" r="1.2" fill="currentColor" />
          <path d="M11.1 11.5h1.8v5h-1.8z" fill="currentColor" />
        </svg>
      </span>
      {visible && (
        <span className="info-tip-bubble" role="tooltip">
          {text}
        </span>
      )}
    </span>
  )
}

export default InfoTip 