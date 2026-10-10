// --- AUCUN PLAT EXEMPLE PAR DEFAUT ---
var defaultDishes = [];

// --- VARIABLES D'ETAT GLOBALES ---
window.dishes = [];
window.viewHistory = ['view-home'];
window.editingDishId = null;
window.shoppingListItems = [];
window.shoppingListChecked = new Set();
window.categories = [];
window.activeCategoryFilter = null;
window.activeMealPickerCategoryFilter = null;
window.savedCalendars = []; // tous les calendriers (locaux + reçus), voir js/calendar.js
window.activeCalendarId = null; // id du calendrier actuellement affiché/édité dans window.savedCalendars
var pendingImportedDishes = [];
var pendingImportedCalendar = null;

var viewTitles = {
    'view-home': 'Accueil',
    'view-editor': 'Éditeur de Plats',
    'view-dish-form': 'Configuration',
    'view-course-list': 'Liste de Courses Finale',
    'view-calendar': 'Calendrier des Repas'
};
