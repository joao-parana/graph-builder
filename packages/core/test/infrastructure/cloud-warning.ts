// globalSetup do Vitest: roda uma vez no processo principal, onde o aviso não é descartado.
import { readStatus } from './supabase-local.ts';

export default function warnWhenCloudIsDown(): void {
  if (readStatus() === null) {
    console.warn(
      '\n[nuvem] Supabase local fora do ar: testes da nuvem pulados e cobertura sem valor de gate.' +
        '\n        Rode `bun run db:start` (Docker) antes do gate.\n',
    );
  }
}
