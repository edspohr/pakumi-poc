import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC8JAP9Hoecdw1Ffsn4znJgXxaiJCI2B-s",
  authDomain: "pakumi-poc.firebaseapp.com",
  projectId: "pakumi-poc",
  storageBucket: "pakumi-poc.firebasestorage.app",
  messagingSenderId: "87897128692",
  appId: "1:87897128692:web:f088ee072ba83c09f9a8a1",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
