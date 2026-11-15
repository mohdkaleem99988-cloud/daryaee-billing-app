const $ = id => document.getElementById(id);
const units = ["MTR","FIT","NO","PCS","SET","KG","BOX","ROLL"];
let currentBillId = null;

function today(){ return new Date().toISOString().slice(0,10); }
function makeBillNo(){ return "DE-" + today().replaceAll("-","") + "-" + String(Date.now()).slice(-4); }
function money(n){ return "₹" + Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function addRow(item={}) {
  const tr=document.createElement("tr");
  const idx=$("itemsBody").children.length+1;
  const unitOptions=units.map(u=>`<option value="${u}" ${item.unit===u?"selected":""}>${u}</option>`).join("");
  tr.innerHTML=`<td class="serial">${idx}</td>
    <td><input class="material" placeholder="Material name" value="${escapeHtml(item.name||"")}"></td>
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
function save(){const b=collect();if(!b.customerName){$("status").textContent="Please enter customer name.";return null;}const list=getHistory();const i=list.findIndex(x=>x.id===b.id);if(i>=0)list[i]=b;else list.unshift(b);localStorage.setItem("daryaeeBills",JSON.stringify(list));currentBillId=b.id;$("status").textContent="Bill saved on this mobile.";renderHistory();return b;}
function renderHistory(){const list=getHistory();$("history").innerHTML=list.length?list.map(b=>`<div class="history-item"><div><b>${escapeHtml(b.billNo)}</b> · ${escapeHtml(b.customerName)}<small>${escapeHtml(b.billDate||"")} · ${money(b.total)}</small></div><button type="button" data-id="${escapeHtml(b.id)}">Open</button></div>`).join(""):"No saved bills yet."; $("history").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>loadBill(btn.dataset.id)));}
function loadBill(id){const b=getHistory().find(x=>x.id===id);if(!b)return;currentBillId=b.id;$("billNo").value=b.billNo;$("billDate").value=b.billDate;$("customerName").value=b.customerName;$("customerPhone").value=b.customerPhone;$("customerAddress").value=b.customerAddress;$("itemsBody").innerHTML="";(b.items||[]).forEach(addRow);if(!b.items?.length)addRow();calculate();$("status").textContent="Saved bill opened.";}
function newBill(){currentBillId=null;$("billNo").value=makeBillNo();$("billDate").value=today();$("customerName").value="";$("customerPhone").value="";$("customerAddress").value="";$("itemsBody").innerHTML="";addRow();addRow();$("status").textContent="New bill ready.";}
function share(){const b=save();if(!b)return;const lines=[ "DARYAEE ENTERPRISES","ELECTRICAL CONTRACTOR","Primary: 8795322256","Secondary: 9696566701",`Bill No: ${b.billNo}`,`Date: ${b.billDate}`,`Customer: ${b.customerName}`,`Mobile: ${b.customerPhone}`,`Address: ${b.customerAddress}`,"","S.No. | Material | Qty | Unit | Rate | Amount",...b.items.map((x,i)=>`${i+1} | ${x.name} | ${x.qty} | ${x.unit} | ${money(x.rate)} | ${money(x.qty*x.rate)}`),"",`GRAND TOTAL: ${money(b.total)}`];const url="https://wa.me/?text="+encodeURIComponent(lines.join("\n"));window.open(url,"_blank");}
$("addRow").addEventListener("click",()=>addRow());
$("saveBill").addEventListener("click",save);
$("printBill").addEventListener("click",()=>{save();window.print();});
$("shareBill").addEventListener("click",share);
$("newBill").addEventListener("click",newBill);
$("refreshHistory").addEventListener("click",renderHistory);
newBill();renderHistory();
if("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js").catch(()=>{});
