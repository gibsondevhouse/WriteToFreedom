const group=(id,title,sectionId,fields)=>({id,title,sectionId,fields});
const dailyLife=[['costOfLiving','Cost of living'],['qualityOfLife','Quality of life'],['safety','Safety'],['accessibility','Accessibility']];
const environment=[['climate','Climate'],['habitability','Habitability'],['environmentalHealth','Environmental health'],['naturalBeauty','Natural beauty']];
const opportunity=[['opportunity','Opportunity'],['services','Services'],['infrastructure','Infrastructure'],['connectivity','Connectivity']];
const placeSignificance=[['culturalImportance','Cultural importance'],['strategicImportance','Strategic importance'],['mystery','Mystery'],['danger','Danger']];
const cosmicEnvironment=[['stability','Stability'],['habitability','Habitability'],['resources','Resources'],['naturalBeauty','Natural beauty']];
const cosmicAccess=[['accessibility','Accessibility'],['connectivity','Connectivity'],['travelSafety','Travel safety'],['settlementPotential','Settlement potential']];
const cosmicSignificance=[['scientificInterest','Scientific interest'],['strategicImportance','Strategic importance'],['mystery','Mystery'],['danger','Danger']];
const place=(sections)=>[
 group('daily-life','Daily life',sections[0],dailyLife),group('environment','Environment',sections[1],environment),
 group('opportunity','Opportunity & services',sections[2],opportunity),group('significance','Story & significance',sections[3],placeSignificance)
];
const cosmic=(sections)=>[
 group('environment','Environment',sections[0],cosmicEnvironment),group('access','Access & reach',sections[1],cosmicAccess),
 group('significance','Story & significance',sections[2],cosmicSignificance)
];

export const locationRatingGroups={
 universe:cosmic(['cosmology','travel','story']),galaxy:cosmic(['structure','travel','story']),'solar-system':cosmic(['structure','travel','story']),
 planet:cosmic(['environment','travel','story']),moon:cosmic(['environment','travel','story']),
 continent:place(['society','geography','economy','story']),country:place(['demographics','geography','economy','culture']),
 city:place(['culture','geography','infrastructure','culture']),area:place(['society','geography','infrastructure','story']),
 landmark:[
  group('condition','Condition & access','condition',[['condition','Condition'],['accessibility','Accessibility'],['safety','Safety'],['preservation','Preservation']]),
  group('significance','Value & significance','significance',[['culturalImportance','Cultural importance'],['historicImportance','Historic importance'],['visitorAppeal','Visitor appeal'],['strategicImportance','Strategic importance']]),
  group('story','Story potential','story',[['mystery','Mystery'],['danger','Danger'],['symbolicPower','Symbolic power'],['storyImpact','Story impact']])
 ]
};

export const factionRatingGroups=[
 group('power','Power & reach','powers',[['influence','Influence'],['resources','Resources'],['territorialReach','Territorial reach'],['force','Force']]),
 group('organization','Organization','organization',[['cohesion','Cohesion'],['stability','Stability'],['discipline','Discipline'],['adaptability','Adaptability']]),
 group('standing','Standing','relations',[['publicSupport','Public support'],['legitimacy','Legitimacy'],['secrecy','Secrecy'],['danger','Danger']])
];

const impact=[['physicalImpact','Physical impact'],['mentalImpact','Mental impact'],['socialImpact','Social impact'],['magicalImpact','Magical impact']];
const value=[['materialValue','Material value'],['culturalValue','Cultural value'],['strategicValue','Strategic value'],['rarity','Rarity']];
const use=[['usefulness','Usefulness'],['reliability','Reliability'],['durability','Durability'],['danger','Danger']];
export const loreRatingGroups={
 note:[group('record','Record quality','notes',[['clarity','Clarity'],['reliability','Reliability'],['relevance','Relevance'],['completeness','Completeness']])],
 artifact:[group('impact','Attribute impact','powers',impact),group('value','Value','object',value),group('use','Use & risk','powers',use)],
 relic:[group('impact','Attribute impact','powers',impact),group('value','Legacy & value','relic',[['sacredValue','Sacred value'],['authenticity','Authenticity'],['potency','Potency'],['rarity','Rarity']]),group('use','Use & risk','powers',use)],
 book:[group('impact','Knowledge impact','story',[['mentalImpact','Mental impact'],['socialImpact','Social impact'],['magicalImpact','Magical impact'],['storyImpact','Story impact']]),group('value','Knowledge & value','book',[['knowledgeValue','Knowledge value'],['reliability','Reliability'],['influence','Influence'],['rarity','Rarity']]),group('use','Use & risk','object',[['accessibility','Accessibility'],['completeness','Completeness'],['condition','Condition'],['danger','Danger']])],
 jewel:[group('impact','Attribute impact','powers',impact),group('value','Craft & value','jewel',[['materialValue','Material value'],['craftsmanship','Craftsmanship'],['symbolicValue','Symbolic value'],['rarity','Rarity']]),group('use','Use & risk','object',use)],
 species:[group('physical','Physiology','biology',[['strength','Strength'],['speed','Speed'],['resilience','Resilience'],['adaptability','Adaptability']]),group('mind','Mind & society','abilities',[['intelligence','Intelligence'],['communication','Communication'],['socialComplexity','Social complexity'],['technology','Technology']]),group('world','World presence','relationships',[['population','Population'],['ecologicalImpact','Ecological impact'],['rarity','Rarity'],['threat','Threat']])]
};

export function ratingGroupsFor(kind,type){
 if(kind==='location')return locationRatingGroups[type]||[];
 if(kind==='faction')return factionRatingGroups;
 if(kind==='lore')return loreRatingGroups[type]||[];
 return [];
}
export const ratingKeys=groups=>groups.flatMap(group=>group.fields.map(([key])=>key));
export function validateProfileRatings(value,groups){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Ratings must be a set of values.');
 const allowed=new Set(ratingKeys(groups)),result={};
 for(const [key,rating] of Object.entries(value)){
  if(!allowed.has(key)||!Number.isInteger(rating)||rating<0||rating>99)throw new Error('Use whole-number ratings from 0 to 99.');
  result[key]=rating;
 }
 return result;
}
