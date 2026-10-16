import {execFile} from 'node:child_process';
import {createApp} from './server.mjs';
const port=Number(process.env.DESYGN_PORT||4317);
if(!Number.isInteger(port)||port<1||port>65535){console.error('DESYGN_PORT must be a number between 1 and 65535.');process.exitCode=1;}
else {
  const server=createApp();
  const url='http://127.0.0.1:'+port;
  server.once('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use. Close the existing server or choose another DESYGN_PORT.`:error.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>{
    console.log(`The Desygn Shop local review is ready: ${url}\nKeep this terminal open. Press Ctrl+C to stop.\nNo cloud deployment or external AI/payment service is enabled.`);
    if(process.platform==='win32')execFile('cmd.exe',['/d','/c','start','',url],{windowsHide:true},error=>{if(error)console.log('Open the local URL above in your browser.');});
  });
}
