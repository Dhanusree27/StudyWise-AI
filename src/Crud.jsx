import {useState} from 'react'
import {add,del} from './lib/db'
function In({x,v,set}){
  const o=(x.options||[]).map(a=>typeof a==='object'?a:{v:a,l:a})
  if(x.type==='select')return <select value={v??''} onChange={e=>set(e.target.value)}><option value="">Choose…</option>{o.map(a=><option key={a.v} value={a.v}>{a.l}</option>)}</select>
  if(x.type==='check')return <input type="checkbox" checked={!!v} onChange={e=>set(e.target.checked)}/>
  return <input type={x.type||'text'} value={v??''} min={x.min} step={x.step} onChange={e=>set(e.target.value)}/>
}
export default function Crud({table,title,fields,rows,reload,defaults={},show,check,help}){
  const [f,setF]=useState(defaults),[err,setErr]=useState(''),[busy,setBusy]=useState(false)
  const submit=async e=>{e.preventDefault();const row={...f}
    for(const x of fields){const hidden=x.showIf&&!x.showIf(row);if(hidden){row[x.k]=null;continue}
      if(x.required&&(row[x.k]===undefined||row[x.k]===''||row[x.k]===null))return setErr(`Please fill in: ${x.l}`)
      if(row[x.k]==='')row[x.k]=null
      if((x.type==='number'||x.num)&&row[x.k]!=null)row[x.k]=+row[x.k]}
    const m=check&&check(row);if(m)return setErr(m)
    setBusy(true);try{await add(table,row);setF(defaults);setErr('');await reload()}catch(x){setErr('Could not save. '+x.message)}setBusy(false)}
  const remove=async id=>{try{await del(table,id);await reload()}catch(x){setErr(x.message)}}
  return <section className="card"><h3>{title}</h3>{help&&<p className="hint">{help}</p>}
    <form className="grid" onSubmit={submit}>{fields.filter(x=>!x.showIf||x.showIf(f)).map(x=>
      <label key={x.k}>{x.l}<In x={x} v={f[x.k]} set={v=>setF(s=>({...s,[x.k]:v}))}/></label>)}
      <button className="btn" disabled={busy}>Add</button></form>
    {err&&<p className="warn">{err}</p>}
    {rows.length===0?<p className="hint">Nothing added yet.</p>:<ul className="list">{rows.map(r=><li key={r.id}><span>{show(r)}</span><button className="x" aria-label="Delete" onClick={()=>remove(r.id)}>×</button></li>)}</ul>}
  </section>
}
