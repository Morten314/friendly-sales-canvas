 
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDm4x-p8RLWJBYUZ_Mo5kOwbEBF69-QSps",
  authDomain: "multi-tenant-50161.firebaseapp.com",
  projectId: "multi-tenant-50161",
  storageBucket: "multi-tenant-50161.firebasestorage.app",
  messagingSenderId: "710721694093",
  appId: "1:710721694093:web:7807f8a4ef544626a575c4",
  measurementId: "G-Z8K2FCKHZZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Analytics (optional)
const analytics = getAnalytics(app);

// Verify Firebase is properly initialized
console.log('Firebase initialized:', app.name);
console.log('Auth initialized:', auth.app.name);

export default app;