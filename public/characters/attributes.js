export const attributeGroups = [
  {id:'physical', title:'Physical', fields:[['strength','Strength'],['speed','Speed'],['agility','Agility'],['endurance','Endurance']]},
  {id:'mind', title:'Mind', fields:[['intelligence','Intelligence'],['perception','Perception'],['willpower','Willpower'],['creativity','Creativity']]},
  {id:'presence', title:'Presence', fields:[['charisma','Charisma'],['empathy','Empathy'],['leadership','Leadership'],['deception','Deception']]},
];
export const attributeKeys = attributeGroups.flatMap(group=>group.fields.map(([key])=>key));
export function validateRatings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Attributes must be a set of ratings.');
  const result = {};
  for (const [key,rating] of Object.entries(value)) {
    if (!attributeKeys.includes(key) || !Number.isInteger(rating) || rating < 0 || rating > 99) throw new Error('Use whole-number attribute ratings from 0 to 99.');
    result[key] = rating;
  }
  return result;
}
export const moralityIcons = {'Good':'✧','Mostly good':'✦','Neutral':'⚖','Morally gray':'◐','Mostly evil':'◒','Evil':'◆','Changing':'↝','Undecided':'?'};
