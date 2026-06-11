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

## Related Packages

- [pict](https://github.com/fable-retold/pict) - MVC application framework
- [pict-view](https://github.com/fable-retold/pict-view) - View base class
- [pict-provider](https://github.com/fable-retold/pict-provider) - Data provider base class
- [pict-section-form](https://github.com/fable-retold/pict-section-form) - Form section component

## License

MIT

## Contributing

Pull requests are welcome. For details on our code of conduct, contribution process, and testing requirements, see the [Retold Contributing Guide](https://github.com/stevenvelozo/retold/blob/main/docs/contributing.md).
