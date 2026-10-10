// --- EXPORT ET IMPORT (partage natif si dispo, sinon QR code / lien) ---
function buildDishesShareUrl() {
    var categoryNameById = {};
    window.categories.forEach(function (cat) { categoryNameById[cat.id] = cat.name; });
    var compressedData = window.dishes.map(function (d) {
        return {
            n: d.name,
            i: d.ingredients.map(ing => ({ n: ing.n, q: ing.q })),
            c: d.categoryId ? (categoryNameById[d.categoryId] || null) : null
        };
    });
    var jsonStr = JSON.stringify(compressedData);
    var base64Str = btoa(unescape(encodeURIComponent(jsonStr)));
    return window.location.origin + window.location.pathname + '?import=' + encodeURIComponent(base64Str);
}

window.generateShareQRCode = function () {
    if (window.dishes.length === 0) {
        showCustomModal('Export impossible', 'Vous devez avoir au moins une recette à transmettre.', null, false);
        return;
    }
    try {
        var shareUrl = buildDishesShareUrl();

        // Le partage natif (Mail, Messages, etc. via la feuille de partage du système) n'a pas la limite de
        // taille d'un QR code : on le préfère quand il est disponible (Safari/Chrome mobile) plutôt que de
        // toujours passer par le QR/lien. Mais au-delà d'un certain volume de données, certains navigateurs
        // (Chrome/Android notamment) tuent carrément l'onglet (crash "RESULT_CODE_KILLED_BAD_MESSAGE") au lieu
        // de simplement rejeter l'appel — cette marge de sécurité évite d'appeler navigator.share() dans ce
        // cas et bascule sur le QR/lien (sans risque, lui, quelle que soit la taille) à la place.
        var NATIVE_SHARE_MAX_BYTES = 8000;
        if (navigator.share && shareUrl.length <= NATIVE_SHARE_MAX_BYTES) {
            navigator.share({
                title: 'Mes recettes',
                text: `Voici mes recettes (${window.dishes.length} plat(s)) !`,
                url: shareUrl
            }).catch(function (err) {
                if (err && err.name !== 'AbortError') console.error('Erreur partage natif : ', err);
            });
            return;
        }

        showShareLinkModal(shareUrl);
    } catch (e) {
        console.error("Erreur génération QR Code : ", e);
    }
};

function showShareLinkModal(shareUrl) {
    document.getElementById('share-link-input').value = shareUrl;

    // Un QR code plafonne à 2953 octets en mode "byte" au niveau de correction 'L' (le plus dense qu'on
    // utilise) : au-delà, QRious ne lève PAS d'erreur, il tronque silencieusement les données. Le QR
    // généré a l'air normal et se scanne très bien, mais renvoie un lien coupé -> import cassé côté
    // destinataire, sans aucun signe côté expéditeur. Il faut donc vérifier la taille nous-mêmes et
    // basculer sur "lien seul" plutôt que de laisser QRious produire un QR corrompu.
    var QR_MAX_BYTES = 2953;
    if (shareUrl.length > QR_MAX_BYTES) {
        document.getElementById('share-qr-container').classList.add('hidden');
        var warning = document.getElementById('share-qr-warning');
        warning.textContent = `Trop de recettes (${window.dishes.length}) pour un QR code fiable. Utilisez le lien ci-dessous à la place.`;
        warning.classList.remove('hidden');
    } else {
        document.getElementById('share-qr-container').classList.remove('hidden');
        document.getElementById('share-qr-warning').classList.add('hidden');
        new QRious({
            element: document.getElementById('share-qr-canvas'),
            value: shareUrl,
            size: 250,
            level: 'L'
        });
    }
    document.getElementById('modal-share').classList.remove('hidden');
}

window.closeShareModal = function () {
    document.getElementById('modal-share').classList.add('hidden');
};

window.copyShareLink = function () {
    var input = document.getElementById('share-link-input');
    input.select();
    try {
        navigator.clipboard.writeText(input.value);
        var btn = document.getElementById('btn-copy-link');
        btn.textContent = 'Copié !';
        btn.style.backgroundColor = '#10b981';
        setTimeout(function () {
            btn.textContent = 'Copier le lien';
            btn.style.backgroundColor = '#2563eb';
        }, 2000);
    } catch (err) {
        showCustomModal('Info', 'Veuillez copier manuellement le lien affiché.', null, false);
    }
};

// Un lien de partage de recettes peut aussi servir à "installer" l'app sur l'écran
// d'accueil avec les recettes déjà à jour (ouvrir ce lien dans Safari, puis "Sur l'écran
// d'accueil" depuis cette page) : l'URL de lancement d'une icône ajoutée à l'écran
// d'accueil est figée pour toujours (iOS la rejoue telle quelle à chaque ouverture ;
// cleanURL() ne modifie que l'historique de LA session en cours, pas ce que l'icône
// relance la fois suivante). Sans ce garde-fou, la modale d'import réapparaîtrait à
// chaque lancement de l'app installée au lieu de ne proposer l'import qu'une fois.
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
