const characters={
 id:'characters-directory',title:'Characters',singular:'character',plural:'characters',
 eyebrow:'PEOPLE & RELATIONSHIPS',description:'Every story begins with someone.',
 metaDescription:'Explore the characters, biographies, attributes, tendencies, and relationships in your novel.',
 script:'/characters/characters.js?v=directory-shell-1',
 styles:['/components/character-card/card.css?v=2','/components/character-card/details.css?v=1'],
 searchPlaceholder:'Search names, traits, relationships…',
 leadingAction:{id:'character-archive',label:'Archive',icon:'archive',disabled:true,title:'Character archive is coming soon',description:'Character archive is not available yet.'},
 primaryAction:{id:'new-character',label:'New character',icon:'+'},
 sorts:[{value:'order',label:'List order'},{value:'name',label:'Alphabetical'},{value:'provider',label:'Provider'}],
 empty:{title:'No characters yet',description:'Create a character to begin your cast.'},
 noResults:{title:'No characters found',description:'Try a name, a trait, or a relationship.'}
};

const factions={
 id:'factions-directory',title:'Factions',singular:'faction',plural:'factions',
 eyebrow:'FAMILIES & ALLIANCES',description:'The groups that shape your world.',
 metaDescription:'Explore the factions, histories, beliefs, members, and alliances in your novel.',
 script:'/factions/factions.js?v=directory-shell-1',styles:['/factions/factions.css?v=1'],
 searchPlaceholder:'Search names, purpose, beliefs…',
 primaryAction:{id:'new-faction',label:'New faction',icon:'+'},
 views:[{value:'list',label:'List'}],
 sorts:[{value:'order',label:'List order'},{value:'name',label:'Alphabetical'},{value:'type',label:'Type'}],
 empty:{title:'No factions yet',description:'Create a faction to begin shaping your world.'},
 noResults:{title:'No factions found',description:'Try a name, a purpose, or a belief.'}
};
const locations={
 id:'locations-directory',title:'Locations',singular:'location',plural:'locations',
 eyebrow:'PLACES & GEOGRAPHY',description:'Build your world, from galaxies and planets to continents, cities, and landmarks.',
 metaDescription:'Explore the galaxies, planets, continents, countries, cities, and landmarks in your novel.',
 script:'/locations/locations.js?v=directory-shell-1',styles:['/locations/locations.css?v=directory-shell-1'],
 searchPlaceholder:'Search places or their surrounding areas…',
 primaryAction:{id:'new-location',label:'New location',icon:'+',disabled:true},
 views:[{value:'list',label:'List'}],
 sorts:[{value:'order',label:'List order'},{value:'name',label:'Alphabetical'},{value:'type',label:'Location type'}],
 empty:{title:'No locations yet',description:'Create a location to begin building your world.'},
 noResults:{title:'No locations found',description:'Try a place name, location type, or parent location.'},
 slots:{
  filters:'<div class="type-filters" role="group" aria-label="Filter location types"><button type="button" data-type="" aria-pressed="true">All locations</button></div>',
  dialogs:`<dialog id="new-location-dialog" aria-labelledby="dialog-title"><form id="new-location-form"><h2 id="dialog-title">New location</h2><p class="dialog-hint">Place it in your world.</p><fieldset id="location-fields"><label for="location-type">Type</label><select id="location-type" name="type"></select><div id="area-type-field" hidden><label for="area-type">Area type</label><select id="area-type" name="areaType"><option value="Borough">Borough</option><option value="District">District</option><option value="Neighborhood">Neighborhood</option><option value="Ward">Ward</option><option value="Other">Other</option></select></div><label for="location-name">Name</label><input id="location-name" name="name" maxlength="160" autocomplete="off" required><div id="parent-field" hidden><label id="parent-label" for="location-parent">Country</label><select id="location-parent" name="parentId"></select><p id="parent-hint" class="dialog-hint"></p></div></fieldset><p id="create-error" role="alert" hidden></p><div class="dialog-actions"><button id="cancel-location" type="button">Cancel</button><button id="save-location" class="directory-action directory-primary-action" type="submit">Add location</button></div></form></dialog>`
 }
};
export const directoryPages=new Map([
 ['/characters/',characters],['/characters/index.html',characters],
 ['/factions/',factions],['/factions/index.html',factions],
 ['/locations/',locations],['/locations/index.html',locations]
]);
