export const templateSections = [
  {id:'identity', title:'Identity', fields:[['firstName','First name','input'],['middleName','Middle name','input'],['lastName','Last name','input'],['title','Known as / epithet','input'],['roles','Occupations','input'],['factionId','Faction','faction'],['storyRole','Story role','select'],['alignment','Moral alignment','select']]},
  {id:'overview', title:'Overview', fields:[['summary','Short description','textarea'],['introduction','Introduction','textarea']]},
  {id:'biography', title:'Biography', fields:[['biography','Biography','textarea'],['earlyLife','Early life','textarea'],['presentDay','Present circumstances','textarea']]},
  {id:'personality', title:'Personality & attributes', fields:[['personality','Personality','textarea'],['strength','Strengths','textarea'],['flaw','Flaws','textarea']]},
  {id:'tendencies', title:'Tendencies & voice', fields:[['tendencies','Tendencies','textarea'],['voice','Voice & manner','textarea']]},
  {id:'motivations', title:'Motivations & conflicts', fields:[['desire','What they want','textarea'],['fear','What they fear','textarea'],['contradiction','Inner conflict','textarea']]},
  {id:'relationships', title:'Relationships', fields:[]},
  {id:'story-arc', title:'Story arc', fields:[['arc','Character development','textarea']]},
  {id:'open-questions', title:'Open questions', fields:[['questions','Unresolved questions','textarea']]},
];
export const fieldNames = templateSections.flatMap(section=>section.fields.map(([name])=>name));
export const nameFields = ['firstName','middleName','lastName'];
export const storyRoles = ['Protagonist','Antagonist','Deuteragonist','Tritagonist','Supporting character','Mentor','Foil','Love interest','Confidant','Catalyst','Comic relief','Background character','Other'];
export const alignments = ['Good','Mostly good','Neutral','Morally gray','Mostly evil','Evil','Changing','Undecided'];
export function fullName(character) { return nameFields.map(key=>(character[key]||'').trim()).filter(Boolean).join(' '); }
export function blankCharacter() { return {...Object.fromEntries(fieldNames.map(name=>[name,''])), name:'', affiliation:'', relationships:[]}; }
export function normalizeCharacter(character) {
 const structured = nameFields.some(key=>Object.hasOwn(character,key));
 const output={...blankCharacter(),...character};
 if(!structured) output.firstName=character.name||'';
 output.name=fullName(output);
 return output;
}
export const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
