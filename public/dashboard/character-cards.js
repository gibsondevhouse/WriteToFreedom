// Compatibility entry point for older dashboard documents.
import {createCharacterCard as sharedCard} from '../components/character-card/card.js';
export const createCharacterCard=(record,tone)=>sharedCard(record,{tone});
