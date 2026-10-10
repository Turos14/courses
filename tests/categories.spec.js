const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByText('Éditeur de plats').click();
});

test('crée un onglet, l\'assigne à un plat et filtre la liste', async ({ page }) => {
    await page.locator('.category-tab-add').click();
    await page.locator('#prompt-name-input').fill('Desserts');
    await page.locator('#prompt-name-confirm').click();
    await expect(page.locator('.category-tab', { hasText: 'Desserts' })).toBeVisible();

    await page.getByRole('button', { name: 'Nouveau plat' }).click();
    await page.locator('#dish-name').fill('Tarte aux pommes');
    await page.locator('.ing-name-input').first().fill('Pommes');
    await page.locator('#dish-category').selectOption({ label: 'Desserts' });
    await page.getByText('Enregistrer le plat').click();

    await page.getByRole('button', { name: 'Nouveau plat' }).click();
    await page.locator('#dish-name').fill('Riz nature');
    await page.locator('.ing-name-input').first().fill('Riz');
    await page.getByText('Enregistrer le plat').click();

    await expect(page.locator('.dish-card')).toHaveCount(2);

    await page.locator('.category-tab', { hasText: 'Desserts' }).click();
    await expect(page.locator('.dish-card')).toHaveCount(1);
    await expect(page.locator('.dish-card h3')).toHaveText('Tarte aux pommes');

    await page.locator('.category-tab', { hasText: 'Toutes' }).click();
    await expect(page.locator('.dish-card')).toHaveCount(2);
});

test('renomme un onglet', async ({ page }) => {
    await page.locator('.category-tab-add').click();
    await page.locator('#prompt-name-input').fill('Rapide');
    await page.locator('#prompt-name-confirm').click();

    await page.getByRole('button', { name: 'Nouveau plat' }).click();
    await page.locator('#dish-name').fill('Omelette');
    await page.locator('.ing-name-input').first().fill('Œufs');
    await page.locator('#dish-category').selectOption({ label: 'Rapide' });
    await page.getByText('Enregistrer le plat').click();

    await page.locator('.category-tab-manage').click();
    await page.locator('#manage-category-list').getByLabel('Renommer cet onglet').click();
    await expect(page.locator('#prompt-name-input')).toHaveValue('Rapide');
    await page.locator('#prompt-name-input').fill('Express');
    await page.locator('#prompt-name-confirm').click();
    await page.locator('#cat-manage-close').click();

    await expect(page.locator('.category-tab', { hasText: 'Express' })).toBeVisible();
    await expect(page.locator('.category-tab', { hasText: 'Rapide' })).toHaveCount(0);

    // Le plat garde son association (même id), il apparaît toujours sous le nouvel onglet.
    await page.locator('.category-tab', { hasText: 'Express' }).click();
    await expect(page.locator('.dish-card h3')).toHaveText('Omelette');

    await page.locator('.dish-card').getByLabel('Modifier').click();
    await expect(page.locator('#dish-category')).toHaveValue(/.+/);
    await expect(page.locator('#dish-category option:checked')).toHaveText('Express');
});

test('supprimer un onglet ne supprime pas les plats, ils redeviennent "Toutes"', async ({ page }) => {
    await page.locator('.category-tab-add').click();
    await page.locator('#prompt-name-input').fill('Rapide');
    await page.locator('#prompt-name-confirm').click();

    await page.getByRole('button', { name: 'Nouveau plat' }).click();
    await page.locator('#dish-name').fill('Omelette');
    await page.locator('.ing-name-input').first().fill('Œufs');
    await page.locator('#dish-category').selectOption({ label: 'Rapide' });
    await page.getByText('Enregistrer le plat').click();

    await page.locator('.category-tab-manage').click();
    await page.locator('#manage-category-list').getByLabel('Supprimer cet onglet').click();
    await page.locator('#cat-manage-close').click();

    await expect(page.locator('.category-tab', { hasText: 'Rapide' })).toHaveCount(0);
    await expect(page.locator('.dish-card')).toHaveCount(1);
    await expect(page.locator('.dish-card h3')).toHaveText('Omelette');
});
