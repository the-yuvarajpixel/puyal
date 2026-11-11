// ============================================================================
// Firebase Configuration — RapidResponse Command
// ============================================================================
// Supply the Firebase web API key at deployment time by defining
// window.FIREBASE_API_KEY before loading this file. Firebase web API keys are
// public identifiers, not secrets; restrict them in Google Cloud Console and
// enforce access through Firebase Auth and Firestore Security Rules.

const firebaseApiKey = window.FIREBASE_API_KEY;
<script>
  window.FIREBASE_API_KEY = "YOUR_FIREBASE_WEB_API_KEY";
</script>,
  authDomain: "login-form-a7498.firebaseapp.com",
  projectId: "login-form-a7498",
  storageBucket: "login-form-a7498.firebasestorage.app",
  messagingSenderId: "236112498498",
  appId: "1:236112498498:web:def3bba42fc23233c72e21"
};

// Safe initialization of Firebase Auth and Firestore
try {
  if (!firebaseApiKey) {
    console.error('Firebase API key is missing. Define window.FIREBASE_API_KEY before loading firebase-config.js.');
  } else if (typeof firebase !== 'undefined') {
    if (!firebase.apps || firebase.apps.length === 0) {
      firebase.initializeApp(window.firebaseConfig);
    }
    window.auth = firebase.auth();
    window.db = firebase.firestore();
  }
} catch (e) {
  console.warn('Firebase initialization in fallback mode:', e);
}

var auth = window.auth;
var db = window.db;

// ============================================================================
// Auth Helper Utilities
// ============================================================================

/**
 * Get currently logged in user or redirect to login
 */
function requireAuth(role) {
  return new Promise((resolve, reject) => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        if (u && (u.role === role || localStorage.getItem('userRole') === role)) {
          resolve({ user: u, profile: u });
          return;
        }
      } catch (e) {}
    }

    if (window.auth && window.auth.onAuthStateChanged) {
      window.auth.onAuthStateChanged(async (user) => {
        if (!user) {
          window.location.href = 'index.html';
          reject('Not authenticated');
          return;
        }

        try {
          if (window.db) {
            const doc = await window.db.collection('users').doc(user.uid).get();
            if (doc.exists) {
              const data = doc.data();
              if (data.role !== role) {
                alert('Access denied. You do not have ' + role + ' privileges.');
                logout();
                reject('Wrong role');
                return;
              }
              resolve({ user, profile: data });
              return;
            }
          }
          resolve({ user, profile: { role: role, email: user.email } });
        } catch (err) {
          resolve({ user, profile: { role: role, email: user.email } });
        }
      });
    } else {
      window.location.href = 'index.html';
      reject('Auth unavailable');
    }
  });
}

/**
 * Logout and redirect
 */
function logout() {
  localStorage.removeItem('userRole');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('emailForSignIn');
  if (window.auth && window.auth.signOut) {
    window.auth.signOut().catch(() => {}).finally(() => {
      window.location.href = 'index.html';
    });
  } else {
    window.location.href = 'index.html';
  }
}

window.logout = logout;
window.requireAuth = requireAuth;
