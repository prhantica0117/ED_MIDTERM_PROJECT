import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Persistent session storage so a signed-in user stays logged in even after the
 * app is fully closed and reopened.
 *
 * - Native (iOS / Android): encrypted expo-secure-store. A single SecureStore
 *   value is capped at 2048 bytes, but a Supabase session (JWT + user object)
 *   is usually larger, so the value is split into numbered chunks under one key.
 * - Web: no custom storage is provided, so @supabase/supabase-js falls back to
 *   the browser localStorage automatically.
 */
const CHUNK_SIZE = 1000;
const CHUNK_COUNT_SUFFIX = '__chunk_count';

async function clearChunks(key: string): Promise<void> {
  try {
    const countRaw = await SecureStore.getItemAsync(key + CHUNK_COUNT_SUFFIX);
    if (countRaw != null) {
      const count = Number.parseInt(countRaw, 10);
      if (!Number.isNaN(count)) {
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(`${key}__${i}`);
        }
      }
      await SecureStore.deleteItemAsync(key + CHUNK_COUNT_SUFFIX);
    }
  } catch {
    // best-effort cleanup - ignore errors
  }
}

const secureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const countRaw = await SecureStore.getItemAsync(key + CHUNK_COUNT_SUFFIX);
      if (countRaw != null) {
        const count = Number.parseInt(countRaw, 10);
        if (!Number.isNaN(count)) {
          let value = '';
          for (let i = 0; i < count; i++) {
            const chunk = await SecureStore.getItemAsync(`${key}__${i}`);
            if (chunk == null) return null;
            value += chunk;
          }
          return value;
        }
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await clearChunks(key);
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(key + CHUNK_COUNT_SUFFIX, String(chunks.length));
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}__${i}`, chunks[i]);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    await clearChunks(key);
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
  },
};

const isWeb = Platform.OS === 'web';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Persist the session on native via expo-secure-store; on web let Supabase
    // use its built-in localStorage default.
    ...(isWeb ? {} : { storage: secureStoreAdapter }),
  },
});