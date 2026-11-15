
const $ = id => document.getElementById(id);

const units = ["MTR","FIT","NO","PCS","SET","KG","BOX","ROLL"];
let currentBillId = null;
let pdfLibraryPromise = null;

function today(){
  const d = new Date();
  const local = new Date(d.getTime()-d.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,10);
}

function makeBillNo(){
  return "DE-" + today() + "-" + String(Date.now()).slice(-4);
}

function money(n){
  return "₹" + Number(n||0).toLocaleString("en-IN",{
    minimumFractionDigits:2,
    maximumFractionDigits:2
  });
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function addRow(item={}){
  const tr = document.createElement("tr");
  const idx = $("itemsBody").children.length+1;

  const unitOptions = units.map(u =>
    `<option value="${u}" ${item.unit===u?"selected":""}>${u}</option>`
  ).join("");

  const custom = item.unit&&!units.includes(item.unit);

  tr.innerHTML = `
    <td class="serial">${idx}</td>
    <td><input class="material" placeholder="Material name" value="${escapeHtml(item.name||"")}"></td>
    <td><input class="qty" type="number" min="0" step="any" placeholder="0" value="${item.qty??""}"></td>
    <td>
      <select class="unit">
        ${unitOptions}
        <option value="CUSTOM" ${custom?"selected":""}>Other / Type</option>
      </select>
      <input class="custom-unit" placeholder="Type unit"
        value="${custom?escapeHtml(item.unit):""}"
        style="display:${custom?"block":"none"};margin-top:5px">
    </td>
    <td><input class="rate" type="number" min="0" step="any" placeholder="0" value="${item.rate??""}"></td>
    <td class="amount">${money((Number(item.qty)||0)*(Number(item.rate)||0))}</td>
    <td class="no-print"><button class="remove" type="button">×</button></td>
  `;

  $("itemsBody").appendChild(tr);

  tr.querySelectorAll(".qty,.rate").forEach(el=>el.addEventListener("input",calculate));

  tr.querySelector(".unit").addEventListener("change",e=>{
    const input=tr.querySelector(".custom-unit");
    input.style.display=e.target.value==="CUSTOM"?"block":"none";
    if(e.target.value!=="CUSTOM") input.value="";
  });

  tr.querySelector(".remove").addEventListener("click",()=>{
    tr.remove();
    renumber();
    calculate();
  });

  calculate();
}

function renumber(){
  [...$("itemsBody").children].forEach((tr,i)=>{
    tr.querySelector(".serial").textContent=i+1;
  });
}

function rows(){
  return [...$("itemsBody").children].map(tr=>({
    name:tr.querySelector(".material").value.trim(),
    qty:Number(tr.querySelector(".qty").value)||0,
    unit:tr.querySelector(".unit").value==="CUSTOM"
      ?tr.querySelector(".custom-unit").value.trim()
      :tr.querySelector(".unit").value,
    rate:Number(tr.querySelector(".rate").value)||0
  }));
}

function getBillCalculation(subtotal){
  const gstMode=$("gstMode").value;
  const gstRateValue=$("gstRate").value;
  const customGst=Number($("customGst").value)||0;
  const gstRate=gstRateValue==="CUSTOM"?customGst:Number(gstRateValue);
  const gstAmount=gstMode==="ON"?subtotal*gstRate/100:0;
  const total=subtotal+gstAmount;
  const advancePaid=Math.max(0,Number($("advancePaid").value)||0);

  return {
    gstMode,gstRate,customGst,gstAmount,total,advancePaid,
    balanceDue:total-advancePaid
  };
}

function calculate(){
  let subtotal=0;

  [...$("itemsBody").children].forEach(tr=>{
    const amount=(Number(tr.querySelector(".qty").value)||0)*
      (Number(tr.querySelector(".rate").value)||0);
    tr.querySelector(".amount").textContent=money(amount);
    subtotal+=amount;
  });

  const bill=getBillCalculation(subtotal);

  $("subTotal").textContent=money(subtotal);
  $("gstAmount").textContent=money(bill.gstAmount);
  $("grandTotal").textContent=money(bill.total);
  $("balanceDue").textContent=money(bill.balanceDue);
  $("customGstWrap").style.display=$("gstRate").value==="CUSTOM"?"block":"none";
}

function collect(){
  const items=rows();
  const subtotal=items.reduce((s,x)=>s+x.qty*x.rate,0);

  return {
    id:currentBillId||String(Date.now()),
    billNo:$("billNo").value,
    billDate:$("billDate").value,
    customerName:$("customerName").value.trim(),
    customerPhone:$("customerPhone").value.trim(),
    customerAddress:$("customerAddress").value.trim(),
    items,subtotal,
    ...getBillCalculation(subtotal),
    savedAt:new Date().toISOString()
  };
}

function getHistory(){
  try{return JSON.parse(localStorage.getItem("daryaeeBills")||"[]");}
  catch{return [];}
}

function save(){
  const b=collect();

  if(!b.customerName){
    $("status").textContent="Please enter customer name.";
    return null;
  }

  const list=getHistory();
  const i=list.findIndex(x=>x.id===b.id);

  if(i>=0) list[i]=b;
  else list.unshift(b);

  localStorage.setItem("daryaeeBills",JSON.stringify(list));
  currentBillId=b.id;

  $("status").textContent="Bill saved on this mobile.";
  renderHistory();
  return b;
}

function renderHistory(){
  const list=getHistory();

  $("history").innerHTML=list.length?list.map(b=>`
    <div class="history-item">
      <div>
        <b>${escapeHtml(b.billNo)}</b> · ${escapeHtml(b.customerName)}
        <small>${escapeHtml(b.billDate||"")} · ${money(b.total)}</small>
      </div>
      <button type="button" data-id="${escapeHtml(b.id)}">Open</button>
    </div>
  `).join(""):"No saved bills yet.";

  $("history").querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click",()=>loadBill(btn.dataset.id));
  });
}

function loadBill(id){
  const b=getHistory().find(x=>x.id===id);
  if(!b)return;

  currentBillId=b.id;
  $("billNo").value=b.billNo;
  $("billDate").value=b.billDate;
  $("customerName").value=b.customerName;
  $("customerPhone").value=b.customerPhone;
  $("customerAddress").value=b.customerAddress;
  $("gstMode").value=b.gstMode||"OFF";
  $("gstRate").value=b.gstRate
    ?([5,12,18,28].includes(Number(b.gstRate))?String(b.gstRate):"CUSTOM")
    :"18";
  $("customGst").value=b.customGst||0;
  $("advancePaid").value=b.advancePaid||0;

  $("itemsBody").innerHTML="";
  (b.items||[]).forEach(addRow);
  if(!b.items?.length)addRow();

  calculate();
  $("status").textContent="Saved bill opened.";
}

/* PDF LIBRARY WITH BACKUP SOURCE */

function loadJsPDF(){
  if(window.jspdf)return Promise.resolve(window.jspdf);
  if(pdfLibraryPromise)return pdfLibraryPromise;

  const sources=[
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js",
    "https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js"
  ];

  pdfLibraryPromise=(async()=>{
    for(const src of sources){
      try{
        await new Promise((resolve,reject)=>{
          const script=document.createElement("script");
          script.src=src;
          script.onload=resolve;
          script.onerror=()=>{
            script.remove();
            reject(new Error("Library load failed"));
          };
          document.head.appendChild(script);
        });

        if(window.jspdf)return window.jspdf;
      }catch(error){
        console.warn("PDF source failed:",src);
      }
    }

    pdfLibraryPromise=null;
    throw new Error("PDF library load nahi hui");
  })();

  return pdfLibraryPromise;
}

function createBillPDF(b){
  const doc=new window.jspdf.jsPDF({
    orientation:"portrait",unit:"mm",format:"a4"
  });

  const left=14,right=196;
  let y=18;

  function checkPage(height=10){
    if(y+height>275){doc.addPage();y=20;}
  }

  function addText(t,x,yy,options={}){
    doc.text(String(t??"-"),x,yy,options);
  }

  doc.setTextColor(8,42,75);
  doc.setFont("helvetica","bold");
  doc.setFontSize(19);
  addText("DARYAEE ENTERPRISES",left,y);

  y+=8;
  doc.setFontSize(11);
  addText("ELECTRICAL CONTRACTOR",left,y);

  y+=7;
  doc.setTextColor(60,60,60);
  doc.setFont("helvetica","normal");
  doc.setFontSize(9);
  addText("Primary: 8795322256 | Secondary: 9696566701",left,y);

  y+=5;
  doc.setDrawColor(190,150,65);
  doc.setLineWidth(.8);
  doc.line(left,y,right,y);

  y+=10;
  doc.setTextColor(8,42,75);
  doc.setFont("helvetica","bold");
  doc.setFontSize(14);
  addText("BILL",left,y);

  y+=9;
  doc.setTextColor(40,40,40);
  doc.setFont("helvetica","normal");
  doc.setFontSize(10);

  addText("Bill Number: "+b.billNo,left,y);y+=6;
  addText("Bill Date: "+b.billDate,left,y);y+=6;
  addText("Customer: "+b.customerName,left,y);y+=6;
  addText("Mobile: "+(b.customerPhone||"-"),left,y);y+=6;

  const addressLines=doc.splitTextToSize("Address: "+(b.customerAddress||"-"),180);
  doc.text(addressLines,left,y);
  y+=addressLines.length*5+6;

  const xNo=14,xMaterial=27,xQty=112,xUnit=130,xRate=151,xAmount=194;

  doc.setFillColor(8,42,75);
  doc.rect(left,y-5,182,9,"F");
  doc.setTextColor(255,255,255);
  doc.setFont("helvetica","bold");
  doc.setFontSize(8);

  addText("S.No",xNo,y);
  addText("Material",xMaterial,y);
  addText("Qty",xQty,y);
  addText("Unit",xUnit,y);
  addText("Rate",xRate,y);
  addText("Amount",xAmount,y,{align:"right"});

  y+=9;
  doc.setTextColor(40,40,40);
  doc.setFont("helvetica","normal");
  doc.setFontSize(8);

  (b.items||[]).forEach((item,index)=>{
    const lines=doc.splitTextToSize(String(item.name||"-"),78);
    const height=Math.max(7,lines.length*4.5);
    checkPage(height+5);

    addText(index+1,xNo,y);
    doc.text(lines,xMaterial,y);
    addText(item.qty||0,xQty,y);
    addText(item.unit||"-",xUnit,y);
    addText(Number(item.rate||0).toFixed(2),xRate,y);
    addText((Number(item.qty||0)*Number(item.rate||0)).toFixed(2),xAmount,y,{align:"right"});

    y+=height;
    doc.setDrawColor(220,220,220);
    doc.line(left,y-2,right,y-2);
    y+=3;
  });

  y+=5;
  checkPage(55);

  const subtotal=Number(b.subtotal||0);
  const gstAmount=Number(b.gstAmount||0);
  const total=Number(b.total||0);
  const advance=Number(b.advancePaid||0);
  const balance=Number(b.balanceDue||0);

  doc.setTextColor(50,50,50);
  doc.setFont("helvetica","normal");
  doc.setFontSize(10);

  addText("Subtotal: INR "+subtotal.toFixed(2),right,y,{align:"right"});
  y+=7;
  addText("GST ("+(b.gstMode==="ON"?b.gstRate+"%":"OFF")+"): INR "+gstAmount.toFixed(2),right,y,{align:"right"});
  y+=9;

  doc.setFillColor(8,42,75);
  doc.rect(105,y-6,91,11,"F");
  doc.setTextColor(255,255,255);
  doc.setFont("helvetica","bold");
  doc.setFontSize(11);
  addText("GRAND TOTAL: INR "+total.toFixed(2),193,y+1,{align:"right"});

  y+=13;
  doc.setTextColor(50,50,50);
  doc.setFontSize(10);
  addText("Advance Paid: INR "+advance.toFixed(2),right,y,{align:"right"});
  y+=7;
  doc.setFont("helvetica","bold");
  addText("Balance Due: INR "+balance.toFixed(2),right,y,{align:"right"});

  y+=18;
  checkPage(10);
  doc.setFont("helvetica","normal");
  doc.setFontSize(9);
  doc.setTextColor(100,100,100);
  addText("Thank you for your business!",left,y);

  return doc;
}

/* WHATSAPP SHARE */

function share(){
  const b=save();
  if(!b)return;

  if(!window.jspdf){
    $("status").textContent="PDF library load ho rahi hai. Thodi der baad Share dobara dabayein.";

    loadJsPDF().then(()=>{
      $("status").textContent="PDF ready hai. Ab Share on WhatsApp dobara dabayein.";
    }).catch(()=>{
      $("status").textContent="PDF library load nahi hui. Internet check karein.";
    });
    return;
  }

  try{
    const doc=createBillPDF(b);
    const blob=doc.output("blob");
    const fileName=(b.billNo||"DARYAEE-Bill")+".pdf";
    const file=new File([blob],fileName,{type:"application/pdf"});

    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
      $("status").textContent="Share menu khul raha hai. WhatsApp chunein.";

      navigator.share({
        files:[file],
        title:"DARYAEE ENTERPRISES Bill",
        text:"Please find attached bill PDF."
      }).then(()=>{
        $("status").textContent="PDF share ho gayi.";
      }).catch(error=>{
        if(error.name==="AbortError"){
          $("status").textContent="Sharing cancel kar di gayi.";
        }else{
          console.error(error);
          doc.save(fileName);
          $("status").textContent="PDF download ho gayi. WhatsApp mein Document se attach karein.";
        }
      });
    }else{
      doc.save(fileName);
      $("status").textContent="PDF download ho gayi. WhatsApp mein Document se attach karein.";
    }
  }catch(error){
    console.error(error);
    $("status").textContent="PDF share nahi ho payi. Save PDF button se PDF download karein.";
  }
}

function newBill(){
  currentBillId=null;
  $("billNo").value=makeBillNo();
  $("billDate").value=today();
  $("customerName").value="";
  $("customerPhone").value="";
  $("customerAddress").value="";
  $("gstMode").value="OFF";
  $("gstRate").value="18";
  $("customGst").value="0";
  $("advancePaid").value="0";
  $("itemsBody").innerHTML="";
  addRow();
  addRow();
  calculate();
  $("status").textContent="New bill ready.";
}

/* BUTTON EVENTS */

$("gstMode").addEventListener("change",calculate);
$("gstRate").addEventListener("change",calculate);
$("customGst").addEventListener("input",calculate);
$("advancePaid").addEventListener("input",calculate);
$("addRow").addEventListener("click",()=>addRow());
$("saveBill").addEventListener("click",save);

$("printBill").addEventListener("click",()=>{
  const b=save();
  if(!b)return;
  window.print();
});

$("shareBill").addEventListener("click",share);
$("newBill").addEventListener("click",newBill);
$("refreshHistory").addEventListener("click",renderHistory);

/* START */

newBill();
renderHistory();
loadJsPDF().catch(()=>{});

if("serviceWorker" in navigator&&location.protocol.startsWith("http")){
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
