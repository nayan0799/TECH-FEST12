'use client';

import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabase';
import {useApp} from './provider';
import {Brand,Field,ArrowUpRight} from './ui';

export function Auth({
  admin=false,
  mode='login'
}:{
  admin?:boolean;
  mode?:string;
}) {
  const router=useRouter();
  const {refresh}=useApp();

  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [otpMode,setOtpMode]=useState(false);
  const [otp,setOtp]=useState('');
  const [email,setEmail]=useState('');

  const signup=mode==='signup';
  const forgot=mode==='forgot-password';
  const reset=mode==='reset-password';

  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setBusy(true);
    setError('');
    setSuccess('');

    const f=new FormData(e.currentTarget);

    const currentEmail=String(f.get('email')||'').trim();
    const password=String(f.get('password')||'');

    try {
      if(!supabase) {
        throw Error('Supabase is not configured.');
      }

      if((signup||reset) && password!==String(f.get('confirm')||'')) {
        throw Error('Passwords do not match.');
      }

      if(forgot) {
        const {error}=await supabase.auth.resetPasswordForEmail(
          currentEmail,
          {
            redirectTo:location.origin+'/student/reset-password'
          }
        );

        if(error) throw error;

        setSuccess(
          'If the account exists, a password reset email has been sent.'
        );
      }

      else if(reset) {
        const {error}=await supabase.auth.updateUser({
          password
        });

        if(error) throw error;

        setSuccess('Password updated successfully.');

        setTimeout(()=>{
          router.push('/student/login');
        },1200);
      }

      else if(signup) {
        const name=String(f.get('name')||'').trim();

        if(!name) {
          throw Error('Please enter your full name.');
        }

        if(!currentEmail) {
          throw Error('Please enter your email address.');
        }

        if(!password) {
          throw Error('Please enter a password.');
        }

        const {error,data}=await supabase.auth.signUp({
          email:currentEmail,
          password,
          options:{
            data:{
              full_name:name
            }
          }
        });

        if(error) throw error;

        setEmail(currentEmail);

        /*
         * If Supabase Email Confirmation is OFF,
         * signup returns a session and the user can
         * enter the dashboard immediately.
         */
        if(data.session) {
          await refresh();

          router.push(
            admin
              ? '/admin'
              : '/student/dashboard'
          );
        }

        /*
         * If Email Confirmation is ON,
         * Supabase can send an OTP/email verification.
         */
        else {
          setOtpMode(true);

          setSuccess(
            'A 6-digit verification code has been sent to your email.'
          );
        }
      }

      else {
        if(!currentEmail) {
          throw Error('Please enter your email address.');
        }

        if(!password) {
          throw Error('Please enter your password.');
        }

        const {error}=await supabase.auth.signInWithPassword({
          email:currentEmail,
          password
        });

        if(error) throw error;

        await refresh();

        router.push(
          admin
            ? '/admin'
            : '/student/dashboard'
        );
      }

    } catch(err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Authentication failed.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    if(otp.length!==6) {
      setError('Enter the 6-digit OTP.');
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      if(!supabase) {
        throw Error('Supabase is not configured.');
      }

      const {error}=await supabase.auth.verifyOtp({
        email,
        token:otp,
        type:'email'
      });

      if(error) throw error;

      await refresh();

      setSuccess('Email verified successfully.');

      setTimeout(()=>{
        router.push(
          admin
            ? '/admin'
            : '/student/dashboard'
        );
      },700);

    } catch(err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Invalid or expired OTP.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function resendOtp() {
    setBusy(true);
    setError('');
    setSuccess('');

    try {
      if(!supabase) {
        throw Error('Supabase is not configured.');
      }

      const {error}=await supabase.auth.resend({
        type:'signup',
        email
      });

      if(error) throw error;

      setSuccess('A new OTP has been sent to your email.');

    } catch(err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to resend OTP.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={'auth-layout '+(admin?'admin-auth':'student-auth')}>

      <div className="auth-story">

        <Brand/>

        <div>
          <small className="eyebrow">
            {admin
              ? 'BEHIND EVERY GREAT CHALLENGE'
              : 'TWO MINDS. ONE TEAM.'}
          </small>

          <h1>
            {admin
              ? 'Run the\nshow.'
              : 'Your next\nbig idea\nstarts here.'}
          </h1>

          <p>
            {admin
              ? 'The control room for everything MIND RIZZ.'
              : 'A challenge worth thinking about. An experience worth showing up for.'}
          </p>
        </div>

        <span>THINK. PLAY. CONQUER.</span>

      </div>

      <div className="auth-form-wrap">

        <Link href="/" className="back-link">
          ← Back to the event
        </Link>

        <div className="auth-card">

          <small className="eyebrow">
            {admin ? 'ORGANIZER ACCESS' : 'STUDENT SPACE'}
          </small>

          {otpMode ? (

            <>
              <h2>Check your email.</h2>

              <p>
                We sent a 6-digit verification code to:
              </p>

              <p>
                <strong>{email}</strong>
              </p>

              <div style={{marginTop:24}}>

                <label
                  htmlFor="otp"
                  style={{
                    display:'block',
                    marginBottom:8,
                    fontWeight:600
                  }}
                >
                  Verification code
                </label>

                <input
                  id="otp"
                  value={otp}
                  onChange={e=>{
                    setOtp(
                      e.target.value
                        .replace(/\D/g,'')
                        .slice(0,6)
                    );
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  className="field-input"
                />

              </div>

              {error && (
                <p className="alert" role="alert">
                  {error}
                </p>
              )}

              {success && (
                <p className="success" role="status">
                  {success}
                </p>
              )}

              <button
                type="button"
                className="button full"
                disabled={busy}
                onClick={verifyOtp}
              >
                {busy ? 'Verifying...' : 'Verify OTP'}
                <ArrowUpRight size={18}/>
              </button>

              <button
                type="button"
                className="button secondary full"
                disabled={busy}
                onClick={resendOtp}
                style={{marginTop:10}}
              >
                Resend OTP
              </button>

              <button
                type="button"
                className="back-link"
                onClick={()=>{
                  setOtpMode(false);
                  setOtp('');
                  setError('');
                  setSuccess('');
                }}
                style={{
                  background:'none',
                  border:0,
                  marginTop:18,
                  cursor:'pointer'
                }}
              >
                ← Change email
              </button>
            </>

          ) : (

            <>
              <h2>
                {forgot
                  ? 'Forgot your password?'
                  : reset
                    ? 'Set a new password'
                    : signup
                      ? 'Make your first move.'
                      : 'Welcome back.'}
              </h2>

              <p>
                {signup
                  ? 'Create your account. Then verify your email with a one-time code.'
                  : forgot
                    ? 'We will send you a secure reset link.'
                    : reset
                      ? 'Choose a new password for your account.'
                      : 'Your next challenge is right where you left it.'}
              </p>

              <form onSubmit={submit}>

                {signup && (
                  <Field
                    label="Full name"
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={120}
                  />
                )}

                {!reset && (
                  <Field
                    label="Email address"
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                  />
                )}

                {!forgot && (
                  <Field
                    label="Password"
                    name="password"
                    type="password"
                    minLength={8}
                    required
                    autoComplete={
                      signup || reset
                        ? 'new-password'
                        : 'current-password'
                    }
                  />
                )}

                {(signup || reset) && (
                  <Field
                    label="Confirm password"
                    name="confirm"
                    type="password"
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                )}

                {error && (
                  <p className="alert" role="alert">
                    {error}
                  </p>
                )}

                {success && (
                  <p className="success" role="status">
                    {success}
                  </p>
                )}

                <button
                  className="button full"
                  disabled={busy}
                >
                  {busy
                    ? 'Please wait...'
                    : forgot
                      ? 'Send reset link'
                      : reset
                        ? 'Update password'
                        : signup
                          ? 'Create account'
                          : 'Log in'}

                  <ArrowUpRight size={18}/>
                </button>

              </form>

              {!admin && (
                <div className="auth-links">

                  <Link
                    href={
                      signup
                        ? '/student/login'
                        : '/student/signup'
                    }
                  >
                    {signup
                      ? 'Already registered? Log in'
                      : 'New here? Create an account'}
                  </Link>

                  <Link href="/student/forgot-password">
                    Forgot password?
                  </Link>

                </div>
              )}

            </>
          )}

        </div>

      </div>

    </main>
  );
}