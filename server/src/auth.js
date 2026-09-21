import { createHash, timingSafeEqual } from 'node:crypto';

// Optional shared passcode. When APP_PASSCODE is set (do this for any public deployment) every API call
// except /api/health and /api/session must send it in the x-app-passcode header. When it is not set
// (local development) the API is open.
const digest = (s) => createHash('sha256').update(String(s)).digest();

export const passcodeRequired = () => Boolean(process.env.APP_PASSCODE);

export function passcodeOk(req) {
  const expected = process.env.APP_PASSCODE;
  if (!expected) return true;
  const given = req.get('x-app-passcode');
  return typeof given === 'string' && timingSafeEqual(digest(given), digest(expected));
}

export function requirePasscode(req, res, next) {
  if (passcodeOk(req)) return next();
  res.status(401).json({ error: 'Passcode required' });
}
