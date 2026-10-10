// --- EDITION DES PLATS ---
window.renderEditorList = function () {
    window.renderCategoryTabs('editor-category-tabs', 'activeCategoryFilter', window.renderEditorList);

    var container = document.getElementById('editor-dish-list');
    container.innerHTML = '';

    if (window.dishes.length === 0) {
        container.innerHTML = '<div class="no-data">Aucun plat enregistré. Appuyez sur "Nouveau" pour commencer !</div>';
        return;
    }

    var visibleDishes = window.activeCategoryFilter === null
        ? window.dishes.slice()
        : window.dishes.filter(function (d) { return d.categoryId === window.activeCategoryFilter; });

    visibleDishes.sort(function (a, b) { return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }); });

    if (visibleDishes.length === 0) {
        container.innerHTML = '<div class="no-data">Aucun plat dans cet onglet.</div>';
        return;
    }

    visibleDishes.forEach(function (dish) {
        var card = document.createElement('div');
        card.className = 'dish-card';
        var textNames = dish.ingredients.map(i => i.n + (i.q ? ` (${i.q})` : ''));
        var preview = textNames.slice(0, 3).join(', ') + (textNames.length > 3 ? '...' : '');

        card.innerHTML = `
            <div class="dish-info">
                <h3>${dish.name}</h3>
                <p>${preview || 'Aucun ingrédient'}</p>
            </div>
            <div class="dish-actions">
                <button onclick="editDish('${dish.id}')" class="btn-action" aria-label="Modifier">
                    <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button onclick="confirmDeleteDish('${dish.id}', '${dish.name.replace(/'/g, "\\'")}')" class="btn-action delete" aria-label="Supprimer">
                    <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
            </div>
        `;
        container.appendChild(card);
    });
};

window.openDishForm = function (dishId) {
    window.editingDishId = dishId || null;
    document.getElementById('app-title').textContent = dishId ? 'Modifier le plat' : 'Nouveau plat';

    var nameInput = document.getElementById('dish-name');
    var ingContainer = document.getElementById('ingredient-inputs');
    ingContainer.innerHTML = '';

    var categorySelect = document.getElementById('dish-category');
    categorySelect.innerHTML = '<option value="">Aucun onglet</option>' +
        window.categories.map(function (cat) { return `<option value="${cat.id}">${cat.name}</option>`; }).join('');

    if (dishId) {
        var dish = window.dishes.find(function (d) { return String(d.id) === String(dishId); });
        if (dish) {
            nameInput.value = dish.name;
            categorySelect.value = dish.categoryId || '';
            dish.ingredients.forEach(function (ing) { window.addIngredientField(ing.n, ing.q); });
        }
    } else {
        nameInput.value = '';
        categorySelect.value = window.activeCategoryFilter || '';
        window.addIngredientField();
    }

    window.navigate('view-dish-form');
};

window.editDish = function (id) {
    window.openDishForm(id);
};

window.addIngredientField = function (nameVal, qtyVal) {
    var nV = nameVal || '';
    var qV = qtyVal || '';
    var hasQty = qV.trim() !== '';

    var container = document.getElementById('ingredient-inputs');
    var row = document.createElement('div');
    row.className = 'ingredient-row';

    row.innerHTML = `
        <input class="form-input ing-name-input" type="text" placeholder="Ingrédient (ex: Pâtes)" value="${nV}">
        <button type="button" class="btn-qty-toggle ${hasQty ? 'hidden' : ''}" onclick="showQtyInput(this)">+ Qté</button>
        <input class="form-input input-qty ing-qty-input ${hasQty ? '' : 'hidden'}" type="text" placeholder="Qté / Poids" value="${qV}">
        <button type="button" class="btn-remove-ing" onclick="this.parentElement.remove()" aria-label="Supprimer">
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
    `;
    container.appendChild(row);
    if (!nameVal) {
        row.querySelector('.ing-name-input').focus();
    }
};

window.showQtyInput = function (btn) {
    btn.classList.add('hidden');
    var qtyInput = btn.parentElement.querySelector('.ing-qty-input');
    qtyInput.classList.remove('hidden');
    qtyInput.focus();
};

window.saveDish = function () {
    var name = document.getElementById('dish-name').value.trim();
    if (!name) {
        showCustomModal('Oups !', 'Le plat doit avoir un nom.', null, false);
        return;
    }

    var rows = document.querySelectorAll('#ingredient-inputs .ingredient-row');
    var ingredients = [];
    rows.forEach(function (row) {
        var n = row.querySelector('.ing-name-input').value.trim();
        var qInput = row.querySelector('.ing-qty-input');
        var q = qInput.classList.contains('hidden') ? '' : qInput.value.trim();
        if (n) ingredients.push({ n: n, q: q });
    });

    if (ingredients.length === 0) {
        showCustomModal('Oups !', 'Ajoutez au moins un ingrédient.', null, false);
        return;
    }

    var categoryId = document.getElementById('dish-category').value || null;

    if (window.editingDishId) {
        var dish = window.dishes.find(function (d) { return String(d.id) === String(window.editingDishId); });
        if (dish) {
            dish.name = name;
            dish.ingredients = ingredients;
            dish.categoryId = categoryId;
        }
    } else {
        var newDish = {
            id: String(Date.now()),
            name: name,
            ingredients: ingredients,
            categoryId: categoryId
        };
        window.dishes.push(newDish);
    }

    saveLocalData();
    window.goBack();
};

window.confirmDeleteDish = function (dishId, dishName) {
    showCustomModal(
        'Supprimer le plat ?',
        `Voulez-vous vraiment supprimer "${dishName}" de vos recettes ?`,
        function () {
            window.dishes = window.dishes.filter(function (d) { return String(d.id) !== String(dishId); });
            saveLocalData();
            window.renderEditorList();
        },
        true
    );
};
