import {attributeKeys} from './attributes.js?v=__WTF_ASSET_REVISION__';

// Equal weight for every attribute. Missing ratings contribute zero to a provisional score.
export function characterPower(ratings={}) {
  const values=attributeKeys.map(key=>ratings?.[key]).filter(value=>Number.isInteger(value)&&value>=0&&value<=99);
  const total=attributeKeys.length, rated=values.length;
  const normalized=values.reduce((sum,value)=>sum+value,0)/(total*99);
  const score=rated?Math.min(9999,Math.max(0,Math.round(9999*Math.expm1(4*normalized)/Math.expm1(4)))):null;
  return {score,rated,total,provisional:rated<total};
}
export function powerDescription(power) {
  return power.score===null?'Power not rated':`Power ${power.score.toLocaleString('en-US')} / 9,999${power.provisional?' · Provisional':''} · ${power.rated}/${power.total} attributes rated`;
}
