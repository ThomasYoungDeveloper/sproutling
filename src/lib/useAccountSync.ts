import { useEffect } from 'react';
import { supabase } from './supabase';
import { useGame } from '../state/GameContext';
import { useAuth } from '../state/AuthContext';
import { accountLevel } from '../game/account';
import { dropTag } from './guildTags';

/** Tells the server your account level when it goes up, so friends see your badge. */
export function useAccountSync() {
  const { state } = useGame();
  const { user } = useAuth();
  const lv = accountLevel(state);
  useEffect(() => {
    if (!user || !state.pets.length) return;
    supabase.rpc('set_account_level', { p_level: lv }).then(() => dropTag(user.id));
  }, [lv, user?.id]);
}
