export function rankTeams(teams,order){
 const rows=teams.filter(t=>t.status==='confirmed').map(t=>({id:t.id,code:t.code,name:t.name,scores:t.scores,total:t.scores.reduce((a,b)=>a+(b??0),0),tie_order:t.tie_order,rank:0}));
 const compare=(a,b)=>b.total-a.total||order.reduce((v,n)=>v||((b.scores[n-1]??0)-(a.scores[n-1]??0)),0)||(a.tie_order??2147483647)-(b.tie_order??2147483647);
 rows.sort(compare);rows.forEach((r,i)=>r.rank=i&&compare(rows[i-1],r)===0?rows[i-1].rank:i+1);return rows;
}
export function remaining(level,now){return Math.max(0,Math.ceil(level.remaining-(level.status==='active'&&level.started_at?(now-Date.parse(level.started_at))/1000:0)));}
export function csv(rows){const keys=Object.keys(rows[0]??{});const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';return '\uFEFF'+[keys,...rows.map(r=>keys.map(k=>r[k]))].map(r=>r.map(cell).join(',')).join('\r\n');}
