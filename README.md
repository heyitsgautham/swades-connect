# Swades Connect - Odoo CRM Extractor

A Chrome Extension (Manifest V3) that extracts **Contacts**, **Opportunities**, and **Activities** from Odoo CRM, stores them locally using `chrome.storage.local`, and provides a React-powered popup dashboard for viewing and exporting your data.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green?logo=googlechrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)

---

## ✨ Features

### Data Extraction
- **Contacts** - Extract contact information including name, email, phone, company, and job position
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

---

## 🚀 Installation

### Prerequisites
- **Node.js** 18+ 
- **pnpm** (recommended) or npm
- **Google Chrome** browser

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/swades-connect.git
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
- ⚠️ Form View (limited support)

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

## ⚠️ Known Limitations

### Service Worker Lifecycle
- Chrome's Manifest V3 service workers can be terminated after periods of inactivity
- The extension handles this gracefully, but long-running operations may need to be re-triggered
- Avoid relying on in-memory state in the background script

### Storage Limits
- `chrome.storage.local` has a limit of approximately **10MB**
- For large datasets, consider exporting data regularly and clearing old records
- The extension implements automatic cleanup when approaching storage limits

### Odoo DOM Variability
- Odoo's UI can vary between versions and customizations
- The extension targets Odoo 14+ with standard OWL framework components
- Custom themes or heavily modified instances may require selector adjustments
- Check `src/content/extractors/README.md` for selector documentation

### Browser Compatibility
- This extension is designed for **Google Chrome** only
- Manifest V3 is required; older Chrome versions may not be supported
- Microsoft Edge (Chromium) may work but is not officially tested

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
  | 'EXTRACT_CONTACTS' 
  | 'EXTRACT_OPPORTUNITIES' 
  | 'EXTRACT_ACTIVITIES'
  | 'GET_DATA'
  | 'CLEAR_DATA';
```

### Storage Schema
```typescript
interface StorageSchema {
  odoo_data: {
    contacts: Contact[];
    opportunities: Opportunity[];
    activities: Activity[];
    lastSync: number;
  }
}
```

---

## 🧪 Testing

### Manual Testing Checklist
- [ ] Extension loads in Chrome without errors
- [ ] Extraction works on Odoo list views
- [ ] Extraction works on Odoo kanban views
- [ ] Data persists after page refresh
- [ ] Data persists after popup reopen
- [ ] No duplicate records after multiple extractions
- [ ] Export to CSV works correctly
- [ ] Export to JSON works correctly
- [ ] Search and filter functionality works

### Testing with Odoo
- Use Odoo's free trial at [https://www.odoo.com/trial](https://www.odoo.com/trial)
- Create sample contacts, opportunities, and activities
- Test extraction on both list and kanban views

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📞 Support

For issues and feature requests, please open a GitHub issue or contact the development team.
