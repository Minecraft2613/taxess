// script.js - Full logic with curved line chart, rank system, bug fixes

const taxURL = "https://raw.githubusercontent.com/Minecraft2613/taxess/main/tax-data.json";
const bankURL = "https://raw.githubusercontent.com/Minecraft2613/taxess/main/bank-data.json";
const syncTaxURL = "https://syncs.1987sakshamsingh.workers.dev/";
const syncBankURL = "https://b-syncs.1987sakshamsingh.workers.dev/";
const syncTransactionURL = "https://transaction.1987sakshamsingh.workers.dev/";

let paidPlayers = {}, paymentHistory = {}, bankAccounts = {}, taxDeadline = {};
let currentPlayer = '', dailyData = {}, chart;

function sumPayments(player) {
  const history = paymentHistory[player] || [];
  return history.reduce((sum, entry) => sum + Number(entry.amount), 0);
}

async function checkTax() {
  currentPlayer = document.getElementById('mcid').value.trim();
  if (!currentPlayer) return alert("Please enter your Minecraft name");
  document.getElementById("step1").style.display = "none";
  document.getElementById("loading").style.display = "flex";

  try {
    await fetch(syncTransactionURL, { method: "POST" });
    await loadOnlineData();
    document.getElementById("loading").style.display = "none";
    if (!bankAccounts[currentPlayer]) askBankDetails();
    else askBankLogin();
  } catch {
    alert("⚠️ Sync failed");
    document.getElementById("step1").style.display = "block";
    document.getElementById("loading").style.display = "none";
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

function showTopRankers() {
  const entries = Object.entries(paidPlayers).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const list = entries.map(([name, amt]) => `<li><b>${name}</b>: $${amt.toFixed(2)}</li>`).join('');
  document.getElementById("historyBox").innerHTML += `<h3>🏆 Top Tax Payers</h3><ul>${list}</ul>`;
}

function showFullHistory() {
  const history = paymentHistory[currentPlayer] || [];
  const html = history.map(e => `<li>$${e.amount} on ${e.date}</li>`).join('');
  alert(`📜 Full History:\n\n${html.replace(/<li>/g, '- ').replace(/<\/li>/g, '\n')}`);
}

function showProfile(buy, sell, total, paid, due, advanced) {
  document.getElementById("profile").innerHTML = `
    <h3>Welcome, ${currentPlayer}</h3>
    <p>Total Tax: $${total.toFixed(2)}</p>
    <p>Buying Tax: $${buy.toFixed(2)} | Selling Tax: $${sell.toFixed(2)}</p>
    <p>Status: <strong>${due === 0 ? (advanced ? "Advance Paid" : "No Tax Due") : "$" + due.toFixed(2) + " Due"}</strong></p>
    <input type="number" id="payAmt" placeholder="Enter amount to pay">
    <div class="btn-row">
      <button onclick="submitTax()">${due > 0 ? "Pay Tax" : "Advance Pay"}</button>
      <button onclick="showFullHistory()">Full History</button>
    </div>`;
  document.getElementById("profile").style.display = "block";

  const history = paymentHistory[currentPlayer] || [];
  const last = history.slice(-5);
  document.getElementById("historyBox").innerHTML = `<h3>Payment History</h3><ul>
    ${last.map(e => `<li>$${e.amount} on ${e.date}</li>`).join('')}</ul>`;
  document.getElementById("historyBox").style.display = "block";
  showTopRankers();
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
  renderCharts();
}

function renderCharts() {
  const ctx = document.getElementById('taxChart').getContext('2d');
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Object.keys(dailyData),
      datasets: [
        {
          label: 'Curved Tax Line',
          data: Object.values(dailyData),
          borderColor: '#ffaa00',
          backgroundColor: 'rgba(255,170,0,0.3)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Tax Bar',
          type: 'bar',
          data: Object.values(dailyData),
          backgroundColor: '#444'
        },
        {
          label: 'Pie Style',
          type: 'pie',
          data: Object.values(dailyData),
          backgroundColor: ['#ff8c00', '#ffa500', '#ffb84d', '#ffd280', '#ffe0b3'],
          labels: Object.keys(dailyData),
          hidden: true // Shown only on toggle (future enhancement)
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#fff' } } },
      scales: { x: { ticks: { color: '#fff' } }, y: { ticks: { color: '#fff' } } }
    }
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
  syncToCloudflare(syncTaxURL, { paidPlayers, paymentHistory, taxDeadline });
  loadTax();
}

function syncToCloudflare(url, data) {
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(res => res.ok ? console.log("☁️ Sync OK") : console.warn("☁️ Sync Fail"))
    .catch(err => console.warn("☁️ Sync Error:", err));
}

window.onload = () => {
  document.getElementById("job").innerHTML = ["Farmer", "Miner", "Trader", "Builder"].map(j => `<option>${j}</option>`).join("");
};
