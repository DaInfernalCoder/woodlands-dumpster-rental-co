import {createHmac,randomUUID} from 'node:crypto';
import {parse} from 'node:querystring';
const DOMAIN='woodlandsdumpsterental.shop';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const json=String(req.headers.accept||'').includes('application/json');
 const reply=(code,value)=>json?res.status(code).json(value):res.status(code).send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rental request</title><main><h1>${value.success?'Request received':'Request could not be sent'}</h1><p>${value.success?'Your reference is '+value.reference+'. We will contact you to confirm availability and rental terms. No rental is confirmed yet.':'Please return to the form and check your details, or call the business.'}</p><a href="/booking">Return to booking</a></main></html>`);
 if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(405,{error:'method_not_allowed'});}
 if(!process.env.BOOKING_SECRET)return reply(503,{error:'temporarily_unavailable'});
 try{const o=new URL(req.headers.origin);if(o.protocol!=='https:'||o.hostname!==DOMAIN||new URL('https://'+req.headers.host).hostname!==DOMAIN)return reply(403,{error:'invalid_origin'});}catch{return reply(403,{error:'invalid_origin'});}
 const data=typeof req.body==='string'?parse(req.body):req.body;
 if(!data||typeof data!=='object'||Array.isArray(data)||Buffer.byteLength(JSON.stringify(data))>14000)return reply(400,{error:'invalid_fields'});
 if(data._honey)return reply(400,{error:'invalid_fields'});
 const payload={...data,domain:DOMAIN,consent:[true,'on','true'].includes(data.consent),request_id:data.request_id||randomUUID()};
 const body=JSON.stringify(payload),timestamp=String(Math.floor(Date.now()/1000));
 const signature=createHmac('sha256',process.env.BOOKING_SECRET).update(timestamp+'.'+body).digest('hex');
 try{
  const response=await fetch('https://intake.sellhvacbusiness.com/dumpster-bookings/requests',{method:'POST',headers:{'Content-Type':'application/json','X-Booking-Time':timestamp,'X-Booking-Signature':signature},body,signal:AbortSignal.timeout(18000)});
  const result=await response.json();return reply(response.status,result);
 }catch{return reply(503,{error:'temporarily_unavailable'});}
}
