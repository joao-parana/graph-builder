// Cliente do Supabase para o modo nuvem (ADR-0004). Só a infraestrutura conhece o `supabase-js`.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Mesma forma que o `supabase gen types` gera para um esquema sem views, funções e enums.
type NoTables = { [_ in never]: never };

/**
 * Linha da tabela `graphs` (SPEC §7.4), escrita à mão: o esquema é pequeno e não muda sozinho.
 * `type`, não `interface`: o `supabase-js` exige tipos com assinatura de índice implícita.
 */
export type GraphRow = {
  owner_id: string;
  id: string;
  name: string;
  node_count: number;
  updated_at: string;
  data: unknown;
};

/** Na gravação, `owner_id` vem do `default auth.uid()` do banco. */
export type GraphInsert = Omit<GraphRow, 'owner_id'> & { owner_id?: string };

export type CloudDatabase = {
  public: {
    Tables: {
      graphs: {
        Row: GraphRow;
        Insert: GraphInsert;
        Update: Partial<GraphInsert>;
        Relationships: [];
      };
    };
    Views: NoTables;
    Functions: NoTables;
    Enums: NoTables;
    CompositeTypes: NoTables;
  };
};

export type CloudClient = SupabaseClient<CloudDatabase>;

export interface CloudClientOptions {
  /** Onde guardar a sessão; padrão: `localStorage` do navegador. Testes passam um em memória. */
  readonly storage?: {
    getItem(key: string): string | null | Promise<string | null>;
    setItem(key: string, value: string): void | Promise<void>;
    removeItem(key: string): void | Promise<void>;
  };
}

/**
 * PKCE e troca do `?code=` feita pelo `SupabaseAuthGateway.completeSignIn` (não automática), para o
 * app decidir quando ler e limpar a URL de volta (FR-50, FR-51).
 */
export function createCloudClient(
  url: string,
  publicKey: string,
  options: CloudClientOptions = {},
): CloudClient {
  return createClient<CloudDatabase>(url, publicKey, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
      ...(options.storage === undefined ? {} : { storage: options.storage }),
    },
  });
}
