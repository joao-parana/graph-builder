// Adaptadores da nuvem (ADR-0004). Carregado por `import()` só quando o build tem o Supabase
// (§9.3): sem as variáveis, o `supabase-js` não entra no código que o app baixa.
import {
  createCloudClient,
  SupabaseAuthGateway,
  SupabaseGraphRepository,
} from '@graph-builder/core';
import type { CloudServices } from '#lib/state/session.svelte.ts';
import { type CloudConfig, redirectTo } from './config.ts';

export function cloudServices(config: CloudConfig): CloudServices {
  const client = createCloudClient(config.url, config.key);
  return {
    gateway: new SupabaseAuthGateway(client, redirectTo(window.location.origin)),
    repo: new SupabaseGraphRepository(client),
  };
}
