// Camada de aplicação: casos de uso e portas. Depende só de domain.
// Conteúdo real a partir da L02 (SPEC §7.1, §7.2).
import { DOMAIN_LAYER } from '../domain/index.ts';

export const APPLICATION_LAYER = 'application' as const;
export const APPLICATION_DEPENDS_ON = [DOMAIN_LAYER] as const;
