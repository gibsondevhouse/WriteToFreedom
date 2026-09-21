import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sectionAtHeader} from '../public/profiles/viewport.js';
import {datePickerPlacement} from '../public/profiles/date-picker.js';

test('section labels wait for the heading edge, including reverse scroll and skipped headings',()=>{
 assert.equal(sectionAtHeader([54.01,420,900],54),-1);
 assert.equal(sectionAtHeader([54,420,900],54),0);
 assert.equal(sectionAtHeader([-200,54.01,534],54),0);
 assert.equal(sectionAtHeader([-200,54,534],54),1);
 assert.equal(sectionAtHeader([-900,-700,-200,55],54),2);
 // Returning above the heading restores the preceding label.
 assert.equal(sectionAtHeader([-199,55,535],54),0);
 assert.equal(sectionAtHeader([55,420,900],54),-1);
});
test('section tracking accommodates reflow, a resized header, and hidden sections',()=>{
 assert.equal(sectionAtHeader([43.5,60,500],43.5),0);
 assert.equal(sectionAtHeader([20,60,500],54),0);
 assert.equal(sectionAtHeader([20,60,500],70),1);
 assert.equal(sectionAtHeader([20,50,90],54),1);
 assert.equal(sectionAtHeader([20,Infinity,500],54),0);
 assert.equal(sectionAtHeader([],54),-1);
});
test('date picker stays beside the attributes card with a gap and fits viewport bounds',()=>{
 const viewport={left:0,top:0,width:1222,height:875},card={left:912};
 for(const top of [100,430,790]){
  const point=datePickerPlacement({top,bottom:top+34,right:1204},card,viewport,354,624);
  assert.equal(card.left-(point.left+354),12);
  assert.ok(point.top>=12);assert.ok(point.top+624<=863);
 }
 const panned=datePickerPlacement({top:430,bottom:464,right:1500},{left:1400},viewport,354,624);
 assert.ok(panned.left>=12&&panned.left+354<=1210);
 const mobile=datePickerPlacement({top:430,bottom:464,right:350},{left:18},{left:0,top:0,width:375,height:667},351,624);
 assert.equal(mobile.left,12);assert.ok(mobile.top>=12&&mobile.top+624<=655);
 // The on-screen keyboard can offset and shrink the visual viewport.
 const keyboard=datePickerPlacement({top:700,bottom:734,right:350},{left:18},{left:5,top:320,width:375,height:280},351,256);
 assert.deepEqual(keyboard,{left:17,top:332});
});
