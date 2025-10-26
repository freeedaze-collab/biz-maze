import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('JP');            // 追加: 国籍
  const [entityType, setEntityType] = useState('personal'); // 追加: 個人/法人区分
  const [dependents, setDependents] = useState(0);         // 追加: 扶養人数（日本・個人用）
  const [rdCredit, setRdCredit] = useState(0);             // 追加: R&Dクレジット（米国・法人用）
  const [error, setError] = useState(null);

  const handleSignUp = async (e) => {
    e.preventDefault();
    // Supabase でユーザー登録
    const { user, session, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) {
      setError(error.message);
    } else {
      // プロフィール情報を profiles テーブルに挿入（id, country, entityType, dependents, rd_credit など）
      const { data, error: insertError } = await supabase
        .from('profiles')
        .insert([
          { 
            id: user.id, 
            email: email, 
            country: country, 
            entity_type: entityType, 
            dependents: dependents, 
            rd_credit: rdCredit 
          }
        ]);
      if (insertError) {
        setError(insertError.message);
      }
    }
  };

  return (
    <form onSubmit={handleSignUp}>
      <label>
        メールアドレス:
        <input 
          type="email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required 
        />
      </label>
      <label>
        パスワード:
        <input 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
        />
      </label>
      {/* 追加: 国籍選択 */}
      <label>
        国籍:
        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="JP">日本</option>
          <option value="US">アメリカ</option>
        </select>
      </label>
      {/* 追加: 個人/法人区分選択 */}
      <label>
        区分:
        <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          <option value="personal">個人</option>
          <option value="corporate">法人</option>
        </select>
      </label>
      {/* 国籍＝日本かつ法人＝個人 の場合の扶養人数入力 */}
      {country === 'JP' && entityType === 'personal' && (
        <label>
          扶養人数:
          <input 
            type="number" 
            value={dependents} 
            onChange={(e) => setDependents(parseInt(e.target.value) || 0)} 
            min="0" 
          />
        </label>
      )}
      {/* 国籍＝アメリカかつ区分＝法人 の場合のR&Dクレジット入力 */}
      {country === 'US' && entityType === 'corporate' && (
        <label>
          R&Dクレジット (USD):
          <input 
            type="number" 
            value={rdCredit} 
            onChange={(e) => setRdCredit(parseFloat(e.target.value) || 0)} 
            min="0" 
          />
        </label>
      )}
      <button type="submit">サインアップ</button>
      {error && <p style={{color: 'red'}}>{error}</p>}
    </form>
  );
}
