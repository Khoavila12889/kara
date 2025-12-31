import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { logger } from './logger';

// TODO: Replace with your Firebase project's configuration
const firebaseConfig = {
  apiKey: "AIzaSyAtarlXbzWPNJKhY7NKpCniTJvytusimiU",
  authDomain: "tv-app-2025.firebaseapp.com",
  databaseURL: "https://tv-app-2025-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tv-app-2025",
  storageBucket: "tv-app-2025.firebasestorage.app",
  messagingSenderId: "959400368568",
  appId: "1:959400368568:web:0a703234ad4b61b6ae574d"
};

let app;
let database;

try {
  // Initialize Firebase
  app = initializeApp(firebaseConfig);
  // Get a reference to the database service
  database = getDatabase(app);
  logger.info('Firebase initialized successfully!');
} catch (error) {
  logger.error('Firebase initialization failed:', error);
}

export { database };
