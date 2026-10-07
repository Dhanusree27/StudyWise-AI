import {supabase} from './supabase'

const ok=({data,error})=>{
  if(error){
    console.error('[StudyWise DB]',error.message,error.details||'',error.hint||'')
    throw new Error(error.message)
  }
  return data
}

/**
 * Ensure a minimal profile row exists for the current user.
 * Uses upsert with ignoreDuplicates so it never creates a second row
 * and never overwrites an existing profile.
 * This is a client-side safety net in case the DB trigger hasn't been deployed yet.
 */
async function ensureProfile(userId){
  const {error}=await supabase
    .from('profiles')
    .upsert({id:userId},{onConflict:'id',ignoreDuplicates:true})
  if(error){
    // Log but don't throw – the profile may already exist and RLS may block the upsert
    // if the row is already there. We'll still try to SELECT it below.
    console.warn('[StudyWise] ensureProfile upsert notice:',error.message)
  }
}

export async function loadAll(){
  const {data:{user},error:authErr}=await supabase.auth.getUser()
  if(authErr||!user){
    console.error('[StudyWise] getUser failed:',authErr?.message||'no user')
    throw new Error(authErr?.message||'Not authenticated. Please log in again.')
  }

  // Safety net: guarantee a profile row exists before querying
  await ensureProfile(user.id)

  const [profile,...rest]=await Promise.all([
    supabase.from('profiles').select('*').eq('id',user.id).maybeSingle().then(ok),
    ...['subjects','lessons','slots','exams','tasks'].map(t=>supabase.from(t).select('*').order('id').then(ok))])
  const [subjects,lessons,slots,exams,tasks]=rest
  return {profile,subjects,lessons,slots,exams,tasks}
}

export const add=async(t,row)=>ok(await supabase.from(t).insert(row).select().single())
export const upd=async(t,id,patch)=>ok(await supabase.from(t).update(patch).eq('id',id))
export const del=async(t,id)=>ok(await supabase.from(t).delete().eq('id',id))
export const saveProfile=async(uid,p)=>ok(await supabase.from('profiles').upsert({...p,id:uid}))
