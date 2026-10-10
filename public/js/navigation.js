// --- NAVIGATION ---
function renderViewContent(viewId) {
    if (viewId === 'view-editor') window.renderEditorList();
    if (viewId === 'view-course-list') window.renderFinalList();
    if (viewId === 'view-calendar') window.renderCalendarView();
}

window.navigate = function (viewId) {
    var currentViewId = window.viewHistory[window.viewHistory.length - 1];
    document.getElementById(currentViewId).classList.remove('active');
    window.viewHistory.push(viewId);
    window.showView(viewId);
    renderViewContent(viewId);
};

window.goBack = function () {
    if (window.viewHistory.length <= 1) return;
    var currentViewId = window.viewHistory.pop();
    document.getElementById(currentViewId).classList.remove('active');

    var previousViewId = window.viewHistory[window.viewHistory.length - 1];
    window.showView(previousViewId);
    renderViewContent(previousViewId);
};

window.showView = function (viewId) {
    document.getElementById(viewId).classList.add('active');
    document.getElementById('app-title').textContent = viewTitles[viewId] || 'Application';

    var btnBack = document.getElementById('btn-back');
    if (window.viewHistory.length > 1) {
        btnBack.classList.remove('hidden');
    } else {
        btnBack.classList.add('hidden');
    }

    renderHeaderActions(viewId);
};

function renderHeaderActions(viewId) {
    var container = document.getElementById('header-actions');
    if (viewId === 'view-editor') {
        container.innerHTML = `
            <button class="header-icon-btn" onclick="generateShareQRCode()" aria-label="Partager mes recettes">📤</button>
            <button class="header-icon-btn" onclick="openDishForm()" aria-label="Nouveau plat">
                <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14" /></svg>
            </button>
        `;
    } else if (viewId === 'view-calendar') {
        container.innerHTML = `
            <button class="header-icon-btn" onclick="goToCurrentCalendarWeek()" aria-label="Cette semaine">📍</button>
        `;
    } else {
        container.innerHTML = '';
    }
}
