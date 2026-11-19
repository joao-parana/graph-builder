// Import `?raw` do Vite (texto do arquivo), usado para ler o SPEC nos testes sem `node:fs`.
declare module '*?raw' {
  const text: string;
  export default text;
}
