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

profileChoices.officialLanguages=profileChoices.languages;
profileChoices.governmentType=['Republic','Federal republic','Parliamentary republic','Presidential republic','Constitutional monarchy','Absolute monarchy','Kingdom','Federation','Confederation','City-state','Theocracy','One-party state','Military government','Transitional government','Council government','Mayor–council','Council–manager','Commission government','Town meeting'];
multiChoiceFields.push('officialLanguages');
