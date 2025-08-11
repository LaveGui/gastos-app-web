// main.js - v5.0 - Dashboard Interactivo y Carga Rápida

const API_URL = 'https://script.google.com/macros/s/AKfycbyCfGgp5Rht3e_krwhKflhiOAS2oS36-1x73OZAGdJPJXvoNlItS66jLaqCkjOHTxbc/exec';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const CATEGORY_EMOJIS = { "Padel Clases": "🤸‍♂️", "Gym": "🏋️‍♀️", "Psicologa": "🧠", "Alquiler": "🏠", "WiFi": "📶", "Luz": "💡", "Agua": "💧", "Padel partidos": "🎾", "Super": "🛒", "Extras / Salidas": "🍻", "Combustible": "⛽️", "Ropa": "👕", "Transporte": "🚌", "Viajes": "✈️" };

let state = { categories: [], huchas: [], history: [], monthlyExpenses: [], selectedCategory: null, activeChart: null, currentView: 'dashboard' };

async function debugApi() {
    console.log("Solicitando datos de depuración a la API...");
    try {
        const response = await fetch(`${API_URL}?action=debugSummary`);
        const result = await response.json();
        if (result.status === 'success') {
            console.log("¡Datos recibidos! Compara 'rawValues' con 'processedData'.", result.data);
        } else { console.error("Error al recibir datos de depuración:", result); }
    } catch (error) { console.error("Fallo en la llamada de depuración:", error); }
}

document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    initRouter();
    setupGlobalEventListeners();
    loadInitialDataWithCache();
});

function loadInitialDataWithCache() {
    const cachedData = localStorage.getItem('appData');
    if (cachedData) {
        updateState(JSON.parse(cachedData));
        navigateTo(state.currentView);
    } else {
        navigateTo('dashboard');
    }
    apiService.getInitialData().then(result => {
        if (result.status === 'success') {
            localStorage.setItem('appData', JSON.stringify(result.data));
            updateState(result.data);
            if (router[state.currentView]) router[state.currentView]();
        } else {
            if (!cachedData) showToast(result.message, 'error');
        }
    }).catch(error => {
        if (!cachedData) showToast(error.message, 'error');
    });
}

// main.js -> Reemplaza esta función
function updateState(data) {
    if (data.summary) {
        // Guardamos el objeto "Total" en un sitio dedicado
        state.totalSummary = data.summary.find(item => item.detalle?.toLowerCase() === 'total');
        // Guardamos el resto de categorías en su array
        state.categories = data.summary.filter(item => item.detalle?.toLowerCase() !== 'total' && item.presupuesto > 0);
    }
    if (data.huchas) state.huchas = data.huchas;
    if (data.history) state.history = data.history;
    if (data.monthlyExpenses) state.monthlyExpenses = data.monthlyExpenses;
}

const router = { dashboard: renderDashboardView, gastos: renderGastosView, informes: renderInformesView, huchas: renderHuchasView };

function navigateTo(view) {
    state.currentView = view;
    $('#fab-add-expense').classList.toggle('hidden', view !== 'dashboard' && view !== 'gastos');
    if (state.activeChart) {
        state.activeChart.destroy();
        state.activeChart = null;
    }
    if (router[view]) router[view]();
    updateActiveNav(view);
}

function initRouter() {
    $('#bottom-nav').addEventListener('click', (e) => {
        const navButton = e.target.closest('.nav-button');
        if (navButton?.dataset.view) navigateTo(navButton.dataset.view);
    });
    $('#app-content').addEventListener('click', e => {
        const categoryCard = e.target.closest('.category-item');
        if (categoryCard) {
            toggleCategoryDetails(categoryCard);
        }
    });
}

function updateActiveNav(activeView) {
    $$('.nav-button').forEach(btn => {
        const isActive = btn.dataset.view === activeView;
        btn.classList.toggle('text-blue-600', isActive);
        btn.classList.toggle('text-gray-500', !isActive);
    });
}

function setupGlobalEventListeners() {
    $('#fab-add-expense').addEventListener('click', () => openModal());
    $('#expense-modal').addEventListener('click', (e) => {
        const cancelBtn = e.target.closest('#modal-cancel-button');
        if (cancelBtn) closeModal();
        const categoryBtn = e.target.closest('.category-btn');
        if (categoryBtn) handleCategorySelection(categoryBtn);
        const superBtn = e.target.closest('.super-btn');
        if (superBtn) handleSupermarketSelection(superBtn);
    });
    document.addEventListener('click', (e) => {
    if (e.target.id === 'refresh-dashboard') {
        refreshStateAndUI();
    }
    });
    let touchStartY = 0;
    document.addEventListener('touchstart', e => touchStartY = e.touches[0].clientY);
    document.addEventListener('touchend', e => {
    const touchEndY = e.changedTouches[0].clientY;
    if (touchEndY - touchStartY > 100) { // Deslizó hacia abajo
        refreshStateAndUI();
    }
});

}

function renderDashboardView() {
    // Protecciones por si el state.totalSummary no está definido aún
    const totalData = state.totalSummary || { llevagastadoenelmes: 0, presupuesto: 0 };
    const formatOptions = { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 };
    const totalPercent = totalData.presupuesto ? (totalData.llevagastadoenelmes / totalData.presupuesto) * 100 : 0;

    // HTML principal (usamos renderViewShell para mantener consistencia con el resto del app)
    const dashboardHTML = `
        <div class="flex items-center justify-between mb-2">
            <div id="last-updated" class="text-xs text-gray-400">
                Última actualización: ${state.lastUpdated 
                    ? state.lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) 
                    : 'Nunca'}
                ${state.lastActionInfo ? ` - ${state.lastActionInfo}` : ''}
            </div>
            <button id="refresh-dashboard" class="bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600">🔄 Refrescar</button>
        </div>

        <div class="p-4 bg-white rounded-lg shadow mb-4">
            <p class="text-lg font-semibold text-gray-600">Gasto total del mes</p>
            <div class="flex items-baseline space-x-4">
                <div class="text-4xl font-bold text-gray-900">${(totalData.llevagastadoenelmes || 0).toLocaleString('es-ES', formatOptions)}</div>
                <div class="text-sm text-gray-500">de ${(totalData.presupuesto || 0).toLocaleString('es-ES', formatOptions)}</div>
            </div>
            <p class="mt-2 font-semibold ${getBudgetColor(totalPercent)}">${totalPercent.toFixed(1)}% del presupuesto total</p>
        </div>

        <div id="distribution-area" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div id="budget-list" class="space-y-3"></div>
            <div id="distribution-chart-card" class="bg-white rounded-lg shadow p-4">
                <h3 class="text-sm font-medium text-gray-600 mb-2">Distribución</h3>
                <div class="h-64 flex items-center justify-center text-gray-400" id="distribution-placeholder">No hay datos para el gráfico.</div>
                <canvas id="distribution-chart" class="hidden"></canvas>
            </div>
        </div>
    `;

    // Usa la función compartida para pintar la vista
    renderViewShell('Dashboard', dashboardHTML);

    // Añade el listener al botón de refrescar (si existe)
    const refreshBtn = document.getElementById('refresh-dashboard');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            showLoader('Actualizando Dashboard...');
            refreshStateAndUI().then(() => hideLoader()).catch(() => hideLoader());
        });
    }

    // Pinta la lista de presupuestos (si hay datos)
    try {
        if (state.categories && state.categories.length > 0) {
            updateBudgetList(state.categories);
        } else {
            const list = document.getElementById('budget-list');
            if (list) list.innerHTML = `<div class="text-center text-gray-400 animate-pulse">Cargando presupuestos...</div>`;
        }

        // Si existe una función de gráfico, intenta crear el gráfico con datos
        if (typeof createDistributionChart === 'function' && document.getElementById('distribution-chart')) {
            // pasar las categorías con valor > 0
            const chartData = (state.categories || []).filter(c => (c.llevagastadoenelmes || 0) > 0);
            if (chartData.length > 0) {
                document.getElementById('distribution-chart').classList.remove('hidden');
                const placeholder = document.getElementById('distribution-placeholder');
                if (placeholder) placeholder.style.display = 'none';
                createDistributionChart(chartData);
            } else {
                const placeholder = document.getElementById('distribution-placeholder');
                if (placeholder) placeholder.style.display = 'block';
            }
        }
    } catch (err) {
        console.warn('Error pintando dashboard (no crítico):', err);
    }

    // Actualiza el texto de "Última actualización" (si ya venía en state)
    updateLastUpdatedTime(state.lastActionInfo || '');
}


// [CORREGIDO] Se aplica el formato de moneda a ambos números.
function updateBudgetList(categories) {
    const listContainer = $('#budget-list');
    if (!listContainer) return;
    const formatOptions = { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 };
    
    listContainer.innerHTML = categories
        .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated))
        .map(cat => {
            const percentage = cat.presupuesto > 0 ? (cat.llevagastadoenelmes / cat.presupuesto) * 100 : 0;
            const progressColor = percentage > 100 ? 'bg-red-500' : (percentage > 85 ? 'bg-yellow-500' : 'bg-blue-600');
            const emoji = CATEGORY_EMOJIS[cat.detalle] || '💰';
            return `
            <div class="bg-white p-4 rounded-lg shadow-sm category-item cursor-pointer hover:shadow-md transition-shadow" data-category="${cat.detalle}">
                <div class="flex justify-between items-center mb-2">
                    <span class="font-bold text-gray-700">${emoji} ${cat.detalle}</span>
                    <span class="font-semibold text-gray-800">${percentage.toFixed(1)}%</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fg ${progressColor}" style="width: ${Math.min(percentage, 100)}%;"></div>
                </div>
                <div class="flex justify-between items-center mt-2 text-sm text-gray-500">
                    <span>${(cat.llevagastadoenelmes || 0).toLocaleString('es-ES', formatOptions)}</span>
                    <span>${(cat.presupuesto || 0).toLocaleString('es-ES', formatOptions)}</span>
                </div>
                <div class="category-details-container"></div>
            </div>`;
    }).join('');
}

function getBudgetColor(percent) {
    if (percent < 50) return 'text-green-600';
    if (percent < 80) return 'text-yellow-600';
    return 'text-red-600';
}


function toggleCategoryDetails(cardElement) {
    const categoryName = cardElement.dataset.category;
    const container = cardElement.querySelector('.category-details-container');
    cardElement.classList.toggle('is-open');

    if (cardElement.classList.contains('is-open')) {
        const normalizedCategoryName = normalizeString(categoryName);
        const categoryExpenses = state.monthlyExpenses.filter(g => normalizeString(g.categoria) === normalizedCategoryName);
        container.innerHTML = categoryExpenses.length === 0 
            ? `<p class="text-center text-gray-500 text-sm pt-4">No hay gastos para esta categoría este mes.</p>`
            : `<div class="mt-4 pt-4 border-t border-gray-200 space-y-2">` + 
              categoryExpenses.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(gasto => `
                <div class="flex items-center justify-between text-sm">
                    <div>
                        <p class="font-semibold text-gray-700">${gasto.detalle}</p>
                        <p class="text-xs text-gray-400">${new Date(gasto.fecha).toLocaleDateString('es-ES')}</p>
                    </div>
                    <span class="font-medium text-gray-800">${(gasto.monto || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>`).join('') + `</div>`;
    } else {
        container.innerHTML = '';
    }
}

function updateLastUpdatedTime(actionInfo = '') {
    state.lastUpdated = new Date();
    state.lastActionInfo = actionInfo;
    const el = document.getElementById('last-updated');
    if (el) {
        el.textContent = `Última actualización: ${state.lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} ${actionInfo ? `- ${actionInfo}` : ''}`;
    }
}


function showLoader(message = 'Cargando...') {
    // Evitar duplicados
    if (document.getElementById('global-loader')) return;

    const loader = document.createElement('div');
    loader.id = 'global-loader';
    loader.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50';
    loader.innerHTML = `
        <div class="bg-white p-4 rounded-lg flex flex-col items-center shadow">
            <div style="width:40px;height:40px;border-radius:9999px;border:4px solid #e5e7eb;border-top-color:#3b82f6;animation:spin 1s linear infinite"></div>
            <p class="text-sm text-gray-700 mt-2">${message}</p>
        </div>
    `;
    // pequeño CSS inline para animación (si no existe globalmente)
    if (!document.getElementById('loader-spin-style')) {
        const s = document.createElement('style');
        s.id = 'loader-spin-style';
        s.innerHTML = `@keyframes spin { to { transform: rotate(360deg); } }`;
        document.head.appendChild(s);
    }
    document.body.appendChild(loader);
}


function hideLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) loader.remove();
}




async function renderGastosView() {
    renderViewShell('Gastos del Mes', '<div id="expenses-list" class="space-y-3"><div class="text-center text-gray-400 animate-pulse">Cargando...</div></div>');
    const listContainer = $('#expenses-list');
    if (state.monthlyExpenses.length > 0) {
        listContainer.innerHTML = state.monthlyExpenses.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(gasto => `
            <div class="bg-white p-3 rounded-lg shadow flex items-center justify-between">
                <div>
                    <p class="font-semibold">${gasto.detalle}</p>
                    <p class="text-sm text-gray-500">${gasto.categoria || 'Sin Categoría'} - ${new Date(gasto.fecha).toLocaleDateString('es-ES')}</p>
                </div>
                <div class="flex items-center space-x-2">
                    <span class="font-bold text-gray-800">${(gasto.monto || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                    <button class="edit-btn p-2 text-gray-400 hover:text-blue-600" data-gasto='${JSON.stringify(gasto)}'>✏️</button>
                    <button class="delete-btn p-2 text-gray-400 hover:text-red-600" data-gasto='${JSON.stringify(gasto)}'>🗑️</button>
                </div>
            </div>`).join('');
        $$('.edit-btn').forEach(btn => btn.addEventListener('click', handleEditClick));
        $$('.delete-btn').forEach(btn => btn.addEventListener('click', handleDeleteClick));
    } else {
        listContainer.innerHTML = `<p class="text-center text-gray-500">No hay gastos este mes.</p>`;
    }
}

// main.js -> Reemplaza la función completa
async function renderInformesView() {
    // [CORREGIDO] Usamos renderViewShell desde el inicio para preparar la vista y mostrar el spinner.
    // Esto evita el error al no encontrar 'informes-container', porque ahora dibujamos dentro de #app-content.
    renderViewShell('Informes', `
        <div class="bg-white p-4 rounded-lg shadow">
            <h2 class="text-lg font-semibold text-gray-500 mb-2">Evolución de Gastos</h2>
            <div id="informes-filters" class="relative mb-4"></div>
            <div class="h-80 mt-4 flex justify-center items-center">
                <div class="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500" id="informes-loader"></div>
                <canvas id="history-chart" class="hidden"></canvas>
            </div>
        </div>
    `);

    // Si no tenemos los datos del historial, los pedimos.
    // Esta lógica se mantiene igual.
    if (!state.history || state.history.length === 0) {
        try {
            const result = await apiService.call('getSheetData', { sheetName: 'HistorialGastos' });
            if (result.status === 'success') {
                state.history = result.data.processedData;
            } else {
                // Si la API falla, mostramos un error donde iría el gráfico.
                $('#informes-loader').parentElement.innerHTML = '<p class="text-center text-red-500">No se pudo cargar el historial.</p>';
                return;
            }
        } catch (error) {
            showToast('No se pudo cargar el historial.', 'error');
            $('#informes-loader').parentElement.innerHTML = '<p class="text-center text-red-500">Error de conexión.</p>';
            return;
        }
    }

    // Una vez tenemos los datos, ocultamos el spinner y mostramos el canvas.
    $('#informes-loader')?.remove();
    $('#history-chart')?.classList.remove('hidden');

    populateInformesFilters();
    updateHistoryChart();
}

function checkBudgetWarnings() {
    state.categories.forEach(cat => {
        if (cat.presupuesto > 0) {
            const percent = (cat.llevagastadoenelmes / cat.presupuesto) * 100;
            if (percent >= 80) {
                showToast(`⚠️ Atención: "${cat.detalle}" al ${percent.toFixed(0)}% del presupuesto`, 'warning');
            }
        }
    });
}


// main.js -> Reemplaza la función
async function renderHuchasView() {
    renderViewShell('Mis Huchas', '<div id="huchas-container" class="space-y-4"><div class="text-center text-gray-400 animate-pulse">Cargando...</div></div>');

    // Si no tenemos los datos de las huchas, los pedimos
    if (!state.huchas || state.huchas.length === 0) {
        try {
            const result = await apiService.call('getSheetData', { sheetName: 'Huchas' });
            if (result.status === 'success') {
                state.huchas = result.data.processedData;
            }
        } catch (error) {
            showToast('No se pudieron cargar las huchas.', 'error');
        }
    }

    const container = $('#huchas-container');
    let totalHuchas = 0;
    container.innerHTML = (state.huchas || []).map(hucha => {
        totalHuchas += hucha.monto || 0;
        return `<div class="bg-white p-4 rounded-lg shadow"><p class="font-bold text-lg">${hucha.proposito}</p><p class="text-2xl text-green-600 font-semibold">${(hucha.monto || 0).toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</p><p class="text-sm text-gray-500">En: ${hucha.donde}</p></div>`;
    }).join('');
    container.insertAdjacentHTML('afterbegin', `<div class="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-lg shadow mb-6"><p class="font-bold">Total Ahorrado</p><p class="text-3xl">${totalHuchas.toLocaleString('es-ES',{style:'currency','currency':'EUR'})}</p></div>`);
}

function renderViewShell(title, content) {
    $('#app-content').innerHTML = `<h1 class="text-2xl font-bold text-gray-800 mb-4">${title}</h1><div class="space-y-6">${content}</div>`;
}

function populateInformesFilters() {
    const uniqueCategories = [...new Set((state.history || []).map(item => item.categoria))].filter(Boolean);
    const filtersContainer = $('#informes-filters');
    if (!filtersContainer) return;
    filtersContainer.innerHTML = `
        <button id="informes-dropdown-btn" class="w-full bg-white border rounded-md p-2 flex justify-between items-center">
            <span>Seleccionar categorías...</span>
            <span>▼</span>
        </button>
        <div id="informes-dropdown-panel" class="hidden absolute w-full bg-white border rounded-md mt-1 p-2 space-y-2 z-10">
            <label class="flex items-center space-x-2"><input type="checkbox" class="h-4 w-4" name="informes-cat" value="Total" checked><span>Total</span></label>
            ${uniqueCategories.map(cat => `<label class="flex items-center space-x-2"><input type="checkbox" class="h-4 w-4" name="informes-cat" value="${cat}"><span>${cat}</span></label>`).join('')}
        </div>`;
    $('#informes-dropdown-btn').addEventListener('click', () => $('#informes-dropdown-panel').classList.toggle('hidden'));
    $$('input[name="informes-cat"]').forEach(checkbox => checkbox.addEventListener('change', () => {
        const checkedCount = $$('input[name="informes-cat"]:checked').length;
        if (checkedCount > 4) {
            checkbox.checked = false;
            showToast('Máximo 4 categorías.', 'error');
        }
        updateHistoryChart();
    }));
}

function updateHistoryChart() {
    if (state.activeChart) state.activeChart.destroy();
    if (!document.getElementById('history-chart')) return;
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const historyData = (state.history || []).filter(d => d.mes && d.ano && !isNaN(d.gasto)).sort((a,b) => (a.ano * 100 + meses.indexOf(a.mes)) - (b.ano * 100 + meses.indexOf(b.mes)));
    const labels = [...new Set(historyData.map(d => `${d.mes.substring(0,3)} ${d.ano}`))];
    const selectedCategories = [...$$('input[name="informes-cat"]:checked')].map(cb => cb.value);
    const datasets = selectedCategories.map((cat, index) => {
        const data = labels.map(label => {
            const [mes, ano] = label.split(' ');
            const relevantEntries = historyData.filter(d => d.ano == ano && d.mes.startsWith(mes) && (normalizeString(d.categoria) === normalizeString(cat)));
            return relevantEntries.reduce((sum, entry) => sum + (entry.gasto || 0), 0);
        });
        const colors = ['#0284C7', '#DC2626', '#16A34A', '#F97316', '#7C3AED'];
        return { label: cat, data, borderColor: colors[index % colors.length], fill: false, tension: 0.1 };
    });
    state.activeChart = new Chart($('#history-chart').getContext('2d'), { type: 'line', data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false } });
}

function openModal() {
    let form = $('#expense-form');
    if (!form) {
        const modalContainer = $('#expense-modal');
        if (!modalContainer) {
             const modalHtml = `<div id="expense-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 hidden z-50"><div class="bg-white rounded-lg shadow-xl w-full max-w-md"><form id="expense-form" class="p-6"></form></div></div>`;
             document.body.insertAdjacentHTML('beforeend', modalHtml);
        }
    }
    $('#expense-form').innerHTML = `
        <h3 id="modal-title" class="text-xl font-semibold mb-4">Añadir Gasto</h3>
        <div class="mb-4">
            <p class="block text-sm font-medium text-gray-700 mb-2">Categoría</p>
            <div id="category-buttons" class="grid grid-cols-3 sm:grid-cols-4 gap-2"></div>
        </div>
        <div id="modal-dynamic-content" class="space-y-4"></div>
        <div class="flex justify-end space-x-3 mt-6">
            <button type="button" id="modal-cancel-button" class="bg-gray-200 px-4 py-2 rounded-md">Cancelar</button>
            <button type="submit" id="modal-save-button" class="bg-blue-600 text-white px-4 py-2 rounded-md">Guardar</button>
        </div>`;
    populateCategoryButtons();
    $('#expense-modal').classList.remove('hidden');
    $('#expense-form').addEventListener('submit', handleFormSubmit);
}

function closeModal() {
    $('#expense-modal').classList.add('hidden');
}

function populateCategoryButtons() {
    const container = $('#category-buttons');
    if (!container) return;
    container.innerHTML = state.categories.map(item => {
        if (!item.detalle) return '';
        const emoji = CATEGORY_EMOJIS[item.detalle] || '💰';
        return `<button type="button" class="category-btn text-center p-2 border rounded-lg hover:border-blue-500" data-category="${item.detalle}">
                    <span class="text-2xl">${emoji}</span>
                    <span class="block text-xs mt-1">${item.detalle}</span>
                </button>`;
    }).join('');
}

// main.js -> Reemplaza la función completa
function handleCategorySelection(button) {
    state.selectedCategory = button.dataset.category;
    $$('.category-btn').forEach(btn => btn.classList.remove('ring-2', 'ring-blue-500'));
    button.classList.add('ring-2', 'ring-blue-500');

    const dynamicContent = $('#modal-dynamic-content');
    let htmlContent = '';

    // Flujo especial para Supermercado
    if (state.selectedCategory === 'Super') {
        htmlContent += `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Comercio</label>
                <div class="grid grid-cols-3 gap-2">
                    <button type="button" class="super-btn p-2 border rounded-lg" data-super="Mercadona">Mercadona</button>
                    <button type="button" class="super-btn p-2 border rounded-lg" data-super="Consum">Consum</button>
                    <button type="button" class="super-btn p-2 border rounded-lg" data-super="Otro">Otro</button>
                </div>
            </div>
            <div id="super-extra-fields"></div>`; // Contenedor para los campos que aparecen después
    } 
    // Para todas las demás categorías (y como base para Supermercado)
    else {
        htmlContent += `
            <div>
                <label for="monto" class="block text-sm font-medium text-gray-700">Monto (€)</label>
                <input type="text" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]+" id="monto" name="monto" required class="mt-1 block w-full border rounded-md p-2">
            </div>
            <div>
                <label for="detalle" class="block text-sm font-medium text-gray-700">Detalle (Opcional)</label>
                <input type="text" name="detalle" id="detalle" class="mt-1 block w-full border rounded-md p-2">
            </div>
            <div class="flex items-center mt-2">
                <input type="checkbox" id="esCompartido" name="esCompartido" class="h-4 w-4 rounded">
                <label for="esCompartido" class="ml-2 block text-sm text-gray-900">Gasto Compartido (50%)</label>
            </div>`;
    }

    dynamicContent.innerHTML = htmlContent;
}

// main.js -> Reemplaza la función completa
function handleSupermarketSelection(button) {
    $$('.super-btn').forEach(btn => btn.classList.remove('ring-2', 'ring-blue-500'));
    button.classList.add('ring-2', 'ring-blue-500');

    const superType = button.dataset.super;
    const extraFields = $('#super-extra-fields');
    let commonFields = `
        <div>
            <label for="monto" class="block text-sm font-medium text-gray-700">Monto (€)</label>
            <input type="text" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]+" id="monto" name="monto" required class="mt-1 block w-full border rounded-md p-2">
        </div>
        <div class="flex items-center mt-2">
            <input type="checkbox" id="esCompartido" name="esCompartido" class="h-4 w-4 rounded">
            <label for="esCompartido" class="ml-2 block text-sm text-gray-900">Gasto Compartido (50%)</label>
        </div>`;

    if (superType === 'Otro') {
        extraFields.innerHTML = `
            <div>
                <label for="detalle" class="block text-sm font-medium text-gray-700">Nombre del Supermercado</label>
                <input type="text" name="detalle" id="detalle" required class="mt-1 block w-full border rounded-md p-2">
            </div>
            ${commonFields}`;
    } else {
        $('#expense-form').dataset.supermercado = superType;
        extraFields.innerHTML = commonFields;
    }
}

// main.js -> Reemplaza la función completa
async function handleFormSubmit(e) {
    e.preventDefault();
    if (!state.selectedCategory) { showToast('Selecciona una categoría.', 'error'); return; }
    const form = e.target;
    const formData = new FormData(form);
    let detalle = formData.get('detalle');
    if (state.selectedCategory === 'Super' && !detalle) {
        detalle = form.dataset.supermercado || 'Supermercado';
    }
    const data = { 
        categoria: state.selectedCategory, 
        monto: parseFloat(formData.get('monto').replace(',', '.')), 
        detalle, 
        esCompartido: formData.get('esCompartido') === 'on' 
    };

    closeModal();
    showLoader('Añadiendo gasto...');

    try {
        const result = await apiService.call('addExpense', data);
        if (result.status !== 'success') throw new Error(result.message);

        // Llamamos a la función de actualización con TODOS los datos necesarios
        updateStateAfterAddExpense(result.data.receipt, result.data.budgetInfo, result.data.totalBudgetInfo);

        // El toast de confirmación ahora usará los datos correctos
        showConfirmationToast(result.data.receipt, result.data.budgetInfo);

    } catch (error) { 
        showToast(error.message, 'error'); 
        
    } finally {
    hideLoader();
    }

}

function updateStateAfterAddExpense(receipt, budgetInfo, totalBudgetInfo) {
    // Mostrar loader y refrescar desde la API para garantizar consistencia
    showLoader('Añadiendo gasto...');
    return refreshStateAndUI().then(() => {
        // Actualiza la leyenda de la última acción
        const cat = receipt?.categoria || receipt?.detalle || 'categoría';
        updateLastUpdatedTime(`Gasto añadido en ${cat}`);
        hideLoader();
        // Guardar en localStorage ya lo hace refreshStateAndUI()
    }).catch(err => {
        hideLoader();
        console.error('Error en updateStateAfterAddExpense:', err);
        throw err;
    });
}



function updateStateAfterEdit(oldGasto, newMonto, budgetInfo, totalBudgetInfo) {
    showLoader('Editando gasto...');
    return refreshStateAndUI().then(() => {
        const cat = oldGasto?.categoria || oldGasto?.detalle || 'categoría';
        updateLastUpdatedTime(`Gasto editado en ${cat}`);
        hideLoader();
    }).catch(err => {
        hideLoader();
        console.error('Error en updateStateAfterEdit:', err);
        throw err;
    });
}


function updateStateAfterDeleteExpense(deletedGasto, budgetInfo, totalBudgetInfo) {
    showLoader('Eliminando gasto...');
    return refreshStateAndUI().then(() => {
        const cat = deletedGasto?.categoria || deletedGasto?.detalle || 'categoría';
        updateLastUpdatedTime(`Gasto eliminado en ${cat}`);
        hideLoader();
    }).catch(err => {
        hideLoader();
        console.error('Error en updateStateAfterDeleteExpense:', err);
        throw err;
    });
}






function showConfirmationToast(receipt, budgetInfo) {
    // Elimina cualquier toast anterior
    const existingToast = document.getElementById('confirmation-toast');
    if (existingToast) existingToast.remove();

    const toastContainer = $('#toast-container');
    if (!toastContainer || !budgetInfo) return;

    const percentage = budgetInfo.porcentaje || 0;
    const formatOptions = { style: 'currency', currency: 'EUR' };

    const toast = document.createElement('div');
    toast.id = 'confirmation-toast';
    toast.className = 'fixed inset-x-4 bottom-24 bg-white p-4 rounded-lg shadow-2xl border';
    toast.innerHTML = `
        <div class="flex justify-between items-start">
            <div>
                <h4 class="font-bold text-lg text-green-600">Gasto Añadido</h4>
                <p class="text-gray-700">En <span class="font-semibold">${receipt.categoria}</span>, llevas gastado el <span class="font-bold">${percentage.toFixed(1)}%</span> de tu presupuesto.</p>
                <p class="text-sm text-gray-500">${(budgetInfo.gastado || 0).toLocaleString('es-ES', formatOptions)} de ${budgetInfo.presupuesto.toLocaleString('es-ES', formatOptions)}</p>
            </div>
            <button id="toast-close-btn" class="text-gray-400 hover:text-gray-800">&times;</button>
        </div>
        <div class="flex justify-end space-x-2 mt-4">
            <button id="toast-edit-btn" class="text-sm bg-gray-200 px-3 py-1 rounded-md hover:bg-gray-300">Editar</button>
            <button id="toast-add-another-btn" class="text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700">Añadir Otro</button>
        </div>
    `;

    toastContainer.appendChild(toast);

    const close = () => toast.remove();

    $('#toast-close-btn').addEventListener('click', close);
    $('#toast-add-another-btn').addEventListener('click', () => {
        close();
        openModal();
    });

    $('#toast-edit-btn').addEventListener('click', () => {
        close();
        // Simula el evento que necesitaría la función de editar
        const fakeEvent = { target: { closest: () => ({ dataset: { gasto: JSON.stringify(receipt) } }) } };
        handleEditClick(fakeEvent);
    });
}


async function refreshStateAndUI() {
    try {
        const result = await apiService.getInitialData();
        if (result.status === 'success') {
            updateState(result.data);

            // Renderiza según la vista actual
            if (state.currentView === 'dashboard') {
                renderDashboardView();
            } else if (state.currentView === 'gastos') {
                renderGastosView();
            } else if (state.currentView === 'informes') {
                renderInformesView();
            }

            // Guardar en cache local
            localStorage.setItem('appData', JSON.stringify(result.data));

            // Actualizar hora de última actualización
            updateLastUpdatedTime();
        } else {
            showToast('Error al refrescar datos: ' + result.message, 'error');
        }
    } catch (error) {
        showToast('Error al conectar con la API: ' + error.message, 'error');
    }
}



async function handleEditClick(e) {
    const gasto = JSON.parse(e.target.closest('[data-gasto]').dataset.gasto);
    const nuevoMontoStr = prompt(`Introduce el nuevo monto para "${gasto.detalle || gasto.categoria}":`, gasto.monto);

    if (nuevoMontoStr) {
        const nuevoMonto = parseFloat(nuevoMontoStr.replace(',', '.'));
        if (!isNaN(nuevoMonto) && nuevoMonto > 0) {
            try {
                // ⬅️ Loader inmediato
                showLoader('Editando gasto...');

                const result = await apiService.call('updateExpense', { 
                    rowId: gasto.rowid, 
                    monto: nuevoMonto, 
                    categoria: gasto.categoria 
                });

                if (result.status !== 'success') throw new Error(result.message);

                // Actualizamos el estado local con los nuevos datos de la API
                await updateStateAfterEdit(gasto, nuevoMonto, result.data.budgetInfo, result.data.totalBudgetInfo);
                showToast('Monto actualizado', 'success');

            } catch (error) { 
                showToast(error.message, 'error'); 
            } finally {
                hideLoader(); // ⬅️ Se oculta al final, pase lo que pase
            }
        } else {
            showToast('Monto no válido.', 'error');
        }
    }
}





async function handleDeleteClick(e) {
    const btn = e.target.closest('.delete-btn');
    const gasto = JSON.parse(btn.dataset.gasto);

    if (confirm(`¿Eliminar el gasto "${gasto.detalle || gasto.categoria}"?`)) {
        try {
            showLoader('Eliminando gasto...');
            const result = await apiService.call('deleteExpense', { rowId: parseInt(gasto.rowid), categoria: gasto.categoria });
            if (result.status !== 'success') throw new Error(result.message);

            updateStateAfterDeleteExpense(gasto, result.data.budgetInfo, result.data.totalBudgetInfo);
            showToast('Gasto eliminado', 'success');

        } catch (error) { 
            showToast(error.message, 'error'); 
        } finally {
    hideLoader();
    }
        
    }
}

const apiService = {
    getInitialData: () => fetch(`${API_URL}?action=getInitialData`).then(res => res.json()),
    getExpenses: (year, month) => fetch(`${API_URL}?action=getExpenses&year=${year}&month=${month}`).then(res => res.json()),
    call: (action, data) => {
        return fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8', },
            body: JSON.stringify({ action, data }),
        }).then(response => {
            if (!response.ok) {
                return response.json().then(errorBody => { throw new Error(errorBody.message || 'Error en la petición a la API'); });
            }
            return response.json();
        });
    }
};

function showToast(message, type = 'success') {
    const container = $('#toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-red-600' : (type === 'receipt' ? 'bg-blue-600' : 'bg-green-500');
    toast.className = `p-4 rounded-lg text-white shadow-md mb-2`;
    container.appendChild(toast);
    const animation = toast.animate([
        { transform: 'translateY(20px)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 },
        { transform: 'translateY(0)', opacity: 1 },
        { transform: 'translateY(-20px)', opacity: 0 }
    ], {
        duration: 4000,
        easing: 'ease-in-out'
    });
    animation.onfinish = () => toast.remove();
    toast.innerHTML = message;
}

function normalizeString(str) {
    if (!str || typeof str !== 'string') return '';
    return str.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, '');
}

function injectStyles() {
    const styleId = 'app-dynamic-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
        .progress-bar-bg { background-color: #e5e7eb; border-radius: 9999px; height: 0.75rem; overflow: hidden; }
        .progress-bar-fg { height: 100%; border-radius: 9999px; transition: width 0.5s ease-in-out; }
        @keyframes flash { 0%, 100% { background-color: #f0fdf4; } 50% { background-color: #a7f3d0; } }
        .flash-update { animation: flash 1.5s ease-in-out; }
        .category-details-container { max-height: 0; overflow: hidden; transition: max-height 0.5s ease-in-out; }
        .category-item.is-open .category-details-container { max-height: 500px; }
    `;
    document.head.appendChild(style);
}
