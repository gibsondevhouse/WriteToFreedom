import {escape,createFieldRenderer,renderSection,renderInfoGroup,renderProfileName,renderProfilePage} from './profile-components.js';
import {arcTypes,arcStatuses,arcBeats,pacingMetrics,storyArcSections} from '../public/story-arcs/template.js';

const targetKey=target=>target.kind+':'+target.id;
function pacingChart(record,prefix='pacing'){ 
 const width=700,height=190,left=34,right=18,top=20,bottom=34,step=(width-left-right)/(arcBeats.length-1),y=value=>top+(99-value)*(height-top-bottom)/99;
 const lines=pacingMetrics.map(([metric,label])=>{const points=arcBeats.map((beat,i)=>`${left+i*step},${y(record.pacing[beat.id][metric])}`).join(' ');return `<polyline class="pacing-line metric-${metric}" data-graph-line="${metric}" points="${points}"/><g data-graph-points="${metric}">${arcBeats.map((beat,i)=>`<circle class="pacing-point metric-${metric}" data-beat="${beat.id}" cx="${left+i*step}" cy="${y(record.pacing[beat.id][metric])}" r="4"><title>${escape(beat.title)} · ${escape(label)} ${record.pacing[beat.id][metric]}</title></circle>`).join('')}</g>`;}).join('');
 const labels=arcBeats.map((beat,i)=>`<text x="${left+i*step}" y="177" text-anchor="middle">${escape(beat.title.replace('Inciting incident','Inciting').replace('Rising action','Rising').replace('Falling action','Falling'))}</text>`).join('');
 return `<div class="pacing-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${prefix}-chart-title ${prefix}-chart-description"><title id="${prefix}-chart-title">Story arc pacing</title><desc id="${prefix}-chart-description">Three lines show tension, pace, and action from exposition through resolution.</desc><g class="pacing-grid"><line x1="${left}" y1="${y(99)}" x2="${width-right}" y2="${y(99)}"/><line x1="${left}" y1="${y(50)}" x2="${width-right}" y2="${y(50)}"/><line x1="${left}" y1="${y(0)}" x2="${width-right}" y2="${y(0)}"/></g>${lines}<g class="pacing-labels">${labels}</g></svg><div class="pacing-legend">${pacingMetrics.map(([metric,label])=>`<span class="metric-${metric}"><i></i>${escape(label)}</span>`).join('')}</div></div>`;
}
function pacingGraph(record){
 return `<section id="pacing" class="profile-section arc-pacing"><div class="section-header"><h2><button type="button" class="section-toggle" aria-expanded="true" aria-controls="pacing-body">Pacing timeline</button></h2></div><div id="pacing-body" class="collapsible-region"><p class="section-note">This overview updates as you shape each narrative beat below.</p>${pacingChart(record)}</div></section>`;
}
function pacingControls(record,beat){
 return `<fieldset class="pacing-beat"><legend>Pacing</legend>${pacingMetrics.map(([metric,label])=>`<label><span>${escape(label)}</span><input class="metric-${metric}" style="--pacing-value:${record.pacing[beat.id][metric]}%" type="range" min="0" max="99" step="1" value="${record.pacing[beat.id][metric]}" data-pacing-beat="${beat.id}" data-pacing-metric="${metric}" aria-label="${escape(beat.title)} ${escape(label.toLowerCase())}"><output>${record.pacing[beat.id][metric]}</output></label>`).join('')}</fieldset>`;
}
export function renderStoryArc(record,targets,otherArcs){
 const options=key=>key==='arcType'?arcTypes.map(value=>[value,value]):key==='status'?arcStatuses.map(value=>[value,value]):null,field=createFieldRenderer(record,{required:['name'],options});
 const entityLinks=record.keyEntities.map(reference=>targets.find(target=>targetKey(target)===targetKey(reference))).filter(Boolean),groups=new Map();for(const target of targets){if(!groups.has(target.group))groups.set(target.group,[]);groups.get(target.group).push(target);}
 const entityPicker=`<div id="arc-entity-picker" class="arc-entity-picker"><div id="key-entity-values" class="key-entity-values" aria-label="Selected key entities"></div><label class="sr-only" for="key-entity-select">Add a key entity</label><select id="key-entity-select"><option value="">Add a key entity…</option>${Array.from(groups,([group,items])=>`<optgroup label="${escape(group)}">${items.map(target=>`<option value="${escape(targetKey(target))}">${escape(target.label)}</option>`).join('')}</optgroup>`).join('')}</select></div><noscript><ul>${entityLinks.map(target=>`<li><a href="${escape(target.href)}">${escape(target.label)}</a></li>`).join('')}</ul></noscript>`;
 const infobox=renderProfileName(record,'story arc')+`<p class="arc-type-label">${escape(record.arcType)}</p>`+
  renderInfoGroup('Arc logistics','arc-logistics',[['name','Arc title','input'],['arcType','Arc type','select'],['status','Drafting status','select']].map(field).join(''))+
  renderInfoGroup('Timeline scope','arc-timeline',[['startDate','Start date','date'],['endDate','End date','date']].map(field).join(''))+
  renderInfoGroup('Key entities','arc-key-entities',`<p class="infobox-help">Characters, factions, and locations central to this storyline.</p>${entityPicker}`)+
  `<section id="sticky-pacing" class="sticky-pacing" aria-label="Pacing overview" hidden><h3>Pacing</h3>${pacingChart(record,'sticky-pacing')}</section>`;
 const sections=new Map(storyArcSections.map(section=>[section.id,section]));
 const render=id=>{const section=sections.get(id);return renderSection(section,section.fields.map(field).join(''),record);};
 const renderBeat=beat=>{const section=sections.get(beat.id);return renderSection(section,section.fields.map(field).join('')+pacingControls(record,beat),record);};
 const connected=renderSection({id:'connected-subplots',title:'Connected subplots',fields:[]},`<div id="connected-arc-list" class="connected-arc-list"></div><button type="button" id="add-connected-arc" class="quiet-button"${otherArcs.length?'':' disabled'}>Add connected arc</button><p class="section-note">Link another storyline that intersects with this arc.</p>`,record);
 const scenes=renderSection({id:'key-scenes',title:'Key scenes',fields:[]},`<div id="key-scene-list" class="key-scene-list"></div><button type="button" id="add-key-scene" class="quiet-button">Add key scene</button><p class="section-note">Track the chapter and narrative beat where each pivotal scene appears.</p>`,record);
 const narrative=arcBeats.map(renderBeat).join('');
 const content=pacingGraph(record)+render('overview')+narrative+render('stakes')+connected+scenes+render('questions');
 return renderProfilePage({record,type:'story-arc',collection:'Story Arcs',collectionUrl:'/story-arcs/',infobox,content,script:'/story-arcs/profile.js',styles:['/story-arcs/profile.css'],initial:{record,targets,otherArcs},boxClass:'story-arc-infobox'});
}
