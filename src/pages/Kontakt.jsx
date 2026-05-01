import './Kontakt.css'

export default function Kontakt() {
  return (
    <div className="kontakt-page">
      <main className="kontakt-main">
        <a className="kontakt-email" href="mailto:dagligleder@brosteinbar.com">
          dagligleder@brosteinbar.com
        </a>
        <p className="kontakt-address">St. Halvardsgate 23</p>
      </main>

      <footer className="kontakt-footer">
        <a href="https://www.instagram.com/brostein.oslo" target="_blank" rel="noopener noreferrer">Instagram</a>
        <span>Facebook</span>
        <span>YouTube</span>
      </footer>
    </div>
  )
}
