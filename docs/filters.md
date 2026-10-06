# Filters

Filters allow users to narrow down record sets based on field values.

## Filter Types

The record set supports various filter control types:

| Type | Description |
|------|-------------|
| `Text` | Free-text search input |
| `Select` | Dropdown selection |
| `DateRange` | Date range picker |
| `NumberRange` | Numeric range inputs |
| `Checkbox` | Boolean toggle |
| `MultiSelect` | Multiple selection |

## Filter Configuration

Configure filters in your record set manifest:

```javascript
const filterConfig = {
    Filters: [
        {
            Hash: 'NameFilter',
            Name: 'Name',
            FilterType: 'Text',
            Field: 'Name',
            Operator: 'LIKE'
        },
        {
            Hash: 'StatusFilter',
            Name: 'Status',
            FilterType: 'Select',
            Field: 'Status',
            Options: [
                { Value: 'active', Label: 'Active' },
                { Value: 'inactive', Label: 'Inactive' },
                { Value: 'pending', Label: 'Pending' }
            ]
        },
        {
            Hash: 'DateFilter',
            Name: 'Created Date',
            FilterType: 'DateRange',
            Field: 'CreatedDate'
        }
    ]
};
```

## Dependent (Cascading) Filters — `CascadeFrom`

A `DistinctSelectedValueList` filter can narrow its own option list by what another
filter currently has selected. Name the parent fields in `CascadeFrom`:

```javascript
Definitions: {
    Site: {
        Type: 'DistinctSelectedValueList', FilterByColumn: 'Site',
        DisplayName: 'Site', ClauseKey: 'Site_AnyOf',
        DistinctFilter: 'FBV~Deleted~EQ~0',
    },
    Product: {
        Type: 'DistinctSelectedValueList', FilterByColumn: 'Product',
        DisplayName: 'Product', ClauseKey: 'Product_AnyOf',
        DistinctFilter: 'FBV~Deleted~EQ~0',
        // Pick a Site and this list collapses to that Site's products.
        CascadeFrom: [ 'Site' ],
    },
},
QuickFilters: [ 'Site', 'Product' ],
```

Behaviour:

- The distinct fetch uses `DistinctFilter` **plus** `FBL~<parentColumn>~INN~<selected…>`
  for each parent that currently has a selection.
- **A parent with nothing selected narrows nothing** — the child lists every value.
  That is the correct zero state for a filter, so adding `CascadeFrom` cannot
  make a dashboard show less than it did before anyone touched a control.
- Several parents compose, in the order declared.
- **Changing a parent clears the child's selection.** A child value the new parent
  does not have would otherwise stay staged and commit a filter nothing can
  satisfy — the grid comes back empty with no visible reason why.
- The resolved filter is part of the provider's distinct cache key, so each parent
  selection caches separately and switching back to a previous one is instant.
- Both the quick-filter bar and the drawer control apply the same rule, so they
  never disagree about a field's options.
- `CascadeFrom` names **fields**, and every `Definitions` key must equal its
  `FilterByColumn`, so a field name is also the column constrained.
- A selected value containing a comma is skipped rather than split across the
  `INN` list.

An entity filter (`InternalJoinSelectedValueList`) can be a cascade parent too —
pick a Project, narrow the Mix Designs.

## Relative Date Defaults — `DefaultRelativeDays`

A `DateRange` filter can seed itself to a trailing window on first load:

```javascript
DateSampled: {
    Type: 'DateRange', FilterByColumn: 'DateSampled',
    DisplayName: 'Date Sampled', MinimumLabel: 'From', MaximumLabel: 'To',
    // Default view is the last year of samples.
    DefaultRelativeDays: 365,
},
```

The range is seeded once per field and **never over a value the user set**, so a
shared or restored filter experience keeps its own dates.

## Filter Operators

Available operators for filter conditions:

| Operator | Description | Example |
|----------|-------------|---------|
| `EQ` | Equals | `Status EQ 'active'` |
| `NE` | Not equals | `Status NE 'deleted'` |
| `GT` | Greater than | `Age GT 18` |
| `GE` | Greater or equal | `Age GE 21` |
| `LT` | Less than | `Price LT 100` |
| `LE` | Less or equal | `Price LE 50` |
| `LIKE` | Contains | `Name LIKE 'John'` |
| `IN` | In list | `Status IN ['active','pending']` |

## Filter String Format

Filters are converted to Meadow filter strings:

```
FBV~FieldName~Operator~Value
```

Multiple filters are joined:

```
FBV~Name~LIKE~John~FBV~Status~EQ~active
```

## Dynamic Filters

Filters can be generated from record data:

```javascript
// Auto-generate select options from unique field values
const filter = {
    Hash: 'DepartmentFilter',
    Name: 'Department',
    FilterType: 'Select',
    Field: 'Department',
    DynamicOptions: true,  // Fetch options from data
    FacetField: 'Department'  // Use facet for counts
};
```

## Filter Events

Handle filter changes in your application:

```javascript
// Listen for filter changes
pict.PictSectionRecordSet.on('filter-changed', (filterState) => {
    console.log('Active filters:', filterState);
});

// Programmatically set filters
pict.PictSectionRecordSet.setFilter('StatusFilter', 'active');

// Clear all filters
pict.PictSectionRecordSet.clearFilters();
```

## Custom Filter Controls

Create custom filter input providers:

```javascript
const libFilterProvider = require('pict-section-recordset').FilterProvider;

class CustomRangeFilter extends libFilterProvider
{
    constructor(pFable, pOptions, pServiceHash)
    {
        super(pFable, pOptions, pServiceHash);
    }

    // Render custom filter UI
    render(pFilterConfig, pContainer)
    {
        // Custom rendering logic
    }

    // Get filter value
    getValue()
    {
        return {
            min: this.minInput.value,
            max: this.maxInput.value
        };
    }

    // Convert to filter string
    toFilterString()
    {
        const value = this.getValue();
        return `FBV~${this.options.Field}~GE~${value.min}~FBV~${this.options.Field}~LE~${value.max}`;
    }
}
```
