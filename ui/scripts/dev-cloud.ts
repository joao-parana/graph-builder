// SPEC §9.3: `vite dev` com o modo nuvem ligado ao Supabase local. Os valores vêm do
// `supabase status`, nunca de arquivo versionado. Uso: `bun run --filter ui dev:cloud`.
// Ouve em 127.0.0.1 (SPEC §9.2): o login local usa 127.0.0.1, e só em [::1] o IPv4 não chega.
import { spawn } from 'node:child_process';
import { localCloud } from '../e2e/local-cloud.ts';

const cloud = localCloud();
if (cloud === null) {
  console.error('Supabase local fora do ar: rode `bun run db:start` na raiz do repositório.');
  process.exit(1);
}
const args = process.argv.slice(2);
const host = args.some((arg) => arg === '--host' || arg.startsWith('--host='))
  ? []
  : ['--host', '127.0.0.1'];
const child = spawn('vite', ['dev', ...host, ...args], {
  stdio: 'inherit',
  env: { ...process.env, PUBLIC_SUPABASE_URL: cloud.url, PUBLIC_SUPABASE_KEY: cloud.publicKey },
});
child.on('exit', (code) => {
  process.exit(code ?? 0);
});
