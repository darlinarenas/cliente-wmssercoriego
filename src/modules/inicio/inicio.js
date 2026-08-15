import { store } from '../../services/store.js';
import { shell,wireShell } from '../../layout/layout.js';
import { metric,badge,esc } from '../../components/ui.js';

export function renderDashboard(root){
 const d=store.data; const activeLoc=d.locations.filter(x=>x.active); const occupied=activeLoc.filter(x=>x.status!=='LIBRE').length; const temp=d.locations.filter(x=>x.kind==='POR_UBICAR'&&x.active).length; const inTransit=d.transfers.filter(t=>t.status==='EN_TRANSITO').length;
 const r69=d.racks.filter(r=>['R6','R7','R8','R9'].includes(r.id));
 const recent=d.audit.slice(0,5).map(a=>`<div class="activity"><span>◷</span><div><b>${esc(a.message)}</b><small>${new Date(a.at).toLocaleString('es-CL')}</small></div></div>`).join('');
 const content=`
 <div class="hero"><div><span class="eyebrow">OPERACIÓN ACTUAL</span><h2>Ubicar rápido. Mover con trazabilidad.</h2><p>Recoleta está activa. La arquitectura queda preparada para sumar la bodega de la tienda y transferencias entre sedes.</p></div><a class="primary" href="#/buscar">Buscar producto</a></div>
 <div class="metrics-grid">${metric('Racks activos','9','R1–R5: 6×3 · R6–R9: 6×6')}${metric('Ubicaciones configuradas',activeLoc.length,`${occupied} ocupadas/parciales`)}${metric('Ubicación rápida R6–R9',d.planning.configuredPickingSlots,'144 posiciones configuradas')}${metric('En tránsito',inTransit,`${temp} zonas temporales PU disponibles`)}</div>
 <div class="two-col"><section class="panel"><div class="panel-head"><div><span class="eyebrow">FOCO DE ORGANIZACIÓN</span><h3>Racks 6–9</h3></div>${badge('CONFIGURADOS','ok')}</div>
 <p>Estos racks concentran la nueva zona de ubicación rápida. Cada uno parte con 6 módulos × 6 niveles = 36 posiciones, una caja por posición. La estructura sigue siendo editable.</p>
 <div class="rack-mini-grid">${r69.map(r=>`<a href="#/estructura" class="rack-mini"><b>${r.name}</b><span>${r.status.replace('_',' ')}</span><small>${r.usage}</small></a>`).join('')}</div></section>
 <section class="panel"><div class="panel-head"><div><span class="eyebrow">ÚLTIMA ACTIVIDAD</span><h3>Trazabilidad</h3></div><a href="#/historial">Ver todo</a></div>${recent}</section></div>
 <section class="panel"><div class="panel-head"><div><span class="eyebrow">FLUJO OPERACIONAL</span><h3>Recepción sin frenar la descarga</h3></div></div><div class="flow"><div><b>1</b><span>Recibir</span></div><i>→</i><div><b>2</b><span>Palet temporal</span></div><i>→</i><div><b>3</b><span>POR UBICAR</span></div><i>→</i><div><b>4</b><span>Ubicar / consolidar</span></div><i>→</i><div><b>5</b><span>Encontrar siempre</span></div></div></section>`;
 root.innerHTML=shell('Inicio',content,'dashboard'); wireShell();
}
