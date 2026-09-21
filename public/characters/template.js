export const templateSections = [
  {id:'identity', title:'Identity', fields:[['name','Name','input'],['title','Known as / epithet','input'],['roles','Occupations','input'],['affiliation','Affiliation','input'],['storyRole','Story role','input']]},
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
export function blankCharacter() { return {...Object.fromEntries(fieldNames.map(name=>[name,''])), relationships:[]}; }
export const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
