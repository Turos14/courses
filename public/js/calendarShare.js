// --- IMPORT D'UN CALENDRIER PARTAGÉ (ANCIEN LIEN) ---
// L'export (QR/lien de partage) a été retiré (bouton "Partager" du calendrier supprimé —
// la sauvegarde/restauration JSON de js/backup.js couvre désormais ce besoin), mais on garde
// la capacité d'IMPORTER un `?importCalendar=...` : un lien déjà envoyé avant ce retrait (ou
// une icône installée sur un écran d'accueil via ce lien, voir js/share.js) doit continuer à
// fonctionner plutôt que de casser silencieusement.

// Voir js/share.js (checkURLForImport) pour le détail : même garde-fou, pour qu'un lien
// de calendrier utilisé pour "installer" l'app à l'écran d'accueil ne redemande pas
// l'import à chaque lancement (l'URL figée par iOS est rejouée telle quelle à chaque
// ouverture de l'icône).
var IMPORT_CALENDAR_LINKS_SEEN_KEY = 'mes_liens_import_calendrier_vus_v1';

function wasCalendarImportLinkAlreadyHandled(importData) {
    try {
        return JSON.parse(localStorage.getItem(IMPORT_CALENDAR_LINKS_SEEN_KEY) || '[]').indexOf(importData) !== -1;
    } catch (e) {
        return false;
    }
}

function markCalendarImportLinkAsHandled(importData) {
    var seen;
    try {
        seen = JSON.parse(localStorage.getItem(IMPORT_CALENDAR_LINKS_SEEN_KEY) || '[]');
    } catch (e) {
        seen = [];
    }
    seen.push(importData);
    if (seen.length > 20) seen = seen.slice(seen.length - 20);
    localStorage.setItem(IMPORT_CALENDAR_LINKS_SEEN_KEY, JSON.stringify(seen));
}

function checkURLForCalendarImport() {
    var urlParams = new URLSearchParams(window.location.search);
    var importData = urlParams.get('importCalendar');
    if (!importData) return;

    if (wasCalendarImportLinkAlreadyHandled(importData)) {
        cleanURL();
        return;
    }
    // Voir js/share.js (checkURLForImport) : volontairement pas marqué "géré" ici, pour ne
    // pas griller ce lien à usage unique si iOS charge la page en arrière-plan pour un aperçu
    // de lien (appui long) sans qu'un humain ne voie la modale. On marque seulement au moment
    // où l'import est réellement confirmé, ci-dessous.

    try {
        var jsonStr = decodeURIComponent(escape(atob(importData)));
        var parsed = JSON.parse(jsonStr);
        pendingImportedCalendar = parsed;

        var dayCount = Object.keys(parsed.a || {}).filter(function (key) {
            var a = parsed.a[key] || {};
            return (a.midi && a.midi.length) || (a.soir && a.soir.length);
        }).length;

        showCustomModal(
            '📥 Importer un calendrier ?',
            `Voulez-vous ajouter "${parsed.n}" (${dayCount} jour(s) planifié(s)) à "Mes calendriers" ?`,
            function () {
                var entry = {
                    id: 'cal-' + Date.now(),
                    name: parsed.n,
                    createdAt: new Date().toISOString(),
                    origin: 'imported',
                    assignments: parsed.a || {},
                    breakfastItems: parsed.b || [],
                    customIngredients: [],
                    dishesSnapshot: parsed.d || {}
                };
                window.savedCalendars.push(entry);
                window.activeCalendarId = entry.id;
                saveLocalData();
                markCalendarImportLinkAsHandled(importData);
                cleanURL();
                showCustomModal('Succès !', `"${entry.name}" a été ajouté à "Mes calendriers".`, function () {
                    window.navigate('view-calendar');
                }, false);
            },
            true,
            'Importer',
            '#10b981'
        );
    } catch (e) {
        showCustomModal('Échec de l\'import', 'Le lien de calendrier partagé semble invalide.', cleanURL, false);
    }
}
