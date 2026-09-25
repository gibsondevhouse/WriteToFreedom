/**
 * JSON document shapes inside the relational schema's document columns.
 * UI field definitions are imported, not recopied. Contextual reference checks,
 * compatibility normalization and aggregate limits remain in domain validators.
 */
import {templateSections,fieldNames,nameFields,hideableFields,humanChoices,storyRoles,alignments} from '../public/characters/template.js';
import {attributeGroups} from '../public/characters/attributes.js';
import {noteFields,noteTypes} from '../public/characters/notes.js';
import {multiChoiceFields,profileChoices} from '../public/profiles/choices.js';
import {factionSections,factionHideableFields,factionTypes,factionStatuses} from '../public/factions/template.js';
import {countrySections,countryHideableFields} from '../public/locations/countries/template.js';
import {citySections,cityHideableFields} from '../public/locations/cities/template.js';
import {locationTemplates} from '../public/locations/template.js';
import {parentTypes,requiresParent,areaTypes} from '../public/locations/data.js';
import {loreTemplates,loreTypes,allowedCollections,primaryCollection} from '../public/lore/template.js';
import {ratingGroupsFor} from '../public/profiles/ratings.js';
import {storyArcSections,storyArcHideableFields,arcTypes,arcStatuses,arcBeats,pacingMetrics} from '../public/story-arcs/template.js';
import {writingContentLimits} from '../public/writing/document.js';

const ref=name=>({$ref:'#/$defs/'+name});
const text=(maxLength=10000)=>({type:'string',maxLength});
const object=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const list=(items,maxItems,extra={})=>({type:'array',items,...(maxItems===undefined?{}:{maxItems}),...extra});
const rating={type:'integer',minimum:0,maximum:99};
const identity={type:'string',pattern:'^[a-zA-Z0-9-]{1,80}$'};
const uuid={type:'string',pattern:'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'};
const uuid4={...uuid,pattern:'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'};
const reference=(kind,extra={})=>({'x-reference':{kind,scope:'owner',...extra}});
const visibility=allowed=>({...list({type:'string',enum:allowed},allowed.length,{uniqueItems:true}),description:'Hidden field names. Their underlying content remains stored.'});
const ratings=groups=>({...object(Object.fromEntries(groups.flatMap(group=>group.fields.map(([key,title])=>[key,{...rating,title,'x-ui-section':group.sectionId,'x-ui-control':'rating'}])))),description:'Absent means unrated; zero is a recorded rating.'});
const selectionSchema=keys=>({...object(Object.fromEntries(keys.map(key=>[key,list({...text(),minLength:1,pattern:'\\S'},undefined,{uniqueItems:true})]))),description:'Exact ordered multi-select labels. Each matching scalar field is the legacy projection joined with " · ". Preserve arrays when labels contain punctuation. The joined field is limited to 10,000 UTF-16 code units.'});
const fields=sections=>Object.fromEntries(sections.flatMap(section=>section.fields.map(([key,title,control])=>{
 const field={...text(nameFields.includes(key)||key==='name'?160:control==='url'?2048:10000),title,'x-ui-control':control,'x-ui-section':section.id};
 if(control==='date')field.description='Author-entered story date. Precision, era, approximation, or custom calendar text are preserved; chronological interpretation is derived.';
 if(control==='url')field.description='Empty or an HTTPS URL without embedded credentials; URL parsing is enforced by the domain validator.';
 if(control==='choice')field['x-suggestions']=profileChoices[key]||[];
 if(['character','faction','location','country','city','world'].includes(control))Object.assign(field,reference(control==='character'||control==='faction'?control:'location',{...(control==='country'||control==='city'?{types:[control]}:{}),emptyAllowed:true}));
 return [key,field];
})));

export const documentSchemas={};
function register(key,title,table,properties,required,extra={}){
 documentSchemas[key]={...object(properties,required),title,'x-storage':{table,column:'document',schemaVersion:1,...extra}};
}

const characterFields=fields(templateSections);
characterFields.portraitUrl.maxLength=2048;
for(const [key,values] of Object.entries(humanChoices))characterFields[key].enum=['',...values];
characterFields.storyRole['x-current-options']=['',...storyRoles];
characterFields.alignment['x-current-options']=['',...alignments];
for(const key of ['storyRole','alignment'])characterFields[key].description='Current options apply to new values; unchanged legacy labels remain supported.';
for(const key of ['age','height','weight'])characterFields[key].description='Numeric text, including the author’s formatting. Empty means unrecorded. Compatibility validation uses JavaScript Number conversion and requires a finite nonnegative value; age must be a whole number. Text inputs retain accepted legacy notation without browser number-input sanitization. Height and weight use their corresponding unit field.';
register('character','Character','character_drafts',{
 ...characterFields,
 name:{...text(482),readOnly:true,description:'Derived from firstName, middleName, and lastName; retained for compatibility.'},
 affiliation:{...text(),description:'Resolved faction label when factionId is set; otherwise preserved legacy free text.'},
 sampleId:{type:'string',enum:['claude','gpt','deepseek','gemini'],readOnly:true},
 choiceSelections:selectionSchema(multiChoiceFields.filter(key=>fieldNames.includes(key))),
 nationalityContinents:{type:'object',maxProperties:100,additionalProperties:{...text(),...reference('location',{types:['continent']})},description:'Custom nationality label → continent ID; keys correspond to selected nationalities.'},
 attributeRatings:ratings(attributeGroups),
 hiddenFields:visibility(hideableFields),
 relationships:list(object({targetId:{...identity,...reference('character')},type:text(160),description:text()},['targetId','type','description']),100),
 notes:list(ref('characterNote'),100),
 cardConnection:{anyOf:[{type:'null'},ref('entityReference')],description:'Optional selected featured entity, independent of faction membership.'},
},[...fieldNames,'name','affiliation','attributeRatings','relationships','hiddenFields']);

const factionFields=fields(factionSections);
register('faction','Faction','faction_profiles',{
 ...factionFields,type:{...factionFields.type,enum:['',...factionTypes]},status:{...factionFields.status,enum:['',...factionStatuses]},hiddenFields:visibility(factionHideableFields),profileRatings:ratings(ratingGroupsFor('faction')),
},factionSections.flatMap(s=>s.fields.map(f=>f[0])));

for(const [type,sections,hideable] of [['country',countrySections,countryHideableFields],['city',citySections,cityHideableFields]]){
 const properties={...fields(sections),choiceSelections:selectionSchema(['officialLanguages']),hiddenFields:visibility(hideable),profileRatings:ratings(ratingGroupsFor('location',type))};
 properties.name={...properties.name,minLength:1,pattern:'\\S'};
 properties.parentId['x-reference']={kind:'location',scope:'owner',types:parentTypes[type],emptyAllowed:!requiresParent(type)};
 if(type==='city')properties.parentId.minLength=1;
 for(const key of ['capitalId','largestCityId'])if(properties[key])properties[key]['x-reference'].within='this country';
 register(type,type==='country'?'Country':'City',type+'_profiles',properties,sections.flatMap(s=>s.fields.map(f=>f[0])),{discriminator:{table:'locations',column:'type',value:type}});
}

for(const [type,template] of Object.entries(locationTemplates)){
 const properties={...fields(template.sections),parentId:{type:['string','null'],maxLength:10000,...reference('location',{types:parentTypes[type],emptyAllowed:!requiresParent(type)})},hiddenFields:visibility(template.hideableFields),profileRatings:ratings(ratingGroupsFor('location',type))};
 properties.name={...properties.name,minLength:1,pattern:'\\S'};
 if(requiresParent(type))properties.parentId={...properties.parentId,type:'string',minLength:1};
 if(type==='universe')properties.parentId={type:'null'};
 if(type==='area')properties.areaType.enum=areaTypes;
 register('location_'+type,type+' profile','location_details',properties,['name','parentId',...(type==='area'?['areaType']:[])],{discriminator:{table:'locations',column:'type',value:type},compatibility:'Creation/legacy basic edits may store only name, parentId, and areaType; full profile reads overlay empty defaults.'});
}

for(const [type,template] of Object.entries(loreTemplates)){
 const properties=fields(template.sections);properties.name={...properties.name,minLength:1,pattern:'\\S'};
 register('lore_'+type,loreTypes[type],'lore_entries',{
  ...properties,type:{const:type},
  collections:list({type:'string',enum:allowedCollections(type)},4,{uniqueItems:true,minItems:1,contains:{const:primaryCollection[type]}}),
  connections:list(object({target:ref('entityReference'),relationship:{...text(160),minLength:1,pattern:'\\S'}},['target','relationship']),60,{'x-unique-by':'target.kind + target.characterId + target.id'}),
  hiddenFields:visibility(template.hideableFields),profileRatings:ratings(ratingGroupsFor('lore',type)),
  pinned:{type:'boolean',title:'Pin to Continue building'},featured:{type:'boolean',title:'Feature on Lore'},
 },[...template.fields,'type','collections','connections','hiddenFields','profileRatings','pinned','featured'],{discriminator:{json:'type',value:type}});
}

const arcIdentity={id:'identity',fields:[['name','Title','input'],['arcType','Arc type','select'],['startDate','Start date','date'],['endDate','End date','date'],['status','Drafting status','select']]};
const arcFields=fields([arcIdentity,...storyArcSections]);
register('storyArc','Story arc','story_arcs',{
 ...arcFields,arcType:{...arcFields.arcType,enum:arcTypes},status:{...arcFields.status,enum:arcStatuses},
 hiddenFields:visibility(storyArcHideableFields),
 pacing:object(Object.fromEntries(arcBeats.map(beat=>[beat.id,{...object(Object.fromEntries(pacingMetrics.map(([key,title])=>[key,{...rating,title}])),pacingMetrics.map(([key])=>key)),title:beat.title}])),arcBeats.map(beat=>beat.id)),
 keyEntities:list(object({kind:{type:'string',enum:['character','faction','location']},id:{...identity,...reference('kind')}},['kind','id']),60,{uniqueItems:true}),
 connectedArcIds:list({...uuid,...reference('storyArc',{selfAllowed:false})},40,{uniqueItems:true}),
 keyScenes:list(object({id:{...identity,description:'UUID for new scenes; deterministic arc-scoped legacy IDs remain valid.'},title:{...text(160),minLength:1,pattern:'\\S'},chapter:{...text(),description:'Author-entered chapter label; not a manuscript chapter ID. Legacy long labels are retained.'},beat:{type:'string',enum:['',...arcBeats.map(beat=>beat.id)]},summary:text()},['id','title','chapter','beat','summary']),60,{'x-unique-by':'id','x-order':'author-defined array order'}),
},[...Object.keys(fields([arcIdentity,...storyArcSections])),'pacing','keyEntities','connectedArcIds','keyScenes','hiddenFields']);

const writingMetadata={title:{...text(160),minLength:1,pattern:'\\S',title:'Title'},summary:{...text(),title:'Summary'}};
register('chapter','Manuscript chapter','chapters',writingMetadata,['title','summary']);
register('scene','Manuscript scene','scenes',{
 ...writingMetadata,chapterId:{...uuid,...reference('chapter'),description:'Must equal scenes.chapter_id and refer to a chapter owned by the same author.'},
 status:{type:'string',enum:['draft','revising','complete']},contentSchemaVersion:{const:1},content:ref('writingContent'),
},['title','summary','chapterId','status','contentSchemaVersion','content']);

const entityReference={oneOf:[
 object({kind:{type:'string',enum:['character','location','faction','lore']},id:identity},['kind','id']),
 object({kind:{const:'note'},id:identity,characterId:{...identity,...reference('character')}},['kind','id','characterId']),
],description:'Owner-scoped discriminated reference. A note identity always includes its owning character.'};
const characterNote=object({
 id:uuid4,field:{type:'string',enum:noteFields},text:{...text(2000),minLength:1,pattern:'\\S'},
 position:{type:['integer','null'],minimum:0,description:'UTF-16 offset of the note’s numbered marker in its source field, or null when unplaced. Marker numbering derives from array order.'},
 title:text(120),type:{type:'string',enum:noteTypes},tags:list({...text(40),minLength:1},12,{uniqueItems:true}),
 links:list(ref('entityReference'),30,{uniqueItems:true}),
 content:list(object({text:{...text(2000),minLength:1},ref:ref('entityReference')},['text']),200),
},['id','field','text','position']);
characterNote.description='Ordered inline content concatenates to text (ignoring only outer whitespace). When content is present, links are derived from its references. Anchor, target existence, and aggregate length rules require domain validation.';

const writingMarks={anyOf:[
 list(object({type:{type:'string',enum:['bold','italic','strike','underline']}},['type']),4,{uniqueItems:true}),
 list(object({type:{const:'code'}},['type']),1,{minItems:1}),
]};
const writingInline={oneOf:[object({type:{const:'text'},text:{type:'string',minLength:1},marks:ref('writingMarks')},['type','text']),object({type:{const:'hardBreak'},marks:ref('writingMarks')},['type'])]};
const paragraph=object({type:{const:'paragraph'},content:list(ref('writingInline'))},['type']);
const listItem=object({type:{const:'listItem'},content:{type:'array',minItems:1,prefixItems:[ref('writingParagraph')],items:ref('writingBlock')}},['type','content']);
const writingBlock={oneOf:[
 ref('writingParagraph'),
 object({type:{const:'heading'},attrs:object({level:{type:'integer',minimum:1,maximum:3}},['level']),content:list(ref('writingInline'))},['type','attrs']),
 object({type:{const:'bulletList'},content:list(ref('writingListItem'),undefined,{minItems:1})},['type','content']),
 object({type:{const:'orderedList'},attrs:object({start:{type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER},type:{enum:[null,'1','a','A','i','I']}},['start','type']),content:list(ref('writingListItem'),undefined,{minItems:1})},['type','attrs','content']),
 object({type:{const:'blockquote'},content:list(ref('writingBlock'),undefined,{minItems:1})},['type','content']),
 object({type:{const:'horizontalRule'}},['type']),
]};

export const documentSchema={
 $schema:'https://json-schema.org/draft/2020-12/schema',
 $id:'urn:write-to-freedom:documents:1',
 title:'Write to Freedom persisted document contracts',
 description:'Select a document definition under $defs using its key. These schemas describe normalized JSON storage, not API request envelopes or database rows. Domain validators additionally enforce ownership, legacy compatibility, cross-field equality and aggregate UTF-16/byte limits. String maxLength is the portable code-point bound; runtime UTF-16 limits can be stricter.',
 'x-metadata':{id:'Immutable SQL identity (virtual sample IDs map to private storage).',ownerId:'Authenticated owner_id; never accepted from editable forms.',version:'SQL safe positive revision, distinct from schemaVersion. Version 0 exists only for virtual profiles.',schemaVersion:'SQL document format; currently 1.',createdAt:'UTC ISO timestamp on primary entity rows, when available.',updatedAt:'UTC ISO edit timestamp; null for old generic-location profiles with unknown historical edit time.'},
 $defs:{...documentSchemas,entityReference,characterNote,writingMarks,writingInline,writingParagraph:paragraph,writingListItem:listItem,writingBlock,writingContent:{...object({type:{const:'doc'},content:list(ref('writingBlock'),undefined,{minItems:1})},['type','content']),'x-aggregate-limits':writingContentLimits}},
};

/** Generated inventory links every declared UI field to its persisted JSON key. */
export function renderFieldInventory(){
 const lines=['# UI field storage inventory','','Generated by `npm run schema:documents` from UI templates and explicit nested contracts. Do not edit this file by hand.','','The `document` column contains these named JSON fields; SQL identity, ownership, versions and timestamps stay outside that JSON. See [the audit](ui-persistence.md) for save/reload coverage and transient UI state.',''];
 for(const [key,schema] of Object.entries(documentSchemas)){
  lines.push(`## ${schema.title} (${key})`,'',`Storage: \`${schema['x-storage'].table}.document\`.`, '', '| JSON path | UI label / meaning | Shape |', '| --- | --- | --- |');
  const walk=(properties,prefix='')=>{for(const [name,field] of Object.entries(properties)){
   const path=prefix+name,shape=field.$ref?field.$ref.split('/').at(-1):field.const!==undefined?JSON.stringify(field.const):Array.isArray(field.type)?field.type.join(' or '):field.type||'reference or null';
   lines.push(`| \`${path}\` | ${(field.title||field.description||name).replaceAll('|','\\|')} | ${shape} |`);
   if(field.properties)walk(field.properties,path+'.');
   if(field.items?.properties)walk(field.items.properties,path+'[].');
  }};
  walk(schema.properties);lines.push('');
 }
 lines.push('## Shared nested structures','','`characterNote`, `entityReference`, and recursive `writingContent` are defined fully under `$defs` in [documents.schema.json](../db/documents.schema.json). Their nested fields, limits, enums, and relationship discriminators are part of that schema.','');
 return lines.join('\n');
}
