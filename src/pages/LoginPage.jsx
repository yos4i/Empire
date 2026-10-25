import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Spinner } from '../components/ui/spinner';
import { useAuth } from '../contexts/AuthContext';

const homeFor = (user) => (user.role === 'admin' ? '/admin' : `/soldier/${user.uid}`);

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate(homeFor(user), { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(username.trim(), password);
      // navigation happens in the effect above once `user` is set
    } catch (err) {
      setError(err.message || 'ההתחברות נכשלה');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary/10 via-background to-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/icon-192.png" alt="" className="mb-4 h-16 w-16 rounded-2xl shadow-lg shadow-primary/30" />
          <h1 className="text-3xl font-extrabold tracking-tight">אימפריה</h1>
          <p className="mt-1 text-muted-foreground">מערכת סידור עבודה</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border bg-card p-6 shadow-soft">
          <div className="space-y-2">
            <Label htmlFor="username">שם משתמש</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="שם משתמש"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">סיסמה</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="סיסמה"
                autoComplete="current-password"
                required
                className="pl-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute left-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
                aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={submitting || !username || !password}>
            {submitting ? <Spinner className="text-primary-foreground" /> : 'התחברות'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
