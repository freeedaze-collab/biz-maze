import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
const JSON_OK=(o:any,i:ResponseInit={})=>new Response(JSON.stringify(o,null,2),{headers:{'content-type':'application/json; charset=utf-8'},...i})

Deno.serve(async (req)=>{
  try{
    const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')!}}})
    const {data:auth}=await supabase.auth.getUser()
    if(!auth.user) return JSON_OK({ok:false,error:'unauthorized'},{status:401})
    const uid=auth.user.id

    const {data:rows,error}=await supabase
      .from('journal_entries')
      .select('account, dc, amount')
      .eq('user_id',uid).limit(10000)
    if(error) throw error

    // Trial Balance
    const trial: Record<string,{debit:number,credit:number}> = {}
    let income=0, expense=0
    for(const r of rows ?? []){
      const amt=Number(r.amount ?? 0)
      if(!trial[r.account]) trial[r.account]={debit:0,credit:0}
      if(r.dc==='D') trial[r.account].debit  += amt
      if(r.dc==='C') trial[r.account].credit += amt
      if(r.account==='OtherIncome'      && r.dc==='C') income  += amt
      if(r.account==='OperatingExpense' && r.dc==='D') expense += amt
    }
    const tb = Object.entries(trial).map(([account, v])=>({
      account, debit:+v.debit.toFixed(2), credit:+v.credit.toFixed(2)
    }))
    const pl = { revenue_usd:+income.toFixed(2), expense_usd:+expense.toFixed(2), profit_usd:+(income-expense).toFixed(2) }

    return JSON_OK({ ok:true, pl, trial_balance: tb })
  }catch(e:any){
    return JSON_OK({ ok:false, error:String(e?.message||e) }, { status:500 })
  }
})
