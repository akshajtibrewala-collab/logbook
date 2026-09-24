import express from 'express';
import { passcodeOk, passcodeRequired, requirePasscode } from './auth.js';
import flights from './routes/flights.js';
import reviews from './routes/reviews.js';
import airports from './routes/airports.js';
import aircraft from './routes/aircraft.js';
import milestones from './routes/milestones.js';
import milestoneCompletions from './routes/milestone-completions.js';
import expirations from './routes/expirations.js';
import backup from './routes/backup.js';
import settings from './routes/settings.js';
import weather from './routes/weather.js';
import costs from './routes/costs.js';
import { cronRouter, backupJobRouter } from './routes/backup-job.js';
import photos from './routes/photos.js';
import { shareAdminRouter, publicRouter } from './routes/share.js';

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '3mb' })); // hosted functions cap request bodies at about 4.5 MB
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// Public: liveness, and whether the client needs to ask for a passcode.
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/session', (req, res) => res.json({ required: passcodeRequired(), ok: passcodeOk(req) }));

// The scheduled backup authenticates with its own CRON_SECRET (Vercel Cron sends it), not the app passcode.
app.use('/api/cron', cronRouter);

// The read-only public summary authenticates with its own unguessable share token, not the app passcode.
app.use('/api/public', publicRouter);

app.use('/api', requirePasscode);
app.use('/api/flights', flights);
app.use('/api/reviews', reviews);
app.use('/api/airports', airports);
app.use('/api/aircraft', aircraft);
app.use('/api/milestones', milestones);
app.use('/api/milestone-completions', milestoneCompletions);
app.use('/api/expirations', expirations);
app.use('/api/backup', backup);
app.use('/api/settings', settings);
app.use('/api/weather', weather);
app.use('/api/costs', costs);
app.use('/api/backup-job', backupJobRouter);
app.use('/api/photos', photos);
app.use('/api/share', shareAdminRouter);

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
