const { test, expect } = require('@playwright/test');

test('génère un lien de partage puis importe la recette sur un autre appareil', async ({ page, browser }) => {
    await page.goto('/');
    await page.getByText('Éditeur de plats').click();
    await page.getByRole('button', { name: 'Nouveau plat' }).click();
    await page.locator('#dish-name').fill('Curry de légumes');
    await page.locator('.ing-name-input').first().fill('Riz');
    await page.getByRole('button', { name: 'Ajouter un ingrédient', exact: true }).click();
    await page.locator('.ing-name-input').nth(1).fill('Poulet');
    await page.getByText('Enregistrer le plat').click();

    await page.getByRole('button', { name: 'Partager mes recettes' }).click();
    await expect(page.locator('#modal-share')).toBeVisible();
    const link = await page.locator('#share-link-input').inputValue();
    expect(link).toContain('?import=');

    // Contexte de navigateur distinct = stockage local vierge, comme un autre appareil.
    const importContext = await browser.newContext();
    const importPage = await importContext.newPage();
    await importPage.goto(link);

    await expect(importPage.locator('#modal-import')).toBeVisible();
    await expect(importPage.locator('#import-preview-list')).toContainText('Curry de légumes');

    await importPage.locator('#modal-import').getByRole('button', { name: 'Importer' }).click();
    await importPage.getByText('intégré(s)').waitFor();
    await importPage.locator('#modal-ok').click();
    await importPage.getByText('Éditeur de plats').click();
    await expect(importPage.locator('.dish-card')).toHaveCount(1);
    await expect(importPage.locator('.dish-card h3')).toHaveText('Curry de légumes');

    await importContext.close();
});

test('un lien d\'import utilisé pour "installer" l\'app ne redemande pas l\'import à chaque relancement', async ({ page, browser }) => {
    await page.goto('/');
    await page.getByText('Éditeur de plats').click();
    await page.getByRole('button', { name: 'Nouveau plat' }).click();
    await page.locator('#dish-name').fill('Tarte aux pommes');
    await page.locator('.ing-name-input').first().fill('Pommes');
    await page.getByText('Enregistrer le plat').click();

    await page.getByRole('button', { name: 'Partager mes recettes' }).click();
    const link = await page.locator('#share-link-input').inputValue();

    // Simule l'icône installée sur l'écran d'accueil : iOS rejoue cette même URL (avec
    // ?import=...) telle quelle à chaque ouverture, d'où un seul contexte/stockage réutilisé
    // pour les deux "lancements" ci-dessous.
    const installContext = await browser.newContext();
    const installPage = await installContext.newPage();

    await installPage.goto(link);
    await expect(installPage.locator('#modal-import')).toBeVisible();
    await installPage.locator('#modal-import').getByRole('button', { name: 'Importer' }).click();
    await installPage.getByText('intégré(s)').waitFor();
    await installPage.locator('#modal-ok').click();

    // Deuxième "ouverture de l'icône" : même lien, le plat est déjà importé.
    await installPage.goto(link);
    await expect(installPage.locator('#modal-import')).not.toBeVisible();
    await installPage.getByText('Éditeur de plats').click();
    await expect(installPage.locator('.dish-card')).toHaveCount(1);

    await installContext.close();
});

test('charger un lien d\'import sans le confirmer ne le "consomme" pas (aperçu de lien iOS)', async ({ page, browser }) => {
    // iOS charge une page en arrière-plan (tout son JS inclus) pour générer l'aperçu d'un lien
    // lors d'un appui long dans Messages/Notes, sans qu'un humain ne voie/ferme la modale. Le
    // lien d'import étant à usage unique (voir le test précédent), le marquer "géré" dès le
    // simple chargement de la page griffe définitivement ce lien avant même que l'utilisateur
    // ne l'ouvre pour de vrai — la modale ne s'afficherait alors plus jamais, nulle part.
    await page.goto('/');
    await page.getByText('Éditeur de plats').click();
    await page.getByRole('button', { name: 'Nouveau plat' }).click();
    await page.locator('#dish-name').fill('Gratin dauphinois');
    await page.locator('.ing-name-input').first().fill('Pommes de terre');
    await page.getByText('Enregistrer le plat').click();

    await page.getByRole('button', { name: 'Partager mes recettes' }).click();
    const link = await page.locator('#share-link-input').inputValue();

    const context = await browser.newContext();
    const importPage = await context.newPage();

    // "Aperçu" : la page se charge, mais personne ne confirme/rejette la modale.
    await importPage.goto(link);
    await expect(importPage.locator('#modal-import')).toBeVisible();

    // Ouverture "pour de vrai" ensuite (même lien) : la modale doit encore s'afficher.
    await importPage.goto(link);
    await expect(importPage.locator('#modal-import')).toBeVisible();
    await importPage.locator('#modal-import').getByRole('button', { name: 'Importer' }).click();
    await importPage.getByText('intégré(s)').waitFor();

    await context.close();
});

test('un import invalide affiche un message d\'erreur', async ({ page }) => {
    await page.goto('/?import=%20%20pas-du-base64-valide%20%20');
    await expect(page.getByText('Le lien de partage semble invalide.')).toBeVisible();
});

test('utilise le partage natif (feuille de partage système) quand il est disponible, plutôt que le QR code', async ({ page }) => {
    await page.addInitScript(() => {
        window.__nativeShareCalls = [];
        navigator.share = (data) => {
            window.__nativeShareCalls.push(data);
            return Promise.resolve();
        };
    });
    await page.goto('/');
    await page.getByText('Éditeur de plats').click();
    await page.getByRole('button', { name: 'Nouveau plat' }).click();
    await page.locator('#dish-name').fill('Soupe de courgettes');
    await page.locator('.ing-name-input').first().fill('Courgette');
    await page.getByText('Enregistrer le plat').click();

    await page.getByRole('button', { name: 'Partager mes recettes' }).click();

    const calls = await page.evaluate(() => window.__nativeShareCalls);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('?import=');
    expect(calls[0].title).toBeTruthy();
    await expect(page.locator('#modal-share')).not.toBeVisible();
});

test('bascule sur le QR/lien sans appeler le partage natif quand les données sont trop volumineuses (évite un crash navigateur)', async ({ page }) => {
    await page.addInitScript(() => {
        window.__nativeShareCalls = [];
        navigator.share = (data) => {
            window.__nativeShareCalls.push(data);
            return Promise.resolve();
        };
    });
    await page.goto('/');

    // Un grand nombre de plats fait dépasser le seuil de sécurité (8000 caractères) avant même
    // d'atteindre une taille qui ferait planter certains navigateurs sur navigator.share().
    await page.evaluate(() => {
        window.dishes = Array.from({ length: 60 }, (_, i) => ({
            id: 'd' + i,
            name: 'Plat numero ' + i + ' avec un nom assez descriptif',
            ingredients: [{ n: 'Ingredient ' + i, q: '200g' }],
            categoryId: null,
        }));
        window.categories = [];
    });

    await page.getByText('Éditeur de plats').click();
    await page.getByRole('button', { name: 'Partager mes recettes' }).click();

    const calls = await page.evaluate(() => window.__nativeShareCalls);
    expect(calls).toHaveLength(0);
    await expect(page.locator('#modal-share')).toBeVisible();
    const link = await page.locator('#share-link-input').inputValue();
    expect(link).toContain('?import=');
});
