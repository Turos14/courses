// --- SAUVEGARDE COMPLÈTE (export/import JSON) ---
// Contrairement à js/share.js (recettes seules, lien/QR, fusion additive — pensé pour
// transmettre des recettes à quelqu'un d'autre), ceci exporte/restaure TOUT l'état de
// l'app (plats, catégories, calendriers, liste de courses) dans un vrai fichier .json
// téléchargé/importé localement : une sauvegarde/restauration d'un seul appareil, pas un
// partage — importer une sauvegarde REMPLACE les données actuelles plutôt que de les
// fusionner.
var BACKUP_FORMAT = 'mes-courses-backup';
var BACKUP_FORMAT_VERSION = 1;

window.downloadBackup = function () {
    var backup = {
        format: BACKUP_FORMAT,
        version: BACKUP_FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        dishes: window.dishes,
        categories: window.categories,
        savedCalendars: window.savedCalendars,
        activeCalendarId: window.activeCalendarId,
        shoppingListItems: window.shoppingListItems,
        shoppingListChecked: Array.from(window.shoppingListChecked)
    };

    var blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'mes-courses-sauvegarde-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
};

window.handleBackupFileSelected = function (event) {
    var file = event.target.files && event.target.files[0];
    event.target.value = ''; // permet de resélectionner le même fichier une deuxième fois
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function () {
        var parsed;
        try {
            parsed = JSON.parse(reader.result);
        } catch (e) {
            parsed = null;
        }
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.dishes)) {
            showCustomModal('Échec de la restauration', 'Ce fichier ne semble pas être une sauvegarde valide.', null, false);
            return;
        }

        var dateSuffix = parsed.exportedAt ? ' (exportée le ' + new Date(parsed.exportedAt).toLocaleDateString('fr-FR') + ')' : '';
        showCustomModal(
            '♻️ Restaurer cette sauvegarde ?',
            'Cela va REMPLACER toutes vos données actuelles (plats, catégories, calendriers, liste de courses) par celles de ce fichier' + dateSuffix + '. Cette action est irréversible.',
            function () { applyBackup(parsed); },
            true,
            'Restaurer',
            '#2563eb'
        );
    };
    reader.readAsText(file);
};

function applyBackup(parsed) {
    window.dishes = Array.isArray(parsed.dishes) ? parsed.dishes : [];
    window.categories = Array.isArray(parsed.categories) ? parsed.categories : [];
    window.savedCalendars = Array.isArray(parsed.savedCalendars) ? parsed.savedCalendars : [];
    window.activeCalendarId = parsed.activeCalendarId || null;
    window.shoppingListItems = Array.isArray(parsed.shoppingListItems) ? parsed.shoppingListItems : [];
    window.shoppingListChecked = new Set(Array.isArray(parsed.shoppingListChecked) ? parsed.shoppingListChecked : []);
    // Un filtre d'onglet pointant vers une catégorie absente de la sauvegarde restaurée
    // afficherait une liste vide sans explication plutôt qu'une erreur ; on repart sur "Tous".
    window.activeCategoryFilter = null;
    window.activeMealPickerCategoryFilter = null;

    saveLocalData();
    showCustomModal('Sauvegarde restaurée !', 'Vos données ont été remplacées avec succès.', null, false);
}
