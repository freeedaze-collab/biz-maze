import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (expects env vars NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY):contentReference[oaicite:0]{index=0}
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export default function ProfilePage() {
  const [country, setCountry] = useState('');
  const [category, setCategory] = useState('');
  const [taxInfo, setTaxInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch current profile data on component mount
  useEffect(() => {
    async function getProfile() {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('profiles')
            .select('country, category, tax_info')
            .eq('id', user.id)
            .single();
          if (error) throw error;
          if (data) {
            setCountry(data.country || '');
            setCategory(data.category || '');
            setTaxInfo(data.tax_info || '');
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    }
    getProfile();
  }, []);

  // Update profile fields in the database
  async function updateProfile() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        country: country,
        category: category,
        tax_info: taxInfo,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      alert('プロフィールが更新されました');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('プロフィールの更新に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>プロフィール編集</h1>
      <label>国:</label>
      <input
        type="text"
        value={country}
        onChange={(e) => setCountry(e.target.value)}
      />
      <label>区分:</label>
      <input
        type="text"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      />
      <label>税務情報:</label>
      <input
        type="text"
        value={taxInfo}
        onChange={(e) => setTaxInfo(e.target.value)}
      />
      <button disabled={loading} onClick={updateProfile}>
        {loading ? '保存中...' : '保存'}
      </button>
    </div>
  );
}
// Follow Supabase examples: select profile row and upsert update:contentReference[oaicite:1]{index=1}:contentReference[oaicite:2]{index=2}
