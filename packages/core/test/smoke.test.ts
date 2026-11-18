import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';

describe('core (scaffold L00)', () => {
  it('expõe as três camadas na ordem de dependência', () => {
    expect(core.DOMAIN_LAYER).toBe('domain');
    expect(core.APPLICATION_DEPENDS_ON).toEqual(['domain']);
    expect(core.INFRASTRUCTURE_DEPENDS_ON).toEqual(['domain', 'application']);
  });
});
