const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test('télécharge une sauvegarde JSON contenant les plats actuels', async ({ page }) => {
    await page.getByText('Éditeur de plats').click();
    await page.getByRole('button', { name: 'Nouveau plat' }).click();
    await page.locator('#dish-name').fill('Ratatouille');
    await page.locator('.ing-name-input').first().fill('Aubergine');
    await page.getByText('Enregistrer le plat').click();
    await page.locator('#btn-back').click();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('.home-backup').getByRole('button', { name: 'Télécharger (.json)' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^mes-courses-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/);

    const content = await download.createReadStream().then(stream => new Promise((resolve, reject) => {
        let data = '';
        stream.on('data', chunk => data += chunk);
        stream.on('end', () => resolve(data));
        stream.on('error', reject);
    }));
    const backup = JSON.parse(content);
    expect(backup.format).toBe('mes-courses-backup');
    expect(backup.dishes).toHaveLength(1);
    expect(backup.dishes[0].name).toBe('Ratatouille');
});

test('restaure une sauvegarde : remplace les données actuelles après confirmation', async ({ page, browser }) => {
    await page.getByText('Éditeur de plats').click();
    await page.getByRole('button', { name: 'Nouveau plat' }).click();
    await page.locator('#dish-name').fill('Quiche Lorraine');
    await page.locator('.ing-name-input').first().fill('Lardons');
    await page.getByText('Enregistrer le plat').click();
    await page.locator('#btn-back').click();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('.home-backup').getByRole('button', { name: 'Télécharger (.json)' }).click();
    const download = await downloadPromise;
    const backupPath = await download.path();

    // Contexte distinct = stockage local vierge (un autre appareil, ou le même après
    // réinstallation), sur lequel on restaure le fichier téléchargé ci-dessus.
    const restoreContext = await browser.newContext();
    const restorePage = await restoreContext.newPage();
    await restorePage.goto('/');

    // Un plat qui ne doit PAS survivre à la restauration (remplacement, pas fusion).
    await restorePage.getByText('Éditeur de plats').click();
    await restorePage.getByRole('button', { name: 'Nouveau plat' }).click();
    await restorePage.locator('#dish-name').fill('Plat À Écraser');
    await restorePage.locator('.ing-name-input').first().fill('X');
    await restorePage.getByText('Enregistrer le plat').click();
    await restorePage.locator('#btn-back').click();

    await restorePage.locator('#backup-file-input').setInputFiles(backupPath);
    await expect(restorePage.getByText('Restaurer cette sauvegarde')).toBeVisible();
    await restorePage.getByRole('button', { name: 'Restaurer' }).click();
    await restorePage.locator('#modal-ok').click();

    await restorePage.getByText('Éditeur de plats').click();
    await expect(restorePage.locator('.dish-card')).toHaveCount(1);
    await expect(restorePage.locator('.dish-card h3')).toHaveText('Quiche Lorraine');

    await restoreContext.close();
});

test('un fichier invalide affiche un message d\'erreur sans modifier les données', async ({ page }) => {
    await page.getByText('Éditeur de plats').click();
    await page.getByRole('button', { name: 'Nouveau plat' }).click();
    await page.locator('#dish-name').fill('Omelette');
    await page.locator('.ing-name-input').first().fill('Oeufs');
    await page.getByText('Enregistrer le plat').click();
    await page.locator('#btn-back').click();

    await page.setInputFiles('#backup-file-input', {
        name: 'invalide.json',
        mimeType: 'application/json',
        buffer: Buffer.from('ceci n\'est pas du json'),
    });

    await expect(page.getByText('Ce fichier ne semble pas être une sauvegarde valide.')).toBeVisible();
    await page.locator('#modal-ok').click();

    await page.getByText('Éditeur de plats').click();
    await expect(page.locator('.dish-card')).toHaveCount(1);
    await expect(page.locator('.dish-card h3')).toHaveText('Omelette');
});
