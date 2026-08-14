# PICT RecordSet Section

> **[Read the Pict-Section-Recordset Documentation](https://fable-retold.github.io/pict-section-recordset/)** - interactive docs with the full API reference.

A PICT section that provides basic CRUD views (Create, Read, Update and Delete)
based on stable providers and configurations.

## The Noble Provider

The only thing that's really required for this to operate is a Record/Record
Set provider... and given a Meadow Endpoint, the `/1.0/Entity/Schema` endpoint
can be used to programmatically create a functional provider.

## Quick Filters

A curated, one-interaction filter bar at the top of the filter drawer — the handful of filters people reach for most often (fuzzy-search the title, "added in this range", "added by …"), pre-wired so there's no "Add filter → pick a field → pick a clause type" hunt. Each control writes a real filter clause, so it serializes, applies, and clears like anything in the full list.

**Clever by default.** With no configuration the bar is derived from the entity schema:

| Field present | Quick control |
|---|---|
| `Title` (else `Name`) | fuzzy text |
| `CreateDate` / `UpdateDate` | date range |
| `CreatingIDUser` / `UpdatingIDUser` | entity picker (the related entity) |

**Curated by config.** Set `QuickFilters` on the RecordSet config to control which filters appear, their labels, and their order. Entries are a field name, or an object for a custom label / explicit clause:

```javascript
{
    "RecordSet": "Book",
    "RecordSetMeadowEntity": "Book",
    "QuickFilters":
    [
        "Title",
        "Genre",
        { "Field": "CreateDate", "Label": "Added" },
        { "Field": "CreatingIDUser", "Label": "Added by" }
    ]
}
```

The control type is inferred from the field's clause (text for a string match, a from/to pair for a date range, a [pict-section-picker](https://github.com/fable-retold/pict-section-picker) for an entity reference). A quick clause lives in the same filter state as every other clause (tagged so the full clause list doesn't show it twice), and is removed when its value is cleared.

**Turning it off.** A single record set opts out with `QuickFilters: false`. To make quick filters **opt-in** across a whole app — only record sets with an explicit `QuickFilters` array show the bar — set the filter view's flag once: `pict.views['PRSP-Filters'].quickFiltersAutoDefault = false`.

## Column Chooser

An opt-in, per-record-set "Columns" button above the list table that lets the user show/hide columns. Three tiers of candidates:

- **Curated** — the columns the host declared (manifest `Descriptors` or `RecordSetListColumns`), in declared order. Default visible; a column or descriptor can ship hidden-by-default with `DefaultHidden: true` (proper display name + cell template, one click away).
- **Schema** — every remaining scalar column on the entity (identity/audit fields and blob `Text`/`JSON` columns excluded), listed under "More columns", default hidden, rendered with the generic `{~ProcessCell~}` template (entity-reference `ID*` columns resolve names automatically).
- **Audit** — the identity pair and audit stamps with friendly labels (ID, GUID, Created, Created by, Updated, Updated by, Deleted, Deleted on, Deleted by), listed under "Audit columns", default hidden. The user-reference stamps resolve to user names like any entity column.

```javascript
{
    "RecordSet": "Book",
    "RecordSetListColumnChooser": true,
    "RecordSetListColumns":
    [
        { "Key": "Title" },
        { "Key": "Genre" },
        { "Key": "ISBN", "DefaultHidden": true }
    ]
}
```

Toggling a column repaints only the rows + pagination (the filter bar and its state are never re-rendered). Under `RecordSetListLiteFetch`, showing a schema-tier column whose data wasn't fetched triggers exactly one refetch with the projection widened to include it.

**Persistence.** Choices persist per browser in localStorage (`Column_Meta_{RecordSet}_List`), with a session mirror at `pict.Bundle._ActiveColumnState`. To persist somewhere else (e.g. a per-user server preference), register your own provider as `ColumnDataProvider` **before** `PictSectionRecordSet.initialize()` — the section only registers the built-in one when none exists. The class is exported as `PictSectionRecordSet.ColumnDataProvider` for subclassing.

**Host hook note.** `onBeforeRenderList` is (re-)invoked on every paint, including column-visibility repaints. `TableCells` is rebuilt from pristine candidates each paint so cell-level mutations apply exactly once — but record decoration done in the hook must be idempotent. Cells the hook appends are unmanaged by the chooser: they always render and never appear in the chooser list.

## Show Deleted

Meadow soft-deletes: lists normally return only `Deleted = 0` rows. Set `RecordSetListShowDeletedFilter: true` on a record set to add a **"Show deleted"** checkbox to the filter drawer's footer (next to Clear / Reset / Apply). The switch is a **real clause** — a `RawFilter` referencing the Deleted column (`FBL~Deleted~INN~0,1`), which takes over FoxHound's automatic delete tracking so active and deleted rows enumerate together. Because it's a clause:

- It **serializes into the route URL** (the FilterExperience segment) — reloads and shared links keep it.
- Toggling applies through the normal search flow (the URL always changes, so the fetch always fires).
- **Clear** drops it like any other clause; the drawer's clause list skips it (the checkbox is its face).
- Records and counts stay in sync (both flow through the same clause assembly).

Deleted rows render at reduced opacity (`prsp-row-deleted`), and their default **View** link routes to `/PSRS/:RecordSet/ViewDeleted/:GUID` — a read route whose lookup explicitly includes soft-deleted records (a plain View would find nothing) and which renders a "This record has been deleted" banner above the record. Pair with the audit tier's *Deleted / Deleted on / Deleted by* columns in the column chooser.

## Associations (joined-entity management)

First-class, opt-in UI for managing many-to-many **joins** (the `XxxYyyJoin` convention — a join row with its own `ID<Join>` plus an `ID<X>` and `ID<Y>`). Three interfaces, all driven by light configuration:

- **Association Editor** — a small embeddable widget added as a **read-view tab**: a searchable picker of the other entity (already-joined rows culled out) + an explicit **Add** button, over a list of the current associations, each removable. Opt Book→Authors and Author→Books in *independently*; `PickerMode` (`single`/`multi`) is per-tab.
- **Bulk Associate screen** — a single-anchor page (`/PSRS/:RecordSet/Associate/:Association`): pick one anchor record, multi-select many other-side records, create all the joins at once.
- **Matrix (cross-link) screen** — a dual-**table** page (`/PSRS/AssociateMatrix/:Association`) for linking complex records: each side is a record table with **configurable columns** (`TableColumns`, plus a per-table **Columns** chooser the user toggles — saved in localStorage), checkbox rows, and per-table search. Multi-select on both sides; a live stats header counts the **cross-product** (every left × every right); "Link selected" creates them all, skipping existing pairs.
- **Bulk Unlink screen** — the removal counterpart (`/PSRS/AssociateUnlink/:Association/:AnchorRecordSet`): pick a specific book *or* store, see all its current links in a selectable table (same columns/chooser/search + select-all), check rows, and "Unlink selected" deletes those joins together.

Define each join **once**, symmetrically, in a top-level `Associations` registry; then opt in per record set via a `RecordSetReadTabs` entry of `"Type": "Association"` (with `"ReadLayout": "Tab"` or `"Split"`) and/or a `RecordSetBulkAssociations` entry. With `Split`, the record stays in a resizable left pane and the association tabs sit top-right, opening to the record alone until you pick a tab. The picker comes from [pict-section-picker](https://github.com/fable-retold/pict-section-picker) and remove-confirmation from [pict-section-modal](https://github.com/fable-retold/pict-section-modal) (both soft dependencies, reached by provider hash). See the bookstore example for the full wiring (`Book`↔`Author` tabs both sides; `Book`↔`BookStore` catalog tabs + the "Assign Books to Store" bulk screen + the "Bulk Link" matrix screen), and `CLAUDE-pict-section-recordset.md` for the config reference and the `RecordSetAssociationManager` API.

## Field Decoration (picker row disambiguation)

The entity pickers this module builds — the **Association Editor** add-control, the **entity quick-filters**, and the **Bulk Delete** replacement picker — can grow a small **⚙** that lets a *user* pin an extra record column onto every dropdown row, as a badge. When a search returns six firms all named "Volkert", pinning `VendorCode` turns the six identical rows into `Volkert · 310009258`, `Volkert · 310009999`, … The choice is the user's, remembered in `localStorage` (keyed by entity), and unobtrusive — the ⚙ only appears where you opt the entity in. The rendering lives in [pict-section-picker](https://github.com/fable-retold/pict-section-picker)'s `AllowFieldDecoration`; this module owns the **policy** of where it's offered.

**Opt-in, module-wide.** One `FieldDecoration` policy on the app settings drives every entity picker the module makes:

```javascript
"FieldDecoration":
{
    "Global": false,                                   // decorate every entity picker
    "Entities":
    {
        "Organization": true,                          // opt one entity in
        "Contract": { "IgnoreFields": [ "IDVendor" ] },// opt in + hide extra columns from the ⚙ chooser
        "Invoice": false                               // opt out (even when Global is true)
    },
    "IgnoreFields": [ "IDCustomer" ]                   // hidden on every decorated picker (business noise)
}
```

An entity value of `true` opts it in, `false` opts it out, and an object opts it in and contributes its own `IgnoreFields`. The picker widget already hides the value / text / audit columns on its own; the policy adds its `IgnoreFields`, the entity's `IgnoreFields`, and `GUID<Entity>` (the one system column the picker does not auto-hide). Resolved per entity by `PictSectionRecordSet.resolveFieldDecoration(pEntity)` → `{ Enabled, IgnoreFields }`, and stamped onto each picker config by `applyFieldDecoration(pConfig, pEntity)`. A caller passing explicit `AllowFieldDecoration` in a picker override still wins over the policy.

## Related Packages

- [pict](https://github.com/fable-retold/pict) - MVC application framework
- [pict-view](https://github.com/fable-retold/pict-view) - View base class
- [pict-provider](https://github.com/fable-retold/pict-provider) - Data provider base class
- [pict-section-form](https://github.com/fable-retold/pict-section-form) - Form section component
- [pict-section-picker](https://github.com/fable-retold/pict-section-picker) - Searchable entity picker (the association add control)
- [pict-section-modal](https://github.com/fable-retold/pict-section-modal) - Modal/confirm dialogs (association remove confirmation)

## License

MIT

## Contributing

Pull requests are welcome. For details on our code of conduct, contribution process, and testing requirements, see the [Retold Contributing Guide](https://github.com/fable-retold/retold/blob/main/docs/contributing.md).
