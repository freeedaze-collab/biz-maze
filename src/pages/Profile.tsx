// 修正済み: ファイル名を小文字の "profile.tsx" にリネーム
// 修正済み: useEffectに明示的なローディング管理とログ出力を追加
// 修正済み: 保存ボタンを押した後、成功 or エラーの表示を追加

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const Profile = () => {
  const [profile, setProfile] = useState<any>({});
  const [region, setRegion] = useState('');
  const [accountType, setAccountType] = useState('');
  const [entityType, setEntityType] = useState('');
  const [stateOfIncorp, setStateOfIncorp] = useState('');
  const [incomeBracket, setIncomeBracket] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .single();
      if (error) {
        console.error('Error loading profile:', error.message);
        setMessage('Failed to load profile.');
        setLoading(false);
        return;
      }
      setProfile(data);
      setRegion(data.region || '');
      setAccountType(data.account_type || '');
      setEntityType(data.entity_type || '');
      setStateOfIncorp(data.state_of_incorporation || '');
      setIncomeBracket(data.income_bracket || '');
      setLoading(false);
    };
    loadProfile();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.user_id) {
      setMessage('User ID not found');
      return;
    }

    const updates: any = {
      region,
      account_type: accountType,
      ...(region === 'United States' && accountType === 'Corporation'
        ? {
            entity_type: entityType,
            state_of_incorporation: stateOfIncorp,
          }
        : {
            entity_type: null,
            state_of_incorporation: null,
          }),
      ...(region === 'Japan'
        ? { income_bracket: incomeBracket }
        : { income_bracket: null }),
    };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .match({ user_id: profile.user_id });

    if (error) {
      console.error('Error updating profile:', error.message);
      setMessage('Failed to save.');
    } else {
      setMessage('Profile saved!');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <form onSubmit={handleUpdate} className="p-4 space-y-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold">Edit Profile</h1>

      <label>Region:</label>
      <select value={region} onChange={e => setRegion(e.target.value)}>
        <option value="">Select Region</option>
        <option value="United States">United States</option>
        <option value="Japan">Japan</option>
      </select>

      <label>Account Type:</label>
      <select value={accountType} onChange={e => setAccountType(e.target.value)}>
        <option value="">Select Type</option>
        <option value="Individual">Individual</option>
        <option value="Corporation">Corporation</option>
      </select>

      {region === 'United States' && accountType === 'Corporation' && (
        <>
          <label>Entity Type:</label>
          <select value={entityType} onChange={e => setEntityType(e.target.value)}>
            <option value="">Select Entity Type</option>
            <option value="C Corporation">C Corporation</option>
            <option value="S Corporation">S Corporation</option>
            <option value="LLC">LLC</option>
            <option value="Partnership">Partnership</option>
            <option value="Professional Corporation / Professional Association">Professional Corporation / Professional Association</option>
            <option value="Public Benefit Corporation">Public Benefit Corporation</option>
          </select>

          <label>State of Incorporation:</label>
          <select value={stateOfIncorp} onChange={e => setStateOfIncorp(e.target.value)}>
            <option value="">Select State</option>
            {[
              'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
              'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
              'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
              'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
              'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
            ].map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </>
      )}

      {region === 'Japan' && (
        <>
          <label>Income Bracket:</label>
          <select value={incomeBracket} onChange={e => setIncomeBracket(e.target.value)}>
            <option value="">Select Bracket</option>
            <option value="Below 8 million JPY">Below 8 million JPY</option>
            <option value="Above 8 million JPY">Above 8 million JPY</option>
          </select>
        </>
      )}

      <button type="submit">Save Profile</button>
      {message && <div className="text-sm mt-2 text-blue-700">{message}</div>}
    </form>
  );
};

export default Profile;
