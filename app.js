const CFG=window.KAREN_FLIGHT_CONFIG||{}, sb=window.supabase?.createClient(CFG.supabaseUrl,CFG.supabaseKey);
const $=id=>document.getElementById(id), esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const msg=(id,t,bad=false)=>{const e=$(id);if(e){e.textContent=t;e.className="message show"+(bad?" error":"")}};
const empAlias=id=>{const normalized=String(id||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");if(normalized==="FO1176551")return "employee.fo117651@karenflight.invalid";return "employee."+normalized.toLowerCase()+"@karenflight.invalid"};
const paxAlias=u=>"passenger."+u.trim().toLowerCase()+"@karenflight.invalid";
const dateLabel=v=>{try{return new Intl.DateTimeFormat("ar-SA",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v))}catch{return v||"—"}};
const page=document.body.dataset.page;
async function getFlights(){const {data,error}=await sb.from("flights").select("*").in("status",["scheduled","boarding","delayed","in_progress"]).gte("departure_at",new Date(Date.now()-86400000).toISOString()).order("departure_at");if(error)throw error;return data||[]}
function card(f){return '<article class="flight-card"><div class="flight-top"><b class="flight-no en">'+esc(f.flight_number)+'</b><span class="status">'+(f.status==="boarding"?"الصعود متاح":f.status==="in_progress"?"الرحلة جارية":f.status==="delayed"?"متأخرة":"مجدولة")+'</span></div><div class="route"><div class="airport"><b>'+esc(f.origin_code)+'</b></div><div class="route-line">✈</div><div class="airport"><b>'+esc(f.destination_code)+'</b></div></div><div class="flight-bottom"><span class="flight-meta">'+dateLabel(f.departure_at)+'<br>'+esc(f.aircraft||"Karen")+'</span><a class="btn primary small" href="booking.html?flight='+encodeURIComponent(f.id)+'">احجز</a></div></article>'}
async function initFlights(){const box=$("flightList");try{const fs=await getFlights(),from=$("fromFilter"),to=$("toFilter");if(from)from.innerHTML='<option value="">كل المطارات</option>'+[...new Set(fs.map(x=>x.origin_code))].sort().map(x=>'<option>'+esc(x)+'</option>').join("");if(to)to.innerHTML='<option value="">كل الوجهات</option>'+[...new Set(fs.map(x=>x.destination_code))].sort().map(x=>'<option>'+esc(x)+'</option>').join("");const draw=()=>{const rows=fs.filter(x=>(!from?.value||x.origin_code===from.value)&&(!to?.value||x.destination_code===to.value)&&(!$("dateFilter")?.value||x.departure_at.slice(0,10)===$("dateFilter").value));box.innerHTML=rows.length?rows.map(card).join(""):'<div class="empty">ما فيه رحلات متاحة حالياً.</div>'};from?.addEventListener("change",draw);to?.addEventListener("change",draw);$("dateFilter")?.addEventListener("change",draw);draw()}catch{box.innerHTML='<div class="empty">تعذر تحميل الرحلات.</div>'}}
async function initRegister(){$("registerForm")?.addEventListener("submit",async e=>{e.preventDefault();const u=$("username").value.trim(),p=$("password").value;if(!/^[A-Za-z0-9_]{3,20}$/.test(u))return msg("formMessage","اسم Roblox غير صحيح.",true);const r=await fetch(CFG.supabaseUrl+"/functions/v1/passenger-register",{method:"POST",headers:{"Content-Type":"application/json","apikey":CFG.supabaseKey},body:JSON.stringify({username:u,password:p})}),o=await r.json().catch(()=>({}));if(!r.ok)return msg("formMessage",o.error||"تعذر إنشاء الحساب.",true);const {error}=await sb.auth.signInWithPassword({email:paxAlias(u),password:p});if(error)return msg("formMessage","تم إنشاء الحساب. سجل الدخول من صفحة الدخول.",true);location.href="passenger-account.html"})}
async function initPassengerLogin(){$("loginForm")?.addEventListener("submit",async e=>{e.preventDefault();const {error}=await sb.auth.signInWithPassword({email:paxAlias($("username").value),password:$("password").value});if(error)return msg("formMessage","اسم المستخدم أو كلمة المرور غير صحيحة.",true);location.href="passenger-account.html"})}
async function initPassengerAccount(){
 const {data:s}=await sb.auth.getSession();if(!s.session)return location.replace("passenger-login.html");
 const {data:a}=await sb.from("passenger_accounts").select("user_id,roblox_username").eq("user_id",s.session.user.id).maybeSingle();
 if(!a){await sb.auth.signOut();return location.replace("passenger-login.html")}
 $("welcome").textContent="أهلاً "+a.roblox_username;
 const {data:rows,error}=await sb.from("bookings").select("id,flight_id,status,passenger_class,created_at,flight_number_snapshot,origin_code_snapshot,destination_code_snapshot,departure_at_snapshot,aircraft_snapshot,flight_status_snapshot,server_url_snapshot,flights(flight_number,origin_code,destination_code,departure_at,aircraft,status,server_url,economy_link_approved)").eq("passenger_user_id",a.user_id).order("created_at",{ascending:false});
 const cls={economy:"اقتصادي",business:"بزنس",first:"فرست كلاس"};
 const state={scheduled:"مجدولة",boarding:"صعود الركاب",delayed:"متأخرة",in_progress:"بدأت",stopped:"متوقفة",closed:"مغلقة",cancelled:"ملغاة",deleted:"محذوفة"};
 $("bookingHistory").innerHTML=error?"تعذر تحميل الحجوزات.":rows.length?rows.map(b=>{
  const f=b.flights||{},deleted=!b.flight_id&&!f.flight_number;
  const no=f.flight_number||b.flight_number_snapshot||"—",from=f.origin_code||b.origin_code_snapshot||"—",to=f.destination_code||b.destination_code_snapshot||"—",when=f.departure_at||b.departure_at_snapshot||b.created_at,status=deleted?"deleted":(f.status||b.flight_status_snapshot||"scheduled"),url=f.server_url||b.server_url_snapshot;
  const premium=["business","first"].includes(b.passenger_class||"economy");const economyReleased=!!f.economy_link_approved;const canEnter=!!url&&!deleted&&["boarding","in_progress"].includes(status)&&b.status==="approved"&&(premium||economyReleased);
  return '<div class="flight-card"><b>'+esc(no)+'</b><p>'+esc(from)+' → '+esc(to)+'</p><p>'+dateLabel(when)+' · '+esc(f.aircraft||b.aircraft_snapshot||"—")+'</p><p>الفئة: '+cls[b.passenger_class||"economy"]+'</p><p>حالة الرحلة: '+(state[status]||esc(status))+'</p><span class="status">'+(b.status==="approved"?"الحجز مؤكد":b.status==="pending"?"قيد المراجعة":"مرفوض")+'</span>'+(canEnter?'<p><a class="btn primary small" target="_blank" rel="noopener" href="'+esc(url)+'">دخول سيرفر الرحلة</a></p>':(deleted?'<p>تم حذف الرحلة مع الاحتفاظ بتفاصيل حجزك.</p>':(status==="cancelled"||status==="closed"||status==="stopped"?'<p>الدخول غير متاح لهذه الرحلة حالياً.</p>':(status==="boarding"||status==="in_progress")&&!premium&&!economyReleased?'<p>الأولوية حالياً للبزنس والفرست كلاس. انتظر إتاحة دخول الاقتصادي.</p>':'<p>رابط السيرفر يظهر عند فتح صعود الركاب.</p>')) )+'</div>'
 }).join(""):"ما عندك حجوزات حالياً.";
 $("logout")?.addEventListener("click",async()=>{await sb.auth.signOut();location.href="index.html"});
}
async function initBooking(){const {data:s}=await sb.auth.getSession();if(!s.session){$("bookingGuard").classList.remove("hidden");$("bookingForm").classList.add("hidden");return}const {data:a}=await sb.from("passenger_accounts").select("user_id,roblox_username").eq("user_id",s.session.user.id).maybeSingle();if(!a){await sb.auth.signOut();$("bookingGuard").classList.remove("hidden");return}$("robloxName").value=a.roblox_username;try{const fs=await getFlights();const {data:classAssignments}=await sb.from("flight_passenger_classes").select("flight_id,passenger_class").eq("passenger_user_id",s.session.user.id);const classSel=$("passengerClass");const drawClasses=()=>{const f=fs.find(x=>x.id===$("flightId").value);if(!f)return;const assigned=classAssignments?.find(x=>x.flight_id===f.id)?.passenger_class;const opts=[["economy","اقتصادي",f.seats_economy],["business","بزنس",f.seats_business],["first","فرست كلاس",f.seats_first]].filter(([v])=>!assigned||v===assigned);classSel.innerHTML=opts.map(([v,n,count])=>'<option value="'+v+'" '+(!count?'disabled':'')+' >'+n+' · '+count+' مقعد'+(assigned?" · مخصص لك":"")+"</option>").join("");};$("flightId").innerHTML='<option value="">اختر الرحلة</option>'+fs.filter(f=>["scheduled","boarding"].includes(f.status)).map(f=>'<option value="'+esc(f.id)+'">'+esc(f.flight_number)+' · '+esc(f.origin_code)+' → '+esc(f.destination_code)+' · '+dateLabel(f.departure_at)+'</option>').join("");$("flightId").addEventListener("change",drawClasses);const id=new URLSearchParams(location.search).get("flight");if(id)$("flightId").value=id;drawClasses();}catch{}$("bookingForm").addEventListener("submit",async e=>{e.preventDefault();const {error}=await sb.from("bookings").insert({flight_id:$("flightId").value,roblox_username:a.roblox_username,passenger_name:$("passengerName").value.trim(),passenger_user_id:a.user_id,passenger_class:$("passengerClass").value,notes:$("notes").value.trim()||null,status:"approved"});if(error)return msg("formMessage","تعذر تأكيد الحجز. تحقق من المقاعد أو أنك حجزت مسبقاً.",true);msg("formMessage","تم تأكيد حجزك بنجاح.")})}
async function initEmployeeLogin(){
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
 const owner=role==="owner", management=["management","admin"].includes(role), pilot=role==="pilot";
 const crew=["co_pilot","cabin_crew","ground_staff"].includes(role);
 const roleInfo={
  pilot:{name:"Pilot · الطيار",about:"ينشئ طلب الرحلة ويقودها بعد اعتمادها من المالك والإدارة.",tasks:["إنشاء طلب رحلة وإرساله للمالك","بعد اعتماد المالك والإدارة يبدأ الرحلة أو يوقفها","متابعة الطاقم المرتبط برحلته"],access:"إدارة طلباته وبدء أو إيقاف رحلاته المعتمدة فقط."},
  co_pilot:{name:"Co-Pilot · مساعد الطيار",about:"ينضم إلى رحلة الطيار المحددة ويسانده في متابعة تفاصيلها.",tasks:["الانضمام إلى رحلة معتمدة يشغلها طيار","عرض بيانات الرحلة والطاقم","الانسحاب من الرحلة"],access:"الانضمام إلى رحلة واحدة كمساعد طيار والانسحاب منها."},
  cabin_crew:{name:"Cabin Crew · طاقم الضيافة",about:"ينضم إلى الرحلات لمتابعة معلومات الرحلة وقائمة المسافرين.",tasks:["الانضمام إلى الرحلات المعتمدة","عرض بيانات الرحلة والمسار والموعد","متابعة قائمة المسافرين والحجوزات"],access:"عرض معلومات الرحلة والحجوزات والانسحاب من الرحلة."},
  ground_staff:{name:"Ground Crew · الطاقم الأرضي",about:"يتابع تجهيز الرحلات وإجراءات المسافرين قبل الصعود.",tasks:["الانضمام إلى الرحلات المعتمدة","عرض بيانات الرحلة والطاقم","متابعة قائمة المسافرين والحجوزات"],access:"عرض معلومات الرحلة والحجوزات والانسحاب من الرحلة."},
  management:{name:"Management · الإدارة",about:"تراجع طلبات الرحلات بعد موافقة المالك وتدير اعتماد التشغيل.",tasks:["مراجعة الرحلات التي اعتمدها المالك","اعتماد الرحلة للتشغيل أو رفضها","متابعة الرحلات والحجوزات وإدارة حالاتها"],access:"اعتماد تشغيل الرحلات وإدارة الرحلات والحجوزات."},
  admin:{name:"Management · الإدارة",about:"تراجع طلبات الرحلات بعد موافقة المالك وتدير اعتماد التشغيل.",tasks:["مراجعة الرحلات التي اعتمدها المالك","اعتماد الرحلة للتشغيل أو رفضها","متابعة الرحلات والحجوزات وإدارة حالاتها"],access:"اعتماد تشغيل الرحلات وإدارة الرحلات والحجوزات."},
  owner:{name:"Owner · المالك",about:"يراجع طلبات الطيارين ويمنح الموافقة الأولى قبل انتقالها للإدارة.",tasks:["مراجعة طلبات الرحلات والموافقة أو الرفض","الإشراف على الرحلات والحجوزات","إنشاء حسابات الموظفين وتحديد وظائفهم"],access:"الموافقة الأولى على الرحلات وإدارة الموظفين والرحلات والحجوزات."}
 };
 const info=roleInfo[role]||{name:role,about:"موظف في Karen Flight.",tasks:[],access:"حسب الوظيفة."};
 $("dashUser").textContent=emp.roblox_username+" · "+info.name;
 const canSeeBookings=["owner","management","admin","ground_staff","cabin_crew"].includes(role);
 const canChangeBookings=["owner","management","admin"].includes(role);
 const canSeeFlights=true;
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
  const [{count:fc},{count:bc},{count:pc},{data:fs,error:fe},{data:bs},{data:es},{data:members},{data:passengers}]=await Promise.all([
   sb.from("flights").select("*",{count:"exact",head:true}),
   canSeeBookings?sb.from("bookings").select("*",{count:"exact",head:true}):Promise.resolve({count:null}),
   canSeeBookings?sb.from("bookings").select("*",{count:"exact",head:true}).eq("status","pending"):Promise.resolve({count:null}),
   sb.from("flights").select("*").order("created_at",{ascending:false}).limit(100),
   canSeeBookings?sb.from("bookings").select("*,flights(flight_number,origin_code,destination_code)").order("created_at",{ascending:false}).limit(100):Promise.resolve({data:[]}),
   owner?sb.from("employees").select("user_id,roblox_username,employee_id,role,active").order("created_at",{ascending:false}).limit(100):Promise.resolve({data:[]}),
   sb.from("flight_staff_members").select("flight_id,employee_user_id,role,roblox_username"),
   (owner||management)?sb.from("passenger_accounts").select("user_id,roblox_username").order("roblox_username"):Promise.resolve({data:[]})
  ]);
  if(fe)console.error(fe);
  $("statFlights").textContent=fc??"—";$("statBookings").textContent=bc??"—";$("statPending").textContent=pc??"—";
  const allFlights=fs||[], crewRows=members||[];
  const roster=f=>crewRows.filter(x=>x.flight_id===f.id).map(x=>esc(x.roblox_username||x.role)).join("، ")||"لم ينضم طاقم بعد";
  const statusName=f=>({scheduled:"مجدولة",boarding:"صعود الركاب",delayed:"متأخرة",in_progress:"بدأت",stopped:"متوقفة",closed:"مغلقة",cancelled:"ملغاة"}[f.status]||f.status);
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
   if((owner||management)&&f.owner_approved&&f.management_approved&&f.server_url&&["boarding","in_progress"].includes(f.status)&&!f.economy_link_approved)actions.push('<button class="btn small primary" data-flight-action="economy-release" data-id="'+f.id+'">إتاحة رابط الاقتصادي</button>');
   if((owner||management||(pilot&&f.pilot_user_id===uid))&&f.status!=="cancelled")actions.push('<button class="btn small" data-flight-action="edit-link" data-id="'+f.id+'">تعديل رابط السيرفر</button>');
   if(pilot&&f.pilot_user_id===uid&&f.owner_approved&&f.management_approved){if(f.status==="in_progress")actions.push('<button class="btn small" data-flight-action="stop" data-id="'+f.id+'">إيقاف الرحلة</button>');else if(["scheduled","delayed"].includes(f.status))actions.push('<button class="btn small primary" data-flight-action="start" data-id="'+f.id+'">بدء الرحلة</button>')}
   if(crew&&f.owner_approved&&f.management_approved&&["scheduled","boarding","delayed"].includes(f.status)){
    const mine=crewRows.find(x=>x.flight_id===f.id&&x.employee_user_id===uid);
    if(mine)actions.push('<button class="btn small" data-flight-action="leave" data-id="'+f.id+'">انسحاب</button>');
    else if(role!=="co_pilot"||!crewRows.some(x=>x.flight_id===f.id&&x.role==="co_pilot"))actions.push('<button class="btn small primary" data-flight-action="join" data-id="'+f.id+'">انضمام للرحلة</button>');
   }
   return actions.join(" ")||"—";
  };
  const relevant=pilot?allFlights.filter(f=>f.pilot_user_id===uid):allFlights;
  $("adminFlights").innerHTML=relevant.map(f=>'<tr><td>'+esc(f.flight_number)+'</td><td>'+esc(f.origin_code)+' → '+esc(f.destination_code)+'</td><td>'+dateLabel(f.departure_at)+'</td><td>'+statusName(f)+'<br><small>المالك: '+(f.owner_approved?"موافق":"بانتظار الموافقة")+' · الإدارة: '+(f.management_approved?"معتمدة":"بانتظار الاعتماد")+'</small>'+statusEditor(f)+'</td><td>'+flightActions(f)+'</td></tr>').join("")||'<tr><td colspan="5">ما فيه رحلات حالياً.</td></tr>';
  $("adminBookings").innerHTML=(bs||[]).map(b=>'<tr><td>'+esc(b.passenger_name)+'</td><td>'+esc(b.roblox_username)+'</td><td>'+esc(b.flights?.flight_number||"—")+'</td><td>'+esc(b.status)+'</td><td>'+(canChangeBookings&&b.status!=="rejected"?'<button class="btn small" data-booking="'+b.id+'" data-status="rejected">رفض الحجز</button>':(b.status==="rejected"?"—":"عرض فقط"))+'</td></tr>').join("");
  $("adminEmployees").innerHTML=(es||[]).map(x=>'<tr><td>'+esc(x.roblox_username)+'</td><td>'+esc(x.employee_id)+'</td><td>'+esc(roleInfo[x.role]?.name||x.role)+'</td><td>'+(x.active?"نشط":"موقوف")+'</td><td>'+(x.role!=="owner"&&x.user_id!==uid?'<button class="btn small" data-delete-employee="'+esc(x.user_id)+'" data-employee-name="'+esc(x.roblox_username)+'">حذف الهوية</button>':"—")+'</td></tr>').join("");
  $("staffFlights").innerHTML=allFlights.filter(f=>f.owner_approved&&f.management_approved&&["scheduled","boarding","delayed","in_progress"].includes(f.status)).map(f=>'<tr><td>'+esc(f.flight_number)+'</td><td>'+esc(f.origin_code)+' → '+esc(f.destination_code)+'</td><td>'+dateLabel(f.departure_at)+'</td><td>'+esc(f.aircraft||"—")+'<br><small>'+roster(f)+'</small></td><td>'+statusName(f)+(f.crew_link_approved&&f.server_url?'<br><a target="_blank" rel="noopener" href="'+esc(f.server_url)+'">دخول سيرفر الموظفين</a>':"")+'<br>'+flightActions(f)+'</td></tr>').join("")||'<tr><td colspan="5">ما فيه رحلات معتمدة حالياً.</td></tr>';
 }
 await refresh();
 $("refresh")?.addEventListener("click",refresh);
 $("adminFlights")?.addEventListener("click",async e=>{
  const b=e.target.closest("[data-flight-action]");if(!b)return;
  const id=b.dataset.id,action=b.dataset.flightAction;let result;
  if(action==="owner-approve")result=await sb.from("flights").update({owner_approved:true,owner_approved_by:uid,owner_approved_at:new Date().toISOString()}).eq("id",id);
  if(action==="management-approve")result=await sb.from("flights").update({management_approved:true,management_approved_by:uid,management_approved_at:new Date().toISOString()}).eq("id",id).eq("owner_approved",true);
  if(action==="crew-release"){if(!owner&&!management)return alert("غير مصرح");result=await sb.from("flights").update({crew_link_approved:true,crew_link_approved_at:new Date().toISOString()}).eq("id",id);}
  if(action==="economy-release"){if(!owner&&!management)return alert("غير مصرح");result=await sb.from("flights").update({economy_link_approved:true}).eq("id",id);}
  if(action==="edit-link"){const {data:f}=await sb.from("flights").select("server_url").eq("id",id).maybeSingle();const url=prompt("ضع رابط سيرفر الرحلة:",f?.server_url||"");if(url===null)return;if(url.trim()&&!/^https?:\/\//i.test(url.trim()))return alert("الرابط لازم يبدأ بـ https:// أو http://");result=await sb.from("flights").update({server_url:url.trim()||null,crew_link_approved:false,crew_link_approved_at:null}).eq("id",id);}
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
  if(action==="join")result=await sb.from("flight_staff_members").insert({flight_id:id,employee_user_id:uid,role});
  if(action==="leave")result=await sb.from("flight_staff_members").delete().eq("flight_id",id).eq("employee_user_id",uid);
  if(result?.error){alert("تعذر تنفيذ الإجراء: "+result.error.message);return}await refresh();
 });
  $("adminEmployees")?.addEventListener("click",async e=>{const b=e.target.closest("[data-delete-employee]");if(!b||!owner)return;const username=b.dataset.employeeName;if(!confirm("متأكد من حذف هوية الموظف "+username+"؟ سيتم حذف حساب دخوله وإزالته من قائمة الموظفين، ولا يمكن التراجع."))return;const r=await fetch(CFG.supabaseUrl+"/functions/v1/employee-delete",{method:"POST",headers:{"Content-Type":"application/json","apikey":CFG.supabaseKey,"Authorization":"Bearer "+s.session.access_token},body:JSON.stringify({userId:b.dataset.deleteEmployee})});const out=await r.json().catch(()=>({}));if(!r.ok)return alert(out.error||"تعذر حذف هوية الموظف.");alert("تم حذف هوية الموظف.");await refresh()});
const premiumPanel=$("premiumAssignPanel");
 if(premiumPanel){
  premiumPanel.classList.toggle("hidden",!(owner||management));
  $("premiumFlight").innerHTML='<option value="">اختر الرحلة</option>'+allFlights.filter(x=>x.status!=="cancelled").map(x=>'<option value="'+esc(x.id)+'">'+esc(x.flight_number)+' · '+esc(x.origin_code)+' → '+esc(x.destination_code)+'</option>').join("");
  $("registeredPassengers").innerHTML=(passengers||[]).map(x=>'<option value="'+esc(x.roblox_username)+'"></option>').join("");
  if($("premiumAssignForm"))$("premiumAssignForm").onsubmit=async e=>{e.preventDefault();if(!owner&&!management)return;const {error}=await sb.rpc("assign_passenger_class",{p_flight_id:$("premiumFlight").value,p_username:$("premiumUsername").value.trim(),p_class:$("premiumClass").value});if(error)return alert("تعذر تعيين الفئة: "+error.message);alert("تم تحديث فئة المسافر.");$("premiumAssignForm").reset()};
 }
 $("adminBookings")?.addEventListener("click",async e=>{if(!canChangeBookings)return;const b=e.target.closest("[data-booking]");if(!b||b.dataset.status!=="rejected")return;if(!confirm("متأكد من رفض هذا الحجز؟"))return;const {error}=await sb.from("bookings").update({status:"rejected"}).eq("id",b.dataset.booking);if(error)alert("تعذر رفض الحجز.");else refresh()});
 $("flightForm")?.addEventListener("submit",async e=>{
  e.preventDefault();if(!pilot&&!owner)return;
  const originCode=$("fFrom").value.trim().toUpperCase(),destinationCode=$("fTo").value.trim().toUpperCase();if(originCode===destinationCode)return alert("مطار الإقلاع والوصول لازم يكونون مختلفين.");if(Number($("fEconomy").value)+Number($("fBusiness").value)+Number($("fFirst").value)<1)return alert("لازم تضيف مقعد واحد على الأقل.");
  const row={flight_number:$("fNumber").value.trim().toUpperCase(),origin_code:originCode,destination_code:destinationCode,departure_at:new Date($("fTime").value).toISOString(),aircraft:$("fAircraft").value.trim()||null,server_url:$("fServerUrl").value.trim()||null,seats_total:Number($("fEconomy").value)+Number($("fBusiness").value)+Number($("fFirst").value),seats_economy:Number($("fEconomy").value),seats_business:Number($("fBusiness").value),seats_first:Number($("fFirst").value),status:owner?$("fStatus").value:"scheduled",created_by:uid,pilot_user_id:pilot?uid:null,owner_approved:owner,management_approved:owner};
  const {error}=await sb.from("flights").insert(row);if(error)return alert("تعذر إرسال طلب الرحلة: "+error.message);
  $("flightForm").reset();alert(pilot?"تم إرسال طلب الرحلة للمالك للموافقة.":"تم إنشاء الرحلة.");await refresh();
 });
 $("employeeForm")?.addEventListener("submit",async e=>{e.preventDefault();if(!owner)return alert("هذه الصلاحية للمالك فقط.");const r=await fetch(CFG.supabaseUrl+"/functions/v1/employee-create",{method:"POST",headers:{"Content-Type":"application/json","apikey":CFG.supabaseKey,"Authorization":"Bearer "+s.session.access_token},body:JSON.stringify({username:$("eUsername").value.trim(),employeeId:$("eId").value.trim(),role:$("eRole").value,password:$("ePassword").value})}),o=await r.json().catch(()=>({}));if(!r.ok)return alert(o.error||"تعذر إنشاء الموظف.");alert("تم إنشاء حساب الموظف.");$("employeeForm").reset();refresh()});
 $("logout")?.addEventListener("click",async()=>{await sb.auth.signOut();location.href="index.html"});
}
if(page==="flights")initFlights();if(page==="register")initRegister();if(page==="passenger-login")initPassengerLogin();if(page==="passenger-account")initPassengerAccount();if(page==="booking")initBooking();if(page==="employee-login")initEmployeeLogin();if(page==="dashboard")initDashboard();
