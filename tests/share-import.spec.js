const { test, expect } = require('@playwright/test');

// Le bouton "Partager mes recettes" (export QR/lien) a été retiré — la sauvegarde/
// restauration JSON (js/backup.js) couvre ce besoin désormais — mais l'app doit continuer
// à importer un lien ?import=... déjà envoyé avant ce retrait (ou une icône installée sur
// un écran d'accueil via un tel lien). Ces tests construisent donc ce lien directement,
// dans le même format que l'ancien export, plutôt que de passer par une UI qui n'existe
// plus.
function buildImportLink(dishes) {
    const payload = dishes.map(d => ({ n: d.name, i: d.ingredients, c: d.categoryName || null }));
    const base64 = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');
    return '/?import=' + encodeURIComponent(base64);
}

test('importe des recettes depuis un lien ?import= (ancien format de partage)', async ({ page }) => {
    const link = buildImportLink([
        { name: 'Curry de légumes', ingredients: [{ n: 'Riz', q: '' }, { n: 'Poulet', q: '' }] },
    ]);
    await page.goto(link);

    await expect(page.locator('#modal-import')).toBeVisible();
    await expect(page.locator('#import-preview-list')).toContainText('Curry de légumes');

    await page.locator('#modal-import').getByRole('button', { name: 'Importer' }).click();
    await page.getByText('intégré(s)').waitFor();
    await page.locator('#modal-ok').click();
    await page.getByText('Éditeur de plats').click();
    await expect(page.locator('.dish-card')).toHaveCount(1);
    await expect(page.locator('.dish-card h3')).toHaveText('Curry de légumes');
});

test('un lien d\'import utilisé pour "installer" l\'app ne redemande pas l\'import à chaque relancement', async ({ page }) => {
    const link = buildImportLink([{ name: 'Tarte aux pommes', ingredients: [{ n: 'Pommes', q: '' }] }]);

    // Simule l'icône installée sur l'écran d'accueil : iOS rejoue cette même URL (avec
    // ?import=...) telle quelle à chaque ouverture, d'où la même page réutilisée pour les
    // deux "lancements" ci-dessous.
    await page.goto(link);
    await expect(page.locator('#modal-import')).toBeVisible();
    await page.locator('#modal-import').getByRole('button', { name: 'Importer' }).click();
    await page.getByText('intégré(s)').waitFor();
    await page.locator('#modal-ok').click();

    // Deuxième "ouverture de l'icône" : même lien, le plat est déjà importé.
    await page.goto(link);
    await expect(page.locator('#modal-import')).not.toBeVisible();
    await page.getByText('Éditeur de plats').click();
    await expect(page.locator('.dish-card')).toHaveCount(1);
});

test('charger un lien d\'import sans le confirmer ne le "consomme" pas (aperçu de lien iOS)', async ({ page }) => {
    // iOS charge une page en arrière-plan (tout son JS inclus) pour générer l'aperçu d'un lien
    // lors d'un appui long dans Messages/Notes, sans qu'un humain ne voie/ferme la modale. Le
    // lien d'import étant à usage unique (voir le test précédent), le marquer "géré" dès le
    // simple chargement de la page griffe définitivement ce lien avant même que l'utilisateur
    // ne l'ouvre pour de vrai — la modale ne s'afficherait alors plus jamais, nulle part.
    const link = buildImportLink([{ name: 'Gratin dauphinois', ingredients: [{ n: 'Pommes de terre', q: '' }] }]);

    // "Aperçu" : la page se charge, mais personne ne confirme/rejette la modale.
    await page.goto(link);
    await expect(page.locator('#modal-import')).toBeVisible();

    // Ouverture "pour de vrai" ensuite (même lien) : la modale doit encore s'afficher.
    await page.goto(link);
    await expect(page.locator('#modal-import')).toBeVisible();
    await page.locator('#modal-import').getByRole('button', { name: 'Importer' }).click();
    await page.getByText('intégré(s)').waitFor();
});

test('un import invalide affiche un message d\'erreur', async ({ page }) => {
    await page.goto('/?import=%20%20pas-du-base64-valide%20%20');
    await expect(page.getByText('Le lien de partage semble invalide.')).toBeVisible();
});
