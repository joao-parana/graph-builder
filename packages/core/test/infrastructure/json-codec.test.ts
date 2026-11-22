import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { type Graph, NodeKind } from '../../src/domain/index.ts';
import { formatPath, jsonGraphCodec } from '../../src/infrastructure/json-codec.ts';
import { graph, landingPage, node } from '../domain/fixtures.ts';

/** Um grafo com todos os tipos de peça e campos opcionais preenchidos. */
function everyKind(): Graph {
  const base = landingPage();
  return {
    ...base,
    nodes: base.nodes.map((item) =>
      item.kind === NodeKind.Supervisor
        ? { ...item, presets: ['wow', 'explicit-audience'], maxRounds: 5, onExhausted: 'fail' }
        : item,
    ),
    viewport: { x: -120.5, y: 40, zoom: 1.25 },
  };
}

const decode = (value: unknown) => jsonGraphCodec.decode(JSON.stringify(value));

/** Documento válido, para estragar um campo por teste. */
const valid = (): Record<string, unknown> =>
  JSON.parse(jsonGraphCodec.encode(everyKind())) as Record<string, unknown>;

/** Item que o teste sabe que existe (sem `!`, barrado pelo lint). */
function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`sem item ${String(index)}`);
  return item;
}

function issuesOf(text: string) {
  const result = jsonGraphCodec.decode(text);
  if (result.ok) throw new Error('esperava erro');
  return result.error;
}

describe('formatPath', () => {
  it.each([
    [[], '$'],
    [['name'], 'name'],
    [['nodes', 2, 'name'], 'nodes[2].name'],
    [['nodes', 0, 'presets', 1], 'nodes[0].presets[1]'],
    [[0], '[0]'],
  ] as const)('%j → %s', (path, expected) => {
    expect(formatPath(path)).toBe(expected);
  });
});

describe('jsonGraphCodec.encode', () => {
  it('gera JSON com 2 espaços e \\n no fim', () => {
    const text = jsonGraphCodec.encode(landingPage());
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).toContain('\n  "schemaVersion": 1,\n');
  });

  it('não depende da ordem das chaves do objeto', () => {
    const g = everyKind();
    const reverse = <T extends object>(value: T): T =>
      Object.fromEntries(Object.entries(value).reverse()) as T;
    const reordered: Graph = reverse({
      ...g,
      nodes: g.nodes.map((n) => reverse({ ...n, position: reverse(n.position) })),
      edges: g.edges.map(reverse),
      viewport: reverse(g.viewport),
    });
    expect(Object.keys(reordered)[0]).toBe('updatedAt');
    expect(jsonGraphCodec.encode(reordered)).toBe(jsonGraphCodec.encode(g));
  });

  it('omite condition quando o fio não tem', () => {
    const doc = valid() as { edges: Record<string, unknown>[] };
    expect(doc.edges[0]).not.toHaveProperty('condition');
    expect(doc.edges.some((e) => 'condition' in e)).toBe(true);
  });
});

describe('jsonGraphCodec.decode — ida e volta', () => {
  it.each([
    ['landing page', landingPage()],
    ['todos os tipos', everyKind()],
    ['vazio', graph([])],
    ['nome com 80 grafemas', graph([node(NodeKind.Worker, 'w', { name: '👩‍💻'.repeat(80) })])],
  ])('%s: decode(encode(g)) devolve o mesmo grafo', (_, g) => {
    const result = jsonGraphCodec.decode(jsonGraphCodec.encode(g));
    expect(result).toEqual({ ok: true, value: g });
  });

  it('ignora chaves desconhecidas', () => {
    const result = decode({ ...valid(), extra: true });
    expect(result.ok && 'extra' in result.value).toBe(false);
    expect(result.ok).toBe(true);
  });
});

describe('jsonGraphCodec.decode — erros com caminho', () => {
  it('texto que não é JSON → $', () => {
    const [first, ...rest] = issuesOf('{ "name": ');
    expect(rest).toEqual([]);
    expect(first?.path).toBe('$');
    expect(first?.message).toMatch(/^O texto não é um JSON válido/u);
  });

  it.each([['[]'], ['42'], ['null'], ['"grafo"']])('%s não é objeto → $', (text) => {
    expect(issuesOf(text)).toEqual([
      { path: '$', message: 'Esperava um objeto JSON com o grafo.' },
    ]);
  });

  it('sem schemaVersion', () => {
    const doc = valid();
    delete doc['schemaVersion'];
    expect(issuesOf(JSON.stringify(doc))).toEqual([
      { path: 'schemaVersion', message: 'Falta o campo schemaVersion.' },
    ]);
  });

  it.each([[2], ['1'], [0]])('schemaVersion %j não suportada', (version) => {
    const issues = issuesOf(JSON.stringify({ ...valid(), schemaVersion: version }));
    expect(issues).toEqual([
      {
        path: 'schemaVersion',
        message: `Versão ${JSON.stringify(version)} não suportada; este app lê a versão 1.`,
      },
    ]);
  });

  type Doc = Record<string, unknown> & {
    nodes: Record<string, unknown>[];
    edges: Record<string, unknown>[];
    viewport: Record<string, unknown>;
  };
  const supervisorIndex = everyKind().nodes.findIndex((n) => n.kind === NodeKind.Supervisor);
  const memoryIndex = everyKind().nodes.findIndex((n) => n.kind === NodeKind.Memory);

  const cases: readonly [string, (doc: Doc) => void, string, string?][] = [
    ['nome do grafo vazio', (d) => (d['name'] = '  '), 'name', 'O nome não pode ficar vazio.'],
    [
      'nome da peça vazio',
      (d) => (at(d.nodes, 1)['name'] = ''),
      'nodes[1].name',
      'O nome não pode ficar vazio.',
    ],
    [
      'nome com 81 grafemas',
      (d) => (at(d.nodes, 0)['name'] = 'a'.repeat(81)),
      'nodes[0].name',
      'O nome passa de 80 caracteres.',
    ],
    ['tipo de peça desconhecido', (d) => (at(d.nodes, 0)['kind'] = 'robô'), 'nodes[0].kind'],
    ['id vazio', (d) => (at(d.nodes, 2)['id'] = ''), 'nodes[2].id'],
    ['instruções não texto', (d) => (at(d.nodes, 2)['instructions'] = 3), 'nodes[2].instructions'],
    ['posição sem y', (d) => (at(d.nodes, 0)['position'] = { x: 1 }), 'nodes[0].position.y'],
    [
      'maxRounds 11',
      (d) => (at(d.nodes, supervisorIndex)['maxRounds'] = 11),
      `nodes[${String(supervisorIndex)}].maxRounds`,
    ],
    [
      'maxRounds fracionário',
      (d) => (at(d.nodes, supervisorIndex)['maxRounds'] = 2.5),
      `nodes[${String(supervisorIndex)}].maxRounds`,
    ],
    [
      'preset desconhecido',
      (d) => (at(d.nodes, supervisorIndex)['presets'] = ['wow', 'xyz']),
      `nodes[${String(supervisorIndex)}].presets[1]`,
    ],
    [
      'onExhausted desconhecido',
      (d) => (at(d.nodes, supervisorIndex)['onExhausted'] = 'retry'),
      `nodes[${String(supervisorIndex)}].onExhausted`,
    ],
    [
      'relações não lista',
      (d) => (at(d.nodes, memoryIndex)['relations'] = 'ideia'),
      `nodes[${String(memoryIndex)}].relations`,
    ],
    ['tipo de fio desconhecido', (d) => (at(d.edges, 0)['kind'] = 'loop'), 'edges[0].kind'],
    ['fio sem destino', (d) => delete at(d.edges, 1)['target'], 'edges[1].target'],
    ['condição não texto', (d) => (at(d.edges, 3)['condition'] = 1), 'edges[3].condition'],
    ['zoom zero', (d) => (d.viewport['zoom'] = 0), 'viewport.zoom'],
    ['createdAt fora do ISO-8601', (d) => (d['createdAt'] = 'ontem'), 'createdAt'],
    ['nodes não lista', (d) => Object.assign(d, { nodes: {} }), 'nodes'],
  ];

  it.each(cases)('%s', (_, spoil, path, message) => {
    const doc = valid() as Doc;
    spoil(doc);
    const issues = issuesOf(JSON.stringify(doc));
    expect(issues.map((i) => i.path)).toEqual([path]);
    expect(issues[0]?.message).toBe(message ?? issues[0]?.message);
    expect(issues[0]?.message).not.toBe('');
  });

  it('mensagens do zod saem em pt-BR', () => {
    const doc = valid() as Doc;
    at(doc.nodes, 2)['instructions'] = 3;
    expect(issuesOf(JSON.stringify(doc))[0]?.message).toMatch(/inválid/u);
  });

  it('devolve um item por problema', () => {
    const doc = valid() as Doc;
    doc['name'] = '';
    at(doc.edges, 0)['kind'] = 'loop';
    expect(issuesOf(JSON.stringify(doc)).map((i) => i.path)).toEqual(['name', 'edges[0].kind']);
  });
});

describe('zod sem JIT (SPEC §9.4)', () => {
  it('não compila validadores com new Function, que a CSP barra', () => {
    expect(z.config().jitless).toBe(true);
  });
});
