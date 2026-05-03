// ================================================
//  firebase-config.js — Firebase Initialization
//  ThermoExplore Multiplayer Session System
// ================================================
//
// ⚙️ CARA SETUP FIREBASE (5 menit, gratis):
// 1. Buka https://console.firebase.google.com/
// 2. Klik "Add project" → beri nama (misal: thermoexplore) → Continue
// 3. Di sidebar kiri → "Realtime Database" → "Create Database"
// 4. Pilih region (asia-southeast1) → "Start in test mode" → Enable
// 5. Di ⚙️ Project Settings → "Your apps" → klik icon </>
// 6. Register app → salin firebaseConfig → paste ke FIREBASE_CONFIG di bawah
// ------------------------------------------------

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBDcKmaY81kTYIL1hkn1XfKM_H1E64JIO4",
  authDomain: "vistara-784c2.firebaseapp.com",
  databaseURL: "https://vistara-784c2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "vistara-784c2",
  storageBucket: "vistara-784c2.firebasestorage.app",
  messagingSenderId: "144793687520",
  appId: "1:144793687520:web:432fccdf64739efc518785",
  measurementId: "G-20ENPSE6QV"
};

// Auto-detect apakah config sudah diisi
const _configured = !FIREBASE_CONFIG.apiKey.includes('GANTI');

if (_configured) {
  try {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    window.firebaseDB = firebase.database();
    window.FIREBASE_READY = true;
    console.log('✅ Firebase connected');
  } catch (e) {
    console.error('❌ Firebase init error:', e);
    window.FIREBASE_READY = false;
  }
} else {
  console.warn('⚠️  Firebase belum dikonfigurasi. Jalankan dalam mode offline/lokal.');
  window.FIREBASE_READY = false;
}
