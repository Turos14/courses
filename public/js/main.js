// --- POINT D'ENTRÉE ---
window.onload = function () {
    loadLocalData();
    checkURLForImport();
    checkURLForCalendarImport();
};

// Une app installée sur l'écran d'accueil (iOS) reste souvent suspendue en
// arrière-plan au lieu d'être déchargée : revenir dessus ne relance pas
// window.onload, donc l'état JS en mémoire peut rester figé sur ce qu'il
// était à l'ouverture même si un plat/calendrier a été ajouté entre-temps
// depuis Safari ou un autre onglet du même site. On resynchronise donc
// depuis localStorage à chaque retour au premier plan.
function refreshFromStorageOnResume() {
    loadLocalData();
    renderViewContent(window.viewHistory[window.viewHistory.length - 1]);
}

document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') refreshFromStorageOnResume();
});

window.addEventListener('pageshow', function (event) {
    if (event.persisted) refreshFromStorageOnResume();
});
