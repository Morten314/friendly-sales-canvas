// import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
// import { 
//   User, 
//   signInWithEmailAndPassword, 
//   signOut, 
//   onAuthStateChanged,
//   createUserWithEmailAndPassword 
// } from 'firebase/auth';
// import { auth } from '../lib/firebase';

// interface AuthContextType {
//   currentUser: User | null;
//   orgId: string | null;
//   orgName: string | null;
//   login: (email: string, password: string) => Promise<void>;
//   signup: (email: string, password: string) => Promise<void>;
//   logout: () => Promise<void>;
//   fetchOrgId: (userId: string) => Promise<{ orgId: string | null; orgName: string | null }>;
//   getUserId: () => string | null; // Helper to get user_id for API calls (returns hardcoded value for testing)
//   loading: boolean;
// }

// const AuthContext = createContext<AuthContextType | undefined>(undefined);

// export const useAuth = () => {
//   const context = useContext(AuthContext);
//   if (context === undefined) {
//     throw new Error('useAuth must be used within an AuthProvider');
//   }
//   return context;
// };

// interface AuthProviderProps {
//   children: ReactNode;
// }

// // TODO: TEMPORARY - Hardcoded values for testing. Remove these constants when done testing.
// const HARDCODED_USER_ID = "user123";
// const HARDCODED_ORG_ID = "abc-123-def-456";
// const HARDCODED_ORG_NAME = null; // or set to a name if needed

// export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
//   const [currentUser, setCurrentUser] = useState<User | null>(null);
//   const [orgId, setOrgId] = useState<string | null>(null);
//   const [orgName, setOrgName] = useState<string | null>(null);
//   const [loading, setLoading] = useState(true);

//   const signup = async (email: string, password: string) => {
//     await createUserWithEmailAndPassword(auth, email, password);
//   };

//   const login = async (email: string, password: string) => {
//     await signInWithEmailAndPassword(auth, email, password);
//   };

//   const logout = async () => {
//     await signOut(auth);
//     // Clear org_id and org_name on logout
//     setOrgId(null);
//     setOrgName(null);
//     if (currentUser?.uid) {
//       localStorage.removeItem(`org_id_${currentUser.uid}`);
//       localStorage.removeItem(`org_name_${currentUser.uid}`);
//     }
//   };

//   // Helper function to get user_id for API calls
//   // TODO: TEMPORARY - Returns hardcoded user_id for testing. Remove this when done testing.
//   const getUserId = useCallback((): string | null => {
//     // For testing: return hardcoded user_id
//     // When done testing, change to: return currentUser?.uid || null;
//     return HARDCODED_USER_ID;
//   }, []);

//   const fetchOrgId = useCallback(async (userId: string): Promise<{ orgId: string | null; orgName: string | null }> => {
//     // TODO: TEMPORARY - Hardcoded values for testing. Remove this and restore API call when done testing.
//     // Return hardcoded values for testing
//     setOrgId(HARDCODED_ORG_ID);
//     setOrgName(HARDCODED_ORG_NAME);
//     return { orgId: HARDCODED_ORG_ID, orgName: HARDCODED_ORG_NAME };
    
//     /* ORIGINAL CODE - Commented out for testing
//     try {
//       // Check localStorage first
//       const storedOrgId = localStorage.getItem(`org_id_${userId}`);
//       const storedOrgName = localStorage.getItem(`org_name_${userId}`);
//       if (storedOrgId && storedOrgName) {
//         setOrgId(storedOrgId);
//         setOrgName(storedOrgName);
//         return { orgId: storedOrgId, orgName: storedOrgName };
//       }

//       // Fetch from API
//       const response = await fetch(`/api/org?user_id=${userId}`, {
//         method: 'GET',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//       });

//       if (!response.ok) {
//         console.error('Failed to fetch org data:', response.status, response.statusText);
//         return { orgId: null, orgName: null };
//       }

//       const data = await response.json();
      
//       if (data.status === 'success' && data.org_id) {
//         // Store in state and localStorage
//         const fetchedOrgId = data.org_id;
//         const fetchedOrgName = data.org_name || null;
        
//         setOrgId(fetchedOrgId);
//         setOrgName(fetchedOrgName);
//         localStorage.setItem(`org_id_${userId}`, fetchedOrgId);
//         if (fetchedOrgName) {
//           localStorage.setItem(`org_name_${userId}`, fetchedOrgName);
//         }
//         return { orgId: fetchedOrgId, orgName: fetchedOrgName };
//       }

//       return { orgId: null, orgName: null };
//     } catch (error) {
//       console.error('Error fetching org data:', error);
//       return { orgId: null, orgName: null };
//     }
//     */
//   }, []);

//   useEffect(() => {
//     const unsubscribe = onAuthStateChanged(auth, (user) => {
//       setCurrentUser(user);
      
//       // TODO: TEMPORARY - Hardcoded values for testing. Remove this and restore original logic when done testing.
//       // Note: user_id comes from currentUser?.uid in other components. 
//       // If you need to hardcode user_id everywhere, search for "currentUser?.uid" and replace with HARDCODED_USER_ID
//       // Set hardcoded org_id and org_name for testing
//       setOrgId(HARDCODED_ORG_ID);
//       setOrgName(HARDCODED_ORG_NAME);
//       setLoading(false);
      
//       /* ORIGINAL CODE - Commented out for testing
//       // Load org_id and org_name from localStorage when user changes
//       if (user?.uid) {
//         const storedOrgId = localStorage.getItem(`org_id_${user.uid}`);
//         const storedOrgName = localStorage.getItem(`org_name_${user.uid}`);
//         if (storedOrgId) {
//           setOrgId(storedOrgId);
//           if (storedOrgName) {
//             setOrgName(storedOrgName);
//           }
//         } else {
//           // Fetch org data if not in localStorage
//           fetchOrgId(user.uid);
//         }
//       } else {
//         setOrgId(null);
//         setOrgName(null);
//       }
      
//       setLoading(false);
//       */
//     });

//     return unsubscribe;
//   }, [fetchOrgId]);

//   const value = {
//     currentUser,
//     orgId,
//     orgName,
//     login,
//     signup,
//     logout,
//     fetchOrgId,
//     getUserId,
//     loading
//   };

//   return (
//     <AuthContext.Provider value={value}>
//       {!loading && children}
//     </AuthContext.Provider>
//   );
// };

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { buildApiUrl } from '../lib/api';

interface AuthContextType {
  currentUser: User | null;
  orgId: string | null;
  orgName: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchOrgId: (userId: string) => Promise<{ orgId: string | null; orgName: string | null }>;
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
  const [orgName, setOrgName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const signup = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
    // Clear org_id and org_name on logout
    setOrgId(null);
    setOrgName(null);
    if (currentUser?.uid) {
      localStorage.removeItem(`org_id_${currentUser.uid}`);
      localStorage.removeItem(`org_name_${currentUser.uid}`);
    }
  };

  const fetchOrgId = useCallback(async (userId: string): Promise<{ orgId: string | null; orgName: string | null }> => {
    try {
      // Check localStorage first
      const storedOrgId = localStorage.getItem(`org_id_${userId}`);
      const storedOrgName = localStorage.getItem(`org_name_${userId}`);
      if (storedOrgId && storedOrgName) {
        setOrgId(storedOrgId);
        setOrgName(storedOrgName);
        return { orgId: storedOrgId, orgName: storedOrgName };
      }

      // Fetch from API
      const response = await fetch(`${buildApiUrl('org')}?user_id=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch org data:', response.status, response.statusText);
        return { orgId: null, orgName: null };
      }

      const data = await response.json();
      
      if (data.status === 'success' && data.org_id) {
        // Store in state and localStorage
        const fetchedOrgId = data.org_id;
        const fetchedOrgName = data.org_name || null;
        
        setOrgId(fetchedOrgId);
        setOrgName(fetchedOrgName);
        localStorage.setItem(`org_id_${userId}`, fetchedOrgId);
        if (fetchedOrgName) {
          localStorage.setItem(`org_name_${userId}`, fetchedOrgName);
        }
        return { orgId: fetchedOrgId, orgName: fetchedOrgName };
      }

      return { orgId: null, orgName: null };
    } catch (error) {
      console.error('Error fetching org data:', error);
      return { orgId: null, orgName: null };
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      
      // Load org_id and org_name from localStorage when user changes
      if (user?.uid) {
        const storedOrgId = localStorage.getItem(`org_id_${user.uid}`);
        const storedOrgName = localStorage.getItem(`org_name_${user.uid}`);
        if (storedOrgId) {
          setOrgId(storedOrgId);
          if (storedOrgName) {
            setOrgName(storedOrgName);
          }
        } else {
          // Fetch org data if not in localStorage
          fetchOrgId(user.uid);
        }
      } else {
        setOrgId(null);
        setOrgName(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, [fetchOrgId]);

  const value = {
    currentUser,
    orgId,
    orgName,
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

