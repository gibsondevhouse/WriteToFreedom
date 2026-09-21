const languages = [
 ['af','Afrikaans'],['sq','Shqip'],['ar','العربية'],['ast','Asturianu'],['az','Azərbaycanca'],['bg','Български'],['nan','閩南語 / Bân-lâm-gú'],['bn','বাংলা'],['be','Беларуская'],['ca','Català'],['cs','Čeština'],['cy','Cymraeg'],['da','Dansk'],['de','Deutsch'],['et','Eesti'],['el','Ελληνικά'],['en','English'],['es','Español'],['eo','Esperanto'],['eu','Euskara'],['fa','فارسی'],['fr','Français'],['gl','Galego'],['ko','한국어'],['ha','Hausa'],['hy','Հայերեն'],['hi','हिन्दी'],['hr','Hrvatski'],['id','Bahasa Indonesia'],['it','Italiano'],['he','עברית'],['ka','ქართული'],['lld','Ladin'],['la','Latina'],['lv','Latviešu'],['lt','Lietuvių'],['hu','Magyar'],['mk','Македонски'],['mg','Malagasy'],['mr','मराठी'],['arz','مصرى'],['ms','Bahasa Melayu'],['min','Bahaso Minangkabau'],['my','မြန်မာဘာသာ'],['nl','Nederlands'],['ja','日本語'],['no','Norsk (bokmål)'],['nn','Norsk (nynorsk)'],['ce','Нохчийн'],['uz','Oʻzbekcha / Ўзбекча'],['pl','Polski'],['pt','Português'],['kk','Қазақша / Qazaqşa'],['ro','Română'],['simple','Simple English'],['ceb','Sinugboanong Binisaya'],['sk','Slovenčina'],['sl','Slovenščina'],['sr','Српски / Srpski'],['sh','Srpskohrvatski'],['fi','Suomi'],['sv','Svenska'],['sw','Kiswahili'],['ta','தமிழ்'],['tt','Татарча / Tatarça'],['te','తెలుగు'],['th','ภาษาไทย'],['tg','Тоҷикӣ'],['azb','تۆرکجه'],['tr','Türkçe'],['uk','Українська'],['ur','اردو'],['vi','Tiếng Việt'],['war','Winaray'],['zh','中文'],['ru','Русский'],['yue','粵語']
];
const select = document.querySelector('#search-language');
const form = document.querySelector('.search');
const codeLabel = document.querySelector('#language-code');
const toggle = document.querySelector('#language-toggle');
const panel = document.querySelector('#all-languages');
const links = document.querySelector('.all-language-links');
for (const [code, label] of languages) {
 const option = document.createElement('option'); option.value = code; option.textContent = label; select.append(option);
 const link = document.createElement('a'); link.href = `https://${code}.wikipedia.org/`; link.lang = code; link.textContent = label; links.append(link);
}
select.value = 'en';
select.addEventListener('change', () => {codeLabel.textContent = select.value.toUpperCase(); form.action = `https://${select.value}.wikipedia.org/w/index.php`;});
form.addEventListener('submit', event => {const query = document.querySelector('#query'); if (!query.value.trim()) {event.preventDefault(); query.value = ''; query.reportValidity();}});
toggle.addEventListener('click', () => {const expanded = toggle.getAttribute('aria-expanded') === 'true'; toggle.setAttribute('aria-expanded', String(!expanded)); panel.hidden = expanded;});
panel.addEventListener('keydown', event => {if(event.key === 'Escape'){panel.hidden = true;toggle.setAttribute('aria-expanded','false');toggle.focus();}});
