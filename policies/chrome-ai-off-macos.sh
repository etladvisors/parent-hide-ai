#!/bin/bash
# ---------------------------------------------------------------------------
# Disables Google Chrome's built-in AI features machine-wide on macOS.
# Run with:  sudo bash chrome-ai-off-macos.sh
# Then fully quit Chrome (Cmd-Q) and reopen. Verify at chrome://policy.
#
# Writes to /Library/Preferences so it applies to EVERY user account on the
# machine and a non-admin user cannot remove it. Chrome will show
# "Managed by your organization" in its menu — that is expected.
#
# To undo:   sudo bash chrome-ai-off-macos.sh --undo
# ---------------------------------------------------------------------------
set -euo pipefail

PLIST="/Library/Preferences/com.google.Chrome"

if [[ "${1:-}" == "--undo" ]]; then
  for key in AIModeSettings GenAiDefaultSettings GeminiSettings; do
    defaults delete "$PLIST" "$key" 2>/dev/null || true
  done
  echo "Chrome AI policies removed. Restart Chrome."
  exit 0
fi

# Removes the AI Mode button from the address bar and New Tab page,
# and disables the AI Mode feature itself.
defaults write "$PLIST" AIModeSettings -integer 1

# Default-disables ALL of Chrome's GenAI features, including ones Google
# ships in the future (2 = "do not allow").
defaults write "$PLIST" GenAiDefaultSettings -integer 2

# Disables the Gemini app/side-panel integration.
defaults write "$PLIST" GeminiSettings -integer 1

# Once the extension is published to the Chrome Web Store, uncomment and set
# its 32-char ID to force-install it so it cannot be disabled or removed:
# defaults write "$PLIST" ExtensionInstallForcelist -array-add \
#   "EXTENSION_ID_HERE;https://clients2.google.com/service/update2/crx"

echo "Chrome AI policies applied. Fully quit and reopen Chrome, then check chrome://policy."
