// script.js
const taxURL = "https://raw.githubusercontent.com/Minecraft2613/taxess/main/tax-data.json";
const bankURL = "https://raw.githubusercontent.com/Minecraft2613/taxess/main/bank-data.json";
const syncTaxURL = "https://syncs.1987sakshamsingh.workers.dev/";
const syncBankURL = "https://b-syncs.1987sakshamsingh.workers.dev/";
const syncTransactionURL = "https://transaction.1987sakshamsingh.workers.dev/";
const webhookURL = "https://discordapp.com/api/webhooks/1386366777403117620/ioXKz_sPozMCx1DPvTWnJ1d2YyBw9P9oiqoRO_EWJWRZ1YDFEQEK3R64Y5RImfIgTrHR";

let paidPlayers = {}, paymentHistory = {}, bankAccounts = {}, taxDeadline = {};
let currentPlayer = '', dailyData = {}, chart;

window.onload = () => {
  taxDeadline = JSON.parse(localStorage.getItem("taxDeadline") || "{}");
  document.getElementById("job").innerHTML = ["Farmer", "Miner", "Trader", "Builder"].map(j => `<option>${j}</option>`).join("");
  const typeSelector = document.getElementById("chartType");
  if (typeSelector) typeSelector.addEventListener("change", e => renderChart(e.target.value));
};

async function checkTax() {
  currentPlayer = document.getElementById('mcid').value.trim();
  if (!currentPlayer) return alert("Please enter your Minecraft name");
  document.getElementById("step1").style.display = "none";
  document.getElementById("novaLoading3D").style.display = "flex";
  try {
    await fetch(syncTransactionURL, { method: "POST" });
    await Promise.all([
      fetch(syncTaxURL, { method: "POST" }),
      fetch(syncBankURL, { method: "POST" })
    ]);
    await loadOnlineData();
    document.getElementById("novaLoading3D").style.display = "none";
    if (!bankAccounts[currentPlayer]) askBankDetails();
    else askBankLogin();
  } catch (e) {
    alert("⚠️ Failed to sync. Please try again later.");
    document.getElementById("step1").style.display = "block";
    document.getElementById("novaLoading3D").style.display = "none";
  }
}

async function loadOnlineData() {
  const [taxRes, bankRes] = await Promise.all([fetch(taxURL), fetch(bankURL)]);
  const taxData = await taxRes.json();
  const bankData = await bankRes.json();
  paidPlayers = taxData.paidPlayers || {};
  paymentHistory = taxData.paymentHistory || {};
  bankAccounts = bankData.accounts || {};
  taxDeadline = taxData.taxDeadline || {};
}

function askBankDetails() {
  document.getElementById("bankBox").innerHTML = `
    <h3>Create Bank Account</h3>
    <input id="bankUser" placeholder="Bank Username" />
    <input id="bankId" placeholder="Bank ID" />
    <input id="bankPass" placeholder="Bank Password" type="password" />
    <button onclick="createBankAccount()">Create Account</button>
    <button onclick="location.reload()">Exit</button>
    <div id="top5Box">${showTopPlayers()}</div>
  `;
  document.getElementById("bankBox").style.display = "block";
}

function askBankLogin() {
  document.getElementById("bankBox").innerHTML = `
    <h3>Login to Bank</h3>
    <input id="bankId" placeholder="Bank ID" />
    <input id="bankPass" placeholder="Bank Password" type="password" />
    <button onclick="verifyBankLogin()">Login</button>
    <button onclick="location.reload()">Exit</button>
    <div id="top5Box">${showTopPlayers()}</div>
  `;
  document.getElementById("bankBox").style.display = "block";
}

function verifyBankLogin() {
  const id = document.getElementById("bankId").value;
  const pass = document.getElementById("bankPass").value;
  const account = bankAccounts[currentPlayer];
  if (account && account.id === id && account.password === pass) {
    document.getElementById("bankBox").style.display = "none";
    loadTax();
  } else alert("Invalid credentials");
}

function createBankAccount() {
  const username = document.getElementById("bankUser").value;
  const id = document.getElementById("bankId").value;
  const pass = document.getElementById("bankPass").value;
  if (!username || !id || !pass) return alert("Fill all fields");
  bankAccounts[currentPlayer] = { username, id, password: pass };
  syncToCloudflare(syncBankURL, { accounts: bankAccounts });
  document.getElementById("bankBox").style.display = "none";
  loadTax();
}

function sumPayments(player) {
  const history = paymentHistory[player] || [];
  return history.reduce((sum, entry) => sum + Number(entry.amount), 0);
}

async function loadTax() {
  const res = await fetch("https://raw.githubusercontent.com/Minecraft2613/taxess/main/transaction-log.txt?nocache=" + Date.now());
  const text = await res.text();
  parseTransactions(text);
}

function parseTransactions(log) {
  const lines = log.split(/\r?\n/);
  let buy = 0, sell = 0;
  dailyData = {};
  lines.forEach(line => {
    if (!line.toLowerCase().includes(currentPlayer.toLowerCase())) return;
    const date = line.match(/\[(\d{4}-\d{2}-\d{2})/);
    const day = date ? date[1].slice(5).replace('-', '/') : "";
    const buyMatch = line.match(/bought.*?\$(\d[\d,\.]+)/);
    const sellMatch = line.match(/sold.*?\$(\d[\d,\.]+)/);
    if (buyMatch) {
      const amt = parseFloat(buyMatch[1].replace(/,/g, ""));
      const tax = +(amt * 0.04).toFixed(2);
      buy += tax;
      dailyData[day] = (dailyData[day] || 0) + tax;
    }
    if (sellMatch) {
      const amt = parseFloat(sellMatch[1].replace(/,/g, ""));
      const tax = +(amt * 0.10).toFixed(2);
      sell += tax;
      dailyData[day] = (dailyData[day] || 0) + tax;
    }
  });
  const total = buy + sell;
  const paid = sumPayments(currentPlayer);
  const due = Math.max(0, total - paid);
  showProfile(buy, sell, total, paid, due, paid > total);
  renderChart("line");
}

function showProfile(buy, sell, total, paid, due, advanced) {
  document.getElementById("profile").innerHTML = `<h3>Welcome, ${currentPlayer}</h3>
    <p>Total Tax: $${total.toFixed(2)}</p>
    <p>Buying Tax: $${buy.toFixed(2)} | Selling Tax: $${sell.toFixed(2)}</p>
    <p>Status: <strong>${due === 0 ? (advanced ? "Advance Paid" : "No Tax Due") : "$" + due.toFixed(2) + " Due"}</strong></p>
    <input type="number" id="payAmt" placeholder="Enter amount to pay">
    <div class="btn-row">
      ${due > 0 ? `<button onclick="submitTax()">Pay Tax</button>` : `<button onclick="submitTax()">Advance Pay</button>`}
      <button onclick="location.reload()">Exit</button>
    </div>
    <label>Chart Type:</label>
    <select id="chartType" onchange="renderChart(this.value)">
      <option value="line">Line</option>
      <option value="bar">Bar</option>
      <option value="pie">Pie</option>
    </select>`;

  document.getElementById("profile").style.display = "block";
  document.getElementById("historyBox").innerHTML = `<h3>Payment History</h3><ul>
    ${(paymentHistory[currentPlayer] || []).map((e, i) => `<li>${i + 1}. $${e.amount} on ${e.date}</li>`).join('')}</ul>
    <button onclick="document.getElementById('fullHistoryBox').style.display='block'">See Full Payment History</button>`;
  document.getElementById("historyBox").style.display = "block";
  document.getElementById("top5Box").innerHTML = showTopPlayers();
  document.getElementById("top5Box").style.display = "block";
  document.getElementById("fullHistoryBox").innerHTML = showFullHistory();
  document.getElementById("fullHistoryBox").style.display = "none";
}

function showTopPlayers() {
  const sorted = Object.entries(paidPlayers)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  return `<h3>\u{1F3C6} Top 5 Tax Payers</h3><ol>${sorted
    .map(p => `<li>${p.name}: $${p.total.toFixed(2)}</li>`).join('')}</ol>`;
}

function showFullHistory() {
  const history = paymentHistory[currentPlayer] || [];
  if (!history.length) return "<p>No history available.</p>";
  return `<div><h3>\u{1F4DC} Full Payment History</h3><ul>${history.map((e, i) => `<li>${i + 1}. $${e.amount} on ${e.date}</li>`).join('')}</ul></div>`;
}

function renderChart(type = 'line') {
  const ctx = document.getElementById('taxChart').getContext('2d');
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type,
    data: {
      labels: Object.keys(dailyData),
      datasets: [{
        label: 'Tax Per Day',
        data: Object.values(dailyData),
        backgroundColor: '#ffaa00',
        borderColor: '#ffaa00',
        fill: type === 'line',
        tension: 0.3
      }]
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });
  document.getElementById("taxChart").style.display = "block";
}

function submitTax() {
  const amt = parseFloat(document.getElementById("payAmt").value);
  if (!amt || amt <= 0) return alert("Invalid amount");
  const entry = { amount: amt, date: new Date().toLocaleString() };
  if (!paymentHistory[currentPlayer]) paymentHistory[currentPlayer] = [];
  paymentHistory[currentPlayer].push(entry);
  paidPlayers[currentPlayer] = sumPayments(currentPlayer);
  document.getElementById("payAmt").value = "";
  syncToCloudflare(syncTaxURL, { paidPlayers, paymentHistory, taxDeadline });
  loadTax();
}

function syncToCloudflare(url, data) {
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(res => res.ok ? console.log("\u{2601}\u{FE0F} Synced") : res.text().then(txt => console.warn("Sync Failed", txt)))
    .catch(err => console.warn("Sync Error:", err));
}
