---
last-verified: 2026-06-08
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authentication/
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authentication/steam-identity/
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authentication/psn-identity/
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authentication/xbox-identity/
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authentication/epic-identity/
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authentication/microsoft-identity/
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authentication/facebook-identity/
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authentication/snapchat-identity/
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authentication/oculus-identity/
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authentication/twitch-identity/
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authentication/oidc-identity/
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authentication/google-identity/
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authentication/discord-identity/
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authentication/awscognito-identity/
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authentication/device-id-identity/
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authentication/apple-identity/
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authentication/google-play-identity/
see-also:
- '[auth-flow.md](../integrate/auth-flow.md)'
- '[auth-failures.md](../debug/auth-failures.md)'
- '[connect-portal.md](../../subskills/connect-portal.md)'
- '[pc-steam-epic.md](pc-steam-epic.md)'
- '[mobile.md](mobile.md)'
- '[console.md](console.md)'
---

# Platform Auth Provider Configuration

Provider-side identity setup is a human handoff gate. The agent must not invent
platform credentials, create placeholder provider JSON, or continue into game
login code when the requested provider is not configured. Stop, ask for the
provider values listed below, and give the official setup reference.

For game-flow planning, provider setup is also a plan-approval gate. If the
requested third-party login provider is missing or inactive, do not ask the user
to approve the Game Flow Plan yet. First ask the user to manually add and
activate the provider in the AGS Admin Portal.

The common AGS Admin Portal path is:

`Game Setup > 3rd Party Configuration > Auth & Account Linking > Add New > <Provider> > Create > Activate`

When AGS CLI or project config reveals both the base URL and namespace, also
construct the direct Admin Portal URL:

`<ags-base-url-without-trailing-slash>/admin/namespaces/<namespace>/login-methods`

Example: `https://prod.gamingservices.accelbyte.io/admin/namespaces/gamestudio-bytewars/login-methods`

If the portal version differs, look for IAM platform credentials or login
methods. For CLI-backed mutation, still discover the exact command and body
with `ags describe` / `--skeleton`; use this file to decide which user-owned
values must already exist before any mutation.

Use this handoff shape before plan approval:

```text
Required AGS Admin Portal setup before plan approval:

1. Open: <direct Admin Portal URL>
2. Add provider: <Portal option>
3. Populate these fields:
   - <provider-specific field 1>
   - <provider-specific field 2>
4. Create/save the provider and set it active.
5. Tell me when this is done so I can run a read-only provider check and then
   ask for Game Flow Plan approval.
```

Do not collapse this to "confirm provider setup." Show the direct URL and the
fields the user needs to populate. For confidentiality-limited providers, say
that the public docs do not expose the exact field names, then ask the user to
fill every required field from the confidential AccelByte/platform-holder guide
or paste the portal field labels for review.

## Coverage Rules

- AGS Public Cloud supports in-game login for the providers listed on the
  authentication overview, but web login is not supported there.
- Web login setup in these guides is Private Cloud / publisher-namespace work
  unless the specific provider guide says otherwise.
- Device ID is for development and debugging unless the game deliberately
  accepts account-loss risk. Prompt the user to plan account upgrade/linking.
- Console and confidentiality-limited providers require the user, AccelByte
  Technical Producer, platform representative, or confidential guide to provide
  missing platform fields. Do not infer those fields.

## Provider Stop Points

Use the "ask the user for" list as the handoff prompt before trying AGS
configuration.

### Steam

- Portal option: `Steam SDK` for in-game login; `Steam Web` for web login.
- Ask the user for:
  - Steam App ID.
  - Steam Publisher Web API Key.
  - Redirect URI: `http://127.0.0.1` for in-game login; the user's domain URL
    for web login.
- Steam-side prerequisite: create a Steam application and create a Publisher Web
  API Key under the Steamworks publisher group.
- Runtime token: Steam auth ticket. Unity examples use
  `GetAuthTicketForWebApi`; Unreal obtains the platform token from the native
  online subsystem.
- Stop if missing: App ID or Publisher Web API Key.

### Epic Games

- Portal option: `Epic Games`.
- Ask the user for:
  - Epic client ID.
  - Epic client secret.
  - Redirect URI: `http://127.0.0.1` for in-game login;
    `<BaseURL>/iam/v3/authenticate` for web login.
- Epic-side prerequisite: organization, product, sandbox, deployment, client,
  brand settings, and Epic Account Services application. Epic permissions in
  the public guide include Basic Profile, Online Presence, and Friends List.
- Runtime token: Epic access token or auth code from EOS/Epic login.
- Stop if missing: Epic client ID or client secret.

### PlayStation Network

- Public guide status: the public AGS docs say to contact AccelByte for access.
- Ask the user for: the confidential AccelByte/PlayStation setup guide outcome
  and any AGS-required PSN credential fields from that guide.
- Runtime token: PSN auth code/token, as required by the SDK/platform flow.
- Stop if missing: confidential-guide values or platform-holder approval.

### Xbox

- Public guide status: the public AGS docs say to contact AccelByte for access.
- Ask the user for: the confidential AccelByte/Xbox setup guide outcome and any
  AGS-required Xbox credential fields from that guide.
- Runtime token: Xbox/XSTS token, as required by the SDK/platform flow.
- Stop if missing: confidential-guide values or platform-holder approval.

### Nintendo

- Public guide status: the authentication overview lists Nintendo in-game login
  as supported, but the public authentication navigation does not expose a
  Nintendo setup guide.
- Ask the user for: Nintendo developer credentials and the confidential
  AccelByte/Nintendo setup requirements.
- Stop if missing: confidential-guide values or platform-holder approval.

### Apple

- Portal option: `Apple`.
- Ask the user for:
  - Apple Service ID.
  - Apple private key as a base64-encoded string of the downloaded `.p8` file.
  - Apple Team ID.
  - Apple Key ID.
- Apple-side prerequisite: Apple Developer account, Sign in with Apple enabled,
  App ID, Service ID, and private key.
- Runtime token: Apple identity credential from the native Apple sign-in flow.
- Stop if missing: any of Service ID, base64 private key, Team ID, or Key ID.

### Google

- Portal option: `Google`.
- Ask the user for:
  - Google OAuth client ID.
  - Google OAuth client secret.
  - Redirect URI: `http://127.0.0.1` for in-game login; web login uses the
    AGS Google web callback URIs from the public guide.
- Google-side prerequisite: Google Cloud project, OAuth consent screen with
  `openid`, OAuth credentials, and authorized redirect URIs including the AGS
  Google authenticate/link URLs.
- Runtime token: Google auth token from the platform/engine flow.
- Stop if missing: OAuth client ID or client secret.

### Google Play Games

- Portal option: `Google Play Games`.
- Ask the user for:
  - Google OAuth client ID.
  - Google OAuth client secret.
  - Redirect URI: `http://127.0.0.1`.
  - For Unreal Android packaging: package name alignment, Games App ID, and
    Google Play License Key.
- Google-side prerequisite: Google Play Console account, Google Play Games
  Services project, OAuth credential configuration, Android package/signing
  setup.
- Runtime token: Google Play auth ID token.
- Stop if missing: OAuth client ID or client secret; for Unreal Android, also
  stop if the Games App ID/package/signing values are unknown.

### Facebook

- Portal option: `Facebook`.
- Ask the user for:
  - Facebook App ID.
  - Facebook App Secret.
  - Redirect URI: `<BaseURL>/iam/v3/platforms/facebook/authenticate`.
- Facebook-side prerequisite: Facebook Developer app, Facebook Login product,
  public_profile advanced access, privacy policy/data deletion setup as needed.
- Runtime shape: web login through Player Portal. The public guide does not
  describe Public Cloud web login support.
- Stop if missing: App ID or App Secret.

### Discord

- Portal option: `Discord`.
- Ask the user for:
  - Discord App Client ID.
  - Discord App Client Secret.
  - Redirect URI: `<BaseURL>` in the AGS form; Discord OAuth redirect URLs must
    include the AGS Discord authenticate/link URLs from the public guide.
- Discord-side prerequisite: Discord Developer application and OAuth2 client
  secret.
- Important: for in-game login, AGS requires the game to implement Discord
  OAuth and obtain the authorization code; AGS does not handle that login flow
  for the game.
- Stop if missing: Client ID, Client Secret, or a game-side OAuth plan/code path
  for in-game login.

### Twitch

- Portal option: `Twitch`.
- Ask the user for:
  - Twitch client ID.
  - Twitch client secret.
  - Redirect URI: `<BaseURL>/iam/v3/platforms/twitch/authenticate` for web
    login; BaseURL/domain redirect for in-game login.
- Twitch-side prerequisite: Twitch developer access, 2FA, registered
  application.
- Runtime token: Twitch auth/login code.
- Stop if missing: client ID, client secret, or redirect URI.

### Snapchat

- Portal option: `Snapchat`.
- Ask the user for:
  - Snap Kit client ID.
  - Snap Kit client secret.
  - Snapchat Login Kit OAuth redirect URI.
- Snapchat-side prerequisite: Snapchat developer account, Snap Kit app, Login
  Kit activated, redirect URI whitelisted.
- Runtime token: Snapchat login/auth code from the web Login Kit flow.
- Stop if missing: Snap Kit client ID, client secret, or redirect URI.

### Oculus

- Portal option: `Oculus SDK` for in-game login; `Oculus Web` for web login.
- Ask the user for:
  - Oculus App ID.
  - Oculus App Secret.
  - Organization ID for web login.
  - Redirect URI: `<BASE_URL>/auth/platforms/oculusweb` for web login.
- Oculus-side prerequisite: Oculus/Meta app and organization setup.
- Runtime token: Oculus platform token after entitlement/native login.
- Stop if missing: App ID or App Secret; for web login also stop if
  Organization ID is missing.

### Microsoft Azure

- Portal option: `Microsoft`.
- Supported shape from the public guide: Admin/web login via Azure AD SAML,
  Private Cloud only.
- Ask the user for:
  - App ID / Entity ID from Azure SAML basic configuration.
  - ACS URL / Reply URL.
  - Federation Metadata URL.
- Microsoft-side prerequisite: Azure AD enterprise application and SAML single
  sign-on.
- Stop if missing: any SAML field or the user's desired flow is in-game login.

### OIDC

- Portal option: `+ Create OIDC`.
- Ask the user to choose one authentication type first:
  - Authorization Code.
  - ID Token.
  - Access Token.
- Authorization Code requires:
  - Platform Name and Platform ID.
  - JWKS URL.
  - Issuer.
  - Client ID.
  - Client Secret.
  - Authorization Request URL.
  - Token Endpoint URL.
  - Claim mapping.
- ID Token requires:
  - Platform Name and Platform ID.
  - JWKS URL.
  - Issuer.
  - Claim mapping.
- Access Token requires:
  - Platform Name and Platform ID.
  - UserInfo Endpoint URL.
  - UserInfo HTTP method.
  - Claim mapping.
- OIDC-side prerequisite: redirect URIs in the IdP must include the AGS
  authenticate and link URLs for the chosen Platform ID.
- Stop if missing: auth type choice or any required URLs/claim mapping.

### AWS Cognito

- Portal option: `AWS Cognito`.
- Ask the user for:
  - Cognito User Pool ID.
  - AWS region.
  - Cognito app client ID for the game-side Cognito login.
- Cognito-side prerequisite: user pool, public app client, BaseURL allowed as a
  callback URL, and `ALLOW_USER_PASSWORD_AUTH` enabled when using the public
  guide's username/password sample flow.
- Runtime token: Cognito access token.
- Stop if missing: User Pool ID, region, or app client ID.

### Device ID

- Portal option: Device ID / anonymous login when exposed by the AGS version.
- Ask the user for: no external provider credentials. Ask whether Device ID is
  development-only or intentionally part of the product flow.
- Runtime token: AGS token minted from a game-provided unique device ID.
- Stop if: the user intends production login but has no account-upgrade or
  account-linking plan.
