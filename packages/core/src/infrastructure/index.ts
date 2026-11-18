// Camada de infraestrutura: implementa as portas (zod, IndexedDB, dagre, PromptRenderer).
// Conteúdo real a partir da L03.
import { APPLICATION_LAYER } from '../application/index.ts';
import { DOMAIN_LAYER } from '../domain/index.ts';

export const INFRASTRUCTURE_LAYER = 'infrastructure' as const;
export const INFRASTRUCTURE_DEPENDS_ON = [DOMAIN_LAYER, APPLICATION_LAYER] as const;
