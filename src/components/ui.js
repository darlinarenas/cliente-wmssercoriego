export const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
export const badge=(text,tone='neutral')=>`<span class="badge ${tone}">${esc(text)}</span>`;
export const metric=(label,value,sub='')=>`<div class="metric"><div class="metric-label">${esc(label)}</div><div class="metric-value">${esc(value)}</div><div class="metric-sub">${esc(sub)}</div></div>`;
export const empty=(title,body='')=>`<div class="empty"><strong>${esc(title)}</strong><span>${esc(body)}</span></div>`;
