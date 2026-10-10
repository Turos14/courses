const { test, expect } = require('@playwright/test');

test('la zone de scroll couvre toute la largeur de l\'écran en paysage (iPad)', async ({ page }) => {
    await page.setViewportSize({ width: 1194, height: 834 }); // iPad Pro, paysage
    await page.goto('/');
    await page.getByText('Éditeur de plats').click();

    const mainBox = await page.locator('main').boundingBox();
    const contentBox = await page.locator('.view-section.active').boundingBox();

    // La zone scrollable (main) doit couvrir tout l'écran, pas seulement la
    // colonne de contenu centrée, sinon le scroll ne fonctionne pas si on
    // touche/glisse dans les marges latérales.
    expect(mainBox.width).toBeGreaterThan(1000);

    // Le contenu visible, lui, reste centré et limité en largeur (max-width: 500px).
    expect(contentBox.width).toBeLessThanOrEqual(500);
});

test('"Calendrier" apparaît avant "Éditeur de plats" sur l\'accueil', async ({ page }) => {
    await page.goto('/');
    const labels = await page.locator('.home-menu .btn-home span').allTextContents();
    expect(labels.indexOf('Calendrier')).toBeLessThan(labels.indexOf('Éditeur de plats'));
});

test('le lien vers le portail reste visible en haut à gauche sur tous les écrans', async ({ page }) => {
    await page.goto('/');
    const portalLink = page.locator('a[aria-label="Retour au portail"]');
    await expect(portalLink).toBeVisible();
    await expect(portalLink).toHaveAttribute('href', 'https://apps.home.ithasu.org/');

    await page.getByText('Éditeur de plats').click();
    await expect(portalLink).toBeVisible();
});
