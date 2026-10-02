/** Audited 2025-06-15 sea inclusive base only. Never a final freight quote. */
export function haiyuanSeaBase(actualKg:number,cbm:number,category:'ordinary'|'sensitive'){
 if(!Number.isFinite(actualKg)||actualKg<=0||!Number.isFinite(cbm)||cbm<=0||!['ordinary','sensitive'].includes(category))return null
 const dimensionalKg=cbm*167,billableKg=Math.max(actualKg,dimensionalKg,21),rateCny=category==='ordinary'?20:24,baseCny=billableKg*rateCny
 if(!Number.isFinite(baseCny))return null
 return {dimensionalKg,billableKg,rateCny,baseCny,sourceDate:'2025-06-15'}
}

/** DQ customs only. Base date 2025-04-01; amounts non-taxable. */
export function kaigenDqFees(invoiceItems:number,realTimeTaxAccount:boolean){
 if(!Number.isSafeInteger(invoiceItems)||invoiceItems<1||typeof realTimeTaxAccount!=='boolean')return null
 const declarationJpy=3000+Math.max(0,Math.ceil((invoiceItems-30)/10))*1000
 if(!Number.isSafeInteger(declarationJpy))return null
 return {declarationJpy,taxAdvanceJpy:realTimeTaxAccount?0:1400}
}
/** Kaigen-prepared food filing, one factory only. Tax treatment unconfirmed. */
export function kaigenFoodFiling(itemsForOneFactory:number){
 if(!Number.isSafeInteger(itemsForOneFactory)||itemsForOneFactory<1)return null
 const amountJpy=Math.ceil(itemsForOneFactory/7)*5000+(itemsForOneFactory-1)*1000
 return Number.isSafeInteger(amountJpy)?amountJpy:null
}
