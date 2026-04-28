import { LoginForm } from './LoginForm'
import './LoginModal.css'

export default function LoginModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2 className="modal-title">Innlogging</h2>
        <LoginForm onSuccess={onClose} />
      </div>
    </div>
  )
}
