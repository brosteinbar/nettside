import { useLoginForm } from '../hooks/useLoginForm'

export function LoginForm({ onSuccess, formClassName = 'modal-form', submitClassName = 'modal-submit' }) {
  const { email, setEmail, password, setPassword, error, loading, handleSubmit } = useLoginForm(onSuccess)

  return (
    <form className={formClassName} onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="E-post"
        value={email}
        onChange={e => setEmail(e.target.value)}
        autoFocus
        required
      />
      <input
        type="password"
        placeholder="Passord"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      {error && <div className="form-error">{error}</div>}
      <button type="submit" className={submitClassName} disabled={loading}>
        {loading ? 'Logger inn…' : 'Logg inn'}
      </button>
    </form>
  )
}
