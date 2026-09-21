export const humanFieldGroups=[
 {title:'Personal details',fields:[['birthDate','Birth date','input'],['age','Age','number'],['lifeStatus','Life status','select'],['deathDate','Death date','input'],['gender','Gender','suggest'],['pronouns','Pronouns','suggest'],['birthPlaceId','Birthplace','location'],['residenceId','Residence','location'],['citizenshipId','Citizenship','country'],['nationality','Nationality','input'],['ethnicity','Ethnic / cultural background','input'],['languages','Languages','input']]},
 {title:'Physical appearance',fields:[['height','Height','number'],['heightUnit','Height unit','select'],['weight','Weight','number'],['weightUnit','Weight unit','select'],['build','Build','suggest'],['eyeColor','Eye color','suggest'],['hairColor','Hair color','suggest'],['hairStyle','Hair style','input'],['skinTone','Skin tone','input'],['handedness','Handedness','select'],['distinguishingMarks','Distinguishing marks','input']]},
 {title:'Health & background',fields:[['bloodType','Blood type','select'],['health','Health / disabilities','input'],['education','Education','input'],['faith','Faith / beliefs','input']]}
];
export const humanChoices={lifeStatus:['Alive','Deceased','Missing','Unknown'],heightUnit:['cm','in'],weightUnit:['kg','lb'],handedness:['Right-handed','Left-handed','Ambidextrous','Mixed-handed'],bloodType:['A+','A−','B+','B−','AB+','AB−','O+','O−','Unknown']};
export const humanSuggestions={gender:['Woman','Man','Nonbinary','Agender','Genderfluid'],pronouns:['She/her','He/him','They/them','She/they','He/they'],build:['Slim','Average','Athletic','Muscular','Stocky','Broad'],eyeColor:['Brown','Blue','Green','Hazel','Gray','Amber'],hairColor:['Black','Brown','Blond','Red','Gray','White','Bald']};
export const humanFields=humanFieldGroups.flatMap(g=>g.fields);
export const templateSections = [
  {id:'identity', title:'Identity', fields:[['firstName','First name','input'],['middleName','Middle name','input'],['lastName','Last name','input'],['title','Known as / epithet','input'],['roles','Occupations','input'],['factionId','Faction','faction'],['storyRole','Story role','select'],['alignment','Moral alignment','select'],...humanFields]},
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
export function blankCharacter() { return {...Object.fromEntries(fieldNames.map(name=>[name,''])), name:'', affiliation:'', relationships:[], hiddenFields:[]}; }
export function normalizeCharacter(character) {
 const structured = nameFields.some(key=>Object.hasOwn(character,key));
 const output={...blankCharacter(),...character};
 if(!structured) output.firstName=character.name||'';
 output.name=fullName(output);
 return output;
}
export const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const hideableFields=templateSections.filter(s=>s.id!=='identity').flatMap(s=>s.id==='relationships'?['relationships']:s.fields.map(f=>f[0]));
