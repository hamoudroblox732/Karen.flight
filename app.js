const CFG=window.KAREN_FLIGHT_CONFIG||{};
const authStorage={
 getItem(key){ return (localStorage.getItem("karen_passenger_remember_device")==="0"?sessionStorage:localStorage).getItem(key) },
 setItem(key,value){ return (localStorage.getItem("karen_passenger_remember_device")==="0"?sessionStorage:localStorage).setItem(key,value) },
 removeItem(key){ localStorage.removeItem(key);sessionStorage.removeItem(key) }
};
const sb=window.supabase?.createClient(CFG.supabaseUrl,CFG.supabaseKey,{auth:{storage:authStorage,persistSession:true,autoRefreshToken:true}});
const $=id=>document.getElementById(id), esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const msg=(id,t,bad=false)=>{const e=$(id);if(e){e.textContent=t;e.className="message show"+(bad?" error":"")}};
const empAlias=id=>{const normalized=String(id||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");if(normalized==="FO1176551")return "employee.fo117651@karenflight.invalid";return "employee."+normalized.toLowerCase()+"@karenflight.invalid"};
const paxAlias=u=>"passenger."+u.trim().toLowerCase()+"@karenflight.invalid";
const dateLabel=v=>{try{return new Intl.DateTimeFormat("ar-SA",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v))}catch{return v||"—"}};
const page=document.body.dataset.page;
async function getFlights(){const {data,error}=await sb.from("flights").select("*").in("status",["scheduled","boarding","delayed","in_progress"]).gte("departure_at",new Date(Date.now()-86400000).toISOString()).order("departure_at");if(error)throw error;const flights=data||[];if(!flights.length)return flights;const {data:availability,error:seatError}=await sb.from("flight_seat_availability").select("*").in("flight_id",flights.map(x=>x.id));if(seatError)throw seatError;const byId=new Map((availability||[]).map(x=>[x.flight_id,x]));return flights.map(f=>({...f,...(byId.get(f.id)||{})}))}
function card(f){const totalLeft=Number(f.seats_remaining??f.seats_total??0),economyLeft=Number(f.economy_remaining??f.seats_economy??0),full=economyLeft<=0||totalLeft<=0;return '<article class="flight-card"><div class="flight-top"><b class="flight-no en">'+esc(f.flight_number)+'</b><span class="status">'+(f.status==="boarding"?"الصعود متاح":f.status==="in_progress"?"الرحلة جارية":f.status==="delayed"?"متأخرة":"مجدولة")+'</span></div><div class="route"><div class="airport"><b>'+esc(f.origin_code)+'</b></div><div class="route-line">✈</div><div class="airport"><b>'+esc(f.destination_code)+'</b></div></div><div class="flight-bottom"><span class="flight-meta">'+dateLabel(f.departure_at)+'<br>'+esc(f.aircraft||"Karen")+'<br>المقاعد المتبقية: '+totalLeft+' / '+Number(f.seats_total||0)+'<br>الاقتصادي المتبقي: '+economyLeft+' / '+Number(f.seats_economy||0)+'</span>'+(full?'<span class="btn small" aria-disabled="true">مكتملة — لا توجد مقاعد</span>':'<a class="btn primary small" href="booking.html?flight='+encodeURIComponent(f.id)+'">احجز</a>')+'</div></article>'}
async function initFlights(){const box=$("flightList");try{const fs=await getFlights(),from=$("fromFilter"),to=$("toFilter");if(from)from.innerHTML='<option value="">كل المطارات</option>'+[...new Set(fs.map(x=>x.origin_code))].sort().map(x=>'<option>'+esc(x)+'</option>').join("");if(to)to.innerHTML='<option value="">كل الوجهات</option>'+[...new Set(fs.map(x=>x.destination_code))].sort().map(x=>'<option>'+esc(x)+'</option>').join("");const draw=()=>{const rows=fs.filter(x=>(!from?.value||x.origin_code===from.value)&&(!to?.value||x.destination_code===to.value)&&(!$("dateFilter")?.value||x.departure_at.slice(0,10)===$("dateFilter").value));box.innerHTML=rows.length?rows.map(card).join(""):'<div class="empty">ما فيه رحلات متاحة حالياً.</div>'};from?.addEventListener("change",draw);to?.addEventListener("change",draw);$("dateFilter")?.addEventListener("change",draw);draw()}catch{box.innerHTML='<div class="empty">تعذر تحميل الرحلات.</div>'}}
async function initRegister(){$("registerForm")?.addEventListener("submit",async e=>{e.preventDefault();const u=$("username").value.trim(),p=$("password").value;if(!/^[A-Za-z0-9_]{3,20}$/.test(u))return msg("formMessage","اسم Roblox غير صحيح.",true);const r=await fetch(CFG.supabaseUrl+"/functions/v1/passenger-register",{method:"POST",headers:{"Content-Type":"application/json","apikey":CFG.supabaseKey},body:JSON.stringify({username:u,password:p})}),o=await r.json().catch(()=>({}));if(!r.ok)return msg("formMessage",o.error||"تعذر إنشاء الحساب.",true);const {error}=await sb.auth.signInWithPassword({email:paxAlias(u),password:p});if(error)return msg("formMessage","تم إنشاء الحساب. سجل الدخول من صفحة الدخول.",true);location.href="passenger-account.html"})}
async function initPassengerLogin(){
 const remember=$("rememberPassengerDevice");
 $("loginForm")?.addEventListener("submit",async e=>{
  e.preventDefault();
  try{localStorage.setItem("karen_passenger_remember_device",remember?.checked?"1":"0")}catch{}
  const {error}=await sb.auth.signInWithPassword({email:paxAlias($("username").value),password:$("password").value});
  if(error)return msg("formMessage","اسم المستخدم أو كلمة المرور غير صحيحة.",true);
  location.href="passenger-account.html";
 });
}
async function initPassengerAccount(){
 const {data:s}=await sb.auth.getSession();if(!s.session)return location.replace("passenger-login.html");
 const {data:a}=await sb.from("passenger_accounts").select("user_id,roblox_username").eq("user_id",s.session.user.id).maybeSingle();
 if(!a){await sb.auth.signOut();return location.replace("passenger-login.html")}
 $("welcome").textContent="أهلاً "+a.roblox_username;
 const {data:rows,error}=await sb.from("bookings").select("id,flight_id,status,passenger_class,created_at,flight_number_snapshot,origin_code_snapshot,destination_code_snapshot,departure_at_snapshot,aircraft_snapshot,flight_status_snapshot,server_url_snapshot,passenger_visible_until,flights(flight_number,origin_code,destination_code,departure_at,aircraft,status,server_url,economy_link_approved,premium_link_approved)").eq("passenger_user_id",a.user_id).order("created_at",{ascending:false});
 const visibleRows=(rows||[]).filter(b=>!b.passenger_visible_until||new Date(b.passenger_visible_until).getTime()>Date.now());
 const nextExpiry=visibleRows.map(b=>b.passenger_visible_until?new Date(b.passenger_visible_until).getTime():Infinity).filter(t=>Number.isFinite(t)).sort((x,y)=>x-y)[0];
 if(Number.isFinite(nextExpiry))setTimeout(()=>location.reload(),Math.max(1000,nextExpiry-Date.now()+500));
 const cls={economy:"اقتصادي",business:"بزنس",first:"فرست كلاس"};
 const state={scheduled:"مجدولة",boarding:"صعود الركاب",delayed:"متأخرة",in_progress:"بدأت",stopped:"متوقفة",closed:"مغلقة",cancelled:"ملغاة",deleted:"محذوفة"};
 $("bookingHistory").innerHTML=error?"تعذر تحميل الحجوزات.":visibleRows.length?visibleRows.map(b=>{
  const f=b.flights||{},deleted=!b.flight_id&&!f.flight_number;
  const no=f.flight_number||b.flight_number_snapshot||"—",from=f.origin_code||b.origin_code_snapshot||"—",to=f.destination_code||b.destination_code_snapshot||"—",when=f.departure_at||b.departure_at_snapshot||b.created_at,status=deleted?"deleted":(f.status||b.flight_status_snapshot||"scheduled"),url=f.server_url||b.server_url_snapshot;
  const premium=["business","first"].includes(b.passenger_class||"economy");const economyReleased=!!f.economy_link_approved;const premiumReleased=!!f.premium_link_approved;const canEnter=!!url&&!deleted&&["boarding","in_progress"].includes(status)&&b.status==="approved"&&(premium?premiumReleased:economyReleased);
  return '<div class="flight-card"><b>'+esc(no)+'</b><p>'+esc(from)+' → '+esc(to)+'</p><p>'+dateLabel(when)+' · '+esc(f.aircraft||b.aircraft_snapshot||"—")+'</p><p>الفئة: '+cls[b.passenger_class||"economy"]+'</p><p>حالة الرحلة: '+(state[status]||esc(status))+'</p><span class="status">'+(b.status==="approved"?"الحجز مؤكد":b.status==="pending"?"قيد المراجعة":"مرفوض")+'</span>'+(canEnter?'<p><a class="btn primary small" target="_blank" rel="noopener" href="'+esc(url)+'">دخول سيرفر الرحلة</a></p>':(deleted?'<p>تم حذف الرحلة مع الاحتفاظ بتفاصيل حجزك.</p>':(status==="cancelled"||status==="closed"||status==="stopped"?'<p>الدخول غير متاح لهذه الرحلة حالياً.</p>':(status==="boarding"||status==="in_progress")&&!premium&&!economyReleased?'<p>الأولوية حالياً للبزنس والفرست كلاس. انتظر إتاحة دخول الاقتصادي.</p>':'<p>رابط السيرفر يظهر عند فتح صعود الركاب.</p>')) )+'</div>'
 }).join(""):"ما عندك حجوزات حالياً.";
 $("logout")?.addEventListener("click",async()=>{await sb.auth.signOut();location.href="index.html"});
}
async function initBooking(){
 const {data:s}=await sb.auth.getSession();
 if(!s.session){$("bookingGuard").classList.remove("hidden");$("bookingForm").classList.add("hidden");return}
 const {data:a}=await sb.from("passenger_accounts").select("user_id,roblox_username").eq("user_id",s.session.user.id).maybeSingle();
 if(!a){await sb.auth.signOut();$("bookingGuard").classList.remove("hidden");return}
 $("robloxName").value=a.roblox_username;
 const classNote=$("passengerClass");
 if(classNote){classNote.innerHTML='<option value="economy" selected>اقتصادي — مجاني</option>';classNote.disabled=true;}
 try{
  const fs=await getFlights();
  $("flightId").innerHTML='<option value="">اختر الرحلة</option>'+fs.filter(f=>["scheduled","boarding"].includes(f.status)).map(f=>{const left=Number(f.economy_remaining??f.seats_economy??0),full=left<=0||Number(f.seats_remaining??f.seats_total??0)<=0;return '<option value="'+esc(f.id)+'" '+(full?"disabled":"")+'">'+esc(f.flight_number)+' · '+esc(f.origin_code)+' → '+esc(f.destination_code)+' · '+dateLabel(f.departure_at)+' · '+(full?"مكتملة — لا توجد مقاعد":"المقاعد المتبقية "+left)+'</option>'}).join("");
  const id=new URLSearchParams(location.search).get("flight");if(id)$("flightId").value=id;
 }catch(err){console.error("Load booking flights:",err);msg("formMessage","تعذر تحميل الرحلات. حدّث الصفحة وحاول مرة ثانية.",true);}
 $("bookingForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const flightId=$("flightId").value;if(!flightId)return msg("formMessage","اختر الرحلة أولاً.",true);
  const {error}=await sb.from("bookings").insert({flight_id:flightId,roblox_username:a.roblox_username,passenger_name:$("passengerName").value.trim(),passenger_user_id:a.user_id,notes:$("notes").value.trim()||null,status:"approved"});
  if(error){console.error("Booking insert:",error);return msg("formMessage",error.message.includes("انتهت مقاعد")?"انتهت مقاعد الاقتصادي في هذه الرحلة.":error.message.includes("full")?"اكتملت مقاعد الرحلة.":"تعذر تأكيد الحجز: "+error.message,true);}
  msg("formMessage","تم تأكيد حجزك الاقتصادي المجاني بنجاح.");
  $("bookingForm").querySelector('button[type="submit"]').disabled=true;
 });
}
async function initEmployeeLogin(){
try{localStorage.setItem("karen_passenger_remember_device","1")}catch{}
const idInput=$("employeeId"),remember=$("rememberEmployee");
try{const saved=localStorage.getItem("karen_employee_id");if(saved&&idInput){idInput.value=saved;if(remember)remember.checked=true}}catch{}
if(remember)remember.addEventListener("change",()=>{try{if(remember.checked&&idInput.value.trim())localStorage.setItem("karen_employee_id",idInput.value.trim().toUpperCase());else localStorage.removeItem("karen_employee_id")}catch{}});
idInput?.addEventListener("input",()=>{if(remember?.checked){try{localStorage.setItem("karen_employee_id",idInput.value.trim().toUpperCase())}catch{}}});
const {data:existing}=await sb.auth.getSession();if(existing.session){const {data:current}=await sb.from("employees").select("employee_id").eq("user_id",existing.session.user.id).eq("active",true).maybeSingle();if(current)return location.replace("dashboard.html")}
$("employeeLoginForm")?.addEventListener("submit",async e=>{e.preventDefault();const id=idInput.value.trim().toUpperCase(),p=$("employeePassword").value;if(remember?.checked){try{localStorage.setItem("karen_employee_id",id)}catch{}}else{try{localStorage.removeItem("karen_employee_id")}catch{}}const {data:d,error}=await sb.auth.signInWithPassword({email:empAlias(id),password:p});if(error)return msg("loginMessage","المعرّف أو كلمة المرور غير صحيحة. تحقق من المعرّف وكلمة المرور وحاول مرة ثانية.",true);const {data:emp}=await sb.from("employees").select("*").eq("user_id",d.user.id).eq("employee_id",id).eq("active",true).maybeSingle();if(!emp){await sb.auth.signOut();return msg("loginMessage","الحساب غير مفعّل أو المعرّف غير مطابق.",true)}location.href="dashboard.html"});
}

async function initDashboard(){
 const {data:s}=await sb.auth.getSession();
 if(!s.session)return location.replace("employee-login.html");
 const {data:emp}=await sb.from("employees").select("*").eq("user_id",s.session.user.id).eq("active",true).maybeSingle();
 if(!emp){await sb.auth.signOut();return location.replace("employee-login.html")}
 window.currentEmployee=emp;
 const role=emp.role, uid=s.session.user.id;
 const owner=role==="owner", management=["management","admin"].includes(role), pilot=role==="pilot", atc=role==="atc";
 const crew=["co_pilot","cabin_crew","ground_staff","boarding_staff","atc"].includes(role);
 let allFlights=[], passengers=[];
 const roleInfo={
  pilot:{name:"Pilot · الطيار",about:"ينشئ طلب الرحلة ويقودها بعد اعتمادها من المالك والإدارة.",tasks:["إنشاء طلب رحلة وإرساله للمالك","بعد اعتماد المالك والإدارة يبدأ الرحلة أو يوقفها","متابعة الطاقم المرتبط برحلته"],access:"إدارة طلباته وبدء أو إيقاف رحلاته المعتمدة فقط."},
  co_pilot:{name:"Co-Pilot · مساعد الطيار",about:"ينضم إلى رحلة الطيار المحددة ويسانده في متابعة تفاصيلها.",tasks:["الانضمام إلى رحلة معتمدة يشغلها طيار","يوجد مساعد طيار واحد فقط لكل رحلة","عرض بيانات الرحلة والطاقم","الانسحاب من الرحلة"],access:"مساعد طيار واحد لكل رحلة."},
  cabin_crew:{name:"Cabin Crew · طاقم الضيافة",about:"ينضم إلى الرحلات لمتابعة معلومات الرحلة وقائمة المسافرين.",tasks:["الحد الأقصى 5 من طاقم الضيافة لكل رحلة","عرض بيانات الرحلة والمسار والموعد","متابعة قائمة المسافرين والحجوزات"],access:"خمسة أفراد كحد أقصى لكل رحلة."},
  ground_staff:{name:"Ground Crew · الطاقم الأرضي",about:"يتابع تجهيز الرحلات وإجراءات المسافرين قبل الصعود.",tasks:["الحد الأقصى 7 من الطاقم الأرضي لكل رحلة","عرض بيانات الرحلة والطاقم","متابعة قائمة المسافرين والحجوزات"],access:"سبعة أفراد كحد أقصى لكل رحلة."},
  boarding_staff:{name:"Boarding Agent · موظف البوردنق",about:"يتولى إجراءات المسافرين عند البوابة قبل صعودهم للطائرة.",tasks:["الانضمام إلى الرحلة المعتمدة كموظف بوردنق","عرض حجوزات المسافرين في الرحلات المنضم إليها فقط","تسجيل حضور المسافر عند البوابة","تأكيد صعود المسافر للطائرة عند فتح الصعود"],access:"مشاهدة حجوزات الرحلات التي انضم إليها وتحديث حالة الحضور والصعود فقط."},
  atc:{name:"ATC · مراقب البرج",about:"ينضم إلى الرحلة كمراقب برج ويتابع الطائرة والوجهة ويشاهد بيانات السرعة والارتفاع.",tasks:["الانضمام إلى رحلة معتمدة بمقعد برج واحد","دخول سيرفر الرحلة من الرابط المعتاد","متابعة نوع الطائرة والوجهة والسرعة والارتفاع"],access:"مراقبة الرحلة وعرض بياناتها دون تعديل السرعة أو الارتفاع."},
  management:{name:"Management · الإدارة",about:"تراجع طلبات الرحلات بعد موافقة المالك وتدير اعتماد التشغيل.",tasks:["مراجعة الرحلات التي اعتمدها المالك","اعتماد الرحلة للتشغيل أو رفضها","تحديد السرعة والارتفاع يدويًا أثناء الرحلة","متابعة الرحلات والحجوزات وإدارة حالاتها"],access:"اعتماد تشغيل الرحلات وإدارة الرحلات والحجوزات وتحديد بيانات الرحلة."},
  admin:{name:"Management · الإدارة",about:"تراجع طلبات الرحلات بعد موافقة المالك وتدير اعتماد التشغيل.",tasks:["مراجعة الرحلات التي اعتمدها المالك","اعتماد الرحلة للتشغيل أو رفضها","تحديد السرعة والارتفاع يدويًا أثناء الرحلة","متابعة الرحلات والحجوزات وإدارة حالاتها"],access:"اعتماد تشغيل الرحلات وإدارة الرحلات والحجوزات وتحديد بيانات الرحلة."},
  owner:{name:"Owner · المالك",about:"يراجع طلبات الطيارين ويمنح الموافقة الأولى قبل انتقالها للإدارة.",tasks:["مراجعة طلبات الرحلات والموافقة أو الرفض","تحديد السرعة والارتفاع يدويًا أثناء الرحلة","الإشراف على الرحلات والحجوزات","إنشاء حسابات الموظفين وتحديد وظائفهم"],access:"الموافقة الأولى على الرحلات وإدارة الموظفين والرحلات والحجوزات وبيانات الرحلة."}
 };
 const info=roleInfo[role]||{name:role,about:"موظف في Karen Flight.",tasks:[],access:"حسب الوظيفة."};
 $("dashUser").textContent=emp.roblox_username+" · "+info.name;
 const canSeeBookings=["owner","management","admin","ground_staff","cabin_crew","boarding_staff"].includes(role);
 const canChangeBookings=["owner","management","admin"].includes(role);
 const canSeeFlights=!atc;
 const canViewAudit=owner||management;
 const viewTitles={overview:"الرئيسية",flightsView:"إدارة الرحلات",towerView:"برج المراقبة",bookingsView:"الحجوزات",employeesView:"الموظفون",auditView:"سجل العمليات",settingsView:"الإعدادات"};
 const showView=id=>{
  document.querySelectorAll(".dash-view").forEach(v=>v.classList.toggle("active",v.id===id));
  document.querySelectorAll(".dash-nav").forEach(v=>v.classList.toggle("active",v.dataset.view===id));
  $("viewTitle").textContent=viewTitles[id]||"لوحة الإدارة";
  if(id==="auditView")loadAudit();
 };
 document.querySelectorAll(".dash-nav").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
 document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.go)));
 if(atc)showView("towerView");
 $("navBookings")?.classList.toggle("hidden",!canSeeBookings);
 $("navFlights")?.classList.toggle("hidden",atc);
 $("navTower")?.classList.toggle("hidden",!(atc||owner||management));
 $("navEmployees")?.classList.toggle("hidden",!owner);
 $("navAudit")?.classList.toggle("hidden",!canViewAudit);
 $("shortcutAudit")?.classList.toggle("hidden",!canViewAudit);
 $("navBookings")?.addEventListener("click",()=>{if(!canSeeBookings)showView("overview")});
 $("settingsLogout")?.addEventListener("click",async()=>{await sb.auth.signOut();location.href="index.html"});
 const auditLabels={flights:"رحلة",bookings:"حجز",employees:"موظف",insert:"إنشاء",update:"تعديل",delete:"حذف"};
 let auditRows=[];
 const auditSummary=row=>{
  const before=row.details?.before||{},after=row.details?.after||{};
  const keys=["flight_number","origin_code","destination_code","status","passenger_name","roblox_username","employee_id","role","active","passenger_class","server_url","current_speed_knots","current_altitude_ft"];
  const changes=keys.filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k])&&(before[k]!==undefined||after[k]!==undefined)).slice(0,4);
  if(!changes.length)return row.entity_id||"—";
  return changes.map(k=>k+": "+(before[k]===undefined?"—":String(before[k]))+" ← "+(after[k]===undefined?"—":String(after[k]))).join(" · ");
 };
 async function loadAudit(){
  if(!canViewAudit)return;
  $("auditRows").innerHTML='<tr><td colspan="6">جاري تحميل السجل...</td></tr>';
  const {data,error}=await sb.from("audit_logs").select("id,created_at,actor_name,actor_role,action,entity_type,entity_id,details").order("created_at",{ascending:false}).limit(200);
  if(error){$("auditRows").innerHTML='<tr><td colspan="6">تعذر تحميل سجل العمليات: '+esc(error.message)+'</td></tr>';return}
  auditRows=data||[];drawAudit();
 }
 function drawAudit(){
  const q=($("auditSearch")?.value||"").trim().toLowerCase(),type=$("auditType")?.value||"",action=$("auditAction")?.value||"";
  const rows=auditRows.filter(r=>(!type||r.entity_type===type)&&(!action||r.action===action)&&(!q||[r.actor_name,r.actor_role,r.entity_type,r.entity_id,r.action,JSON.stringify(r.details)].join(" ").toLowerCase().includes(q)));
  $("auditRows").innerHTML=rows.length?rows.map(r=>'<tr><td>'+dateLabel(r.created_at)+'</td><td>'+esc(r.actor_name||"System")+'</td><td>'+esc(roleInfo[r.actor_role]?.name||r.actor_role||"—")+'</td><td>'+esc(auditLabels[r.action]||r.action)+'</td><td>'+esc(auditLabels[r.entity_type]||r.entity_type)+' · '+esc(r.entity_id||"—")+'</td><td class="audit-details">'+esc(auditSummary(r))+'</td></tr>').join(""):'<tr><td colspan="6">ما فيه عمليات مطابقة.</td></tr>';
 }
 $("auditSearch")?.addEventListener("input",drawAudit);$("auditType")?.addEventListener("change",drawAudit);$("auditAction")?.addEventListener("change",drawAudit);
 $("auditRefresh")?.addEventListener("click",loadAudit);
 $("flightAdminPanel").classList.toggle("hidden",!(pilot||owner||management));
 $("employeePanel").classList.toggle("hidden",!owner);
 $("bookingsPanel")?.classList.toggle("hidden",!canSeeBookings);
 $("staffFlightsPanel")?.classList.toggle("hidden",!canSeeFlights);
 const form=$("flightForm");
 if(form){
  if(pilot){form.querySelector("button[type=submit]").textContent="إرسال طلب الرحلة للمالك";$("fStatus").value="scheduled";$("fStatus").closest(".field")?.classList.add("hidden")}
  else if(owner){form.querySelector("button[type=submit]").textContent="إنشاء رحلة معتمدة";$("fStatus").closest(".field")?.classList.remove("hidden")}
  else form.classList.add("hidden");
 }
 const flightPanel=$("flightAdminPanel");
 if(flightPanel){const heading=flightPanel.querySelector("h2");if(heading)heading.textContent=pilot?"طلباتي من الرحلات":owner?"مراجعة طلبات الطيارين وإدارة الرحلات":"اعتماد الرحلات ومتابعة التشغيل"}
 const bookingTitle=$("bookingsPanel")?.querySelector("h2");if(bookingTitle&&role==="cabin_crew")bookingTitle.textContent="قائمة المسافرين والحجوزات · عرض فقط";
 async function refresh(){
  const [{count:fc},{count:bc},{count:pc},{data:fs,error:fe},{data:bs},{data:es},{data:members},{data:passengerRows}]=await Promise.all([
   sb.from("flights").select("*",{count:"exact",head:true}),
   canSeeBookings?sb.from("bookings").select("*",{count:"exact",head:true}):Promise.resolve({count:null}),
   canSeeBookings?sb.from("bookings").select("*",{count:"exact",head:true}).eq("status","pending"):Promise.resolve({count:null}),
   sb.from("flights").select("*").order("created_at",{ascending:false}).limit(100),
   canSeeBookings?sb.from("bookings").select("*,flights(flight_number,origin_code,destination_code,status)").order("created_at",{ascending:false}).limit(100):Promise.resolve({data:[]}),
   owner?sb.from("employees").select("user_id,roblox_username,employee_id,role,active").order("created_at",{ascending:false}).limit(100):Promise.resolve({data:[]}),
   sb.from("flight_staff_members").select("flight_id,employee_user_id,role,roblox_username"),
   (owner||management)?sb.from("passenger_accounts").select("user_id,roblox_username").order("roblox_username"):Promise.resolve({data:[]})
  ]);
  if(fe)console.error(fe);
  $("statFlights").textContent=fc??"—";$("statBookings").textContent=bc??"—";$("statPending").textContent=pc??"—";
  allFlights=fs||[]; passengers=passengerRows||[];
  if($("premiumFlight"))$("premiumFlight").innerHTML='<option value="">اختر الرحلة</option>'+allFlights.filter(x=>x.status!=="cancelled").map(x=>'<option value="'+esc(x.id)+'">'+esc(x.flight_number)+' · '+esc(x.origin_code)+' → '+esc(x.destination_code)+'</option>').join("");
  if($("registeredPassengers"))$("registeredPassengers").innerHTML=passengers.map(x=>'<option value="'+esc(x.roblox_username)+'"></option>').join("");
  const crewRows=members||[];
  const roster=f=>{const rows=crewRows.filter(x=>x.flight_id===f.id);const count=r=>rows.filter(x=>x.role===r).length;return "Pilot: "+(f.pilot_user_id?"1/1":"0/1")+" · Co-Pilot: "+count("co_pilot")+"/1 · Ground Crew: "+count("ground_staff")+"/7 · Cabin Crew: "+count("cabin_crew")+"/5 · Boarding: "+count("boarding_staff")+" · ATC: "+count("atc")+"/1"+(rows.length?"<br>"+rows.map(x=>esc(x.roblox_username||x.role)).join("، "):"");};
  const statusName=f=>({scheduled:"مجدولة",boarding:"صعود الركاب",delayed:"متأخرة",in_progress:"بدأت",stopped:"متوقفة",closed:"مغلقة",cancelled:"ملغاة"}[f.status]||f.status);
   const metricEditor=f=>{
    if(!(owner||management)||f.status!=="in_progress"||!f.owner_approved||!f.management_approved)return "";
    return '<div class="tower-metrics-edit"><input type="number" min="0" max="1000" step="1" placeholder="السرعة kt" aria-label="السرعة بالعقدة" data-admin-speed-id="'+f.id+'" value="'+(f.current_speed_knots??"")+'"><input type="number" min="0" max="60000" step="1" placeholder="الارتفاع ft" aria-label="الارتفاع بالقدم" data-admin-altitude-id="'+f.id+'" value="'+(f.current_altitude_ft??"")+'"><button class="btn small" data-flight-action="save-metrics" data-id="'+f.id+'">حفظ السرعة والارتفاع</button></div>';
   };
  const statusEditor=f=>{
   if(!(owner||(management&&f.owner_approved)))return "";
   const options=[["scheduled","مجدولة"],["boarding","صعود الركاب"],["delayed","متأخرة"],["in_progress","بدأت"],["stopped","متوقفة"],["closed","مغلقة"],["cancelled","ملغاة"]];
   return '<div class="actions" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px"><select aria-label="تغيير حالة الرحلة" data-flight-status="'+f.id+'" style="max-width:145px">'+options.map(([v,l])=>'<option value="'+v+'" '+(f.status===v?'selected':'')+'>'+l+'</option>').join("")+'</select><button class="btn small" data-flight-action="set-status" data-id="'+f.id+'">حفظ الحالة</button></div>';
  };
  const flightActions=f=>{
   const actions=[];
   if(owner&&!f.owner_approved&&!f.management_approved)actions.push('<button class="btn small primary" data-flight-action="owner-approve" data-id="'+f.id+'">موافقة المالك</button><button class="btn small" data-flight-action="reject" data-id="'+f.id+'">رفض</button>');
    const canDeleteCancelled = f.status === "cancelled" && (owner || (management && f.cancelled_at && Date.now() - new Date(f.cancelled_at).getTime() >= 60 * 60 * 1000));
    if(canDeleteCancelled)actions.push('<button class="btn small" data-flight-action="delete" data-id="'+f.id+'" style="color:#c65b5b;border-color:#c65b5b">حذف الرحلة</button>');
   if(management&&f.owner_approved&&!f.management_approved)actions.push('<button class="btn small primary" data-flight-action="management-approve" data-id="'+f.id+'">اعتماد الإدارة</button><button class="btn small" data-flight-action="reject" data-id="'+f.id+'">رفض</button>');
   if((owner||management)&&f.owner_approved&&f.management_approved&&f.server_url&&!f.crew_link_approved)actions.push('<button class="btn small primary" data-flight-action="crew-release" data-id="'+f.id+'">إتاحة رابط الموظفين</button>');
   if((owner||management)&&f.owner_approved&&f.management_approved&&f.server_url&&["boarding","in_progress"].includes(f.status)&&!f.premium_link_approved)actions.push('<button class="btn small primary" data-flight-action="premium-release" data-id="'+f.id+'">إتاحة رابط البزنس والفرست</button>');if((owner||management)&&f.owner_approved&&f.management_approved&&f.server_url&&["boarding","in_progress"].includes(f.status)&&!f.economy_link_approved)actions.push('<button class="btn small primary" data-flight-action="economy-release" data-id="'+f.id+'">إتاحة رابط الاقتصادي</button>');
   if((owner||management||(pilot&&f.pilot_user_id===uid))&&f.status!=="cancelled")actions.push('<button class="btn small" data-flight-action="edit-link" data-id="'+f.id+'">تعديل رابط السيرفر</button>');
   if(pilot&&f.pilot_user_id===uid&&f.owner_approved&&f.management_approved){if(f.status==="in_progress")actions.push('<button class="btn small" data-flight-action="stop" data-id="'+f.id+'">إيقاف الرحلة</button>');else if(["scheduled","delayed"].includes(f.status))actions.push('<button class="btn small primary" data-flight-action="start" data-id="'+f.id+'">بدء الرحلة</button>')}
   const joinableStatuses=atc?["scheduled","boarding","delayed","in_progress"]:["scheduled","boarding","delayed"];
   if(crew&&f.owner_approved&&f.management_approved&&joinableStatuses.includes(f.status)){
    const mine=crewRows.find(x=>x.flight_id===f.id&&x.employee_user_id===uid);
    const occupiedCount=crewRows.filter(x=>x.flight_id===f.id&&x.role===role).length;
    const roleLimit=({ground_staff:7,cabin_crew:5,co_pilot:1,atc:1})[role]??null;
    const occupied=roleLimit!==null&&occupiedCount>=roleLimit;
    if(mine)actions.push('<button class="btn small" data-flight-action="leave" data-id="'+f.id+'">انسحاب</button>');
    else if(occupied)actions.push('<button class="btn small" disabled>'+(role==="ground_staff"?"اكتمل الطاقم الأرضي":role==="cabin_crew"?"اكتمل طاقم الضيافة":role==="co_pilot"?"مساعد الطيار مكتمل":"مقعد البرج محجوز")+' ('+occupiedCount+'/'+roleLimit+')</button>');
    else actions.push('<button class="btn small primary" data-flight-action="join" data-id="'+f.id+'">'+(atc?"حجز مقعد البرج":role==="boarding_staff"?"الانضمام إلى البوردنق":"انضمام للرحلة")+(roleLimit!==null?" ("+occupiedCount+"/"+roleLimit+")":"")+'</button>');
   }
   return actions.join(" ")||"—";
  };
  const relevant=pilot?allFlights.filter(f=>f.pilot_user_id===uid):allFlights;
  $("adminFlights").innerHTML=relevant.map(f=>'<tr><td>'+esc(f.flight_number)+'</td><td>'+esc(f.origin_code)+' → '+esc(f.destination_code)+'</td><td>'+dateLabel(f.departure_at)+'</td><td>'+statusName(f)+'<br><small>المالك: '+(f.owner_approved?"موافق":"بانتظار الموافقة")+' · الإدارة: '+(f.management_approved?"معتمدة":"بانتظار الاعتماد")+'</small>'+((owner||management)?'<br><small>السرعة: '+(f.current_speed_knots==null?"—":esc(f.current_speed_knots)+" kt")+' · الارتفاع: '+(f.current_altitude_ft==null?"—":esc(f.current_altitude_ft)+" ft")+'</small>':"")+metricEditor(f)+statusEditor(f)+'</td><td>'+flightActions(f)+'</td></tr>').join("")||'<tr><td colspan="5">ما فيه رحلات حالياً.</td></tr>';
  $("adminBookings").innerHTML=(bs||[]).map(b=>{
   const flightStatus=b.flights?.status||"";
   const boardingState=b.boarded_at?"تم الصعود":b.check_in_at?"تم تسجيل الحضور":"لم يسجل الحضور";
   const canProcessBoarding=role==="boarding_staff"&&b.status==="approved"&&["scheduled","boarding","in_progress"].includes(flightStatus);
   let boardingAction="—";
   if(canProcessBoarding&&!b.check_in_at)boardingAction='<button class="btn small primary" data-boarding-action="check-in" data-booking-id="'+b.id+'">تسجيل الحضور</button>';
   else if(canProcessBoarding&&b.check_in_at&&!b.boarded_at&&["boarding","in_progress"].includes(flightStatus))boardingAction='<button class="btn small primary" data-boarding-action="board" data-booking-id="'+b.id+'" data-check-in="'+esc(b.check_in_at)+'">تأكيد الصعود</button>';
   else if(canProcessBoarding&&b.boarded_at)boardingAction="تم الصعود";
   else if(canChangeBookings&&b.status!=="rejected")boardingAction='<button class="btn small" data-booking="'+b.id+'" data-status="rejected">رفض الحجز</button>';
   return '<tr><td>'+esc(b.passenger_name)+'</td><td>'+esc(b.roblox_username)+'</td><td>'+esc(b.flights?.flight_number||"—")+'</td><td>'+esc(b.status)+'</td><td>'+boardingState+'</td><td>'+boardingAction+'</td></tr>';
  }).join("");
  $("adminEmployees").innerHTML=(es||[]).map(x=>'<tr><td>'+esc(x.roblox_username)+'</td><td>'+esc(x.employee_id)+'</td><td>'+esc(roleInfo[x.role]?.name||x.role)+'</td><td>'+(x.active?"نشط":"موقوف")+'</td><td>'+(x.role!=="owner"&&x.user_id!==uid?'<button class="btn small" data-delete-employee="'+esc(x.user_id)+'" data-employee-name="'+esc(x.roblox_username)+'">حذف الهوية</button>':"—")+'</td></tr>').join("");
  $("staffFlights").innerHTML=allFlights.filter(f=>f.owner_approved&&f.management_approved&&["scheduled","boarding","delayed","in_progress"].includes(f.status)).map(f=>'<tr><td>'+esc(f.flight_number)+'</td><td>'+esc(f.origin_code)+' → '+esc(f.destination_code)+'</td><td>'+dateLabel(f.departure_at)+'</td><td>'+esc(f.aircraft||"—")+'<br><small>'+roster(f)+'</small></td><td>'+statusName(f)+(f.crew_link_approved&&f.server_url?'<br><a target="_blank" rel="noopener" href="'+esc(f.server_url)+'">دخول سيرفر الموظفين</a>':"")+'<br>'+flightActions(f)+'</td></tr>').join("")||'<tr><td colspan="5">ما فيه رحلات معتمدة حالياً.</td></tr>';
  const towerRows=allFlights.filter(f=>f.owner_approved&&f.management_approved&&["scheduled","boarding","delayed","in_progress"].includes(f.status));
  $("towerFlights").innerHTML=towerRows.map(f=>{
   const controller=crewRows.find(x=>x.flight_id===f.id&&x.role==="atc");
   const mine=controller&&controller.employee_user_id===uid;
   const joinable=["scheduled","boarding","delayed","in_progress"].includes(f.status);
   let action="—";
   if(atc&&mine){
     action=(f.crew_link_approved&&f.server_url?'<a class="btn small primary" target="_blank" rel="noopener" href="'+esc(f.server_url)+'">دخول سيرفر الرحلة</a>':'<small>رابط الموظفين لم يُتح بعد</small>')+' <button class="btn small" data-tower-action="leave" data-id="'+f.id+'">انسحاب</button>';
   }else if(atc&&!controller&&joinable){
    action='<button class="btn small primary" data-tower-action="join" data-id="'+f.id+'">حجز مقعد البرج</button>';
   }else if(atc&&controller){
    action='<small>مقعد البرج محجوز بواسطة '+esc(controller.roblox_username||"مراقب آخر")+'</small>';
   }
   const speed=f.current_speed_knots==null?"—":esc(f.current_speed_knots)+" kt";
   const altitude=f.current_altitude_ft==null?"—":esc(f.current_altitude_ft)+" ft";
   const destination=f.destination_name||f.destination_code||"—";
   return '<tr><td>'+esc(f.flight_number)+'</td><td>'+esc(f.aircraft||"—") +'</td><td>'+esc(destination)+'</td><td>'+speed+(f.flight_metrics_updated_at?'<br><small>'+dateLabel(f.flight_metrics_updated_at)+'</small>':"")+'</td><td>'+altitude+'</td><td>'+esc(controller?.roblox_username||"غير معيّن")+'</td><td>'+action+'</td></tr>';
  }).join("")||'<tr><td colspan="7">ما فيه رحلات نشطة معتمدة حالياً.</td></tr>';
 }
 $("refresh")?.addEventListener("click",refresh);
 $("refreshTower")?.addEventListener("click",refresh);
 $("adminFlights")?.addEventListener("click",async e=>{
  const b=e.target.closest("[data-flight-action]");if(!b)return;
  const id=b.dataset.id,action=b.dataset.flightAction;let result;
   if(action==="save-metrics"){
    if(!owner&&!management)return alert("تعديل السرعة والارتفاع متاح للمالك والإدارة فقط.");
    const speedRaw=document.querySelector('[data-admin-speed-id="'+id+'"]')?.value??"";
    const altitudeRaw=document.querySelector('[data-admin-altitude-id="'+id+'"]')?.value??"";
    if(speedRaw.trim()===""||altitudeRaw.trim()==="")return alert("أدخل السرعة والارتفاع أولاً.");
    const speed=Number(speedRaw),altitude=Number(altitudeRaw);
    if(!Number.isInteger(speed)||speed<0||speed>1000||!Number.isInteger(altitude)||altitude<0||altitude>60000)return alert("السرعة من 0 إلى 1000 عقدة والارتفاع من 0 إلى 60000 قدم.");
    const {data,error}=await sb.from("flights").update({current_speed_knots:speed,current_altitude_ft:altitude,flight_metrics_updated_at:new Date().toISOString()}).eq("id",id).eq("owner_approved",true).eq("management_approved",true).eq("status","in_progress").select("id").maybeSingle();
    if(error)return alert("تعذر حفظ البيانات: "+error.message);
    if(!data)return alert("لم يتم الحفظ. تأكد أن الرحلة معتمدة وحالتها بدأت.");
    await refresh();return;
   }
  if(action==="owner-approve")result=await sb.from("flights").update({owner_approved:true,owner_approved_by:uid,owner_approved_at:new Date().toISOString()}).eq("id",id);
  if(action==="management-approve")result=await sb.from("flights").update({management_approved:true,management_approved_by:uid,management_approved_at:new Date().toISOString()}).eq("id",id).eq("owner_approved",true);
  if(action==="crew-release"){if(!owner&&!management)return alert("غير مصرح");result=await sb.from("flights").update({crew_link_approved:true,crew_link_approved_at:new Date().toISOString()}).eq("id",id);}
  if(action==="premium-release"){if(!owner&&!management)return alert("غير مصرح");result=await sb.from("flights").update({premium_link_approved:true}).eq("id",id);}
  if(action==="economy-release"){if(!owner&&!management)return alert("غير مصرح");result=await sb.from("flights").update({economy_link_approved:true}).eq("id",id);}
  if(action==="edit-link"){const {data:f}=await sb.from("flights").select("server_url").eq("id",id).maybeSingle();const url=prompt("ضع رابط سيرفر الرحلة:",f?.server_url||"");if(url===null)return;if(url.trim()&&!/^https?:\/\//i.test(url.trim()))return alert("الرابط لازم يبدأ بـ https:// أو http://");result=await sb.from("flights").update({server_url:url.trim()||null,crew_link_approved:false,crew_link_approved_at:null,economy_link_approved:false,premium_link_approved:false}).eq("id",id);}
  if(action==="reject")result=await sb.from("flights").update({status:"cancelled"}).eq("id",id);
  if(action==="start")result=await sb.from("flights").update({status:"in_progress"}).eq("id",id);
  if(action==="stop")result=await sb.from("flights").update({status:"stopped"}).eq("id",id);
  if(action==="set-status"){const select=document.querySelector('[data-flight-status="'+id+'"]');if(!select)return;result=await sb.from("flights").update({status:select.value}).eq("id",id);}
   if(action==="delete"){
    if(!owner&&!management)return alert("حذف الرحلات متاح للمالك والإدارة فقط.");
    const {data:target,error:flightCheckError}=await sb.from("flights").select("status,cancelled_at").eq("id",id).maybeSingle();
    if(flightCheckError||!target)return alert("تعذر التحقق من الرحلة.");
    if(target.status!=="cancelled")return alert("لا يمكن حذف الرحلة إلا بعد تغيير حالتها إلى ملغاة.");
    if(management&&!owner&&(!target.cancelled_at||Date.now()-new Date(target.cancelled_at).getTime()<60*60*1000))return alert("لازم تمر ساعة كاملة على إلغاء الرحلة قبل أن تتمكن الإدارة من حذفها.");
    if(!confirm("متأكد من حذف الرحلة الملغاة نهائياً؟ ما تقدر تتراجع عن الحذف."))return;
    if(!confirm("تنبيه: سيتم حذف الرحلة الملغاة وجميع الحجوزات المرتبطة بها نهائياً. هل تريد المتابعة؟"))return;
    result=await sb.from("flights").delete().eq("id",id);
   }
  if(action==="join")result=await sb.from("flight_staff_members").insert({flight_id:id,employee_user_id:uid,role,roblox_username:emp.roblox_username});
  if(action==="leave")result=await sb.from("flight_staff_members").delete().eq("flight_id",id).eq("employee_user_id",uid);
  if(result?.error){alert("تعذر تنفيذ الإجراء: "+result.error.message);return}await refresh();
 });
 $("staffFlights")?.addEventListener("click",async e=>{
  const b=e.target.closest("[data-flight-action]");if(!b)return;
  const id=b.dataset.id,action=b.dataset.flightAction;let result;
  if(action==="join")result=await sb.from("flight_staff_members").insert({flight_id:id,employee_user_id:uid,role,roblox_username:emp.roblox_username});
  if(action==="leave")result=await sb.from("flight_staff_members").delete().eq("flight_id",id).eq("employee_user_id",uid);
  if(result?.error){alert("تعذر تنفيذ الإجراء: "+result.error.message);return}await refresh();
 });
 $("towerFlights")?.addEventListener("click",async e=>{
  const b=e.target.closest("[data-tower-action]");if(!b)return;
  const id=b.dataset.id,action=b.dataset.towerAction;let result;
  if(action==="join")result=await sb.from("flight_staff_members").insert({flight_id:id,employee_user_id:uid,role:"atc",roblox_username:emp.roblox_username});
  if(action==="leave")result=await sb.from("flight_staff_members").delete().eq("flight_id",id).eq("employee_user_id",uid).eq("role","atc");
  if(result?.error){alert("تعذر تنفيذ الإجراء: "+result.error.message);return}await refresh();
 });
  $("adminEmployees")?.addEventListener("click",async e=>{const b=e.target.closest("[data-delete-employee]");if(!b||!owner)return;const username=b.dataset.employeeName;if(!confirm("متأكد من حذف هوية الموظف "+username+"؟ سيتم حذف حساب دخوله وإزالته من قائمة الموظفين، ولا يمكن التراجع."))return;const r=await fetch(CFG.supabaseUrl+"/functions/v1/employee-delete",{method:"POST",headers:{"Content-Type":"application/json","apikey":CFG.supabaseKey,"Authorization":"Bearer "+s.session.access_token},body:JSON.stringify({userId:b.dataset.deleteEmployee})});const out=await r.json().catch(()=>({}));if(!r.ok)return alert(out.error||"تعذر حذف هوية الموظف.");alert("تم حذف هوية الموظف.");await refresh()});
const premiumPanel=$("premiumAssignPanel");
 if(premiumPanel){
  premiumPanel.classList.toggle("hidden",!(owner||management));
  if($("premiumAssignForm"))$("premiumAssignForm").onsubmit=async e=>{e.preventDefault();if(!owner&&!management)return;const {error}=await sb.rpc("assign_passenger_class",{p_flight_id:$("premiumFlight").value,p_username:$("premiumUsername").value.trim(),p_class:$("premiumClass").value});if(error)return alert("تعذر تعيين الفئة: "+error.message);alert("تم تحديث فئة المسافر.");$("premiumAssignForm").reset()};
 }
 $("adminBookings")?.addEventListener("click",async e=>{
  const boardingButton=e.target.closest("[data-boarding-action]");
  if(boardingButton){
   if(role!=="boarding_staff")return;
   const action=boardingButton.dataset.boardingAction,stamp=new Date().toISOString();
   const updates=action==="check-in"?{check_in_at:stamp}:{check_in_at:boardingButton.dataset.checkIn||stamp,boarded_at:stamp};
   const {error}=await sb.from("bookings").update(updates).eq("id",boardingButton.dataset.bookingId).eq("status","approved");
   if(error)alert("تعذر تحديث حالة البوردنق: "+error.message);else await refresh();
   return;
  }
  if(!canChangeBookings)return;
  const b=e.target.closest("[data-booking]");
  if(!b||b.dataset.status!=="rejected")return;
  if(!confirm("متأكد من رفض هذا الحجز؟"))return;
  const {error}=await sb.from("bookings").update({status:"rejected"}).eq("id",b.dataset.booking);
  if(error)alert("تعذر رفض الحجز.");else await refresh();
 });
 $("flightForm")?.addEventListener("submit",async e=>{
  e.preventDefault();if(!pilot&&!owner)return;
  const originCode=$("fFrom").value.trim().toUpperCase(),destinationCode=$("fTo").value.trim().toUpperCase();if(originCode===destinationCode)return alert("مطار الإقلاع والوصول لازم يكونون مختلفين.");if(Number($("fEconomy").value)+Number($("fBusiness").value)+Number($("fFirst").value)<1)return alert("لازم تضيف مقعد واحد على الأقل.");
  const row={flight_number:$("fNumber").value.trim().toUpperCase(),origin_code:originCode,destination_code:destinationCode,departure_at:new Date($("fTime").value).toISOString(),aircraft:$("fAircraft").value.trim()||null,server_url:$("fServerUrl").value.trim()||null,seats_total:Number($("fEconomy").value)+Number($("fBusiness").value)+Number($("fFirst").value),seats_economy:Number($("fEconomy").value),seats_business:Number($("fBusiness").value),seats_first:Number($("fFirst").value),status:owner?$("fStatus").value:"scheduled",created_by:uid,pilot_user_id:pilot?uid:null,owner_approved:owner,management_approved:owner};
  let insertResult;try{insertResult=await sb.from("flights").insert(row);}catch(err){console.error("Flight insert failed:",err);return alert("تعذر إنشاء الرحلة: "+(err?.message||"خطأ غير معروف"));}const {error}=insertResult;if(error){console.error("Flight insert failed:",error);return alert("تعذر إنشاء الرحلة: "+(error.message||"تحقق من البيانات والصلاحيات."));}
  $("flightForm").reset();alert(pilot?"تم إرسال طلب الرحلة للمالك للموافقة.":"تم إنشاء الرحلة.");await refresh();
 });
 $("employeeForm")?.addEventListener("submit",async e=>{e.preventDefault();if(!owner)return alert("هذه الصلاحية للمالك فقط.");const r=await fetch(CFG.supabaseUrl+"/functions/v1/employee-create",{method:"POST",headers:{"Content-Type":"application/json","apikey":CFG.supabaseKey,"Authorization":"Bearer "+s.session.access_token},body:JSON.stringify({username:$("eUsername").value.trim(),employeeId:$("eId").value.trim(),role:$("eRole").value,password:$("ePassword").value})}),o=await r.json().catch(()=>({}));if(!r.ok)return alert(o.error||"تعذر إنشاء الموظف.");alert("تم إنشاء حساب الموظف.");$("employeeForm").reset();refresh()});
 $("logout")?.addEventListener("click",async()=>{await sb.auth.signOut();location.href="index.html"});
 await refresh().catch(err=>{console.error("Dashboard refresh failed:",err);alert("تعذر تحميل لوحة الرحلات: "+(err?.message||"خطأ غير معروف"));});
}
if(page==="flights")initFlights();if(page==="register")initRegister();if(page==="passenger-login")initPassengerLogin();if(page==="passenger-account")initPassengerAccount();if(page==="booking")initBooking();if(page==="employee-login")initEmployeeLogin();if(page==="dashboard")initDashboard();
