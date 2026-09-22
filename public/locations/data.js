export const locationTypes=['universe','galaxy','solar-system','planet','moon','continent','country','city','area','landmark'];
export const typeLabels={universe:'Universe',galaxy:'Galaxy','solar-system':'Solar system',planet:'Planet',moon:'Moon',continent:'Continent',country:'Country',city:'City',area:'Area',landmark:'Landmark'};
export const typePlurals={universe:'Universes',galaxy:'Galaxies','solar-system':'Solar systems',planet:'Planets',moon:'Moons',continent:'Continents',country:'Countries',city:'Cities',area:'Areas',landmark:'Landmarks'};
export const parentTypes={universe:[],galaxy:['universe'],'solar-system':['galaxy'],planet:['solar-system'],moon:['planet'],continent:['planet','moon'],country:['continent','planet','moon'],city:['country'],area:['city','area'],landmark:['city','area']};
export const requiresParent=type=>['city','area','landmark'].includes(type);
export const seedLocations=[
 {id:'sample-kingdom',name:'The Fractured Kingdom',type:'country',parentId:null},
 {id:'sample-capital',name:'The Capital',type:'city',parentId:'sample-kingdom'},
 {id:'sample-royal-archive',name:'Royal Archive',type:'landmark',parentId:'sample-capital'},
 {id:'sample-river-workshops',name:'River Workshops',type:'landmark',parentId:'sample-capital'},
 {id:'sample-buried-city',name:'Buried City Ruins',type:'landmark',parentId:'sample-capital'}
];
export const areaTypes=['Borough','District','Neighborhood','Ward','Other'];
export function ancestors(location,records){
 const byId=new Map(records.map(r=>[r.id,r])),seen=new Set([location.id]),path=[];
 let parent=byId.get(location.parentId);
 while(parent&&!seen.has(parent.id)){seen.add(parent.id);path.unshift(parent);parent=byId.get(parent.parentId);}
 return path;
}
export function parentChoices(type,records,id){
 return records.filter(r=>(parentTypes[type]||[]).includes(r.type)&&r.id!==id&&!ancestors(r,records).some(a=>a.id===id));
}
export function selectLocations(records,query='',type='',sort='order',reverse=false){
 const needle=query.trim().toLocaleLowerCase();
 const matches=records.filter(r=>(!type||r.type===type)&&[r.name,typeLabels[r.type],r.areaType||'',...ancestors(r,records).map(p=>p.name)].join(' ').toLocaleLowerCase().includes(needle));
 if(sort==='name')matches.sort((a,b)=>a.name.localeCompare(b.name));
 if(sort==='type')matches.sort((a,b)=>locationTypes.indexOf(a.type)-locationTypes.indexOf(b.type)||a.name.localeCompare(b.name));
 return reverse?matches.reverse():matches;
}
