// --- EXPORT ET IMPORT D'UN CALENDRIER PAR QR CODE ---
// Même principe que js/share.js (base64 dans l'URL) mais avec un paramètre distinct
// (`?importCalendar=`) pour ne pas entrer en conflit avec le partage de recettes (`?import=`).
window.shareCalendarEntry = function (entry) {
    try {
        var payload = {
            n: entry.name,
            a: entry.assignments,
            b: entry.breakfastItems,
            d: entry.dishesSnapshot
        };
        var jsonStr = JSON.stringify(payload);
        var base64Str = btoa(unescape(encodeURIComponent(jsonStr)));
        var shareUrl = window.location.origin + window.location.pathname + '?importCalendar=' + encodeURIComponent(base64Str);

        // Le partage natif (Mail, Messages, etc. via la feuille de partage du système) n'a pas la limite de
        // taille d'un QR code : on le préfère quand il est disponible plutôt que de toujours passer par la
        // modale QR/lien ci-dessous. Mais au-delà d'un certain volume de données, certains navigateurs
        // (Chrome/Android notamment) tuent carrément l'onglet (crash "RESULT_CODE_KILLED_BAD_MESSAGE") au lieu
        // de simplement rejeter l'appel — voir js/share.js pour le détail. Cette marge de sécurité évite
        // d'appeler navigator.share() dans ce cas et bascule sur le QR/lien (sans risque) à la place.
        var NATIVE_SHARE_MAX_BYTES = 8000;
        if (navigator.share && shareUrl.length <= NATIVE_SHARE_MAX_BYTES) {
            navigator.share({
                title: 'Mon calendrier de repas',
                text: `Voici mon calendrier "${entry.name}" !`,
                url: shareUrl
            }).catch(function (err) {
                if (err && err.name !== 'AbortError') console.error('Erreur partage natif calendrier : ', err);
            });
            return;
        }

        // Voir js/share.js pour le détail : au-delà de 2953 octets (capacité max d'un QR en mode "byte",
        // niveau de correction 'L'), QRious tronque silencieusement les données au lieu de lever une erreur
        // -> un QR qui a l'air normal mais renvoie un lien coupé à l'import. On bascule sur "lien seul" avant
        // d'atteindre ce cas plutôt que de laisser QRious produire un QR corrompu.
        var QR_MAX_BYTES = 2953;
        var tooLarge = shareUrl.length > QR_MAX_BYTES;
        var qrBlockHtml = tooLarge
            ? `<div style="background: #fffbeb; padding: 12px; border-radius: 16px; margin: 16px 0; border: 1px solid #fde68a; color: #92400e; font-size: 0.8rem;">Trop de plats/jours planifiés pour un QR code fiable. Utilisez le lien ci-dessous à la place.</div>`
            : `<div style="background: #f9fafb; padding: 16px; border-radius: 20px; margin: 16px 0; border: 1px solid #e5e7eb; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 8px;">
                        <canvas id="calendar-share-qr-canvas" style="width: 200px; height: 200px; display: block; cursor: zoom-in;"></canvas>
                        <span style="font-size: 0.7rem; color: #9ca3af;">Toucher le code pour l'agrandir</span>
                    </div>`;

        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-content" style="max-width: 380px;">
                <div class="modal-title">📤 Transmettre "${entry.name}"</div>
                <div class="modal-body" style="font-size: 0.85rem; line-height: 1.4; color: #4b5563;">
                    Flashez ce code pour recevoir ce calendrier (plats + jours) sur un autre appareil !
                    ${qrBlockHtml}
                    <input type="text" id="calendar-share-link-input" readonly class="form-input" value="${shareUrl}"
                        style="font-size: 0.75rem; text-align: center; margin-bottom: 4px; padding: 10px;">
                </div>
                <div class="modal-buttons" style="margin-top: 16px;">
                    <button class="btn-modal btn-modal-cancel" id="calendar-share-close">Fermer</button>
                    <button class="btn-modal btn-modal-confirm" id="calendar-share-copy" style="background-color: #2563eb;">Copier le lien</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        if (!tooLarge) {
            new QRious({
                element: overlay.querySelector('#calendar-share-qr-canvas'),
                value: shareUrl,
                size: 250,
                level: 'L'
            });
            overlay.querySelector('#calendar-share-qr-canvas').onclick = function () { window.openFullscreenQR(shareUrl); };
        }

        overlay.querySelector('#calendar-share-close').onclick = function () { overlay.remove(); };
        overlay.querySelector('#calendar-share-copy').onclick = function () {
            var input = overlay.querySelector('#calendar-share-link-input');
            input.select();
            var btn = overlay.querySelector('#calendar-share-copy');
            navigator.clipboard.writeText(input.value).then(function () {
                btn.textContent = 'Copié !';
                btn.style.backgroundColor = '#10b981';
                setTimeout(function () {
                    btn.textContent = 'Copier le lien';
                    btn.style.backgroundColor = '#2563eb';
                }, 2000);
            }).catch(function () { });
        };
    } catch (e) {
        console.error('Erreur génération QR Code calendrier : ', e);
    }
};

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
