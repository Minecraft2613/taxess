const taxURL = "https://raw.githubusercontent.com/Minecraft2613/taxess/main/tax-data.json";
const bankURL = "https://raw.githubusercontent.com/Minecraft2613/taxess/main/bank-data.json";
const transactionURL = "https://raw.githubusercontent.com/Minecraft2613/taxess/main/transaction-log.txt";
let currentPlayer = "", dailyData = {}, chart, chartType = "bar";
let paidPlayers = {}, paymentHistory = {}, bankAccounts = {};

window.onload = () => {
  document.getElementById("job").innerHTML = ["Farmer", "Miner", "Trader", "Builder"]
    .map(j => `<option>${j}</option>`).join("");
};

async function checkTax() {
  const name = document.getElementById("mcid").value.trim();
  if (!name) return alert("Enter Minecraft name.");
  currentPlayer = name;

  document.getElementById("step1").style.display = "none";
  document.getElementById("loading").style.display = "block";

  try {
    await loadData();
    await parseTransactions();
    document.getElementById("loading").style.display = "none";
    showProfile();
    renderChart();
  } catch (e) {
    alert("Error loading data.");
    document.getElementById("step1").style.display = "block";
    document.getElementById("loading").style.display = "none";
  }
}

async function loadData() {
  const [taxRes, bankRes] = await Promise.all([fetch(taxURL), fetch(bankURL)]);
  const taxData = await taxRes.json();
  const bankData = await bankRes.json();
  paidPlayers = taxData.paidPlayers || {};
  paymentHistory = taxData.paymentHistory || {};
  bankAccounts = bankData.accounts || {};
}

async function parseTransactions() {
  const res = await fetch(transactionURL + "?nocache=" + Date.now());
  const text = await res.text();
  const lines = text.split(/\r?\n/);
  dailyData = {};
  let buy = 0, sell = 0;

  lines.forEach(line => {
    if (!line.toLowerCase().includes(currentPlayer.toLowerCase())) return;

    const date = line.match(/\[(\d{4}-\d{2}-\d{2})/);
    const day = date ? date[1].slice(5).replace('-', '/') : "";

    const buyMatch = line.match(/bought.*?\$([\d,.]+)/);
    const sellMatch = line.match(/sold.*?\$([\d,.]+)/);

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

  window.taxStats = { buy, sell, total, paid, due };
}

function sumPayments(player) {
  const history = paymentHistory[player] || [];
  return history.reduce((sum, entry) => sum + Number(entry.amount), 0);
}

function showProfile() {
  const { buy, sell, total, paid, due } = window.taxStats;

  document.getElementById("profile").innerHTML = `
    <div class="card">
      <h3>Welcome, ${currentPlayer}</h3>
      <p>Total Tax: $${total.toFixed(2)}</p>
      <p>Buying Tax: $${buy.toFixed(2)} | Selling Tax: $${sell.toFixed(2)}</p>
      <p>Status: <strong>${due === 0 ? "No Tax Due" : `$${due.toFixed(2)} Due`}</strong></p>
      <input type="number" id="payAmt" placeholder="Enter amount to pay">
      <div class="btn-row">
        <button onclick="submitTax()">Pay Tax</button>
        <button onclick="showHistory()">Full History</button>
        <button onclick="toggleChart()">Change Chart</button>
        <button onclick="exit()">Exit</button>
      </div>
    </div>`;

  document.getElementById("profile").style.display = "block";
}

function renderChart() {
  const ctx = document.getElementById("taxChart").getContext("2d");
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: chartType,
    data: {
      labels: Object.keys(dailyData),
      datasets: [{
        label: "Tax Per Day",
        data: Object.values(dailyData),
        borderColor: "#ffaa00",
        backgroundColor: chartType === "line" ? "transparent" : "#ffaa00",
        fill: false,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
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
  document.getElementById("payAmt").value = "";
  showProfile();
  renderChart();
}

function showHistory() {
  const history = paymentHistory[currentPlayer] || [];
  if (!history.length) return alert("No payment history yet.");

  const html = `<div class="card"><h3>Payment History</h3><ul style="padding-left:20px;">
    ${history.map(e => `<li>$${e.amount} on ${e.date}</li>`).join("")}
  </ul><button onclick="closeHistory()">Close</button></div>`;
  document.getElementById("historyBox").innerHTML = html;
  document.getElementById("historyBox").style.display = "block";
}

function closeHistory() {
  document.getElementById("historyBox").style.display = "none";
}

function toggleChart() {
  chartType = chartType === "bar" ? "line" : "bar";
  renderChart();
}

function exit() {
  document.getElementById("profile").style.display = "none";
  document.getElementById("historyBox").style.display = "none";
  document.getElementById("taxChart").style.display = "none";
  document.getElementById("step1").style.display = "block";
}
