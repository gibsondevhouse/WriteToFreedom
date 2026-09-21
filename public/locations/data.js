export const locationTypes=['country','city','landmark'];
export const typeLabels={country:'Country',city:'City',landmark:'Landmark'};
export const seedLocations=[
 {id:'sample-kingdom',name:'The Fractured Kingdom',type:'country',parentId:null},
 {id:'sample-capital',name:'The Capital',type:'city',parentId:'sample-kingdom'},
 {id:'sample-royal-archive',name:'Royal Archive',type:'landmark',parentId:'sample-capital'},
 {id:'sample-river-workshops',name:'River Workshops',type:'landmark',parentId:'sample-capital'},
 {id:'sample-buried-city',name:'Buried City Ruins',type:'landmark',parentId:'sample-capital'}
];
export function ancestors(location,records){const parent=records.find(r=>r.id===location.parentId);if(!parent)return [];const country=parent.type==='city'?records.find(r=>r.id===parent.parentId):null;return country?[country,parent]:[parent];}
export function selectLocations(records,query='',type='',sort='order',reverse=false){
 const needle=query.trim().toLocaleLowerCase();
 const matches=records.filter(r=>(!type||r.type===type)&&[r.name,typeLabels[r.type],...ancestors(r,records).map(p=>p.name)].join(' ').toLocaleLowerCase().includes(needle));
 if(sort==='name')matches.sort((a,b)=>a.name.localeCompare(b.name));
 if(sort==='type')matches.sort((a,b)=>locationTypes.indexOf(a.type)-locationTypes.indexOf(b.type)||a.name.localeCompare(b.name));
 return reverse?matches.reverse():matches;
}
