-- Grafos na nuvem (SPEC §7.4, ADR-0004): um registro por grafo, só o dono enxerga (NFR-09).

create table public.graphs (
  owner_id   uuid        not null default auth.uid() references auth.users on delete cascade,
  id         text        not null,                 -- GraphId
  name       text        not null,                 -- cópia de data.name, para a lista (FR-31)
  node_count integer     not null check (node_count >= 0),
  updated_at timestamptz not null,                 -- ordena a lista
  data       jsonb       not null,                 -- JSON versionado do GraphCodec
  primary key (owner_id, id)
);

comment on table public.graphs is
  'Graph Builder: grafos do modo nuvem (SPEC §7.4). RLS: só o dono (owner_id = auth.uid()).';

-- "Meus grafos": do mais recente para o mais antigo, por dono.
create index graphs_owner_updated_idx on public.graphs (owner_id, updated_at desc);

alter table public.graphs enable row level security;

-- Sem sessão, nada: o papel anônimo não tem acesso nenhum à tabela.
revoke all on table public.graphs from anon;
grant select, insert, update, delete on table public.graphs to authenticated;

create policy graphs_owner on public.graphs
  for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
