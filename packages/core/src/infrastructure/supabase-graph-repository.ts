// GraphRepository na tabela `graphs` do Supabase (modo nuvem: FR-54, FR-55; SPEC §7.4).
// O RLS só deixa ver e gravar os grafos do usuário da sessão (NFR-09), então não há filtro por dono.
import type { GraphCodec, GraphRepository, GraphSummary } from '../application/index.ts';
import { type Graph, type GraphId, graphId } from '../domain/index.ts';
import { jsonGraphCodec } from './json-codec.ts';
import type { CloudClient } from './supabase-client.ts';

/** Falha do Supabase (rede, sessão, RLS) ou grafo guardado que não passa no codec. */
export class CloudStorageError extends Error {
  override readonly name = 'CloudStorageError';
  /** Só o motivo (sem "Não foi possível…"), para a UI montar o próprio texto (FR-55). */
  readonly reason: string;

  constructor(message: string, reason: string) {
    super(message);
    this.reason = reason;
  }
}

const TABLE = 'graphs';

/** `timestamptz` volta como "2026-11-18T00:00:00+00:00"; o app usa o ISO de `toISOString`. */
const toIso = (timestamp: string): string => new Date(timestamp).toISOString();

const fail = (action: string, message: string): never => {
  throw new CloudStorageError(`Não foi possível ${action} na nuvem: ${message}`, message);
};

export class SupabaseGraphRepository implements GraphRepository {
  private readonly client: CloudClient;
  private readonly codec: GraphCodec;

  constructor(client: CloudClient, codec: GraphCodec = jsonGraphCodec) {
    this.client = client;
    this.codec = codec;
  }

  /** Sem a coluna `data`: a lista não baixa os grafos. */
  async list(): Promise<readonly GraphSummary[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select('id, name, node_count, updated_at')
      .order('updated_at', { ascending: false });
    if (error !== null) return fail('listar os grafos', error.message);
    return data.map((row) => ({
      id: graphId(row.id),
      name: row.name,
      nodeCount: row.node_count,
      updatedAt: toIso(row.updated_at),
    }));
  }

  async get(id: GraphId): Promise<Graph | null> {
    const { data, error } = await this.client.from(TABLE).select('data').eq('id', id).maybeSingle();
    if (error !== null) return fail('abrir o grafo', error.message);
    if (data === null) return null;
    const decoded = this.codec.decode(JSON.stringify(data.data));
    if (!decoded.ok) {
      const [first] = decoded.error;
      return fail('ler o grafo', `${first?.path ?? ''} ${first?.message ?? ''}`.trim());
    }
    return decoded.value;
  }

  /** Upsert por (owner_id, id): o mesmo `GraphId` sobrescreve. */
  async save(graph: Graph): Promise<void> {
    const { error } = await this.client.from(TABLE).upsert(
      {
        id: graph.id,
        name: graph.name,
        node_count: graph.nodes.length,
        updated_at: graph.updatedAt,
        data: JSON.parse(this.codec.encode(graph)) as unknown,
      },
      { onConflict: 'owner_id,id' },
    );
    if (error !== null) fail('salvar o grafo', error.message);
  }

  async delete(id: GraphId): Promise<void> {
    const { error } = await this.client.from(TABLE).delete().eq('id', id);
    if (error !== null) fail('apagar o grafo', error.message);
  }
}
