import {hiddenFieldNames} from '../profiles/schema.js?v=__WTF_ASSET_REVISION__';

export const arcTypes=['Main Plot','Character Arc','Romantic Subplot','Mystery Subplot','Political Subplot','Adventure Arc','Other'];
export const arcStatuses=['Outlining','Drafting','Revising','Completed'];
export const arcBeats=[
 {id:'exposition',title:'Exposition',questions:[
  ['exposition','What must the reader understand before this arc begins?'],
  ['expositionStatusQuo','What does normal life look like at this point?'],
  ['expositionPressure','What tension is already building beneath the surface?']
 ]},
 {id:'incitingIncident',title:'Inciting incident',questions:[
  ['incitingIncident','What event disrupts the status quo?'],
  ['incitingIncidentImpact','Why can the central characters no longer ignore it?'],
  ['incitingIncidentChoice','What immediate choice or commitment follows?']
 ]},
 {id:'risingAction',title:'Rising action',questions:[
  ['risingAction','What obstacles make the central conflict harder?'],
  ['risingActionEscalation','How do the characters’ choices escalate the situation?'],
  ['risingActionRevelation','What new information changes their understanding?']
 ]},
 {id:'climax',title:'Climax',questions:[
  ['climax','What decisive confrontation or choice occurs?'],
  ['climaxCost','What must the central characters risk or sacrifice?'],
  ['climaxAnswer','How does this moment answer the central dramatic question?']
 ]},
 {id:'fallingAction',title:'Falling action',questions:[
  ['fallingAction','What immediate consequences follow the climax?'],
  ['fallingActionResponse','How do the surviving characters respond?'],
  ['fallingActionLooseEnds','What remaining conflict still needs closure?']
 ]},
 {id:'resolution',title:'Resolution',questions:[
  ['resolution','What new status quo replaces the old one?'],
  ['resolutionChange','How have the characters or world changed?'],
  ['resolutionCarryForward','What promise, cost, or question carries forward?']
 ]}
];
export const pacingMetrics=[['tension','Tension'],['pace','Pace'],['action','Action']];
const field=(key,label,type='textarea',placeholder)=>[key,label,type,placeholder];
const answer=(key,label)=>field(key,label,'textarea','Write your answer…');
export const storyArcSections=[
 {id:'overview',title:'Overview',fields:[field('logline','Logline'),field('summary','Summary'),field('centralQuestion','Central dramatic question')]},
 ...arcBeats.map(beat=>({id:beat.id,title:beat.title,fields:beat.questions.map(([key,label])=>answer(key,label))})),
 {id:'stakes',title:'Stakes & consequences',fields:[
  answer('externalStakes','What can be lost in the world around the characters?'),
  answer('internalStakes','What can be lost within the central characters?'),
  answer('philosophicalStakes','What belief or value is being tested?'),
  answer('consequences','What happens if the central goal fails?')
 ]},
 {id:'questions',title:'Open questions',fields:[field('questions','Unresolved questions')]}
];
export const storyArcFields=['name','arcType','startDate','endDate','status',...storyArcSections.flatMap(section=>section.fields.map(([key])=>key))];
export const storyArcHideableFields=hiddenFieldNames(storyArcSections);
export const storyArcHref=record=>'/story-arcs/'+encodeURIComponent(record.id)+'/';

export function defaultPacing(){
 const tension=[18,42,66,96,58,24],pace=[24,54,74,92,56,30],action=[12,48,70,94,46,18];
 return Object.fromEntries(arcBeats.map((beat,index)=>[beat.id,{tension:tension[index],pace:pace[index],action:action[index]}]));
}
export function blankStoryArc(){
 return {...Object.fromEntries(storyArcFields.map(key=>[key,''])),arcType:'Main Plot',status:'Outlining',pacing:defaultPacing(),keyEntities:[],connectedArcIds:[],keyScenes:[],hiddenFields:[]};
}
