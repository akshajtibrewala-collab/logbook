import express from 'express';
import { passcodeOk, passcodeRequired, requirePasscode } from './auth.js';
import flights from './routes/flights.js';
import reviews from './routes/reviews.js';
import airports from './routes/airports.js';

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '3mb' })); // hosted functions cap request bodies at about 4.5 MB
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// Public: liveness, and whether the client needs to ask for a passcode.
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/session', (req, res) => res.json({ required: passcodeRequired(), ok: passcodeOk(req) }));

app.use('/api', requirePasscode);
app.use('/api/flights', flights);
app.use('/api/reviews', reviews);
app.use('/api/airports', airports);

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
