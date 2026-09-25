import assert from 'node:assert/strict';
import Ajv from 'ajv/dist/2020.js';
import {documentSchema} from '../../db/document-contracts.js';

const ajv=new Ajv({strict:true,strictTuples:false,allErrors:true});
const annotations=new Set();
function visit(value){
 if(!value||typeof value!=='object')return;
 for(const [key,item] of Object.entries(value)){if(key.startsWith('x-'))annotations.add(key);visit(item);}
}
visit(documentSchema);
for(const keyword of annotations)ajv.addKeyword({keyword,valid:true});
ajv.addSchema(documentSchema);

export const documentValidator=key=>ajv.getSchema(documentSchema.$id+'#/$defs/'+key);
export function assertDocumentSchema(key,document){
 const validate=documentValidator(key);assert.ok(validate,`Unknown document schema: ${key}`);
 assert.ok(validate(document),`${key}: ${ajv.errorsText(validate.errors,{separator:'; '})}`);
}
