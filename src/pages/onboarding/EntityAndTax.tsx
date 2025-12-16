// src/pages/onboarding/EntityAndTax.tsx
// This component is a refactored version to align with Profile.tsx's data structure and UI.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/hooks/useUser';

export default function EntityAndTax() {
  const { user, loading: userLoading } = useUser();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);

  // UI state from Profile.tsx
  const [country, setCountry] = useState('');
  const [userType, setUserType] = useState('');
  const [incomeBracket, setIncomeBracket] = useState('');
  const [entityType, setEntityType] = useState('');
  const [stateOfIncorp, setStateOfIncorp] = useState('');
  const [message, setMessage] = useState<string>('');

  const showIncomeBracket = useMemo(
    () => country === 'japan' && userType === 'individual',
    [country, userType]
  );
  const showUsCorpExtras = useMemo(
    () => country === 'usa' && userType === 'corporate',
    [country, userType]
  );

  // Load existing data from the 'profiles' table
  useEffect(() => {
    if (userLoading) return;
    if (!user?.id) {
      setMessage('Failed to fetch user info.');
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      setMessage('');
      const { data, error } = await supabase
        .from('profiles')
        .select('country, account_type, income_bracket, us_entity_type, us_state_of_incorporation')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.warn('[Onboarding] load error:', error.message);
      } else if (data) {
        setCountry(data.country ?? '');
        setUserType(data.account_type ?? '');
        setIncomeBracket(data.income_bracket ?? '');
        setEntityType(data.us_entity_type ?? '');
        setStateOfIncorp(data.us_state_of_incorporation ?? '');
      }
      setLoading(false);
    };
    load();
  }, [userLoading, user?.id]);

  // Save data to the 'profiles' table, same as Profile.tsx
  const handleSave = async () => {
    const { data: { user: freshUser }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !freshUser?.id) {
      setMessage('Could not get user. Please sign in again.');
      return;
    }
    setLoading(true);
    setMessage('');
    const normalized = {
      country: country || null,
      account_type: userType || null,
      income_bracket: showIncomeBracket ? (incomeBracket || null) : null,
      us_entity_type: showUsCorpExtras ? (entityType || null) : null,
      us_state_of_incorporation: showUsCorpExtras ? (stateOfIncorp || null) : null,
      updated_at: new Date().toISOString(),
    };
    const payload = { id: freshUser.id, user_id: freshUser.id, ...normalized };
    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'user_id' });

    if (error) {
      console.error('[Onboarding] save error:', error);
      setMessage('Failed to save. Please check settings/permissions.');
    } else {
      setMessage('Saved successfully!');
      setDone(true);
    }
    setLoading(false);
  };

  if (userLoading || (loading && !message)) return <div className="p-6 text-center">Loading...</div>;
  if (!user?.id && !userLoading) return <div className="p-6 text-center text-red-500">User not found. Please sign in again.</div>;

  if (done) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center space-y-4">
        <h1 className="text-2xl font-bold">Setup Complete!</h1>
        <p className="text-muted-foreground">Your profile information has been saved.</p>
        <button
          onClick={() => nav('/dashboard')}
          className="bg-primary text-primary-foreground px-4 py-2 rounded shadow-sm"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div className="space-y-2 mb-4">
        <h1 className="text-2xl font-bold">Profile Setup</h1>
        <p className="text-muted-foreground">Please provide your entity and tax details to get started.</p>
      </div>
      <div className="space-y-4">
        <label className="block text-sm font-medium">Country</label>
        <select className="w-full border p-2 rounded" value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">Select</option>
          <option value="japan">Japan</option>
          <option value="usa">United States</option>
        </select>
        <label className="block text-sm font-medium">User Type</label>
        <select className="w-full border p-2 rounded" value={userType} onChange={(e) => setUserType(e.target.value)}>
          <option value="">Select</option>
          <option value="individual">Individual</option>
          <option value="corporate">Corporation</option>
        </select>
        {showIncomeBracket && (
          <>
            <label className="block text-sm font-medium">Taxable Income (Japan)</label>
            <select className="w-full border p-2 rounded" value={incomeBracket} onChange={(e) => setIncomeBracket(e.target.value)}>
              <option value="">Select</option>
              <option value="under800">Under 8M JPY</option>
              <option value="over800">8M JPY or more</option>
            </select>
          </>
        )}
        {showUsCorpExtras && (
          <>
            <label className="block text-sm font-medium">Corporation Type (US)</label>
            <select className="w-full border p-2 rounded" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
              <option value="">Select</option>
              <option value="C-Corp">C Corporation</option>
              <option value="S-Corp">S Corporation</option>
              <option value="LLC">Limited Liability Company</option>
              <option value="Partnership">Partnership</option>
              <option value="PC/PA">Professional Corporation / Association</option>
              <option value="PBC">Public Benefit Corporation</option>
            </select>
            <label className="block text-sm font-medium">State of Incorporation</label>
            <select className="w-full border p-2 rounded" value={stateOfIncorp} onChange={(e) => setStateOfIncorp(e.target.value)}>
              <option value="">Select</option>
              {[
                'Alabama','Alaska','Arizona','Arkansas','California','Colorado',
                'Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho',
                'Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana',
                'Maine','Maryland','Massachusetts','Michigan','Minnesota',
                'Mississippi','Missouri','Montana','Nebraska','Nevada',
                'New Hampshire','New Jersey','New Mexico','New York',
                'North Carolina','North Dakota','Ohio','Oklahoma','Oregon',
                'Pennsylvania','Rhode Island','South Carolina','South Dakota',
                'Tennessee','Texas','Utah','Vermont','Virginia','Washington',
                'West Virginia','Wisconsin','Wyoming','District of Columbia'
              ].map((state) => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </>
        )}
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded shadow-sm" onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Save and Continue"}
        </button>
        {message && <div className="mt-4 text-sm text-muted-foreground">{message}</div>}
      </div>
    </div>
  );
}
