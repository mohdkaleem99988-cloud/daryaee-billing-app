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
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const navy = [8,43,76];
  const gold = [201,166,83];
  const left = 14;
  const right = W - 14;

  function header(){
    doc.setFillColor(...navy);
    doc.rect(0,0,W,43,"F");
    doc.setFillColor(...gold);
    doc.rect(0,43,W,2,"F");

    doc.setTextColor(255,255,255);
    doc.setFont("helvetica","bold");
    doc.setFontSize(19);
    doc.text("DARYAEE ENTERPRISES",W/2,17,{align:"center"});

    doc.setFontSize(10);
    doc.text("ELECTRICAL CONTRACTOR",W/2,25,{align:"center"});

    doc.setFont("helvetica","normal");
    doc.setFontSize(9);
    doc.text("Primary: 8795322256  |  Secondary: 9696566701",W/2,34,{align:"center"});

    doc.setTextColor(30,48,65);
  }

  function tableHeading(y){
    doc.setFillColor(...navy);
    doc.rect(left,y-6,right-left,10,"F");
    doc.setTextColor(255,255,255);
    doc.setFont("helvetica","bold");
    doc.setFontSize(8);
    doc.text("S.No",left+2,y);
    doc.text("Material Description",left+14,y);
    doc.text("Qty",112,y,{align:"center"});
    doc.text("Unit",128,y,{align:"center"});
    doc.text("Rate",157,y,{align:"right"});
    doc.text("Amount",right-2,y,{align:"right"});
    doc.setTextColor(30,48,65);
    doc.setFont("helvetica","normal");
    return y+9;
  }

  header();

  doc.setFont("helvetica","bold");
  doc.setFontSize(15);
  doc.setTextColor(...navy);
  doc.text("TAX INVOICE",W/2,57,{align:"center"});

  doc.setDrawColor(...gold);
  doc.setLineWidth(0.7);
  doc.line(75,61,W-75,61);

  doc.setFillColor(244,247,250);
  doc.roundedRect(left,68,right-left,36,3,3,"F");

  doc.setFontSize(9);
  doc.setTextColor(90,105,120);
  doc.text("BILL NUMBER",left+5,76);
  doc.text("BILL DATE",110,76);

  doc.setFont("helvetica","bold");
  doc.setFontSize(10);
  doc.setTextColor(...navy);
  doc.text(String(b.billNo||"-"),left+5,83);
  doc.text(String(b.billDate||"-"),110,83);

  doc.setFont("helvetica","normal");
  doc.setFontSize(9);
  doc.setTextColor(90,105,120);
  doc.text("CUSTOMER DETAILS",left+5,94);

  doc.setFont("helvetica","bold");
  doc.setFontSize(11);
  doc.setTextColor(...navy);
  const customerLines = doc.splitTextToSize(
    String(b.customerName||"-"), right-left-10
  );
  doc.text(customerLines,left+5,100);

  let cy = 100 + customerLines.length*5;
  doc.setFont("helvetica","normal");
  doc.setFontSize(9);
  doc.setTextColor(50,65,80);
  doc.text("Mobile: " + String(b.customerPhone||"-"),left+5,cy);
  cy += 5;
  const addressLines = doc.splitTextToSize(
    "Address: " + String(b.customerAddress||"-"), right-left-10
  );
  doc.text(addressLines,left+5,cy);

  let y = cy + addressLines.length*5 + 10;
  y = tableHeading(y);

  b.items.forEach((item,i)=>{
    const materialLines = doc.splitTextToSize(
      String(item.name||"-"),65
    );
    const rowHeight = Math.max(9,materialLines.length*4+4);

    if(y+rowHeight > H-42){
      doc.addPage();
      header();
      y = tableHeading(58);
    }

    if(i%2===0){
      doc.setFillColor(246,249,251);
      doc.rect(left,y-5,right-left,rowHeight,"F");
    }

    doc.setFont("helvetica","normal");
    doc.setFontSize(8);
    doc.setTextColor(35,50,65);
    doc.text(String(i+1),left+2,y);
    doc.text(materialLines,left+14,y);
    doc.text(String(item.qty),112,y,{align:"center"});
    doc.text(String(item.unit||"-"),128,y,{align:"center"});
    doc.text(Number(item.rate||0).toFixed(2),157,y,{align:"right"});
    doc.text(
      Number(item.qty*item.rate||0).toFixed(2),
      right-2,y,{align:"right"}
    );

    doc.setDrawColor(220,228,235);
    doc.line(left,y+rowHeight-5,right,y+rowHeight-5);
    y += rowHeight;
  });

  y += 8;
  if(y > H-45){
    doc.addPage();
    header();
    y = 60;
  }

  doc.setFillColor(...navy);
  doc.roundedRect(105,y,right-105,19,2,2,"F");
  doc.setTextColor(255,255,255);
  doc.setFont("helvetica","bold");
  doc.setFontSize(11);
  doc.text("GRAND TOTAL",110,y+12);
  doc.setTextColor(255,255,255);
  doc.text(
    "INR " + Number(b.total||0).toFixed(2),
    right-4,y+12,{align:"right"}
  );

  y += 35;
  if(y > H-20){
    doc.addPage();
    header();
    y = 65;
  }

  doc.setDrawColor(...gold);
  doc.line(135,y+8,right,y+8);
  doc.setTextColor(...navy);
  doc.setFont("helvetica","bold");
  doc.setFontSize(9);
  doc.text("Authorized Signature",right,y+14,{align:"right"});

  doc.setFont("helvetica","normal");
  doc.setFontSize(8);
  doc.setTextColor(100,110,120);
  doc.text("Thank you for your business!",W/2,H-10,{align:"center"});

  const blob = doc.output("blob");
  const file = new File([blob],`${b.billNo}.pdf`,{type:"application/pdf"});

  try{
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({
        files:[file],
        title:b.billNo,
        text:"DARYAEE ENTERPRISES - Bill PDF"
      });
    }else{
      doc.save(`${b.billNo}.pdf`);
      $("status").textContent = "PDF download ho gaya. Files se WhatsApp par bhejein.";
    }
  }catch(e){
    if(e.name !== "AbortError"){
      $("status").textContent = "PDF share nahi ho paya. Dobara try karein.";
    }
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
