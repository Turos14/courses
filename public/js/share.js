// --- IMPORT DE RECETTES PARTAGÉES (ANCIEN LIEN) ---
// L'export (QR/lien de partage, bouton "Partager mes recettes") a été retiré — la
// sauvegarde/restauration JSON de js/backup.js couvre désormais ce besoin — mais on garde
// la capacité d'IMPORTER un `?import=...` : un lien déjà envoyé avant ce retrait (ou une
// icône installée sur un écran d'accueil via un tel lien) doit continuer à fonctionner
// plutôt que de casser silencieusement.
var IMPORT_LINKS_SEEN_KEY = 'mes_liens_import_vus_v1';

function wasImportLinkAlreadyHandled(importData) {
    try {
        return JSON.parse(localStorage.getItem(IMPORT_LINKS_SEEN_KEY) || '[]').indexOf(importData) !== -1;
    } catch (e) {
        return false;
    }
}

function markImportLinkAsHandled(importData) {
    var seen;
    try {
        seen = JSON.parse(localStorage.getItem(IMPORT_LINKS_SEEN_KEY) || '[]');
    } catch (e) {
        seen = [];
    }
    seen.push(importData);
    if (seen.length > 20) seen = seen.slice(seen.length - 20);
    localStorage.setItem(IMPORT_LINKS_SEEN_KEY, JSON.stringify(seen));
}

var pendingImportRawPayload = null;

function checkURLForImport() {
    var urlParams = new URLSearchParams(window.location.search);
    var importData = urlParams.get('import');
    if (importData) {
        if (wasImportLinkAlreadyHandled(importData)) {
            cleanURL();
            return;
        }
        // Volontairement PAS marqué comme "vu" ici : iOS charge silencieusement la page en
        // arrière-plan pour générer l'aperçu quand on fait un appui long sur un lien (Messages,
        // Notes...), ce qui exécuterait ce code sans qu'un humain ne voie jamais la modale. Si on
        // marquait "vu" à ce stade, cet aperçu invisible grillerait le lien à usage unique avant
        // même que l'utilisateur n'ouvre réellement la page — la modale ne s'afficherait alors
        // plus jamais. On ne marque donc comme géré qu'au moment où l'utilisateur confirme ou
        // rejette réellement l'import (voir confirmImportDishes / rejectImport ci-dessous).
        pendingImportRawPayload = importData;
        try {
            var jsonStr = decodeURIComponent(escape(atob(importData)));
            var parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed)) {
                pendingImportedDishes = parsed.map(function (item, idx) {
                    return {
                        id: 'imported-' + Date.now() + '-' + idx,
                        name: item.n,
                        ingredients: item.i.map(ing => ({ n: ing.n, q: ing.q || '' })),
                        categoryName: item.c || null
                    };
                });
                var previewContainer = document.getElementById('import-preview-list');
                previewContainer.innerHTML = '';
                pendingImportedDishes.forEach(function (d) {
                    var div = document.createElement('div');
                    var catSuffix = d.categoryName ? ', ' + d.categoryName : '';
                    div.innerHTML = `• <strong>${d.name}</strong> <span style="color:#6b7280; font-size:0.75rem;">(${d.ingredients.length} ingr.${catSuffix})</span>`;
                    previewContainer.appendChild(div);
                });
                document.getElementById('modal-import').classList.remove('hidden');
            }
        } catch (e) {
            showCustomModal('Échec de l\'import', 'Le lien de partage semble invalide.', cleanURL, false);
        }
    }
}

window.confirmImportDishes = function () {
    if (pendingImportedDishes.length > 0) {
        var categoryIdByName = {};
        window.categories.forEach(function (cat) { categoryIdByName[cat.name.toLowerCase()] = cat.id; });
        var newCategoryCounter = 0;

        pendingImportedDishes.forEach(function (newDish) {
            var exists = window.dishes.some(function (oldDish) {
                return oldDish.name.toLowerCase() === newDish.name.toLowerCase();
            });
            if (exists) return;

            var categoryId = null;
            if (newDish.categoryName) {
                var key = newDish.categoryName.toLowerCase();
                if (!categoryIdByName[key]) {
                    var newCat = { id: 'cat-' + Date.now() + '-' + (newCategoryCounter++), name: newDish.categoryName };
                    window.categories.push(newCat);
                    categoryIdByName[key] = newCat.id;
                }
                categoryId = categoryIdByName[key];
            }
            window.dishes.push({ id: newDish.id, name: newDish.name, ingredients: newDish.ingredients, categoryId: categoryId });
        });
        saveLocalData();
        if (pendingImportRawPayload) { markImportLinkAsHandled(pendingImportRawPayload); pendingImportRawPayload = null; }
        document.getElementById('modal-import').classList.add('hidden');
        showCustomModal('Succès !', `${pendingImportedDishes.length} plat(s) intégré(s).`, function () {
            cleanURL();
            window.renderEditorList();
        }, false);
    }
};

window.rejectImport = function () {
    if (pendingImportRawPayload) { markImportLinkAsHandled(pendingImportRawPayload); pendingImportRawPayload = null; }
    document.getElementById('modal-import').classList.add('hidden');
    cleanURL();
};

function cleanURL() {
    var cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
}
