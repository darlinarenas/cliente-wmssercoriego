export const FORMATO_UBICACION_PREDETERMINADO = '{SEDE}-{RACK}-M{MODULO}-N{NIVEL}';

export function normalizarCodigoUbicacion(valor=''){
  return String(valor).trim().toUpperCase().replace(/\s+/g,'');
}

export function codigoEscaneableUbicacion(ubicacion, datos){
  if(!ubicacion) return '';
  if(ubicacion.scanCode) return ubicacion.scanCode;
  if(!ubicacion.rackId) return ubicacion.id;
  const formato=datos?.settings?.locationCodeFormat || FORMATO_UBICACION_PREDETERMINADO;
  const rackCode=ubicacion.rackCode||ubicacion.rackId||'';
  let code=formato
    .replaceAll('{SEDE}', ubicacion.siteId || '')
    .replaceAll('{RACK}', rackCode)
    .replaceAll('{MODULO}', String(ubicacion.module ?? ''))
    .replaceAll('{NIVEL}', String(ubicacion.level ?? ''))
    .replaceAll('{POSICION}', String(ubicacion.position ?? ''));
  if(ubicacion.position&&!formato.includes('{POSICION}'))code+=`-${ubicacion.position}`;
  return code;
}

export function recalcularCodigosEscaneables(datos){
  const vistos=new Set();
  const conflictos=[];
  for(const ubicacion of datos.locations || []){
    const previo=ubicacion.scanCode;
    ubicacion.scanCode='';
    const codigo=normalizarCodigoUbicacion(codigoEscaneableUbicacion(ubicacion,datos));
    ubicacion.scanCode=codigo || previo || ubicacion.id;
    if(vistos.has(ubicacion.scanCode)) conflictos.push(ubicacion.scanCode);
    vistos.add(ubicacion.scanCode);
  }
  return [...new Set(conflictos)];
}

export function buscarUbicacionPorCodigo(valor, datos){
  const buscado=normalizarCodigoUbicacion(valor);
  if(!buscado) return null;
  return (datos.locations || []).find(u=>[u.id,u.label,u.scanCode,codigoEscaneableUbicacion(u,datos)].some(x=>normalizarCodigoUbicacion(x)===buscado)) || null;
}

export function vistaCodigoUbicacion(ubicacion, datos){return codigoEscaneableUbicacion(ubicacion, datos) || ubicacion?.id || '';}
