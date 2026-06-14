import ReactDOM from 'react-dom/client';
import App from './App';

// Note: no <React.StrictMode> here on purpose. StrictMode double-invokes effects
// in dev, which would create two Spotify Web Playback "RadioDJ" devices and make
// the player's device id ambiguous. The imperative SDK lifecycle wants a single
// mount.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
