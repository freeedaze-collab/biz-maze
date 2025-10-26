import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

export default function Profile() {
  const [email, setEmail] = useState("")
  const [country, setCountry] = useState("Japan")
  const [userType, setUserType] = useState("Individual")
  const [dependentCount, setDependentCount] = useState(0)
  const [rndExpense, setRndExpense] = useState(0)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email || "")
      setCountry(user.user_metadata?.country || "Japan")
      setUserType(user.user_metadata?.user_type || "Individual")
      setDependentCount(user.user_metadata?.dependent_count || 0)
      setRndExpense(user.user_metadata?.rnd_expense || 0)
    })()
  }, [])

  const handleSave = async () => {
    const { error } = await supabase.auth.updateUser({
      data: {
        country,
        user_type: userType,
        dependent_count: dependentCount,
        rnd_expense: rndExpense,
      }
    })
    if (error) {
      alert("保存に失敗しました: " + error.message)
    } else {
      alert("保存しました")
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>
      <Card>
        <CardHeader><CardTitle>Basic Info</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input value={email} readOnly disabled />
          </div>

          <div>
            <Label>Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Japan">Japan</SelectItem>
                <SelectItem value="United States">United States</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>User Type</Label>
            <Select value={userType} onValueChange={setUserType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Individual">Individual</SelectItem>
                <SelectItem value="Corporation">Corporation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 条件付き入力：扶養人数 */}
          {country === "Japan" && userType === "Individual" && (
            <div>
              <Label>扶養人数（日本個人向け）</Label>
              <Input
                type="number"
                value={dependentCount}
                onChange={e => setDependentCount(Number(e.target.value))}
              />
            </div>
          )}

          {/* 条件付き入力：R&D費用 */}
          {country === "United States" && userType === "Corporation" && (
            <div>
              <Label>R&D費用（米国法人向け）</Label>
              <Input
                type="number"
                value={rndExpense}
                onChange={e => setRndExpense(Number(e.target.value))}
              />
            </div>
          )}

          <Button onClick={handleSave}>保存</Button>
        </CardContent>
      </Card>
    </div>
  )
}
