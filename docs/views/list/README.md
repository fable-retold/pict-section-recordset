# List View

The List view displays records in a table format with pagination, filtering, and sorting capabilities.

## Overview

The List view fetches and displays multiple records in a configurable table layout. It supports automatic column generation from schema, custom column definitions, pagination, filtering, and navigation to individual records.

## Routes

| Route | Description |
|-------|-------------|
| `/PSRS/:RecordSet/List` | List all records |
| `/PSRS/:RecordSet/List/:Offset` | List with offset |
| `/PSRS/:RecordSet/List/:Offset/:PageSize` | List with offset and page size |
| `/PSRS/:RecordSet/List/FilteredTo/:FilterString` | List with filter |
| `/PSRS/:RecordSet/List/FilteredTo/:FilterString/:Offset/:PageSize` | List with filter and pagination |
| `/PSRS/:RecordSet/List/FilterExperience/:FilterExperience` | List with serialized filter state |

## Configuration

```javascript
const recordSetConfig = {
    RecordSet: 'User',
    Title: 'Users',

    // Use manifest for column configuration
    RecordSetListManifestOnly: true,
    RecordSetListDefaultManifest: 'UserListManifest',
    RecordSetListManifests: ['UserListManifest', 'UserCompactList'],

    // Or define columns directly
    RecordSetListColumns: [
        'Name',
        'Email',
        {
            Key: 'Status',
            DisplayName: 'User Status',
            ManifestHash: 'Default',
            PictDashboard: {
                ValueTemplate: '{~ProcessCell:Record.Data.Key~}'
            }
        }
    ]
};
```

## Column Configuration

### Simple Columns

Specify column keys as strings:

```javascript
RecordSetListColumns: ['Name', 'Email', 'CreatedDate']
```

### Advanced Columns

Use objects for custom display and formatting:

```javascript
RecordSetListColumns: [
    {
        Key: 'Name',
        DisplayName: 'Full Name',
        ManifestHash: 'Default',
        PictDashboard: {
            ValueTemplate: '{~D:Record.Data.Name~}'
        }
    },
    {
        Key: 'Status',
        DisplayName: 'Account Status',
        PictDashboard: {
            ValueTemplate: '<span class="status-{~D:Record.Data.Status~}">{~D:Record.Data.Status~}</span>'
        }
    }
]
```

## Auto-Generated Columns

When no `RecordSetListColumns` or manifest is provided, columns are generated automatically from the record schema. The following fields are excluded by default:

- ID field (e.g., `IDUser`)
- GUID field (e.g., `GUIDUser`)
- `CreateDate`
- `CreatingIDUser`
- `DeleteDate`
- `Deleted`
- `DeletingIDUser`
- `UpdateDate`
- `UpdatingIDUser`

## Column Chooser (show/hide columns)

Opt a record set in with `RecordSetListColumnChooser: true` to render a right-aligned "Columns" button above the table. The popover lists:

- **Curated columns** — the host-declared set (manifest `Descriptors` or `RecordSetListColumns`), default visible. Mark a column or descriptor `DefaultHidden: true` to ship it hidden-but-available.
- **More columns** — every remaining scalar schema column (identity/audit and blob `Text`/`JSON` columns excluded), default hidden, rendered via `{~ProcessCell:Record.Data.Key~}` (entity-reference `ID*` columns resolve display names automatically).
- **Audit columns** — the identity pair + audit stamps with friendly labels (ID, GUID, Created, Created by, Updated, Updated by, Deleted, Deleted on, Deleted by), default hidden. Pair with `RecordSetListShowDeletedFilter: true` (a "Show deleted" quick-bar toggle that filters `Deleted IN (0,1)`, taking over FoxHound's automatic `Deleted = 0`) to make the three Deleted columns meaningful; deleted rows render at reduced opacity.

```javascript
RecordSetListColumnChooser: true,
RecordSetListColumns: [
    { Key: 'Name' },
    { Key: 'Email' },
    { Key: 'Notes', DefaultHidden: true }
]
```

Behavior notes:

- A toggle repaints only the rows + pagination (body-only); the filter view and its control state are never touched. At least one column always stays visible.
- Under `RecordSetListLiteFetch`, showing a schema-tier column whose values weren't fetched triggers exactly one refetch with the Lite projection widened to include it. Curated/manifest columns are always fetched, so toggling them never refetches.
- Choices persist per browser via the `ColumnDataProvider` (localStorage key `Column_Meta_{RecordSet}_List`; session mirror at `pict.Bundle._ActiveColumnState`). Hosts can register their own `ColumnDataProvider` before `PictSectionRecordSet.initialize()` to persist server-side.
- `onBeforeRenderList` runs on every paint, including column repaints — `TableCells` is rebuilt from pristine candidates each time, so cell mutations apply exactly once, but record decoration in the hook must be idempotent. Cells the hook appends always render and are not listed in the chooser.

## Manifest Configuration

For complex list displays, define a manifest:

```javascript
const listManifest = {
    TitleTemplate: '{~D:Record.RecordSet~} Directory',
    TableCells: [
        {
            Key: 'Name',
            DisplayName: 'Name',
            PictDashboard: {
                ValueTemplate: '<a href="#/PSRS/User/View/{~D:Record.Data.GUIDUser~}">{~D:Record.Data.Name~}</a>'
            }
        },
        {
            Key: 'Email',
            DisplayName: 'Email',
            PictDashboard: {
                ValueTemplate: '<a href="mailto:{~D:Record.Data.Email~}">{~D:Record.Data.Email~}</a>'
            }
        }
    ]
};
```

## Child Views

The List view is composed of several child views:

| View | Purpose |
|------|---------|
| `PRSP-List-HeaderList` | Header actions and navigation |
| `PRSP-List-Title` | Page title |
| `PRSP-Filters` | Filter controls |
| `PRSP-List-PaginationTop` | Top pagination controls |
| `PRSP-List-RecordList` | Record table container |
| `PRSP-List-RecordListHeader` | Table header row |
| `PRSP-List-RecordListEntry` | Individual record rows |
| `PRSP-List-PaginationBottom` | Bottom pagination controls |
| `PRSP-List-ColumnChooser` | Show/hide columns popover (opt-in via `RecordSetListColumnChooser`) |

## Pagination

Pagination data is automatically calculated and available in templates:

```javascript
{
    Offset: 0,              // Current offset
    PageSize: 100,          // Records per page
    PageEnd: 100,           // Last record number on current page
    PageCount: 10,          // Total number of pages
    TotalRecordCount: { Count: 1000 },

    PageLinks: [            // All page links
        { Page: 1, URL: '#/PSRS/User/List/0/100', RelativeOffset: 0 }
    ],
    PageLinksLimited: [],   // Limited range of page links (±10 pages)

    PageLinkBookmarks: {
        Current: 0,
        Previous: false,
        Next: 1,
        PreviousLink: false,
        NextLink: { Page: 2, URL: '...' },
        ShowPreviousLink: false,
        ShowNextLink: true
    }
}
```

## Lifecycle Hooks

```javascript
class CustomListView extends viewRecordSetList {
    onBeforeRenderList(pRecordListData) {
        // Modify data before rendering
        // Add computed columns, filter records, etc.
        return pRecordListData;
    }

    dynamicallyGenerateColumns(pRecordListData) {
        // Customize auto-generated columns
        // Call super or implement custom logic
        return super.dynamicallyGenerateColumns(pRecordListData);
    }
}
```

## Templates

| Template Hash | Purpose |
|---------------|---------|
| `PRSP-List-Template` | Main list container |
| `PRSP-List-Template-Record` | Individual record template |

## Filter Integration

The List view integrates with the filter system. Filter state is maintained in:

```javascript
pict.Bundle._ActiveFilterState[RecordSet].FilterClauses
```

Filters can be serialized into URLs using the `FilterExperience` parameter for shareable filtered views.

## Example Usage

```javascript
// Navigate to list
pict.providers.RecordSetRouter.pictRouter.navigate('/PSRS/User/List');

// Navigate with pagination
pict.providers.RecordSetRouter.pictRouter.navigate('/PSRS/User/List/100/50');

// Navigate with filter
pict.providers.RecordSetRouter.pictRouter.navigate('/PSRS/User/List/FilteredTo/FBV~Status~EQ~active');

// Access the list view
const listView = pict.views['RSP-RecordSet-List'];

// Render list programmatically
const config = pict.PictSectionRecordSet.recordSetProviderConfigurations['User'];
await listView.renderList(config, 'RSP-Provider-User', '', '', 0, 100);
```

## Manifest-Based Rendering

For manifest-only configurations, use `renderListFromManifest`:

```javascript
const manifest = pict.PictSectionRecordSet.manifestDefinitions['UserListManifest'];
const config = pict.PictSectionRecordSet.recordSetProviderConfigurations['User'];

await listView.renderListFromManifest(
    manifest,
    config,
    'RSP-Provider-User',
    '',     // filterString
    '',     // filterExperience
    0,      // offset
    100     // pageSize
);
```

## Data Structure

The `renderList` method provides this data structure to templates:

```javascript
{
    Title: 'Users',
    RecordSet: 'User',
    RecordSetConfiguration: { ... },
    RenderDestination: '#PRSP_Container',
    FilterString: 'FBV~Status~EQ~active',
    Records: { Records: [...] },
    TotalRecordCount: { Count: 1000 },
    RecordSchema: { properties: { ... } },
    GUIDAddress: 'GUIDUser',
    TableCells: [
        { Key: 'Name', DisplayName: 'Name', PictDashboard: { ... } }
    ],
    // Pagination data...
}
```
