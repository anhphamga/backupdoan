import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../../components/common/Header';
import { useAuth } from '../../hooks/useAuth';
import { getRouteByRole, normalizeRole } from '../../utils/auth';
import axiosClient, { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, setAuthToken } from '../../config/axios';
import '../../style/AuthPages.css';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^(0|\+84)\d{9,10}$/;

const ROLE_META = {
  owner: {
    title: 'Ðang nh?p qu?n tr? ch? shop',
    subtitle: 'Dành cho Owner - qu?n tr? toàn b? h? th?ng c?a hàng.',
    badge: 'C?NG OWNER',
    fallbackPath: '/owner/dashboard',
  },
  staff: {
    title: 'Ðang nh?p nhân s? c?a hàng',
    subtitle: 'Dành cho Staff - x? lý don thuê, l?ch th? và v?n hành t?i qu?y.',
    badge: 'C?NG STAFF',
    fallbackPath: '/staff',
  },
};

const normalizeLoginError = (apiError) => {
  const message = apiError?.response?.data?.message || '';
  const normalized = String(message).toLowerCase();
  if (normalized.includes('invalid') || normalized.includes('not found') || normalized.includes('password')) {
    return 'Tài kho?n ho?c m?t kh?u không dúng.';
  }
  if (normalized.includes('locked')) {
    return 'Tài kho?n dang b? khóa. Vui lòng liên h? qu?n tr? viên.';
  }
  if (
    normalized.includes('cho owner duyet')
    || normalized.includes('ch? owner duy?t')
    || normalized.includes('pending')
    || normalized.includes('chua duoc kich hoat')
    || normalized.includes('chua du?c kích ho?t')
    || normalized.includes('bam accept')
    || normalized.includes('b?m accept')
  ) {
    return 'Tài kho?n chua kích ho?t. Vui lòng ki?m tra email m?i và b?m Accept.';
  }
  return message || 'Ðang nh?p th?t b?i.';
};

export default function RoleLoginPage({ role }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { login, clearSession } = useAuth();

  const requestedRole = normalizeRole(role || searchParams.get('role') || location.state?.loginRole || 'staff');
  const activeRole = requestedRole === 'owner' ? 'owner' : 'staff';
  const meta = ROLE_META[activeRole];

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoginBusy, setGoogleLoginBusy] = useState(false);

  const redirectPath = useMemo(() => {
    const from = location.state?.from?.pathname || '';
    if (activeRole === 'owner' && from.startsWith('/owner')) return from;
    if (activeRole === 'staff' && from.startsWith('/staff')) return from;
    return meta.fallbackPath;
  }, [activeRole, location.state, meta.fallbackPath]);
  const inviteStatus = String(searchParams.get('invite') || '').trim().toLowerCase();
  const inviteMessage = useMemo(() => {
    if (inviteStatus === 'accepted') {
      return {
        tone: 'success',
        text: 'Xác nh?n email thành công. B?n có th? dang nh?p tài kho?n Staff ngay bây gi?.'
      };
    }
    if (inviteStatus === 'expired') {
      return {
        tone: 'error',
        text: 'Link m?i dã h?t h?n. Vui lòng nh? ch? shop g?i l?i l?i m?i m?i.'
      };
    }
    if (inviteStatus === 'invalid') {
      return {
        tone: 'error',
        text: 'Link m?i không h?p l? ho?c dã du?c s? d?ng.'
      };
    }
    if (inviteStatus === 'error') {
      return {
        tone: 'error',
        text: 'Không th? xác nh?n l?i m?i lúc này. Vui lòng th? l?i sau.'
      };
    }
    return null;
  }, [inviteStatus]);

  const enforceRole = async (data) => {
    const userRole = normalizeRole(data?.user?.role);
    if (userRole !== activeRole) {
      clearSession();
      throw new Error(`Tài kho?n này không có quy?n truy c?p c?ng ${activeRole.toUpperCase()}.`);
    }
    return true;
  };

  const handleCredentialResponse = async (response) => {
    try {
      setGoogleLoginBusy(true);
      setError('');
      const res = await axiosClient.post('/auth/google-login', {
        credential: response.credential,
        portal: activeRole
      });

      const payload = res?.data?.data || res?.data || {};
      const accessToken = payload.accessToken;
      const refreshToken = payload.refreshToken;
      const user = payload.user;

      if (!accessToken || !user) {
        throw new Error('Google login response missing accessToken or user');
      }

      const userRole = normalizeRole(user.role);
      if (userRole !== activeRole) {
        throw new Error('Tai khoan khong dung vai tro dang nhap');
      }

      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      }

      if (rememberMe) {
        localStorage.setItem('inhere_user', JSON.stringify(user));
        sessionStorage.removeItem(ACCESS_TOKEN_KEY);
        sessionStorage.removeItem('inhere_user');
      } else {
        sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        sessionStorage.setItem('inhere_user', JSON.stringify(user));
        localStorage.removeItem('inhere_user');
      }

      setAuthToken(accessToken);
      const targetPath = redirectPath || getRouteByRole(user.role);
      navigate(targetPath, { replace: true });
    } catch (apiError) {
      clearSession();
      setError(normalizeLoginError(apiError));
    } finally {
      setGoogleLoginBusy(false);
    }
  };

  useEffect(() => {
    const initializeGoogle = () => {
      if (!window.google || !import.meta.env.VITE_GOOGLE_CLIENT_ID) return false;

      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });

      window.google.accounts.id.renderButton(
        document.getElementById('roleGoogleBtn'),
        { theme: 'outline', size: 'large' }
      );
      return true;
    };

    if (initializeGoogle()) return;
    const timer = window.setTimeout(initializeGoogle, 300);
    return () => window.clearTimeout(timer);
  }, [activeRole]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const normalizedIdentifier = identifier.replace(/\s+/g, '').trim();
    if (!normalizedIdentifier || !password) {
      setError('Vui lòng nh?p d?y d? thông tin.');
      return;
    }

    const isEmail = emailRegex.test(normalizedIdentifier);
    const isPhone = phoneRegex.test(normalizedIdentifier);
    if (!isEmail && !isPhone) {
      setError('Vui lòng nh?p dúng Email ho?c s? di?n tho?i h?p l?.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = isPhone
        ? { phone: normalizedIdentifier, password, portal: 'staff' }
        : { email: normalizedIdentifier.toLowerCase(), password, portal: 'staff' };

      const data = await login(payload, { rememberMe });
      await enforceRole(data);
      const targetPath = redirectPath || getRouteByRole(data.user.role);
      navigate(targetPath, { replace: true });
    } catch (apiError) {
      setError(normalizeLoginError(apiError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchRole = (nextRole) => {
    setError('');
    setSearchParams({ role: nextRole });
  };

  return (
    <>
      <Header />
      <div className="auth-shell auth-page auth-with-header login-page-shell">
        <div className="auth-layout auth-layout-login">
          <section className="auth-showcase login-hero">
            <div className="login-hero-top">
              <p className="auth-showcase-badge">{meta.badge}</p>
            </div>
            <div className="login-hero-copy">
              <h1>{meta.title}</h1>
              <p className="login-hero-slogan">{meta.subtitle}</p>
            </div>
          </section>

          <section className="auth-card auth-panel login-form-card">
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => handleSwitchRole('staff')}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  activeRole === 'staff' ? 'bg-amber-500 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Staff
              </button>
              <button
                type="button"
                onClick={() => handleSwitchRole('owner')}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  activeRole === 'owner' ? 'bg-amber-500 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Owner
              </button>
            </div>

            <h2 className="auth-title">{meta.title}</h2>
            <p className="auth-subtitle">Vui lòng dang nh?p b?ng tài kho?n du?c phân quy?n.</p>
            {activeRole === 'staff' && inviteMessage ? (
              <div className={inviteMessage.tone === 'success' ? 'success-text' : 'error-text'}>
                {inviteMessage.text}
              </div>
            ) : null}

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-input-wrap">
                <label>Email / SÐT</label>
                <div className="auth-input-icon-wrap">
                  <span className="auth-input-icon" aria-hidden="true">
                    @
                  </span>
                  <input
                    type="text"
                    placeholder="Email ho?c s? di?n tho?i"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="auth-input-wrap">
                <label>M?t kh?u</label>
                <div className="auth-input-icon-wrap">
                  <span className="auth-input-icon" aria-hidden="true">
                    *
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Nh?p m?t kh?u"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? '?n m?t kh?u' : 'Hi?n m?t kh?u'}
                  >
                    {showPassword ? '?n' : 'Hi?n'}
                  </button>
                </div>
              </div>

              <div className="auth-row-between">
                <label className="remember-check">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  <span>Ghi nh? tôi</span>
                </label>
                <Link to="/forgot-password" className="inline-link">
                  Quên m?t kh?u?
                </Link>
              </div>

              {error && <div className="error-text">{error}</div>}

              <button type="submit" disabled={submitting} className="login-submit-btn">
                {submitting ? 'Ðang dang nh?p...' : 'Ðang nh?p'}
              </button>

              <div className="auth-divider">
                <span>Ho?c</span>
              </div>

              <div id="roleGoogleBtn"></div>
              {googleLoginBusy ? <div className="text-sm text-slate-500">Dang dang nhap Google...</div> : null}
            </form>

            <div className="auth-links auth-links-center">
              <span>C?ng khách hàng?</span>
              <Link to="/login">Ðang nh?p thu?ng</Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}



