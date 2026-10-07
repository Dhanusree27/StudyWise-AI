// Vercel serverless function. Gemini key stays on the server.
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'})
  const token=(req.headers.authorization||'').replace('Bearer ','')
  const u=await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`,{headers:{Authorization:`Bearer ${token}`,apikey:process.env.SUPABASE_ANON_KEY||''}}).catch(()=>null)
  if(!u||!u.ok)return res.status(401).json({error:'Please log in again.'})
  if(!process.env.GEMINI_API_KEY)return res.status(503).json({error:'The AI helper is not set up yet.'})
  const prompt=String((req.body||{}).prompt||'').slice(0,2000)
  if(!prompt)return res.status(400).json({error:'Please ask a question.'})
  try{
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL||'gemini-2.0-flash'}:generateContent`,{
      method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},
      body:JSON.stringify({systemInstruction:{parts:[{text:'You are a friendly study coach for class 12 students. Use simple words. Keep answers under 150 words.'}]},contents:[{role:'user',parts:[{text:prompt}]}]})})
    const j=await r.json()
    const text=j.candidates?.[0]?.content?.parts?.map(p=>p.text).join('')
    if(!r.ok||!text)return res.status(502).json({error:'The AI helper could not answer right now.'})
    res.json({text})
  }catch{res.status(502).json({error:'The AI helper is not reachable right now.'})}
}
