import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/api/supabaseClient';
import { clearParentSignedIn, markParentSignedIn } from '@/lib/parentSession';

const AuthContext = createContext();

function appPath(path) {
  const onPages = window.location.pathname === '/safe-tube' || window.location.pathname.startsWith('/safe-tube/');
  return `${onPages ? '/safe-tube' : ''}${path}`;
}

async function loadMergedUser(sessionUser) {
  if (!sessionUser) return null;
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', sessionUser.id)
      .maybeSingle();

    return {
      id: sessionUser.id,
      email: sessionUser.email || profile?.email || '',
      role: profile?.role || sessionUser.user_metadata?.role || 'user',
      ...(profile || {}),
    };
  } catch {
    return {
      id: sessionUser.id,
      email: sessionUser.email || '',
      role: sessionUser.user_metadata?.role || 'user',
    };
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  const applySession = useCallback(async (session) => {
    if (!session?.user) {
      setUser(null);
      setIsAuthenticated(false);
      return;
    }
    const merged = await loadMergedUser(session.user);
    setUser(merged);
    setIsAuthenticated(true);
    markParentSignedIn();
  }, []);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      await applySession(data.session);
      setAuthError(null);
    } catch (error) {
      console.error('User auth check failed:', error);
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [applySession]);

  const checkAppState = useCallback(async () => {
    setIsLoadingPublicSettings(true);
    setAuthError(null);
    try {
      setAppPublicSettings({
        id: 'safetube-kids',
        public_settings: { configured: isSupabaseConfigured() },
      });
      await checkUserAuth();
    } catch (error) {
      console.error('App state check failed:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'Failed to load app',
      });
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } finally {
      setIsLoadingPublicSettings(false);
    }
  }, [checkUserAuth]);

  useEffect(() => {
    let cancelled = false;
    checkAppState();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        if (cancelled) return;
        if (event === 'INITIAL_SESSION') return;
        if (event === 'SIGNED_OUT') {
          applySession(null);
          return;
        }
        if (session?.user) applySession(session);
        setAuthChecked(true);
        setIsLoadingAuth(false);
      }, 0);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [checkAppState, applySession]);

  const logout = async (shouldRedirect = true) => {
    clearParentSignedIn();
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      window.location.href = appPath('/login');
    }
  };

  const navigateToLogin = () => {
    const path = `${window.location.pathname}${window.location.search}`;
    const loginPath = appPath('/login');
    const returnTo = path && path !== loginPath ? `?returnTo=${encodeURIComponent(path)}` : '';
    window.location.href = `${loginPath}${returnTo}`;
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
