import type { OpeningHours } from '../types/database';

export const DEFAULT_OPENING_HOURS: OpeningHours = {
  mon: { open: '08:00', close: '21:00' },
  tue: { open: '08:00', close: '21:00' },
  wed: { open: '08:00', close: '21:00' },
  thu: { open: '08:00', close: '21:00' },
  fri: { open: '08:00', close: '21:00' },
  sat: { open: '08:00', close: '21:00' },
  sun: { open: '09:00', close: '20:00' },
};

export const OPENING_DAYS = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const;
