import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { signIn, loading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/soldier');
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const userData = await signIn(username, password);
      if (userData.role === 'admin') {
        navigate('/admin');
      } else if (userData.role === 'soldier') {
        // Redirect soldier to their specific route
        navigate(`/soldier/${userData.uid}`);
      } else {
        navigate('/soldier');
      }
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900"> אימפריה</h1>
          <h2 className="text-xl font-semibold text-gray-700">מערכת סידור עבודה</h2>
          <p className="text-gray-500">התחבר למערכת כדי להמשיך</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">שם משתמש</Label>
            <Input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="הזן שם משתמש" required className="text-right" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">סיסמה</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="הזן סיסמה" required className="text-right" />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !username || !password}>
            {loading ? 'מתחבר...' : 'התחבר'}
          </Button>

          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 p-2 rounded">
              {error}
            </div>
          )}
        </form>

      </Card>
    </div>
  );
};

export default LoginPage;



