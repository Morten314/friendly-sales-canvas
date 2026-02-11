import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useToast } from '../hooks/use-toast';
import { Loader2, Mail, Lock, Building2 } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [organization, setOrganization] = useState('Brewra');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  
  const { login, signup, currentUser, fetchOrgId, loading: authLoading } = useAuth();
  const { selectTenant } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Don't auto-redirect authenticated users - let them see the login page if they visit it directly
  // The ProtectedRoute will handle redirecting unauthenticated users trying to access protected routes

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (isSignUp) {
      if (!fullName) {
        setError('Please enter your full name');
        return;
      }
      if (!organization) {
        setError('Please select an organization');
        return;
      }
    }

    try {
      setError('');
      setLoading(true);
      
      if (isSignUp) {
        await signup(email, password);
        // Store full name in localStorage (will be associated with user after login)
        // We'll store it temporarily and associate it with the user ID after they log in
        localStorage.setItem('pendingFullName', fullName);
        // After successful signup, show success message and switch to login
        toast({
          title: "Account Created Successfully!",
          description: "Please sign in with your credentials to continue.",
          variant: "default",
        });
        setIsSignUp(false);
        setError('');
        // Clear password and full name fields
        setPassword('');
        setFullName('');
      } else {
        await login(email, password);
        // Fetch org_id and org_name after successful login
        const user = auth.currentUser;
        if (user?.uid) {
          const { orgId: fetchedOrgId, orgName: fetchedOrgName } = await fetchOrgId(user.uid);
          // Auto-select organization after login using fetched org_id and org_name or fallback to brewra
          const orgIdToUse = fetchedOrgId || 'brewra';
          const orgNameToUse = fetchedOrgName || 'Brewra';
          selectTenant({
            id: orgIdToUse,
            name: orgNameToUse,
            domain: `${orgIdToUse}.com`
          });
          // Store full name if it was pending from signup, or retrieve existing
          const pendingFullName = localStorage.getItem('pendingFullName');
          if (pendingFullName) {
            localStorage.setItem(`userFullName_${user.uid}`, pendingFullName);
            localStorage.removeItem('pendingFullName');
          }
        }
        // Navigate to mission control after successful login
        navigate('/mission-control');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img 
              src="/logo.png" 
              alt="Brewra Logo" 
              className="h-16 w-auto object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isSignUp ? 'Create Your Account' : 'Welcome Back'}
          </h1>
          <p className="text-gray-600">
            {isSignUp 
              ? 'Join us and start your journey' 
              : 'Sign in to continue to your dashboard'
            }
          </p>
        </div>

        <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-semibold text-center text-gray-900">
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </CardTitle>
            <CardDescription className="text-center text-gray-500">
              {isSignUp 
                ? 'Enter your details to create a new account'
                : 'Enter your credentials to access your account'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}
              
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium text-gray-700">
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    required={isSignUp}
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="organization" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Select organization
                  </Label>
                  <Select value={organization} onValueChange={setOrganization}>
                    <SelectTrigger id="organization" className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Brewra">Brewra</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium shadow-md hover:shadow-lg transition-all duration-200" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isSignUp ? 'Creating Account...' : 'Signing In...'}
                  </>
                ) : (
                  isSignUp ? 'Create Account' : 'Sign In'
                )}
              </Button>
            </form>
            
            {/* Sign up/Sign in toggle - only show at bottom for sign in page */}
            {!isSignUp && (
              <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <Button
                    variant="link"
                    onClick={() => setIsSignUp(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium p-0 h-auto"
                  >
                    Sign up
                  </Button>
                </p>
              </div>
            )}

            {/* Back to sign in - only show on signup page */}
            {isSignUp && (
              <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <Button
                    variant="link"
                    onClick={() => {
                      setIsSignUp(false);
                      setError('');
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium p-0 h-auto"
                  >
                    Sign in
                  </Button>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

