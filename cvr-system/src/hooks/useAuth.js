import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
         checkRoles(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkRoles(session.user.id);
      } else {
        setLoading(false);
        setIsAdmin(false);
        setIsManager(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkRoles = async (userId) => {
      // Fetch profile to check roles
      const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
      if (data) {
          setIsAdmin(data.role === 'admin');
          setIsManager(['admin', 'bu_manager'].includes(data.role));
      }
      setLoading(false);
  };

  return { user, session, loading, isAdmin, isManager };
}
