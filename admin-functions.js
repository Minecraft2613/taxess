// admin-functions.js

// Load all admin-related logic here
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

async function verifyBankLogin() {
  const id = "BANK" + document.getElementById("bankId").value.trim();
  const pass = document.getElementById("bankPass").value;

  try {
    const adminRes = await fetch("https://raw.githubusercontent.com/Minecraft2613/taxess/main/admin.json");
    const admin = await adminRes.json();

    if (id === admin.id && pass === admin.pass) {
      alert("✅ Admin Access Granted");
      window.isAdminView = true;
      localStorage.setItem("username", "Ansh_2613");
      location.href = "admin.html";
      return;
    }
  } catch (e) {
    console.warn("⚠️ Admin check failed:", e);
  }

  alert("❌ Invalid Bank ID or Password.");
}

function sendUserInfo() {
  const method = localStorage.getItem("contactMethod") || "Discord";
  const value = localStorage.getItem("userContact") || "Unknown";
  const currentPlayer = localStorage.getItem("username") || "Unknown";

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
