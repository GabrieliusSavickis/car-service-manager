import 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'; // Import Firestore


const firebaseConfig = {
    apiKey: "AIzaSyCcoVBLsxIhZrd3udVlHzC3dXLRNZ9lRzI",
    authDomain: "carservicemanager-54f05.firebaseapp.com",
    projectId: "carservicemanager-54f05",
    storageBucket: "carservicemanager-54f05.appspot.com",
    messagingSenderId: "465419811461",
    appId: "1:465419811461:web:b91fbef2e483d98e09c7ec"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app); // Initialize Firestore

const signInWithEmailAndPasswordFunction = (auth, email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export { auth, signInWithEmailAndPasswordFunction, signOut, firestore };