// public/firebase-config.js

// Tus credenciales de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBBmgEN15T8B_MJgD_qx6RFCwbKf60rZFU",
  authDomain: "quenosevenza.firebaseapp.com",
  projectId: "quenosevenza",
  storageBucket: "quenosevenza.firebasestorage.app",
  messagingSenderId: "251564852846",
  appId: "1:251564852846:web:d117990b583386f412c87f"
};

// Inicializar Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Conectar con la Base de Datos Firestore
const db = firebase.firestore();