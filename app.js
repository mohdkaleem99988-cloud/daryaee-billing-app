const $ = id => document.getElementById(id);
const units = ["MTR","FIT","NO","PCS","SET","KG","BOX","ROLL"];
const MATERIALS_KEY = "daryaeeSavedMaterials";
let currentBillId = null;

function today(){ return new Date().toISOString().slice(0,10); }
function makeBillNo(){ return "DE-" + today().replaceAll("-","") + "-" + String(Date.now()).slice(-4); }
function money(n){ return "₹" + Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2}); }

function getSavedMaterials(){
  try { return JSON.parse(localStorage.getItem(MATERIALS_KEY) || "[]"); }
  catch { return []; }
}
function refreshMaterialSuggestions(){
  let list = $("savedMaterials");
  if(!list){
    list = document.createElement("datalist");
    list.id = "savedMaterials";
    document.body.appendChild(list);
  }
  list.innerHTML = getSavedMaterials().map(name => `<option value="${escapeHtml(name)}"></option>`).join("");
}
function rememberMaterials(items){
  const names = getSavedMaterials();
  items.forEach(item => {
    const name = String(item.name || "").trim();
    if(name && !names.some(saved => saved.toLowerCase() === name.toLowerCase())) names.push(name);
  });
  localStorage.setItem(MATERIALS_KEY, JSON.stringify(names));
  refreshMaterialSuggestions();
}

function addRow(item={}){
  const tr=document.createElement("tr");
  const idx=$("itemsBody").children.length+1;
  const unitOptions=units.map(u=>`<option value="${u}" ${item.unit===u?"selected":""}>${u}</option>`).join("");
  tr.innerHTML=`<td class="serial">${idx}</td>
    <td><input class="material" list="savedMaterials" placeholder="Material name" value="${escapeHtml(item.name||"")}"></td>
    <td><input class="qty" type="number" min="0" step="any" inputmode="decimal" placeholder="0" value="${item.qty??""}"></td>
    <td><select class="unit">${unitOptions}<option value="CUSTOM" ${item.unit&&!units.includes(item.unit)?"selected":""}>Other / Type</option></select><input class="custom-unit" placeholder="Type unit" value="${item.unit&&!units.includes(item.unit)?escapeHtml(item.unit):""}" style="display:${item.unit&&!units.includes(item.unit)?"block":"none"};margin-top:5px"></td>
    <td><input class="rate" type="number" min="0" step="any" inputmode="decimal" placeholder="0" value="${item.rate??""}"></td>
    <td class="amount">${money((Number(item.qty)||0)*(Number(item.rate)||0))}</td>
    <td class="no-print"><button class="remove" type="button">×</button></td>`;
  $("itemsBody").appendChild(tr);
  tr.querySelectorAll(".qty,.rate").forEach(el=>el.addEventListener("input",calculate));
  tr.querySelector(".unit").addEventListener("change",e=>{
    const custom=tr.querySelector(".custom-unit");
    custom.style.display=e.target.value==="CUSTOM"?"block":"none";
    if(e.target.value!=="CUSTOM") custom.value="";
  });
  tr.querySelector(".remove").addEventListener("click",()=>{tr.remove();renumber();calculate();});
  calculate();
}

function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function renumber(){[...$("itemsBody").children].forEach((tr,i)=>tr.querySelector(".serial").textContent=i+1);}
function rows(){return [...$("itemsBody").children].map(tr=>({name:tr.querySelector(".material").value.trim(),qty:Number(tr.querySelector(".qty").value)||0,unit:tr.querySelector(".unit").value==="CUSTOM"?tr.querySelector(".custom-unit").value.trim():tr.querySelector(".unit").value,rate:Number(tr.querySelector(".rate").value)||0}));}
function calculate(){let total=0;[...$("itemsBody").children].forEach(tr=>{const a=(Number(tr.querySelector(".qty").value)||0)*(Number(tr.querySelector(".rate").value)||0);tr.querySelector(".amount").textContent=money(a);total+=a;});$("grandTotal").textContent=money(total);}
function collect(){const items=rows();return {id:currentBillId||String(Date.now()),billNo:$("billNo").value,billDate:$("billDate").value,customerName:$("customerName").value.trim(),customerPhone:$("customerPhone").value.trim(),customerAddress:$("customerAddress").value.trim(),items,total:items.reduce((s,x)=>s+x.qty*x.rate,0),savedAt:new Date().toISOString()};}
function getHistory(){try{return JSON.parse(localStorage.getItem("daryaeeBills")||"[]");}catch{return [];}}
function save(){
  const b=collect();
  if(!b.customerName){$("status").textContent="Please enter customer name.";return null;}
  const list=getHistory();
  const i=list.findIndex(x=>x.id===b.id);
  if(i>=0)list[i]=b;else list.unshift(b);
  localStorage.setItem("daryaeeBills",JSON.stringify(list));
  rememberMaterials(b.items);
  currentBillId=b.id;
  $("status").textContent="Bill saved on this mobile.";
  renderHistory();
  return b;
}
function renderHistory(){const list=getHistory();$("history").innerHTML=list.length?list.map(b=>`<div class="history-item"><div><b>${escapeHtml(b.billNo)}</b> · ${escapeHtml(b.customerName)}<small>${escapeHtml(b.billDate||"")} · ${money(b.total)}</small></div><button type="button" data-id="${escapeHtml(b.id)}">Open</button></div>`).join(""):"No saved bills yet."; $("history").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>loadBill(btn.dataset.id)));}
function loadBill(id){const b=getHistory().find(x=>x.id===id);if(!b)return;currentBillId=b.id;$("billNo").value=b.billNo;$("billDate").value=b.billDate;$("customerName").value=b.customerName;$("customerPhone").value=b.customerPhone;$("customerAddress").value=b.customerAddress;$("itemsBody").innerHTML="";(b.items||[]).forEach(addRow);if(!b.items?.length)addRow();calculate();$("status").textContent="Saved bill opened.";}
function newBill(){currentBillId=null;$("billNo").value=makeBillNo();$("billDate").value=today();$("customerName").value="";$("customerPhone").value="";$("customerAddress").value="";$("itemsBody").innerHTML="";addRow();addRow();$("status").textContent="New bill ready.";}

async function share(){
  const b = save();
  if(!b) return;
  if(!window.jspdf){
    $("status").textContent = "PDF library load nahi hui. Internet check karein.";
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;
  doc.setFontSize(18);
  doc.setFont("helvetica","bold");
  doc.text("DARYAEE ENTERPRISES", pageWidth/2, y, {align:"center"});
  y += 8;
  doc.setFontSize(11);
  doc.text("ELECTRICAL CONTRACTOR", pageWidth/2, y, {align:"center"});
  y += 10;
  doc.setFontSize(10);
  doc.setFont("helvetica","normal");
  doc.text("Primary: 8795322256  |  Secondary: 9696566701", pageWidth/2, y, {align:"center"});
  y += 12;
  doc.setFont("helvetica","bold");
  doc.text("INVOICE", 14, y);
  y += 8;
  doc.setFont("helvetica","normal");
  [
    `Bill No: ${b.billNo}`,
    `Date: ${b.billDate}`,
    `Customer: ${b.customerName}`,
    `Mobile: ${b.customerPhone || "-"}`,
    `Address: ${b.customerAddress || "-"}`
  ].forEach(line => { doc.text(line, 14, y); y += 7; });
  y += 5;
  doc.setFont("helvetica","bold");
  doc.text("S.No.",14,y);
  doc.text("Material",28,y);
  doc.text("Qty",105,y);
  doc.text("Unit",125,y);
  doc.text("Rate",145,y);
  doc.text("Amount",175,y,{align:"right"});
  y += 4;
  doc.line(14,y,pageWidth-14,y);
  y += 7;
  doc.setFont("helvetica","normal");
  b.items.forEach((item,i) => {
    if(y > 270){ doc.addPage(); y=20; }
    doc.text(String(i+1),14,y);
    doc.text(String(item.name || "-").slice(0,35),28,y);
    doc.text(String(item.qty),105,y);
    doc.text(String(item.unit),125,y);
    doc.text("INR " + Number(item.rate||0).toFixed(2),145,y);
    doc.text(money(item.qty*item.rate),175,y,{align:"right"});
  });
  y += 5;
  doc.line(14,y,pageWidth-14,y);
  y += 10;
  doc.setFont("helvetica","bold");
  doc.setFontSize(13);
  doc.text("GRAND TOTAL: INR " + Number(b.total||0).toFixed(2), pageWidth-14, y, {align:"right"});
  const blob = doc.output("blob");
  const file = new File([blob], `${b.billNo}.pdf`, {type:"application/pdf"});
  try{
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({files:[file],title:b.billNo,text:"DARYAEE ENTERPRISES - Bill PDF"});
    }else{
      doc.save(`${b.billNo}.pdf`);
      $("status").textContent = "PDF download ho gaya. Files se WhatsApp par bhejein.";
    }
  }catch(e){
    if(e.name !== "AbortError") $("status").textContent = "PDF share nahi ho paya. Dobara try karein.";
  }
}

$("shareBill").addEventListener("click", share);
$("addRow").addEventListener("click",()=>addRow());
$("saveBill").addEventListener("click",save);
$("printBill").addEventListener("click",()=>{save();window.print();});
$("newBill").addEventListener("click",newBill);
$("refreshHistory").addEventListener("click",renderHistory);

refreshMaterialSuggestions();
newBill();
renderHistory();
