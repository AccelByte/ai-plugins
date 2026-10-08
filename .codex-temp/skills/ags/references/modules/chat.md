---
last-verified: 2026-10-07
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/chat/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/chat/manage-chat/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/chat/configuring-chat-with-the-admin-portal/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/chat/chat-profanity-filters/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/chat/chat-reporting-and-moderation/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/chat/system-inbox-notifications/
- https://github.com/AccelByte/accelbyte-unreal-sdk-plugin/blob/master/Source/AccelByteUe4Sdk/Private/Api/AccelByteChatApi.cpp
- https://github.com/AccelByte/accelbyte-unreal-sdk-plugin/blob/master/Source/AccelByteUe4Sdk/Private/Core/AccelByteSettings.cpp
- https://www.npmjs.com/package/@accelbyte/sdk-chat
see-also:
- '[lobby.md](lobby.md)'
- '[session.md](session.md)'
- '[social.md](social.md)'
- '[marketing-to-service.md](../catalogs/marketing-to-service.md)'
---

# Module — Chat

Text chat between players: **personal chat** (direct messages), **party chat**, and **session chat**, plus system notifications sent by the game's admins. Chat is its own AGS service (`chat`), separate from Lobby — it has its own WebSocket connection, its own configuration, and its own Admin Portal section (**Multiplayer > Chat**).

Voice chat is not part of AGS Chat. See "Where Chat ends" below.

---

## The model: topics

Every chat message is sent to a **topic**. The docs use "topic" and "chat room" interchangeably: a topic is a channel messages are sent through, and its members receive what is sent to it.

| Chat kind | Topic | How membership is managed |
|---|---|---|
| **Personal chat** (DM) | A personal topic between two players | One player creates it with the other player's user ID; the other player is notified they were added |
| **Party chat** | The party session's topic | Automatic — see below |
| **Session chat** | The game session's topic | Automatic — see below |

Messages are sent **to a topic ID**, not to a user ID. For a DM that means: create the personal topic first, then send to the topic ID it returns.

### Party and session chat come from the session

Parties are sessions in AGS (see `session.md`), so party chat and session chat work the same way. A session gets a chat topic when **text chat is enabled for it**:

- on its **session template** — set `textChat` to `true` on the template; or
- on the **create request** of a session made without a template (e.g. `TextChat = true` on an Unreal party create request, or `SETTING_SESSION_TEXTCHAT` in the OSS session settings).

When text chat is enabled, the topic is created with the session — including sessions Matchmaking creates from a chat-enabled template. **Players are subscribed to the topic when they join the session and removed when they leave.** Do not add or remove party members from the topic by hand to keep it in sync; listen for the "added to topic" notification to learn the topic ID.

## Connecting

1. The player logs in through IAM.
2. The client connects the **Chat WebSocket**. This is a separate connection from Lobby's: the Unreal SDK derives it as `wss://<base-url>/chat/` (Lobby is `wss://<base-url>/lobby/`), and it speaks JSON-RPC 2.0 rather than Lobby's line-based message format.
   - **Unreal OSS:** set `bAutoChatConnectAfterLoginSuccess=true` under `[OnlineSubsystemAccelByte]` in `DefaultEngine.ini` to connect after login.
   - **Unity:** after login, `apiClient.GetChat()` returns the Chat service; subscribe to `Connected`, then call `Connect()`.
3. Register the notification handlers before acting: new message, added to topic, removed from topic.

The docs' integration guide shows the calls per engine — creating a personal topic (`CreatePersonalTopic`), sending to a topic (`SendChat` in Unreal), and the new-message and added-to-topic delegates or events. Check the exact names against the SDK version the project pins before writing them; see `../sdks/deprecation-check.md`.

The **TypeScript SDK** (`@accelbyte/sdk-chat`) wraps Chat's REST API — topics, chat history, mute, ban, moderation, configuration — and does not include a Chat WebSocket client. A browser client that needs realtime chat has to open the WebSocket itself; do not invent a TypeScript helper for it.

## Configuration (Admin Portal → Multiplayer → Chat → Chat Configurations)

| Setting | What it controls | Default |
|---|---|---|
| **Chat Rate Limit Duration** / **Burst** | Token bucket on how many messages a player may send: a burst of up to *Burst* messages, then wait for tokens to refill over *Duration* | 1,000 ms / 10 messages |
| **Chat Character Limit** | Maximum length of a single message | 500 characters |
| **Chat Spam Limit Duration** / **Burst** | How many **identical** messages a player may send within the duration before being marked as spam | 30,000 ms / 5 messages |
| **Spam Mute Duration** | How long a player marked as spamming is muted | 600,000 ms (10 minutes) |
| **Clan Chat** | Private chat between clan members | Disabled |

So "players flooding a channel with the same message" is the **spam limit**, and "players sending too many messages" is the **rate limit** — both enforced by the service. Client-side throttling is a UX nicety on top, never the control.

## Moderation and notifications

- **Profanity filter** — managed under **Multiplayer > Chat > Chat Profanity Filter**: register words, plus false negatives (variants to also censor) and false positives (words containing a profane word that must not be censored). Players can turn filtering off for their own account through the user chat configuration. The filter can be overridden with Extend — see `/ags-extend`.
- **Reporting and moderation** — players report chat messages, players, or UGC; admins act on reports manually or through auto-moderation rules. Reporting is its own service (`reporting`); see `../catalogs/marketing-to-service.md`.
- **Topic moderation** — muting, unmuting, banning and unbanning topic members, and deleting messages, are Chat operations.
- **System inbox notifications** — persistent messages admins send to players' inboxes (news, gift codes, penalties, maintenance), managed under **Multiplayer > Chat > System Messages**. They need `ADMIN:NAMESPACE:{namespace}:CHAT:INBOX`. **System transient notifications** are momentary pop-ups tied to categories the game defines.

## Where Chat ends

- **Party membership, presence and invitations** are Parties & Presence and Session — see `lobby.md` and `session.md`. Chat only carries messages for the party's topic.
- **Friends and blocking** are Social — see `social.md`.
- **Voice chat** is not AGS Chat. Studios integrate a third-party voice SDK, typically with an Extend Service Extension for authorization — that conversation belongs in `/ags-extend`.

## Common mistakes

- **Treating Chat as part of Lobby.** Lobby's WebSocket protocol also defines party and personal chat messages, but topics, session chat, the chat configuration and moderation above belong to AGS Chat, which has its own connection. A client connected only to Lobby is not connected to Chat.
- **Sending to a user ID.** Messages go to a topic ID; create the personal topic first.
- **Managing party topic membership by hand.** Enable text chat on the session and let joins and leaves drive membership.
- **Forgetting the session template.** A party or session created from a template without `textChat` gets no chat topic.
- **Building spam control only in the client.** Configure the spam and rate limits; a modified client bypasses client-side checks.
