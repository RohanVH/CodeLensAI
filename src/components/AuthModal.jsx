const AuthModal = ({ open, onClose, onLogin, loading }) => {
  if (!open) return null

  return (
    <div className="auth-modal-backdrop" role="dialog" aria-modal="true" aria-label="Authentication">
      <div className="auth-modal">
        <div className="auth-modal-head">
          <h3>Sign in to CodeLensAI</h3>
          <button type="button" className="auth-close" onClick={onClose}>
            Close
          </button>
        </div>
        <p>Login to continue with CodeLensAI.</p>
        <div className="auth-actions">
          <button type="button" className="oauth-btn google" onClick={() => onLogin('google')} disabled={loading}>
            Continue with Google
          </button>
          <button type="button" className="oauth-btn github" onClick={() => onLogin('github')} disabled={loading}>
            Continue with GitHub
          </button>
        </div>
      </div>
    </div>
  )
}

export default AuthModal
