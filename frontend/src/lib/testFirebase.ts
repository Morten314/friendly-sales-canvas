// Test Firebase connection
import { auth } from './firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export const testFirebaseConnection = async () => {
  try {
    console.log('Testing Firebase connection...');
    console.log('Auth instance:', auth);
    console.log('Auth app:', auth.app);
    
    // This will fail but will show us if Firebase is properly configured
    await signInWithEmailAndPassword(auth, 'test@test.com', 'testpassword');
  } catch (error: any) {
    console.log('Firebase connection test result:', error.code);
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      console.log('✅ Firebase is properly configured!');
    } else if (error.code === 'auth/configuration-not-found') {
      console.log('❌ Firebase Authentication not enabled in console');
    } else {
      console.log('Firebase error:', error);
    }
  }
};




