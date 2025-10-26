// 作業場所: github
// ファイル名: src/components/SignupForm.jsx（既存ファイル）

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("JP");
  const [userType, setUserType] = useState("individual");
  const [accountingMethod, setAccountingMethod] = useState("");
  const [hasSpouse, setHasSpouse] = useState(false);
  const [numDependents, setNumDependents] = useState(0);
  const [rAndDExpense, setRAndDExpense] = useState(0);

  const handleSignup = async (e) => {
    e.preventDefault();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (authError || !authData.user) return alert("Signup error.");

    const { error: insertError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      country,
      user_type: userType,
      accounting_method: accountingMethod,
      has_spouse: hasSpouse,
      num_dependents: numDependents,
      r_and_d_expense: rAndDExpense,
    });
    if (insertError) return alert("Profile insert error.");
    alert("Signup successful.");
  };

  return (
    <form onSubmit={handleSignup} className="space-y-4">
      <div>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <label>国</label>
        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="JP">日本</option>
          <option value="US">アメリカ</option>
        </select>
      </div>
      <div>
        <label>種別</label>
        <select value={userType} onChange={(e) => setUserType(e.target.value)}>
          <option value="individual">個人</option>
          <option value="corporation">法人</option>
        </select>
      </div>
      <div>
        <label>会計方式</label>
        {country === "JP" && userType === "individual" && (
          <select value={accountingMethod} onChange={(e) => setAccountingMethod(e.target.value)}>
            <option value="blue">青色申告</option>
            <option value="white">白色申告</option>
          </select>
        )}
        {country === "JP" && userType === "corporation" && (
          <select value={accountingMethod} onChange={(e) => setAccountingMethod(e.target.value)}>
            <option value="J-GAAP">J-GAAP</option>
            <option value="IFRS">IFRS</option>
          </select>
        )}
        {country === "US" && userType === "individual" && (
          <select value={accountingMethod} onChange={(e) => setAccountingMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="accrual">Accrual</option>
          </select>
        )}
        {country === "US" && userType === "corporation" && (
          <select value={accountingMethod} onChange={(e) => setAccountingMethod(e.target.value)}>
            <option value="US-GAAP">US GAAP</option>
            <option value="IFRS">IFRS</option>
          </select>
        )}
      </div>
      {country === "JP" && userType === "individual" && (
        <>
          <div>
            <label>配偶者がいる</label>
            <input type="checkbox" checked={hasSpouse} onChange={(e) => setHasSpouse(e.target.checked)} />
          </div>
          <div>
            <label>扶養家族数</label>
            <input type="number" value={numDependents} onChange={(e) => setNumDependents(Number(e.target.value))} />
          </div>
        </>
      )}
      {country === "US" && userType === "corporation" && (
        <div>
          <label>R&D費用 (USD)</label>
          <input type="number" value={rAndDExpense} onChange={(e) => setRAndDExpense(Number(e.target.value))} />
        </div>
      )}
      <button type="submit">サインアップ</button>
    </form>
  );
}
