import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCard} from '../public/components/character-card/model.js';
import {numericTextFields,validNumericText,bindNumericText} from '../public/characters/numeric-text.js';

test('character cards retain the authored occupation boundaries, including punctuation and display separators',()=>{
 const roles=['Archivist, records; keeper','Moon · Tide interpreter'];
 const source={id:'claude',roles:roles.join(' · '),choiceSelections:{roles}};
 assert.deepEqual(normalizeCard(source).roles,roles);
 assert.deepEqual(normalizeCard({id:'claude',roles:roles[0]}).roles,[roles[0]]);
 assert.deepEqual(normalizeCard({id:'claude',roles:'Archivist · Diplomat'}).roles,['Archivist','Diplomat']);
 const card=normalizeCard({id:'claude',roles});card.roles.push('Inventor');
 assert.deepEqual(source.choiceSelections.roles,roles,'card display cannot mutate the saved selection draft');
});

test('authored numeric text retains compatible formatting while finite, nonnegative and integer-age rules agree',()=>{
 for(const key of numericTextFields){
  for(const value of ['', '0', '+12', '12.', '0x10', ' 12 ', '   ', '1e3', '12.00'])assert.equal(validNumericText(key,value),true,key+': '+JSON.stringify(value));
  for(const value of ['-1','NaN','Infinity','1e999','not a number',null,12])assert.equal(validNumericText(key,value),false,key+': '+JSON.stringify(value));
 }
 assert.equal(validNumericText('age','12.5'),false);
 assert.equal(validNumericText('height','12.5'),true);
 assert.equal(validNumericText('weight','12.5'),true);
});

test('numeric controls retain untouched raw text and switch to the edited value after input',()=>{
 const handlers={},input={value:'+12',addEventListener(event,callback){handlers[event]=callback;},setCustomValidity(message){this.validationMessage=message;}};
 const original='\r\n+12\r\n',read=bindNumericText(input,'age',original);
 assert.equal(read(),original);assert.equal(input.validationMessage,'');
 input.value='13';handlers.input();assert.equal(read(),'13');assert.equal(input.validationMessage,'');
 input.value='-1';handlers.input();assert.ok(input.validationMessage);assert.equal(read(),'-1');
 input.value='';handlers.input();assert.equal(read(),'');assert.equal(input.validationMessage,'');
});
