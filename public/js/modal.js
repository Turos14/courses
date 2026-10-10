// --- MODALE GÉNÉRIQUE (remplace alert/confirm) ---
// `confirmLabel`/`confirmColor` sont optionnels : par défaut ("Supprimer" en rouge) car
// l'usage historique de `showCancel: true` est presque toujours une confirmation de
// suppression. Pour un autre type de confirmation (importer, ouvrir, etc.), passer un
// libellé/couleur adaptés pour ne pas afficher un gros bouton rouge "Supprimer" trompeur.
function showCustomModal(title, text, onConfirm, showCancel, confirmLabel, confirmColor) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    let buttonsHtml = `<button class="btn-modal btn-modal-confirm" id="modal-ok" style="background-color: #2563eb;">D'accord</button>`;
    if (showCancel) {
        buttonsHtml = `
            <button class="btn-modal btn-modal-cancel" id="modal-cancel">Annuler</button>
            <button class="btn-modal btn-modal-confirm" id="modal-ok" style="background-color: ${confirmColor || '#ef4444'};">${confirmLabel || 'Supprimer'}</button>
        `;
    }
    overlay.innerHTML = `
        <div class="modal-content">
            <div class="modal-title">${title}</div>
            <div class="modal-body">${text}</div>
            <div class="modal-buttons">${buttonsHtml}</div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#modal-ok').onclick = function () {
        overlay.remove();
        if (onConfirm) onConfirm();
    };
    if (showCancel) {
        overlay.querySelector('#modal-cancel').onclick = function () { overlay.remove(); };
    }
}

// --- QR CODE PLEIN ÉCRAN (réutilisé par js/share.js et js/calendarShare.js) ---
window.openFullscreenQR = function (value) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.background = 'rgba(255,255,255,0.98)';
    overlay.style.cursor = 'zoom-out';
    overlay.innerHTML = `<canvas id="fullscreen-qr-canvas" style="width:min(85vw,85vh); height:min(85vw,85vh);"></canvas>`;
    document.body.appendChild(overlay);
    new QRious({
        element: overlay.querySelector('#fullscreen-qr-canvas'),
        value: value,
        size: 1000,
        level: 'L'
    });
    overlay.onclick = function () { overlay.remove(); };
};
