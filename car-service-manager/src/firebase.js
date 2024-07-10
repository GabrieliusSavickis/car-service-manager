import firebase from 'firebase/app';
import 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyCcoVBLsxIhZrd3udVlHzC3dXLRNZ9lRzI",
    authDomain: "carservicemanager-54f05.firebaseapp.com",
    projectId: "carservicemanager-54f05",
    storageBucket: "carservicemanager-54f05.appspot.com",
    messagingSenderId: "465419811461",
    appId: "1:465419811461:web:b91fbef2e483d98e09c7ec"
};

firebase.initializeApp(firebaseConfig);

export const auth = firebase.auth();