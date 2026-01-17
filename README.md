
<div align="center">

  <img src="public/wallpaper.png" alt="Swades Connect Banner" width="100%" />

  <br/>
  <br/>

  <h1>Swades Connect - Odoo CRM Extractor</h1>

</div>

A Chrome Extension (Manifest V3) that extracts **Contacts**, **Opportunities**, and **Activities** from Odoo CRM, stores them locally using `chrome.storage.local`, and provides a React-powered popup dashboard for viewing and exporting your data.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green?logo=googlechrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)

---

## 🎥 Demo Video

> **[Watch the Demo Video](https://youtu.be/Byhxi2gPe-w)** - 3-5 minute demonstration showing:
> - Extraction from live Odoo CRM
> - Data persistence after page refresh
> - Popup dashboard functionality
> - Delete and export features

---

## ✨ Features

### Data Extraction
- **Contacts** - Extract contact information including name, email, phone, company, and country
- **Opportunities** - Capture sales pipeline data with expected revenue, probability, and stage information
- **Activities** - Track scheduled activities, deadlines, and activity types

### Smart Detection
- **View Detection** - Automatically detects Odoo list and kanban views
- **RPC Interception** - Captures Odoo's internal API calls for accurate data extraction
- **Pagination Support** - Handles multi-page data extraction seamlessly

### Data Management
- **Local Storage** - All data stored securely in `chrome.storage.local`
- **Deduplication** - Prevents duplicate entries based on unique IDs
- **Export Options** - Export data to CSV or JSON formats
- **Search & Filter** - Filter and search through extracted data

### Visual Feedback
- **Shadow DOM Indicators** - Non-intrusive status indicators isolated from Odoo's CSS
- **Extraction States** - Visual feedback for idle, extracting, success, and error states

“Given the 5-hour time constraint, concurrency locks, bulk operation batching, and retry queues are intentionally not fully implemented.”

---

## 🚀 Installation

### Prerequisites
- **Node.js** 18+ 
- **pnpm** (recommended) or npm
- **Google Chrome** browser

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/heyitsgautham/swades-connect.git
   cd swades-connect
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Build the extension**
   ```bash
   # Development build with hot reload
   pnpm run dev

   # OR Production build
   pnpm run build
   ```

4. **Load the extension in Chrome**
   1. Open Chrome and navigate to `chrome://extensions/`
   2. Enable **Developer mode** (toggle in top-right corner)
   3. Click **Load unpacked**
   4. Select the `dist/` folder from this project
   5. The Swades Connect icon should appear in your extensions toolbar

---

## 📋 Commands

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Development build with watch mode (hot reload) |
| `pnpm run build` | Production build to `dist/` folder |
| `pnpm run lint` | Run ESLint + TypeScript type checking |
| `pnpm run preview` | Preview the built extension |

---

## 📖 Usage

### Extracting Data from Odoo

1. **Navigate to Odoo CRM**
   - Go to your Odoo instance (e.g., `https://your-company.odoo.com`)
   - Log in to your account

2. **Open the relevant view**
   - **Contacts**: Navigate to Contacts menu
   - **Opportunities**: Navigate to CRM → Pipeline or Opportunities
   - **Activities**: Navigate to any view showing activities

3. **Extract Data**
   - Click the Swades Connect extension icon in Chrome toolbar
   - Click the **Extract** button for the data type you want
   - Wait for the extraction to complete (status indicator will show progress)

4. **View & Export**
   - Switch between tabs (Contacts, Opportunities, Activities) to view extracted data
   - Use search and filters to find specific records
   - Click **Export CSV** or **Export JSON** to download your data

### Supported Odoo Views
- ✅ List View (table format)
- ✅ Kanban View (card format)

---

## 🏗️ Project Structure

```
src/
├── background/          # Service worker (message routing, storage operations)
├── content/             # Content scripts (DOM extraction logic)
│   └── extractors/      # Separate extractors per data type
├── popup/               # React dashboard application
│   └── components/      # UI components (Tabs, DataTables, Filters)
├── shared/              # Shared types, utilities, storage schema
│   ├── types.ts         # TypeScript interfaces
│   ├── messages.ts      # Message passing types
│   └── storage.ts       # Storage operations
├── injected/            # Shadow DOM status indicators
└── shadow/              # Shadow DOM utilities
public/
├── manifest.json        # Chrome Extension manifest (V3)
└── icons/               # Extension icons
dist/                    # Built extension (load this in Chrome)
```

---

## 🔧 Development

### Tech Stack
- **Extension**: Chrome Manifest V3 (service worker + content scripts)
- **UI**: React 18 + TailwindCSS
- **Build**: Vite with CRXJS plugin
- **Language**: TypeScript 5
- **Isolation**: Shadow DOM for injected indicators

### Message Passing Architecture
```typescript
// Content Script → Background → Popup
type MessageAction = 
  | 'EXTRACT_DATA'           // Trigger extraction
  | 'EXTRACTION_COMPLETE'    // Extraction finished
  | 'EXTRACTION_ERROR'       // Extraction failed
  | 'GET_DATA'               // Retrieve stored data
  | 'SAVE_DATA'              // Save/merge data
  | 'DELETE_RECORD'          // Delete single record
  | 'DELETE_ALL_RECORDS'     // Delete all of a type
  | 'STORAGE_UPDATED'        // Broadcast storage change
  | 'ODOO_RPC_UPSERT'        // RPC create/update
  | 'ODOO_RPC_DELETE';       // RPC delete
```

### Storage Schema
```typescript
interface StorageSchema {
  odoo_data: {
    contacts: Contact[];
    opportunities: Opportunity[];
    activities: Activity[];
    lastSync: number;  // Unix timestamp of last extraction
  }
}

// Contact record
interface Contact {
  id: string;           // Odoo res.partner ID from avatar URL (e.g., "contact_42")
  name: string;         // Full name
  email: string;        // Email address
  phone: string;        // Phone number
  company: string;      // Company/organization name
  country: string;      // Country
}

// Opportunity record  
interface Opportunity {
  id: string;           // Odoo crm.lead ID or content hash
  name: string;         // Opportunity name
  revenue: number;      // Expected revenue (numeric)
  stage: string;        // Pipeline stage name
  probability: number;  // Win probability (0-100)
  closeDate: string;    // Expected closing date (ISO format)
}

// Activity record
interface Activity {
  id: string;           // Odoo mail.activity ID or content hash
  type: 'call' | 'meeting' | 'todo' | 'email';  // Activity type
  summary: string;      // Activity description
  dueDate: string;      // Due date (ISO format)
  assignedTo: string;   // Assigned user name
  status: 'open' | 'done';  // Activity status
}
```

**Data Integrity Features:**
- **Deduplication**: Records are merged by `id` - existing records are updated, new ones added
- **Race Condition Handling**: Storage locks prevent concurrent writes from multiple tabs
- **Automatic Cleanup**: Old records can be cleared when storage approaches 10MB limit

---

## 🎯 DOM Selection Strategy

We use **CSS Selectors** as the primary extraction strategy. See [src/content/extractors/README.md](src/content/extractors/README.md) for detailed selector documentation.

### Why CSS Selectors?
1. **Performance** - Faster than XPath in modern browsers
2. **Readability** - More intuitive syntax than XPath
3. **OWL Compatibility** - Odoo's OWL framework uses predictable class patterns
4. **Attribute Targeting** - Odoo fields use `[name]` attributes (e.g., `td[name="email"]`)

### View Detection
```typescript
// Detected via DOM structure
type ViewType = 'list' | 'kanban' | 'form' | 'activity' | 'unknown';

// View container selectors (used by viewDetector.ts):
// - List View:     .o_list_view
// - Kanban View:   .o_kanban_view
// - Activity View: .o_activity_view
// - Form View:     .o_form_view

// Data extraction selectors (used by extractors):
// - List rows:     tr.o_data_row
// - Kanban cards:  article.o_kanban_record
```

### Handling Dynamic Content
1. **MutationObserver** - Watches for DOM changes and triggers re-extraction prompts
2. **Render Waiting** - Waits for Odoo's OWL framework to finish rendering before extraction
3. **Pagination Detection** - Automatically handles multi-page data via `.o_pager` navigation

### Key Selector Patterns
| Data Type | List View Selector | Kanban View Selector |
|-----------|-------------------|---------------------|
| Contact Name | `td[name="complete_name"]` | `main span.fw-bold.fs-5` |
| Email | `td[name="email"]` | `i.fa.fa-envelope` + sibling span |
| Phone | `td[name="phone"]` | `i.fa.fa-phone` + sibling span |
| Opportunity Name | `td[name="name"]` | `:scope > span.fw-bold.fs-5` |
| Revenue | `td[name="expected_revenue"]` | `div.o_kanban_card_crm_lead_revenue` |
| Activity Type | `td[name="activity_type_id"]` | `span.badge span` |

### ID Extraction Strategy
1. **Primary**: Parse Odoo ID from avatar URL (`/web/image/res.partner/{id}/avatar_128`)
2. **Secondary**: RPC interception captures real IDs from API responses
3. **Fallback**: Generate stable hash from record content using djb2 algorithm

---

## ⚙️ Extraction Process (Step-by-Step)

This section explains exactly how data extraction works for each type, including the RPC interception system that enables real-time sync.

### How RPC Interception Works

The extension implements a **hybrid DOM + RPC approach** that goes beyond simple DOM scraping:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Odoo Page     │────▶│  RPC Interceptor │────▶│  Content Script │
│  (fetch/XHR)    │     │  (monkeypatch)   │     │  (postMessage)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │     Popup UI     │◀────│ Service Worker  │
                        │  (React + sync)  │     │ (chrome.storage)│
                        └──────────────────┘     └─────────────────┘
```

**RPC Endpoints Intercepted:**
- `/web/dataset/call_kw/{model}/{method}` - Standard RPC calls
- `/web/dataset/call_button/{model}/{method}` - Button action calls

**Methods Captured:**
| Method | Purpose |
|--------|---------|
| `create` | New record created |
| `write` | Record edited |
| `unlink` | Record deleted |
| `web_save` | Record saved via form |
| `action_done` | Activity marked as done |
| `name_create` | Quick-create (e.g., contact from opportunity) |
| `web_search_read` | List/Kanban data loaded (captures real IDs) |

**Models Monitored:** `res.partner`, `crm.lead`, `mail.activity`, `mail.activity.schedule`

---

### Contact Extraction

**Primary Key:** `contact_{odoo_id}` extracted from avatar image URL

**Step-by-Step Process:**
1. **Detect View Type** → Check for `tr.o_data_row` (list) or `article.o_kanban_record` (kanban)
2. **Extract Real ID from Avatar URL:**
   ```
   Avatar URL: /web/image/res.partner/42/avatar_128
   Regex: /web/image/res.partner/(\d+)/
   Extracted ID: 42
   Final Key: contact_42
   ```
3. **Extract Fields:**
   - Name: `td[name="complete_name"]` → parses "Company, Person" format
   - Email: `td[name="email"]` with `data-tooltip` attribute
   - Phone: `td[name="phone"]` with `data-tooltip` attribute
   - Company: `td[name="parent_id"]` or `td[name="company_name"]` or parsed from complete_name
   - Country: `td[name="country_id"]`
4. **Fallback ID:** If no avatar URL found → `contact_idx_{row_index}`

**Why Contacts Have Stable IDs:**
- Every contact row/card has an avatar image with the real Odoo `res.partner` ID embedded in the URL
- This makes contact IDs inherently stable across page reloads
- No hash fallback or RPC interception needed for ID resolution

---

### Opportunity Extraction

**Primary Key:** `opp_{odoo_id}` or `opp_{content_hash}`

**Step-by-Step Process:**
1. **Initialize ID Cache** → Load previously captured IDs from `chrome.storage.local`
2. **Detect View Type** → List (`tr.o_data_row`) or Kanban (`.o_kanban_group` stages with `article.o_kanban_record` cards)
3. **Extract Fields:**
   - Name: `td[name="name"]` with `data-tooltip` (list) or `:scope > span.fw-bold.fs-5` (kanban)
   - Revenue: `td[name="expected_revenue"]` (list) or `div.o_kanban_card_crm_lead_revenue` (kanban)
   - Stage: `td[name="stage_id"]` (list) or `.o_kanban_header .o_column_title span.text-truncate` (kanban)
   - Probability: `td[name="probability"]` (list) or priority stars count × 33% (kanban)
   - Close Date: `td[name="date_deadline"]` or `td[name="date_closed"]`
4. **Resolve ID:**
   - **First:** Check ID cache by opportunity name → returns real Odoo ID if found
   - **Fallback:** Generate djb2 hash from `name + stage + revenue`

**ID Upgrade Mechanism:**
```
DOM Extraction → Creates: opp_lnl5ct (hash-based)
User Edits in Odoo → RPC captures: opp_24 (real ID)
Background Worker → Matches by name → Upgrades: opp_lnl5ct → opp_24
```

This ensures edits are properly tracked even when the original extraction used hash IDs.

---

### Activity Extraction

**Primary Key:** `act_{odoo_id}` or `act_{content_hash}`

**Step-by-Step Process:**
1. **Detect View Type** → List (`tr.o_data_row`) or Kanban (`article.o_kanban_record`)
2. **ID Cache Population** → Activity IDs are captured from `web_search_read` RPC in real-time (row-index based)
3. **Extract Fields:**
   - Type: `td[name="activity_type_id"]` (list) or `span.badge span` (kanban) → normalized to `call|meeting|email|todo`
   - Summary: `td[name="summary"]` with `data-tooltip` (list) or `span.text-truncate` (kanban)
   - Due Date: `td[name="date_deadline"]` → parses title attribute or relative dates like "In 5 days"
   - Assigned To: `td[name="user_id"]` (list) or `footer div[name="user_id"]` (kanban)
   - Status: Checks for `.o_activity_done` class on row/card → `open` or `done`
4. **Resolve ID:**
   - **First:** Lookup by row index in activity ID array (populated from `web_search_read`)
   - **Fallback:** Generate djb2 hash from `summary + type + dueDate + assignedTo`

**Special Handling:**
- Activity summaries are NOT unique (unlike opportunity names)
- Uses row-index-based ID mapping (RPC `web_search_read` provides ordered IDs)
- `action_done` method triggers deletion (activity marked as completed)

---

### Real-Time Sync Flow

When a user creates/edits/deletes in Odoo, the extension captures it in real-time:

```
1. User Action in Odoo (e.g., edit opportunity)
          │
          ▼
2. Odoo makes RPC call: POST /web/dataset/call_kw/crm.lead/write
          │
          ▼
3. RPC Interceptor captures request + response
          │
          ▼
4. Interceptor emits: window.postMessage({ source: 'odoo-rpc-interceptor', payload: {...} })
          │
          ▼
5. Content Script receives message, converts to typed record
          │
          ▼
6. Content Script sends: chrome.runtime.sendMessage({ action: 'ODOO_RPC_UPSERT', data: {...} })
          │
          ▼
7. Service Worker processes:
   - For opportunities: Match by name if ID not found → upgrade hash ID to real ID
   - For activities: Match by summary if ID not found → upgrade hash ID to real ID
   - Merge fields (new non-empty values take precedence)
          │
          ▼
8. Storage updated, broadcasts STORAGE_UPDATED to popup
          │
          ▼
9. Popup UI refreshes automatically via useStorageData hook
```

---

### Edit & Delete Handling

**Edit Detection:**
- RPC methods `write` and `web_save` indicate record updates
- Interceptor captures the record ID and changed fields from response
- Background worker merges changes with existing stored data

**Delete Detection:**
- RPC method `unlink` indicates record deletion
- For activities: `action_done` also triggers deletion (completed = removed)
- Background worker removes matching records by ID from storage

**Delete from Popup:**
- User clicks trash icon → sends `DELETE_RECORD` message
- Service worker calls `deleteRecord(type, id)` 
- Storage updated, broadcasts change to all tabs

---

### Deduplication Strategy

All record types use the same deduplication logic:

```typescript
function deduplicateById<T extends { id: string }>(records: T[]): T[] {
  const map = new Map<string, T>();
  records.forEach(record => map.set(record.id, record)); // Last one wins
  return Array.from(map.values());
}
```

**Key Points:**
- Records are merged by `id` field
- Later records overwrite earlier ones (handles updates)
- Works across DOM extraction + RPC captures
- Storage locks prevent race conditions from multiple tabs

---

## ✉️ Contact

**Developer**: Gautham Krishna  
**Email**: [heyitsgautham@gmail.com](mailto:heyitsgautham@gmail.com)  
**Project**: [Swades Connect - GitHub Repository](https://github.com/heyitsgautham/swades-connect)

Built with ❤️ using Chrome Manifest V3, React 18, TypeScript, and TailwindCSS
