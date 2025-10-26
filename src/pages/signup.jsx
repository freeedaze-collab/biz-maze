import React, { useState } from 'react'
import { supabase } from '../utils/supabaseClient'

function SignupPage() {
  // New state for country, user type, and extra inputs
  const [country, setCountry] = useState('Japan')
  const [userType, setUserType] = useState('Individual')
  const [dependentCount, setDependentCount] = useState(0)
  const [rndExpense, setRndExpense] = useState(0)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSignup = async (e) => {
    e.preventDefault()
    // Sign up with additional metadata for country/type and extra fields
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          country,
          user_type: userType,
          dependent_count: dependentCount,
          rnd_expense: rndExpense,
        },
      },
    })
    if (error) {
      console.error('Signup error:', error)
    } else {
      console.log('Signed up user:', data)
    }
  }

  return (
    <form onSubmit={handleSignup}>
      {/* Existing email/password fields */}
      <label>Email:</label>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      <label>Password:</label>
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />

      {/* Country and Entity Type selectors */}
      <label>Country:</label>
      <select value={country} onChange={e => setCountry(e.target.value)}>
        <option value="Japan">Japan</option>
        <option value="United States">United States</option>
      </select>

      <label>Entity Type:</label>
      <select value={userType} onChange={e => setUserType(e.target.value)}>
        <option value="Individual">Individual</option>
        <option value="Corporation">Corporation</option>
      </select>

      {/* Conditional fields based on selection */}
      {country === 'Japan' && userType === 'Individual' && (
        <div>
          <label>Dependents:</label>
          <input
            type="number"
            value={dependentCount}
            onChange={e => setDependentCount(Number(e.target.value))}
            min="0"
          />
        </div>
      )}

      {country === 'United States' && userType === 'Corporation' && (
        <div>
          <label>R&amp;D Expenses:</label>
          <input
            type="number"
            value={rndExpense}
            onChange={e => setRndExpense(Number(e.target.value))}
            min="0"
          />
        </div>
      )}

      <button type="submit">Sign Up</button>
    </form>
  )
}

export default SignupPage
