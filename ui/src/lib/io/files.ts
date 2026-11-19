// Arquivos baixados e copiados (FR-21).

// eslint-disable-next-line no-control-regex -- controles são proibidos em nome de arquivo
const FORBIDDEN = /[/\\:*?"<>|\u0000-\u001f\u007f]/gu;

/** FR-21: nome do grafo sem caracteres proibidos; `grafo` se ficar vazio. */
export function fileName(graphName: string, extension: 'md' | 'json'): string {
  const base = graphName.replace(FORBIDDEN, '-').trim();
  return `${base === '' ? 'grafo' : base}.${extension}`;
}

export const MIME = { md: 'text/markdown;charset=utf-8', json: 'application/json' } as const;

/** Baixa `text` como arquivo, sem sair do navegador (NFR-05). */
export function downloadText(text: string, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
