const { test, expect } = require('@playwright/test');

async function createDish(page, name, ingredientName) {
    await page.getByText('Éditeur de plats').click();
    await page.getByRole('button', { name: 'Nouveau plat' }).click();
    await page.locator('#dish-name').fill(name);
    await page.locator('.ing-name-input').first().fill(ingredientName);
    await page.getByText('Enregistrer le plat').click();
    await page.locator('#btn-back').click();
}

// Depuis l'accueil, "Calendrier" propose de créer un calendrier tant qu'aucun n'est actif.
async function createCalendarFromHome(page, name) {
    await page.getByRole('button', { name: 'Calendrier', exact: true }).click();
    await page.locator('#prompt-name-input').fill(name);
    await page.locator('#prompt-name-confirm').click();
}

// La vue est hebdomadaire (pas mensuelle) : on repère un jour par son nom, pas par son
// numéro dans le mois, pour que les tests soient indépendants de la date d'exécution.
function weekDayCard(page, weekdayName) {
    return page.locator('.week-day-card', { hasText: weekdayName });
}

function mealSlot(card, meal) {
    return card.locator('.week-meal-slot').nth(meal === 'midi' ? 0 : 1);
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test('les petits-déjeuners de la semaine sont des items libres, indépendants des plats', async ({ page }) => {
    await createDish(page, 'Pâtes Carbonara', 'Pâtes');
    await createCalendarFromHome(page, 'Semaine test');

    // Le sélecteur midi/soir ne propose que des plats de l'éditeur (il n'y a plus de
    // notion de type "petit-déjeuner" sur un plat).
    const lundi = weekDayCard(page, 'Lundi');
    await mealSlot(lundi, 'midi').click();
    await expect(page.locator('#meal-picker-list')).toContainText('Pâtes Carbonara');
    await page.locator('#meal-picker-cancel').click();

    // Le petit-déjeuner se saisit directement comme un ingrédient isolé (nom libre), pas
    // en choisissant un plat existant.
    await page.getByRole('button', { name: 'Ajouter un petit-déjeuner' }).click();
    await page.locator('.bfast-name-input').fill('Croissants');
    await expect(page.locator('.bfast-name-input')).toHaveValue('Croissants');
    await expect(page.locator('#breakfast-items-list')).not.toContainText('Pâtes Carbonara');
});

test('crée un calendrier et assigne un plat à midi, visible directement dans la semaine', async ({ page }) => {
    await createDish(page, 'Pâtes Carbonara', 'Pâtes');
    await createCalendarFromHome(page, 'Semaine test');

    await expect(page.locator('#calendar-active-name')).toHaveText('Semaine test');

    const mercredi = weekDayCard(page, 'Mercredi');
    await expect(mealSlot(mercredi, 'midi')).toContainText('Ajouter un plat');

    await mealSlot(mercredi, 'midi').click();
    await page.locator('#meal-picker-list').getByText('Pâtes Carbonara').click();
    await page.locator('#meal-picker-confirm').click();

    // Le plat choisi est visible directement dans la case, sans avoir à cliquer ailleurs.
    await expect(mealSlot(mercredi, 'midi')).toContainText('Pâtes Carbonara');
    await expect(mealSlot(mercredi, 'soir')).toContainText('Ajouter un plat');
});

test('génère la liste de courses depuis le calendrier (jours + petit-déjeuner)', async ({ page }) => {
    await createDish(page, 'Pâtes Carbonara', 'Pâtes');
    await createCalendarFromHome(page, 'Semaine test');

    const lundi = weekDayCard(page, 'Lundi');
    await mealSlot(lundi, 'midi').click();
    await page.locator('#meal-picker-list').getByText('Pâtes Carbonara').click();
    await page.locator('#meal-picker-confirm').click();

    await mealSlot(lundi, 'soir').click();
    await page.locator('#meal-picker-list').getByText('Pâtes Carbonara').click();
    await page.locator('#meal-picker-confirm').click();

    // Petit-déjeuner : item libre, une seule liste pour la semaine, pas jour par jour.
    await page.getByRole('button', { name: 'Ajouter un petit-déjeuner' }).click();
    await page.locator('.bfast-name-input').fill('Tartines');

    await expect(page.locator('#btn-calendar-generate')).toBeEnabled();
    await page.locator('#btn-calendar-generate').click();

    await expect(page.locator('.shopping-item')).toHaveCount(2);
    const pates = page.locator('.shopping-item', { hasText: 'Pâtes' });
    await expect(pates.locator('.ing-counter')).toHaveText('x2'); // 1x midi + 1x soir
    const tartines = page.locator('.shopping-item', { hasText: 'Tartines' });
    await expect(tartines).toContainText('Petit-déjeuner');
});

test('un calendrier est autosauvegardé et reste sélectionné après rechargement', async ({ page }) => {
    await createDish(page, 'Omelette', 'Œufs');
    await createCalendarFromHome(page, 'Semaine test');

    const lundi = weekDayCard(page, 'Lundi');
    await mealSlot(lundi, 'midi').click();
    await page.locator('#meal-picker-list').getByText('Omelette').click();
    await page.locator('#meal-picker-confirm').click();

    // Aucune action "Sauvegarder" explicite : tout est déjà persisté.
    await page.reload();
    await page.getByRole('button', { name: 'Calendrier', exact: true }).click();
    await expect(page.locator('#calendar-switcher .category-tab', { hasText: 'Semaine test' })).toHaveClass(/active/);
    await expect(page.locator('#calendar-active-name')).toHaveText('Semaine test');
    await expect(mealSlot(weekDayCard(page, 'Lundi'), 'midi')).toContainText('Omelette');

    await page.locator('button[aria-label="Supprimer ce calendrier"]').click();
    await expect(page.getByText('Supprimer ce calendrier ?')).toBeVisible();
    await page.locator('#modal-ok').click();
    await expect(page.getByText('Aucun calendrier sélectionné')).toBeVisible();
});

test('permet de créer plusieurs calendriers et de basculer entre eux via le sélecteur, sans perdre les données', async ({ page }) => {
    await createDish(page, 'Pâtes Carbonara', 'Pâtes');
    await createDish(page, 'Curry de légumes', 'Riz');

    await createCalendarFromHome(page, 'Calendrier A');
    const lundi = weekDayCard(page, 'Lundi');
    await mealSlot(lundi, 'midi').click();
    await page.locator('#meal-picker-list').getByText('Pâtes Carbonara').click();
    await page.locator('#meal-picker-confirm').click();

    // Deuxième calendrier, créé via le "+" du sélecteur (regroupé dans la même vue).
    await page.locator('#calendar-switcher .category-tab-add').click();
    await page.locator('#prompt-name-input').fill('Calendrier B');
    await page.locator('#prompt-name-confirm').click();

    await expect(page.locator('#calendar-active-name')).toHaveText('Calendrier B');
    const mardi = weekDayCard(page, 'Mardi');
    await mealSlot(mardi, 'soir').click();
    await page.locator('#meal-picker-list').getByText('Curry de légumes').click();
    await page.locator('#meal-picker-confirm').click();

    // Rebasculer sur Calendrier A via le sélecteur : ses données à lui sont intactes.
    await page.locator('#calendar-switcher .category-tab', { hasText: 'Calendrier A' }).click();
    await expect(page.locator('#calendar-active-name')).toHaveText('Calendrier A');
    await expect(mealSlot(weekDayCard(page, 'Lundi'), 'midi')).toContainText('Pâtes Carbonara');
    await expect(mealSlot(weekDayCard(page, 'Mardi'), 'soir')).toContainText('Ajouter un plat');
});

test('partage un calendrier puis l\'importe sur un autre appareil', async ({ page, browser }) => {
    await createDish(page, 'Curry de légumes', 'Riz');
    await createCalendarFromHome(page, 'Semaine à partager');

    const jeudi = weekDayCard(page, 'Jeudi');
    await mealSlot(jeudi, 'soir').click();
    await page.locator('#meal-picker-list').getByText('Curry de légumes').click();
    await page.locator('#meal-picker-confirm').click();

    await page.locator('#btn-calendar-share').click();
    await expect(page.locator('#calendar-share-link-input')).toBeVisible();
    const link = await page.locator('#calendar-share-link-input').inputValue();
    expect(link).toContain('?importCalendar=');

    const importContext = await browser.newContext();
    const importPage = await importContext.newPage();
    await importPage.goto(link);

    await expect(importPage.getByText('Importer un calendrier ?')).toBeVisible();
    await importPage.getByRole('button', { name: 'Importer' }).click();
    await importPage.getByText('a été ajouté à').waitFor();
    await importPage.locator('#modal-ok').click();

    // L'import ouvre directement le calendrier reçu.
    await expect(importPage.locator('#calendar-active-name')).toHaveText('Semaine à partager');
    await expect(mealSlot(weekDayCard(importPage, 'Jeudi'), 'soir')).toContainText('Curry de légumes');

    // Générer la liste depuis le calendrier importé doit fonctionner même si le plat
    // n'existe pas dans les recettes locales de cet appareil (utilise l'instantané).
    await importPage.locator('#btn-calendar-generate').click();
    await expect(importPage.locator('.shopping-item')).toHaveCount(1);
    await expect(importPage.locator('.ing-name-title')).toHaveText('Riz');

    await importContext.close();
});

test('la barre d\'onglets du choix de plat reste à sa hauteur normale même avec beaucoup de plats', async ({ page }) => {
    // Avec une grosse liste de plats à afficher, le flex-layout de la modale peut, en l'absence de
    // flex-shrink:0 sur la barre d'onglets, la compresser verticalement (elle se retrouve coupée à
    // mi-hauteur) au profit de la liste de plats. Régression couverte ici en seedant directement
    // localStorage plutôt qu'en créant 20+ plats via l'UI.
    const dishes = Array.from({ length: 25 }, (_, i) => ({
        id: 'd' + i,
        name: 'Plat numero ' + i,
        ingredients: [{ n: 'Ingredient ' + i, q: '1' }],
        categoryId: null,
    }));
    await page.evaluate((dishes) => {
        localStorage.setItem('mes_plats_locaux_v3', JSON.stringify(dishes));
    }, dishes);
    await page.reload();

    await createCalendarFromHome(page, 'Semaine chargée');
    const lundi = weekDayCard(page, 'Lundi');
    await mealSlot(lundi, 'midi').click();

    const tabsHeight = await page.evaluate(() => {
        const el = document.getElementById('meal-picker-tabs');
        return { clientHeight: el.getBoundingClientRect().height, scrollHeight: el.scrollHeight };
    });
    expect(tabsHeight.clientHeight).toBeCloseTo(tabsHeight.scrollHeight, 0);
});
