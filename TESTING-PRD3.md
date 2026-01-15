# Testing E2E - PRD3 RECABLIX

**Entorno de Testing**: https://recablix-prd3.vercel.app/
**Fecha**: 2026-01-15
**Branch**: feature/prd3-schemas

---

## Pre-requisitos

- [ ] Tener cuenta de superadmin creada en producción
- [ ] Tener al menos 1 studio de prueba con datos
- [ ] Tener credenciales de acceso (email/password)

---

## 1. Login y Verificación de Sesión

### 1.1 Login Exitoso
- [ ] Ir a https://recablix-prd3.vercel.app/
- [ ] Ingresar credenciales válidas
- [ ] Verificar redirección automática:
  - **Superadmin** → `/admin`
  - **Studio member** → `/studio`
- [ ] Verificar que el nombre de usuario aparece en el header/sidebar

### 1.2 Persistencia de Sesión
- [ ] Refrescar la página (F5)
- [ ] Verificar que sigue autenticado
- [ ] Abrir en nueva pestaña
- [ ] Verificar que sesión persiste

### 1.3 Logout
- [ ] Hacer click en botón de logout
- [ ] Verificar redirección a `/login`
- [ ] Intentar acceder a `/admin` o `/studio` sin sesión
- [ ] Verificar redirección automática a login

**Resultado esperado**: ✅ Login funciona, sesión persiste, protección de rutas activa

---

## 2. Panel Admin - Gestión de Studios (EPIC-04)

### 2.1 Listar Studios
- [ ] Login como superadmin
- [ ] Ir a `/admin`
- [ ] Verificar que se muestra lista de studios
- [ ] Verificar columnas: Nombre, Slug, Plan, Miembros, Fecha creación
- [ ] Verificar que hay botón "Crear Studio" (puede estar deshabilitado)

### 2.2 Ver Detalles de Studio
- [ ] Click en un studio de la lista
- [ ] Verificar que se muestran detalles completos
- [ ] Verificar tabs: General, Miembros, Configuración
- [ ] Verificar información: nombre, slug, plan, fecha creación

**Resultado esperado**: ✅ Panel admin muestra studios correctamente

---

## 3. Impersonación de Studios (EPIC-05)

### 3.1 Iniciar Impersonación
- [ ] Login como superadmin
- [ ] Ir a `/admin`
- [ ] Buscar un studio con datos de prueba
- [ ] Click en botón "Impersonar" (icono UserCog)
- [ ] Verificar toast de confirmación: "Impersonando estudio: {nombre}"
- [ ] Verificar redirección automática a `/studio`

### 3.2 Banner de Advertencia
- [ ] Verificar que aparece banner amarillo en la parte superior
- [ ] Verificar texto: "⚠️ Estás impersonando el estudio: {nombre}"
- [ ] Verificar botón "Salir de Impersonación" visible
- [ ] Verificar que el contenido tiene padding-top para no quedar oculto

### 3.3 Permisos Durante Impersonación
- [ ] Verificar que tienes acceso a todas las secciones del studio
- [ ] Intentar ver clientes → debe funcionar
- [ ] Intentar ver transacciones → debe funcionar
- [ ] Intentar ver recategorización → debe funcionar
- [ ] Verificar que actúas como "owner" (todos los permisos)

### 3.4 Salir de Impersonación
- [ ] Click en "Salir de Impersonación" del banner
- [ ] Verificar redirección a `/admin`
- [ ] Verificar que banner desaparece
- [ ] Verificar que vuelves a ser superadmin

### 3.5 Expiración de Cookie
- [ ] Iniciar impersonación
- [ ] Esperar 8+ horas (o manipular cookie manualmente)
- [ ] Refrescar página
- [ ] Verificar que impersonación expira y vuelves a admin

**Resultado esperado**: ✅ Impersonación funciona, banner visible, salida correcta

---

## 4. Panel Studio - Gestión de Clientes (EPIC-05/06)

### 4.1 Listar Clientes
- [ ] Login como miembro de studio (o impersonar)
- [ ] Ir a `/studio`
- [ ] Verificar que se muestra lista de clientes
- [ ] Verificar columnas: Nombre, CUIT, Categoría Actual, Período Activo
- [ ] Verificar botón "Agregar Cliente"

### 4.2 Crear Cliente
- [ ] Click en "Agregar Cliente"
- [ ] Completar formulario:
  - Nombre: "Cliente Test E2E"
  - CUIT: 20123456789
  - Categoría Actual: A
  - Período Activo: 08/2024 - 01/2025
- [ ] Guardar
- [ ] Verificar toast de éxito
- [ ] Verificar que aparece en la lista

### 4.3 Ver Detalle de Cliente
- [ ] Click en cliente creado
- [ ] Verificar tabs: Datos, Transacciones, Recategorización
- [ ] Verificar que datos se muestran correctamente

### 4.4 Editar Cliente
- [ ] Click en "Editar" en detalle
- [ ] Cambiar nombre: "Cliente Test E2E - Editado"
- [ ] Guardar
- [ ] Verificar toast de éxito
- [ ] Verificar cambio reflejado

### 4.5 Eliminar Cliente
- [ ] Click en "Eliminar" en detalle
- [ ] Confirmar diálogo
- [ ] Verificar toast de éxito
- [ ] Verificar que desaparece de la lista

**Resultado esperado**: ✅ CRUD completo de clientes funciona

---

## 5. CRUD de Transacciones (EPIC-06)

### 5.1 Ver Transacciones de Cliente
- [ ] Ir a detalle de un cliente con transacciones
- [ ] Tab "Transacciones"
- [ ] Verificar que se muestran transacciones existentes
- [ ] Verificar columnas: Período, Tipo, Monto, Fecha, Descripción

### 5.2 Cards de Totales
- [ ] Verificar card "Ventas" con suma de montos tipo "venta"
- [ ] Verificar card "Compras" con suma de montos tipo "compra"
- [ ] Verificar card "Neto" con resta (ventas - compras)
- [ ] Verificar formato de moneda ($ XX.XXX,XX)

### 5.3 Filtro por Período
- [ ] Seleccionar período del dropdown
- [ ] Verificar que tabla se filtra correctamente
- [ ] Verificar que totales se recalculan
- [ ] Verificar badge "Reca" en períodos dentro del rango activo

### 5.4 Crear Transacción
- [ ] Click en "Agregar Transacción"
- [ ] Completar formulario:
  - Período: 12/2024
  - Tipo: Venta
  - Monto: 150000
  - Fecha: 15/12/2024
  - Descripción: "Test E2E"
- [ ] Guardar
- [ ] Verificar toast de éxito
- [ ] Verificar que aparece en tabla
- [ ] Verificar que totales se actualizan

### 5.5 Editar Transacción
- [ ] Click en "Editar" en transacción creada
- [ ] Cambiar monto: 200000
- [ ] Guardar
- [ ] Verificar cambio reflejado en tabla y totales

### 5.6 Eliminar Transacción
- [ ] Click en "Eliminar" en transacción creada
- [ ] Confirmar
- [ ] Verificar que desaparece
- [ ] Verificar que totales se recalculan

### 5.7 Import desde Excel
- [ ] Preparar archivo Excel con columnas:
  - Periodo | Tipo | Monto | Fecha | Descripcion
- [ ] Click en "Importar Excel"
- [ ] Seleccionar archivo
- [ ] Verificar preview de datos
- [ ] Confirmar importación
- [ ] Verificar que transacciones se crean correctamente
- [ ] Verificar mensaje con cantidad importada

### 5.8 Soporte de Montos Negativos
- [ ] Crear transacción con monto negativo (nota de crédito)
- [ ] Verificar que se guarda correctamente
- [ ] Verificar que totales se calculan bien (restan del total)

**Resultado esperado**: ✅ CRUD de transacciones + import + cálculos correctos

---

## 6. Recategorización (EPIC-07)

### 6.1 Ver Panel de Recategorización
- [ ] Ir a `/studio/recategorization`
- [ ] Verificar que se muestra tabla con todos los clientes
- [ ] Verificar columnas: Cliente, Cat. Actual, Cat. Nueva, Cambio, Cuota Actual, Cuota Nueva

### 6.2 Cards de Estadísticas
- [ ] Verificar card "Total Clientes" con cantidad correcta
- [ ] Verificar card "Suben ↑" con clientes que aumentan categoría
- [ ] Verificar card "Bajan ↓" con clientes que disminuyen categoría
- [ ] Verificar card "Sin cambios →" con clientes que mantienen
- [ ] Verificar card "Cuota Total Nueva" con suma de cuotas

### 6.3 Indicadores Visuales
- [ ] Verificar icono ↑ (verde) para clientes que suben
- [ ] Verificar icono ↓ (rojo) para clientes que bajan
- [ ] Verificar icono → (gris) para clientes sin cambio
- [ ] Verificar colores coherentes con el cambio

### 6.4 Ver Detalle de Cliente
- [ ] Click en un cliente de la tabla
- [ ] Verificar que se abre dialog con detalles
- [ ] Verificar secciones:
  - Parámetros (Ingresos, m², MW, Alquiler)
  - Categoría Actual vs Nueva
  - Desglose de Cuota (componentes de la nueva cuota)
- [ ] Cerrar dialog

### 6.5 Filtros
- [ ] Usar buscador para filtrar por nombre de cliente
- [ ] Verificar que tabla se filtra correctamente
- [ ] Usar dropdown "Tipo de cambio": Suben, Bajan, Sin cambios
- [ ] Verificar que tabla se filtra según selección
- [ ] Combinar ambos filtros
- [ ] Verificar que funciona correctamente

### 6.6 Botón Recalcular
- [ ] Click en "Recalcular"
- [ ] Verificar que se muestran datos actualizados
- [ ] Verificar que estadísticas se recalculan

### 6.7 Export a Excel
- [ ] Click en "Exportar a Excel"
- [ ] Verificar que se descarga archivo .xlsx
- [ ] Abrir archivo
- [ ] Verificar columnas:
  - Cliente, CUIT, Categoría Actual, Categoría Nueva
  - Cuota Actual, Cuota Nueva, Cambio
  - Componentes de cuota (impuesto integrado, aportes, obra social)
- [ ] Verificar que datos coinciden con la tabla

### 6.8 Cálculos del Motor
- [ ] Verificar que categoría se calcula por 4 parámetros:
  - Ingresos brutos (facturación)
  - Superficie (m²)
  - Energía eléctrica (MW)
  - Alquileres devengados
- [ ] Verificar que se toma el límite más restrictivo
- [ ] Verificar que cuota se compone de:
  - Impuesto integrado
  - Aportes jubilatorios
  - Obra social

**Resultado esperado**: ✅ Recategorización con cálculos, filtros y export

---

## 7. Gestión de Permisos (EPIC-04)

### 7.1 Ver Miembros del Studio (como Owner)
- [ ] Login como owner o impersonar studio
- [ ] Ir a `/studio/settings` (o sección de miembros)
- [ ] Verificar tabla con miembros del studio
- [ ] Verificar columnas: Email, Rol, Permisos Activos, Fecha Alta

### 7.2 Editar Permisos de Miembro
- [ ] Click en "Editar" (icono lápiz) en un miembro collaborator/client
- [ ] Verificar que se abre dialog con 7 switches:
  - Ver Facturación
  - Gestionar Suscripciones
  - Eliminar Miembros
  - Eliminar Clientes
  - Exportar Datos
  - Importar Datos
  - Generar Reportes
- [ ] Activar/desactivar algunos permisos
- [ ] Guardar
- [ ] Verificar toast de éxito
- [ ] Verificar que columna "Permisos Activos" se actualiza

### 7.3 Validación de Roles
- [ ] Intentar editar un miembro "owner"
- [ ] Verificar que switches están deshabilitados o muestra mensaje
- [ ] Intentar editar un miembro "admin"
- [ ] Verificar restricciones según tu rol

### 7.4 Eliminar Miembro
- [ ] Click en "Eliminar" (icono papelera) en un miembro
- [ ] Confirmar diálogo
- [ ] Verificar toast de éxito
- [ ] Verificar que miembro desaparece de la tabla

### 7.5 Protección de Owner Único
- [ ] Si hay solo 1 owner, intentar eliminarlo
- [ ] Verificar error: "No se puede eliminar único owner"
- [ ] Verificar que no se elimina

### 7.6 Invitar Miembro (opcional)
- [ ] Click en "Invitar Miembro"
- [ ] Verificar toast o modal (función puede estar pendiente)

### 7.7 Testing de Permisos (como Admin)
- [ ] Login como admin de un studio
- [ ] Ir a `/studio/settings`
- [ ] Verificar que NO puedes editar owners o admins
- [ ] Verificar que solo puedes editar collaborators y clients
- [ ] Intentar eliminar owner → debe fallar

**Resultado esperado**: ✅ Gestión de permisos granulares funciona

---

## 8. Verificaciones Adicionales

### 8.1 Responsive Design
- [ ] Probar en mobile (375px)
- [ ] Probar en tablet (768px)
- [ ] Probar en desktop (1920px)
- [ ] Verificar que todos los componentes se adaptan

### 8.2 Performance
- [ ] Verificar tiempos de carga < 3s
- [ ] Verificar que no hay errores en consola
- [ ] Verificar que no hay warnings de React

### 8.3 Tenant Schemas
- [ ] Verificar que queries usan tenant schema correcto
- [ ] Verificar que no hay cross-contamination entre studios
- [ ] Crear dato en studio A, verificar que no aparece en studio B

---

## Criterios de Aceptación

Para considerar PRD3 listo para producción, TODOS los siguientes deben cumplirse:

- ✅ Login y sesión funcionan correctamente
- ✅ Panel admin muestra studios
- ✅ Impersonación funciona con banner visible
- ✅ CRUD de clientes completo
- ✅ CRUD de transacciones + import Excel
- ✅ Recategorización con cálculos correctos
- ✅ Gestión de permisos granulares
- ✅ No hay errores en consola
- ✅ Responsive en 3 resoluciones
- ✅ Tenant schemas sin cross-contamination

---

## Reporte de Bugs

Si encontrás algún bug durante el testing, documentarlo aquí:

### Bug #1
- **Descripción**:
- **Pasos para reproducir**:
- **Resultado esperado**:
- **Resultado actual**:
- **Severidad**: 🔴 Alta / 🟡 Media / 🟢 Baja

---

## Notas Adicionales

- Usar datos de prueba, NO datos de producción
- Documentar cualquier comportamiento inesperado
- Si algo no funciona, revisar logs de Vercel
- Verificar variables de entorno antes de testing
