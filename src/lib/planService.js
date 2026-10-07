import {supabase} from './supabase'
import {generatePlan,todayStr,addDays,dayName} from './planner'
export async function savePlan(data,uid,from=todayStr(),override={}){
  const res=generatePlan({...data,...override,from})
  if(res.error)return res
  const d=await supabase.from('tasks').delete().eq('user_id',uid).gte('date',from).in('status',['pending','started'])
  if(d.error)return {error:'Could not update your plan. Please try again.'}
  for(let i=0;i<res.tasks.length;i+=400){
    const r=await supabase.from('tasks').insert(res.tasks.slice(i,i+400).map(t=>({...t,user_id:uid})))
    if(r.error)return {error:'Could not save your plan. Please try again.'}
  }
  return res
}
export async function rebalance(data,uid,reason){
  const today=todayStr(), missed=data.tasks.filter(t=>t.date===today&&['pending','started'].includes(t.status))
  if(!missed.length)return {error:'You have no unfinished tasks today.'}
  const lessons=data.lessons.map(l=>({...l})), tasks=data.tasks.map(t=>missed.includes(t)?{...t,status:'missed'}:t)
  for(const t of missed){
    await supabase.from('tasks').update({status:'missed'}).eq('id',t.id)
    const l=lessons.find(x=>x.id===t.lesson_id)
    if(l&&reason==='understand'&&t.type==='Learn'){l.difficult=(l.difficult||0)+1;await supabase.from('lessons').update({difficult:l.difficult}).eq('id',l.id)}
  }
  const res=await savePlan(data,uid,addDays(today,1),{lessons,tasks})
  if(res.error)return res
  const ids=[...new Set(missed.map(t=>t.subject_id))], names=ids.map(i=>data.subjects.find(s=>s.id===i)?.name).filter(Boolean)
  const days=[...new Set(res.tasks.filter(t=>ids.includes(t.subject_id)).map(t=>t.date))].slice(0,2).map(dayName)
  res.explanation=`Your plan has been adjusted because you missed today's ${names.join(' and ')} session. `+
    (days.length?`We moved part of it to ${days.join(' and ')} so tomorrow does not become overloaded.`:'There was no room before your target date, so we re-ordered your priorities. Check the time warning on your dashboard.')
  return res
}
