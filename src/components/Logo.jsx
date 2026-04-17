import logoRaw from '../../resources/img/Brostein_svart.svg?raw'
import './Logo.css'

export default function Logo() {
  return <div className="logo-wrap" dangerouslySetInnerHTML={{ __html: logoRaw }} />
}
