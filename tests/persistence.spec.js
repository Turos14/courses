const { test, expect } = require('@playwright/test');

test('les données survivent à un rechargement de page (localStorage)', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Éditeur de plats').click();
    await page.getByRole('button', { name: 'Nouveau plat' }).click();
    await page.locator('#dish-name').fill('Omelette');
    await page.locator('.ing-name-input').first().fill('Œufs');
    await page.getByText('Enregistrer le plat').click();

    await page.reload();
    await page.getByText('Éditeur de plats').click();
    await expect(page.locator('.dish-card h3')).toHaveText('Omelette');
});

test('un plat coché comme "acheté" reste coché après rechargement', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Éditeur de plats').click();
    await page.getByRole('button', { name: 'Nouveau plat' }).click();
    await page.locator('#dish-name').fill('Riz');
    await page.locator('.ing-name-input').first().fill('Riz');
    await page.getByText('Enregistrer le plat').click();
    await page.locator('#btn-back').click();

    await page.getByRole('button', { name: 'Calendrier', exact: true }).click();
    await page.locator('#prompt-name-input').fill('Semaine test');
    await page.locator('#prompt-name-confirm').click();

    const lundi = page.locator('.week-day-card', { hasText: 'Lundi' });
    await lundi.locator('.week-meal-slot').nth(0).click();
    await page.locator('#meal-picker-list').getByText('Riz').click();
    await page.locator('#meal-picker-confirm').click();

    await page.locator('#btn-calendar-generate').click();
    await page.locator('.shopping-item').first().click();
    await expect(page.locator('.shopping-item').first()).toHaveClass(/checked/);

    // Après rechargement, la liste déjà générée et les coches doivent être
    // intactes dans le localStorage (regénérer la liste réinitialiserait les coches,
    // donc on revient sur l'écran sans repasser par "Générer").
    await page.reload();
    await page.evaluate(() => window.navigate('view-course-list'));
    await expect(page.locator('.shopping-item').first()).toHaveClass(/checked/);
});
