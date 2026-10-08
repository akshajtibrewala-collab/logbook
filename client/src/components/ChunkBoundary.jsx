import { Component } from 'react';
import { claimAutoReload, isChunkLoadError } from '../lib/chunkRecovery.js';
import Button from './Button.jsx';
import '../ds/states.css';

/**
 * Catches a lazy page that fails to load (a deploy removed the old hashed file) at the route level. The first time it reloads the page once on its own with a
 * short calm "Updated, reloading" note; if that does not help (the guard in sessionStorage allows one automatic reload per 30 s) it shows one clear action,
 * "Couldn't load. Tap to reload". A reload keeps localStorage, so the offline outbox and the log-a-flight draft (keys unchanged) are never lost.
 * Any other render error gets the same single action. `resetKey` (the route) clears the error when the person navigates elsewhere.
 */
export default class ChunkBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null, reloading: false }; this.timer = 0; }

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error) {
    if (isChunkLoadError(error) && claimAutoReload(window.sessionStorage)) {
      this.setState({ reloading: true });
      this.timer = window.setTimeout(() => window.location.reload(), 600); // long enough to read the note, short enough not to feel stuck
    }
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) { window.clearTimeout(this.timer); this.setState({ error: null, reloading: false }); }
  }

  componentWillUnmount() { window.clearTimeout(this.timer); }

  render() {
    const { error, reloading } = this.state;
    if (!error) return this.props.children;
    if (reloading) return <div role="status" className="st-page" style={{ minHeight: '50dvh' }}><p className="st-sub">Updated, reloading…</p></div>;
    return (
      <div role="alert" className="st-page" style={{ minHeight: '50dvh' }}>
        <p className="st-err"><span className="st-dot" aria-hidden="true" />Couldn’t load.</p>
        <Button size="md" fullWidth={false} variant="secondary" onClick={() => window.location.reload()}>Tap to reload</Button>
      </div>
    );
  }
}
