const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test('crée un plat avec ingrédients et le retrouve dans la liste', async ({ page }) => {
    await page.getByText('Éditeur de plats').click();
    await expect(page.getByText('Aucun plat enregistré')).toBeVisible();

    await page.getByRole('button', { name: 'Nouveau plat' }).click();
    await page.locator('#dish-name').fill('Pâtes Carbonara');
    await page.locator('.ing-name-input').first().fill('Pâtes');
    await page.getByRole('button', { name: 'Ajouter un ingrédient', exact: true }).click();
    await page.locator('.ing-name-input').nth(1).fill('Lardons');
    await page.getByText('Enregistrer le plat').click();

    await expect(page.locator('.dish-card')).toHaveCount(1);
    await expect(page.locator('.dish-card h3')).toHaveText('Pâtes Carbonara');
    await expect(page.locator('.dish-card p')).toContainText('Pâtes');
    await expect(page.locator('.dish-card p')).toContainText('Lardons');
});

test('modifie un plat existant', async ({ page }) => {
    await page.getByText('Éditeur de plats').click();
    await page.getByRole('button', { name: 'Nouveau plat' }).click();
    await page.locator('#dish-name').fill('Salade');
    await page.locator('.ing-name-input').first().fill('Laitue');
    await page.getByText('Enregistrer le plat').click();

    await page.locator('.dish-card').getByLabel('Modifier').click();
    await expect(page.locator('#dish-name')).toHaveValue('Salade');
    await page.locator('#dish-name').fill('Salade César');
    await page.getByText('Enregistrer le plat').click();

    await expect(page.locator('.dish-card h3')).toHaveText('Salade César');
});

test('supprime un plat après confirmation', async ({ page }) => {
    await page.getByText('Éditeur de plats').click();
    await page.getByRole('button', { name: 'Nouveau plat' }).click();
    await page.locator('#dish-name').fill('À supprimer');
    await page.locator('.ing-name-input').first().fill('Truc');
    await page.getByText('Enregistrer le plat').click();

    await page.locator('.dish-card').getByLabel('Supprimer').click();
    await expect(page.getByText('Supprimer le plat ?')).toBeVisible();
    await page.locator('#modal-ok').click();

    await expect(page.getByText('Aucun plat enregistré')).toBeVisible();
});

test('affiche les plats triés par ordre alphabétique', async ({ page }) => {
    await page.getByText('Éditeur de plats').click();

    for (const name of ['Riz nature', 'Éclair au chocolat', 'Avocado toast', 'Boeuf bourguignon']) {
        await page.getByRole('button', { name: 'Nouveau plat' }).click();
        await page.locator('#dish-name').fill(name);
        await page.locator('.ing-name-input').first().fill('Ingrédient');
        await page.getByText('Enregistrer le plat').click();
    }

    await expect(page.locator('.dish-card h3')).toHaveText([
        'Avocado toast',
        'Boeuf bourguignon',
        'Éclair au chocolat',
        'Riz nature',
    ]);
});

test('refuse d\'enregistrer un plat sans nom ou sans ingrédient', async ({ page }) => {
    await page.getByText('Éditeur de plats').click();
    await page.getByRole('button', { name: 'Nouveau plat' }).click();

    await page.getByText('Enregistrer le plat').click();
    await expect(page.getByText('Le plat doit avoir un nom.')).toBeVisible();
    await page.locator('#modal-ok').click();

    await page.locator('#dish-name').fill('Plat vide');
    await page.locator('.ing-name-input').first().fill('');
    await page.getByText('Enregistrer le plat').click();
    await expect(page.getByText('Ajoutez au moins un ingrédient.')).toBeVisible();
});
