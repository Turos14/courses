// --- LOCALSTORAGE ---
function saveLocalData() {
    localStorage.setItem('mes_plats_locaux_v3', JSON.stringify(window.dishes));
    localStorage.setItem('mes_list_items_locaux_v3', JSON.stringify(window.shoppingListItems));
    localStorage.setItem('mes_coches_locaux_v3', JSON.stringify(Array.from(window.shoppingListChecked)));
    localStorage.setItem('mes_categories_v1', JSON.stringify(window.categories));
    localStorage.setItem('mes_calendriers_sauvegardes_v1', JSON.stringify(window.savedCalendars));
    localStorage.setItem('mes_calendrier_actif_v1', JSON.stringify(window.activeCalendarId));
}

// Avant l'introduction des calendriers multiples, il existait un unique "brouillon" de
// calendrier (assignations + petit-déjeuner) séparé de la liste des calendriers
// sauvegardés. On le convertit ici, une fois, en un calendrier normal — pour ne pas
// perdre le travail en cours des personnes qui utilisaient déjà cette fonctionnalité.
function migrateLegacyCalendarDraft() {
    var legacyAssignmentsRaw = localStorage.getItem('mes_calendrier_assignations_v1');
    var legacyBreakfastRaw = localStorage.getItem('mes_calendrier_petitdej_v1');
    if (!legacyAssignmentsRaw && !legacyBreakfastRaw) return;

    try {
        var assignments = legacyAssignmentsRaw ? JSON.parse(legacyAssignmentsRaw) : {};
        var breakfastSelection = legacyBreakfastRaw ? JSON.parse(legacyBreakfastRaw) : {};

        var hasDays = Object.keys(assignments).some(function (key) {
            var a = assignments[key] || {};
            return (a.midi && a.midi.length > 0) || (a.soir && a.soir.length > 0);
        });
        var hasBreakfast = Object.keys(breakfastSelection).some(function (id) { return breakfastSelection[id] > 0; });

        if (hasDays || hasBreakfast) {
            var snapshot = {};
            function capture(id) {
                if (snapshot[id]) return;
                var dish = window.dishes.find(function (d) { return d.id === id; });
                if (dish) snapshot[id] = { name: dish.name, ingredients: dish.ingredients };
            }
            Object.keys(assignments).forEach(function (key) {
                var a = assignments[key] || {};
                (a.midi || []).forEach(capture);
                (a.soir || []).forEach(capture);
            });
            Object.keys(breakfastSelection).forEach(function (id) { if (breakfastSelection[id] > 0) capture(id); });

            var migrated = {
                id: 'cal-' + Date.now(),
                name: 'Calendrier récupéré du ' + new Date().toLocaleDateString('fr-FR'),
                createdAt: new Date().toISOString(),
                origin: 'local',
                assignments: assignments,
                breakfastSelection: breakfastSelection,
                dishesSnapshot: snapshot
            };
            window.savedCalendars.push(migrated);
            if (!window.activeCalendarId) window.activeCalendarId = migrated.id;
        }
    } catch (e) {
        console.error('Erreur migration de l\'ancien brouillon de calendrier : ', e);
    }

    localStorage.removeItem('mes_calendrier_assignations_v1');
    localStorage.removeItem('mes_calendrier_petitdej_v1');
}

// Les "ingrédients isolés" (window.customIngredients) étaient une liste globale, unique,
// avant d'être déplacés dans l'écran Calendrier et rattachés à un calendrier précis
// (cal.customIngredients). On récupère ici l'ancienne liste (si non vide) en l'attachant
// au calendrier actif, ou au plus récent à défaut — au pire, si aucun calendrier n'existe,
// ces quelques ingrédients ponctuels sont perdus plutôt que de forcer la création d'un
// calendrier juste pour les accueillir.
function migrateLegacyCustomIngredients() {
    var raw = localStorage.getItem('mes_custom_ing_v3');
    if (raw) {
        try {
            var items = JSON.parse(raw).filter(function (i) { return i.name && i.name.trim() !== ''; });
            if (items.length > 0) {
                var target = window.savedCalendars.find(function (c) { return c.id === window.activeCalendarId; })
                    || window.savedCalendars[window.savedCalendars.length - 1];
                if (target) {
                    target.customIngredients = (target.customIngredients || []).concat(items);
                }
            }
        } catch (e) {
            console.error('Erreur migration des ingrédients isolés : ', e);
        }
    }
    localStorage.removeItem('mes_custom_ing_v3');
    localStorage.removeItem('mes_selections_counts_v3');
}

// La fonctionnalité "favoris" a été retirée sans remplacement (contrairement aux
// ingrédients isolés, elle n'a pas été déplacée ailleurs) : on nettoie juste la clé.
function removeLegacyFavorites() {
    localStorage.removeItem('mes_favoris_v1');
}

// Le petit-déjeuner n'est plus une sélection de plats (window.dishes filtrés par un
// mealType, depuis retiré) mais une liste d'items libres par calendrier (cal.breakfastItems,
// même forme que cal.customIngredients — voir js/calendar.js). Contrairement aux autres
// migrations ci-dessus, cal.breakfastSelection n'est pas une clé localStorage séparée mais
// un champ imbriqué dans chaque entrée de window.savedCalendars : on la convertit donc ici,
// une fois par calendrier, plutôt que de la supprimer d'une clé dédiée. Chaque plat
// sélectionné (compté > 0) devient un item nommé d'après ce plat (plats actuels en
// priorité, sinon l'instantané du calendrier), pour ne pas perdre la planification déjà
// faite. cal.breakfastSelection elle-même est laissée telle quelle dans le stockage
// (inutilisée ensuite) plutôt qu'activement supprimée — pas nécessaire, sans risque.
function migrateCalendarBreakfastSelections() {
    window.savedCalendars.forEach(function (cal) {
        if (cal.breakfastItems) return; // déjà migré, ou calendrier créé après ce changement
        cal.breakfastItems = [];
        var selection = cal.breakfastSelection || {};
        Object.keys(selection).forEach(function (dishId) {
            var count = selection[dishId];
            if (!(count > 0)) return;
            var dish = window.dishes.find(function (d) { return d.id === dishId; });
            var name = dish ? dish.name : ((cal.dishesSnapshot && cal.dishesSnapshot[dishId] && cal.dishesSnapshot[dishId].name) || '');
            if (!name) return;
            cal.breakfastItems.push({
                id: 'bfast-' + Date.now() + Math.random().toString(36).substr(2, 5),
                name: name,
                qty: '',
                hasQty: false,
                count: count
            });
        });
    });
}

function loadLocalData() {
    try {
        const savedDishes = localStorage.getItem('mes_plats_locaux_v3');
        window.dishes = savedDishes ? JSON.parse(savedDishes) : defaultDishes;

        const savedListItems = localStorage.getItem('mes_list_items_locaux_v3');
        if (savedListItems) window.shoppingListItems = JSON.parse(savedListItems);

        const savedChecked = localStorage.getItem('mes_coches_locaux_v3');
        if (savedChecked) window.shoppingListChecked = new Set(JSON.parse(savedChecked));

        const savedCategories = localStorage.getItem('mes_categories_v1');
        if (savedCategories) window.categories = JSON.parse(savedCategories);

        const savedCalendars = localStorage.getItem('mes_calendriers_sauvegardes_v1');
        if (savedCalendars) window.savedCalendars = JSON.parse(savedCalendars);

        const savedActiveCalendarId = localStorage.getItem('mes_calendrier_actif_v1');
        if (savedActiveCalendarId) window.activeCalendarId = JSON.parse(savedActiveCalendarId);

        migrateLegacyCalendarDraft();
        migrateLegacyCustomIngredients();
        removeLegacyFavorites();
        migrateCalendarBreakfastSelections();
    } catch (e) {
        console.error("Erreur lecture stockage local : ", e);
        window.dishes = defaultDishes;
    }
}
