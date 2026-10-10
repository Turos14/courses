// --- GÉNÉRATION ET COMPILATION FINALE DE LA LISTE ---
// Logique d'agrégation partagée par tous les calendriers (js/calendar.js), qui
// produisent chacun un `dishCounts` ({ dishId: nombre de fois utilisé }) depuis leurs
// propres jours/petit-déjeuner.
// `dishLookup(id)` doit renvoyer `{ name, ingredients }` pour un id de plat donné ;
// par défaut on cherche dans `window.dishes` (les plats du navigateur courant), mais
// un calendrier sauvegardé/importé peut fournir son propre instantané de plats
// (`dishesSnapshot`) pour rester correct même si le plat a été modifié/supprimé depuis.
window.buildShoppingListItems = function (dishCounts, customIngredientsList, dishLookup) {
    var lookup = dishLookup || function (id) {
        return window.dishes.find(function (d) { return d.id === id; });
    };
    var ingredientsMap = {};

    function addToMap(formattedName, qty, count, originText) {
        var groupKey = formattedName.toLowerCase() + '___' + qty.toLowerCase();
        if (!ingredientsMap[groupKey]) {
            ingredientsMap[groupKey] = { name: formattedName, qty: qty, totalCount: 0, origins: [] };
        }
        ingredientsMap[groupKey].totalCount += count;
        ingredientsMap[groupKey].origins.push(originText);
    }

    // 1. Ingrédients issus des plats comptabilisés
    Object.keys(dishCounts).forEach(function (dishId) {
        var multiplier = dishCounts[dishId];
        if (!(multiplier > 0)) return;
        var dish = lookup(dishId);
        if (!dish) return;
        dish.ingredients.forEach(function (ing) {
            var formattedName = ing.n.trim();
            if (!formattedName) return;
            formattedName = formattedName.charAt(0).toUpperCase() + formattedName.slice(1).toLowerCase();
            var qty = (ing.q || '').trim();
            var originText = dish.name + (multiplier > 1 ? ` (x${multiplier})` : '');
            addToMap(formattedName, qty, multiplier, originText);
        });
    });

    // 2. Ingrédients isolés (et petits-déjeuners, mêmes forme/traitement — voir
    // js/calendar.js) ajoutés à la volée. `originLabel` permet à l'appelant de distinguer
    // leur provenance dans la liste finale sans dupliquer cette logique d'agrégation ;
    // par défaut ("Ajout direct") pour les ingrédients isolés classiques.
    (customIngredientsList || []).forEach(function (ing) {
        var formattedName = ing.name.trim();
        if (!formattedName) return;
        formattedName = formattedName.charAt(0).toUpperCase() + formattedName.slice(1).toLowerCase();
        var qty = (ing.qty || '').trim();
        var originText = (ing.originLabel || 'Ajout direct') + (ing.count > 1 ? ` (x${ing.count})` : '');
        addToMap(formattedName, qty, ing.count, originText);
    });

    var sortedKeys = Object.keys(ingredientsMap).sort(function (a, b) {
        return ingredientsMap[a].name.localeCompare(ingredientsMap[b].name);
    });

    return sortedKeys.map(function (key) {
        var obj = ingredientsMap[key];
        return {
            id: 'final-' + Math.random().toString(36).substr(2, 9),
            name: obj.name,
            qty: obj.qty,
            totalCount: obj.totalCount,
            origins: obj.origins
        };
    });
};

window.renderFinalList = function () {
    var container = document.getElementById('shopping-list-container');
    container.innerHTML = '';

    if (window.shoppingListItems.length === 0) {
        container.innerHTML = '<div class="no-data">Votre liste de courses est vide.</div>';
        document.getElementById('items-count-badge').textContent = '0 article';
        document.getElementById('btn-clear-checked').classList.add('hidden');
        return;
    }

    var ul = document.createElement('ul');
    ul.className = 'shopping-list';

    window.shoppingListItems.forEach(function (item) {
        var isChecked = window.shoppingListChecked.has(item.id);
        var li = document.createElement('li');
        li.className = `shopping-item ${isChecked ? 'checked' : ''}`;
        li.id = `item-list-${item.id}`;

        li.onclick = function () {
            toggleItemCheck(item.id);
        };

        var originsText = item.origins ? item.origins.join(', ') : '';

        li.innerHTML = `
            <div class="circle-check">
                <span class="checkmark">${isChecked ? '✓' : ''}</span>
            </div>
            <div class="shopping-item-content">
                <div class="ing-header-row">
                    <span class="ing-name-title">${item.name}</span>
                    ${item.qty ? `<span class="ing-qty-badge">${item.qty}</span>` : ''}
                    <span class="ing-counter">x${item.totalCount}</span>
                </div>
                ${originsText ? `<div class="ing-origin-text">📍 ${originsText}</div>` : ''}
            </div>
        `;
        ul.appendChild(li);
    });

    container.appendChild(ul);
    updateListBadge();
};

function toggleItemCheck(itemId) {
    var li = document.getElementById(`item-list-${itemId}`);
    if (window.shoppingListChecked.has(itemId)) {
        window.shoppingListChecked.delete(itemId);
        if (li) {
            li.classList.remove('checked');
            li.querySelector('.checkmark').textContent = '';
        }
    } else {
        window.shoppingListChecked.add(itemId);
        if (li) {
            li.classList.add('checked');
            li.querySelector('.checkmark').textContent = '✓';
        }
    }
    saveLocalData();
    updateListBadge();
}

function updateListBadge() {
    var total = window.shoppingListItems.length;
    var checkedCount = window.shoppingListChecked.size;
    document.getElementById('items-count-badge').textContent = `${checkedCount} / ${total} coché${total > 1 ? 's' : ''}`;

    var btnClear = document.getElementById('btn-clear-checked');
    if (checkedCount > 0) {
        btnClear.classList.remove('hidden');
    } else {
        btnClear.classList.add('hidden');
    }
}

window.clearCheckedItems = function () {
    window.shoppingListItems = window.shoppingListItems.filter(function (item) {
        return !window.shoppingListChecked.has(item.id);
    });
    window.shoppingListChecked.clear();
    saveLocalData();
    window.renderFinalList();
};
