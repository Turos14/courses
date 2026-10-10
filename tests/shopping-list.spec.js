const { test, expect } = require('@playwright/test');

async function createDish(page, name, ingredients) {
    await page.getByText('Éditeur de plats').click();
    await page.getByRole('button', { name: 'Nouveau plat' }).click();
    await page.locator('#dish-name').fill(name);
    for (let i = 0; i < ingredients.length; i++) {
        if (i > 0) await page.getByRole('button', { name: 'Ajouter un ingrédient', exact: true }).click();
        await page.locator('.ing-name-input').nth(i).fill(ingredients[i]);
    }
    await page.getByText('Enregistrer le plat').click();
    await page.locator('#btn-back').click();
}

async function createCalendarFromHome(page, name) {
    await page.getByRole('button', { name: 'Calendrier', exact: true }).click();
    await page.locator('#prompt-name-input').fill(name);
    await page.locator('#prompt-name-confirm').click();
}

function weekDayCard(page, weekdayName) {
    return page.locator('.week-day-card', { hasText: weekdayName });
}

function mealSlot(card, meal) {
    return card.locator('.week-meal-slot').nth(meal === 'midi' ? 0 : 1);
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test('agrège les plats du calendrier (midi + soir) et les ingrédients isolés dans la même liste', async ({ page }) => {
    await createDish(page, 'Pâtes Carbonara', ['Pâtes', 'Lardons']);
    await createCalendarFromHome(page, 'Semaine test');

    const lundi = weekDayCard(page, 'Lundi');
    await mealSlot(lundi, 'midi').click();
    await page.locator('#meal-picker-list').getByText('Pâtes Carbonara').click();
    await page.locator('#meal-picker-confirm').click();

    await mealSlot(lundi, 'soir').click();
    await page.locator('#meal-picker-list').getByText('Pâtes Carbonara').click();
    await page.locator('#meal-picker-confirm').click();

    await page.getByRole('button', { name: 'Ajouter un ingrédient isolé' }).click();
    await page.locator('.cust-name-input').fill('Pain');

    await page.locator('#btn-calendar-generate').click();

    await expect(page.locator('.shopping-item')).toHaveCount(3);
    const pates = page.locator('.shopping-item').filter({ has: page.getByText('Pâtes', { exact: true }) });
    await expect(pates.locator('.ing-counter')).toHaveText('x2'); // 1x midi + 1x soir
    await expect(pates.locator('.ing-origin-text')).toContainText('Pâtes Carbonara (x2)');
});

test('coche des articles, met à jour le badge et efface les cochés', async ({ page }) => {
    await createDish(page, 'Salade', ['Laitue']);
    await createCalendarFromHome(page, 'Semaine test');

    const lundi = weekDayCard(page, 'Lundi');
    await mealSlot(lundi, 'midi').click();
    await page.locator('#meal-picker-list').getByText('Salade').click();
    await page.locator('#meal-picker-confirm').click();

    await page.locator('#btn-calendar-generate').click();

    await expect(page.locator('#items-count-badge')).toHaveText('0 / 1 coché');
    await page.locator('.shopping-item').first().click();
    await expect(page.locator('#items-count-badge')).toHaveText('1 / 1 coché');
    await expect(page.locator('#btn-clear-checked')).toBeVisible();

    await page.locator('#btn-clear-checked').click();
    await expect(page.getByText('Votre liste de courses est vide.')).toBeVisible();
});

test('le bouton "Liste de courses" du calendrier reste désactivé tant que rien n\'est planifié', async ({ page }) => {
    await createDish(page, 'Riz', ['Riz']);
    await createCalendarFromHome(page, 'Semaine test');

    await expect(page.locator('#btn-calendar-generate')).toBeDisabled();

    const lundi = weekDayCard(page, 'Lundi');
    await mealSlot(lundi, 'midi').click();
    await page.locator('#meal-picker-list').getByText('Riz').click();
    await page.locator('#meal-picker-confirm').click();

    await expect(page.locator('#btn-calendar-generate')).toBeEnabled();
});
