import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Building2, Users, ArrowRight, LogOut } from 'lucide-react';

const TenantSelection: React.FC = () => {
  const { selectedTenant, availableTenants, selectTenant, setAvailableTenants, clearTenant } = useTenant();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Mock data - replace with actual API call
  useEffect(() => {
    // Simulate fetching user's tenants
    const mockTenants = [
      {
        id: '1',
        name: 'Acme Corporation',
        domain: 'acme.com',
        logo: '🏢'
      },
      {
        id: '2', 
        name: 'TechStart Inc',
        domain: 'techstart.io',
        logo: '🚀'
      },
      {
        id: '3',
        name: 'Global Solutions',
        domain: 'globalsolutions.com',
        logo: '🌍'
      }
    ];
    setAvailableTenants(mockTenants);
  }, [setAvailableTenants]);

  const handleTenantSelect = async (tenant: any) => {
    setLoading(true);
    try {
      selectTenant(tenant);
      // Here you would typically:
      // 1. Generate/refresh JWT token with tenant context
      // 2. Store tenant-specific data
      // 3. Initialize tenant-specific services
      
      // Navigate to mission control
      navigate('/mission-control');
    } catch (error) {
      console.error('Error selecting tenant:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      clearTenant();
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Select Your Organization
          </h1>
          <p className="text-gray-600">
            Choose which organization you'd like to access
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {availableTenants.map((tenant) => (
            <Card 
              key={tenant.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
              onClick={() => handleTenantSelect(tenant)}
            >
              <CardHeader className="text-center">
                <div className="text-4xl mb-2">{tenant.logo}</div>
                <CardTitle className="text-xl">{tenant.name}</CardTitle>
                <CardDescription>
                  {tenant.domain}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button 
                  className="w-full" 
                  disabled={loading}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTenantSelect(tenant);
                  }}
                >
                  {loading ? 'Loading...' : 'Select Organization'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="text-gray-600"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TenantSelection;

