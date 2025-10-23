# Import Path Fixing Guide

Due to TypeScript path alias issues with the read-only tsconfig.json, all `@/` imports need to be converted to relative paths.

## Common Replacements for Pages (`src/pages/**`)

### UI Components
- `@/components/ui/card` → `../components/ui/card`
- `@/components/ui/button` → `../components/ui/button`
- `@/components/ui/input` → `../components/ui/input`
- `@/components/ui/label` → `../components/ui/label`
- `@/components/ui/badge` → `../components/ui/badge`
- `@/components/ui/tabs` → `../components/ui/tabs`
- `@/components/ui/select` → `../components/ui/select`
- `@/components/ui/separator` → `../components/ui/separator`
- `@/components/ui/textarea` → `../components/ui/textarea`
- `@/components/ui/progress` → `../components/ui/progress`
- `@/components/ui/radio-group` → `../components/ui/radio-group`
- `@/components/ui/alert` → `../components/ui/alert`
- `@/components/ui/dialog` → `../components/ui/dialog`
- `@/components/ui/checkbox` → `../components/ui/checkbox`
- `@/components/ui/alert-dialog` → `../components/ui/alert-dialog`
- `@/components/ui/accordion` → `../components/ui/accordion`
- `@/components/ui/switch` → `../components/ui/switch`
- `@/components/ui/skeleton` → `../components/ui/skeleton`
- `@/components/ui/calendar` → `../components/ui/calendar`
- `@/components/ui/popover` → `../components/ui/popover`
- `@/components/ui/table` → `../components/ui/table`
- `@/components/ui/dropdown-menu` → `../components/ui/dropdown-menu`
- `@/components/ui/avatar` → `../components/ui/avatar`
- `@/components/ui/sonner` → `../components/ui/sonner`
- `@/components/ui/form` → `../components/ui/form`
- `@/components/ui/scroll-area` → `../components/ui/scroll-area`

### Hooks
- `@/hooks/useAuth` → `../hooks/useAuth`
- `@/hooks/use-toast` → `../hooks/use-toast`
- `@/hooks/useProfile` → `../hooks/useProfile`
- `@/hooks/useSIWE` → `../hooks/useSIWE`
- `@/hooks/useWallet` → `../hooks/useWallet`
- `@/hooks/useInvoiceStatus` → `../hooks/useInvoiceStatus`
- `@/hooks/useScrollToTop` → `../hooks/useScrollToTop`

### Supabase & Integrations
- `@/integrations/supabase/client` → `../integrations/supabase/client`
- `@/integrations/supabase/types` → `../integrations/supabase/types`
- `@/lib/supabaseClient` → `../lib/supabaseClient`
- `@/lib/walletSync` → `../lib/walletSync`

### Components
- `@/components/Navigation` → `../components/Navigation`
- `@/components/UserProfile` → `../components/UserProfile`
- `@/components/WalletConnectButton` → `../components/WalletConnectButton`
- `@/components/InvoiceGenerator` → `../components/InvoiceGenerator`
- `@/components/InvoiceStatusTracker` → `../components/InvoiceStatusTracker`
- `@/components/CustomerManager` → `../components/CustomerManager`
- `@/components/WalletAddressInput` → `../components/WalletAddressInput`
- `@/components/IFRSReport` → `../components/IFRSReport`
- `@/components/USTaxCalculator` → `../components/USTaxCalculator`

### For Nested Pages (auth/, invoice/, etc.)
Add one more `../` level:
- `@/components/ui/card` → `../../components/ui/card`
- `@/hooks/useAuth` → `../../hooks/useAuth`
- `@/integrations/supabase/client` → `../../integrations/supabase/client`

## Type Safety Fixes

Add explicit types where `any` is implicit:
```typescript
// Before
(e) => handleChange(e)

// After  
(e: React.ChangeEvent<HTMLInputElement>) => handleChange(e)
```

For form events:
- `HTMLInputElement` for input changes
- `HTMLTextAreaElement` for textarea changes  
- `HTMLSelectElement` for select changes
- `React.FormEvent` for form submissions
