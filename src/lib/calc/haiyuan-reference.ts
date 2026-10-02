/** Audited 2025-06-15 sea inclusive base only. Never a final freight quote. */
export function haiyuanSeaBase(actualKg:number,cbm:number,category:'ordinary'|'sensitive'){
 if(!Number.isFinite(actualKg)||actualKg<=0||!Number.isFinite(cbm)||cbm<=0||!['ordinary','sensitive'].includes(category))return null
 const dimensionalKg=cbm*167,billableKg=Math.max(actualKg,dimensionalKg,21),rateCny=category==='ordinary'?20:24,baseCny=billableKg*rateCny
 if(!Number.isFinite(baseCny))return null
 return {dimensionalKg,billableKg,rateCny,baseCny,sourceDate:'2025-06-15'}
}
