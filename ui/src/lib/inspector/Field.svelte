<script lang="ts">
  // Campo de texto do inspetor (FR-10..15). Guarda o rascunho enquanto o domínio recusa o valor e,
  // ao perder o foco, volta ao último valor válido.
  let {
    id,
    label,
    value,
    multiline = false,
    placeholder = '',
    type = 'text',
    warning = null,
    hideLabel = false,
    onedit,
    onend,
  }: {
    id: string;
    label: string;
    value: string;
    multiline?: boolean;
    placeholder?: string;
    type?: 'text' | 'number';
    /** Aviso persistente (ex.: condição vazia, FR-13). */
    warning?: string | null;
    /** Rótulo só para leitores de tela (título do topo, FR-33). */
    hideLabel?: boolean;
    /** Devolve o motivo da recusa, ou `null` se o valor entrou. */
    onedit: (text: string) => string | null;
    onend: () => void;
  } = $props();

  let focused = $state(false);
  let draft = $state('');
  let error: string | null = $state(null);

  $effect.pre(() => {
    if (!focused) draft = value;
  });

  function input(event: Event & { currentTarget: HTMLInputElement | HTMLTextAreaElement }) {
    draft = event.currentTarget.value;
    error = onedit(draft);
  }

  function blur() {
    focused = false;
    error = null;
    draft = value;
    onend();
  }

  const message = $derived(error ?? warning);
</script>

<div class="field">
  <label class="label" class:sr-only={hideLabel} for={id}>{label}</label>
  {#if multiline}
    <textarea
      {id}
      {placeholder}
      value={draft}
      class:invalid={message !== null}
      aria-invalid={message !== null}
      aria-describedby={message === null ? undefined : `${id}-error`}
      oninput={input}
      onfocus={() => (focused = true)}
      onblur={blur}></textarea>
  {:else}
    <input
      {id}
      {type}
      {placeholder}
      value={draft}
      class:invalid={message !== null}
      aria-invalid={message !== null}
      aria-describedby={message === null ? undefined : `${id}-error`}
      oninput={input}
      onfocus={() => (focused = true)}
      onblur={blur}
    />
  {/if}
  {#if message !== null}
    <div class="errbox" id={`${id}-error`} role="alert">{message}</div>
  {/if}
</div>
