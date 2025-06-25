let paidPlayers = {}, paymentHistory = {}, bankAccounts = {}, taxDeadline = {}, currentPlayer = "", dailyData = {}, chart;
let chartType = localStorage.getItem("chartType") || "line";
let currentWeek = 'this';

const taxURL = "https://raw.githubusercontent.com/Minecraft2613/taxess/main/tax-data.json";
const bankURL = "https://raw.githubusercontent.com/Minecraft2613/taxess/main/bank-data.json";
const syncTaxURL = "https://syncs.1987sakshamsingh.workers.dev/";
const syncBankURL = "https://syncs.1987sakshamsingh.workers.dev/";
const webhookURL = "https://tax-hook.1987sakshamsingh.workers.dev/?type=alert";
const infoHookURL = "https://tax-hook.1987sakshamsingh.workers.dev/?type=info";
const bankHookURL = "https://tax-hook.1987sakshamsingh.workers.dev/?type=bank";
const syncTransactionURL = "https://syncs.1987sakshamsingh.workers.dev/log";

function togglePlatform() {
  const platform = document.getElementById("platformSelect").value;
  const wrapper = document.getElementById("usernameWrapper");
  wrapper.innerHTML = platform === "bedrock" ?
    `<label>Minecraft Username:</label><div style="display:flex;"><span style="padding: 7px 10px; background: #222; border: 1px solid #555; border-right: none; color: #ccc;">.</span><input id="bedrockInput" placeholder="Bedrock Username" style="flex:1; border-left: none;" /></div>` :
    `<label>Minecraft Username:</label><input id="mcid" placeholder="Java Username" />`;
}

function sendUserInfo() {
  fetch(infoHookURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [{
      title: "📇 New User Info",
      color: 0x33ccff,
      fields: [
        { name: "Method", value: localStorage.getItem("contactMethod") || "Discord", inline: true },
        { name: "Contact", value: localStorage.getItem("userContact") || "Unknown", inline: true },
        { name: "MC Username", value: currentPlayer, inline: true }
      ],
      timestamp: new Date().toISOString()
    }] })
  });
}

async function checkTax() {
  const platform = document.getElementById("platformSelect")?.value;
  const inputField = platform === "bedrock" ? document.getElementById("bedrockInput") : document.getElementById("mcid");
  if (!inputField?.value.trim()) return alert("❌ Please enter your username");
  currentPlayer = platform === "bedrock" ? "." + inputField.value.trim() : inputField.value.trim();

  sendUserInfo();
  document.getElementById("step1").style.display = "none";
  document.getElementById("loading").style.display = "flex";

  try {
    await fetch(syncTransactionURL, { method: "POST" });
    await loadOnlineData();
    document.getElementById("loading").style.display = "none";
    askBankDetails();
  } catch (e) {
    alert("⚠️ Failed to sync or load data. Try again.");
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
  const account = Object.entries(bankAccounts).find(([key]) => key.toLowerCase() === currentPlayer.toLowerCase());
  const existing = account?.[1];
  if (existing) {
    document.getElementById("bankBox").innerHTML = `
      <h3>🔐 Login to Bank</h3>
      <input id="bankUser" value="${existing.username}" readonly />
      <input id="bankId" placeholder="Bank ID" />
      <input id="bankPass" type="password" placeholder="Password" />
      <button onclick="verifyBankLogin()">Login</button>
      <button onclick="exitBank()">Exit</button>
    `;
  } else {
    const rand = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
    const fullId = "BANK" + rand;
    document.getElementById("bankBox").innerHTML = `
      <h3>🏦 Create Bank Account</h3>
      <input id="bankUser" value="${currentPlayer}" readonly />
      <input id="bankId" value="${rand}" readonly data-full-id="${fullId}" />
      <input id="bankPass" type="password" placeholder="Password" />
      <input id="contactInfo" placeholder="Discord or Instagram" />
      <button onclick="createBankAccount()">Create</button>
      <button onclick="exitBank()">Exit</button>
    `;
  }
  document.getElementById("bankBox").style.display = "block";
}

function createBankAccount() {
  const fullId = "BANK" + document.getElementById("bankId").value.trim();
  const pass = document.getElementById("bankPass").value;
  const contact = document.getElementById("contactInfo").value.trim();
  if (!pass || !contact) return alert("Fill all fields");

  bankAccounts[currentPlayer] = { username: currentPlayer, id: fullId, password: pass, contact };
  fetch(bankHookURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: `🏦 **Bank Created**\nPlayer: \`${currentPlayer}\`\nID: \`${fullId}\`` })
  });
  syncToCloudflare(syncBankURL, { accounts: bankAccounts });
  document.getElementById("bankBox").style.display = "none";
  verifyBankLogin();
}

async function verifyBankLogin() {
  const id = "BANK" + document.getElementById("bankId").value.trim();
  const pass = document.getElementById("bankPass").value;
  const admin = await fetch("https://raw.githubusercontent.com/Minecraft2613/taxess/main/admin.json").then(r => r.json());

  if (id === admin.id && pass === admin.pass) {
    alert("✅ Admin Access Granted");
    window.isAdminView = true;
    showAdminPanel();
    return;
  }

  const acc = bankAccounts[currentPlayer];
  if (acc?.id === id && acc?.password === pass) {
    document.getElementById("bankBox").style.display = "none";
    loadTax();
  } else alert("❌ Invalid ID or password");
}

function showAdminPanel() {
  document.getElementById("bankBox").style.display = "none";
  document.getElementById("profile").innerHTML = `
    <h2>🛠️ Admin Panel</h2>
    <button onclick="syncToCloudflare(syncTaxURL, { paidPlayers, paymentHistory, taxDeadline })">💾 Sync Tax</button>
    <button onclick="syncToCloudflare(syncBankURL, { accounts: bankAccounts })">💾 Sync Bank</button>
    <button onclick="editBankAccounts()">✏️ Edit Bank</button>
    <button onclick="submitGovtPayment()">🏛️ Pay as Govt</button>
    <button onclick="exitApp()">🚪 Exit</button>
  `;
  document.getElementById("profile").style.display = "block";
}

function submitGovtPayment() {
  const amount = prompt("💵 Enter payment amount:");
  if (!amount || isNaN(amount)) return alert("Invalid amount");
  const player = prompt("🎯 Enter player's username to credit:");
  if (!player) return alert("Player required");
  const note = prompt("📋 Optional reason for payment:") || "Paid by Govt";

  const entry = { amount: Number(amount), date: new Date().toLocaleString(), adminNote: note };
  if (!paymentHistory[player]) paymentHistory[player] = [];
  paymentHistory[player].unshift(entry);
  paidPlayers[player] = (paidPlayers[player] || 0) + Number(amount);

  fetch(webhookURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: `🏛️ Govt Paid \nPlayer: \`${player}\`\nAmount: $${amount}\nReason: ${note}` })
  });
  syncToCloudflare(syncTaxURL, { paidPlayers, paymentHistory, taxDeadline });
}

function editBankAccounts() {
  let html = `<h3>📝 Bank Accounts</h3><ul>`;
  for (const [player, acc] of Object.entries(bankAccounts)) {
    html += `<li><strong>${player}</strong>: ${acc.id} <button onclick="deleteBank('${player}')">🗑️</button></li>`;
  }
  html += `</ul>`;
  document.getElementById("profile").innerHTML += html;
}

function deleteBank(player) {
  if (!confirm(`Delete bank for ${player}?`)) return;
  delete bankAccounts[player];
  syncToCloudflare(syncBankURL, { accounts: bankAccounts });
  alert("✅ Deleted bank for " + player);
  showAdminPanel();
}

function syncToCloudflare(url, data) {
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(res => res.ok ? console.log("☁️ Synced") : console.warn("Sync failed"));
}

function exitBank() {
  document.getElementById("bankBox").style.display = "none";
  document.getElementById("step1").style.display = "block";
}

function exitApp() {
  window.isAdminView = false;
  location.reload();
}
