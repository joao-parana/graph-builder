// Relógio e gerador de IDs do navegador (portas Clock e IdGenerator, SPEC §7.1).
import type { Clock, IdGenerator } from '../application/index.ts';

export const systemClock: Clock = { now: () => new Date().toISOString() };

export const randomIds: IdGenerator = { next: () => crypto.randomUUID() };
