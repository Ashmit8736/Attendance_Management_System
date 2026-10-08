import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { useToast, getErrorMessage } from '../../context/ToastContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { Clock, Shield, Users, User, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';

export const LoginPage = () => {
  usePageTitle('Sign in');
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoCreds, setDemoCreds] = useState(null);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const loadDemoCreds = async () => {
      try {
        const res = await authService.getDemoCredentials();
        if (res.data) {
          setDemoCreds(res.data);
        }
      } catch {
        // Demo logins are optional (disabled in production); the page works without them
      }
    };
    loadDemoCreds();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const signedIn = await login(email, password);
      toast.success(`Welcome back, ${signedIn.name.split(' ')[0]}!`);
      navigate('/');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Login failed.'));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (targetRole) => {
    if (!demoCreds?.[targetRole]) return;
    setEmail(demoCreds[targetRole].email);
    setPassword(demoCreds[targetRole].password);
  };

  // Already signed in: no reason to see the login form
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="login-page-container">
      <div className="login-card-wrapper">
        {/* Branding */}
        <div className="login-brand-header">
          <div className="login-brand-icon">
            <Clock size={28} aria-hidden="true" />
          </div>
          <h2 className="login-brand-title">AttendTrack</h2>
          <p className="login-brand-sub">Corporate Attendance Portal</p>
        </div>

        {/* Login Card */}
        <div className="login-card">
          <form onSubmit={handleSubmit} className="login-form">
            <div>
              <label className="form-label" htmlFor="login-email">
                Work Email Address
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="login-password">
                Password
              </label>
              <div className="password-field">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-input"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="login-submit-btn"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spinner" aria-hidden="true" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {/* Demo logins: only shown when the server exposes them (development) */}
          {demoCreds && (
          <div className="demo-credentials-box">
            <p className="demo-box-title">
              1-Click Demo Logins (from .env)
            </p>
            <div className="demo-btn-grid">
              <button
                type="button"
                onClick={() => handleQuickFill('admin')}
                className="demo-fill-btn demo-admin-btn"
              >
                <Shield size={18} aria-hidden="true" />
                <span className="demo-btn-label">Admin</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('hr')}
                className="demo-fill-btn demo-hr-btn"
              >
                <Users size={18} aria-hidden="true" />
                <span className="demo-btn-label">HR</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('employee')}
                className="demo-fill-btn demo-employee-btn"
              >
                <User size={18} aria-hidden="true" />
                <span className="demo-btn-label">Employee</span>
              </button>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};
