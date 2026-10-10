// --- CATÉGORIES PERSONNALISÉES (ONGLETS) ---
// `filterKey` est le nom de la variable `window.*` utilisée pour stocker l'onglet
// actif de CETTE vue (ex: 'activeCategoryFilter' pour l'éditeur, 'activeMealPickerCategoryFilter'
// pour le sélecteur de plat midi/soir du calendrier) : chaque vue garde son propre onglet
// sélectionné. Le petit-déjeuner n'utilise plus d'onglets catégorie du tout — ce ne sont
// plus des plats mais de simples entrées libres, voir js/calendar.js.
window.renderCategoryTabs = function (containerId, filterKey, renderListFn) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    var allTab = document.createElement('button');
    allTab.className = 'category-tab' + (window[filterKey] === null ? ' active' : '');
    allTab.textContent = 'Toutes';
    allTab.onclick = function () {
        window[filterKey] = null;
        renderListFn();
    };
    container.appendChild(allTab);

    window.categories.forEach(function (cat) {
        var tab = document.createElement('button');
        tab.className = 'category-tab' + (window[filterKey] === cat.id ? ' active' : '');
        tab.textContent = cat.name;
        tab.onclick = function () {
            window[filterKey] = cat.id;
            renderListFn();
        };
        container.appendChild(tab);
    });

    var addTab = document.createElement('button');
    addTab.className = 'category-tab category-tab-add';
    addTab.setAttribute('aria-label', 'Ajouter un onglet');
    addTab.textContent = '+';
    addTab.onclick = function () { window.promptAddCategory(renderListFn); };
    container.appendChild(addTab);

    var manageTab = document.createElement('button');
    manageTab.className = 'category-tab category-tab-manage';
    manageTab.setAttribute('aria-label', 'Gérer les onglets');
    manageTab.textContent = '⚙️';
    manageTab.onclick = function () { window.openManageCategoriesModal(renderListFn); };
    container.appendChild(manageTab);
};

// Modale générique de saisie d'un nom (créer/renommer un onglet, un calendrier...).
// Réutilisée hors du contexte "catégories" (voir js/calendar.js) — d'où le nom neutre.
window.promptNameInput = function (title, confirmLabel, initialName, placeholder, onConfirm) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-content">
            <div class="modal-title">${title}</div>
            <div class="modal-body">
                <input type="text" id="prompt-name-input" class="form-input" placeholder="${placeholder || ''}">
            </div>
            <div class="modal-buttons">
                <button class="btn-modal btn-modal-cancel" id="prompt-name-cancel">Annuler</button>
                <button class="btn-modal btn-modal-confirm" id="prompt-name-confirm" style="background-color:#2563eb;">${confirmLabel}</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    var input = overlay.querySelector('#prompt-name-input');
    input.value = initialName || '';
    input.focus();
    input.select();

    function confirm() {
        var name = input.value.trim();
        if (!name) { overlay.remove(); return; }
        overlay.remove();
        onConfirm(name);
    }

    overlay.querySelector('#prompt-name-cancel').onclick = function () { overlay.remove(); };
    overlay.querySelector('#prompt-name-confirm').onclick = confirm;
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') confirm();
    });
};

window.promptAddCategory = function (onDone) {
    window.promptNameInput('Nouvel onglet', 'Créer', '', 'Ex: Desserts, Rapide, Été...', function (name) {
        window.categories.push({ id: 'cat-' + Date.now(), name: name });
        saveLocalData();
        if (onDone) onDone();
    });
};

window.promptRenameCategory = function (cat, onDone) {
    window.promptNameInput('Renommer l\'onglet', 'Enregistrer', cat.name, 'Ex: Desserts, Rapide, Été...', function (name) {
        cat.name = name;
        saveLocalData();
        if (onDone) onDone();
    });
};

window.openManageCategoriesModal = function (onDone) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-content">
            <div class="modal-title">Gérer les onglets</div>
            <div class="modal-body">
                <div id="manage-category-list" style="display:flex; flex-direction:column; gap:8px; text-align:left;"></div>
            </div>
            <div class="modal-buttons">
                <button class="btn-modal btn-modal-cancel" id="cat-manage-close">Fermer</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    function renderManageList() {
        var listEl = overlay.querySelector('#manage-category-list');
        listEl.innerHTML = '';
        if (window.categories.length === 0) {
            listEl.innerHTML = '<div class="no-data" style="padding:12px;">Aucun onglet créé.</div>';
            return;
        }
        window.categories.forEach(function (cat) {
            var row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:10px 12px;';
            row.innerHTML = `<span style="font-weight:600;">${cat.name}</span>`;

            var actions = document.createElement('div');
            actions.style.cssText = 'display:flex; gap:8px; flex-shrink:0;';

            var editBtn = document.createElement('button');
            editBtn.className = 'btn-action';
            editBtn.setAttribute('aria-label', 'Renommer cet onglet');
            editBtn.innerHTML = '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
            editBtn.onclick = function () {
                window.promptRenameCategory(cat, function () {
                    renderManageList();
                    if (onDone) onDone();
                });
            };

            var delBtn = document.createElement('button');
            delBtn.className = 'btn-remove-ing';
            delBtn.textContent = '✕';
            delBtn.setAttribute('aria-label', 'Supprimer cet onglet');
            delBtn.onclick = function () {
                window.categories = window.categories.filter(function (c) { return c.id !== cat.id; });
                window.dishes.forEach(function (d) { if (d.categoryId === cat.id) d.categoryId = null; });
                if (window.activeCategoryFilter === cat.id) window.activeCategoryFilter = null;
                if (window.activeMealPickerCategoryFilter === cat.id) window.activeMealPickerCategoryFilter = null;
                saveLocalData();
                renderManageList();
                if (onDone) onDone();
            };

            actions.appendChild(editBtn);
            actions.appendChild(delBtn);
            row.appendChild(actions);
            listEl.appendChild(row);
        });
    }
    renderManageList();

    overlay.querySelector('#cat-manage-close').onclick = function () { overlay.remove(); };
};
