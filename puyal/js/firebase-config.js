// ============================================================================
// Firebase Configuration — RapidResponse Command
// Replace these values with YOUR Firebase project credentials
// ============================================================================

const firebaseConfig = {
  apiKey: "AIzaSyBHsr1bOYcBb1VuVGj-I0e3UBaYYT7uMKI",
  authDomain: "login-form-a7498.firebaseapp.com",
  projectId: "login-form-a7498",
  storageBucket: "login-form-a7498.firebasestorage.app",
  messagingSenderId: "236112498498",
  appId: "1:236112498498:web:def3bba42fc23233c72e21"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ============================================================================
// Auth Helper Utilities
// ============================================================================

/**
 * Get currently logged in user or redirect to login
 */
function requireAuth(role) {
  return new Promise((resolve, reject) => {
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = 'index.html';
        reject('Not authenticated');
        return;
      }

      // Check role from Firestore
      try {
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) {
          const data = doc.data();
          if (data.role !== role) {
            alert('Access denied. You do not have ' + role + ' privileges.');
            auth.signOut();
            window.location.href = 'index.html';
            reject('Wrong role');
            return;
          }
          resolve({ user, profile: data });
        } else {
          // First time — create profile with the requested role
          const profile = {
            email: user.email,
            role: role,
            displayName: user.displayName || user.email.split('@')[0],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          };
          await db.collection('users').doc(user.uid).set(profile);
          resolve({ user, profile });
        }
      } catch (err) {
        console.error('Auth check error:', err);
        resolve({ user, profile: { role: role, email: user.email } });
      }
    });
  });
}

/**
 * Logout and redirect
 */
function logout() {
  auth.signOut().then(() => {
    localStorage.removeItem('userRole');
    window.location.href = 'index.html';
  });
}
