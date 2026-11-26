(()=>{
 const form=document.querySelector('#rental-request'),notice=document.querySelector('#booking-status'),button=form.querySelector('button[type=submit]');
 const key=form.querySelector('[name=request_id]');key.value=crypto.randomUUID();
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const delivery=form.querySelector('[name=delivery_date]'),pickup=form.querySelector('[name=pickup_date]');delivery.min=today;pickup.min=today;
 delivery.addEventListener('change',()=>{pickup.min=delivery.value||today;});
 let busy=false;
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(busy||!form.reportValidity())return;
  if(pickup.value&&pickup.value<delivery.value){notice.textContent='Pickup must be on or after your delivery date.';pickup.focus();return;}
  busy=true;button.disabled=true;button.textContent='Sending request…';notice.textContent='';
  const data=Object.fromEntries(new FormData(form));data.consent=form.elements.consent.checked;
  try{
   const response=await fetch('/api/booking',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(25000)});
   const result=await response.json();
   if(!response.ok||!result.success)throw new Error('failed');
   notice.textContent='Request received. Your reference is '+result.reference+'. We will contact you to confirm availability, pricing and rental terms. Your rental is not confirmed yet.';
   form.querySelectorAll('input,select,textarea,button').forEach(x=>x.disabled=true);notice.focus();
  }catch{notice.textContent='We could not confirm receipt. Please retry with the same details, or call us for help.';button.disabled=false;button.textContent='Request dumpster rental';busy=false;}
 });
})();
