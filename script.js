// script.js
const taxURL = "https://raw.githubusercontent.com/Minecraft2613/taxess/main/tax-data.json";
const bankURL = "https://raw.githubusercontent.com/Minecraft2613/taxess/main/bank-data.json";
const syncTaxURL = "https://syncs.1987sakshamsingh.workers.dev/";
const syncBankURL = "https://b-syncs.1987sakshamsingh.workers.dev/";
const syncTransactionURL = "https://transaction.1987sakshamsingh.workers.dev/";
const webhookURL = "https://discordapp.com/api/webhooks/1386366777403117620/ioXKz_sPozMCx1DPvTWnJ1d2YyBw9P9oiqoRO_EWJWRZ1YDFEQEK3R64Y5RImfIgTrHR";

let paidPlayers = {}, paymentHistory = {}, bankAccounts = {}, taxDeadline = {}, currentPlayer = "", dailyData = {}, chartType = localStorage.getItem("chartType") || "pie", chart;

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
  } catch (e) {
    alert("⚠️ Failed to sync. Please try again later.");
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

function askBankDetails() {
  document.getElementById("bankBox").innerHTML = `
    <h3>Create Bank Account</h3>
    <input id="bankUser" placeholder="Bank Username" />
    <input id="bankId" placeholder="Bank ID" />
    <input id="bankPass" placeholder="Bank Password" type="password" />
    <div class="btn-row">
      <button onclick="createBankAccount()">Create</button>
      <button onclick="exitBank()">Exit</button>
    </div>`;
  document.getElementById("bankBox").style.display = "block";
}

function askBankLogin() {
  document.getElementById("bankBox").innerHTML = `
    <h3>Login to Bank</h3>
    <input id="bankId" placeholder="Bank ID" />
    <input id="bankPass" placeholder="Bank Password" type="password" />
    <div class="btn-row">
      <button onclick="verifyBankLogin()">Login</button>
      <button onclick="exitBank()">Exit</button>
    </div>`;
  document.getElementById("bankBox").style.display = "block";
}

function exitBank() {
  document.getElementById("bankBox").style.display = "none";
  document.getElementById("step1").style.display = "block";
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

async function loadTax() {
  document.getElementById("loading").style.display = "flex";
  const res = await fetch("https://raw.githubusercontent.com/Minecraft2613/taxess/main/transaction-log.txt?nocache=" + Date.now());
  const text = await res.text();
  parseTransactions(text);
  document.getElementById("loading").style.display = "none";
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

  if (due >= 4000 && bankAccounts[currentPlayer] && !taxDeadline[currentPlayer]) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    taxDeadline[currentPlayer] = start.getTime();
    syncToCloudflare(syncTaxURL, { paidPlayers, paymentHistory, taxDeadline });
  }

  if (due <= 0 && taxDeadline[currentPlayer]) {
    delete taxDeadline[currentPlayer];
    syncToCloudflare(syncTaxURL, { paidPlayers, paymentHistory, taxDeadline });
  }

  const now = Date.now();
  const startTime = taxDeadline[currentPlayer];
  const deadline = startTime ? startTime + 7 * 86400000 : null;

  if (deadline && now > deadline && due > 0) sendTaxWebhook(currentPlayer, due);
  if (startTime && now <= deadline && due > 0) {
    const left = deadline - now;
    const d = Math.floor(left / 86400000), h = Math.floor(left % 86400000 / 3600000), m = Math.floor(left % 3600000 / 60000);
    document.getElementById("saveNotice").innerText = `⏳ Tax Deadline: ${d}d ${h}h ${m}m left`;
    document.getElementById("saveNotice").style.display = "block";
  }

  showProfile(buy, sell, total, paid, due, paid > total);
  renderChart();
  showTopTaxPlayers();
}

function showProfile(buy, sell, total, paid, due, advanced) {
  document.getElementById("profile").innerHTML = `<h3>Welcome, ${currentPlayer}</h3>
    <p>Total Tax: $${total.toFixed(2)}</p>
    <p>Buying Tax: $${buy.toFixed(2)} | Selling Tax: $${sell.toFixed(2)}</p>
    <p>Status: <strong>${due === 0 ? (advanced ? "Advance Paid" : "No Tax Due") : "$" + due.toFixed(2) + " Due"}</strong></p>
    <input type="number" id="payAmt" placeholder="Enter amount to pay">
    <div class="btn-row">
      <button onclick="submitTax()">${due > 0 ? "Pay Tax" : "Advance Pay"}</button>
      <button onclick="showFullHistory()">Full History</button>
      <button onclick="exitBank()">Exit</button>
    </div>`;
  document.getElementById("profile").style.display = "block";

  const history = paymentHistory[currentPlayer] || [];
  document.getElementById("historyBox").innerHTML = `<h3>Payment History</h3><ul>
    ${history.map(e => `<li>$${e.amount} on ${e.date}</li>`).join('')}</ul>`;
  document.getElementById("historyBox").style.display = "block";
  document.querySelector(".chart-switcher").style.display = "block";
}

function showFullHistory() {
  const all = paymentHistory[currentPlayer] || [];
  document.getElementById("fullHistoryBox").innerHTML = `<h3>Full Payment History</h3><ul>
    ${all.map(e => `<li>$${e.amount} on ${e.date}</li>`).join('')}</ul>`;
  document.getElementById("fullHistoryBox").style.display = "block";
}

function renderChart() {
  const ctx = document.getElementById('taxChart').getContext('2d');
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: chartType === "curved" ? "line" : chartType,
    data: {
      labels: Object.keys(dailyData),
      datasets: [{
        label: 'Tax Per Day',
        data: Object.values(dailyData),
        backgroundColor: ['#ffaa00', '#00ffaa', '#ff66cc', '#3399ff', '#ccff33', '#ff3333', '#33ffcc'],
        borderColor: '#00ff88',
        borderWidth: 2,
        fill: ['line', 'radar'].includes(chartType),
        tension: chartType === "curved" ? 0.4 : 0
      }]
    },
    options: {
      responsive: true,
      animation: { duration: 1000, easing: 'easeInOutQuart' },
      plugins: {
        legend: { labels: { color: '#fff' } },
        tooltip: { enabled: true }
      },
      scales: ['bar', 'line', 'curved'].includes(chartType) ? {
        x: { ticks: { color: '#fff' } },
        y: { beginAtZero: true, ticks: { color: '#fff' } }
      } : {}
    }
  });
  document.getElementById("taxChart").style.display = "block";
  document.getElementById("downloadChartBtn").style.display = "inline-block";
}

function changeChart(type) {
  chartType = type;
  localStorage.setItem("chartType", type);
  renderChart();
}

function downloadChartImage() {
  const link = document.createElement('a');
  link.download = `tax_chart_${chartType}.png`;
  link.href = document.getElementById("taxChart").toDataURL("image/png");
  link.click();
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
  }).then(res => res.ok ? console.log("☁️ Synced") : res.text().then(txt => console.warn("Sync Fail", txt)))
    .catch(err => console.warn("Sync Error:", err));
}

function sendTaxWebhook(player, dueTax) {
  const bank = bankAccounts[player] || {};
  const content = {
    embeds: [{
      title: "⏰ Tax Deadline Missed",
      color: 0xff0000,
      fields: [
        { name: "Player", value: player, inline: true },
        { name: "Tax Due", value: `$${dueTax}`, inline: true },
        { name: "Bank Username", value: bank.username || "N/A", inline: true },
        { name: "Bank ID", value: bank.id || "N/A", inline: true }
      ],
      timestamp: new Date().toISOString()
    }]
  };

  fetch(webhookURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content)
  });
}

function showTopTaxPlayers() {
  const top = Object.entries(paidPlayers)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, tax]) => `<li><strong>${name}</strong>: $${tax.toFixed(2)}</li>`)
    .join('');
  document.getElementById("topTaxPlayers").innerHTML = `<h3>🏆 Top 5 Tax Payers</h3><ul>${top}</ul>`;
  document.getElementById("topTaxPlayers").style.display = "block";
}

window.onload = () => {
  taxDeadline = JSON.parse(localStorage.getItem("taxDeadline") || "{}");
  document.getElementById("job").innerHTML = ["Farmer", "Miner", "Trader", "Builder"].map(j => `<option>${j}</option>`).join("");

  const chartSwitcher = document.querySelector(".chart-switcher");
  if (chartSwitcher && !document.getElementById("downloadChartBtn")) {
    const dlBtn = document.createElement("button");
    dlBtn.id = "downloadChartBtn";
    dlBtn.textContent = "📊 Export Chart";
    dlBtn.style.marginTop = "10px";
    dlBtn.onclick = downloadChartImage;
    dlBtn.style.display = "none";
    chartSwitcher.appendChild(dlBtn);
  }
};
