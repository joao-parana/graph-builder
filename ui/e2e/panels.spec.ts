// Gate da L05 (SPEC §9): validação ao vivo no inspetor e no painel "Antes de exportar".
import { expect, type Locator, type Page, test } from '@playwright/test';

const palette = (page: Page, label: string) =>
  page.locator('.palette').getByRole('button', { name: new RegExp(`^${label}`, 'u') });
const piece = (page: Page, name: string) =>
  page.locator('.svelte-flow__node').filter({ hasText: name });
const prexp = (page: Page) => page.getByRole('region', { name: 'Antes de exportar' });
const issue = (page: Page, rule: string) => prexp(page).locator(`li[data-rule="${rule}"]`);
const command = process.platform === 'darwin' ? 'Meta' : 'Control';

/** Espera o elemento parar (Arrumar anima o enquadramento) antes de medir. */
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

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(palette(page, 'Trabalhador')).toBeVisible();
});

test('objetivo: o painel atualiza enquanto se digita; o item foca o campo', async ({ page }) => {
  await expect(issue(page, 'VAL-01')).toBeVisible();
  await expect(issue(page, 'VAL-07')).toBeVisible();
  await expect(prexp(page)).toHaveClass(/errors/u);

  await issue(page, 'VAL-01').getByRole('button').click();
  const objective = page.locator('#graph-objective');
  await expect(objective).toBeFocused();
  await objective.pressSequentially('Landing page');
  await expect(issue(page, 'VAL-01')).toHaveCount(0);
  await expect(issue(page, 'VAL-07')).toBeVisible();
});

test('item do painel seleciona a peça; instruções tiram o aviso', async ({ page }) => {
  await palette(page, 'Trabalhador').click();
  await page.locator('.svelte-flow__pane').click({ position: { x: 20, y: 20 } });
  await expect(page.getByTestId('graph-summary')).toContainText('1 Trabalhador');
  await expect(piece(page, 'Trabalhador 1').getByTestId('piece')).toHaveClass(/warn/u);

  await issue(page, 'VAL-02').getByRole('button').click();
  await expect(piece(page, 'Trabalhador 1')).toHaveClass(/selected/u);
  await expect(page.locator('#node-name')).toHaveValue('Trabalhador 1');

  await page.locator('#node-instructions').pressSequentially('Escreva a headline.');
  await expect(issue(page, 'VAL-02')).toHaveCount(0);
  await expect(piece(page, 'Trabalhador 1')).toContainText('Escreva a headline.');
});

test('Decisão: condição vazia em vermelho até ser escrita', async ({ page }) => {
  await palette(page, 'Decisão').click();
  await palette(page, 'Entrega').click();
  await palette(page, 'Entrega').click();
  await page.getByRole('button', { name: 'Arrumar' }).click();
  await link(page, 'Decisão 1', 'Entrega 1');
  await link(page, 'Decisão 1', 'Entrega 2');
  await expect(issue(page, 'VAL-03')).toBeVisible();

  await piece(page, 'Decisão 1').click();
  const conditions = page.locator('.inspector input[id^="condition-"]');
  await expect(conditions).toHaveCount(2);
  await expect(conditions.first()).toHaveAttribute('aria-invalid', 'true');
  await conditions.nth(0).fill('se aprovado');
  await conditions.nth(1).fill('se reprovado');
  await expect(conditions.first()).toHaveAttribute('aria-invalid', 'false');
  await expect(issue(page, 'VAL-03')).toHaveCount(0);
  await expect(page.locator('.svelte-flow__edge-label').first()).toBeVisible();
});

test('Supervisor: preset liga e desliga a linha da barra', async ({ page }) => {
  await palette(page, 'Supervisor').click();
  const bar = page.locator('#node-instructions');
  const wow = page.locator('.preset').filter({ hasText: 'Resultado WOW' });
  await wow.click();
  await expect(wow).toHaveAttribute('aria-pressed', 'true');
  await expect(bar).toHaveValue('Todo crítico aprova com reação "uau".');
  await wow.click();
  await expect(wow).toHaveAttribute('aria-pressed', 'false');
  await expect(bar).toHaveValue('');
});

test('nome repetido: erro no campo e volta ao sair', async ({ page }) => {
  await palette(page, 'Trabalhador').click();
  await palette(page, 'Trabalhador').click();
  const name = page.locator('#node-name');
  await name.fill('Trabalhador 1');
  await expect(page.getByRole('alert')).toHaveText('Já existe uma peça com esse nome.');
  await expect(piece(page, 'Trabalhador 2')).toBeVisible();
  await name.blur();
  await expect(name).toHaveValue('Trabalhador 2');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('desfazer reverte a edição inteira de um campo', async ({ page }) => {
  await palette(page, 'Trabalhador').click();
  const instructions = page.locator('#node-instructions');
  await instructions.pressSequentially('Escreva');
  await instructions.blur();
  await page.keyboard.press(`${command}+z`);
  await expect(instructions).toHaveValue('');
  await expect(piece(page, 'Trabalhador 1')).toBeVisible();
});

test('várias peças selecionadas: contagem e Apagar', async ({ page }) => {
  await palette(page, 'Trabalhador').click();
  await palette(page, 'Trabalhador').click();
  await page.getByRole('button', { name: 'Arrumar' }).click();
  // o Svelte Flow lê a tecla de multisseleção por keydown, não pelo modificador do clique
  // Shift + arrastar no vazio: caixa de seleção (⌘/Ctrl+clique depende do SO do user agent)
  const a = await piece(page, 'Trabalhador 1').boundingBox();
  const b = await piece(page, 'Trabalhador 2').boundingBox();
  if (a === null || b === null) throw new Error('peça sem caixa');
  const left = Math.min(a.x, b.x) - 20;
  const top = Math.min(a.y, b.y) - 20;
  const right = Math.max(a.x + a.width, b.x + b.width) + 20;
  const bottom = Math.max(a.y + a.height, b.y + b.height) + 20;
  await page.keyboard.down('Shift');
  await page.mouse.move(left, top);
  await page.mouse.down();
  await page.mouse.move(right, bottom, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(page.getByTestId('many-selected')).toContainText('2 peças selecionadas');
  await page
    .getByRole('complementary', { name: 'Inspetor' })
    .getByRole('button', { name: 'Apagar' })
    .click();
  await expect(page.locator('.svelte-flow__node')).toHaveCount(0);
});
