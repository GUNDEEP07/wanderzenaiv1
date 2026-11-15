import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './SiteHeader.css';

/**
 * The site's top bar for content pages (blog, contact, legal, confirmation, 404…), so no page
 * is a dead end (Nov 2026): the logo always goes home; Blog, Pricing, Dashboard or Sign in,
 * and "Plan a trip". `variant="light"` for pages on a cream background.
 */
export default function SiteHeader({ variant = 'dark' }) {
  let currentUser = null;
  try { ({ currentUser } = useAuth()); } catch { /* rendered outside AuthProvider (tests) */ }
  return (
    <header className={`site-header site-header--${variant}`}>
      <nav className="site-header__inner" aria-label="Main">
        <Link to="/" className="site-header__logo" aria-label="WanderZenAI home">
          <span className="site-header__mark" aria-hidden="true">W</span>
          <span>WanderZenAI</span>
        </Link>
        <div className="site-header__links">
          <Link to="/" className="site-header__link site-header__link--wide">Home</Link>
          <Link to="/blog" className="site-header__link site-header__link--wide">Blog</Link>
          <Link to="/pricing" className="site-header__link site-header__link--wide">Pricing</Link>
          {currentUser
            ? <Link to="/dashboard" className="site-header__link">Dashboard</Link>
            : <Link to="/login" className="site-header__link">Sign in</Link>}
          <Link to="/plan" className="site-header__cta">Plan a trip</Link>
        </div>
      </nav>
    </header>
  );
}
