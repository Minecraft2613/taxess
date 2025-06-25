

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

  if (platform === "bedrock") {
    wrapper.innerHTML = `
      <label for="bedrockInput">Minecraft Username:</label>
      <div style="display:flex; align-items:center;">
        <span style="padding: 7px 10px; background: #222; border: 1px solid #555; border-right: none; color: #ccc;">.</span>
        <input id="bedrockInput" type="text" placeholder="Bedrock Username" style="flex:1; height: 35px; border: 1px solid #555; border-left: none;" />
      </div>
    `;
  } else {
    wrapper.innerHTML = `
      <label for="mcid">Minecraft Username:</label>
      <input id="mcid" type="text" placeholder="Java Username" />
    `;
  }
}

function sendUserInfo() {
  const method = localStorage.getItem("contactMethod") || "Discord";
  const value = localStorage.getItem("userContact") || "Unknown";
  fetch(infoHookURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [{
        title: "📇 New User Info",
        color: 0x33ccff,
        fields: [
          { name: "Method", value: method, inline: true },
          { name: "Contact", value: value, inline: true },
          { name: "MC Username", value: currentPlayer, inline: true }
        ],
        timestamp: new Date().toISOString()
      }]
    })
  });
}

async function checkTax() {
  const platform = document.getElementById("platformSelect")?.value;
  let inputField;
  if (platform === "bedrock") {
    inputField = document.getElementById("bedrockInput");
    if (!inputField || !inputField.value.trim()) return alert("❌ Please enter your Bedrock username");
    currentPlayer = "." + inputField.value.trim();
  } else {
    inputField = document.getElementById("mcid");
    if (!inputField || !inputField.value.trim()) return alert("❌ Please enter your Java username");
    currentPlayer = inputField.value.trim();
  }
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
  const [taxRes, bankRes] = await Promise.all([
    fetch(taxURL),
    fetch(bankURL)
  ]);
  const taxData = await taxRes.json();
  const bankData = await bankRes.json();
  paidPlayers = taxData.paidPlayers || {};
  paymentHistory = taxData.paymentHistory || {};
  bankAccounts = bankData.accounts || {};
  taxDeadline = taxData.taxDeadline || {};
}

function askBankDetails() {
  const allAccounts = bankAccounts || {};
  const playerKey = Object.keys(allAccounts).find(key => key.toLowerCase() === currentPlayer.toLowerCase());
  const existing = playerKey ? allAccounts[playerKey] : null;

  if (existing) {
    document.getElementById("bankBox").innerHTML = `
      <h3>🔐 Login to Bank</h3>
      <input id="bankUser" value="${existing.username}" readonly />
      <input id="bankId" placeholder="Bank ID (numbers only)" />
      <input id="bankPass" type="password" placeholder="Password" />
      <button onclick="verifyBankLogin()">Login</button>
      <button onclick="exitBank()">Exit</button>
    `;
  } else {
    const randomNum = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
    const fullBankId = "BANK" + randomNum;
    document.getElementById("bankBox").innerHTML = `
      <h3>🏦 Create Bank Account</h3>
      <input id="bankUser" value="${currentPlayer}" readonly />
      <input id="bankId" value="${randomNum}" readonly data-full-id="${fullBankId}" />
      <button onclick="copyBankId()">📋 Copy</button>
      <input id="bankPass" type="password" placeholder="Password" />
      <input id="contactInfo" placeholder="Discord or Instagram" />
      <button onclick="createBankAccount()">Create</button>
      <button onclick="exitBank()">Exit</button>
    `;
  }

  document.getElementById("bankBox").style.display = "block";
}

function copyBankId() {
  const bankId = document.getElementById("bankId").value;
  navigator.clipboard.writeText(bankId).then(() => alert("📋 Copied Bank ID!"));
}

function exitBank() {
  document.getElementById("bankBox").style.display = "none";
  document.getElementById("step1").style.display = "block";
}

function createBankAccount() {
  const username = document.getElementById("bankUser").value.trim();
  const pass = document.getElementById("bankPass").value;
  const contact = document.getElementById("contactInfo").value.trim();
  const fullId = document.getElementById("bankId").dataset.fullId;
  if (!username || !fullId || !pass || !contact) return alert("Fill all fields");

  bankAccounts[currentPlayer] = { username, id: fullId, password: pass, contact };
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
  const adminRes = await fetch("https://raw.githubusercontent.com/Minecraft2613/taxess/main/admin.json");
  const admin = await adminRes.json();

  if (id === admin.id && pass === admin.pass) {
    alert("✅ Admin Access Granted");
    window.isAdminView = true;
    document.getElementById("bankBox").style.display = "none";
    document.getElementById("profile").innerHTML = `
      <h2>🛠️ Admin Panel</h2>
      <p>Logged in as Admin</p>
      <div class="btn-row">
        <button onclick="syncToCloudflare(syncTaxURL, { paidPlayers, paymentHistory, taxDeadline })">💾 Sync Tax</button>
        <button onclick="syncToCloudflare(syncBankURL, { accounts: bankAccounts })">💾 Sync Bank</button>
        <button onclick="exitApp()">🚪 Exit</button>
      </div>
    `;
    document.getElementById("profile").style.display = "block";
    return;
  }

  const account = bankAccounts[currentPlayer];
  if (account?.id === id && account?.password === pass) {
    document.getElementById("bankBox").style.display = "none";
    loadTax();
  } else {
    alert("❌ Invalid ID or password.");
  }
}

function syncToCloudflare(url, data) {
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(res => res.ok ? console.log("☁️ Synced") : console.warn("Sync failed"));
}

function exitApp() {
  window.isAdminView = false;
  location.reload();
}
