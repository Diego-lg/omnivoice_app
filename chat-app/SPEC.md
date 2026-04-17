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
- **Markdown**: react-markdown, react-syntax-highlighter, remark-gfm

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

### 7. TypingIndicator Component

**Files**: `TypingIndicator.jsx`, `TypingIndicator.css`

**Description**: Animated indicator showing when AI is thinking/typing

**Features**:

- Three bouncing dots animation
- "AI is thinking..." label
- Smooth fade-in/out transitions
- Shows before first token arrives during streaming

**Animation**:

- Bounce effect with staggered timing (0ms, 150ms, 300ms delays)
- Duration: 600ms per bounce cycle
- Infinite loop until streaming begins

### 8. SearchOverlay Component

**Files**: `SearchOverlay.jsx`, `SearchOverlay.css`

**Description**: Full-screen overlay for searching through conversation history

**Features**:

- Search icon in header opens overlay
- Real-time case-insensitive filtering
- Highlighted search terms in results
- Click to navigate to message
- Keyboard navigation (arrows to select, Enter to go, Escape to close)
- Shows message preview with highlighted matches
- Message timestamp and role indicator

### 9. PersonaSelector Component

**Files**: `PersonaSelector.jsx`, `PersonaSelector.css`

**Description**: Dropdown selector for choosing AI conversation personas

**Features**:

- 5 premade personas: Assistant, Code Helper, Creative Writer, Technical Analyst, Debate Partner
- Custom persona selection when available
- Current persona indicator
- Smooth dropdown animation

### 10. PersonaEditor Component

**Files**: `PersonaEditor.jsx`, `PersonaEditor.css`

**Description**: Modal interface for creating and managing custom personas

**Features**:

- Create custom personas with emoji avatars
- Edit existing custom personas
- Delete custom personas
- System prompt input for persona definition
- 5 predefined emoji options for avatar
- Personas persisted to localStorage
- System prompts prepended to API messages

**Predefined Personas**:
| Persona | Emoji | Description |
|---------|-------|-------------|
| Assistant | 🤖 | General helpful assistant |
| Code Helper | 💻 | Programming and code assistance |
| Creative Writer | ✍️ | Creative writing and brainstorming |
| Technical Analyst | 📊 | Technical analysis and research |
| Debate Partner | ⚖️ | Discussion and debate partner |

### 11. ChatHistory Component

**Files**: `ChatHistory.jsx`, `ChatHistory.css`

**Description**: Sliding sidebar panel for managing chat sessions

**Features**:

- Slide-in sidebar from left side with backdrop
- New chat button to create fresh conversations
- Search input to filter sessions by title/content
- Session cards showing title, time ago, message count
- Inline rename functionality with Enter/Escape keys
- Export individual session as JSON file
- Export all chats as JSON backup
- Delete session with hover actions
- Sessions sorted by most recent activity
- Toggle button visible when sidebar is closed

### 12. ChatMessage Component (Enhanced)

**Files**: `ChatMessage.jsx`, `ChatMessage.css`

**Enhanced Features**:

- Full markdown rendering with `react-markdown`
- Syntax highlighting for code blocks with `react-syntax-highlighter`
- Support for: bold, italic, inline code, code blocks, blockquotes, lists, links, tables
- GitHub-flavored markdown via `remark-gfm`
- Streaming cursor animation during AI response
- Max-height with scroll for long messages
- Smooth container expansion animation

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

6. **Typing Indicators**
   - Animated "AI is thinking..." indicator with bouncing dots
   - Shows before first token arrives during streaming
   - Component: `TypingIndicator.jsx` + `TypingIndicator.css`
   - Three bouncing dots with staggered animation timing

7. **Markdown Rendering**
   - Full markdown support for AI and user messages
   - Dependencies: `react-markdown`, `react-syntax-highlighter`, `remark-gfm`
   - Supports: bold, italic, inline code, code blocks with syntax highlighting, blockquotes, lists, links, tables
   - Code blocks use Prism syntax highlighting theme

8. **Image Upload**
   - Upload images via button click or drag-and-drop
   - Support for up to 4 images per message
   - Image previews with remove functionality
   - Images stored as base64 data URLs
   - Visual drop zone indicator when dragging files
   - File type validation (images only)

9. **Character/Token Counter**
   - Real-time character count in input area
   - Estimated token count (chars / 4)
   - Shows image count when images are attached
   - Displayed below the input textarea

10. **Message Search**
    - Search icon in header opens search overlay
    - Real-time case-insensitive filtering
    - Highlighted search terms in results
    - Click to navigate to message
    - Keyboard navigation (arrows, Enter, Escape)
    - Shows message preview with context

11. **Conversation Branching**
    - Fork conversations at any user message
    - Branch selector dropdown in header
    - Visual indicator of current branch
    - Branches persisted to localStorage
    - Each branch maintains its own message history
    - Branch naming/identification in dropdown

12. **Multiple Persona Editor**
    - 5 premade personas: Assistant, Code Helper, Creative Writer, Technical Analyst, Debate Partner
    - Custom persona creation with emoji avatars
    - Edit/delete custom personas
    - System prompts prepended to API messages
    - Personas persisted to localStorage
    - Persona data stored in `src/data/personas.js`

13. **Enhanced Auto-response Streaming**
    - Blinking cursor during streaming
    - Streaming progress indicator
    - Smooth container expansion
    - Max-height with scroll for long messages
    - Performance optimizations for large responses

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
│   │   ├── SettingsModal.css
│   │   ├── TypingIndicator.jsx
│   │   ├── TypingIndicator.css
│   │   ├── SearchOverlay.jsx
│   │   ├── SearchOverlay.css
│   │   ├── PersonaSelector.jsx
│   │   ├── PersonaSelector.css
│   │   ├── PersonaEditor.jsx
│   │   ├── PersonaEditor.css
│   │   ├── ChatHistory.jsx
│   │   └── ChatHistory.css
│   ├── data/
│   │   └── personas.js
│   └── services/
│       ├── api.js
│       ├── minimax.js
│       └── ollama.js
```

## Acceptance Criteria

### Core Functionality

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

### New Features

#### Typing Indicators

11. ✅ Animated typing indicator displays before first token
12. ✅ Bouncing dots animation with staggered timing
13. ✅ Indicator disappears when streaming begins

#### Markdown Rendering

14. ✅ AI messages render full markdown formatting
15. ✅ Code blocks display with syntax highlighting
16. ✅ Support for bold, italic, links, lists, tables, blockquotes

#### Image Upload

17. ✅ User can upload images via button click
18. ✅ Drag-and-drop image upload works
19. ✅ Up to 4 images per message supported
20. ✅ Image previews display with remove option

#### Character/Token Counter

21. ✅ Real-time character count displayed
22. ✅ Estimated token count shown
23. ✅ Image count displayed when images attached

#### Message Search

24. ✅ Search icon opens search overlay
25. ✅ Real-time case-insensitive filtering
26. ✅ Search terms highlighted in results
27. ✅ Click navigates to message
28. ✅ Keyboard navigation works (arrows, Enter, Escape)

#### Multiple Persona Editor

33. ✅ 5 premade personas available
34. ✅ Custom persona creation with emoji avatars
35. ✅ Edit and delete custom personas
36. ✅ Personas persist to localStorage
37. ✅ System prompts correctly prepended to API messages

#### Enhanced Streaming

38. ✅ Blinking cursor during streaming
39. ✅ Smooth container expansion animation
40. ✅ Max-height scroll for long messages

#### Chat History

41. ✅ Sidebar chat history panel with slide-in animation
42. ✅ New chat button to create new conversations
43. ✅ Search through all chat sessions
44. ✅ Rename chat sessions inline
45. ✅ Delete chat sessions with confirmation
46. ✅ Export individual sessions as JSON
47. ✅ Export all chats as JSON backup
48. ✅ Sessions sorted by most recent activity
49. ✅ Time ago display (just now, 5m, 2h, 3d, etc.)
50. ✅ localStorage persistence for sessions
