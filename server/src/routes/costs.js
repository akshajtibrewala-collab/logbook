import { Router } from 'express';
import { all, get, run } from '../db.js';
import {
  parseHourlyRate, parseAircraftRate, parseExpense, parseGroundSession, parseTrainingPhase,
} from '../validate.js';

const router = Router();

// instructor_rates, ground_rates and simulator_rates are all shaped exactly alike (effective_date,
// hourly_rate), so one small router factory serves all three instead of three near-identical copies.
function hourlyRateRouter(table) {
  const sub = Router();
  sub.get('/', async (_req, res) => {
    res.json(await all(`SELECT * FROM ${table} ORDER BY effective_date`));
  });
  sub.post('/', async (req, res) => {
    const { value, errors } = parseHourlyRate(req.body);
    if (errors) return res.status(400).json({ errors });
    const { lastId } = await run(`INSERT INTO ${table} (effective_date, hourly_rate) VALUES (:effective_date, :hourly_rate)`, value);
    res.status(201).json(await get(`SELECT * FROM ${table} WHERE id = ?`, [lastId]));
  });
  sub.put('/:id', async (req, res) => {
    const { value, errors } = parseHourlyRate(req.body);
    if (errors) return res.status(400).json({ errors });
    const { changes } = await run(
      `UPDATE ${table} SET effective_date = :effective_date, hourly_rate = :hourly_rate WHERE id = :id`,
      { ...value, id: req.params.id },
    );
    if (!changes) return res.status(404).json({ error: 'Rate not found' });
    res.json(await get(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]));
  });
  sub.delete('/:id', async (req, res) => {
    const { changes } = await run(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
    if (!changes) return res.status(404).json({ error: 'Rate not found' });
    res.status(204).end();
  });
  return sub;
}

router.use('/rates/instructor', hourlyRateRouter('instructor_rates'));
router.use('/rates/ground', hourlyRateRouter('ground_rates'));
router.use('/rates/simulator', hourlyRateRouter('simulator_rates'));

router.get('/rates/aircraft', async (_req, res) => {
  res.json(await all('SELECT * FROM aircraft_rates ORDER BY aircraft_id, effective_date'));
});
router.post('/rates/aircraft', async (req, res) => {
  const { value, errors } = parseAircraftRate(req.body);
  if (errors) return res.status(400).json({ errors });
  const { lastId } = await run(
    'INSERT INTO aircraft_rates (aircraft_id, effective_date, rental_rate_per_hr, fuel_surcharge_per_hr) VALUES (:aircraft_id, :effective_date, :rental_rate_per_hr, :fuel_surcharge_per_hr)',
    value,
  );
  res.status(201).json(await get('SELECT * FROM aircraft_rates WHERE id = ?', [lastId]));
});
router.put('/rates/aircraft/:id', async (req, res) => {
  const { value, errors } = parseAircraftRate(req.body);
  if (errors) return res.status(400).json({ errors });
  const { changes } = await run(
    'UPDATE aircraft_rates SET aircraft_id = :aircraft_id, effective_date = :effective_date, rental_rate_per_hr = :rental_rate_per_hr, fuel_surcharge_per_hr = :fuel_surcharge_per_hr WHERE id = :id',
    { ...value, id: req.params.id },
  );
  if (!changes) return res.status(404).json({ error: 'Rate not found' });
  res.json(await get('SELECT * FROM aircraft_rates WHERE id = ?', [req.params.id]));
});
router.delete('/rates/aircraft/:id', async (req, res) => {
  const { changes } = await run('DELETE FROM aircraft_rates WHERE id = ?', [req.params.id]);
  if (!changes) return res.status(404).json({ error: 'Rate not found' });
  res.status(204).end();
});

router.get('/expenses', async (_req, res) => {
  res.json(await all('SELECT * FROM other_expenses ORDER BY date DESC, id DESC'));
});
router.post('/expenses', async (req, res) => {
  const { value, errors } = parseExpense(req.body);
  if (errors) return res.status(400).json({ errors });
  const { lastId } = await run(
    'INSERT INTO other_expenses (category, date, amount, note) VALUES (:category, :date, :amount, :note)', value,
  );
  res.status(201).json(await get('SELECT * FROM other_expenses WHERE id = ?', [lastId]));
});
router.put('/expenses/:id', async (req, res) => {
  const { value, errors } = parseExpense(req.body);
  if (errors) return res.status(400).json({ errors });
  const { changes } = await run(
    'UPDATE other_expenses SET category = :category, date = :date, amount = :amount, note = :note WHERE id = :id',
    { ...value, id: req.params.id },
  );
  if (!changes) return res.status(404).json({ error: 'Expense not found' });
  res.json(await get('SELECT * FROM other_expenses WHERE id = ?', [req.params.id]));
});
router.delete('/expenses/:id', async (req, res) => {
  const { changes } = await run('DELETE FROM other_expenses WHERE id = ?', [req.params.id]);
  if (!changes) return res.status(404).json({ error: 'Expense not found' });
  res.status(204).end();
});

router.get('/ground-sessions', async (_req, res) => {
  res.json(await all('SELECT * FROM ground_sessions ORDER BY date DESC, id DESC'));
});
router.post('/ground-sessions', async (req, res) => {
  const { value, errors } = parseGroundSession(req.body);
  if (errors) return res.status(400).json({ errors });
  const { lastId } = await run(
    'INSERT INTO ground_sessions (date, hours, instructor, topics, notes) VALUES (:date, :hours, :instructor, :topics, :notes)', value,
  );
  res.status(201).json(await get('SELECT * FROM ground_sessions WHERE id = ?', [lastId]));
});
router.put('/ground-sessions/:id', async (req, res) => {
  const { value, errors } = parseGroundSession(req.body);
  if (errors) return res.status(400).json({ errors });
  const { changes } = await run(
    'UPDATE ground_sessions SET date = :date, hours = :hours, instructor = :instructor, topics = :topics, notes = :notes WHERE id = :id',
    { ...value, id: req.params.id },
  );
  if (!changes) return res.status(404).json({ error: 'Ground session not found' });
  res.json(await get('SELECT * FROM ground_sessions WHERE id = ?', [req.params.id]));
});
router.delete('/ground-sessions/:id', async (req, res) => {
  const { changes } = await run('DELETE FROM ground_sessions WHERE id = ?', [req.params.id]);
  if (!changes) return res.status(404).json({ error: 'Ground session not found' });
  res.status(204).end();
});

router.get('/phases', async (_req, res) => {
  res.json(await all('SELECT * FROM training_phases ORDER BY start_date'));
});
// Upsert by certificate (UNIQUE) — a certificate has exactly one training-phase date range.
router.put('/phases/:certificate', async (req, res) => {
  const { value, errors } = parseTrainingPhase({ ...req.body, certificate: req.params.certificate });
  if (errors) return res.status(400).json({ errors });
  const existing = await get('SELECT id FROM training_phases WHERE certificate = ?', [value.certificate]);
  if (existing) {
    await run('UPDATE training_phases SET start_date = :start_date, end_date = :end_date WHERE certificate = :certificate', value);
  } else {
    await run('INSERT INTO training_phases (certificate, start_date, end_date) VALUES (:certificate, :start_date, :end_date)', value);
  }
  res.json(await get('SELECT * FROM training_phases WHERE certificate = ?', [value.certificate]));
});
router.delete('/phases/:certificate', async (req, res) => {
  const { changes } = await run('DELETE FROM training_phases WHERE certificate = ?', [req.params.certificate]);
  if (!changes) return res.status(404).json({ error: 'Training phase not found' });
  res.status(204).end();
});

export default router;
