// Gate da L04 (SPEC §9): criar, ligar, cortar e duplicar peças no canvas.
import { expect, type Locator, type Page, test } from './csp.ts';

const palette = (page: Page, label: string) =>
  page.locator('.palette').getByRole('button', { name: new RegExp(`^${label}`, 'u') });
const pieces = (page: Page) => page.locator('.svelte-flow__node');
const piece = (page: Page, name: string) => pieces(page).filter({ hasText: name });
const wires = (page: Page) => page.locator('.svelte-flow__edge.wire-flow');
const returns = (page: Page) => page.locator('.svelte-flow__edge.wire-return');
const command = process.platform === 'darwin' ? 'Meta' : 'Control';

/** Espera o elemento parar (Arrumar anima o enquadramento) antes de medir. */
async function center(locator: Locator): Promise<{ x: number; y: number }> {
  await locator.hover({ trial: true });
  const box = await locator.boundingBox();
  if (box === null) throw new Error('elemento sem caixa');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** FR-02: arrasta da saída de `from` até a entrada de `to`. */
async function link(page: Page, from: string, to: string) {
  const start = await center(piece(page, from).locator('[data-handleid="out"]'));
  const end = await center(piece(page, to).locator('[data-handleid="in"]'));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
}

/** Clica no meio do fio, no traçado largo de interação (após Arrumar, os fios são retos). */
async function clickWire(page: Page, index = 0) {
  await wires(page).nth(index).locator('.svelte-flow__edge-interaction').click();
}

async function arrange(page: Page) {
  await page.getByRole('button', { name: 'Arrumar' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(palette(page, 'Trabalhador')).toBeVisible();
});

test('criar: paleta adiciona peças com nome automático e só uma Entrada', async ({ page }) => {
  await palette(page, 'Entrada').click();
  await palette(page, 'Trabalhador').click();
  await palette(page, 'Trabalhador').click();
  await expect(pieces(page)).toHaveCount(3);
  await expect(piece(page, 'Trabalhador 2')).toBeVisible();
  // a peça nova fica selecionada e não cai em cima da anterior (FR-01)
  await expect(piece(page, 'Trabalhador 2')).toHaveClass(/selected/u);
  const first = await piece(page, 'Trabalhador 1').boundingBox();
  const second = await piece(page, 'Trabalhador 2').boundingBox();
  expect(second?.x).not.toBe(first?.x);

  await palette(page, 'Entrada').click();
  await expect(page.getByTestId('toast')).toHaveText('Só uma Entrada por grafo');
  await expect(pieces(page)).toHaveCount(3);
});

test('criar: arrastar da paleta solta a peça no canvas', async ({ page }) => {
  await palette(page, 'Decisão').dragTo(page.locator('.svelte-flow__pane'), {
    targetPosition: { x: 300, y: 200 },
  });
  await expect(piece(page, 'Decisão 1')).toBeVisible();
});

test('ligar: fio válido entra; inválido não; retorno do Supervisor aparece', async ({ page }) => {
  await palette(page, 'Entrada').click();
  await palette(page, 'Trabalhador').click();
  await palette(page, 'Supervisor').click();
  await arrange(page);

  await link(page, 'Entrada 1', 'Trabalhador 1');
  await expect(wires(page)).toHaveCount(1);
  await link(page, 'Trabalhador 1', 'Supervisor 1');
  await expect(wires(page)).toHaveCount(2);
  await expect(returns(page)).toHaveCount(1); // tracejado vermelho até o ponto dourado (§3.3)

  // INV-06: fecharia um ciclo; INV-04: repetido
  await link(page, 'Supervisor 1', 'Trabalhador 1');
  await link(page, 'Entrada 1', 'Trabalhador 1');
  await expect(wires(page)).toHaveCount(2);
});

test('ligar: alvo inválido fica vermelho durante o arraste', async ({ page }) => {
  await palette(page, 'Trabalhador').click();
  await palette(page, 'Entrega').click();
  await arrange(page);
  await link(page, 'Trabalhador 1', 'Entrega 1');
  const start = await center(piece(page, 'Entrega 1').locator('[data-handleid="out"]'));
  const target = piece(page, 'Trabalhador 1').locator('[data-handleid="in"]');
  const end = await center(target);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await expect(target).toHaveClass(/connectingto/u);
  await expect(target).not.toHaveClass(/\bvalid\b/u);
  await page.mouse.up();
  await expect(wires(page)).toHaveCount(1);
});

test('cortar: 1º clique seleciona, 2º remove, Esc cancela, desfazer devolve', async ({ page }) => {
  await palette(page, 'Trabalhador').click();
  await palette(page, 'Entrega').click();
  await arrange(page);
  await link(page, 'Trabalhador 1', 'Entrega 1');
  await expect(wires(page)).toHaveCount(1);

  await clickWire(page);
  await expect(wires(page).first()).toHaveClass(/armed/u);
  await page.keyboard.press('Escape');
  await expect(wires(page).first()).not.toHaveClass(/armed/u);

  await clickWire(page);
  await clickWire(page);
  await expect(wires(page)).toHaveCount(0);

  await page.keyboard.press(`${command}+z`);
  await expect(wires(page)).toHaveCount(1);

  await clickWire(page);
  await page.keyboard.press('Delete');
  await expect(wires(page)).toHaveCount(0);
  await page.keyboard.press(`${command}+Shift+z`);
  await expect(wires(page)).toHaveCount(0);
  await page.keyboard.press(`${command}+z`);
  await expect(wires(page)).toHaveCount(1);
});

test('duplicar: ⌘D copia sem fios, com o próximo nome; desfazer remove', async ({ page }) => {
  await palette(page, 'Trabalhador').click();
  await palette(page, 'Supervisor').click();
  await arrange(page);
  await link(page, 'Trabalhador 1', 'Supervisor 1');

  await piece(page, 'Trabalhador 1').click();
  await page.keyboard.press(`${command}+d`);
  await expect(piece(page, 'Trabalhador 2')).toBeVisible();
  await expect(piece(page, 'Trabalhador 2')).toHaveClass(/selected/u);
  await expect(wires(page)).toHaveCount(1);

  await page.keyboard.press(`${command}+z`);
  await expect(piece(page, 'Trabalhador 2')).toHaveCount(0);

  // apagar a peça leva os fios ligados (FR-04)
  await piece(page, 'Trabalhador 1').click();
  await page.keyboard.press('Delete');
  await expect(pieces(page)).toHaveCount(1);
  await expect(wires(page)).toHaveCount(0);
});

test('controles de visão: zoom em passos de 10% e Foco', async ({ page }) => {
  await expect(page.getByTestId('zoom')).toHaveText('100%');
  await page.getByRole('button', { name: 'Aumentar zoom' }).click();
  await expect(page.getByTestId('zoom')).toHaveText('110%');
  await page.getByRole('button', { name: 'Diminuir zoom' }).click();
  await page.getByRole('button', { name: 'Diminuir zoom' }).click();
  await expect(page.getByTestId('zoom')).toHaveText('90%');

  await page.getByRole('button', { name: 'Foco' }).click();
  await expect(page.locator('.palette')).toHaveCount(0);
  await page.getByRole('button', { name: 'Foco' }).click();
  await expect(page.locator('.palette')).toBeVisible();
});
