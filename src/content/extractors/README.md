# Odoo DOM Extractors

This directory contains the DOM extraction logic for pulling Contacts, Opportunities, and Activities data from Odoo CRM pages.

## Overview

The extraction system is designed to work with Odoo's OWL (Odoo Web Library) framework, which generates predictable but dynamically-rendered DOM structures. Each extractor:

1. **Auto-detects view type** - Automatically determines if the current page shows list or kanban view
2. **Uses stable selectors** - Targets Odoo's consistent class patterns and `[name]` attributes
3. **Handles ID stability** - Combines avatar URL parsing, RPC interception, and content hashing for stable record IDs
4. **Gracefully degrades** - Falls back to alternative selectors when primary ones aren't available

---

## Extractors

### 1. Contact Extractor (`contactExtractor.ts`)

Extracts contact/partner records from Odoo's Contacts module.

#### Exported Functions
- `extractContacts(): Contact[]` - Main extraction function

#### Data Fields Extracted
| Field | Source | Notes |
|-------|--------|-------|
| `id` | Avatar URL | Extracted from `/web/image/res.partner/{id}/avatar_128` pattern |
| `name` | `td[name="complete_name"]` | Parses "Company, Person" format |
| `email` | `td[name="email"]` | Uses `data-tooltip` for clean value |
| `phone` | `td[name="phone"]` | Uses `data-tooltip` for clean value |
| `company` | `td[name="parent_id"]` or parsed from name | Falls back to parsed company from complete_name |
| `country` | `td[name="country_id"]` | Country field |

---

### 2. Opportunity Extractor (`opportunityExtractor.ts`)

Extracts opportunity/lead records from Odoo's CRM Pipeline.

#### Exported Functions
- `extractOpportunities(): Promise<Opportunity[]>` - Async to allow ID cache initialization

#### Data Fields Extracted
| Field | Source | Notes |
|-------|--------|-------|
| `id` | RPC cache or content hash | Uses `lookupOpportunityId()` from ID cache, falls back to djb2 hash |
| `name` | `td[name="name"]` or `span.fw-bold.fs-5` | Uses `data-tooltip` in list view |
| `revenue` | `td[name="expected_revenue"]` | Parses currency strings like "₹ 1,234.56" |
| `stage` | `td[name="stage_id"]` or kanban column | From column header in kanban view |
| `probability` | `td[name="probability"]` or star priority | Converts priority stars to percentage |
| `closeDate` | `td[name="date_deadline"]` | Optional field |

---

### 3. Activity Extractor (`activityExtractor.ts`)

Extracts activity records (calls, meetings, emails, todos) from Odoo's Activity views.

#### Exported Functions
- `extractActivities(): Promise<Activity[]>` - Async to allow ID cache initialization

#### Data Fields Extracted
| Field | Source | Notes |
|-------|--------|-------|
| `id` | RPC cache or content hash | Uses `lookupActivityId()`, falls back to djb2 hash |
| `type` | `td[name="activity_type_id"]` or badge | Normalized to: `call`, `meeting`, `email`, `todo` |
| `summary` | `td[name="summary"]` | Uses `data-tooltip` for clean value |
| `dueDate` | `td[name="date_deadline"]` | Parses relative dates like "In 5 days" |
| `assignedTo` | `td[name="user_id"]` | User avatar with name |
| `status` | Class detection | Checks for `.o_activity_done` class |

---

## CSS Selectors Reference

### View Type Detection

| Selector | View Type | Notes |
|----------|-----------|-------|
| `tr.o_data_row` | List View | Table rows for data records |
| `article.o_kanban_record` | Kanban View | Card elements in kanban board |
| `.o_kanban_group` | Kanban Columns | Stage/group containers in kanban |

### Common Data Selectors

#### List View Selectors
```css
/* Row container */
tr.o_data_row

/* Field cells - use [name] attribute for field identification */
td[name="complete_name"]
td[name="email"]
td[name="phone"]
td[name="parent_id"]
td[name="company_name"]
td[name="user_id"]
td[name="country_id"]
td[name="stage_id"]
td[name="expected_revenue"]
td[name="probability"]
td[name="date_deadline"]
td[name="summary"]
td[name="activity_type_id"]
td[name="res_name"]
```

#### Kanban View Selectors
```css
/* Card container */
article.o_kanban_record

/* Stage/group container */
.o_kanban_group
.o_kanban_header .o_column_title span.text-truncate

/* Contact kanban */
main span.fw-bold.fs-5                    /* Name */
i.fa.fa-envelope                          /* Email icon */
i.fa.fa-phone                             /* Phone icon */
i.fa.fa-map-marker                        /* Location icon */

/* Opportunity kanban */
:scope > span.fw-bold.fs-5                /* Opportunity name */
div.o_kanban_card_crm_lead_revenue        /* Revenue display */
div[name="partner_id"]                    /* Partner info */
div[name="priority"] a.o_priority_star    /* Priority stars */

/* Activity kanban */
span.badge span                           /* Activity type badge */
span.text-truncate                        /* Summary text */
footer div[name="user_id"]                /* Assigned user */
div[name="date_deadline"]                 /* Due date */
```

### Avatar URL Pattern (ID Extraction)
```
/web/image/{model}/{id}/avatar_128

Examples:
- /web/image/res.partner/42/avatar_128  → Contact ID: 42
- /web/image/res.users/5/avatar_128     → User ID: 5
```

---

## View Types Supported

### List View
- **Detection**: Presence of `tr.o_data_row` elements
- **Structure**: Table-based with rows (`<tr>`) and cells (`<td>`)
- **Data Access**: Uses `[name]` attribute on `<td>` elements
- **Clean Values**: `data-tooltip` attribute often contains cleaned text

### Kanban View
- **Detection**: Presence of `article.o_kanban_record` elements
- **Structure**: Card-based with flexible layout
- **Stages**: Groups in `.o_kanban_group` with header in `.o_kanban_header`
- **Data Access**: Icon-based patterns (`i.fa-{icon}` + sibling `<span>`)

---

## Odoo OWL Framework Notes

### DOM Characteristics

1. **Dynamic Rendering**: Content is rendered client-side by the OWL framework
   - Wait for content to load before extraction
   - Use `MutationObserver` for pagination changes

2. **Unstable `data-id` Attributes**: Odoo uses internal identifiers like `datapoint_42` that change between page loads
   - Never rely on `data-id` for stable record identification
   - Use avatar URL parsing or RPC interception for real Odoo IDs

3. **`data-tooltip` for Clean Values**: Many cells have a `data-tooltip` attribute with the clean text value, while the cell content may have formatting or HTML
   ```typescript
   const value = cell?.getAttribute('data-tooltip') || cell?.textContent?.trim();
   ```

4. **Field Identification via `[name]` Attribute**: Cells and elements use `[name]` attributes matching the Odoo field name
   ```html
   <td name="email" data-tooltip="john@example.com">...</td>
   ```

5. **Icon-based Field Patterns**: Kanban cards often use Font Awesome icons as field labels
   ```html
   <i class="fa fa-fw fa-envelope"></i>
   <span>john@example.com</span>
   ```

### Content Hash Strategy

When real Odoo IDs aren't available (RPC interceptor timing issues), we use content-based hashing:

```typescript
function generateContentHash(prefix: string, ...parts: string[]): string {
  const content = parts.map(p => String(p).trim().toLowerCase()).join('|');
  // djb2 hash algorithm
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash) + content.charCodeAt(i);
    hash = hash & hash;
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
}
```

This produces stable IDs like `opp_abc123` that are consistent for the same record content across page loads.

### Date Handling

Odoo displays dates in various formats:

| Format | Example | Handling |
|--------|---------|----------|
| DD/MM/YYYY | 20/01/2026 | Parsed and converted to ISO |
| Relative | "In 5 days" | Calculated from current date |
| Today/Yesterday | "Today" | Calculated from current date |
| ISO | 2026-01-20 | Used as-is |

---

## Error Handling

Each extractor:
- Wraps individual record extraction in try-catch
- Logs warnings for failed records without stopping batch
- Returns empty array on complete failure
- Validates required fields (e.g., name) before including record

---

## ID Stability Strategy

The extractors use a multi-layer approach for stable record IDs:

1. **Avatar URL Parsing** (Contacts): Extract real Odoo ID from `/web/image/res.partner/{id}/avatar_128`

2. **RPC Interception** (Opportunities, Activities): 
   - Inject script to intercept `web_search_read` RPC calls
   - Cache name→ID mappings in storage
   - Pre-populate cache from storage before extraction

3. **Content Hash Fallback**: When above methods fail, generate deterministic hash from record content (name, stage, revenue, etc.)

---

## Performance Considerations

- Extractors run synchronously on the main thread
- Large datasets (1000+ records) may cause brief UI blocking
- Consider chunked extraction for very large views
- Storage deduplication prevents unbounded growth
