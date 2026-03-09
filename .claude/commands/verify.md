# Verify

Use the preview tools to verify the current feature works correctly in the browser.

## Steps

1. Start the dev server if not already running:
   - Use `preview_start` with the "frontend" configuration
   - Wait for the server to be ready

2. Navigate to the relevant page for the feature being worked on.

3. Take a snapshot and screenshot:
   - Use `preview_snapshot` to get the accessibility tree (verify text content and element structure)
   - Use `preview_screenshot` to capture the visual state

4. Check for errors:
   - Use `preview_console_logs` with level "error" to check for JavaScript errors
   - Use `preview_network` with filter "failed" to check for failed API calls

5. Interact with the feature:
   - Click buttons, fill forms, navigate between views as needed to exercise the feature
   - Take snapshots/screenshots after each significant interaction

6. Report findings:
   - What works correctly
   - Any console errors or failed network requests
   - Any visual issues or missing content
   - Any accessibility concerns (missing labels, broken structure)

If issues are found, fix them and re-verify. Repeat until clean.
