// ═══════════════════════════════════════════════════════════════════════════
//  ⏰ VENCIMIENTOS — agregar a tu Apps Script de Google Sheets
//
//  1. En tu planilla: Extensiones → Apps Script.
//  2. Pegá TODO este archivo al final del código que ya tenés (no borres nada).
//  3. Dentro de tu función doGet(e), justo después de la línea
//        const accion = e.parameter.accion || '';
//     agregá esta línea:
//        if (accion === 'vencimiento') return registrarVencimiento(e.parameter);
//  4. Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar.
//     (La URL no cambia, la app sigue usando la misma.)
//
//  La hoja VENCIMIENTOS se crea sola la primera vez. Cada lote es una fila
//  (columna ID) y se actualiza cuando se suma cantidad o se marca una acción.
// ═══════════════════════════════════════════════════════════════════════════

const HOJA_VENC = 'VENCIMIENTOS';
const CABECERA_VENC = ['ID', 'Código', 'Producto', 'Rubro', 'Fecha venc.', 'Días al registrar',
  'Cantidad', 'Sector', 'Registró', 'Fecha registro', 'Estado', 'Acción por', 'Fecha acción', 'Nota'];

function registrarVencimiento(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let hoja = ss.getSheetByName(HOJA_VENC);
    if (!hoja) {
      hoja = ss.insertSheet(HOJA_VENC);
      hoja.getRange(1, 1, 1, CABECERA_VENC.length).setValues([CABECERA_VENC])
        .setFontWeight('bold').setBackground('#0F172A').setFontColor('#FFFFFF');
      hoja.setFrozenRows(1);
    }

    const fila = [
      p.id || '', p.barcode || '', p.name || '', p.cat || '', p.fecha || '', Number(p.dias),
      Number(p.qty) || 0, p.sector || '', p.operator || '', p.registrado || '',
      p.estado || 'Pendiente', p.accionPor || '', p.accionFecha || '', p.nota || ''
    ];

    // Buscar el lote por ID para actualizarlo; si no existe, agregarlo
    let nro = 0;
    const ultima = hoja.getLastRow();
    if (ultima > 1 && p.id) {
      const ids = hoja.getRange(2, 1, ultima - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(p.id)) { nro = i + 2; break; }
      }
    }
    if (!nro) nro = ultima + 1;
    hoja.getRange(nro, 1, 1, fila.length).setValues([fila]);

    // Color: resuelto verde · vencido rojo · 0 a 3 días naranja · resto amarillo
    const dias = Number(p.dias);
    let color = '#FFF8E1';
    if ((p.estado || 'Pendiente') !== 'Pendiente') color = '#E8F5E9';
    else if (dias < 0) color = '#FFCDD2';
    else if (dias <= 3) color = '#FFE0B2';
    hoja.getRange(nro, 1, 1, fila.length).setBackground(color);

    return ContentService.createTextOutput(JSON.stringify({ ok: true, fila: nro }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
