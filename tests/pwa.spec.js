const { test, expect } = require('@playwright/test');

// Vérifie que l'app reste installable sur l'écran d'accueil (iOS 15+ et Android)
// en mode plein écran : balises meta Apple + manifest, et que les fichiers
// qu'elles référencent existent réellement (pas de lien mort après un renommage).

test('les balises d\'installation sur l\'écran d\'accueil sont présentes', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'Mes Courses');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#2563eb');

    const appleTouchIcon = page.locator('link[rel="apple-touch-icon"]');
    await expect(appleTouchIcon).toHaveAttribute('sizes', '180x180');

    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
});

test('l\'icône apple-touch-icon et le manifest sont servis correctement', async ({ page, request, baseURL }) => {
    await page.goto('/');

    const iconHref = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    const iconResponse = await request.get(new URL(iconHref, baseURL).toString());
    expect(iconResponse.ok()).toBeTruthy();
    expect(iconResponse.headers()['content-type']).toContain('image/png');

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifestResponse = await request.get(new URL(manifestHref, baseURL).toString());
    expect(manifestResponse.ok()).toBeTruthy();

    const manifest = await manifestResponse.json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.length).toBeGreaterThan(0);

    for (const icon of manifest.icons) {
        const res = await request.get(new URL(icon.src, baseURL).toString());
        expect(res.ok()).toBeTruthy();
    }
});

// Sur iOS, une app installée sur l'écran d'accueil reste souvent suspendue en
// arrière-plan au lieu d'être déchargée/rechargée : revenir dessus ne relance pas
// window.onload. Sans resynchronisation sur "retour au premier plan", un plat ajouté
// pendant ce temps depuis Safari (même site, même stockage) n'apparaîtrait donc pas
// tant que l'app installée n'est pas relancée manuellement.
test('les données ajoutées pendant que la page était en arrière-plan apparaissent au retour au premier plan', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Éditeur de plats').click();
    await expect(page.getByText('Plat Ajouté En Arrière-Plan')).toHaveCount(0);

    await page.evaluate(() => {
        const dishes = JSON.parse(localStorage.getItem('mes_plats_locaux_v3') || '[]');
        dishes.push({ id: 'test-resume-1', name: 'Plat Ajouté En Arrière-Plan', ingredients: [], categoryId: null });
        localStorage.setItem('mes_plats_locaux_v3', JSON.stringify(dishes));
    });

    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

    await expect(page.getByText('Plat Ajouté En Arrière-Plan')).toBeVisible();
});
