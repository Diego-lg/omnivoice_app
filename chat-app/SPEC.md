# AI Chat Application Specification

## Project Overview

- **Project Name**: OmniVoice Chat
- **Type**: React Web Application
- **Core Functionality**: A minimalist chat interface that connects to AI backends (MiniMax API or Ollama) for conversational responses
- **Target Users**: Developers and users seeking a clean, distraction-free AI chat interface

## Technical Stack

- **Framework**: React 18 with Vite
- **Styling**: CSS Modules with CSS Variables
- **State Management**: React hooks (useState, useRef, useEffect)
- **HTTP Client**: Native fetch API
- **Build Tool**: Vite

## Visual & UI Specification

### Theme: Monochrome Minimalist

**Color Palette**:

- Background Primary: `#0A0A0A` (near-black)
- Background Secondary: `#141414` (dark gray)
- Background Tertiary: `#1F1F1F` (card/input background)
- Border: `#2A2A2A` (subtle borders)
- Text Primary: `#FFFFFF` (white)
- Text Secondary: `#A0A0A0` (muted gray)
- Text Tertiary: `#666666` (disabled/hints)
- Accent: `#E0E0E0` (hover states, highlights)
- User Message BG: `#252525`
- AI Message BG: `#1A1A1A`
- Error: `#FF4444`

### Typography

- **Font Family**: `"IBM Plex Mono", "SF Mono", "Consolas", monospace` for headers
- **Body Font**: `"Inter", -apple-system, BlinkMacSystemFont, sans-serif`
- **Font Sizes**:
  - Header: 18px, weight 600
  - Body: 14px, weight 400
  - Small/Meta: 12px, weight 400
  - Input: 15px

### Layout

```
┌─────────────────────────────────────────┐
│  Header: Logo + Provider Selector      │
├─────────────────────────────────────────┤
│                                         │
│  Chat Container (scrollable)           │
│  ┌─────────────────────────────────┐   │
│  │ User Message (right-aligned)    │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ AI Message (left-aligned)       │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│  Input Area: Textarea + Send Button    │
└─────────────────────────────────────────┘
```

### Responsive Breakpoints

- **Desktop**: max-width 800px, centered
- **Tablet**: Full width with padding 24px
- **Mobile**: Full width with padding 16px

### Animations & Effects

- Message fade-in: opacity 0→1, translateY(10px→0), 200ms ease-out
- Button hover: background transition 150ms
- Input focus: border color transition 200ms
- Scroll: smooth scrolling behavior

## Components Specification

### 1. Header Component

- Logo text: "OMNIVOICE" in monospace
- Provider dropdown: Minimal select with current provider name
- Settings toggle icon (optional)

### 2. ChatMessage Component

**Props**:

- `content`: string - message text
- `role`: "user" | "assistant" - determines alignment and styling
- `timestamp`: Date - message time

**States**:

- Default: Static message display
- Loading: Pulsing dots animation for AI response in progress

### 3. ChatContainer Component

- Scrollable message list
- Auto-scroll to bottom on new message
- Empty state: "Start a conversation..." centered text
- Loading skeleton for initial AI response

### 4. MessageInput Component

- Auto-expanding textarea (1-5 lines)
- Placeholder: "Type your message..."
- Send button (enabled when text present)
- Keyboard: Enter to send, Shift+Enter for newline
- Disabled state during AI response

### 5. ProviderSelector Component

- Dropdown with options: "MiniMax API", "Ollama (Local)"
- Shows connection status indicator (dot: green=connected, yellow=connecting, red=error)
- Settings modal for API key/endpoint configuration

### 6. SettingsModal Component

**MiniMax Configuration**:

- API Key input (password type)
- Base URL input (optional, defaults to MiniMax endpoint)

**Ollama Configuration**:

- Base URL input (defaults to `http://localhost:11434`)
- Model selector (if multiple models available)
- Model dropdown: llama3.2, mistral, etc.

## Functionality Specification

### Core Features

1. **Message Sending**
   - User types message in textarea
   - Press Enter or click Send button
   - Message appears immediately in chat
   - Input clears after sending
   - AI response loads progressively

2. **Provider Switching**
   - Select provider from dropdown
   - Settings modal for configuration
   - Persist settings in localStorage
   - Graceful fallback on connection failure

3. **API Integration**

   **MiniMax API**:
   - Endpoint: `https://api.minimax.chat/v1/text/chatcompletion_v2`
   - Headers: `Authorization: Bearer {API_KEY}`, `Content-Type: application/json`
   - Request body: `{ model, messages: [{role, content}] }`
   - Stream responses for real-time display

   **Ollama API**:
   - Endpoint: `{BASE_URL}/api/chat`
   - Headers: `Content-Type: application/json`
   - Request body: `{ model: "{selected_model}", messages: [{role, content}], stream: true }`
   - SSE streaming for responses

4. **Error Handling**
   - Network errors: Display retry option
   - API errors: Show error message in chat
   - Invalid config: Highlight settings fields

5. **Message Persistence**
   - Store messages in component state
   - Clear chat option in header menu
   - No localStorage persistence (ephemeral by design)

### User Interactions

| Action          | Result                           |
| --------------- | -------------------------------- |
| Type message    | Input field updates              |
| Press Enter     | Send message (unless Shift held) |
| Click Send      | Send message                     |
| Select provider | Switch active API                |
| Click Settings  | Open configuration modal         |
| Scroll up       | View older messages              |
| New message     | Auto-scroll to bottom            |

## File Structure

```
chat-app/
├── index.html
├── package.json
├── vite.config.js
├── SPEC.md
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── Header.css
│   │   ├── ChatContainer.jsx
│   │   ├── ChatContainer.css
│   │   ├── ChatMessage.jsx
│   │   ├── ChatMessage.css
│   │   ├── MessageInput.jsx
│   │   ├── MessageInput.css
│   │   ├── ProviderSelector.jsx
│   │   ├── ProviderSelector.css
│   │   ├── SettingsModal.jsx
│   │   └── SettingsModal.css
│   └── services/
│       ├── api.js
│       ├── minimax.js
│       └── ollama.js
```

## Acceptance Criteria

1. ✅ Application renders with black/white theme
2. ✅ User can type and send messages
3. ✅ Messages display with correct alignment (user right, AI left)
4. ✅ Provider dropdown switches between MiniMax/Ollama
5. ✅ Settings modal allows API key/URL configuration
6. ✅ Settings persist across page reloads (localStorage)
7. ✅ AI responses stream in real-time
8. ✅ Error states display appropriately
9. ✅ Responsive layout works on mobile/tablet/desktop
10. ✅ Smooth animations on message appearance
