// api.gs - v5.0 - FINAL CON MEJORAS DE UX

const GASTOS_SHEET_NAME = "Gastos";
const PRESUPUESTOS_SHEET_NAME = "Presupuestos";
const HUCHAS_SHEET_NAME = "Huchas";
const HISTORIAL_SHEET_NAME = "HistorialGastos";
const METADATA_SHEET_NAME = "CategoryMetadata"; // Nueva hoja para ordenar

function parseCurrency(value) {
  if (value === null || value === undefined || value === '') return 0;
  let num;
  if (typeof value === 'number') {
    num = value;
  } else {
    let s = String(value).trim().replace(/€/g, '').trim();
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
    num = parseFloat(s);
  }
  if (isNaN(num)) return 0;
  return Number(num.toFixed(2));
}

function doGet(e) {
  try {
    const action = e.parameter.action || 'getInitialData';
    let data;
    switch (action) {
      case 'debugSummary': data = debugSummaryData(); break;
      case 'getInitialData': data = getInitialData(); break;
      case 'getExpenses': data = getExpenses(e.parameter.year, e.parameter.month); break;
      default: throw new Error(`Acción GET no reconocida: ${action}`);
    }
    return createJsonResponse({ status: 'success', data: data });
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.message, stack: error.stack });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (!body.action) throw new Error("La acción es requerida.");
    let response;
    switch (body.action) {
      case 'addExpense': response = addExpense(body.data); break;
      case 'updateExpense': response = updateExpense(body.data); break;
      case 'deleteExpense': response = deleteExpense(body.data); break;
      case 'getSheetData': response = getSheetDataAsJSON(body.data.sheetName); break;
      default: throw new Error(`Acción POST no reconocida: ${body.action}`);
    }
    return createJsonResponse({ status: 'success', data: response });
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.message, stack: error.stack });
  }
}

// api.gs -> Reemplaza la función
function getInitialData() {
    // Ahora solo pide el resumen y los gastos del mes, que son necesarios para el dashboard.
    // Huchas e Historial se pedirán por separado.
    const now = new Date();
    return { 
        summary: getSummaryData(), 
        monthlyExpenses: getExpenses(now.getFullYear(), now.getMonth() + 1).data
    };
}

function getSummaryData() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('summary_data');
  if (cached) return JSON.parse(cached);
  const data = getSheetDataAsJSON(PRESUPUESTOS_SHEET_NAME).processedData;
  cache.put('summary_data', JSON.stringify(data), 3600);
  return data;
}

function debugSummaryData() {
    CacheService.getScriptCache().remove('summary_data');
    return getSheetDataAsJSON(PRESUPUESTOS_SHEET_NAME);
}

// [MODIFICADO] Ahora une los datos de presupuesto con los metadatos de "última actualización".
function getSheetDataAsJSON(sheetName) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return { rawValues: [], processedData: [] };
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return { rawValues: values, processedData: [] };
    const rawValues = JSON.parse(JSON.stringify(values)); 
    const headers = values.shift().map(h => normalizeString(h));
    
    let processedData = values.map(row => {
        let obj = {};
        headers.forEach((header, index) => {
            const cellValue = row[index];
            if (index < row.length && cellValue !== null && cellValue !== undefined && cellValue !== '') {
                if (cellValue instanceof Date) { obj[header] = cellValue.toISOString(); } 
                else {
                      const isCurrencyColumn = /presupuesto|monto|resta|total|gasto/.test(header) || header.includes('llevagastadoenelmes');

                    if (isCurrencyColumn) { obj[header] = parseCurrency(cellValue); } 
                    else { obj[header] = String(cellValue); }
                }
            } else { obj[header] = ''; }
        });
        return obj;
    });

    if (sheetName === PRESUPUESTOS_SHEET_NAME) {
        const metadata = getCategoryMetadata();
        processedData.forEach(cat => {
            const meta = metadata[cat.detalle];
            cat.lastUpdated = meta ? meta.lastUpdated : new Date(0).toISOString();
        });
    }
    
    return { rawValues: rawValues, processedData: processedData };
}

// [NUEVO] Lee los metadatos de la nueva hoja para saber cuándo se actualizó cada categoría.
function getCategoryMetadata() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(METADATA_SHEET_NAME);
    if (!sheet) return {};
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return {};
    values.shift(); // remove headers
    const metadata = {};
    values.forEach(row => {
        metadata[row[0]] = { lastUpdated: row[1] };
    });
    return metadata;
}

// [NUEVO] Actualiza la fecha de "última actualización" para una categoría.
function updateCategoryMetadata(categoryName) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(METADATA_SHEET_NAME);
    if (!sheet) return;
    const values = sheet.getDataRange().getValues();
    let found = false;
    for (let i = 1; i < values.length; i++) {
        if (values[i][0] === categoryName) {
            sheet.getRange(i + 1, 2).setValue(new Date());
            found = true;
            break;
        }
    }
    if (!found) {
        sheet.appendRow([categoryName, new Date()]);
    }
}

function getExpenses(year, month) {
    if (!year || !month) throw new Error("Año y mes requeridos.");
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GASTOS_SHEET_NAME);
    if (!sheet) return { data: [] };
    const allData = sheet.getDataRange().getValues();
    const headers = allData.shift().map(h => normalizeString(h));
    const filteredData = allData.filter(row => {
        if (!row[0] || !(row[0] instanceof Date)) return false;
        const date = new Date(row[0]);
        return date.getFullYear() == year && (date.getMonth() + 1) == month;
    }).map((row) => {
        let obj = {};
        headers.forEach((header, index) => {
            const cellValue = row[index];
            if (header === 'monto') { obj[header] = parseCurrency(cellValue); } 
            else { obj[header] = cellValue; }
        });
        obj.rowid = allData.indexOf(row) + 2;
        return obj;
    });
    return { data: filteredData };
}

// api.gs -> Reemplaza la función completa
function addExpense(data) {
  const { categoria, monto, detalle, esCompartido } = data;
  if (!categoria || !monto) throw new Error("Categoría y monto son obligatorios.");
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GASTOS_SHEET_NAME);
  if (!sheet) throw new Error(`Hoja "${GASTOS_SHEET_NAME}" no encontrada.`);

  const montoFinal = esCompartido ? monto / 2 : monto;
  sheet.appendRow([new Date(), detalle || categoria, categoria, montoFinal]);
  const newRowId = sheet.getLastRow(); // Obtenemos el ID de la fila recién añadida

  updateCategoryMetadata(categoria); 
  CacheService.getScriptCache().remove('summary_data');
  Utilities.sleep(1200); // Damos tiempo a las fórmulas a recalcular

  const budgetInfo = getBudgetInfoForCategory(categoria);

  // Devolvemos un recibo más completo y la información del presupuesto actualizada
  return { 
      message: "Gasto añadido.", 
      receipt: { 
          rowid: newRowId,
          categoria, 
          monto: montoFinal, 
          detalle: detalle || categoria 
      }, 
      budgetInfo: budgetInfo 
  };
}

// api.gs -> Reemplaza la función completa
function updateExpense(data) {
  const { rowId, monto, categoria } = data;
  if (!rowId || !monto) throw new Error("ID de fila y monto son obligatorios para actualizar.");
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GASTOS_SHEET_NAME);
  sheet.getRange(rowId, 4).setValue(monto);
  if (categoria) updateCategoryMetadata(categoria);

  CacheService.getScriptCache().remove('summary_data');
  Utilities.sleep(500); // Pequeña pausa para que las fórmulas recalculen

  const { categoryBudget, totalBudget } = getBudgetInfoForCategory(categoria);

  return { 
      message: "Monto actualizado.",
      budgetInfo: categoryBudget,
      totalBudgetInfo: totalBudget 
  };
}

// api.gs -> Reemplaza la función completa
function deleteExpense(data) {
  const { rowId, categoria } = data;
  if (!rowId) throw new Error("El ID de la fila es obligatorio.");
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GASTOS_SHEET_NAME);
  sheet.deleteRow(parseInt(rowId));

  if (categoria) updateCategoryMetadata(categoria);

  CacheService.getScriptCache().remove('summary_data');
  Utilities.sleep(500);

  const { categoryBudget, totalBudget } = getBudgetInfoForCategory(categoria);

  return { 
      message: "Gasto eliminado.",
      budgetInfo: categoryBudget,
      totalBudgetInfo: totalBudget
  };
}

// api.gs -> Reemplaza la función completa
function getBudgetInfoForCategory(categoryName) {
    const summaryData = getSheetDataAsJSON(PRESUPUESTOS_SHEET_NAME).processedData;
    const normalizedCategoryName = normalizeString(categoryName);

    // Busca el presupuesto de la categoría específica
    const categoryBudget = summaryData.find(b => normalizeString(b.detalle) === normalizedCategoryName);
    // Busca la fila de totales
    const totalBudget = summaryData.find(b => normalizeString(b.detalle) === 'total');

    // Prepara los objetos a devolver
    const categoryResult = categoryBudget ? {
        gastado: categoryBudget.llevagastadoenelmes || 0,
        presupuesto: categoryBudget.presupuesto || 0,
        porcentaje: (categoryBudget.llevagastado || 0) * 100,
    } : null;

    const totalResult = totalBudget ? {
        gastado: totalBudget.llevagastadoenelmes || 0,
        presupuesto: totalBudget.presupuesto || 0
    } : null;

    return { categoryBudget: categoryResult, totalBudget: totalResult };
}

function normalizeString(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, '');
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
