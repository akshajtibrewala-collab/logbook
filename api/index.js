// Vercel serverless entry: the whole Express app runs as one function.
// vercel.json rewrites /api/* to this file, and Express does its own routing from there.
import { app } from '../server/src/app.js';

export default app;
