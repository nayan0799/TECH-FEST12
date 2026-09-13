'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';

import { supabase } from '@/lib/supabase';
import { emptyState } from '@/lib/defaults';
import { rankTeams } from '@/lib/ranking';
import type { State } from '@/lib/types';

type Payload = Record<string, any>;

type Context = {
  state: State;
  loading: boolean;
  demo: boolean;
  error: string;
  refresh: () => Promise<void>;
  act: (action: string, payload?: Payload) => Promise<void>;
  enterDemo: (role: 'student' | 'admin') => void;
  logout: () => Promise<void>;
  notify: (message: string) => void;
};

const C = createContext<Context | null>(null);

export function useApp() {
  const c = useContext(C);

  if (!c) {
    throw Error('Provider missing');
  }

  return c;
}

export function Provider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<State>(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setError('Supabase is not configured.');
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setState(emptyState);
      setLoading(false);
      setError('');
      return;
    }

    const { data, error } = await supabase.rpc('get_state');

    if (error) {
      setError(error.message);
    } else {
      setState(data as State);
      setError('');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();

    if (!supabase) {
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => {
        void refresh();
      }, 0);
    });

    const timer = setInterval(() => {
      void refresh();
    }, 12000);

    return () => {
      subscription.unsubscribe();
      clearInterval(timer);
    };
  }, [refresh]);

  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setMessage('');
    }, 5000);

    return () => clearTimeout(timer);
  }, [message]);

  async function logout() {
    if (!supabase) return;

    await supabase.auth.signOut();

    setState(emptyState);
    setError('');
  }

  async function act(
    action: string,
    payload: Payload = {},
  ) {
    if (busy.current) {
      throw Error(
        'Please wait for the previous change.',
      );
    }

    if (!supabase) {
      throw Error('Supabase is not configured.');
    }

    busy.current = true;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw Error('Please login first.');
      }

      const { error } = await supabase.rpc('mutate', {
        action,
        payload,
      });

      if (error) {
        throw Error(error.message);
      }

      await refresh();

      setMessage('Changes saved.');
    } finally {
      busy.current = false;
    }
  }

  const enterDemo = () => {
    throw Error(
      'Demo mode has been removed. Please login with Supabase.',
    );
  };

  return (
    <C.Provider
      value={{
        state,
        loading,
        demo: false,
        error,
        refresh,
        act,
        enterDemo,
        logout,
        notify: setMessage,
      }}
    >
      {children}

      {message && (
        <div
          className="toast"
          role="status"
        >
          {message}
        </div>
      )}
    </C.Provider>
  );
}