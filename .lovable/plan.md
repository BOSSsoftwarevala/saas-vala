

# Plan: Separate VALA Builder and AI Chat into Two Pages

## What Changes

Currently `/ai-chat` is one 1163-line page containing both:
- **AI Chat** — conversation interface with VALA AI
- **VALA Builder** — app build pipeline + APK workflow (Build Mode form, 10-step pipeline, APK stats)

We will split them into two independent pages with separate sidebar entries.

## Steps

### 1. Create new `src/pages/ValaBuilder.tsx`
- Extract all Builder-related code from AiChat.tsx:
  - Build Mode state (`buildMode`, `buildAppName`, `buildPrompt`, `buildRunning`, `buildSteps`)
  - `runBuildPipeline()` function (lines 190-300)
  - `useAutoApkPipeline` hook usage
  - Build Mode UI (form, pipeline steps visual, APK stats panel)
  - Preview panel (right side iframe) for viewing deployed apps
- This page will be a dedicated Builder dashboard — no chat, just build + deploy + preview

### 2. Simplify `src/pages/AiChat.tsx`
- Remove all Builder-related code:
  - `buildMode`, `buildAppName`, `buildPrompt`, `buildRunning`, `buildSteps` states
  - `runBuildPipeline()`, `updateBuildStep()`, `INITIAL_BUILD_STEPS`
  - `useAutoApkPipeline` hook
  - Builder UI from welcome screen (replace with chat-only quick actions)
  - Remove Rocket button from chat header
- Keep pure AI Chat functionality: sessions, messages, model selector, memory, search, etc.

### 3. Update `src/App.tsx` Routes
- Add: `<Route path="/vala-builder" element={<ProtectedRoute><ValaBuilder /></ProtectedRoute>} />`
- Remove the `Navigate` redirect from `/vala-builder` to `/ai-chat`
- Keep `/ai-chat` route as-is (now chat-only)

### 4. Update `src/components/layout/Sidebar.tsx`
- Split the current nav item `Builder + APK Pipeline → /ai-chat` into two:
  - `AI Chat` (Bot icon) → `/ai-chat`
  - `VALA Builder` (Rocket icon) → `/vala-builder`
- Remove `/vala-builder` from `blockedNavPaths`

## Technical Details

- ValaBuilder page will use `DashboardLayout` wrapper (consistent with other pages)
- Builder page will include: app name input, description, build pipeline runner, APK pipeline stats, and the right-side preview iframe
- AI Chat page keeps the two-column layout (left: chat, right: preview) but without any build mode

