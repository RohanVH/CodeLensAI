const TourGuide = ({ show, step, totalSteps, rect, onNext, onSkip }) => {
  if (!show || !step || !rect) return null

  const cardTop = Math.min(window.innerHeight - 190, rect.bottom + 16)
  const cardLeft = Math.min(window.innerWidth - 360, Math.max(12, rect.left))

  return (
    <>
      <div className="tour-overlay" />
      <div
        className="tour-highlight"
        style={{
          top: rect.top - 8,
          left: rect.left - 8,
          width: rect.width + 16,
          height: rect.height + 16,
        }}
      />
      <aside className="tour-card" style={{ top: cardTop, left: cardLeft }}>
        <p className="tour-step">Step {step.index + 1} of {totalSteps}</p>
        <h4>{step.title}</h4>
        <p>{step.description}</p>
        <div className="tour-actions">
          <button type="button" onClick={onNext} className="tour-next">
            {step.index === totalSteps - 1 ? 'Finish' : 'Next'}
          </button>
          <button type="button" onClick={onSkip} className="tour-skip">
            Skip
          </button>
        </div>
      </aside>
    </>
  )
}

export default TourGuide
