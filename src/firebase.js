import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBwvmtzXA3I1H80Pb69UdwohYUueKn7-T0",
  authDomain: "bamacada-7be82.firebaseapp.com",
  projectId: "bamacada-7be82",
  storageBucket: "bamacada-7be82.appspot.com",  // <-- FIXED
  messagingSenderId: "802317047924",
  appId: "1:802317047924:web:4e47147b9a911fc77d1921",
  measurementId: "G-GR9HY7V6VQ"
};


const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const db = getFirestore(app);
