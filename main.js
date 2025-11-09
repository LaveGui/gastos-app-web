// main.js - v5.0 - Dashboard Interactivo y Carga Rápida

const API_URL = 'https://script.google.com/macros/s/AKfycbwSO_oquwn67QerFAV0EjGQ0aebSPTLqSsxWRIZ6gAbAEURhrJduUybgoEl83jiFpUGvg/exec';
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

// main.js -> REEMPLAZA tu función initRouter por esta versión final
function initRouter() {
    $('#bottom-nav').addEventListener('click', (e) => {
        const navButton = e.target.closest('.nav-button');
        if (navButton?.dataset.view) navigateTo(navButton.dataset.view);
    });

    $('#app-content').addEventListener('click', async e => {
        const categoryCard = e.target.closest('.category-item');
        if (categoryCard) return toggleCategoryDetails(categoryCard);

        const reportCategoryItem = e.target.closest('.report-category-item');
        if (reportCategoryItem) return handleReportCategoryClick(reportCategoryItem);
        
        const forgottenBtn = e.target.closest('#add-forgotten-expense-btn');
        if (forgottenBtn) {
            const { year, month } = forgottenBtn.dataset;
            const historicalDate = new Date(year, month - 1, 15);
            return openModal(null, historicalDate.toISOString());
        }

        // ✅ INICIO DE LA CORRECCIÓN: Lógica de archivado con comprobación de error
        const archiveBtn = e.target.closest('#archive-month-btn');
        if (archiveBtn) {
            const { year, month } = archiveBtn.dataset;
            if (confirm(`¿Estás seguro de que quieres cerrar y archivar el mes ${month}/${year}? Esta acción no se puede deshacer.`)) {
                showLoader('Archivando mes...');
                try {
                    // 1. Hacemos la llamada a la API
                    const result = await apiService.call('archiveMonth', { year, month });

                    // 2. COMPROBAMOS LA RESPUESTA
                    if (result.status === 'success') {
                        showToast('Mes archivado con éxito.', 'success');
                        // Forzamos la recarga del informe para que ya no muestre los botones
                        // Simulamos un evento 'change' en el selector
                        const selector = $('#month-selector');
                        if (selector) selector.dispatchEvent(new Event('change'));
                    } else {
                        // Si la API devuelve {"status": "error"}, mostramos el mensaje
                        throw new Error(result.message || 'Error desconocido al archivar.');
                    }
                } catch (error) {
                    // Capturamos tanto errores de red como errores lógicos
                    showToast(error.message, 'error');
                } finally {
                    hideLoader();
                }
            }
        }
        const assistantBtn = e.target.closest('#open-investment-assistant');
        if (assistantBtn) {
            return openInvestmentAssistant();
        }
        // ✅ FIN DE LA CORRECCIÓN
    });
}

function updateActiveNav(activeView) {
    $$('.nav-button').forEach(btn => {
        const isActive = btn.dataset.view === activeView;
        btn.classList.toggle('text-blue-600', isActive);
        btn.classList.toggle('text-gray-500', !isActive);
    });
}

// main.js -> Reemplaza esta función
function setupGlobalEventListeners() {
    $('#fab-add-expense').addEventListener('click', () => openModal());
    $('#expense-modal').addEventListener('click', (e) => {
        if (e.target.id === 'modal-cancel-button') closeModal();
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

    // --- LÓGICA DE PULL-TO-REFRESH MEJORADA ---
    let touchStartY = 0;
    const appContent = $('#app-content');

    appContent.addEventListener('touchstart', e => {
        // Solo registramos el inicio si estamos en la parte superior de la página
        if (appContent.scrollTop === 0) {
            touchStartY = e.touches[0].clientY;
        } else {
            touchStartY = 0; // Reseteamos si no estamos en el top
        }
    }, { passive: true });

    appContent.addEventListener('touchmove', e => {
        const touchEndY = e.touches[0].clientY;
        // Si el usuario desliza hacia abajo y empezamos desde el top
        if (touchStartY > 0 && touchEndY - touchStartY > 100) {
            // Prevenimos que el gesto se siga propagando
            touchStartY = 0;

            // Mostramos un loader y refrescamos
            showLoader('Actualizando...');
            refreshStateAndUI().then(() => hideLoader());
        }
    }, { passive: true });
}

// main.js -> REEMPLAZA tu función renderDashboardView por esta
function renderDashboardView() {
    // 1. Obtenemos los datos del estado (state)
    const totalData = state.totalSummary || { llevagastadoenelmes: 0, presupuesto: 0 };
    const formatOptions = { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 };
    const totalPercent = totalData.presupuesto ? (totalData.llevagastadoenelmes / totalData.presupuesto) * 100 : 0;
    
    // Datos para la tarjeta de Potencial de Inversión
    const investmentPotential = state.investmentPotential || 0;
    const totalIncome = state.totalIncome || 0;
    const investmentColor = investmentPotential >= 0 ? 'text-green-600' : 'text-red-600';

    // 2. Construimos el HTML del Dashboard
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

        <div class="bg-white p-4 rounded-lg shadow mb-4 text-center">
            <h2 class="text-lg font-semibold text-gray-700 mb-3">¿Acabas de cobrar?</h2>
            <button id="open-investment-assistant" class="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition">
                🚀 Abrir Asistente de Inversión
            </button>
        </div>

        <div class="p-4 bg-white rounded-lg shadow mb-4">
            <p class="text-lg font-semibold text-gray-600">Potencial de Inversión (Plan)</p>
            <div class="text-4xl font-bold ${investmentColor}">${(investmentPotential).toLocaleString('es-ES', formatOptions)}</div>
            <p class="mt-2 text-sm text-gray-500">
                ${(totalIncome).toLocaleString('es-ES', formatOptions)} (Ingresos) - ${(totalData.presupuesto || 0).toLocaleString('es-ES', formatOptions)} (Gastos)
            </p>
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

    // 3. Renderizamos el esqueleto
    renderViewShell('Dashboard', dashboardHTML);

    // 4. Añadimos el listener para el botón de refrescar
    const refreshBtn = document.getElementById('refresh-dashboard');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            showLoader('Actualizando Dashboard...');
            refreshStateAndUI().then(() => hideLoader()).catch(() => hideLoader());
        });
    }

    // 5. Pintamos los componentes hijos (lista y gráfico)
    try {
        if (state.categories && state.categories.length > 0) {
            updateBudgetList(state.categories);
        } else {
            const list = document.getElementById('budget-list');
            if (list) list.innerHTML = `<div class="text-center text-gray-400 animate-pulse">Cargando presupuestos...</div>`;
        }

        if (typeof createDistributionChart === 'function' && document.getElementById('distribution-chart')) {
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

    // 6. Actualizamos la hora de la última acción
    updateLastUpdatedTime(state.lastActionInfo || '');
}

// main.js -> REEMPLAZA esta función para usar atributos de datos en vez de 'title'
function updateBudgetList(categories) {
    const listContainer = $('#budget-list');
    if (!listContainer) return;
    const formatOptions = { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 };
    
    const velocityEmojis = {
        warning: '⚠️',
        overspending: '🛑'
    };

    listContainer.innerHTML = categories
        .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated))
        .map(cat => {
            const percentage = cat.presupuesto > 0 ? (cat.llevagastadoenelmes / cat.presupuesto) * 100 : 0;
            const progressColor = percentage > 100 ? 'bg-red-500' : (percentage > 85 ? 'bg-yellow-500' : 'bg-blue-600');
            const emoji = CATEGORY_EMOJIS[cat.detalle] || '💰';

            // Preparamos el emoji y el texto del tooltip
            const velocityEmoji = velocityEmojis[cat.spendingVelocity] || '';
            let tooltipText = '';
            if (velocityEmoji) {
                const projected = (cat.projectedSpend || 0).toLocaleString('es-ES', formatOptions);
                const budget = (cat.presupuesto || 0).toLocaleString('es-ES', formatOptions);
                if (cat.spendingVelocity === 'overspending') {
                    tooltipText = `¡Atención! A este ritmo, tu gasto proyectado es de ${projected}, superando tu presupuesto de ${budget}.`;
                } else if (cat.spendingVelocity === 'warning') {
                    tooltipText = `Cuidado. A este ritmo, tu gasto proyectado es de ${projected}, muy cerca de tu presupuesto de ${budget}.`;
                }
            }
            
            // ✅ CAMBIO: Usamos una clase y un data-attribute en lugar de 'title'
            const emojiSpan = velocityEmoji 
                ? `<span class="velocity-emoji cursor-pointer" data-tooltip="${tooltipText}">${velocityEmoji}</span>`
                : '';

            return `
            <div class="bg-white p-4 rounded-lg shadow-sm category-item cursor-pointer hover:shadow-md transition-shadow" data-category="${cat.detalle}">
                <div class="flex justify-between items-center mb-2">
                    <span class="font-bold text-gray-700">${emoji} ${cat.detalle} ${emojiSpan}</span>
                    <span class="font-semibold text-gray-800">${percentage.toFixed(1)}%</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fg ${progressColor}" style="width: ${Math.min(percentage, 100)}%;"></div>
                </div>
                <div class="flex justify-between items-center mt-2 text-sm text-gray-500">
                    <span>${(cat.llevagastadoenelmes || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                    <span>${(cat.presupuesto || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
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


// main.js -> Reemplaza esta función
function toggleCategoryDetails(cardElement) {
    const categoryName = cardElement.dataset.category;
    const container = cardElement.querySelector('.category-details-container');
    const isOpen = cardElement.classList.toggle('is-open');

    if (isOpen) {
        const normalizedCategoryName = normalizeString(categoryName);
        const categoryExpenses = state.monthlyExpenses.filter(g => normalizeString(g.categoria) === normalizedCategoryName);

        if (categoryExpenses.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500 text-sm pt-4">No hay gastos para esta categoría este mes.</p>`;
        } else {
            const expensesHTML = categoryExpenses
                .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
                .map(gasto => `
                    <div class="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-b-0">
                        <div>
                            <p class="font-semibold text-gray-700">${gasto.detalle}</p>
                            <p class="text-xs text-gray-400">${new Date(gasto.fecha).toLocaleDateString('es-ES')}</p>
                        </div>
                        <div class="flex items-center space-x-2">
                            <span class="font-medium text-gray-800">${(gasto.monto || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                            <button class="edit-btn p-2 text-gray-400 hover:text-blue-600" data-gasto='${JSON.stringify(gasto)}'>✏️</button>
                            <button class="delete-btn p-2 text-gray-400 hover:text-red-600" data-gasto='${JSON.stringify(gasto)}'>🗑️</button>
                        </div>
                    </div>`
                ).join('');

            container.innerHTML = `<div class="mt-4 pt-2 border-t border-gray-200">${expensesHTML}</div>`;

            // NUEVO: Añadimos los listeners a los botones recién creados
            container.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', handleEditClick));
            container.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', handleDeleteClick));
        }
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

// main.js -> REEMPLAZA esta función por completo

async function renderInformesView() {
    // 1. Dibuja el esqueleto de la página
    renderViewShell('Informes', `
        <div class="bg-white p-4 rounded-lg shadow mb-6">
            <h2 class="text-lg font-semibold text-gray-500 mb-3">Evolución de Gastos</h2>
            <div id="informes-filters" class="flex flex-wrap gap-2 mb-4"></div>
            <div class="h-80 mt-4"><canvas id="history-chart"></canvas></div>
        </div>
        <div class="bg-white p-4 rounded-lg shadow">
            <h2 class="text-lg font-semibold text-gray-500 mb-3">Análisis Mensual Inteligente</h2>
            <div class="mb-4">
                <label for="month-selector" class="block text-sm font-medium text-gray-700">Seleccionar Mes:</label>
                <select id="month-selector" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm"></select>
            </div>
            <div id="monthly-analysis-content" class="mt-4">
                <p class="text-center text-gray-400 py-8">Selecciona un mes para ver el análisis.</p>
            </div>
        </div>
    `);

    // 2. Espera a tener los datos del historial
    try {
        if (!state.history || state.history.length === 0) {
            showLoader('Cargando historial...');
            const result = await apiService.call('getSheetData', { sheetName: 'HistorialGastos' });
            if (result.status === 'success') {
                state.history = result.data.processedData;
            }
        }
    } catch (error) {
        showToast('No se pudo cargar el historial.', 'error');
    } finally {
        hideLoader();
    }

    // 3. Ahora que estamos seguros de tener los datos, dibujamos los componentes
    populateInformesFilters();
    updateHistoryChart(['Total']);
    populateMonthSelector();

    // 4. Añadimos el listener para el selector de mes (el resto se gestionará en initRouter)
    const monthSelector = $('#month-selector');
    if (monthSelector) {
        monthSelector.addEventListener('change', handleMonthSelection);
    }
}

// main.js -> REEMPLAZA esta función por la versión mejorada

function populateMonthSelector() {
    const selector = $('#month-selector');
    if (!selector) return;

    // 1. Obtenemos los meses ya archivados desde el historial como siempre
    const uniqueMonths = {};
    (state.history || []).forEach(item => {
        const monthNumber = getMonthNumberFromName(item.mes);
        if (item.ano && monthNumber > -1) {
            const key = `${item.ano}-${String(monthNumber + 1).padStart(2, '0')}`;
            if (!uniqueMonths[key]) {
                uniqueMonths[key] = new Date(item.ano, monthNumber);
            }
        }
    });

    // ✅ AÑADIDO: Lógica para incluir el mes anterior si no está archivado
    const now = new Date();
    // Nos situamos en el mes anterior (ej. si hoy es Septiembre, nos da Agosto)
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthYear = prevMonthDate.getFullYear();
    const prevMonthNumber = prevMonthDate.getMonth(); // 0-11
    
    const prevMonthKey = `${prevMonthYear}-${String(prevMonthNumber + 1).padStart(2, '0')}`;

    // Si el mes anterior NO está en la lista de archivados, lo añadimos
    if (!uniqueMonths[prevMonthKey]) {
        uniqueMonths[prevMonthKey] = new Date(prevMonthYear, prevMonthNumber);
    }
    // --- Fin de la lógica añadida ---

    // 2. Ordenamos las claves para asegurar el orden cronológico descendente.
    const sortedKeys = Object.keys(uniqueMonths).sort().reverse();

    selector.innerHTML = '<option value="">Selecciona...</option>';
    sortedKeys.forEach(key => {
        const date = uniqueMonths[key];
        const optionText = date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        selector.innerHTML += `<option value="${key}">${optionText}</option>`;
    });
}

// main.js -> REEMPLAZA tu función handleMonthSelection
async function handleMonthSelection(e) {
    const value = e.target.value;
    const container = $('#monthly-analysis-content');

    if (!value) {
        container.innerHTML = '<p class="text-center text-gray-400 py-8">Selecciona un mes para ver el análisis.</p>';
        return;
    }

    const [year, month] = value.split('-');
    container.innerHTML = `<div class="h-48 flex justify-center items-center"><div class="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500"></div></div>`;

    try {
        const result = await apiService.call('getMonthlyAnalysis', { year, month });

        // ✅ ¡AQUÍ ESTÁ LA PISTA!
        // Esto imprimirá el objeto de depuración en tu consola.
        console.log('🕵️‍♂️ Pista de la API (getMonthlyAnalysis):', result);
        
        if (result.status === 'success') {
            renderMonthlyAnalysisReport(result.data, year, month);
        } else {
            container.innerHTML = `<p class="text-center text-red-500 py-8">${result.message || 'No se encontraron datos para este mes.'}</p>`;
        }
    } catch (error) {
        container.innerHTML = `<p class="text-center text-red-500 py-8">Error al cargar el análisis.</p>`;
        showToast('No se pudo cargar el análisis del mes.', 'error');
    }
}

// main.js -> REEMPLAZA esta función por completo

function renderMonthlyAnalysisReport(data, year, month) {
    const container = $('#monthly-analysis-content');
    if (!container) return;

    container.expenseDetails = data.expenseDetails || [];
    const formatCurrency = (amount) => (amount || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

    let actionButtonsHTML = '';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const reportDate = new Date(year, month - 1, 1);
    const isReviewPeriod = data.monthStatus === 'Abierto' && reportDate < today;

    if (isReviewPeriod) {
        actionButtonsHTML = `
            <div class="my-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center space-y-3">
                <p class="text-sm text-blue-700 font-semibold">Este mes está en período de revisión.</p>
                <div>
                    <button id="add-forgotten-expense-btn" data-year="${year}" data-month="${month}" class="bg-white border border-gray-300 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-100 transition">+ Añadir Gasto Olvidado</button>
                    <button id="archive-month-btn" data-year="${year}" data-month="${month}" class="ml-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition">✔ Cerrar y Archivar Mes</button>
                </div>
            </div>`;
    }

    const summary = data.summary;
    const netResultColor = summary.netResultStatus === 'ahorro' ? 'text-green-600' : 'text-red-600';
    const netResultText = summary.netResultStatus === 'ahorro' ? `Ahorraste ${formatCurrency(summary.netResult)}` : `Superaste tu presupuesto en ${formatCurrency(Math.abs(summary.netResult))}`;
    
    // ✅ CORRECCIÓN: Añadimos el cálculo y la variable para el porcentaje.
    const netResultPercent = summary.totalBudget > 0 ? `(${(summary.totalSpent / summary.totalBudget * 100).toFixed(1)}% de tu presupuesto)` : '';
    const summaryHTML = `<div class="bg-gray-50 rounded-lg p-4 mb-2 text-center"><p class="text-lg font-semibold ${netResultColor}">${netResultText}</p><p class="text-sm text-gray-600">Gastaste ${formatCurrency(summary.totalSpent)} de un presupuesto de ${formatCurrency(summary.totalBudget)} ${netResultPercent}.</p></div>`;

    let othersHTML = '';
    if (data.othersBreakdown && data.othersBreakdown.length > 0) {
        const othersTableRows = data.othersBreakdown.map(item => `
            <tr class="border-b border-gray-200 last:border-b-0">
                <td class="py-2 pr-2">${item.category}</td>
                <td class="py-2 pr-2 text-right font-medium">${formatCurrency(item.amount)}</td>
            </tr>`).join('');
        othersHTML = `<div class="bg-gray-100 p-3 rounded-lg mt-4"><h5 class="font-bold text-gray-600 text-sm mb-2">Desglose de "Otros"</h5><table class="w-full text-sm"><thead><tr class="text-left text-xs text-gray-500"><th class="font-normal">Categoría</th><th class="font-normal text-right">Monto</th></tr></thead><tbody>${othersTableRows}</tbody></table></div>`;
    }

    let funFactsHTML = '';
    if (data.funFacts && Object.keys(data.funFacts).length > 0) {
        const funFacts = data.funFacts;
        const supermarketFact = funFacts.supermarket ? `<li>Fuiste al súper <strong>${funFacts.supermarket.transactionCount} veces</strong>. Tu comercio más visitado fue <strong>${funFacts.supermarket.mostFrequentStore}</strong> y tu ticket promedio fue de ${formatCurrency(funFacts.supermarket.averageTicket)}.</li>` : '';
        const activityFacts = (funFacts.activityFrequency || []).map(act => `<li>Registraste <strong>${act.count}</strong> gastos en <strong>${act.category}</strong>.</li>`).join('');
        const mostActiveDayFact = funFacts.mostActiveDay?.date ? `<li>El día con más actividad fue el <strong>${new Date(funFacts.mostActiveDay.date).toLocaleDateString('es-ES')}</strong> (${funFacts.mostActiveDay.count} gastos).</li>` : '';
        const mostExpensiveDayFact = funFacts.mostExpensiveDay?.date ? `<li>Tu día de mayor gasto discrecional fue el <strong>${new Date(funFacts.mostExpensiveDay.date).toLocaleDateString('es-ES')}</strong> con un total de ${formatCurrency(funFacts.mostExpensiveDay.amount)}.</li>` : '';
        
        funFactsHTML = `<div class="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg mt-6"><h4 class="font-bold text-blue-800 mb-2">Sabías que...</h4><ul class="list-disc list-inside text-sm text-blue-700 space-y-2">${supermarketFact}${activityFacts}${mostActiveDayFact}${mostExpensiveDayFact}</ul></div>`;
    }

    const categoryAnalysisHTML = (data.categoryAnalysis || []).map((cat) => {
        let variationHTML = `<span class="text-sm font-medium text-gray-500">=</span>`;
        if (cat.variationStatus && cat.variationStatus !== 'estable') {
            if (cat.variationStatus === 'aumento') variationHTML = `<span class="text-sm font-semibold text-red-500">▲ ${cat.variationPercent.toFixed(1)}%</span>`;
            else if (cat.variationStatus === 'descenso') variationHTML = `<span class="text-sm font-semibold text-green-600">▼ ${cat.variationPercent.toFixed(1)}%</span>`;
        }
        return `<div class="report-category-item cursor-pointer hover:bg-gray-100 p-3 rounded-lg" data-category="${cat.category}"><div class="flex justify-between items-center"><div class="flex items-center"><span class="text-lg mr-3">${CATEGORY_EMOJIS[cat.category] || '📊'}</span><div><p class="font-bold text-gray-800">${cat.category}</p>${cat.transactionCount > 0 ? `<p class="text-xs text-gray-500">${cat.transactionCount} transacciones</p>` : ''}</div></div><div class="text-right"><p class="font-bold text-gray-900">${formatCurrency(cat.currentAmount)}</p>${variationHTML}</div></div><div class="category-expense-details mt-2 pl-8 border-l-2 border-gray-200" style="display: none;"></div></div>`;
    }).join('');

    container.innerHTML = `${summaryHTML}${actionButtonsHTML}<div class="h-64 mb-2"><canvas id="monthly-doughnut-chart"></canvas></div>${othersHTML}${funFactsHTML}<div class="mt-6"><h4 class="font-bold text-gray-700 mb-2">Desglose de Categorías</h4><div id="category-list-container" class="space-y-1">${categoryAnalysisHTML}</div></div>`;

    const chartData = data.chartData || [];
    if(chartData.length > 0) {
        new Chart($('#monthly-doughnut-chart').getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: chartData.map(c => c.category),
                datasets: [{ data: chartData.map(c => c.currentAmount), backgroundColor: ['#3b82f6', '#ef4444', '#22c55e', '#f97316', '#a855f7', '#6b7280'], borderColor: '#fff', borderWidth: 2 }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { display: false }, datalabels: { formatter: (value, ctx) => { const total = ctx.chart.getDatasetMeta(0).total; const percentage = (value / total * 100); return percentage > 5 ? percentage.toFixed(0) + '%' : ''; }, color: '#fff', font: { weight: 'bold', size: 14 } } } },
            plugins: [ChartDataLabels]
        });
    }
}


async function handleReportCategoryClick(categoryItem) {
    const detailsContainer = categoryItem.querySelector('.category-expense-details');
    const category = categoryItem.dataset.category;
    const isOpen = detailsContainer.style.display !== 'none';

    if (isOpen) {
        detailsContainer.style.display = 'none';
        detailsContainer.innerHTML = '';
    } else {
        detailsContainer.style.display = 'block';
        
        // [Punto 4] Obtenemos los gastos del contenedor padre, sin llamada a la API
        const allExpenses = document.getElementById('monthly-analysis-content').expenseDetails || [];
        const expenses = allExpenses.filter(g => g.categoria === category);
        
        const expensesHTML = expenses.map(g => `
            <div class="flex justify-between text-xs py-1 border-t border-gray-200 first:border-t-0">
                <span>${g.detalle} (${new Date(g.fecha).toLocaleDateString('es-ES')})</span>
                <span class="font-medium">${(g.monto || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
            </div>
        `).join('');
        
        detailsContainer.innerHTML = expensesHTML || '<p class="text-sm text-gray-400">No hay detalles de gastos.</p>';
    }
}


function populateInformesFilters() {
    const filtersContainer = $('#informes-filters');
    if (!filtersContainer) return;

    // [CORREGIDO] Lógica para evitar duplicados
    const uniqueCategories = [...new Set((state.history || []).map(item => item.categoria))].filter(Boolean);
    const allCategories = ['Total', ...uniqueCategories.filter(cat => cat.toLowerCase() !== 'total')];

    filtersContainer.innerHTML = allCategories.map(cat => `
        <button class="filter-chip px-3 py-1 border rounded-full text-sm transition" data-category="${cat}">
            ${cat}
        </button>
    `).join('');

    // Añadir listeners a los nuevos botones
    filtersContainer.addEventListener('click', e => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;

        // Permitir selección múltiple (o individual si lo prefieres)
        chip.classList.toggle('is-active');
        chip.classList.toggle('bg-blue-600', chip.classList.contains('is-active'));
        chip.classList.toggle('text-white', chip.classList.contains('is-active'));

        const selectedCategories = [...$$('.filter-chip.is-active')].map(c => c.dataset.category);

        // Si no hay ninguno seleccionado, mostramos el total por defecto
        if (selectedCategories.length === 0) {
            updateHistoryChart(['Total']);
            const totalChip = filtersContainer.querySelector('[data-category="Total"]');
            if(totalChip) totalChip.classList.add('is-active', 'bg-blue-600', 'text-white');
        } else {
            updateHistoryChart(selectedCategories);
        }
    });

    // Activar el chip de "Total" por defecto al cargar
    const totalChip = filtersContainer.querySelector('[data-category="Total"]');
    if(totalChip) totalChip.classList.add('is-active', 'bg-blue-600', 'text-white');
}


// main.js -> REEMPLAZA esta función

function updateHistoryChart(selectedCategories) {
    if (state.activeChart) {
        state.activeChart.destroy();
    }
    const chartCanvas = document.getElementById('history-chart');
    if (!chartCanvas) {
        console.error("Error Crítico: No se encontró el elemento canvas #history-chart en el DOM.");
        return;
    }

    // ✅ CORRECCIÓN: Usamos nuestra función `getMonthNumberFromName` para un ordenamiento robusto.
    const historyData = (state.history || [])
        .map(d => ({
            ...d,
            ano: parseInt(d.ano, 10),
            gasto: parseFloat(d.gasto),
            monthNumber: getMonthNumberFromName(d.mes) // Añadimos el número de mes
        }))
        .filter(d => d.mes && !isNaN(d.ano) && d.ano > 0 && !isNaN(d.gasto) && d.monthNumber > -1)
        .sort((a,b) => (a.ano * 100 + a.monthNumber) - (b.ano * 100 + b.monthNumber)); // Ordenamos numéricamente

    const labels = [...new Set(historyData.map(d => `${d.mes.substring(0,3)} ${d.ano}`))];

    const datasets = selectedCategories.map((cat, index) => {
        const data = labels.map(label => {
            const [mesAbbr, anoStr] = label.split(' ');
            const ano = parseInt(anoStr, 10);

            const monthEntry = historyData.find(d => {
                const monthMatch = d.mes.substring(0, 3).toLowerCase() === mesAbbr.toLowerCase();
                const yearMatch = d.ano === ano;
                const categoryMatch = normalizeString(d.categoria) === normalizeString(cat);
                return yearMatch && monthMatch && categoryMatch;
            });
            return monthEntry ? monthEntry.gasto : 0;
        });

        const colors = ['#0284C7', '#DC2626', '#16A34A', '#F97316', '#7C3AED'];
        return { label: cat, data, borderColor: colors[index % colors.length], fill: false, tension: 0.1 };
    });
    
    const ctx = chartCanvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

    state.activeChart = new Chart(ctx, { 
        type: 'line', 
        data: { labels, datasets }, 
        options: {
            responsive: true,
            maintainAspectRatio: false,
            elements: { line: { tension: 0.4, borderWidth: 2 }, point: { radius: 3, hitRadius: 10, hoverRadius: 5 } },
            plugins: { legend: { position: 'top' }, tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.7)', titleFont: { size: 14 }, bodyFont: { size: 12 }, padding: 10, cornerRadius: 4, } },
            scales: { y: { beginAtZero: true, grid: { color: '#e5e7eb' } }, x: { grid: { display: false } } }
        } 
    });

    if (state.activeChart.data.datasets.length > 0) {
        state.activeChart.data.datasets[0].fill = true;
        state.activeChart.data.datasets[0].backgroundColor = gradient;
        state.activeChart.update();
    }
}

// main.js -> REEMPLAZA esta función por la versión 100% completa

function openModal(category = null, defaultDate = null) {
    let form = $('#expense-form');
    // Esta es la parte que faltaba: crea el modal si no existe
    if (!form) {
        const modalContainer = $('#expense-modal');
        if (!modalContainer) {
             const modalHtml = `<div id="expense-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 hidden z-50"><div class="bg-white rounded-lg shadow-xl w-full max-w-md"><form id="expense-form" class="p-6"></form></div></div>`;
             document.body.insertAdjacentHTML('beforeend', modalHtml);
        }
        form = $('#expense-form'); // Reasignamos la variable form
    }

    // El resto de la función se mantiene igual
    form.innerHTML = `
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
    
    if (defaultDate) {
        form.dataset.defaultDate = defaultDate;
        $('#modal-title').textContent = 'Añadir Gasto Olvidado';
    }

    populateCategoryButtons();
    $('#expense-modal').classList.remove('hidden');
    form.addEventListener('submit', handleFormSubmit);
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

    const defaultDate = form.dataset.defaultDate;
    if (defaultDate) {
        data.fecha = defaultDate;
    }

    closeModal();
    showLoader('Procesando gasto...');

    try {
        // ✅ CAMBIO: Usamos una acción más específica 'addForgottenExpense'
        const action = defaultDate ? 'addForgottenExpense' : 'addExpense';
        const result = await apiService.call(action, data);

        if (action === 'addExpense' && result.data.receipt) {
            updateStateAfterAddExpense(result.data.receipt, result.data.budgetInfo, result.data.totalBudgetInfo);
            showConfirmationToast(result.data.receipt, result.data.budgetInfo);
        } else {
            // ✅ CORRECCIÓN: En lugar de recargar, redibujamos el informe con los nuevos datos.
            showToast("Gasto olvidado añadido.", 'success');
            const date = new Date(data.fecha);
            renderMonthlyAnalysisReport(result.data, date.getFullYear(), date.getMonth() + 1);
        }
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

// main.js -> Reemplaza el objeto apiService completo por este

const apiService = {
    getInitialData: () => fetch(`${API_URL}?action=getInitialData`).then(res => res.json()),
    
    getExpenses: (year, month) => fetch(`${API_URL}?action=getExpenses&year=${year}&month=${month}`).then(res => res.json()),
    
    call: (action, data) => {
        // [MEJORA] Comprobamos la conexión antes de realizar la llamada
        if (!navigator.onLine) {
            showToast('Estás sin conexión. Inténtalo más tarde.', 'error');
            // Devolvemos una promesa rechazada para que el .catch() que llama a la función se active
            return Promise.reject(new Error('Offline'));
        }

        return fetch(API_URL, {
            method: 'POST',
            // El 'Content-Type' correcto para Apps Script es text/plain
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action, data }),
        }).then(response => {
            if (!response.ok) {
                // Si la API devuelve un error (ej: 400, 500), lo capturamos aquí
                return response.json().then(errorBody => { 
                    throw new Error(errorBody.message || 'Error en la petición a la API'); 
                });
            }
            return response.json();
        });
    }
};

// main.js -> REEMPLAZA esta función por la versión con aparición instantánea y mayor duración
function showToast(message, type = 'success') {
    const container = $('#toast-container');
    if (!container) return;

    if (container.firstChild) {
        container.firstChild.remove();
    }

    const toast = document.createElement('div');

    let bgColor;
    switch (type) {
        case 'error':
            bgColor = 'bg-red-600';
            break;
        case 'info':
            bgColor = 'bg-blue-600';
            break;
        default:
            bgColor = 'bg-green-500';
            break;
    }

    toast.className = `flex items-center justify-between p-4 rounded-lg text-white shadow-lg mb-2 ${bgColor}`;
    toast.innerHTML = `
        <span class="flex-grow">${message}</span>
        <button class="ml-4 text-xl font-bold opacity-70 hover:opacity-100">&times;</button>
    `;
    
    container.appendChild(toast);

    // ✅ CAMBIO 1: Nueva animación para aparecer al instante y solo desvanecerse al final.
    const animation = toast.animate([
        { opacity: 1 }, // El mensaje es visible desde el principio.
        { opacity: 1, offset: 0.9 }, // Se mantiene visible el 90% del tiempo.
        { opacity: 0 }  // Se desvanece en el último 10% del tiempo.
    ], {
        duration: 15000, // ✅ CAMBIO 2: Duración aumentada a 15 segundos.
        easing: 'ease-in-out'
    });

    const closeButton = toast.querySelector('button');
    closeButton.addEventListener('click', () => {
        animation.cancel();
        toast.remove();
    });

    animation.onfinish = () => toast.remove();
}


// main.js -> AÑADE esta nueva función auxiliar

/**
 * Convierte un nombre de mes en español a su número de mes (0-11).
 * @param {string} monthName - El nombre del mes (ej. "Enero", "Febrero").
 * @returns {number} - El número del mes, o -1 si no se encuentra.
 */
function getMonthNumberFromName(monthName) {
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    return meses.indexOf(monthName.toLowerCase());
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

// main.js -> AÑADE estas dos nuevas funciones al final

/**
 * Llama a la API para obtener los datos del asistente y luego abre el modal.
 */
async function openInvestmentAssistant() {
    showLoader('Cargando datos del asistente...');
    try {
        const result = await apiService.call('getInvestmentAssistantData');
        if (result.status === 'success') {
            const data = result.data;
            // Usamos el modal de gastos existente, pero con contenido personalizado
            $('#expense-modal').classList.remove('hidden');
            renderInvestmentAssistant(data);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoader();
    }
}

/**
 * Dibuja la interfaz del asistente dentro del modal.
 */
function renderInvestmentAssistant(data) {
    const formatOptions = { style: 'currency', currency: 'EUR' };
    const { ahorroExtraMesActual, presupuestoTotalProximoMes, mesActual } = data;
    
    const form = $('#expense-form'); // Reutilizamos el formulario del modal
    form.dataset.presupuestoProximoMes = presupuestoTotalProximoMes;
    form.dataset.ahorroExtra = ahorroExtraMesActual;

    const colorAhorro = ahorroExtraMesActual >= 0 ? 'text-green-600' : 'text-red-600';
    const textoAhorro = ahorroExtraMesActual >= 0 ? 'Ahorro Extra' : 'Déficit';

    form.innerHTML = `
        <h3 class="text-xl font-semibold mb-4">🚀 Asistente de Inversión</h3>
        
        <div class="mb-4 p-3 bg-gray-100 rounded-lg">
            <p class="text-sm text-gray-600">Cierre del mes de ${mesActual}:</p>
            <p class="text-2xl font-bold ${colorAhorro}">
                ${(ahorroExtraMesActual).toLocaleString('es-ES', formatOptions)}
            </p>
            <p class="text-sm text-gray-600">(${textoAhorro} = Presupuesto - Gasto Real)</p>
        </div>

        <div class="mb-4">
            <label for="sueldo-input" class="block text-sm font-medium text-gray-700">Introduce tu Sueldo</label>
            <input type="text" inputmode="decimal" id="sueldo-input" class="mt-1 block w-full border rounded-md p-2" placeholder="Ej: 1915.50">
        </div>

        <button type="submit" id="modal-save-button" class="w-full bg-blue-600 text-white px-4 py-2 rounded-md">Calcular Plan</button>
        
        <div id="investment-plan-results" class="mt-4"></div>

        <div class="flex justify-end mt-6">
            <button type="button" id="modal-cancel-button" class="bg-gray-200 px-4 py-2 rounded-md">Cerrar</button>
        </div>
    `;

    // Re-asignamos los listeners del modal
    form.removeEventListener('submit', handleFormSubmit); // Quitamos el listener de 'Añadir Gasto'
    form.addEventListener('submit', handleInvestmentPlanSubmit); // Añadimos el nuevo listener
    
    $('#modal-cancel-button').addEventListener('click', () => {
        closeModal();
        form.removeEventListener('submit', handleInvestmentPlanSubmit); // Limpiamos
        form.addEventListener('submit', handleFormSubmit); // Re-asignamos el original
    });
}




// main.js -> AÑADE esta nueva función al final

/**
 * Se ejecuta al enviar el formulario del asistente.
 * Calcula y muestra el plan de inversión.
 */
function handleInvestmentPlanSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formatOptions = { style: 'currency', currency: 'EUR' };

    // Obtenemos los datos guardados
    const presupuestoProximoMes = parseFloat(form.dataset.presupuestoProximoMes);
    const ahorroExtra = parseFloat(form.dataset.ahorroExtra);
    
    // Obtenemos el sueldo del input
    const sueldoInput = $('#sueldo-input').value.replace(',', '.');
    const sueldo = parseFloat(sueldoInput);

    if (isNaN(sueldo) || sueldo <= 0) {
        showToast('Por favor, introduce un sueldo válido.', 'error');
        return;
    }

    // 1. Inversión Mediano Plazo (Plan)
    const inversionMedianoPlazo = sueldo - presupuestoProximoMes;
    
    // 2. Inversión Corto Plazo (Buffer)
    // Usamos el 'ahorroExtra' que ya calculamos
    const inversionCortoPlazo = ahorroExtra;

    // 3. Monto total a mover
    const totalAInvertir = inversionMedianoPlazo + inversionCortoPlazo;

    // Mostramos los resultados
    const resultsContainer = $('#investment-plan-results');
    resultsContainer.innerHTML = `
        <h4 class="text-lg font-semibold text-gray-800 border-b pb-2">Tu Plan de Inversión</h4>
        <div class="space-y-3 mt-3">
            <div class="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <div>
                    <p class="font-semibold text-blue-800">1. Inversión Mediana/Largo Plazo</p>
                    <p class="text-sm text-blue-600">(Sueldo - Presupuesto)</p>
                </div>
                <p class="text-xl font-bold text-blue-800">${inversionMedianoPlazo.toLocaleString('es-ES', formatOptions)}</p>
            </div>
            
            <div class="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <div>
                    <p class="font-semibold text-green-800">2. Inversión Corto Plazo (Buffer)</p>
                    <p class="text-sm text-green-600">(Tu Ahorro Extra del mes)</p>
                </div>
                <p class="text-xl font-bold text-green-800">${inversionCortoPlazo.toLocaleString('es-ES', formatOptions)}</p>
            </div>

            <div class="flex justify-between items-center p-4 bg-gray-800 text-white rounded-lg mt-2">
                <p class="text-lg font-bold">Total a Mover Hoy:</p>
                <p class="text-2xl font-bold">${totalAInvertir.toLocaleString('es-ES', formatOptions)}</p>
            </div>
        </div>
    `;
}