---
last-verified: 2026-05-08
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/how-to/create-an-ams-account/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/how-to/link-ams-accounts/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/how-to/unlink-ams-accounts/
see-also:
- '[overview.md](references/overview.md)'
- '[upload.md](upload.md)'
---

# AMS Account Setup

Activate AMS in a namespace, create an AMS account, and link additional game namespaces to share resources. All steps are Admin Portal-based.

## Behavior Constraints

<grounding_rules>

- Read `references/overview.md` before starting — the account setup differs between Public Cloud and Private Cloud.
- Public Cloud: self-service through the Admin Portal. Private Cloud: requires contacting the AccelByte Account Manager.
- Namespaces linked to the same AMS account share: uploaded server images, observability metrics, and billing data.

</grounding_rules>

<tool_usage_rules>

- `Read` for overview.md.
- No Bash, Write, or Edit — account setup is Admin Portal-only.

</tool_usage_rules>

## Workflow

### Step 1 — Determine deployment model

Ask:

> Is your AccelByte environment Public Cloud or Private Cloud?

- **Public Cloud** → self-service via Admin Portal, free trial available
- **Private Cloud** → contact your AccelByte Account Manager or submit a request through the customer support portal. AMS is not enabled via self-service for Private Cloud.

### Step 2 — Activate AMS (Public Cloud)

1. Sign into the Admin Portal and navigate to your **studio namespace** (not the game namespace)
2. Locate the **AMS section** on the homepage
3. Click **"Start Free Trial"** and confirm in the popup
4. AMS becomes active across your studio and game namespaces

After activation, AMS appears in the game namespace's Admin Portal sidebar.

### Step 3 — Create an AMS account

AMS accounts are created per game namespace:

1. Navigate to your **game namespace** in the Admin Portal
2. Click **AMS** in the sidebar
3. Enter an account name in the setup section
4. Click **Create** and confirm

The account details page appears. The AMS account is now linked to this game namespace.

**Account names:** Use a descriptive name (e.g. your studio name or game title). The account name is used for billing and observability grouping.

### Step 4 — Link additional game namespaces (optional)

If your studio has multiple environments (dev, staging, prod) or multiple games sharing the same AMS account:

1. Navigate to the game namespace you want to link
2. In the Admin Portal, open **AMS** and navigate to the account section
3. Click **"Link to existing account"** and select the AMS account to link

Linked namespaces share:
- Uploaded server images (upload once, use across namespaces)
- Observability metrics (single Grafana view across environments)
- Billing

**Unlinking:** Admin Portal → AMS → account → Unlink namespace. Unlinking stops the namespace from accessing the shared account's resources.

### Step 5 — Download CLI tools

After account creation, download the AMS CLI tools needed for the next steps:

1. Admin Portal → AMS → **Download Resource**
2. Download:
   - **AMS Command Line Interface** (for uploading DS builds)
   - **AMS Simulator** (for local testing)

Keep these updated — newer versions include bug fixes and new features.

### Step 6 — Next steps

```
AMS account ready.
  Account: {name}
  Namespace: {namespace}
  CLI tools: downloaded

Next steps:
  1. Integrate your DS binary with the AMS watchdog → /ags ams sdk
  2. Upload your DS build → /ags ams upload
  3. Create a fleet → /ags ams fleet
  
  Or run /ags ams init for the complete guided setup.
```

## Error Handling

| Situation | Response |
|---|---|
| Private Cloud without Account Manager contact | Stop. Self-service is not available. The user must contact AccelByte to enable AMS on Private Cloud. |
| AMS section not visible in Admin Portal | Check that AMS has been activated for the studio namespace first. If still missing, contact AccelByte support — the namespace may need additional configuration. |
| Account creation fails | Verify the user has admin permissions on the game namespace. Non-admin users cannot create AMS accounts. |
| Namespace already linked to a different account | An AMS account can only be linked to one account at a time. Unlink from the current account first, then link to the new one. |
| User wants to share images across two separate game titles | Images are shared within the same AMS account. Link both game namespaces to the same account. Billing and observability will be shared too. |
