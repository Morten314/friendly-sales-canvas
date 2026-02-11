import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthContextType {
  currentUser: User | null;
  orgId: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchOrgId: (userId: string) => Promise<string | null>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const signup = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
    // Clear org_id on logout
    setOrgId(null);
    if (currentUser?.uid) {
      localStorage.removeItem(`org_id_${currentUser.uid}`);
    }
  };

  const fetchOrgId = useCallback(async (userId: string): Promise<string | null> => {
    try {
      // Check localStorage first
      const storedOrgId = localStorage.getItem(`org_id_${userId}`);
      if (storedOrgId) {
        setOrgId(storedOrgId);
        return storedOrgId;
      }

      // Fetch from API
      const response = await fetch(`/api/org?user_id=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch org_id:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      
      if (data.status === 'success' && data.org_id) {
        // Store in state and localStorage
        setOrgId(data.org_id);
        localStorage.setItem(`org_id_${userId}`, data.org_id);
        return data.org_id;
      }

      return null;
    } catch (error) {
      console.error('Error fetching org_id:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      
      // Load org_id from localStorage when user changes
      if (user?.uid) {
        const storedOrgId = localStorage.getItem(`org_id_${user.uid}`);
        if (storedOrgId) {
          setOrgId(storedOrgId);
        } else {
          // Fetch org_id if not in localStorage
          fetchOrgId(user.uid);
        }
      } else {
        setOrgId(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, [fetchOrgId]);

  const value = {
    currentUser,
    orgId,
    login,
    signup,
    logout,
    fetchOrgId,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

