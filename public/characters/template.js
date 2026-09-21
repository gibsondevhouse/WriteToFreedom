export const humanFieldGroups=[
 {title:'Personal details',fields:[['birthDate','Birth date','input'],['age','Age','number'],['lifeStatus','Life status','select'],['deathDate','Death date','input'],['gender','Gender','choice'],['pronouns','Pronouns','choice'],['birthPlaceId','Birthplace','location'],['residenceId','Residence','location'],['citizenshipId','Citizenship','country'],['nationality','Nationality','choice'],['ethnicity','Ethnic / cultural background','input'],['languages','Languages','choice']]},
 {title:'Physical appearance',fields:[['height','Height','number'],['heightUnit','Height unit','select'],['weight','Weight','number'],['weightUnit','Weight unit','select'],['build','Build','choice'],['eyeColor','Eye color','choice'],['hairColor','Hair color','choice'],['hairStyle','Hair style','choice'],['skinTone','Skin tone','choice'],['handedness','Handedness','select'],['distinguishingMarks','Distinguishing marks','choice']]},
 {title:'Health & background',fields:[['bloodType','Blood type','select'],['health','Health / disabilities','choice'],['education','Education','choice'],['faith','Faith / beliefs','choice']]}
];
export const humanChoices={lifeStatus:['Alive','Deceased','Missing','Unknown'],heightUnit:['cm','in'],weightUnit:['kg','lb'],handedness:['Right-handed','Left-handed','Ambidextrous','Mixed-handed'],bloodType:['A+','A−','B+','B−','AB+','AB−','O+','O−','Unknown']};
// Suggested values remain editable; these are writing aids, not validation enums.
export const profileChoices={
 roles:['Student','Teacher','Professor','Researcher','Doctor','Nurse','Therapist','Social worker','Lawyer','Judge','Police officer','Detective','Firefighter','Paramedic','Soldier','Politician','Civil servant','Journalist','Writer','Editor','Artist','Musician','Actor','Athlete','Engineer','Programmer','Scientist','Entrepreneur','Manager','Accountant','Shopkeeper','Farmer','Chef','Server','Driver','Mechanic','Electrician','Builder','Architect','Librarian','Archivist','Diplomat','Investigator','Scholar','Inventor','Strategist','Explorer','Interpreter','Clergy','Homemaker','Caregiver','Volunteer','Retired','Unemployed'],
 gender:['Woman','Man','Nonbinary','Agender','Genderfluid','Questioning','Unspecified'],
 pronouns:['She/her','He/him','They/them','She/they','He/they','Any pronouns','Name only'],
 nationality:['American','Argentine','Australian','Austrian','Bangladeshi','Belgian','Brazilian','British','Canadian','Chilean','Chinese','Colombian','Cuban','Danish','Dominican','Dutch','Egyptian','Ethiopian','Filipino','Finnish','French','German','Ghanaian','Greek','Haitian','Indian','Indonesian','Iranian','Iraqi','Irish','Israeli','Italian','Jamaican','Japanese','Kenyan','Korean','Lebanese','Malaysian','Mexican','Moroccan','Nepali','New Zealander','Nigerian','Norwegian','Pakistani','Palestinian','Peruvian','Polish','Portuguese','Puerto Rican','Romanian','Russian','Saudi','Scottish','Senegalese','Singaporean','Somali','South African','Spanish','Sri Lankan','Swedish','Swiss','Syrian','Taiwanese','Thai','Turkish','Ukrainian','Venezuelan','Vietnamese','Welsh','Stateless'],
 languages:['English','Spanish','French','Arabic','Mandarin','Cantonese','Hindi','Urdu','Bengali','Portuguese','Russian','German','Italian','Japanese','Korean','Vietnamese','Turkish','Persian','Swahili','Indonesian','Tagalog','Thai','Tamil','Punjabi','Polish','Ukrainian','Dutch','Greek','Hebrew','Haitian Creole','Yoruba','American Sign Language','British Sign Language'],
 build:['Slim','Average','Athletic','Muscular','Stocky','Broad','Heavyset','Petite','Lean'],
 eyeColor:['Brown','Dark brown','Blue','Green','Hazel','Gray','Amber','Heterochromia'],
 hairColor:['Black','Dark brown','Brown','Light brown','Blond','Red','Auburn','Gray','White','Salt-and-pepper','Dyed','Bald'],
 hairStyle:['Shaved','Buzz cut','Short','Medium length','Long','Straight','Wavy','Curly','Coily','Afro','Braids','Locs','Ponytail','Bun','Bald'],
 skinTone:['Very light','Light','Medium','Tan','Brown','Dark brown','Deep'],
 distinguishingMarks:['None','Freckles','Birthmark','Scar','Tattoo','Piercing'],
 health:['No known conditions','Chronic illness','Chronic pain','Mobility disability','Uses a wheelchair','Uses a walking aid','Deaf / hard of hearing','Blind / low vision','Neurodivergent','Mental health condition','Recovering from illness or injury'],
 education:['No formal schooling','Primary school','Secondary school','Trade school','Apprenticeship','Some college','Associate degree','Bachelor’s degree','Master’s degree','Doctorate','Professional degree','Self-taught'],
 faith:['None','Atheist','Agnostic','Secular humanist','Christian','Muslim','Jewish','Hindu','Buddhist','Sikh','Jain','Bahá’í','Spiritual','Indigenous / traditional beliefs']
};
export const multiChoiceFields=['roles','nationality','languages','hairStyle','distinguishingMarks','health','faith'];
export const humanFields=humanFieldGroups.flatMap(g=>g.fields);
export const templateSections = [
  {id:'identity', title:'Identity', fields:[['firstName','First name','input'],['middleName','Middle name','input'],['lastName','Last name','input'],['title','Known as / epithet','input'],['roles','Occupations','choice'],['factionId','Faction','faction'],['storyRole','Story role','select'],['alignment','Moral alignment','select'],...humanFields]},
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
