// Local development server. In production the API runs as a Vercel function (see /api/index.js).
import { app } from './app.js';
import { migrate } from './migrate.js';

await migrate();
const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API listening on :${port}`));
