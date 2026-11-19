<script lang="ts">
  // FR-50, FR-52 (M9): "Entrar com GitHub" sem sessão; com sessão, @login e o menu com "Sair".
  // O avatar é a inicial do login: nenhuma imagem é baixada do GitHub (NFR-05).
  import { ptBR } from '#lib/i18n/pt-BR.ts';
  import type { Session } from '#lib/state/session.svelte.ts';

  let { session }: { session: Session } = $props();

  const t = ptBR.cloud;
  let open = $state(false);
  let root: HTMLElement | undefined = $state();

  function outside(event: PointerEvent) {
    if (open && event.target instanceof Node && !root?.contains(event.target)) open = false;
  }

  function keydown(event: KeyboardEvent) {
    if (open && event.key === 'Escape') {
      open = false;
      root?.querySelector<HTMLButtonElement>('.user')?.focus();
    }
  }
</script>

<svelte:window onpointerdown={outside} onkeydown={keydown} />

<span class="account" bind:this={root}>
  {#if session.account === null}
    <button
      type="button"
      class="btn gh"
      disabled={session.signingIn}
      onclick={() => void session.signIn()}
      ><span class="mark" aria-hidden="true">GH</span>
      {session.signingIn ? t.signingIn : t.signIn}</button
    >
  {:else}
    {@const login = session.account.login}
    <button
      type="button"
      class="user"
      aria-label={t.accountMenu(login)}
      aria-haspopup="menu"
      aria-expanded={open}
      onclick={() => (open = !open)}
      ><span class="avatar" aria-hidden="true">{login.slice(0, 1).toUpperCase()}</span>{t.login(
        login,
      )} ▾</button
    >
    {#if open}
      <div class="menu" role="menu" aria-label={t.accountMenu(login)}>
        <div class="hd" aria-hidden="true">{t.login(login)}</div>
        <button
          type="button"
          role="menuitem"
          onclick={() => {
            open = false;
            void session.signOut();
          }}>{t.signOut}</button
        >
      </div>
    {/if}
  {/if}
</span>

<style>
  .account {
    position: relative;
    display: inline-flex;
  }
  .gh {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }
  .mark {
    font: 11px var(--mono);
  }
  .user {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border: 1px solid var(--line);
    background: #fff;
    border-radius: 20px;
    padding: 3px 10px 3px 3px;
    font: 12.5px var(--mono);
    color: var(--ink);
    white-space: nowrap;
    cursor: pointer;
  }
  .avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--kind-worker);
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font: 600 11px var(--sans);
  }
  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 40;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 8px;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.14);
    padding: 4px;
    min-width: 170px;
    font-size: 13px;
  }
  .hd {
    padding: 7px 10px;
    color: var(--muted);
    font: 11px var(--mono);
  }
  .menu button {
    display: block;
    width: 100%;
    text-align: left;
    padding: 7px 10px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    font: inherit;
    cursor: pointer;
  }
  .menu button:hover,
  .menu button:focus-visible {
    background: var(--paper2);
  }
</style>
