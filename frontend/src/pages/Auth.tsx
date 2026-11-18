import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import {
  Lock,
  Mail,
  Phone,
  User,
  Store,
  MapPin,
  FileText,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authRequestOtp } from '@/api/client';
import { validateGSTIN } from '@/lib/indianFormats';

// Indian States and UTs
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry',
];

const BUSINESS_TYPES = [
  { value: 'kirana', label: 'Kirana / Grocery Store (किराना स्टोर)' },
  { value: 'restaurant', label: 'Restaurant / Dhaba / Cafe (ढाबा / रेस्टोरेंट)' },
  { value: 'services', label: 'Retail & Personal Services (सेवाएं / सैलून)' },
  { value: 'manufacturing', label: 'Small Manufacturer / Workshop (कारखाना / निर्माण)' },
  { value: 'textiles', label: 'Apparel & Textiles (कपड़ा व्यापारी)' },
  { value: 'other', label: 'Other General Trade (अन्य सामान्य व्यापार)' },
];

export const AuthPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { login, signup, verifyOtp, loginAsGuest } = useAuth();

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [loginMode, setLoginMode] = useState<'password' | 'otp'>('password');
  const [otpSent, setOtpSent] = useState(false);
  const [devOtpNotice, setDevOtpNotice] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  // React Hook Form for Sign In
  const {
    register: regSignIn,
    handleSubmit: handleSignInSubmit,
    formState: { errors: errorsSignIn },
    watch: watchSignIn,
  } = useForm({
    defaultValues: {
      login: '',
      password: '',
      mobile: '',
      otpCode: '',
      rememberMe: true,
    },
  });

  // React Hook Form for Sign Up
  const {
    register: regSignUp,
    handleSubmit: handleSignUpSubmit,
    formState: { errors: errorsSignUp },
    watch: watchSignUp,
  } = useForm({
    defaultValues: {
      name: '',
      business_name: '',
      business_type: 'kirana',
      state: 'Delhi',
      mobile: '',
      email: '',
      password: '',
      gstin: '',
      terms: true,
    },
  });

  const pwdValue = watchSignUp('password') || '';
  const pwdStrength = Math.min(
    100,
    (pwdValue.length >= 8 ? 35 : pwdValue.length * 4) +
      (/[A-Z]/.test(pwdValue) ? 25 : 0) +
      (/[0-9]/.test(pwdValue) ? 20 : 0) +
      (/[^A-Za-z0-9]/.test(pwdValue) ? 20 : 0)
  );

  // Sign In Handler
  const onSignIn = async (data: any) => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      if (loginMode === 'password') {
        if (!data.login || !data.password) {
          setErrorMessage('Please enter both login identifier and password.');
          setIsLoading(false);
          return;
        }
        await login({ login: data.login, password: data.password });
        navigate(from, { replace: true });
      } else {
        // OTP verify
        if (!data.mobile || !data.otpCode) {
          setErrorMessage('Please enter mobile number and 6-digit OTP code.');
          setIsLoading(false);
          return;
        }
        await verifyOtp(data.mobile, data.otpCode);
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Sign Up Handler
  const onSignUp = async (data: any) => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      if (data.gstin && !validateGSTIN(data.gstin)) {
        setErrorMessage('Invalid GSTIN format. Example: 07AAAAA0000A1Z5');
        setIsLoading(false);
        return;
      }
      await signup(data);
      navigate(from, { replace: true });
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Email or mobile may already exist.');
    } finally {
      setIsLoading(false);
    }
  };

  // OTP Request Handler
  const onRequestOtp = async () => {
    const mobile = watchSignIn('mobile');
    if (!mobile || mobile.replace(/\D/g, '').length < 10) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const resp = await authRequestOtp(mobile);
      setOtpSent(true);
      if (resp.dev_otp) {
        setDevOtpNotice(`Dev OTP: ${resp.dev_otp}`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  // Guest Demo Login
  const handleGuest = () => {
    loginAsGuest();
    navigate(from, { replace: true });
  };

  return (
    <div className="relative min-h-[calc(100vh-64px)] flex items-center justify-center p-4 sm:p-6 lg:p-8 z-10">
      {/* Frosted Glass Container with Jali Lattice border accents */}
      <div className="w-full max-w-xl rounded-md bg-[#0A0A0A]/85 backdrop-blur-xl border border-[#1C1C1F] p-6 sm:p-8 shadow-2xl relative">
        {/* Subtle Rangoli corner motif */}
        <div className="absolute top-2 left-2 font-mono text-[9px] text-[#FF9933]/50 select-none">
          + // SWADESHI_AUTH_GATE
        </div>
        <div className="absolute top-2 right-2 font-mono text-[9px] text-[#D4A017]/50 select-none">
          BHAROSA // 0x2026
        </div>

        {/* Header with Khata Logo & Devanagari Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-[#FF9933]/40 bg-[#000000] text-[#FF9933] mb-3 shadow-[0_0_12px_rgba(255,153,51,0.25)]">
            <Store className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-medium text-[#F5EFE6] tracking-tight">
            स्वदेशी खाता <span className="text-[#FF9933]">| Swadeshi Khata</span>
          </h1>
          <p className="text-xs text-[#A59E92] mt-1 font-body">
            {t('brand.tagline', 'Aapka hisaab, aapka bharosa')}
          </p>
        </div>

        {/* Tab Switcher: SIGN IN | SIGN UP */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded bg-[#000000] border border-[#1C1C1F] mb-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab('signin');
              setErrorMessage(null);
            }}
            className={`py-2 text-xs font-mono uppercase tracking-[0.08em] rounded transition-colors ${
              activeTab === 'signin'
                ? 'bg-[#111111] text-[#FF9933] border border-[#FF9933]/40 font-medium'
                : 'text-[#A59E92] hover:text-[#F5EFE6]'
            }`}
          >
            {t('auth.signInTab', 'Sign In / प्रवेश करें')}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('signup');
              setErrorMessage(null);
            }}
            className={`py-2 text-xs font-mono uppercase tracking-[0.08em] rounded transition-colors ${
              activeTab === 'signup'
                ? 'bg-[#111111] text-[#FF9933] border border-[#FF9933]/40 font-medium'
                : 'text-[#A59E92] hover:text-[#F5EFE6]'
            }`}
          >
            {t('auth.signUpTab', 'Khata Kholein / Sign Up')}
          </button>
        </div>

        {/* Error / Dev OTP Banners */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded bg-[#B3202A]/20 border border-[#B3202A]/50 text-xs text-[#F5EFE6] font-mono">
            {errorMessage}
          </div>
        )}
        {devOtpNotice && (
          <div className="mb-4 p-3 rounded bg-[#138808]/20 border border-[#138808]/50 text-xs text-[#F5EFE6] font-mono flex items-center justify-between">
            <span>{devOtpNotice}</span>
            <span className="text-[10px] text-[#A59E92]">(Simulated SMS)</span>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 1: SIGN IN FORM                                                 */}
        {/* =================================================================== */}
        {activeTab === 'signin' && (
          <form onSubmit={handleSignInSubmit(onSignIn)} className="space-y-4">
            {/* Mode Switch: Password vs Mobile OTP */}
            <div className="flex items-center justify-between text-xs font-mono pb-2 border-b border-[#1C1C1F]">
              <span className="text-[#A59E92]">MODE:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLoginMode('password')}
                  className={`text-[11px] px-2 py-0.5 rounded ${
                    loginMode === 'password'
                      ? 'text-[#FF9933] bg-[#111111] border border-[#FF9933]/30'
                      : 'text-[#A59E92] hover:text-[#F5EFE6]'
                  }`}
                >
                  Password
                </button>
                <span className="text-[#1C1C1F]">|</span>
                <button
                  type="button"
                  onClick={() => setLoginMode('otp')}
                  className={`text-[11px] px-2 py-0.5 rounded ${
                    loginMode === 'otp'
                      ? 'text-[#FF9933] bg-[#111111] border border-[#FF9933]/30'
                      : 'text-[#A59E92] hover:text-[#F5EFE6]'
                  }`}
                >
                  Mobile OTP
                </button>
              </div>
            </div>

            {loginMode === 'password' ? (
              <>
                <div>
                  <label className="block text-[11px] font-mono text-[#A59E92] uppercase mb-1">
                    {t('auth.loginLabel', 'Mobile Number or Email')}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      {...regSignIn('login', { required: true })}
                      placeholder="e.g. 9876543210 or sharma@kirana.in"
                      className="w-full bg-[#000000] border border-[#1C1C1F] rounded px-3 py-2 text-xs text-[#F5EFE6] focus:outline-none focus:border-[#FF9933] transition-colors"
                    />
                    <Mail className="absolute right-3 top-2.5 w-4 h-4 text-[#A59E92]" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#A59E92] uppercase mb-1">
                    {t('auth.passwordLabel', 'Password')}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      {...regSignIn('password', { required: true })}
                      placeholder="••••••••"
                      className="w-full bg-[#000000] border border-[#1C1C1F] rounded px-3 py-2 text-xs text-[#F5EFE6] focus:outline-none focus:border-[#FF9933] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-[#A59E92] hover:text-[#F5EFE6]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-[11px] font-mono text-[#A59E92] uppercase mb-1">
                    10-Digit Mobile Number (+91)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      {...regSignIn('mobile', { required: true })}
                      placeholder="9876543210"
                      className="w-full bg-[#000000] border border-[#1C1C1F] rounded px-3 py-2 text-xs text-[#F5EFE6] focus:outline-none focus:border-[#FF9933] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={onRequestOtp}
                      disabled={isLoading}
                      className="shrink-0 px-3 py-2 rounded bg-[#111111] hover:bg-[#161618] text-[#FF9933] border border-[#FF9933]/40 text-xs font-mono uppercase tracking-wider transition-colors"
                    >
                      {otpSent ? 'Resend' : 'Send OTP'}
                    </button>
                  </div>
                </div>

                {otpSent && (
                  <div>
                    <label className="block text-[11px] font-mono text-[#A59E92] uppercase mb-1">
                      Enter 6-Digit OTP Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      {...regSignIn('otpCode', { required: true })}
                      placeholder="123456"
                      className="w-full bg-[#000000] border border-[#1C1C1F] rounded px-3 py-2 text-xs font-mono text-center tracking-[0.3em] text-[#FF9933] focus:outline-none focus:border-[#FF9933] transition-colors"
                    />
                  </div>
                )}
              </>
            )}

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-[#A59E92] cursor-pointer">
                <input
                  type="checkbox"
                  {...regSignIn('rememberMe')}
                  className="rounded border-[#1C1C1F] bg-[#000000] text-[#FF9933]"
                />
                <span>{t('auth.rememberMe', 'Remember me')}</span>
              </label>
              <button
                type="button"
                onClick={() => setErrorMessage('Please contact support or use OTP login to enter.')}
                className="text-[#D4A017] hover:underline"
              >
                {t('auth.forgotPassword', 'Forgot password?')}
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded bg-[#F5EFE6] hover:bg-white text-black font-medium text-xs tracking-tight transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_12px_rgba(255,255,255,0.2)]"
            >
              <span>{isLoading ? 'प्रवेश हो रहा है...' : 'Pravesh Karein / Sign In'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        {/* =================================================================== */}
        {/* TAB 2: SIGN UP FORM                                                 */}
        {/* =================================================================== */}
        {activeTab === 'signup' && (
          <form onSubmit={handleSignUpSubmit(onSignUp)} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10.5px] font-mono text-[#A59E92] uppercase mb-1">
                  Owner Name (मालिक का नाम)
                </label>
                <input
                  type="text"
                  {...regSignUp('name', { required: true })}
                  placeholder="e.g. Ramesh Sharma"
                  className="w-full bg-[#000000] border border-[#1C1C1F] rounded px-3 py-2 text-xs text-[#F5EFE6] focus:outline-none focus:border-[#FF9933]"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-mono text-[#A59E92] uppercase mb-1">
                  Business Name (दुकान का नाम)
                </label>
                <input
                  type="text"
                  {...regSignUp('business_name', { required: true })}
                  placeholder="e.g. Sharma General Store"
                  className="w-full bg-[#000000] border border-[#1C1C1F] rounded px-3 py-2 text-xs text-[#F5EFE6] focus:outline-none focus:border-[#FF9933]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10.5px] font-mono text-[#A59E92] uppercase mb-1">
                  Trade Type (व्यापार प्रकार)
                </label>
                <select
                  {...regSignUp('business_type')}
                  className="w-full bg-[#000000] border border-[#1C1C1F] rounded px-3 py-2 text-xs text-[#F5EFE6] focus:outline-none focus:border-[#FF9933]"
                >
                  {BUSINESS_TYPES.map((b) => (
                    <option key={b.value} value={b.value} className="bg-black">
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] font-mono text-[#A59E92] uppercase mb-1">
                  State / UT (राज्य)
                </label>
                <select
                  {...regSignUp('state')}
                  className="w-full bg-[#000000] border border-[#1C1C1F] rounded px-3 py-2 text-xs text-[#F5EFE6] focus:outline-none focus:border-[#FF9933]"
                >
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s} className="bg-black">
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10.5px] font-mono text-[#A59E92] uppercase mb-1">
                  Mobile (+91)
                </label>
                <input
                  type="tel"
                  {...regSignUp('mobile', { required: true })}
                  placeholder="9876543210"
                  className="w-full bg-[#000000] border border-[#1C1C1F] rounded px-3 py-2 text-xs text-[#F5EFE6] focus:outline-none focus:border-[#FF9933]"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-mono text-[#A59E92] uppercase mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  {...regSignUp('email', { required: true })}
                  placeholder="sharma@kirana.in"
                  className="w-full bg-[#000000] border border-[#1C1C1F] rounded px-3 py-2 text-xs text-[#F5EFE6] focus:outline-none focus:border-[#FF9933]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10.5px] font-mono text-[#A59E92] uppercase mb-1">
                  Password
                </label>
                <input
                  type="password"
                  {...regSignUp('password', { required: true })}
                  placeholder="Min 6 characters"
                  className="w-full bg-[#000000] border border-[#1C1C1F] rounded px-3 py-2 text-xs text-[#F5EFE6] focus:outline-none focus:border-[#FF9933]"
                />
                {/* Password Strength Meter */}
                <div className="mt-1.5 h-1 w-full bg-[#111111] rounded overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      pwdStrength > 70
                        ? 'bg-[#138808]'
                        : pwdStrength > 40
                          ? 'bg-[#D4A017]'
                          : 'bg-[#B3202A]'
                    }`}
                    style={{ width: `${pwdStrength}%` }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-mono text-[#A59E92] uppercase mb-1">
                  GSTIN (Optional / ऐच्छिक)
                </label>
                <input
                  type="text"
                  maxLength={15}
                  {...regSignUp('gstin')}
                  placeholder="07AAAAA0000A1Z5"
                  className="w-full bg-[#000000] border border-[#1C1C1F] rounded px-3 py-2 text-xs uppercase text-[#F5EFE6] focus:outline-none focus:border-[#FF9933]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 rounded bg-[#FF9933] hover:bg-[#E07D1E] text-black font-medium text-xs tracking-tight transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_12px_rgba(255,153,51,0.3)]"
            >
              <span>{isLoading ? 'खाता तैयार हो रहा है...' : 'Khata Kholein / Register Business'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        {/* Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#1C1C1F]" />
          </div>
          <div className="relative flex justify-center text-[10px] font-mono uppercase tracking-[0.12em]">
            <span className="bg-[#0A0A0A] px-2 text-[#656057]">YA / OR</span>
          </div>
        </div>

        {/* Guest Demo Bypass CTA */}
        <button
          type="button"
          onClick={handleGuest}
          className="w-full py-2 rounded bg-[#111111] hover:bg-[#161618] border border-[#1C1C1F] text-xs font-mono text-[#A59E92] hover:text-[#F5EFE6] transition-colors flex items-center justify-center gap-2"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#D4A017]" />
          <span>{t('auth.guestDemo', 'Continue as Guest (Demo Indian SMB Data)')}</span>
        </button>
      </div>
    </div>
  );
};

export default AuthPage;
