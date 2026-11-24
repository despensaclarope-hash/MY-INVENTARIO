# MY-INVENTARIO
Inventario MiniMarket CLAROPE

App para contar el inventario con el celular (`inventario-scanner.html`).

## Cómo se usa
1. **Una vez:** en *Exportar → Importar desde Excel*, cargá el MAESTRO del sistema (trae código, código de barras alternativo, rubro, stock y costo).
2. **Antes de contar:** elegí la zona y el sector (R1…R15, C1…C11, D1…D13, S1–S2, E1…E9, B1…B7, T1…T11), igual que en los planos.
3. **Escaneá** con cualquiera de los dos códigos del producto. Si el producto ya está contado en ese sector, se suma ahí; en otro sector se guarda aparte.
4. **Al terminar el día:** *Exportar a Excel*. La hoja **Para planilla** tiene una fila por producto y sector, y **Totales por producto** el total contra el stock del sistema.

## Cambios v2 (noviembre 2026)
- Lee del MAESTRO las columnas `CantidadStock`, `CodigoBarras` y `Costo(c/IVA)`.
- Escanea por código principal o alternativo y guarda los dos.
- Cada producto escaneado toma el stock del sistema; la diferencia usa el total de todos los sectores.
- El conteo queda separado por sector.
- Acepta kilos con decimales y cantidad 0.
- Recepción B1–B7 y Mesa de trabajo T1–T11, como en los planos.
- Aviso de conteo sin exportar, copia de seguridad, restaurar y recuperar lo último borrado.

## Compartir entre celulares (noviembre 2026)
- Google Sheets es el lugar central: `apps-script-sync.gs` (también se copia desde la app) crea las hojas MAESTRO, CONTEO, TERMINADAS, VENCIMIENTOS y CONFIG.
- Cada celular envía sus cambios y recibe los de los demás cada 20 segundos. Las cantidades viajan como diferencia, así dos celulares contando el mismo producto a la vez no se pisan.
- El maestro se importa en un celular y les llega a los demás. Sin internet, los cambios quedan pendientes y se envían al volver.
- Indicador arriba a la derecha: 🟢 sincronizado · 🟠 por enviar · 🔴 sin conexión.
- Configurar otros celulares: 📡 Google Sheets → 📲 Copiar enlace (abre la app con `?sync=URL`).
- "Borrar inventario" con celulares conectados borra el conteo en todos.

## Plano interactivo de ubicación (noviembre 2026)
- En **📍 Ubicación actual de conteo** se elige la góndola tocándola en el plano (Tienda, Depósito interno, Depósito exterior, Recepción y mesa de trabajo).
- Muestra el nombre del sector y el responsable (rojo: repositor · amarillo: cajera) y marca con ✓ las góndolas ya contadas.
- Botón **✅ Conteo terminado** en cada góndola: queda marcada con ✓ en el plano y en la lista (naranja = en curso). En **📊 Progreso** se ve el avance por zona y qué góndolas faltan. Se puede reabrir; al borrar el inventario se reinicia.
- Botón **☰ Lista** para volver a los botones de siempre; la app recuerda la elección. Las coordenadas están en `PLANOS` dentro del HTML.

## Módulo Vencimientos (noviembre 2026)
- Al escanear un producto cuya categoría tiene **días de alerta**, la app pide la fecha del lote más próximo.
  - Faltan más días que el límite → avisa OK y no guarda nada.
  - Dentro del límite → alerta amarilla/naranja y guarda el lote con su cantidad.
  - Vencido → alerta roja para retirarlo.
  - Botón para guardar otro lote con distinta fecha del mismo producto.
- El escáner de vencimientos usa la misma cámara, configuración y botones que el de inventario.
- Pestaña **⏰ Vencim.**: lotes con semáforo, filtros, control rápido de góndolas (registra fechas sin sumar al conteo) y exportar a Excel.
- Cualquier usuario puede **descontar unidades vendidas** de un lote; si llega a 0 se cierra como *Vendido*. En el control rápido, si el lote ya existe se escribe lo que **queda** en góndola y la diferencia se cuenta como vendida.
- Gerente, Dueño/a, Supervisor/a y Encargado/a marcan qué se hizo con cada lote (rebajado, al frente, devuelto, merma) y configuran los días de alerta por rubro (ej. `PERECIBLES - LACTEOS` = 15) o por producto (0 = no pedir fecha).
- Los datos de vencimientos se guardan aparte (`mm_venc`, `mm_venc_reglas`): borrar el inventario no los borra. Entran en la copia de seguridad.

## Verificador de precios (noviembre 2026)
- Pestaña **🏷️ Precios**: escaneás (cámara o lector) un producto y muestra en grande el **precio de venta del maestro**, el rubro, los códigos y el stock. Gerente, Dueño/a, Supervisor/a y Encargado/a ven también el costo c/IVA y el margen.
- Se compara con la etiqueta de la góndola: **✅ Coincide**, **⚠️ Es distinto** (se escribe el precio de la etiqueta; acepta `4500`, `4.500` o `4.500,50`) o **🚫 No tiene etiqueta**. Un código que no está en el maestro se puede anotar para darlo de alta.
- Lo que no coincide queda en **Para corregir** (con la diferencia y el sector); se marca **✔ Corregido** cuando se cambia la etiqueta. El número rojo en la pestaña son las etiquetas pendientes.
- Si se escaneó con la cámara, después de registrar se vuelve a abrir sola para el próximo producto.
- **Exportar control de precios**: Excel con las hojas *Para corregir* y *Todos los controles*.
- Los precios salen del maestro cargado: importar el maestro del día para que estén al día. Los controles se guardan en el celular (`mm_precios`), no se borran con el inventario y entran en la copia de seguridad. No se comparten por Google Sheets.
