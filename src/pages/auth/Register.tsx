// File: src/pages/auth/Register.tsx

import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const Register = () => {
  // State for region (country) and account type (Individual/Corporation)
  const [region, setRegion] = useState('');
  const [accountType, setAccountType] = useState('Individual');
  const [entityType, setEntityType] = useState('');
  const [stateOfIncorp, setStateOfIncorp] = useState('');
  const [incomeBracket, setIncomeBracket] = useState('');
  // Other registration state fields (email, password, etc.)...
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    // Sign up with Supabase Auth
    const { user, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      console.error('Sign up error:', error.message);
      return;
    }
    // After successful sign-up, insert profile data
    const updates: any = {
      user_id: user?.id,
      email: email,
      region: region,
      account_type: accountType,
      // Only include extra fields if they are applicable
      ...(region === 'United States' && accountType === 'Corporation' ? {
        entity_type: entityType,
        state_of_incorporation: stateOfIncorp,
      } : {}),
      ...(region === 'Japan' ? { income_bracket: incomeBracket } : {}),
    };
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(updates, { returning: 'minimal' });
    if (profileError) {
      console.error('Profile update error:', profileError.message);
    }
  };

  return (
    <form onSubmit={handleRegister}>
      {/* ... other fields (email, password, etc.) ... */}

      <label>Region:</label>
      <select value={region} onChange={e => { setRegion(e.target.value); }}>
        <option value="">Select Region</option>
        <option value="United States">United States</option>
        <option value="Japan">Japan</option>
      </select>

      <label>Account Type:</label>
      <select value={accountType} onChange={e => setAccountType(e.target.value)}>
        <option value="Individual">Individual</option>
        <option value="Corporation">Corporation</option>
      </select>

      {/* US Corporation -> show Entity Type and State */}
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
            {/* List all 50 states + DC */}
            {[
              'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
              'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
              'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
              'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
              'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
            ].map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </>
      )}

      {/* Japan (any type) -> show Income Bracket */}
      {region === 'Japan' && (
        <>
          <label>Income Bracket:</label>
          <select value={incomeBracket} onChange={e => setIncomeBracket(e.target.value)}>
            <option value="">Select Income Bracket</option>
            <option value="Below 8 million JPY">Below 8 million JPY</option>
            <option value="Above 8 million JPY">Above 8 million JPY</option>
          </select>
        </>
      )}

      <button type="submit">Register</button>
    </form>
  );
};

export default Register;
