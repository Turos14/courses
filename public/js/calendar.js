// --- CALENDRIER HEBDOMADAIRE DE REPAS ---
// Il n'y a plus de "brouillon" unique : chaque calendrier de `window.savedCalendars`
// est directement éditable (autosauvegarde à chaque changement, comme le reste de
// l'app). `window.activeCalendarId` pointe vers celui actuellement affiché/édité.
// Vue par semaine (pas par mois) : les plats du midi et du soir sont visibles
// directement dans la liste des jours, sans avoir à cliquer pour les découvrir.
var calendarViewWeekStart = getMondayOfWeek(new Date());

var MONTH_NAMES_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
var WEEKDAY_NAMES_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

function dateKeyFromParts(year, monthIndex, day) {
    return year + '-' + pad2(monthIndex + 1) + '-' + pad2(day);
}

function todayDateKey() {
    var now = new Date();
    return dateKeyFromParts(now.getFullYear(), now.getMonth(), now.getDate());
}

function getMondayOfWeek(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var day = d.getDay(); // Dim=0 ... Sam=6
    var diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
}

function formatDateLong(dateKey) {
    var parts = dateKey.split('-').map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    return WEEKDAY_NAMES_FR[d.getDay()] + ' ' + parts[2] + ' ' + MONTH_NAMES_FR[parts[1] - 1].toLowerCase() + ' ' + parts[0];
}

function formatWeekRange(start) {
    var end = new Date(start);
    end.setDate(end.getDate() + 6);
    var sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    if (sameMonth) {
        return start.getDate() + ' - ' + end.getDate() + ' ' + MONTH_NAMES_FR[start.getMonth()].toLowerCase() + ' ' + start.getFullYear();
    }
    var sameYear = start.getFullYear() === end.getFullYear();
    var startStr = start.getDate() + ' ' + MONTH_NAMES_FR[start.getMonth()].toLowerCase() + (sameYear ? '' : ' ' + start.getFullYear());
    var endStr = end.getDate() + ' ' + MONTH_NAMES_FR[end.getMonth()].toLowerCase() + ' ' + end.getFullYear();
    return startStr + ' - ' + endStr;
}

// Comme pour la génération de liste : plats actuels en priorité (les plus à jour), sinon
// l'instantané du calendrier (cas d'un calendrier importé dont le destinataire n'a pas
// forcément la recette) — sinon seulement, considérer le plat comme supprimé.
function dishNameById(cal, id) {
    var dish = window.dishes.find(function (d) { return d.id === id; });
    if (dish) return dish.name;
    if (cal.dishesSnapshot && cal.dishesSnapshot[id]) return cal.dishesSnapshot[id].name;
    return '(plat supprimé)';
}

function getActiveCalendar() {
    var cal = window.savedCalendars.find(function (c) { return c.id === window.activeCalendarId; });
    // Calendriers créés avant l'introduction des ingrédients isolés / petits-déjeuners
    // libres par calendrier.
    if (cal && !cal.customIngredients) cal.customIngredients = [];
    if (cal && !cal.breakfastItems) cal.breakfastItems = [];
    return cal;
}

// Regroupe les plats du calendrier (jours midi/soir uniquement — le petit-déjeuner n'est
// plus une sélection de plats, voir plus bas) en un total par plat, réutilisé pour
// générer la liste de courses.
window.computeCalendarDishCounts = function (assignments) {
    var dishCounts = {};
    Object.keys(assignments || {}).forEach(function (key) {
        var a = assignments[key] || {};
        (a.midi || []).forEach(function (id) { dishCounts[id] = (dishCounts[id] || 0) + 1; });
        (a.soir || []).forEach(function (id) { dishCounts[id] = (dishCounts[id] || 0) + 1; });
    });
    return dishCounts;
};

// Capture un instantané des plats utilisés (nom + ingrédients), pour qu'un calendrier
// partagé/importé reste correct même si un plat est ensuite modifié/supprimé dans
// l'éditeur, ou que le destinataire du partage n'a pas encore ces recettes. Tenu à jour
// à chaque modification du calendrier (voir `touchActiveCalendar`), pas seulement à
// l'export, pour que "Générer la liste" reste fiable même pour un calendrier non actif.
function snapshotDishesForCalendar(assignments) {
    var snapshot = {};
    function capture(id) {
        if (snapshot[id]) return;
        var dish = window.dishes.find(function (d) { return d.id === id; });
        if (dish) snapshot[id] = { name: dish.name, ingredients: dish.ingredients };
    }
    Object.keys(assignments || {}).forEach(function (key) {
        var a = assignments[key] || {};
        (a.midi || []).forEach(capture);
        (a.soir || []).forEach(capture);
    });
    return snapshot;
}

function touchActiveCalendar() {
    var cal = getActiveCalendar();
    if (!cal) return;
    cal.dishesSnapshot = snapshotDishesForCalendar(cal.assignments);
    saveLocalData();
}

// --- CRÉATION / SÉLECTION D'UN CALENDRIER ---
window.promptCreateCalendar = function (onCreated) {
    var now = new Date();
    var defaultName = 'Calendrier du ' + pad2(now.getDate()) + '/' + pad2(now.getMonth() + 1) + '/' + now.getFullYear();
    window.promptNameInput('Nouveau calendrier', 'Créer', defaultName, 'Ex: Semaine du 1er septembre', function (name) {
        var entry = {
            id: 'cal-' + Date.now(),
            name: name,
            createdAt: now.toISOString(),
            origin: 'local',
            assignments: {},
            breakfastItems: [],
            customIngredients: [],
            dishesSnapshot: {}
        };
        window.savedCalendars.push(entry);
        window.activeCalendarId = entry.id;
        saveLocalData();
        if (onCreated) onCreated(entry);
    });
};

// Bouton "Calendrier" de l'accueil : reprend le calendrier en cours d'édition s'il y en
// a un, ou atterrit sur la vue calendrier (qui propose de choisir/créer) sinon.
window.openCalendarHome = function () {
    if (!getActiveCalendar() && window.savedCalendars.length === 0) {
        window.promptCreateCalendar(function () { window.navigate('view-calendar'); });
    } else {
        window.navigate('view-calendar');
    }
};

window.renameActiveCalendar = function () {
    var cal = getActiveCalendar();
    if (!cal) return;
    window.promptNameInput('Renommer le calendrier', 'Enregistrer', cal.name, 'Ex: Semaine du 1er septembre', function (name) {
        cal.name = name;
        saveLocalData();
        window.renderCalendarView();
    });
};

window.confirmDeleteActiveCalendar = function () {
    var cal = getActiveCalendar();
    if (!cal) return;
    showCustomModal(
        'Supprimer ce calendrier ?',
        `Voulez-vous vraiment supprimer "${cal.name}" ?`,
        function () {
            window.savedCalendars = window.savedCalendars.filter(function (c) { return c.id !== cal.id; });
            window.activeCalendarId = null;
            saveLocalData();
            window.renderCalendarView();
        },
        true
    );
};

// --- SÉLECTEUR DE CALENDRIER (onglets), regroupe la gestion de "tous les calendriers"
// directement dans la vue calendrier plutôt que dans un écran séparé.
function renderCalendarSwitcher() {
    var container = document.getElementById('calendar-switcher');
    container.innerHTML = '';

    window.savedCalendars.forEach(function (cal) {
        var chip = document.createElement('button');
        chip.className = 'category-tab' + (cal.id === window.activeCalendarId ? ' active' : '');
        chip.textContent = cal.name + (cal.origin === 'imported' ? ' 📥' : '');
        chip.onclick = function () {
            window.activeCalendarId = cal.id;
            saveLocalData();
            window.renderCalendarView();
        };
        container.appendChild(chip);
    });

    var addChip = document.createElement('button');
    addChip.className = 'category-tab category-tab-add';
    addChip.setAttribute('aria-label', 'Nouveau calendrier');
    addChip.textContent = '+';
    addChip.onclick = function () { window.promptCreateCalendar(function () { window.renderCalendarView(); }); };
    container.appendChild(addChip);
}

// --- SEMAINE AFFICHÉE ---
window.changeCalendarWeek = function (delta) {
    calendarViewWeekStart.setDate(calendarViewWeekStart.getDate() + delta * 7);
    window.renderCalendarView();
};

window.goToCurrentCalendarWeek = function () {
    calendarViewWeekStart = getMondayOfWeek(new Date());
    window.renderCalendarView();
};

window.renderCalendarView = function () {
    renderCalendarSwitcher();

    var cal = getActiveCalendar();
    var emptyState = document.getElementById('calendar-no-active');
    var content = document.getElementById('calendar-content');

    if (!cal) {
        emptyState.classList.remove('hidden');
        content.classList.add('hidden');
        return;
    }
    emptyState.classList.add('hidden');
    content.classList.remove('hidden');

    document.getElementById('calendar-active-name').textContent = cal.name;
    document.getElementById('calendar-week-label').textContent = formatWeekRange(calendarViewWeekStart);

    renderWeekDays(cal);
    renderFreeItemsList('breakfastItems');
    renderFreeItemsList('customIngredients');
    updateCalendarActionsState();
};

function renderWeekDays(cal) {
    var container = document.getElementById('calendar-week-days');
    container.innerHTML = '';
    var todayKey = todayDateKey();

    for (var i = 0; i < 7; i++) {
        var d = new Date(calendarViewWeekStart);
        d.setDate(d.getDate() + i);
        var key = dateKeyFromParts(d.getFullYear(), d.getMonth(), d.getDate());
        var isToday = key === todayKey;
        var a = cal.assignments[key] || {};

        var card = document.createElement('div');
        card.className = 'week-day-card' + (isToday ? ' week-day-card-today' : '');
        card.innerHTML = `<div class="week-day-header">${WEEKDAY_NAMES_FR[d.getDay()]} ${d.getDate()} ${MONTH_NAMES_FR[d.getMonth()].toLowerCase()}</div>`;

        ['midi', 'soir'].forEach(function (meal) {
            var names = (a[meal] || []).map(function (id) { return dishNameById(cal, id); }).join(', ');
            var slot = document.createElement('button');
            slot.className = 'week-meal-slot';
            slot.innerHTML = `
                <span class="week-meal-label">${meal === 'midi' ? '☀️ Midi' : '🌙 Soir'}</span>
                <span class="week-meal-dishes${names ? '' : ' week-meal-dishes-empty'}">${names || 'Ajouter un plat'}</span>
            `;
            slot.onclick = (function (k, m) { return function () { window.openMealDishPicker(k, m); }; })(key, meal);
            card.appendChild(slot);
        });

        container.appendChild(card);
    }
}

window.openMealDishPicker = function (dateKey, meal) {
    var cal = getActiveCalendar();
    if (!cal) return;
    window.activeMealPickerCategoryFilter = null;
    var existing = (cal.assignments[dateKey] && cal.assignments[dateKey][meal]) || [];
    var selected = new Set(existing);

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-content" style="max-width:420px; max-height:82vh; display:flex; flex-direction:column;">
            <div class="modal-title">${meal === 'midi' ? '☀️ Midi' : '🌙 Soir'} — ${formatDateLong(dateKey)}</div>
            <div id="meal-picker-tabs" class="category-tabs" style="margin-bottom:8px;"></div>
            <div id="meal-picker-list" style="overflow-y:auto; text-align:left; flex:1; margin-bottom:14px;"></div>
            <div class="modal-buttons">
                <button class="btn-modal btn-modal-cancel" id="meal-picker-cancel">Annuler</button>
                <button class="btn-modal btn-modal-confirm" id="meal-picker-confirm" style="background-color:#2563eb;">Valider</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    function renderPickerList() {
        window.renderCategoryTabs('meal-picker-tabs', 'activeMealPickerCategoryFilter', renderPickerList);

        var listEl = overlay.querySelector('#meal-picker-list');
        listEl.innerHTML = '';

        var plats = window.dishes;
        if (plats.length === 0) {
            listEl.innerHTML = '<div class="no-data">Aucun plat disponible. Allez dans l\'éditeur pour en ajouter un de type "Plat" !</div>';
            return;
        }

        var visible = window.activeMealPickerCategoryFilter === null
            ? plats
            : plats.filter(function (d) { return d.categoryId === window.activeMealPickerCategoryFilter; });

        if (visible.length === 0) {
            listEl.innerHTML = '<div class="no-data">Aucun plat dans cet onglet.</div>';
            return;
        }

        visible.forEach(function (dish) {
            var isSelected = selected.has(dish.id);
            var row = document.createElement('div');
            row.className = 'checkbox-label' + (isSelected ? ' selected' : '');
            row.style.marginBottom = '8px';
            row.innerHTML = `
                <input type="checkbox" class="checkbox-input" ${isSelected ? 'checked' : ''}>
                <span style="font-weight:600; font-size:1rem;">${dish.name}</span>
            `;
            row.onclick = function () {
                if (selected.has(dish.id)) selected.delete(dish.id); else selected.add(dish.id);
                renderPickerList();
            };
            listEl.appendChild(row);
        });
    }
    renderPickerList();

    overlay.querySelector('#meal-picker-cancel').onclick = function () { overlay.remove(); };
    overlay.querySelector('#meal-picker-confirm').onclick = function () {
        if (!cal.assignments[dateKey]) cal.assignments[dateKey] = { midi: [], soir: [] };
        cal.assignments[dateKey][meal] = Array.from(selected);
        touchActiveCalendar();
        overlay.remove();
        window.renderCalendarView();
    };
};

// --- "ITEMS LIBRES" (nom + qté optionnelle + compteur) ---
// Structure partagée par les "ingrédients isolés" (cal.customIngredients) et les
// "petits-déjeuners de la semaine" (cal.breakfastItems) : les deux sont de simples
// entrées nommées, indépendantes des plats/recettes — le petit-déjeuner n'est plus une
// sélection de plats (voir js/editor.js pour l'historique de ce choix), donc ni onglets
// catégorie ni lien avec window.dishes ici. idPrefix distingue les ids générés entre les
// 2 listes ; containerId le conteneur DOM à re-render.
var FREE_ITEM_LISTS = {
    customIngredients: { containerId: 'custom-ingredients-list', idPrefix: 'cust', placeholder: 'ex: Lessive, Pain...' },
    breakfastItems: { containerId: 'breakfast-items-list', idPrefix: 'bfast', placeholder: 'ex: Croissants, Céréales...' }
};

window.addFreeItem = function (listKey) {
    var cal = getActiveCalendar();
    if (!cal) return;
    var cfg = FREE_ITEM_LISTS[listKey];
    cal[listKey].push({
        id: cfg.idPrefix + '-' + Date.now() + Math.random().toString(36).substr(2, 5),
        name: '',
        qty: '',
        hasQty: false,
        count: 1
    });
    saveLocalData();
    renderFreeItemsList(listKey);
    updateCalendarActionsState();

    var inputs = document.querySelectorAll('.' + cfg.idPrefix + '-name-input');
    if (inputs.length > 0) inputs[inputs.length - 1].focus();
};

function renderFreeItemsList(listKey) {
    var cal = getActiveCalendar();
    var cfg = FREE_ITEM_LISTS[listKey];
    var container = document.getElementById(cfg.containerId);
    container.innerHTML = '';
    if (!cal) return;

    cal[listKey].forEach(function (ing) {
        var row = document.createElement('div');
        row.className = 'ingredient-row';
        row.style.marginBottom = '10px';

        var showQty = ing.qty.trim() !== '' || ing.hasQty;

        row.innerHTML = `
            <input class="form-input ${cfg.idPrefix}-name-input" type="text" placeholder="${cfg.placeholder}" value="${ing.name}" onchange="updateFreeItemData('${listKey}', '${ing.id}', 'name', this.value)">
            <button type="button" class="btn-qty-toggle ${showQty ? 'hidden' : ''}" onclick="toggleFreeItemQty('${listKey}', '${ing.id}')">+ Qté</button>
            <input class="form-input input-qty ${cfg.idPrefix}-qty-input ${showQty ? '' : 'hidden'}" type="text" placeholder="Qté / Poids" value="${ing.qty}" onchange="updateFreeItemData('${listKey}', '${ing.id}', 'qty', this.value)">
            <div class="qty-controls" style="height:46px;">
                <button class="qty-btn" style="width:30px;" onclick="adjustFreeItemCount('${listKey}', '${ing.id}', -1)">-</button>
                <div class="qty-val" style="width:26px; font-size:0.9rem;" id="${cfg.idPrefix}-qty-${ing.id}">${ing.count}</div>
                <button class="qty-btn" style="width:30px;" onclick="adjustFreeItemCount('${listKey}', '${ing.id}', 1)">+</button>
            </div>
            <button class="btn-remove-ing" style="padding:10px;" onclick="removeFreeItem('${listKey}', '${ing.id}')">
                ✕
            </button>
        `;
        container.appendChild(row);
    });
}

window.toggleFreeItemQty = function (listKey, id) {
    var cal = getActiveCalendar();
    var ing = cal && cal[listKey].find(function (i) { return i.id === id; });
    if (ing) {
        ing.hasQty = true;
        renderFreeItemsList(listKey);
    }
};

window.updateFreeItemData = function (listKey, id, field, value) {
    var cal = getActiveCalendar();
    var ing = cal && cal[listKey].find(function (i) { return i.id === id; });
    if (ing) {
        ing[field] = value.trim();
        saveLocalData();
        updateCalendarActionsState();
    }
};

window.adjustFreeItemCount = function (listKey, id, amount) {
    var cal = getActiveCalendar();
    var cfg = FREE_ITEM_LISTS[listKey];
    var ing = cal && cal[listKey].find(function (i) { return i.id === id; });
    if (ing) {
        ing.count = Math.max(1, ing.count + amount);
        document.getElementById(`${cfg.idPrefix}-qty-${id}`).textContent = ing.count;
        saveLocalData();
    }
};

window.removeFreeItem = function (listKey, id) {
    var cal = getActiveCalendar();
    if (!cal) return;
    cal[listKey] = cal[listKey].filter(function (i) { return i.id !== id; });
    saveLocalData();
    renderFreeItemsList(listKey);
    updateCalendarActionsState();
};

function calendarHasContent(cal) {
    var hasDayAssignments = Object.keys(cal.assignments).some(function (key) {
        var a = cal.assignments[key] || {};
        return (a.midi && a.midi.length > 0) || (a.soir && a.soir.length > 0);
    });
    var hasBreakfastItems = cal.breakfastItems.some(function (i) { return i.name.trim() !== ''; });
    var hasCustomIngredients = cal.customIngredients.some(function (i) { return i.name.trim() !== ''; });
    return hasDayAssignments || hasBreakfastItems || hasCustomIngredients;
}

function updateCalendarActionsState() {
    var cal = getActiveCalendar();
    var btn = document.getElementById('btn-calendar-generate');
    if (btn) btn.disabled = !cal || !calendarHasContent(cal);
}

// --- ACTIONS : GÉNÉRER / PARTAGER ---
window.generateCalendarShoppingList = function () {
    var cal = getActiveCalendar();
    if (!cal) return;
    var dishCounts = window.computeCalendarDishCounts(cal.assignments);
    // Le petit-déjeuner n'est plus une sélection de plats mais des items libres, agrégés
    // comme les ingrédients isolés (voir FREE_ITEM_LISTS plus haut) — juste étiquetés
    // différemment dans "origins" pour rester lisible dans la liste finale.
    var breakfastForList = cal.breakfastItems.map(function (i) {
        return Object.assign({}, i, { originLabel: 'Petit-déjeuner' });
    });
    // Un calendrier reçu par partage peut référencer des plats absents de la liste locale
    // (le destinataire ne les a pas forcément) : on cherche d'abord dans les plats actuels
    // (les plus à jour), sinon dans l'instantané embarqué dans le calendrier.
    window.shoppingListItems = window.buildShoppingListItems(dishCounts, cal.customIngredients.concat(breakfastForList), function (dishId) {
        return window.dishes.find(function (d) { return d.id === dishId; }) || cal.dishesSnapshot[dishId];
    });
    window.shoppingListChecked.clear();
    saveLocalData();
    window.navigate('view-course-list');
};
