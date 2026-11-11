// ═══════════════════════════════════════════════════════════════════════════
//  INVENTARIO CLAROPE — Sincronización entre celulares (Google Apps Script)
//
//  Cómo instalarlo (una sola vez, desde la computadora):
//   1. sheets.google.com → Hoja de cálculo en blanco → ponele de nombre "Inventario CLAROPE".
//   2. Menú Extensiones → Apps Script. Borrá lo que haya y pegá TODO este archivo. Guardá (💾).
//   3. Implementar → Nueva implementación → ⚙️ Tipo: Aplicación web.
//        Ejecutar como: Yo   ·   Quién tiene acceso: Cualquier usuario
//      Implementar → Autorizar acceso (elegí tu cuenta → Avanzado → Ir a … → Permitir).
//   4. Copiá la URL de la aplicación web (termina en /exec).
//   5. En la app: 💾 Exportar → 📡 Google Sheets → pegá la URL → Guardar URL. En cada celular.
//
//  Las hojas se crean solas: MAESTRO, CONTEO, TERMINADAS, VENCIMIENTOS y CONFIG.
//  No edites a mano las columnas Actualizado, Borrado ni _datos: son las que usa la app.
// ═══════════════════════════════════════════════════════════════════════════

const TIPOS = {
  inv: {
    hoja: 'CONTEO',
    cab: ['ID', 'Código', 'Producto', 'Cantidad', 'Precio', 'Rubro', 'Zona', 'Góndola', 'Nivel', 'Operador', 'Fecha/Hora'],
    fila: d => [String(d.id), d.barcode || '', d.name || '', Number(d.qty) || 0, Number(d.price) || 0, d.cat || '',
                d.zona || '', d.gondola || '', d.nivel || '', d.lastOperator || d.operator || '', d.lastUpdate || d.datetime || '']
  },
  term: {
    hoja: 'TERMINADAS',
    cab: ['Clave', 'Zona', 'Góndola', 'Terminó', 'Fecha', 'Productos', 'Unidades'],
    fila: d => [d.key || '', d.zona || '', d.gondola || '', d.por || '', d.fecha || '', Number(d.productos) || 0, Number(d.unidades) || 0]
  },
  venc: {
    hoja: 'VENCIMIENTOS',
    cab: ['ID', 'Código', 'Producto', 'Rubro', 'Vence', 'Cantidad', 'Vendidas', 'Sector', 'Registró', 'Estado', 'Acción por', 'Fecha acción', 'Nota'],
    fila: d => [String(d.id || ''), d.barcode || '', d.name || '', d.cat || '', d.fecha || '', Number(d.qty) || 0, Number(d.vendidas) || 0,
                [d.zona, d.gondola].filter(String).join(' › '), d.ultimoOperador || d.operator || '', d.estado || 'Pendiente',
                d.accionPor || '', d.accionFecha || '', d.nota || '']
  }
};
const EXTRA = ['Actualizado', 'Borrado', '_datos'];
// El ID de cada fila se toma de _datos (texto exacto): Sheets redondea números de más de 15 cifras
function idDeFila(r, ncol) {
  try { const d = JSON.parse(r[ncol - 1] || 'null'); if (d) return String(d.key != null ? d.key : d.id); } catch (err) {}
  return String(r[0]);
}
const MAESTRO_CAB = ['Código', 'Código 2', 'Nombre', 'Rubro', 'Stock', 'Precio', 'Costo'];

// ── Entradas web ──
function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.accion === 'sync')    return json(sync(Number(p.desde) || 0));
    if (p.accion === 'maestro') return json(leerMaestro());
    return json({ ok: true, msg: 'Conectado a Inventario CLAROPE', ahora: Date.now(), maestroVer: Number(getConfig('maestroVer')) || 0 });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return json({ ok: false, error: 'JSON inválido' }); }
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    if (body.accion === 'push')    return json(push(body));
    if (body.accion === 'maestro') return json(guardarMaestro(body.items || []));
    return json({ ok: false, error: 'Acción desconocida' });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function redondear(n) { return Math.round((Number(n) || 0) * 1000) / 1000; }

// ── Hojas ──
function hojaDe(nombre, cab) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#0F172A').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  }
  return sh;
}
function leerFilas(sh, ncol) {
  const ult = sh.getLastRow();
  if (ult < 2) return [];
  return sh.getRange(2, 1, ult - 1, ncol).getValues();
}
function getConfig(clave) {
  const sh = hojaDe('CONFIG', ['Clave', 'Valor', 'Actualizado']);
  const filas = leerFilas(sh, 3);
  const f = filas.find(r => r[0] === clave);
  return f ? f[1] : '';
}
function getConfigFila(clave) {
  const sh = hojaDe('CONFIG', ['Clave', 'Valor', 'Actualizado']);
  return leerFilas(sh, 3).find(r => r[0] === clave) || null;
}
function setConfig(clave, valor, ahora) {
  const sh = hojaDe('CONFIG', ['Clave', 'Valor', 'Actualizado']);
  const filas = leerFilas(sh, 3);
  const i = filas.findIndex(r => r[0] === clave);
  const fila = [clave, valor, ahora || Date.now()];
  if (i >= 0) sh.getRange(i + 2, 1, 1, 3).setValues([fila]);
  else sh.getRange(filas.length + 2, 1, 1, 3).setValues([fila]);
}

// ── Recibir cambios de un celular ──
// op: { t: 'inv'|'term'|'venc', id, op: 'upsert'|'delete', data, dq (suma de cantidad), dv (suma de vendidas), abs }
// Las cantidades se SUMAN (dq) sobre lo que ya hay: si dos celulares cuentan a la vez, no se pisan.
function push(body) {
  const ahora = Date.now();
  const ops = body.ops || [];
  Object.keys(TIPOS).forEach(t => {
    const mias = ops.filter(o => o.t === t);
    if (mias.length) aplicar(t, mias, ahora);
  });
  if (body.reglas) setConfig('reglas', JSON.stringify(body.reglas), ahora);
  return { ok: true, ahora: ahora, recibidos: ops.length };
}

function aplicar(t, ops, ahora) {
  const def = TIPOS[t];
  const cab = def.cab.concat(EXTRA);
  const ncol = cab.length;
  const sh = hojaDe(def.hoja, cab);
  const filas = leerFilas(sh, ncol);
  const idx = {};
  filas.forEach((r, i) => { idx[idDeFila(r, ncol)] = i; });
  ops.forEach(o => {
    const id = String(o.id);
    const i = idx[id];
    const previa = i === undefined ? null : filas[i];
    const borrada = previa ? previa[ncol - 2] === 1 || previa[ncol - 2] === '1' : true;
    if (o.op === 'delete') {
      if (previa) { previa[ncol - 3] = ahora; previa[ncol - 2] = 1; }
      return;
    }
    const d = Object.assign({}, o.data || {});
    if (previa && !borrada && !o.abs) {
      let actual = {};
      try { actual = JSON.parse(previa[ncol - 1] || '{}'); } catch (err) {}
      if (o.dq !== undefined) d.qty = redondear((Number(actual.qty) || 0) + (Number(o.dq) || 0));
      if (o.dv !== undefined) d.vendidas = redondear((Number(actual.vendidas) || 0) + (Number(o.dv) || 0));
    }
    const fila = def.fila(d).concat([ahora, '', JSON.stringify(d)]);
    if (previa) filas[i] = fila;
    else { filas.push(fila); idx[id] = filas.length - 1; }
  });
  if (filas.length) {
    sh.getRange(2, 1, filas.length, 2).setNumberFormat('@');   // ID y código como texto (no perder ceros)
    sh.getRange(2, 1, filas.length, ncol).setValues(filas);
  }
}

// ── Enviar a un celular lo que cambió desde su última consulta ──
function sync(desde) {
  const ahora = Date.now();
  const res = { ok: true, ahora: ahora };
  Object.keys(TIPOS).forEach(t => {
    const def = TIPOS[t];
    const cab = def.cab.concat(EXTRA);
    const ncol = cab.length;
    const filas = leerFilas(hojaDe(def.hoja, cab), ncol);
    res[t] = filas.filter(r => Number(r[ncol - 3]) > desde).map(r => {
      let data = null;
      try { data = JSON.parse(r[ncol - 1] || 'null'); } catch (err) {}
      return { id: idDeFila(r, ncol), del: r[ncol - 2] === 1 || r[ncol - 2] === '1', data: data };
    });
  });
  const reglas = getConfigFila('reglas');
  if (reglas && Number(reglas[2]) > desde) { try { res.reglas = JSON.parse(reglas[1]); } catch (err) {} }
  res.maestroVer = Number(getConfig('maestroVer')) || 0;
  return res;
}

// ── Maestro compartido ──
function guardarMaestro(items) {
  const ahora = Date.now();
  const sh = hojaDe('MAESTRO', MAESTRO_CAB);
  const ult = sh.getLastRow();
  if (ult > 1) sh.getRange(2, 1, ult - 1, MAESTRO_CAB.length).clearContent();
  const filas = items.map(m => [m.barcode || '', m.barcode2 || '', m.name || '', m.cat || m.rubro || '',
                                Number(m.qty) || 0, Number(m.price) || 0, Number(m.cost) || 0]);
  if (filas.length) {
    sh.getRange(2, 1, filas.length, 2).setNumberFormat('@');   // códigos como texto (no perder ceros)
    sh.getRange(2, 1, filas.length, MAESTRO_CAB.length).setValues(filas);
  }
  setConfig('maestroVer', ahora, ahora);
  return { ok: true, ahora: ahora, maestroVer: ahora, productos: filas.length };
}
function leerMaestro() {
  const sh = hojaDe('MAESTRO', MAESTRO_CAB);
  const filas = leerFilas(sh, MAESTRO_CAB.length).filter(r => r[2] !== '');
  return { ok: true, maestroVer: Number(getConfig('maestroVer')) || 0,
           items: filas.map(r => [String(r[0]), String(r[1]), String(r[2]), String(r[3]), Number(r[4]) || 0, Number(r[5]) || 0, Number(r[6]) || 0]) };
}
