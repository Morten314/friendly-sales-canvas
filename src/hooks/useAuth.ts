import { useAuth as useFirebaseAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import jwtManager from '../lib/jwt';
import { useEffect, useState } from 'react';

export const useAuth = () => {
  const firebaseAuth = useFirebaseAuth();
  const { selectedTenant } = useTenant();
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);

  // Generate JWT token when user is authenticated and tenant is selected
  useEffect(() => {
    const generateToken = async () => {
      if (firebaseAuth.currentUser && selectedTenant && !jwtToken) {
        setIsGeneratingToken(true);
        try {
          const token = await jwtManager.generateToken(
            firebaseAuth.currentUser, 
            selectedTenant.id
          );
          setJwtToken(token);
        } catch (error) {
          console.error('Failed to generate JWT token:', error);
        } finally {
          setIsGeneratingToken(false);
        }
      }
    };

    generateToken();
  }, [firebaseAuth.currentUser, selectedTenant, jwtToken]);

  // Clear JWT token when user logs out or tenant changes
  useEffect(() => {
    if (!firebaseAuth.currentUser || !selectedTenant) {
      jwtManager.clearTokens();
      setJwtToken(null);
    }
  }, [firebaseAuth.currentUser, selectedTenant]);

  const logout = async () => {
    jwtManager.clearTokens();
    setJwtToken(null);
    await firebaseAuth.logout();
  };

  return {
    ...firebaseAuth,
    jwtToken,
    isGeneratingToken,
    logout
  };
};




