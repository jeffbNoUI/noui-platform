#!/bin/bash
# Stop hook — remind to verify before closing

cat <<'REMINDER'
Before finishing, verify:
1. All tests pass
2. No uncommitted changes (`git status`)
3. CLAUDE.md updated if corrections were made this session
4. Starter prompt written for next session

Use /session-end to handle all of this automatically.
REMINDER

exit 0
