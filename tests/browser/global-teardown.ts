import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename,dirname,resolve} from 'node:path';

export default async function cleanupBrowserDatabase(){
 const directory=process.env.WTF_BROWSER_TEST_DIRECTORY;
 if(directory&&dirname(resolve(directory))===resolve(tmpdir())&&basename(directory).startsWith('wtf-browser-')){
  await rm(directory,{recursive:true,force:true});
 }
}
