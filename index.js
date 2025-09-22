import fetch from "node-fetch";
import dotenv from "dotenv";
import readlineSync from "readline-sync";
import cron from "node-cron";

dotenv.config();

const API_PROFILE = "https://hub.playprovidence.io/api/profile";
const API_CHECKIN = "https://hub.playprovidence.io/api/daily-checkin/checkin";
const API_SESSION = "https://hub.playprovidence.io/api/auth/session";
const SESSION_TOKEN = process.env.SESSION_TOKEN;

function printHeader(title) {
  console.log("\n===============================");
  console.log("🚀 " + title);
  console.log("===============================");
}

async function checkSessionExpiry() {
  const res = await fetch(API_SESSION, {
    headers: {
      "accept": "*/*",
      "cookie": `__Secure-authjs.session-token=${SESSION_TOKEN}`,
    },
  });

  if (!res.ok) {
    console.log(`❌ Gagal cek session: ${res.status}`);
    return;
  }

  const data = await res.json();
  const expiresAt = new Date(data.expires);
  const now = new Date();
  const diffMs = expiresAt - now;

  if (diffMs <= 0) {
    console.log("⚠️ Session sudah expired!");
    return;
  }

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
  const diffMinutes = Math.floor((diffMs / (1000 * 60)) % 60);

  console.log(`📅 Expired pada : ${expiresAt.toISOString()}`);
  console.log(`⏳ Sisa waktu   : ${diffDays} hari, ${diffHours} jam, ${diffMinutes} menit`);
}

async function getProfile() {
  try {
    const res = await fetch(API_PROFILE, {
      headers: {
        "accept": "*/*",
        "cookie": `__Secure-authjs.session-token=${SESSION_TOKEN}`,
      },
    });

    if (res.status === 401) {
      console.log("❌ Unauthorized (401). Token mungkin sudah kadaluarsa.");
      return;
    }

    if (!res.ok) throw new Error(`Request gagal: ${res.status} ${res.statusText}`);

    const { profile } = await res.json();

    printHeader("Profil Kamu");
    console.log(`👤 Nama       : ${profile.name}`);
    console.log(`📧 Email      : ${profile.email}`);
    console.log(`🪪 User ID    : ${profile.user_id}`);
    console.log(`💰 Tokens     : ${profile.tokens}`);
    console.log(`🎯 Quests     : ${profile.completed_quests}/${profile.total_quests}`);
    console.log(`🔑 Wallet     : ${profile.primary_wallet_address}`);
    console.log("===============================\n");

    await checkSessionExpiry();

    console.log("\n👉 Pilihan:");
    console.log("1. Claim sekali (tentukan jam)");
    console.log("2. Claim otomatis setiap hari (jadwal tetap)");

    const pilih = readlineSync.question("Pilih (1/2): ");

    if (pilih === "1") {
      const jam = readlineSync.question("Masukkan jam (format 24h, contoh 15:45): ");
      const [hour, minute] = jam.split(":").map(Number);

      if (isNaN(hour) || isNaN(minute)) {
        console.log("❌ Format jam tidak valid.");
        return;
      }

      console.log(`⏳ Daily check-in akan dijalankan sekali pada jam ${jam}.`);

      cron.schedule(`${minute} ${hour} * * *`, async () => {
        console.log(`\n🕒 Eksekusi claim sekali pada: ${new Date().toLocaleString()}`);
        await dailyCheckin();
        process.exit(0); // keluar setelah eksekusi sekali
      });
    } else if (pilih === "2") {
      const jam = readlineSync.question("Masukkan jam (format 24h, contoh 08:30): ");
      const [hour, minute] = jam.split(":").map(Number);

      if (isNaN(hour) || isNaN(minute)) {
        console.log("❌ Format jam tidak valid.");
        return;
      }

      console.log(`⏳ Daily check-in dijadwalkan jam ${jam} setiap hari.`);

      cron.schedule(`${minute} ${hour} * * *`, async () => {
        console.log(`\n🕒 Waktu check-in otomatis: ${new Date().toLocaleString()}`);
        await dailyCheckin();
      });

      console.log("📌 Biarkan program ini tetap berjalan agar scheduler aktif.");
    } else {
      console.log("🙏 Tidak melakukan apa-apa.");
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

async function dailyCheckin() {
  try {
    const res = await fetch(API_CHECKIN, {
      method: "POST",
      headers: {
        "accept": "*/*",
        "cookie": `__Secure-authjs.session-token=${SESSION_TOKEN}`,
      },
    });

    if (!res.ok) throw new Error(`Request gagal: ${res.status} ${res.statusText}`);
    const data = await res.json();

    if (data.success) {
      printHeader("Daily Check-in Berhasil 🎉");
      console.log(`📅 Streak Hari   : ${data.data.streakDay}`);
      console.log(`⭐ XP Didapat    : ${data.data.xpEarned}`);
      console.log(`🪙 Token Didapat : ${data.data.tokensEarned}`);
      console.log(`🎯 Total XP      : ${data.data.updatedStats.totalXP}`);
      console.log(`🏆 Level         : ${data.data.updatedStats.level}`);
      console.log(`🔥 Current Streak: ${data.data.updatedStats.currentStreak}`);
      console.log(`📊 Total Checkin : ${data.data.updatedStats.totalCheckins}`);
      console.log("===============================\n");
    } else {
      console.log("❌ Gagal check-in:", data.message);
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

getProfile();
