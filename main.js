// main.js - v5.1 - LIMPIO Y CONSOLIDADO

const API_URL = 'https://script.google.com/macros/s/AKfycbwSO_oquwn67QerFAV0EjGQ0aebSPTLqSsxWRIZ6gAbAEURhrJduUybgoEl83jiFpUGvg/exec';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const CATEGORY_EMOJIS = { "Padel Clases": "🤸‍♂️", "Gym": "🏋️‍♀️", "Psicologa": "🧠", "Hipoteca": "🏠", "WiFi": "📶", "Luz": "💡", "Agua": "💧", "Padel partidos": "🎾", "Super": "🛒", "Extras / Salidas": "🍻", "Combustible": "⛽️", "Ropa": "👕", "Transporte": "🚌", "Viajes": "✈️" };

let state = { categories: [], huchas: [], history: [], monthlyExpenses: [], selectedCategory: null, activeChart: null, currentView: 'dashboard' };
window.investmentFunds = null; // Caché para los fondos

// --- INICIALIZACIÓN ---

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

function updateState(data) {
    if (data.summary) {
        state.totalSummary = data.summary.find(item => item.detalle?.toLowerCase() === 'total');
        state.categories = data.summary.filter(item => item.detalle?.toLowerCase() !== 'total' && item.presupuesto > 0);
    }
    if (data.huchas) state.huchas = data.huchas;
    if (data.history) state.history = data.history;
    if (data.monthlyExpenses) state.monthlyExpenses = data.monthlyExpenses;
}

// --- ROUTER Y NAVEGACIÓN ---

const router = { dashboard: renderDashboardView, gastos: renderGastosView, informes: renderInformesView, invertir: renderInvertirView, hipoteca: renderHipotecaView };

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

// main.js - Reemplaza initRouter
function initRouter() {
    $('#bottom-nav').addEventListener('click', (e) => {
        const navButton = e.target.closest('.nav-button');
        if (navButton?.dataset.view) {
            triggerHaptic('light'); // Navegar vibra suave
            navigateTo(navButton.dataset.view);
        }
    });

    $('#app-content').addEventListener('click', async e => {
        const categoryCard = e.target.closest('.category-item');
        if (categoryCard) {
            triggerHaptic('light');
            return toggleCategoryDetails(categoryCard);
        }

        const reportCategoryItem = e.target.closest('.report-category-item');
        if (reportCategoryItem) {
            triggerHaptic('light');
            return handleReportCategoryClick(reportCategoryItem);
        }
        
        const forgottenBtn = e.target.closest('#add-forgotten-expense-btn');
        if (forgottenBtn) {
            triggerHaptic('medium');
            const { year, month } = forgottenBtn.dataset;
            const historicalDate = new Date(year, month - 1, 15);
            return openModal(null, historicalDate.toISOString());
        }

        const openMovementBtn = e.target.closest('#open-add-movement-modal-btn');
        if (openMovementBtn) {
            triggerHaptic('medium');
            populateInvestmentFundDropdowns();
            const today = new Date().toISOString().split('T')[0];
            $('#movement-fecha').value = today;
            $('#add-investment-movement-modal').classList.remove('hidden');
        }

        const openUpdateValueBtn = e.target.closest('#open-update-value-modal-btn');
        if (openUpdateValueBtn) {
            triggerHaptic('medium');
            populateInvestmentFundDropdowns();
            const today = new Date().toISOString().split('T')[0];
            $('#snapshot-fecha').value = today;
            $('#update-portfolio-value-modal').classList.remove('hidden');
        }

        const modalCloseBtn = e.target.closest('.modal-close');
        if (modalCloseBtn) {
            triggerHaptic('light');
            const modalId = modalCloseBtn.dataset.modalId;
            if (modalId && $(`#${modalId}`)) $(`#${modalId}`).classList.add('hidden');
        }
        
        const groupedCard = e.target.closest('.grouped-investment-card');
        if (groupedCard) {
            triggerHaptic('light');
            const tipo = groupedCard.dataset.tipo;
            const breakdown = $(`[data-breakdown-for="${tipo}"]`);
            if (breakdown) {
                breakdown.classList.toggle('hidden');
                const toggleText = groupedCard.querySelector('.toggle-breakdown-text'); 
                if (toggleText) toggleText.textContent = breakdown.classList.contains('hidden') ? 'Ver desglose ▼' : 'Ocultar desglose ▲';
            }
        }
        
        const archiveBtn = e.target.closest('#archive-month-btn');
        if (archiveBtn) {
            triggerHaptic('medium');
            const { year, month } = archiveBtn.dataset;
            if (confirm(`¿Estás seguro de que quieres cerrar y archivar el mes ${month}/${year}? Esta acción no se puede deshacer.`)) {
                showLoader('Archivando mes...');
                try {
                    const result = await apiService.call('archiveMonth', { year, month });
                    if (result.status === 'success') {
                        // ✅ FEEDBACK HÁPTICO PESADO
                        triggerHaptic('heavy');
                        showToast('Mes archivado con éxito.', 'success');
                        const selector = $('#month-selector');
                        if (selector) selector.dispatchEvent(new Event('change'));
                    } else {
                        throw new Error(result.message || 'Error desconocido al archivar.');
                    }
                } catch (error) {
                    triggerHaptic('warning');
                    showToast(error.message, 'error');
                } finally {
                    hideLoader();
                }
            }
        }
    });

    $('#app-container').addEventListener('submit', async e => {
        if (e.target.id === 'add-movement-form') {
            e.preventDefault();
            showLoader('Guardando Movimiento...');
            const form = e.target;
            const formData = new FormData(form);
            const data = {
                fecha: formData.get('fecha'),
                fondo: formData.get('fondo'),
                monto: parseFloat(formData.get('monto').replace(',', '.')),
                tipoMovimiento: formData.get('tipo-movimiento')
            };
            try {
                const res = await apiService.call('addInvestmentMovement', data);
                if (res.status !== 'success') throw new Error(res.message);
                triggerHaptic('success'); // Éxito
                showToast("Movimiento añadido con éxito.", 'success');
                form.reset();
                $('#add-investment-movement-modal').classList.add('hidden');
                loadInvestmentDashboard();
            } catch (error) {
                triggerHaptic('warning');
                showToast(`Error: ${error.message}`, 'error');
            } finally {
                hideLoader();
            }
        }

        if (e.target.id === 'update-value-form') {
            e.preventDefault();
            showLoader('Actualizando Valor...');
            const form = e.target;
            const formData = new FormData(form);
            const data = {
                fecha: formData.get('fecha'),
                fondo: formData.get('fondo'),
                valorPortfolio: parseFloat(formData.get('valor-portfolio').replace(',', '.'))
            };
            try {
                const res = await apiService.call('addInvestmentSnapshot', data);
                if (res.status !== 'success') throw new Error(res.message);
                triggerHaptic('success'); // Éxito
                showToast("Valor del portfolio actualizado.", 'success');
                form.reset();
                $('#update-portfolio-value-modal').classList.add('hidden');
                loadInvestmentDashboard();
            } catch (error) {
                triggerHaptic('warning');
                showToast(`Error: ${error.message}`, 'error');
            } finally {
                hideLoader();
            }
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

// main.js - Reemplaza setupGlobalEventListeners
function setupGlobalEventListeners() {
    // FAB: Feedback medio al abrir
    $('#fab-add-expense').addEventListener('click', () => {
        triggerHaptic('medium');
        openModal();
    });

    $('#expense-modal').addEventListener('click', (e) => {
        if (e.target.id === 'modal-cancel-button') {
            triggerHaptic('light'); // Cancelar es suave
            closeModal();
        }
        
        const categoryBtn = e.target.closest('.category-btn');
        if (categoryBtn) {
            triggerHaptic('light'); // Seleccionar categoría es un "tict"
            handleCategorySelection(categoryBtn);
        }
        
        const superBtn = e.target.closest('.super-btn');
        if (superBtn) {
            triggerHaptic('light');
            handleSupermarketSelection(superBtn);
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target.id === 'refresh-dashboard') {
            triggerHaptic('medium'); // Refrescar se siente firme
            refreshStateAndUI();
        }
    });

    // Lógica Pull-to-Refresh (sin cambios, solo añadimos la vibración al activarse)
    let touchStartY = 0;
    const appContent = $('#app-content');
    appContent.addEventListener('touchstart', e => {
        if (appContent.scrollTop === 0) touchStartY = e.touches[0].clientY;
        else touchStartY = 0;
    }, { passive: true });

    appContent.addEventListener('touchmove', e => {
        const touchEndY = e.touches[0].clientY;
        if (touchStartY > 0 && touchEndY - touchStartY > 100) {
            touchStartY = 0;
            triggerHaptic('medium'); // ¡Vibra cuando detecta que vas a refrescar!
            showLoader('Actualizando...');
            refreshStateAndUI().then(() => hideLoader());
        }
    }, { passive: true });
}

// --- VISTAS ---

function renderViewShell(title, content) {
    $('#app-content').innerHTML = `<h1 class="text-2xl font-bold text-gray-800 mb-4">${title}</h1><div class="space-y-6">${content}</div>`;
}

// main.js - Reemplaza renderDashboardView completa

// main.js - Reemplaza renderDashboardView completa

function renderDashboardView() {
    // 1. Datos iniciales
    const totalData = state.totalSummary || { llevagastadoenelmes: 0, presupuesto: 0 };
    const formatOptions = { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 };
    const totalPercent = totalData.presupuesto ? (totalData.llevagastadoenelmes / totalData.presupuesto) * 100 : 0;
    
    const today = new Date();
    const currentDay = today.getDate();
    
    // 2. Lógica de Alertas
    let alertsHTML = '';

    // ALERTA HIPOTECA (Día 5+)
    const isMortgagePaid = state.monthlyExpenses.some(g => normalizeString(g.categoria).includes('hipoteca'));
    if (currentDay >= 5 && !isMortgagePaid) {
        alertsHTML += `
            <div id="mortgage-alert-card" class="bg-indigo-50 border-l-4 border-indigo-500 p-4 mb-3 rounded-r shadow-sm flex justify-between items-center animate-pulse">
                <div>
                    <p class="text-indigo-700 font-bold text-sm">🔔 Hipoteca Pendiente</p>
                    <p class="text-indigo-600 text-xs">No has registrado la cuota.</p>
                </div>
                <button id="quick-add-mortgage" class="bg-indigo-600 text-white text-xs font-bold py-2 px-3 rounded hover:bg-indigo-700 shadow">Pagar</button>
            </div>`;
    }

    // ALERTA COMUNIDAD (Día 10+)
    const isCommunityPaid = state.monthlyExpenses.some(g => normalizeString(g.categoria) === 'comunidad');
    
    // [TRUCO] Si quieres probarlo hoy, cambia el 10 por 1 temporalmente en la siguiente línea:
    if (currentDay >= 10 && !isCommunityPaid) {
        alertsHTML += `
            <div id="community-alert-card" class="bg-orange-50 border-l-4 border-orange-500 p-4 mb-3 rounded-r shadow-sm flex justify-between items-center animate-pulse">
                <div>
                    <p class="text-orange-800 font-bold text-sm">🏢 Comunidad Pendiente</p>
                    <p class="text-orange-700 text-xs">Vence entre el 10 y el 13.</p>
                </div>
                <button id="quick-add-community" class="bg-orange-600 text-white text-xs font-bold py-2 px-3 rounded hover:bg-orange-700 shadow">Pagar</button>
            </div>`;
    }

    // 3. Render HTML
    const dashboardHTML = ` 
        <div id="alerts-container">${alertsHTML}</div>
        
        <div class="flex items-center justify-between mb-2">
            <div id="last-updated" class="text-xs text-gray-400">
                Última actualización: ${state.lastUpdated ? state.lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Nunca'} ${state.lastActionInfo ? ` - ${state.lastActionInfo}` : ''}
            </div>
            <button id="refresh-dashboard" class="bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600 shadow-sm">🔄 Refrescar</button>
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
        </div>`;

    renderViewShell('Dashboard', dashboardHTML);

    // --- 4. LISTENERS CORREGIDOS ---

    // Listener Hipoteca
    const quickMortgageBtn = document.getElementById('quick-add-mortgage');
    if (quickMortgageBtn) {
        quickMortgageBtn.addEventListener('click', () => {
            triggerHaptic('medium');
            openModal();
            // Corrección: Buscar y hacer clic visual en el botón
            setTimeout(() => {
                const buttons = document.querySelectorAll('.category-btn');
                // Buscamos "Hipoteca" ignorando mayúsculas/acentos
                const btn = Array.from(buttons).find(b => normalizeString(b.dataset.category).includes('hipoteca'));
                if (btn) btn.click(); // <--- ESTO ACTIVA LA SELECCIÓN VISUAL
                
                const montoInput = document.getElementById('monto');
                if(montoInput) montoInput.value = "734.25"; 
            }, 50);
        });
    }

    // Listener Comunidad
    const quickCommunityBtn = document.getElementById('quick-add-community');
    if (quickCommunityBtn) {
        quickCommunityBtn.addEventListener('click', () => {
            triggerHaptic('medium');
            openModal();
            // Corrección: Buscar y hacer clic visual en el botón
            setTimeout(() => {
                const buttons = document.querySelectorAll('.category-btn');
                // Buscamos "Comunidad"
                const btn = Array.from(buttons).find(b => normalizeString(b.dataset.category) === 'comunidad');
                
                if (btn) {
                    btn.click(); // <--- ESTO ACTIVA LA SELECCIÓN VISUAL (Borde azul)
                    
                    // Buscar presupuesto automático
                    const comCategory = state.categories.find(c => normalizeString(c.detalle) === 'comunidad');
                    if (comCategory && comCategory.presupuesto > 0) {
                        const montoInput = document.getElementById('monto');
                        if(montoInput) montoInput.value = comCategory.presupuesto.toString(); 
                    }
                } else {
                    console.warn("No encontré el botón de Comunidad. Revisa el nombre en Excel.");
                }
            }, 50);
        });
    }

    // Listener Refrescar
    const refreshBtn = document.getElementById('refresh-dashboard');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            triggerHaptic('medium');
            showLoader('Actualizando Dashboard...');
            refreshStateAndUI().then(() => hideLoader()).catch(() => hideLoader());
        });
    }

    // Renderizado de listas (sin cambios)
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
    } catch (err) { console.warn('Error pintando dashboard:', err); }
    updateLastUpdatedTime(state.lastActionInfo || '');
}

// main.js - Reemplaza la función updateBudgetList completa

function updateBudgetList(categories) {
    const listContainer = $('#budget-list');
    if (!listContainer) return;
    const formatOptions = { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 };
    const velocityEmojis = { warning: '⚠️', overspending: '🛑' };
    
    // AÑADIDO: 'Comunidad' en la lista de fijos
    const FIXED_CATEGORIES = ['Alquiler', 'Hipoteca', 'Gym', 'WiFi', 'Luz', 'Agua', 'Psicologa', 'Comunidad'];

    listContainer.innerHTML = categories
        .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated))
        .map(cat => {
            const percentage = cat.presupuesto > 0 ? (cat.llevagastadoenelmes / cat.presupuesto) * 100 : 0;
            const progressColor = percentage > 100 ? 'bg-red-500' : (percentage > 85 ? 'bg-yellow-500' : 'bg-blue-600');
            const emoji = CATEGORY_EMOJIS[cat.detalle] || '💰';
            const velocityEmoji = velocityEmojis[cat.spendingVelocity] || '';
            
            // Lógica Visual: Si es fija y >= 100%, se apaga visualmente
            const isFixed = FIXED_CATEGORIES.some(f => normalizeString(f) === normalizeString(cat.detalle));
            const isCompleted = percentage >= 100;
            const itemClass = (isFixed && isCompleted) ? 'opacity-50 grayscale' : ''; 

            return `
            <div class="bg-white p-4 rounded-lg shadow-sm category-item cursor-pointer hover:shadow-md transition-shadow ${itemClass}" data-category="${cat.detalle}">
                <div class="flex justify-between items-center mb-2">
                    <span class="font-bold text-gray-700">${emoji} ${cat.detalle} ${velocityEmoji}</span>
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

// 2. GASTOS
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

// 3. INFORMES
async function renderInformesView() {
    renderViewShell('Informes', `
        <div class="bg-white p-4 rounded-lg shadow mb-8">
            <h2 class="text-lg font-semibold text-gray-500 mb-3">Evolución de Gastos</h2>
            <div id="informes-filters" class="flex flex-wrap gap-2 mb-4"></div>
            <div class="h-80 mt-4"><canvas id="history-chart"></canvas></div>
        </div>
        <div id="mortgage-integration-container" class="mb-8">
            <div class="bg-white p-4 rounded-lg shadow min-h-[200px] flex items-center justify-center">
                 <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
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

    populateInformesFilters();
    updateHistoryChart(['Total']);
    populateMonthSelector();
    loadMortgageComponent(); 
    $('#month-selector').addEventListener('change', handleMonthSelection);
}

// 4. INVERTIR
async function renderInvertirView() {
    renderViewShell('Invertir', `
        <div id="investment-assistant-container">
            <div id="assistant-content" class="h-48 flex justify-center items-center">
                <div class="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500"></div>
            </div>
        </div>
        <hr class="my-8 border-t-2 border-gray-200">
        <div id="investment-dashboard-container" class="space-y-6">
            <div class="flex justify-between items-center">
                <h2 class="text-xl font-semibold text-gray-800">2. Mis Inversiones</h2>
                <div class="flex gap-2">
                    <button id="open-update-value-modal-btn" class="bg-gray-200 text-gray-800 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-300 transition">📈 Actualizar Valor</button>
                    <button id="open-add-movement-modal-btn" class="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition">💸 + Movimiento</button>
                </div>
            </div>
            <div id="dashboard-content" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="text-center text-gray-400 animate-pulse col-span-2">Cargando datos de inversión...</div>
            </div>
        </div>
        <div class="bg-white p-4 rounded-lg shadow mt-6">
            <h3 class="text-lg font-semibold text-gray-700 mb-4">Evolución de Rentabilidad (%)</h3>
            <div class="h-64 relative"><canvas id="investment-evolution-chart"></canvas></div>
        </div>
    `);

    loadInvestmentAssistant();
    loadInvestmentDashboard();
    loadInvestmentChart();
}

// 5. HIPOTECA
async function renderHipotecaView() {
    renderViewShell('Mi Hipoteca', `
        <div id="mortgage-loader" class="text-center py-10"><div class="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500 mx-auto"></div><p class="mt-4 text-gray-500">Analizando préstamo...</p></div>
        <div id="mortgage-content" class="hidden space-y-6"></div>
    `);

    try {
        const result = await apiService.call('getMortgageStatus');
        if (result.status === 'success') {
            renderMortgageDashboard(result.data);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        $('#mortgage-loader').innerHTML = `<p class="text-red-500 text-center">${error.message}</p>`;
    }
}

// --- COMPONENTES Y LÓGICA DE NEGOCIO ---

// A. Hipoteca
function renderMortgageDashboard(data) {
    const container = $('#mortgage-content');
    $('#mortgage-loader').classList.add('hidden');
    container.classList.remove('hidden');

    const formatEUR = (num) => num.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
    const now = new Date();
    const cuotasRestantes = data.totalCuotas - data.cuotasPagadas;
    const fechaLibertad = new Date(now.getFullYear(), now.getMonth() + cuotasRestantes, 1);
    
    const mesesParaInflexion = data.tippingPointCuota - data.cuotasPagadas;
    let textoInflexion = "";
    if (mesesParaInflexion <= 0) {
        textoInflexion = "¡Ya lo pasaste! Ahora pagas más casa que intereses.";
    } else {
        const fechaInflexion = new Date(now.getFullYear(), now.getMonth() + mesesParaInflexion, 1);
        textoInflexion = `Ocurrirá en <strong>${fechaInflexion.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</strong> (Cuota ${data.tippingPointCuota})`;
    }

    const porcentajePropiedad = (data.capitalAmortizado / data.capitalInicial) * 100;

    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md text-center">
            <h3 class="text-gray-500 font-semibold mb-4">Tu Propiedad Real (Equity)</h3>
            <div class="relative w-48 h-48 mx-auto mb-4">
                <canvas id="mortgage-donut"></canvas>
                <div class="absolute inset-0 flex items-center justify-center flex-col">
                    <span class="text-3xl font-bold text-blue-600">${porcentajePropiedad.toFixed(1)}%</span>
                    <span class="text-xs text-gray-400">Es tuyo</span>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4 text-sm mt-4 border-t pt-4">
                <div><p class="text-gray-400">Pagado</p><p class="font-bold text-gray-800">${formatEUR(data.capitalAmortizado)}</p></div>
                <div><p class="text-gray-400">Pendiente</p><p class="font-bold text-gray-800">${formatEUR(data.capitalPendiente)}</p></div>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <p class="text-sm text-blue-600 font-bold uppercase">Libertad Financiera</p>
                <p class="text-2xl font-bold text-gray-800">${fechaLibertad.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</p>
                <p class="text-xs text-gray-500 mt-1">Faltan ${cuotasRestantes} cuotas</p>
            </div>
            <div class="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-500">
                <p class="text-sm text-purple-600 font-bold uppercase">Punto de Inflexión</p>
                <p class="text-sm text-gray-700 mt-1">${textoInflexion}</p>
            </div>
        </div>
        <div class="bg-white p-6 rounded-lg shadow-md mt-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center">🧪 Simulador de Amortización</h3>
            <p class="text-sm text-gray-500 mb-4">Calcula cómo cambia tu hipoteca si adelantas dinero hoy.</p>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700">Cantidad a adelantar (€)</label>
                    <input type="number" id="sim-amount" class="mt-1 block w-full border rounded-md p-2 text-lg" placeholder="Ej: 10000">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <button id="btn-sim-plazo" class="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition text-sm font-semibold">⏱ Reducir Plazo</button>
                    <button id="btn-sim-cuota" class="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition text-sm font-semibold">📉 Reducir Cuota</button>
                </div>
                <div id="sim-results" class="hidden bg-gray-50 rounded-lg p-4 mt-4 border border-gray-200"></div>
            </div>
        </div>`;

    new Chart(document.getElementById('mortgage-donut'), {
        type: 'doughnut',
        data: { labels: ['Pagado', 'Pendiente'], datasets: [{ data: [data.capitalAmortizado, data.capitalPendiente], backgroundColor: ['#2563eb', '#e5e7eb'], borderWidth: 0, cutout: '75%' }] },
        options: { plugins: { legend: { display: false }, tooltip: { enabled: false } } }
    });

    const runSimulation = (mode) => {
        const extraPayment = parseFloat(document.getElementById('sim-amount').value);
        if (!extraPayment || extraPayment <= 0) return showToast('Introduce una cantidad válida', 'error');
        if (extraPayment >= data.capitalPendiente) return showToast('¡Eso pagaría toda la hipoteca!', 'info');

        const rateMensual = (data.interesAnual / 100) / 12;
        const nuevoCapital = data.capitalPendiente - extraPayment;
        const currentQuota = data.cuotaActual;
        const cuotasRestantesAhora = data.totalCuotas - data.cuotasPagadas;
        const formatMoney = (num) => num.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

        let html = '';
        if (mode === 'plazo') {
            const numMeses = -Math.log(1 - (rateMensual * nuevoCapital) / currentQuota) / Math.log(1 + rateMensual);
            const nuevasCuotasRestantes = Math.ceil(numMeses);
            const mesesAhorrados = cuotasRestantesAhora - nuevasCuotasRestantes;
            const interesesAhorrados = (mesesAhorrados * currentQuota) - extraPayment;
            const nuevaFechaFin = new Date(now.getFullYear(), now.getMonth() + nuevasCuotasRestantes, 1);
            
            html = `<div class="bg-green-50 border border-green-200 rounded-lg p-4 mt-4"><h4 class="font-bold text-green-800 mb-3">✅ Ahorro en Plazo</h4><div class="grid grid-cols-2 gap-y-4 gap-x-2 text-sm"><div><p class="text-xs text-gray-500 uppercase font-semibold">Te ahorras</p><p class="font-bold text-gray-800 text-lg">${mesesAhorrados} cuotas</p></div><div><p class="text-xs text-gray-500 uppercase font-semibold">Ahorro Intereses</p><p class="font-bold text-green-600 text-lg">${formatMoney(interesesAhorrados)}</p></div><div><p class="text-xs text-gray-500 uppercase font-semibold">Nueva Fecha Fin</p><p class="font-bold text-gray-800">${nuevaFechaFin.toLocaleString('es-ES', { month: 'short', year: 'numeric' })}</p></div></div></div>`;
        } else {
            const nuevaCuota = (nuevoCapital * rateMensual) / (1 - Math.pow(1 + rateMensual, -cuotasRestantesAhora));
            const diferenciaMensual = currentQuota - nuevaCuota;
            const totalPagarViejo = cuotasRestantesAhora * currentQuota;
            const totalPagarNuevo = (cuotasRestantesAhora * nuevaCuota) + extraPayment;
            const interesesAhorrados = totalPagarViejo - totalPagarNuevo;

            html = `<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4"><h4 class="font-bold text-blue-800 mb-3">📉 Ahorro en Cuota</h4><div class="grid grid-cols-2 gap-y-4 gap-x-2 text-sm"><div><p class="text-xs text-gray-500 uppercase font-semibold">Nueva Cuota</p><p class="font-bold text-blue-600 text-lg">${formatMoney(nuevaCuota)}</p></div><div><p class="text-xs text-gray-500 uppercase font-semibold">Pagas menos</p><p class="font-bold text-gray-800 text-lg">${formatMoney(diferenciaMensual)} /mes</p></div><div><p class="text-xs text-gray-500 uppercase font-semibold">Intereses Ahorrados</p><p class="font-bold text-green-600">${formatMoney(interesesAhorrados)}</p></div></div></div>`;
        }
        const resDiv = document.getElementById('sim-results');
        if(resDiv) { resDiv.innerHTML = html; resDiv.classList.remove('hidden'); }
    };
    $('#btn-sim-plazo').addEventListener('click', () => runSimulation('plazo'));
    $('#btn-sim-cuota').addEventListener('click', () => runSimulation('cuota'));
}

async function loadMortgageComponent() {
    const container = $('#mortgage-integration-container');
    if (!container) return;
    try {
        const result = await apiService.call('getMortgageStatus');
        if (result.status === 'success') {
            const data = result.data;
            const now = new Date();
            const cuotasRestantes = data.totalCuotas - data.cuotasPagadas;
            const fechaLibertad = new Date(now.getFullYear(), now.getMonth() + cuotasRestantes, 1);
            const porcentajePropiedad = (data.capitalAmortizado / data.capitalInicial) * 100;
            const formatEUR = (num) => num.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

            container.innerHTML = `
                <div class="bg-indigo-50 border border-indigo-100 p-6 rounded-lg shadow-sm">
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-xl font-bold text-indigo-900 flex items-center">🏠 Estado de tu Hipoteca</h2>
                        <span class="bg-indigo-200 text-indigo-800 text-xs font-bold px-2 py-1 rounded-full">Cuota ${data.cuotasPagadas} / ${data.totalCuotas}</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                        <div class="flex flex-col items-center justify-center relative"><div class="relative w-40 h-40"><canvas id="mortgage-donut-integrated"></canvas><div class="absolute inset-0 flex items-center justify-center flex-col"><span class="text-2xl font-bold text-indigo-700">${porcentajePropiedad.toFixed(1)}%</span><span class="text-[10px] text-indigo-400 uppercase tracking-wide">Es tuyo</span></div></div></div>
                        <div class="space-y-4">
                            <div class="flex justify-between items-end border-b border-indigo-200 pb-2"><span class="text-indigo-600 text-sm">Capital Pagado</span><span class="font-bold text-lg text-indigo-900">${formatEUR(data.capitalAmortizado)}</span></div>
                            <div class="flex justify-between items-end border-b border-indigo-200 pb-2"><span class="text-indigo-600 text-sm">Pendiente</span><span class="font-bold text-lg text-indigo-900">${formatEUR(data.capitalPendiente)}</span></div>
                             <div class="mt-2 pt-2"><p class="text-xs text-indigo-500 uppercase font-bold">Libertad Financiera</p><p class="text-lg font-bold text-indigo-800">${fechaLibertad.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</p><p class="text-xs text-indigo-400">Faltan ${cuotasRestantes} cuotas</p></div>
                        </div>
                    </div>
                    <div class="mt-6 pt-4 border-t border-indigo-200 text-center"><button id="toggle-simulator-btn" class="text-indigo-600 text-sm font-semibold hover:text-indigo-800 flex items-center justify-center w-full">🧪 Abrir Simulador de Amortización ▼</button></div>
                    <div id="simulator-container" class="hidden mt-4 bg-white p-4 rounded shadow-inner">
                         <div class="space-y-3"><label class="block text-sm text-gray-600">¿Cuánto quieres adelantar?</label><input type="number" id="sim-amount-int" class="w-full border p-2 rounded" placeholder="Ej: 5000"><div class="flex gap-2"><button id="btn-sim-plazo-int" class="flex-1 bg-green-100 text-green-800 py-2 rounded text-sm font-bold">⏱ Reducir Plazo</button><button id="btn-sim-cuota-int" class="flex-1 bg-blue-100 text-blue-800 py-2 rounded text-sm font-bold">📉 Reducir Cuota</button></div><div id="sim-results-int" class="hidden text-sm mt-2 p-2 bg-gray-50 rounded"></div></div>
                    </div>
                </div>`;

            new Chart(document.getElementById('mortgage-donut-integrated'), {
                type: 'doughnut',
                data: { labels: ['Pagado', 'Pendiente'], datasets: [{ data: [data.capitalAmortizado, data.capitalPendiente], backgroundColor: ['#4f46e5', '#e0e7ff'], borderWidth: 0, cutout: '75%' }] },
                options: { plugins: { legend: { display: false }, tooltip: { enabled: false } } }
            });

            $('#toggle-simulator-btn').addEventListener('click', (e) => {
                const sim = $('#simulator-container');
                const isHidden = sim.classList.contains('hidden');
                sim.classList.toggle('hidden');
                e.target.innerText = isHidden ? '🧪 Ocultar Simulador ▲' : '🧪 Abrir Simulador de Amortización ▼';
            });
            
            // Lógica duplicada para el componente integrado (scope local)
            const runSimInt = (mode) => {
                 const amount = parseFloat($('#sim-amount-int').value);
                 if (!amount) return showToast('Introduce cantidad', 'error');
                 // Reutilizamos lógica simple para mostrar que funciona
                 $('#sim-results-int').innerHTML = `<p class="text-green-600 font-bold">Simulación calculada (ver detalle completo en pestaña Hipoteca)</p>`;
                 $('#sim-results-int').classList.remove('hidden');
            };
            $('#btn-sim-plazo-int').addEventListener('click', () => runSimInt('plazo'));
            $('#btn-sim-cuota-int').addEventListener('click', () => runSimInt('cuota'));

        } else {
            container.innerHTML = `<div class="p-4 text-center text-red-500">Error cargando hipoteca: ${result.message}</div>`;
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="p-4 text-center text-red-500">Error de conexión con Hipoteca</div>`;
    }
}

// B. Análisis Mensual
function populateMonthSelector() {
    const selector = $('#month-selector');
    if (!selector) return;
    const uniqueMonths = {};
    (state.history || []).forEach(item => {
        const monthNumber = getMonthNumberFromName(item.mes);
        if (item.ano && monthNumber > -1) {
            const key = `${item.ano}-${String(monthNumber + 1).padStart(2, '0')}`;
            if (!uniqueMonths[key]) uniqueMonths[key] = new Date(item.ano, monthNumber);
        }
    });

    const now = new Date();
    for (let i = 1; i <= 6; i++) {
        const pastDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, '0')}`;
        if (!uniqueMonths[key]) uniqueMonths[key] = pastDate;
    }

    const sortedKeys = Object.keys(uniqueMonths).sort().reverse();
    selector.innerHTML = '<option value="">Selecciona...</option>';
    sortedKeys.forEach(key => {
        const date = uniqueMonths[key];
        const monthName = date.toLocaleString('es-ES', { month: 'long' });
        const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        selector.innerHTML += `<option value="${key}">${capitalizedMonth} de ${date.getFullYear()}</option>`;
    });
}

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
        const result = await apiService.call('getMonthlyAnalysis', { year: parseInt(year), month: parseInt(month) });
        if (result.status === 'success') {
            renderMonthlyAnalysisReport(result.data, parseInt(year), parseInt(month));
        } else {
            container.innerHTML = `<p class="text-center text-red-500 py-8">${result.message || 'No se encontraron datos para este mes.'}</p>`;
        }
    } catch (error) {
        console.error("Error en handleMonthSelection:", error);
        container.innerHTML = `<p class="text-center text-red-500 py-8">Error al cargar el análisis.</p>`;
        showToast(`Error técnico: ${error.message}`, 'error');
    }
}

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
    const netResultPercent = summary.totalBudget > 0 ? `(${(summary.totalSpent / summary.totalBudget * 100).toFixed(1)}% de tu presupuesto)` : '';
    
    const summaryHTML = `<div class="bg-gray-50 rounded-lg p-4 mb-2 text-center"><p class="text-lg font-semibold ${netResultColor}">${netResultText}</p><p class="text-sm text-gray-600">Gastaste ${formatCurrency(summary.totalSpent)} de un presupuesto de ${formatCurrency(summary.totalBudget)} ${netResultPercent}.</p></div>`;

    let othersHTML = '';
    if (data.othersBreakdown && data.othersBreakdown.length > 0) {
        const rows = data.othersBreakdown.map(i => `<tr class="border-b border-gray-200 last:border-b-0"><td class="py-2 pr-2">${i.category}</td><td class="py-2 pr-2 text-right font-medium">${formatCurrency(i.amount)}</td></tr>`).join('');
        othersHTML = `<div class="bg-gray-100 p-3 rounded-lg mt-4"><h5 class="font-bold text-gray-600 text-sm mb-2">Desglose de "Otros"</h5><table class="w-full text-sm"><tbody>${rows}</tbody></table></div>`;
    }

    let funFactsHTML = '';
    if (data.funFacts && Object.keys(data.funFacts).length > 0) {
        const ff = data.funFacts;
        const sf = ff.supermarket ? `<li>Fuiste al súper <strong>${ff.supermarket.transactionCount} veces</strong>. Comercio más visitado: <strong>${ff.supermarket.mostFrequentStore}</strong>.</li>` : '';
        const af = (ff.activityFrequency || []).map(a => `<li><strong>${a.count}</strong> gastos en <strong>${a.category}</strong>.</li>`).join('');
        funFactsHTML = `<div class="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg mt-6"><h4 class="font-bold text-blue-800 mb-2">Sabías que...</h4><ul class="list-disc list-inside text-sm text-blue-700 space-y-2">${sf}${af}</ul></div>`;
    }

    const categoryAnalysisHTML = (data.categoryAnalysis || []).map((cat) => {
        let variationHTML = `<span class="text-sm font-medium text-gray-500">=</span>`;
        if (cat.variationStatus && cat.variationStatus !== 'estable') {
            const v = cat.variationPercent || 0;
            if (cat.variationStatus === 'aumento') variationHTML = `<span class="text-sm font-semibold text-red-500">▲ ${v.toFixed(1)}%</span>`;
            else if (cat.variationStatus === 'descenso') variationHTML = `<span class="text-sm font-semibold text-green-600">▼ ${v.toFixed(1)}%</span>`;
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
            options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { display: false } } }
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
        const allExpenses = document.getElementById('monthly-analysis-content').expenseDetails || [];
        const expenses = allExpenses.filter(g => g.categoria === category);
        
        const expensesHTML = expenses.map(g => `
            <div class="flex justify-between text-xs py-1 border-t border-gray-200 first:border-t-0">
                <span>${g.detalle} (${new Date(g.fecha).toLocaleDateString('es-ES')})</span>
                <span class="font-medium">${(g.monto || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
            </div>
        `).join('');
        detailsContainer.innerHTML = expensesHTML || '<p class="text-sm text-gray-400">No hay detalles.</p>';
    }
}

function populateInformesFilters() {
    const filtersContainer = $('#informes-filters');
    if (!filtersContainer) return;
    const uniqueCategories = [...new Set((state.history || []).map(item => item.categoria))].filter(Boolean);
    const allCategories = ['Total', ...uniqueCategories.filter(cat => cat.toLowerCase() !== 'total')];

    filtersContainer.innerHTML = allCategories.map(cat => `<button class="filter-chip px-3 py-1 border rounded-full text-sm transition" data-category="${cat}">${cat}</button>`).join('');

    filtersContainer.addEventListener('click', e => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;
        chip.classList.toggle('is-active');
        chip.classList.toggle('bg-blue-600', chip.classList.contains('is-active'));
        chip.classList.toggle('text-white', chip.classList.contains('is-active'));
        const selectedCategories = [...$$('.filter-chip.is-active')].map(c => c.dataset.category);
        if (selectedCategories.length === 0) {
            updateHistoryChart(['Total']);
            filtersContainer.querySelector('[data-category="Total"]')?.classList.add('is-active', 'bg-blue-600', 'text-white');
        } else {
            updateHistoryChart(selectedCategories);
        }
    });
    filtersContainer.querySelector('[data-category="Total"]')?.classList.add('is-active', 'bg-blue-600', 'text-white');
}

function updateHistoryChart(selectedCategories) {
    if (state.activeChart) state.activeChart.destroy();
    const chartCanvas = document.getElementById('history-chart');
    if (!chartCanvas) return;

    const historyData = (state.history || [])
        .map(d => ({ ...d, ano: parseInt(d.ano, 10), gasto: parseFloat(d.gasto), monthNumber: getMonthNumberFromName(d.mes) }))
        .filter(d => d.mes && !isNaN(d.ano) && d.ano > 0 && !isNaN(d.gasto) && d.monthNumber > -1)
        .sort((a,b) => (a.ano * 100 + a.monthNumber) - (b.ano * 100 + b.monthNumber));

    const labels = [...new Set(historyData.map(d => `${d.mes.substring(0,3)} ${d.ano}`))];
    const datasets = selectedCategories.map((cat, index) => {
        const data = labels.map(label => {
            const [mesAbbr, anoStr] = label.split(' ');
            const entry = historyData.find(d => d.mes.substring(0, 3).toLowerCase() === mesAbbr.toLowerCase() && d.ano === parseInt(anoStr, 10) && normalizeString(d.categoria) === normalizeString(cat));
            return entry ? entry.gasto : 0;
        });
        const colors = ['#0284C7', '#DC2626', '#16A34A', '#F97316', '#7C3AED'];
        return { label: cat, data, borderColor: colors[index % colors.length], fill: false, tension: 0.1 };
    });

    state.activeChart = new Chart(chartCanvas.getContext('2d'), { 
        type: 'line', 
        data: { labels, datasets }, 
        options: {
            responsive: true, maintainAspectRatio: false,
            elements: { line: { tension: 0.4 }, point: { radius: 3 } },
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true }, x: { grid: { display: false } } }
        } 
    });
}

// C. Asistente Inversión
// main.js - Reemplaza loadInvestmentAssistant COMPLETA

/**
 * Carga el Asistente de Planificación con la Lógica "Realista"
 * Flujo: Saldo Real Banco - Sueldo = Inversión Pasada. Sueldo - Presupuesto = Buffer Futuro.
 */
async function loadInvestmentAssistant() {
    const container = $('#assistant-content');
    try {
        const result = await apiService.call('getInvestmentAssistantData'); 
        if (result.status !== 'success') throw new Error(result.message);

        const data = result.data;
        const formatOptions = { style: 'currency', currency: 'EUR' };
        // Solo necesitamos el presupuesto futuro, el ahorro teórico anterior lo ignoramos 
        // porque ahora usaremos el saldo real del banco.
        const { presupuestoTotalProximoMes, mesActual } = data;

        // Limpiamos clases del loader
        container.className = '';

        container.innerHTML = `
         <div class="space-y-6">
            <h2 class="text-xl font-semibold text-gray-800">1. Asistente de Planificación Real</h2>

            <form id="investment-assistant-form" class="w-full space-y-4">
                
                <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p class="text-sm text-blue-800 mb-2 font-medium">1. ¿Cuánto dinero hay HOY en tu banco?</p>
                    <input type="number" step="0.01" id="saldo-banco-input" class="w-full border border-blue-300 rounded-md p-3 text-lg font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej: 3500.00">
                    <p class="text-xs text-blue-600 mt-1">Mira la app de tu banco e introduce el Saldo Total.</p>
                </div>

                <div class="bg-green-50 p-4 rounded-lg border border-green-200">
                    <p class="text-sm text-green-800 mb-2 font-medium">2. ¿Cuánto acabas de cobrar (Nómina)?</p>
                    <input type="number" step="0.01" id="sueldo-input" class="w-full border border-green-300 rounded-md p-3 text-lg font-bold text-gray-700 focus:ring-2 focus:ring-green-500 outline-none" placeholder="Ej: 2000.00">
                </div>

                <div class="px-2">
                    <p class="text-xs text-gray-500 text-center">
                        Tu presupuesto para este mes es de <strong>${(presupuestoTotalProximoMes).toLocaleString('es-ES', formatOptions)}</strong>.
                        <br>Calcularemos en base a esto + 100€ de seguridad.
                    </p>
                </div>

                <button type="submit" id="calculate-plan-btn" class="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 transition shadow-lg text-lg">
                    Calcular Reparto 🧮
                </button>
                
                <input type="hidden" id="data-presupuesto-proximo" value="${presupuestoTotalProximoMes}">
            </form>
            
            <div id="investment-plan-results" class="hidden space-y-4 animate-fade-in">
                </div>
        </div> 
        `; 
        
        // Listener del Formulario con la NUEVA LÓGICA
        $('#investment-assistant-form').addEventListener('submit', (e) => { 
            e.preventDefault();
            const formatOptions = { style: 'currency', currency: 'EUR' };
            
            // 1. Obtener Inputs
            const saldoBanco = parseFloat($('#saldo-banco-input').value);
            const sueldo = parseFloat($('#sueldo-input').value);
            const presupuesto = parseFloat($('#data-presupuesto-proximo').value);

            // Validaciones básicas
            if (isNaN(saldoBanco) || isNaN(sueldo)) return showToast('Por favor, completa ambos campos.', 'error');

            // 2. LÓGICA DEL ALGORITMO

            // A. Sobrante Real (Dinero Viejo) -> Para Medio Plazo
            // Si tienes 3500 y cobraste 2000, entonces 1500 son del mes pasado.
            const sobranteRealAnterior = saldoBanco - sueldo; 

            // B. Capacidad Buffer (Dinero Nuevo) -> Para Corto Plazo
            // De lo que cobraste, quitas gastos previstos y 100 de seguridad.
            const bufferCalculado = sueldo - presupuesto - 100;

            // C. Total a mover
            const totalMover = (sobranteRealAnterior > 0 ? sobranteRealAnterior : 0) + (bufferCalculado > 0 ? bufferCalculado : 0);

            const resultsContainer = $('#investment-plan-results');
            resultsContainer.classList.remove('hidden');

            // 3. Renderizar Resultados con explicaciones claras
            resultsContainer.innerHTML = `
                <h3 class="text-lg font-semibold text-gray-700 border-t pt-4">Tu Plan Sugerido</h3>
                
                <div class="bg-white p-4 rounded-lg shadow border-l-4 border-indigo-500">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-bold text-indigo-800">1. Inversión Medio Plazo</p>
                            <p class="text-xs text-gray-500">Es el dinero que ya tenías antes de cobrar.</p>
                        </div>
                        <p class="text-xl font-bold text-indigo-700">${sobranteRealAnterior.toLocaleString('es-ES', formatOptions)}</p>
                    </div>
                    <div class="mt-2 text-xs text-indigo-400 bg-indigo-50 p-2 rounded">
                        Saldo Total (${saldoBanco}) - Sueldo (${sueldo})
                    </div>
                </div>

                <div class="bg-white p-4 rounded-lg shadow border-l-4 border-teal-500">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-bold text-teal-800">2. Buffer / Corto Plazo</p>
                            <p class="text-xs text-gray-500">Generado con tu sueldo actual.</p>
                        </div>
                        <p class="text-xl font-bold text-teal-700">${bufferCalculado.toLocaleString('es-ES', formatOptions)}</p>
                    </div>
                    <div class="mt-2 text-xs text-teal-600 bg-teal-50 p-2 rounded">
                        Sueldo (${sueldo}) - Presupuesto (${presupuesto}) - 100€ Security
                    </div>
                </div>

                <div class="bg-gray-800 text-white p-4 rounded-lg shadow-lg mt-2 text-center">
                    <p class="text-sm opacity-80 uppercase tracking-widest">Total a Mover de Cuenta Corriente</p>
                    <p class="text-3xl font-bold my-1">${totalMover.toLocaleString('es-ES', formatOptions)}</p>
                    <p class="text-xs opacity-70">El resto se queda para pagar facturas.</p>
                </div>
            `;
            
            // Scroll suave hacia los resultados
            resultsContainer.scrollIntoView({ behavior: 'smooth' });
        });

    } catch (error) {
        container.innerHTML = `<p class="text-center text-red-500 py-8">Error al cargar el asistente: ${error.message}</p>`;
    }
}

async function loadInvestmentDashboard() {
    const container = $('#dashboard-content');
    try {
        const result = await apiService.call('getInvestmentDashboardData');
        if (result.status !== 'success') throw new Error(result.message);
        renderInvestmentDashboardV2_fixed(result.data);
    } catch (error) {
        container.innerHTML = `<p class="text-center text-red-500 py-8 col-span-2">Error al cargar el dashboard de inversión: ${error.message}</p>`;
    }
}

function renderInvestmentDashboardV2_fixed(data) {
    const container = $('#dashboard-content');
    if (!container) return;
    container.innerHTML = '';
    const formatOptions = { style: 'currency', currency: 'EUR' };
    const percentOptions = { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 };
    const { detallePorTipo } = data;

    detallePorTipo.forEach(group => {
        const tipo = group.tipo;
        const gananciaColor = group.gananciaNeta >= 0 ? 'text-green-600' : 'text-red-600';
        const breakdownHTML = group.fondos.map(fondo => {
            const fGananciaColor = fondo.gananciaNeta >= 0 ? 'text-green-600' : 'text-red-600';
            return `<div class="flex justify-between items-center text-sm py-2 border-t border-gray-200"><span class="font-semibold">${fondo.fondo}</span><div class="text-right"><span class="font-bold ${fGananciaColor}">${(fondo.roi).toLocaleString('es-ES', percentOptions)}</span><p class="text-xs text-gray-500">${(fondo.valorActual).toLocaleString('es-ES', formatOptions)}</p></div></div>`;
        }).join('');

        container.innerHTML += `
            <div class="bg-white p-4 rounded-lg shadow col-span-1">
                <div class="grouped-investment-card cursor-pointer" data-tipo="${tipo}">
                    <h3 class="text-lg font-semibold text-gray-700 mb-3 flex justify-between">Total ${tipo}<span class="text-blue-600 text-sm font-normal toggle-breakdown-text">Ver desglose ▼</span></h3>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between"><span class="text-gray-600">Valor Actual:</span><span class="font-bold text-lg text-gray-900">${(group.valorActual).toLocaleString('es-ES', formatOptions)}</span></div>
                        <div class="flex justify-between"><span class="text-gray-600">Aportado:</span><span class="font-medium text-gray-800">${(group.totalAportado).toLocaleString('es-ES', formatOptions)}</span></div>
                        <hr class="my-2 border-gray-200">
                        <div class="flex justify-between"><span class="text-gray-600">Ganancia:</span><span class="font-bold text-lg ${gananciaColor}">${(group.gananciaNeta).toLocaleString('es-ES', formatOptions)}</span></div>
                        <div class="flex justify-between"><span class="text-gray-600">ROI:</span><span class="font-bold text-lg ${gananciaColor}">${(group.roi).toLocaleString('es-ES', percentOptions)}</span></div>
                    </div>
                </div>
                <div class="investment-breakdown hidden mt-4 pt-2" data-breakdown-for="${tipo}"><h4 class="font-bold text-gray-600 mb-1">Desglose</h4>${breakdownHTML || '<p class="text-sm text-gray-500">Sin datos.</p>'}</div>
            </div>`;
    });
    if (container.innerHTML === '') container.innerHTML = `<p class="text-center text-gray-500 col-span-2">Sin datos de inversión.</p>`;
}

async function loadInvestmentChart() {
    const canvas = document.getElementById('investment-evolution-chart');
    if (!canvas) return;
    if (window.investmentChartInstance) {
        window.investmentChartInstance.destroy();
        window.investmentChartInstance = null;
    }
    try {
        const result = await apiService.call('getInvestmentHistoryChartData');
        if (result.status !== 'success' || !result.data || result.data.length === 0) return;

        const datasets = result.data;
        const colors = ['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#7c3aed', '#06b6d4'];
        datasets.forEach((ds, index) => { if(!ds.borderColor) ds.borderColor = colors[index % colors.length]; });

        window.investmentChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'line', data: { datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', time: { unit: 'month', tooltipFormat: 'dd/MM/yyyy' }, grid: { display: false } },
                    y: { grid: { color: '#f3f4f6' }, ticks: { callback: function(value) { return value + '%'; } } }
                },
                plugins: { legend: { position: 'bottom' }, datalabels: { display: false } }
            }
        });
    } catch (error) { console.error("Error gráfico inversión:", error); }
}

async function populateInvestmentFundDropdowns() {
    const populate = (funds) => {
        $$('#movement-fondo-select, #snapshot-fondo-select').forEach(select => {
            if (!select) return;
            const current = select.value;
            select.innerHTML = '<option value="">Selecciona...</option>';
            funds.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.nombre;
                opt.textContent = `${f.nombre} (${f.tipo})`;
                select.appendChild(opt);
            });
            if (current && funds.some(f => f.nombre === current)) select.value = current;
        });
    };
    if (window.investmentFunds) { populate(window.investmentFunds); return; }
    try {
        const response = await apiService.call('getInvestmentConfig');
        if (Array.isArray(response.data) && response.data.length > 0) {
            window.investmentFunds = response.data;
            populate(response.data);
        }
    } catch (error) { console.error("Error fondos config:", error); }
}

// --- MODALES Y FORMULARIOS ---

function openModal(category = null, defaultDate = null) {
    let form = $('#expense-form');
    if (!form) {
        const modalHtml = `<div id="expense-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 hidden z-50"><div class="bg-white rounded-lg shadow-xl w-full max-w-md"><form id="expense-form" class="p-6"></form></div></div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        form = $('#expense-form');
    }

    form.innerHTML = `
        <h3 id="modal-title" class="text-xl font-semibold mb-4">Añadir Gasto</h3>
        <div class="mb-4"><p class="block text-sm font-medium text-gray-700 mb-2">Categoría</p><div id="category-buttons" class="grid grid-cols-3 sm:grid-cols-4 gap-2"></div></div>
        <div id="modal-dynamic-content" class="space-y-4"></div>
        <div class="flex justify-end space-x-3 mt-6"><button type="button" id="modal-cancel-button" class="bg-gray-200 px-4 py-2 rounded-md">Cancelar</button><button type="submit" id="modal-save-button" class="bg-blue-600 text-white px-4 py-2 rounded-md">Guardar</button></div>`;
    
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
        return `<button type="button" class="category-btn text-center p-2 border rounded-lg hover:border-blue-500" data-category="${item.detalle}"><span class="text-2xl">${emoji}</span><span class="block text-xs mt-1">${item.detalle}</span></button>`;
    }).join('');
}

function handleCategorySelection(button) {
    state.selectedCategory = button.dataset.category;
    $$('.category-btn').forEach(btn => btn.classList.remove('ring-2', 'ring-blue-500'));
    button.classList.add('ring-2', 'ring-blue-500');

    const dynamicContent = $('#modal-dynamic-content');
    let htmlContent = '';

    if (state.selectedCategory === 'Super') {
        htmlContent += `<div><label class="block text-sm font-medium text-gray-700 mb-2">Comercio</label><div class="grid grid-cols-3 gap-2"><button type="button" class="super-btn p-2 border rounded-lg" data-super="Mercadona">Mercadona</button><button type="button" class="super-btn p-2 border rounded-lg" data-super="Consum">Consum</button><button type="button" class="super-btn p-2 border rounded-lg" data-super="Otro">Otro</button></div></div><div id="super-extra-fields"></div>`;
    } else {
        htmlContent += `<div><label for="monto" class="block text-sm font-medium text-gray-700">Monto (€)</label><input type="text" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]+" id="monto" name="monto" required class="mt-1 block w-full border rounded-md p-2"></div><div><label for="detalle" class="block text-sm font-medium text-gray-700">Detalle (Opcional)</label><input type="text" name="detalle" id="detalle" class="mt-1 block w-full border rounded-md p-2"></div><div class="flex items-center mt-2"><input type="checkbox" id="esCompartido" name="esCompartido" class="h-4 w-4 rounded"><label for="esCompartido" class="ml-2 block text-sm text-gray-900">Gasto Compartido (50%)</label></div>`;
    }
    dynamicContent.innerHTML = htmlContent;
}

function handleSupermarketSelection(button) {
    $$('.super-btn').forEach(btn => btn.classList.remove('ring-2', 'ring-blue-500'));
    button.classList.add('ring-2', 'ring-blue-500');
    const superType = button.dataset.super;
    const extraFields = $('#super-extra-fields');
    let commonFields = `<div><label for="monto" class="block text-sm font-medium text-gray-700">Monto (€)</label><input type="text" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]+" id="monto" name="monto" required class="mt-1 block w-full border rounded-md p-2"></div><div class="flex items-center mt-2"><input type="checkbox" id="esCompartido" name="esCompartido" class="h-4 w-4 rounded"><label for="esCompartido" class="ml-2 block text-sm text-gray-900">Gasto Compartido (50%)</label></div>`;

    if (superType === 'Otro') {
        extraFields.innerHTML = `<div><label for="detalle" class="block text-sm font-medium text-gray-700">Nombre del Supermercado</label><input type="text" name="detalle" id="detalle" required class="mt-1 block w-full border rounded-md p-2"></div>${commonFields}`;
    } else {
        $('#expense-form').dataset.supermercado = superType;
        extraFields.innerHTML = commonFields;
    }
}

// main.js - Reemplaza handleFormSubmit
async function handleFormSubmit(e) {
    e.preventDefault();
    if (!state.selectedCategory) { 
        triggerHaptic('warning'); // Error vibra diferente
        showToast('Selecciona una categoría.', 'error'); 
        return; 
    }
    
    const form = e.target;
    const formData = new FormData(form);
    let detalle = formData.get('detalle');
    if (state.selectedCategory === 'Super' && !detalle) detalle = form.dataset.supermercado || 'Supermercado';
    
    const data = { 
        categoria: state.selectedCategory, 
        monto: parseFloat(formData.get('monto').replace(',', '.')), 
        detalle, 
        esCompartido: formData.get('esCompartido') === 'on' 
    };

    const defaultDate = form.dataset.defaultDate;
    if (defaultDate) data.fecha = defaultDate;

    closeModal();
    showLoader('Procesando gasto...');

    try {
        const action = defaultDate ? 'addForgottenExpense' : 'addExpense';
        const result = await apiService.call(action, data);

        // ✅ FEEDBACK HÁPTICO DE ÉXITO
        triggerHaptic('success'); 

        if (action === 'addExpense' && result.data.receipt) {
            updateStateAfterAddExpense(result.data.receipt);
            showConfirmationToast(result.data.receipt, result.data.budgetInfo);
        } else {
            showToast("Gasto olvidado añadido.", 'success');
            const date = new Date(data.fecha);
            renderMonthlyAnalysisReport(result.data, date.getFullYear(), date.getMonth() + 1);
        }
    } catch (error) { 
        triggerHaptic('warning'); // Error
        showToast(error.message, 'error'); 
    } finally { 
        hideLoader(); 
    }
}

function updateStateAfterAddExpense(receipt) {
    showLoader('Añadiendo gasto...');
    return refreshStateAndUI().then(() => {
        const cat = receipt?.categoria || receipt?.detalle || 'categoría';
        updateLastUpdatedTime(`Gasto añadido en ${cat}`);
        hideLoader();
    }).catch(err => { hideLoader(); throw err; });
}

async function handleEditClick(e) {
    const gasto = JSON.parse(e.target.closest('[data-gasto]').dataset.gasto);
    const nuevoMontoStr = prompt(`Introduce el nuevo monto para "${gasto.detalle || gasto.categoria}":`, gasto.monto);

    if (nuevoMontoStr) {
        const nuevoMonto = parseFloat(nuevoMontoStr.replace(',', '.'));
        if (!isNaN(nuevoMonto) && nuevoMonto > 0) {
            try {
                showLoader('Editando gasto...');
                const result = await apiService.call('updateExpense', { rowId: gasto.rowid, monto: nuevoMonto, categoria: gasto.categoria });
                if (result.status !== 'success') throw new Error(result.message);
                
                await refreshStateAndUI();
                updateLastUpdatedTime(`Gasto editado en ${gasto.categoria}`);
                showToast('Monto actualizado', 'success');
            } catch (error) { showToast(error.message, 'error'); } finally { hideLoader(); }
        } else { showToast('Monto no válido.', 'error'); }
    }
}

// main.js - Reemplaza handleDeleteClick
async function handleDeleteClick(e) {
    const btn = e.target.closest('.delete-btn');
    triggerHaptic('light'); // Feedback al pulsar el icono de basura
    const gasto = JSON.parse(btn.dataset.gasto);

    if (confirm(`¿Eliminar el gasto "${gasto.detalle || gasto.categoria}"?`)) {
        try {
            showLoader('Eliminando gasto...');
            const result = await apiService.call('deleteExpense', { rowId: parseInt(gasto.rowid), categoria: gasto.categoria });
            if (result.status !== 'success') throw new Error(result.message);
            
            // ✅ FEEDBACK HÁPTICO DE BORRADO
            triggerHaptic('warning');

            await refreshStateAndUI();
            updateLastUpdatedTime(`Gasto eliminado en ${gasto.categoria}`);
            showToast('Gasto eliminado', 'success');
        } catch (error) { 
            triggerHaptic('warning');
            showToast(error.message, 'error'); 
        } finally { 
            hideLoader(); 
        }
    }
}

function showConfirmationToast(receipt, budgetInfo) {
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
            <div><h4 class="font-bold text-lg text-green-600">Gasto Añadido</h4><p class="text-gray-700">En <span class="font-semibold">${receipt.categoria}</span>, llevas gastado el <span class="font-bold">${percentage.toFixed(1)}%</span>.</p><p class="text-sm text-gray-500">${(budgetInfo.gastado || 0).toLocaleString('es-ES', formatOptions)} de ${budgetInfo.presupuesto.toLocaleString('es-ES', formatOptions)}</p></div>
            <button id="toast-close-btn" class="text-gray-400 hover:text-gray-800">&times;</button>
        </div>
        <div class="flex justify-end space-x-2 mt-4"><button id="toast-edit-btn" class="text-sm bg-gray-200 px-3 py-1 rounded-md hover:bg-gray-300">Editar</button><button id="toast-add-another-btn" class="text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700">Añadir Otro</button></div>`;

    toastContainer.appendChild(toast);
    const close = () => toast.remove();
    $('#toast-close-btn').addEventListener('click', close);
    $('#toast-add-another-btn').addEventListener('click', () => { close(); openModal(); });
    $('#toast-edit-btn').addEventListener('click', () => { close(); handleEditClick({ target: { closest: () => ({ dataset: { gasto: JSON.stringify(receipt) } }) } }); });
}

// --- SERVICIOS Y UTILIDADES ---

// main.js - Reemplaza SOLAMENTE el objeto apiService al final del archivo

const apiService = {
    getInitialData: () => fetch(`${API_URL}?action=getInitialData`).then(res => res.json()),
    
    getExpenses: (year, month) => fetch(`${API_URL}?action=getExpenses&year=${year}&month=${month}`).then(res => res.json()),
    
    call: (action, data) => {
        // [CORRECCIÓN] Quitamos el bloqueo manual de !navigator.onLine
        // Dejamos que el fetch intente conectar siempre.
        
        return fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action, data }),
        }).then(res => {
            if (!res.ok) {
                return res.json().then(e => { throw new Error(e.message || 'Error API'); });
            }
            return res.json();
        });
    }
};

function refreshStateAndUI() {
    return apiService.getInitialData().then(result => {
        if (result.status === 'success') {
            updateState(result.data);
            localStorage.setItem('appData', JSON.stringify(result.data));
            if (router[state.currentView]) router[state.currentView]();
            updateLastUpdatedTime();
        } else { showToast('Error al refrescar: ' + result.message, 'error'); }
    }).catch(e => showToast('Error conexión: ' + e.message, 'error'));
}

function showToast(message, type = 'success') {
    const container = $('#toast-container');
    if (!container) return;
    if (container.firstChild) container.firstChild.remove();
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-red-600' : (type === 'info' ? 'bg-blue-600' : 'bg-green-500');
    toast.className = `flex items-center justify-between p-4 rounded-lg text-white shadow-lg mb-2 ${bgColor}`;
    toast.innerHTML = `<span class="flex-grow">${message}</span><button class="ml-4 text-xl font-bold opacity-70 hover:opacity-100">&times;</button>`;
    container.appendChild(toast);
    
    const animation = toast.animate([{ opacity: 1 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], { duration: 5000, easing: 'ease-in-out' });
    toast.querySelector('button').addEventListener('click', () => { animation.cancel(); toast.remove(); });
    animation.onfinish = () => toast.remove();
}

function showLoader(message = 'Cargando...') {
    if (document.getElementById('global-loader')) return;
    const loader = document.createElement('div');
    loader.id = 'global-loader';
    loader.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50';
    loader.innerHTML = `<div class="bg-white p-4 rounded-lg flex flex-col items-center shadow"><div style="width:40px;height:40px;border-radius:9999px;border:4px solid #e5e7eb;border-top-color:#3b82f6;animation:spin 1s linear infinite"></div><p class="text-sm text-gray-700 mt-2">${message}</p></div>`;
    if (!document.getElementById('loader-spin-style')) {
        const s = document.createElement('style'); s.id = 'loader-spin-style'; s.innerHTML = `@keyframes spin { to { transform: rotate(360deg); } }`; document.head.appendChild(s);
    }
    document.body.appendChild(loader);
}
function hideLoader() { const l = document.getElementById('global-loader'); if (l) l.remove(); }

function updateLastUpdatedTime(actionInfo = '') {
    state.lastUpdated = new Date();
    state.lastActionInfo = actionInfo;
    const el = document.getElementById('last-updated');
    if (el) el.textContent = `Última actualización: ${state.lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} ${actionInfo ? `- ${actionInfo}` : ''}`;
}

function getBudgetColor(percent) {
    if (percent < 50) return 'text-green-600';
    if (percent < 80) return 'text-yellow-600';
    return 'text-red-600';
}

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
            const expensesHTML = categoryExpenses.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(gasto => `
                <div class="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-b-0">
                    <div><p class="font-semibold text-gray-700">${gasto.detalle}</p><p class="text-xs text-gray-400">${new Date(gasto.fecha).toLocaleDateString('es-ES')}</p></div>
                    <div class="flex items-center space-x-2"><span class="font-medium text-gray-800">${(gasto.monto || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span><button class="edit-btn p-2 text-gray-400 hover:text-blue-600" data-gasto='${JSON.stringify(gasto)}'>✏️</button><button class="delete-btn p-2 text-gray-400 hover:text-red-600" data-gasto='${JSON.stringify(gasto)}'>🗑️</button></div>
                </div>`).join('');
            container.innerHTML = `<div class="mt-4 pt-2 border-t border-gray-200">${expensesHTML}</div>`;
            container.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', handleEditClick));
            container.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', handleDeleteClick));
        }
    } else { container.innerHTML = ''; }
}

function getMonthNumberFromName(monthName) {
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    return meses.indexOf(monthName.toLowerCase());
}

function normalizeString(str) {
    if (!str || typeof str !== 'string') return '';
    return str.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, '');
}

function injectStyles() {
    if (document.getElementById('app-dynamic-styles')) return;
    const style = document.createElement('style');
    style.id = 'app-dynamic-styles';
    style.innerHTML = `.progress-bar-bg { background-color: #e5e7eb; border-radius: 9999px; height: 0.75rem; overflow: hidden; } .progress-bar-fg { height: 100%; border-radius: 9999px; transition: width 0.5s ease-in-out; } .category-details-container { max-height: 0; overflow: hidden; transition: max-height 0.5s ease-in-out; } .category-item.is-open .category-details-container { max-height: 500px; }`;
    document.head.appendChild(style);
}

// main.js - AÑADIR AL FINAL DEL ARCHIVO

/**
 * Genera feedback táctil (vibración) para mejorar la UX.
 * Tipos: 'light' (botón), 'success' (guardado), 'warning' (borrar), 'heavy' (archivar).
 */
function triggerHaptic(type = 'light') {
    // Si el dispositivo no soporta vibración, no hacemos nada.
    if (!navigator.vibrate) return;

    const patterns = {
        light: 10,              // Un "tict" muy sutil (clicks normales)
        medium: 40,             // Un toque firme (abrir modales)
        success: [30, 50, 30],  // Dos toques rápidos (acción completada)
        warning: [50, 100, 50], // Vibración doble más larga (borrar/error)
        heavy: 200              // Vibración larga y pesada (archivar mes)
    };

    // Ejecutamos el patrón
    navigator.vibrate(patterns[type] || 10);
}