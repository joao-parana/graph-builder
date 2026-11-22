// Gate da L08 (SPEC §9, Q9): conta e modo nuvem (M9, M10) contra o Supabase local, com a sessão
// injetada. O login real pelo GitHub é conferido só até o pedido ao `/auth/v1/authorize`.
import { expect, type Page, test } from './csp.ts';
import { cloudGraphs, type CloudUser, createUser, injectSession } from './cloud-fixtures.ts';
import { localCloud } from './local-cloud.ts';

const cloud = localCloud();
test.skip(cloud === null, 'Supabase local fora do ar: rode `bun run db:start`');

const palette = (page: Page, label: string) =>
  page.locator('.palette').getByRole('button', { name: new RegExp(`^${label}`, 'u') });
const header = (page: Page) => page.locator('header.top');
const mode = (page: Page, name: 'Neste navegador' | 'Na nuvem') =>
  header(page).getByRole('radiogroup', { name: 'Onde salvar' }).getByRole('radio', { name });
const toast = (page: Page) => page.getByTestId('toast');
const saved = (page: Page) => expect(page.getByTestId('save-status')).toHaveText('● salvo');
const rows = (page: Page) => page.getByTestId('library-row');

async function ready(page: Page) {
  await expect(palette(page, 'Trabalhador')).toBeVisible();
  await expect(page.locator('.svelte-flow__pane')).toBeVisible();
}

async function library(page: Page, title: string) {
  await header(page).getByRole('button', { name: 'Meus grafos', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('sem sessão', () => {
  test('"Na nuvem" desabilitado e "Entrar com GitHub" vai ao authorize do Supabase', async ({
    page,
    baseURL,
  }) => {
    await page.goto('/');
    await ready(page);
    await expect(mode(page, 'Neste navegador')).toBeChecked();
    await expect(mode(page, 'Na nuvem')).toBeDisabled();

    await page.route('**/auth/v1/authorize**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<p>GitHub</p>' }),
    );
    const authorize = page.waitForRequest('**/auth/v1/authorize**');
    await header(page)
      .getByRole('button', { name: /Entrar com GitHub/u })
      .click();
    const url = new URL((await authorize).url());
    expect(url.searchParams.get('provider')).toBe('github');
    expect(url.searchParams.get('redirect_to')).toBe(`${baseURL ?? ''}/`);
    expect(url.searchParams.get('code_challenge_method')).toBe('s256');
  });

  test('volta sem convite: aviso, modo local e URL limpa (FR-51)', async ({ page, baseURL }) => {
    await page.goto('/?error=access_denied&error_code=signup_disabled&error_description=Signups');
    await ready(page);
    await expect(toast(page)).toHaveText(
      'Sua conta do GitHub não tem acesso à nuvem. Peça um convite.',
    );
    await expect(page).toHaveURL(`${baseURL ?? ''}/`);
    await expect(mode(page, 'Neste navegador')).toBeChecked();
  });
});

test.describe('com sessão', () => {
  let user: CloudUser | undefined;

  test.beforeEach(async ({ page }) => {
    if (cloud === null) return;
    user = await createUser(cloud);
    await injectSession(page, cloud, user.session);
  });

  test.afterEach(async () => {
    await user?.remove();
    user = undefined;
  });

  test('salva na nuvem, lembra o modo, copia entre modos e sai (FR-52..55, Q8)', async ({
    page,
  }) => {
    if (cloud === null || user === undefined) return;
    const { login, session } = user;
    await page.goto('/');
    await ready(page);
    const account = header(page).getByRole('button', { name: `Conta @${login}` });
    await expect(account).toBeVisible();

    await mode(page, 'Na nuvem').click();
    await expect(mode(page, 'Na nuvem')).toBeChecked();
    await palette(page, 'Trabalhador').click();
    await saved(page);
    await expect.poll(async () => (await cloudGraphs(cloud, session))[0]?.node_count).toBe(1);

    await page.reload();
    await ready(page);
    await expect(mode(page, 'Na nuvem')).toBeChecked();
    await expect(page.locator('.svelte-flow__node')).toHaveCount(1);

    const inCloud = await library(page, 'Meus grafos — na nuvem');
    await expect(rows(page)).toHaveCount(1);
    await expect(inCloud.getByRole('button', { name: 'Mais ações' })).toBeVisible();
    await inCloud.getByRole('button', { name: 'Copiar para este navegador' }).click();
    await expect(toast(page)).toHaveText('Copiado para este navegador');
    await inCloud.getByRole('button', { name: 'Fechar' }).click();

    await mode(page, 'Neste navegador').click();
    await expect(mode(page, 'Neste navegador')).toBeChecked();
    await library(page, 'Meus grafos — neste navegador');
    await expect(rows(page)).toHaveCount(2);
    await page.keyboard.press('Escape');

    await account.click();
    await page.getByRole('menuitem', { name: 'Sair' }).click();
    await expect(header(page).getByRole('button', { name: /Entrar com GitHub/u })).toBeVisible();
    await expect(mode(page, 'Na nuvem')).toBeDisabled();
  });
});
