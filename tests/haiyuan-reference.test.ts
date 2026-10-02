import test from 'node:test'
import assert from 'node:assert/strict'
import {haiyuanSeaBase} from '../src/lib/calc/haiyuan-reference'
test('sea ticket base uses 21kg minimum, CBM167 and actual weight; category rates are distinct',()=>{assert.equal(haiyuanSeaBase(1,.01,'ordinary')?.baseCny,420);assert.equal(haiyuanSeaBase(1,.01,'sensitive')?.baseCny,504);assert.equal(haiyuanSeaBase(200,1,'ordinary')?.baseCny,4000);assert.equal(haiyuanSeaBase(1,1,'ordinary')?.baseCny,3340)})
test('one ticket is charged once; invalid/unknown totals are not silently zero',()=>{assert.equal(haiyuanSeaBase(2,.02,'ordinary')?.baseCny,420);for(const v of [0,-1,NaN,Infinity]){assert.equal(haiyuanSeaBase(v,1,'ordinary'),null);assert.equal(haiyuanSeaBase(1,v,'ordinary'),null)}assert.equal(haiyuanSeaBase(1,1,'mixed' as any),null);assert.equal(haiyuanSeaBase(Number.MAX_VALUE,1,'ordinary'),null)})
test('base remains unrounded and never includes guessed extras',()=>{const r=haiyuanSeaBase(21.123456,0.1,'ordinary')!;assert.equal(r.baseCny,21.123456*20);assert.equal(r.sourceDate,'2025-06-15');assert.equal('totalFreight' in r,false)})
