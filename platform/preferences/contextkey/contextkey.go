// platform/preferences/contextkey/contextkey.go
package contextkey

import (
	"crypto/sha256"
	"fmt"
)

// Compute produces a deterministic context key from coarsened CaseFlags.
// Only hasDRO, isEarlyRetirement, and tier are included — other flags
// affect panel existence (handled by composition), not layout preferences.
func Compute(hasDRO, isEarlyRetirement bool, tier int) string {
	raw := fmt.Sprintf("dro=%v;early=%v;tier=%d", hasDRO, isEarlyRetirement, tier)
	h := sha256.Sum256([]byte(raw))
	return fmt.Sprintf("%x", h[:8]) // 16-char hex, plenty unique for 12 buckets
}
