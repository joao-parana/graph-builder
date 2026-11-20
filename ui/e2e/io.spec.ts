// Gate da L06 (SPEC §9): exportar → importar ida e volta, Meus grafos, Limpar e autosave.
import { readFile } from 'node:fs/promises';
import { expect, type Locator, type Page, test } from './csp.ts';

const palette = (page: Page, label: string) =>
  page.locator('.palette').getByRole('button', { name: new RegExp(`^${label}`, 'u') });
const pieces = (page: Page) => page.locator('.svelte-flow__node');
const piece = (page: Page, name: string) => pieces(page).filter({ hasText: name });
const top = (page: Page, name: string) =>
  page.locator('header.top').getByRole('button', { name, exact: true });
const dialog = (page: Page, name: string) => page.getByRole('dialog', { name });
const command = process.platform === 'darwin' ? 'Meta' : 'Control';

async function center(locator: Locator): Promise<{ x: number; y: number }> {
  await locator.hover({ trial: true });
  const box = await locator.boundingBox();
  if (box === null) throw new Error('elemento sem caixa');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function link(page: Page, from: string, to: string) {
  const start = await center(piece(page, from).locator('[data-handleid="out"]'));
  const end = await center(piece(page, to).locator('[data-handleid="in"]'));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
}

/** Baixa o arquivo do botão e devolve nome e conteúdo. */
async function download(page: Page, button: Locator) {
  const [file] = await Promise.all([page.waitForEvent('download'), button.click()]);
  const path = await file.path();
  return { name: file.suggestedFilename(), text: await readFile(path, 'utf8'), path };
}

const saved = (page: Page) => expect(page.getByTestId('save-status')).toHaveText('● salvo');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(palette(page, 'Trabalhador')).toBeVisible();
  await expect(page.locator('.svelte-flow__pane')).toBeVisible();
});

test('exportar → importar: o JSON e o prompt voltam iguais', async ({ page }) => {
  await page.locator('#graph-objective').fill('Entregar a headline da landing page.');
  await palette(page, 'Entrada').click();
  await palette(page, 'Trabalhador').click();
  await palette(page, 'Entrega').click();
  await page.getByRole('button', { name: 'Arrumar' }).click();
  await link(page, 'Entrada 1', 'Trabalhador 1');
  await link(page, 'Trabalhador 1', 'Entrega 1');
  await piece(page, 'Trabalhador 1').click();
  await page.locator('#node-instructions').fill('Escreva 5 headlines.');
  await page.locator('#top-title').fill('Landing page');
  await page.locator('#top-title').blur();

  await top(page, 'Exportar para a IA').click();
  const exporter = dialog(page, 'Exportar para a IA');
  await expect(exporter.getByTestId('export-text')).toContainText('# Grafo: Landing page');
  const md = await download(page, exporter.getByRole('button', { name: 'Baixar .md' }));
  expect(md.name).toBe('Landing page.md');
  await exporter.getByRole('tab', { name: 'JSON' }).click();
  const json = await download(page, exporter.getByRole('button', { name: 'Baixar .json' }));
  expect(json.name).toBe('Landing page.json');
  await exporter.getByRole('button', { name: 'Fechar' }).click();
  await expect(exporter).toHaveCount(0);

  await top(page, 'Abrir JSON').click();
  const importer = dialog(page, 'Abrir JSON');
  await importer.getByTestId('import-file').setInputFiles(json.path);
  await expect(importer.locator('#import-text')).toHaveValue(json.text);
  await importer.getByRole('button', { name: 'Abrir grafo' }).click();
  await expect(importer).toHaveCount(0);
  await expect(page.getByTestId('toast')).toHaveText('"Landing page" aberto');
  await expect(pieces(page)).toHaveCount(3);

  await top(page, 'Exportar para a IA').click();
  const again = await download(page, exporter.getByRole('button', { name: 'Baixar .md' }));
  const withoutId = (text: string) => text.replace(/graphId=\S+/u, 'graphId=?');
  expect(withoutId(again.text)).toBe(withoutId(md.text)); // só o id do grafo novo muda
  await exporter.getByRole('tab', { name: 'JSON' }).click();
  const back = JSON.parse(await exporter.getByTestId('export-text').innerText()) as Record<
    string,
    unknown
  >;
  const original = JSON.parse(json.text) as Record<string, unknown>;
  expect(back['id']).not.toBe(original['id']); // grafo novo, não sobrescreve
  expect({ ...back, id: '', updatedAt: '' }).toEqual({ ...original, id: '', updatedAt: '' });
});

test('exportar com erros: prompt bloqueado, JSON liberado', async ({ page }) => {
  // pelo teclado: o Safari não põe o foco no botão clicado, e o foco deve voltar a ele
  await top(page, 'Exportar para a IA').focus();
  await page.keyboard.press('Enter');
  const exporter = dialog(page, 'Exportar para a IA');
  await expect(exporter.getByTestId('export-blocked')).toContainText('O grafo está sem objetivo');
  await expect(exporter.getByRole('button', { name: 'Copiar prompt' })).toBeDisabled();
  await expect(exporter.getByRole('button', { name: 'Baixar .md' })).toBeDisabled();
  await exporter.getByRole('tab', { name: 'JSON' }).click();
  await expect(exporter.getByRole('button', { name: 'Baixar .json' })).toBeEnabled();
  await expect(exporter.getByTestId('export-text')).toContainText('"schemaVersion": 1');
  await page.keyboard.press('Escape');
  await expect(exporter).toHaveCount(0);
  await expect(top(page, 'Exportar para a IA')).toBeFocused();
});

test('abrir JSON inválido: erros com caminho e nada carregado', async ({ page }) => {
  await palette(page, 'Trabalhador').click();
  await top(page, 'Abrir JSON').click();
  const importer = dialog(page, 'Abrir JSON');
  await expect(importer.getByRole('button', { name: 'Abrir grafo' })).toBeDisabled();
  await importer.locator('#import-text').fill('{"schemaVersion": 1, "name": "X"}');
  await importer.getByRole('button', { name: 'Abrir grafo' }).click();
  await expect(importer.getByRole('alert')).toContainText('Não foi possível abrir');
  await expect(importer.getByRole('alert')).toContainText('objective');
  await importer.getByRole('button', { name: 'Cancelar' }).click();
  await expect(pieces(page)).toHaveCount(1);
});

test('salvamento automático: o grafo volta depois de recarregar', async ({ page }) => {
  await palette(page, 'Trabalhador').click();
  await page.locator('#top-title').fill('Persistente');
  await page.locator('#top-title').blur();
  await saved(page);
  await page.reload();
  await expect(piece(page, 'Trabalhador 1')).toBeVisible();
  await expect(page.locator('#top-title')).toHaveValue('Persistente');
});

test('Meus grafos: novo, renomear, duplicar, abrir e apagar', async ({ page }) => {
  await palette(page, 'Trabalhador').click();
  await saved(page);
  await top(page, 'Meus grafos').click();
  let library = dialog(page, 'Meus grafos');
  const rows = library.getByTestId('library-row');
  await expect(rows).toHaveCount(1);

  await rows.first().getByRole('button', { name: 'Renomear' }).click();
  await page.keyboard.press(`${command}+a`);
  await page.keyboard.type('Primeiro');
  await page.keyboard.press('Enter');
  await expect(rows.first()).toContainText('Primeiro');
  await expect(page.locator('#top-title')).toHaveValue('Primeiro');

  await rows.first().getByRole('button', { name: 'Duplicar' }).click();
  await expect(rows).toHaveCount(2);
  await expect(library).toContainText('Primeiro (cópia)');

  await library.getByRole('button', { name: '+ Novo grafo' }).click();
  await expect(library).toHaveCount(0);
  await expect(pieces(page)).toHaveCount(0);
  await expect(page.locator('#top-title')).toHaveValue('Meu grafo');

  await top(page, 'Meus grafos').click();
  library = dialog(page, 'Meus grafos');
  await expect(rows).toHaveCount(3);
  const first = rows.filter({ hasText: 'Primeiro' }).filter({ hasNotText: '(cópia)' });
  await first.getByRole('button', { name: 'Abrir' }).click();
  await expect(library).toHaveCount(0);
  await expect(piece(page, 'Trabalhador 1')).toBeVisible();

  await top(page, 'Meus grafos').click();
  await first.getByRole('button', { name: 'Apagar', exact: true }).click();
  await first.getByRole('button', { name: 'Apagar de vez' }).click();
  await expect(rows).toHaveCount(2);
  await expect(page.locator('#top-title')).not.toHaveValue('Primeiro');
});

test('Limpar pede confirmação e dá para desfazer; atalhos param com modal aberto', async ({
  page,
}) => {
  await palette(page, 'Trabalhador').click();
  await palette(page, 'Entrega').click();
  await top(page, 'Limpar').click();
  const confirm = dialog(page, 'Limpar o grafo');
  await expect(confirm).toContainText('Isso apaga todas as peças deste grafo.');
  await page.keyboard.press('Delete'); // a peça selecionada não é apagada por trás do modal
  await expect(pieces(page)).toHaveCount(2);
  await confirm.getByRole('button', { name: 'Limpar' }).click();
  await expect(pieces(page)).toHaveCount(0);
  await expect(top(page, 'Limpar')).toBeDisabled();
  await page.keyboard.press(`${command}+z`);
  await expect(pieces(page)).toHaveCount(2);

  await top(page, 'Ajuda').click();
  await expect(dialog(page, 'Ajuda')).toContainText('Como ligar');
  await dialog(page, 'Ajuda').getByRole('button', { name: 'Fechar' }).click();
  await expect(dialog(page, 'Ajuda')).toHaveCount(0);
});
