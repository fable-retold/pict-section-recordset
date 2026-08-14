const libPictView = require('pict-view');

/**
 * The Bulk Delete screen — select a batch of a recordset's records and delete them together (to clean up
 * duplicates / bad imports). A searchable, paged record table with a checkbox per row + select-all; "Delete
 * selected" removes them all after a confirm.
 *
 * Two modes:
 *   - Basic: just delete the checked records.
 *   - Advanced (opt in per recordset via `RecordSetAdvancedDelete`): for each record being deleted, pick ONE
 *     replacement record (same recordset); all of that record's many-to-many joins and one-to-many
 *     dependents are REPOINTED to the replacement first (via the metacontroller's reassociation
 *     orchestrator), and the record is only deleted when its repoint succeeds cleanly. This is the "delete
 *     the misspelled Author, move his books to the correct one" workflow.
 *
 * Registered ONCE by the metacontroller as `RSP-RecordSet-BulkDelete` and parameterized by route:
 *   /PSRS/:RecordSet/BulkDelete                       (bulk selection)
 *   /PSRS/:RecordSet/BulkDelete/Record/:RecordID      (single record, Advanced — the Read view's advanced path)
 *
 * Data flows through the registered recordset provider (getRecords + deleteRecord) and the reassociation
 * orchestrator on `pict.PictSectionRecordSet`. The replacement picker comes from `pict-section-picker`
 * (soft dependency); confirm/toast come from `pict-section-modal`; column visibility persists through the
 * `ColumnDataProvider`.
 */

/** @type {Record<string, any>} */
const _DEFAULT_CONFIGURATION_BulkDelete = (
	{
		ViewIdentifier: 'PRSP-BulkDelete',

		DefaultRenderable: 'PRSP_Renderable_BulkDelete',
		DefaultDestinationAddress: '#PRSP_Container',
		DefaultTemplateRecordAddress: false,

		AutoInitialize: false,
		AutoInitializeOrdinal: 0,
		AutoRender: false,
		AutoRenderOrdinal: 0,
		AutoSolveWithApp: false,
		AutoSolveOrdinal: 0,

		BulkDeletePageSize: 50,

		CSS: /*css*/`
		.prsp-bdel { display: flex; flex-direction: column; gap: 1rem; padding: 0.25rem 0 1rem; }
		.prsp-bdel-header h2 { margin: 0 0 0.2rem; font-size: 1.25rem; color: var(--theme-color-text-primary, #1f2733); }
		.prsp-bdel-sub { margin: 0; color: var(--theme-color-text-muted, #6b7686); font-size: 0.92rem; }
		.prsp-bdel-card { border: 1px solid var(--theme-color-border-light, #e8ebf0); border-radius: 12px; padding: 0.8rem 0.9rem; background: var(--theme-color-background-primary, #fff); display: flex; flex-direction: column; gap: 0.6rem; }
		.prsp-bdel-card.is-hidden { display: none; }
		.prsp-bdel-card-label { font-size: 0.72rem; font-weight: 650; text-transform: uppercase; letter-spacing: 0.05em; color: var(--theme-color-text-muted, #6b7686); }
		.prsp-bdel-modes { display: inline-flex; gap: 0.35rem; }
		.prsp-bdel-mode { padding: 0.4rem 0.85rem; border: 1px solid var(--theme-color-border-default, #d7dce3); border-radius: 8px; cursor: pointer; font: inherit; font-size: 0.86rem; color: var(--theme-color-text-secondary, #45505f); background: var(--theme-color-background-panel, #fff); user-select: none; }
		.prsp-bdel-mode:hover { background: var(--theme-color-background-tertiary, #eceef2); color: var(--theme-color-text-primary, #1f2733); }
		.prsp-bdel-mode.is-active { border-color: var(--theme-color-brand-primary, #156dd1); background: var(--theme-color-background-selected, #e3edfb); color: var(--theme-color-brand-primary, #156dd1); font-weight: 600; }
		.prsp-bdel-bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
			border: 1px solid var(--theme-color-border-light, #e8ebf0); border-radius: 12px; padding: 0.7rem 1rem; background: var(--theme-color-background-secondary, #f7f8fa); }
		.prsp-bdel-stats { font-size: 0.95rem; color: var(--theme-color-text-secondary, #45505f); }
		.prsp-bdel-stats strong { color: var(--theme-color-status-error, #b62828); font-size: 1.05rem; }
		.prsp-bdel-btn { display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer; font: inherit; font-size: 0.92rem; font-weight: 600;
			padding: 0.5rem 1rem; border-radius: 8px; border: 1px solid var(--theme-color-status-error, #b62828);
			background: var(--theme-color-status-error, #b62828); color: #fff; }
		.prsp-bdel-btn:hover { background: var(--theme-color-status-error-hover, #9c2020); }
		.prsp-bdel-btn[disabled] { opacity: 0.5; cursor: not-allowed; }
		.prsp-bdel-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; flex-wrap: wrap; }
		.prsp-bdel-filters:empty { display: none; }
		.prsp-bdel-tools { display: flex; align-items: center; gap: 0.6rem; }
		.prsp-bdel-colbtn { display: inline-flex; align-items: center; gap: 0.3rem; cursor: pointer; font: inherit; font-size: 0.78rem; padding: 0.2rem 0.5rem;
			border: 1px solid var(--theme-color-border-default, #d7dce3); border-radius: 6px; background: var(--theme-color-background-panel, #fff); color: var(--theme-color-text-secondary, #45505f); }
		.prsp-bdel-colbtn:hover { background: var(--theme-color-background-tertiary, #eceef2); color: var(--theme-color-text-primary, #1f2733); }
		.prsp-bdel-colchooser-wrap { position: relative; }
		.prsp-bdel-colchooser-backdrop { position: fixed; inset: 0; z-index: 30; display: none; }
		.prsp-bdel-colchooser-wrap.is-open .prsp-bdel-colchooser-backdrop { display: block; }
		.prsp-bdel-colchooser { position: absolute; right: 0; top: 0.3rem; z-index: 40; min-width: 200px; display: none;
			background: var(--theme-color-background-panel, #fff); border: 1px solid var(--theme-color-border-default, #d7dce3); border-radius: 10px; box-shadow: 0 10px 28px rgba(17, 24, 39, 0.14); overflow: hidden; }
		.prsp-bdel-colchooser-wrap.is-open .prsp-bdel-colchooser { display: block; }
		.prsp-bdel-colchooser-list { max-height: 50vh; overflow-y: auto; padding: 0.25rem; }
		.prsp-bdel-colrow { display: flex; align-items: center; gap: 0.5rem; width: 100%; text-align: left; cursor: pointer; font: inherit; font-size: 0.86rem;
			padding: 0.4rem 0.55rem; border: none; border-radius: 6px; background: transparent; color: var(--theme-color-text-primary, #1f2733); }
		.prsp-bdel-colrow:hover { background: var(--theme-color-background-tertiary, #eceef2); }
		.prsp-bdel-colrow-check { flex: 0 0 auto; display: inline-flex; width: 1em; color: var(--theme-color-brand-primary, #156dd1); visibility: hidden; }
		.prsp-bdel-colrow.is-on .prsp-bdel-colrow-check { visibility: visible; }
		.prsp-bdel-colchooser-foot { display: flex; justify-content: flex-end; padding: 0.35rem 0.5rem; border-top: 1px solid var(--theme-color-border-light, #e8ebf0); }
		.prsp-bdel-colreset { font: inherit; font-size: 0.8rem; cursor: pointer; border: none; background: transparent; color: var(--theme-color-text-muted, #6b7686); padding: 0.15rem 0.3rem; border-radius: 5px; }
		.prsp-bdel-tablewrap { max-height: 52vh; overflow: auto; border: 1px solid var(--theme-color-border-light, #e8ebf0); border-radius: 8px; }
		.prsp-btbl { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
		.prsp-btbl thead th { position: sticky; top: 0; z-index: 1; text-align: left; padding: 0.5rem 0.6rem; background: var(--theme-color-background-tertiary, #eceef2);
			color: var(--theme-color-text-secondary, #45505f); font-size: 0.72rem; font-weight: 650; text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap; }
		.prsp-btbl-th-check { width: 1.8rem; text-align: center; cursor: pointer; }
		.prsp-btbl-row { cursor: pointer; border-top: 1px solid var(--theme-color-border-light, #e8ebf0); }
		.prsp-btbl-row:hover { background: var(--theme-color-background-tertiary, #eceef2); }
		.prsp-btbl-row.is-selected { background: color-mix(in srgb, var(--theme-color-status-error, #b62828) 9%, transparent); }
		.prsp-btbl-row td { padding: 0.4rem 0.6rem; color: var(--theme-color-text-primary, #1f2733); max-width: 22rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
		.prsp-btbl-td-check { width: 1.8rem; text-align: center; }
		.prsp-btbl-check { display: inline-flex; color: var(--theme-color-status-error, #b62828); visibility: hidden; }
		.prsp-btbl-row.is-selected .prsp-btbl-check { visibility: visible; }
		.prsp-btbl-headcheck { display: inline-flex; color: var(--theme-color-text-muted, #6b7686); }
		.prsp-bdel-more { display: block; width: 100%; padding: 0.45rem; cursor: pointer; font: inherit; font-size: 0.85rem; border: none; border-top: 1px solid var(--theme-color-border-light, #e8ebf0);
			background: var(--theme-color-background-tertiary, #eceef2); color: var(--theme-color-text-secondary, #45505f); }
		.prsp-bdel-more:hover { background: var(--theme-color-background-selected, #e3edfb); color: var(--theme-color-brand-primary, #156dd1); }
		.prsp-bdel-empty { padding: 0.9rem; color: var(--theme-color-text-muted, #6b7686); font-size: 0.9rem; font-style: italic; text-align: center; }
		.prsp-bdel-note { color: var(--theme-color-status-error, #b62828); font-size: 0.86rem; }
		.prsp-bdel-reassign-row { display: flex; align-items: center; gap: 0.8rem; padding: 0.5rem 0.2rem; border-top: 1px solid var(--theme-color-border-light, #e8ebf0); }
		.prsp-bdel-reassign-row:first-child { border-top: none; }
		.prsp-bdel-reassign-name { flex: 0 0 40%; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--theme-color-text-primary, #1f2733); font-size: 0.92rem; }
		.prsp-bdel-reassign-arrow { flex: 0 0 auto; color: var(--theme-color-text-muted, #6b7686); }
		.prsp-bdel-reassign-picker { flex: 1 1 auto; min-width: 0; }
		`,
		CSSPriority: 500,

		Templates:
		[
			{
				Hash: 'PRSP-BulkDelete-Template',
				Template: /*html*/`
		<!-- DefaultPackage pict view template: [PRSP-BulkDelete-Template] -->
		<div class="prsp-bdel">
			<div class="prsp-bdel-header">
				<h2>{~D:Record.Title~}</h2>
				<p class="prsp-bdel-sub">{~D:Record.Subtitle~}</p>
			</div>
			{~TS:PRSP-BulkDelete-ModeCard:Record.ModeSlot~}
			<div class="prsp-bdel-bar">
				<div class="prsp-bdel-stats" id="{~D:Record.StatsID~}"></div>
				<button type="button" class="prsp-bdel-btn" id="{~D:Record.DeleteButtonID~}" onclick="_Pict.views['RSP-RecordSet-BulkDelete'].confirmBulkDelete()">{~I:Trash~} Delete selected</button>
			</div>
			{~TS:PRSP-BulkDelete-Toolbar:Record.ToolbarSlot~}
			<div class="prsp-bdel-card">
				<div class="prsp-bdel-tablewrap"><div id="{~D:Record.TableID~}"></div></div>
			</div>
			{~TS:PRSP-BulkDelete-ReassignCard:Record.ReassignSlot~}
			{~NE:Record.PickerMissing^<div class="prsp-bdel-note">The entity picker (pict-section-picker) is not registered, so replacement selection is unavailable.</div>~}
		</div>
		<!-- DefaultPackage end view template:  [PRSP-BulkDelete-Template] -->
	`
			},
			{
				Hash: 'PRSP-BulkDelete-ModeCard',
				Template: /*html*/`
		<div class="prsp-bdel-card">
			<span class="prsp-bdel-card-label">Mode</span>
			<div class="prsp-bdel-modes" id="{~D:Record.ModeToggleID~}">{~T:PRSP-BulkDelete-ModeToggle:Record~}</div>
		</div>
	`
			},
			{
				Hash: 'PRSP-BulkDelete-ModeToggle',
				Template: /*html*/`
		<div class="prsp-bdel-mode{~NE:Record.BasicActive^ is-active~}" onclick="_Pict.views['RSP-RecordSet-BulkDelete'].setMode('Basic')">Delete only</div>
		<div class="prsp-bdel-mode{~NE:Record.AdvancedActive^ is-active~}" onclick="_Pict.views['RSP-RecordSet-BulkDelete'].setMode('Advanced')">Reassign &amp; delete</div>
	`
			},
			{
				Hash: 'PRSP-BulkDelete-Toolbar',
				Template: /*html*/`
		<div class="prsp-bdel-card">
			<div class="prsp-bdel-toolbar">
				<span class="prsp-bdel-card-label">Filter {~D:Record.RecordLabel~}</span>
				<div class="prsp-bdel-tools">
					<div class="prsp-bdel-colchooser-wrap" id="{~D:Record.ChooserID~}_Wrap">
						<button type="button" class="prsp-bdel-colbtn" title="Choose columns" onclick="_Pict.views['RSP-RecordSet-BulkDelete'].toggleColumnChooser()">{~I:Settings~} Columns</button>
						<div class="prsp-bdel-colchooser-backdrop" onclick="_Pict.views['RSP-RecordSet-BulkDelete'].closeColumnChooser()"></div>
						<div class="prsp-bdel-colchooser" id="{~D:Record.ChooserID~}"></div>
					</div>
				</div>
			</div>
			<!-- The recordset's own filter experience (quick filters + Add filter) renders here; applying a
			     filter navigates to /BulkDelete/FilteredTo/... which re-lists through the same provider path. -->
			<div class="prsp-bdel-filters" id="PRSP_Filters_Container"></div>
		</div>
	`
			},
			{
				Hash: 'PRSP-BulkDelete-Table',
				Template: /*html*/`
		<table class="prsp-btbl">
			<thead><tr><th class="prsp-btbl-th-check" title="Select all loaded" onclick="_Pict.views['RSP-RecordSet-BulkDelete'].toggleSelectAll()"><span class="prsp-btbl-headcheck">{~D:Record.SelectAllIcon~}</span></th>{~TS:PRSP-BulkDelete-HeaderCell:Record.Columns~}</tr></thead>
			<tbody>{~TS:PRSP-BulkDelete-Row:Record.Rows~}</tbody>
		</table>
		{~TS:PRSP-BulkDelete-Empty:Record.EmptySlot~}
		{~TS:PRSP-BulkDelete-More:Record.MoreSlot~}
	`
			},
			{
				Hash: 'PRSP-BulkDelete-HeaderCell',
				Template: /*html*/`<th>{~D:Record.DisplayName~}</th>`
			},
			{
				Hash: 'PRSP-BulkDelete-Row',
				Template: /*html*/`<tr id="{~D:Record.RowID~}" class="prsp-btbl-row{~NE:Record.Selected^ is-selected~}" onclick="_Pict.views['RSP-RecordSet-BulkDelete'].toggleRow('{~D:Record.RecordID~}')"><td class="prsp-btbl-td-check"><span class="prsp-btbl-check">{~I:Check~}</span></td>{~TS:PRSP-BulkDelete-Cell:Record.Cells~}</tr>`
			},
			{
				Hash: 'PRSP-BulkDelete-Cell',
				Template: /*html*/`<td title="{~D:Record.Value~}">{~D:Record.Value~}</td>`
			},
			{
				Hash: 'PRSP-BulkDelete-Empty',
				Template: /*html*/`<div class="prsp-bdel-empty">{~D:Record.EmptyText~}</div>`
			},
			{
				Hash: 'PRSP-BulkDelete-More',
				Template: /*html*/`<button type="button" class="prsp-bdel-more" onclick="_Pict.views['RSP-RecordSet-BulkDelete'].loadMore()">Load more</button>`
			},
			{
				Hash: 'PRSP-BulkDelete-Chooser',
				Template: /*html*/`
		<div class="prsp-bdel-colchooser-list">{~TS:PRSP-BulkDelete-ColRow:Record.Rows~}</div>
		<div class="prsp-bdel-colchooser-foot"><button type="button" class="prsp-bdel-colreset" onclick="_Pict.views['RSP-RecordSet-BulkDelete'].resetColumns()">Reset to defaults</button></div>
	`
			},
			{
				Hash: 'PRSP-BulkDelete-ColRow',
				Template: /*html*/`<button type="button" class="prsp-bdel-colrow{~NE:Record.Visible^ is-on~}" onclick="_Pict.views['RSP-RecordSet-BulkDelete'].toggleColumn('{~D:Record.Key~}')"><span class="prsp-bdel-colrow-check">{~I:Check~}</span><span>{~D:Record.DisplayName~}</span></button>`
			},
			{
				Hash: 'PRSP-BulkDelete-ReassignCard',
				Template: /*html*/`
		<div class="prsp-bdel-card{~NE:Record.Hidden^ is-hidden~}" id="{~D:Record.ReassignCardID~}">
			<span class="prsp-bdel-card-label">Reassign related records to</span>
			<div id="{~D:Record.ReassignID~}"></div>
		</div>
	`
			},
			{
				Hash: 'PRSP-BulkDelete-Reassign',
				Template: /*html*/`
		{~TS:PRSP-BulkDelete-ReassignRow:Record.Rows~}
		{~TS:PRSP-BulkDelete-ReassignEmpty:Record.EmptySlot~}
	`
			},
			{
				Hash: 'PRSP-BulkDelete-ReassignRow',
				Template: /*html*/`
		<div class="prsp-bdel-reassign-row">
			<span class="prsp-bdel-reassign-name" title="{~D:Record.Display~}">{~D:Record.Display~}</span>
			<span class="prsp-bdel-reassign-arrow">{~I:ArrowRight~}</span>
			<div class="prsp-bdel-reassign-picker" id="{~D:Record.PickerHostID~}"></div>
		</div>
	`
			},
			{
				Hash: 'PRSP-BulkDelete-ReassignEmpty',
				Template: /*html*/`<div class="prsp-bdel-empty">{~D:Record.EmptyText~}</div>`
			}
		],

		Renderables:
		[
			{
				RenderableHash: 'PRSP_Renderable_BulkDelete',
				TemplateHash: 'PRSP-BulkDelete-Template',
				ContentDestinationAddress: '#PRSP_Container',
				RenderMethod: 'replace'
			}
		],

		Manifests: {}
	});

class viewRecordSetBulkDelete extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DEFAULT_CONFIGURATION_BulkDelete, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		/** @type {import('pict') & { PictSectionRecordSet: any }} */
		this.pict;

		this._recordSet = null;
		this._config = null;
		this._presetRecordID = null;    // single-record advanced entry (from the Read view)
		this._records = [];             // the loaded page(s)
		this._recordsByID = {};         // String(id) -> record (accumulates across pages, for confirm lookups)
		this._cursor = 0;
		this._hasMore = false;
		this._filterString = '';        // the FilteredTo route segment (the recordset filter search string)
		this._filterExperience = '';    // the serialized filter experience from the route
		this._selected = {};            // String(recordID) -> true
		this._mode = 'Basic';           // 'Basic' | 'Advanced'
		this._replacement = {};         // String(recordID) -> replacementID
	}

	/** @return {any} The registered recordset provider. */
	get provider()
	{
		return this.pict.providers[`RSP-Provider-${this._recordSet}`];
	}

	/** @return {any} The column-visibility persistence provider (localStorage; host-overridable). */
	get columnProvider()
	{
		return this.pict.providers.ColumnDataProvider;
	}

	/** @return {number} */
	_pageSize() { return this.options.BulkDeletePageSize || 50; }

	/** @return {boolean} Whether advanced (reassign) delete is enabled for this recordset. */
	_advancedEnabled() { return !!(this._config && this._config.RecordSetAdvancedDelete === true); }

	addRoutes(pPictRouter)
	{
		pPictRouter.router.on('/PSRS/:RecordSet/BulkDelete/Record/:RecordID', this.handleBulkDeleteRoute.bind(this));
		// Filtered variants (the recordset filter experience navigates here, ViewContext = 'BulkDelete').
		pPictRouter.router.on('/PSRS/:RecordSet/BulkDelete/FilteredTo/:FilterString/FilterExperience/:FilterExperience', this.handleBulkDeleteRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/BulkDelete/FilteredTo/:FilterString', this.handleBulkDeleteRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/BulkDelete/FilterExperience/:FilterExperience', this.handleBulkDeleteRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/BulkDelete', this.handleBulkDeleteRoute.bind(this));
		return true;
	}

	/**
	 * Route handler — parse the recordset + optional single record, then paint.
	 * @param {Record<string, any>} pRoutePayload
	 */
	handleBulkDeleteRoute(pRoutePayload)
	{
		if (typeof(pRoutePayload) != 'object')
		{
			throw new Error(`Pict RecordSet BulkDelete route handler called with invalid route payload.`);
		}
		this._recordSet = pRoutePayload.data.RecordSet;
		this._presetRecordID = (pRoutePayload.data.RecordID !== undefined && pRoutePayload.data.RecordID !== '') ? pRoutePayload.data.RecordID : null;
		this._filterString = pRoutePayload.data.FilterString || '';
		this._filterExperience = pRoutePayload.data.FilterExperience || '';
		this._config = this.pict.PictSectionRecordSet ? this.pict.PictSectionRecordSet.recordSetProviderConfigurations[this._recordSet] : null;
		this._records = [];
		this._recordsByID = {};
		this._cursor = 0;
		this._hasMore = false;
		this._selected = {};
		this._replacement = {};
		// The Read view's advanced path deep-links a single record; force Advanced + preselect it.
		this._mode = this._presetRecordID ? 'Advanced' : 'Basic';
		if (this._presetRecordID) { this._selected[String(this._presetRecordID)] = true; }
		return this.renderScreen();
	}

	/** A DOM/address-safe key for this screen. */
	get safeKey()
	{
		return `${String(this._recordSet)}`.replace(/[^A-Za-z0-9]/g, '_');
	}

	/** @return {string} A label for the records being deleted. */
	_recordLabel() { return (this._config && this._config.Title) || this._recordSet || 'records'; }

	/** @return {Array<string>} The recordset's search fields (config, else the display field). */
	_searchFields()
	{
		if (this._config && Array.isArray(this._config.SearchFields) && this._config.SearchFields.length > 0) { return this._config.SearchFields; }
		return [ this._displayField() ];
	}

	/** @return {string} The best display field for a record (config override, else a common name column). */
	_displayField()
	{
		if (this._config && this._config.RecordSetBulkDeleteDisplayField) { return this._config.RecordSetBulkDeleteDisplayField; }
		if (this._config && Array.isArray(this._config.SearchFields) && this._config.SearchFields.length > 0) { return this._config.SearchFields[0]; }
		return 'Name';
	}

	/** Column persistence scope for the bulk-delete table. */
	_columnScope() { return `BulkDelete_${this._recordSet}`; }

	/** @return {Array<Record<string, any>>} The table columns (RecordSetListColumns, else a single display column). */
	_columns()
	{
		if (this._config && Array.isArray(this._config.RecordSetListColumns) && this._config.RecordSetListColumns.length > 0)
		{
			return this._config.RecordSetListColumns.map((pCol) => ({ Key: pCol.Key, DisplayName: pCol.DisplayName || pCol.Key, DefaultHidden: (pCol.DefaultHidden === true) }));
		}
		return [ { Key: '__display', DisplayName: this._recordLabel(), DefaultHidden: false } ];
	}

	/**
	 * Fetch one page of the recordset's records (or the single preset record). The FilterString is encoded
	 * the same way the List view encodes it before handing it to the provider.
	 * @param {boolean} pReset
	 * @return {Promise<void>}
	 */
	async _fetchPage(pReset)
	{
		if (pReset) { this._cursor = 0; }
		const tmpIDField = this.provider.getIDField();
		let tmpRecords = [];
		if (this._presetRecordID)
		{
			// The single-record advanced flow fetches exactly that record (documented raw-filter read).
			const tmpResult = await this.provider.getRecordsInline(`FBV~${tmpIDField}~EQ~${encodeURIComponent(this._presetRecordID)}`, 0, 1);
			tmpRecords = (tmpResult && Array.isArray(tmpResult.Records)) ? tmpResult.Records : [];
			this._hasMore = false;
		}
		else
		{
			// Reuse the recordset's filter machinery: getRecords composes the route FilterString (encoded the
			// same way the List encodes it) over the recordset's active filter clauses + default filter +
			// delete suppression. So the bulk-delete list respects the same filters as the List.
			const tmpOptions = { RecordSet: this._recordSet, RecordSetConfiguration: this._config, Offset: this._cursor, PageSize: this._pageSize() };
			if (this._filterString) { tmpOptions.FilterString = encodeURIComponent(this._filterString); }
			const tmpResult = await this.provider.getRecords(tmpOptions);
			tmpRecords = (tmpResult && Array.isArray(tmpResult.Records)) ? tmpResult.Records : [];
			this._hasMore = (tmpRecords.length >= this._pageSize());
		}
		this._records = pReset ? tmpRecords : this._records.concat(tmpRecords);
		// Index every loaded record so confirm can find a selected record even after it scrolls off (paging
		// is client-side "Load more", so selection survives; a filter change re-lists via the route).
		for (let i = 0; i < tmpRecords.length; i++)
		{
			this._recordsByID[String(tmpRecords[i][tmpIDField])] = tmpRecords[i];
		}
	}

	/**
	 * Paint the screen shell, load the first page, render the table (+ the reassign section in Advanced mode).
	 * @return {Promise<boolean>}
	 */
	async renderScreen()
	{
		if (!this.provider)
		{
			this.pict.log.error(`BulkDelete: no provider registered for recordset [${this._recordSet}].`);
			return false;
		}
		// Rehydrate the filter experience from the route into the recordset's active filter state (so the
		// same clauses drive the fetch), mirroring how the List view rehydrates filters from the URL.
		if (this._filterExperience && this.pict.views['PRSP-Filters'])
		{
			const tmpExperienceFromURL = await this.pict.views['PRSP-Filters'].deserializeFilterExperience(this._filterExperience);
			if (tmpExperienceFromURL)
			{
				this.pict.manifest.setValueByHash(this.pict.Bundle, `_ActiveFilterState[${this._recordSet}].FilterClauses`, tmpExperienceFromURL);
			}
		}
		await this._fetchPage(true);

		const tmpAdvanced = (this._mode === 'Advanced');
		const tmpModeData = {
			ModeToggleID: `${this.safeKey}_ModeToggle`,
			BasicActive: !tmpAdvanced,
			AdvancedActive: tmpAdvanced,
		};
		const tmpToolbarData = {
			RecordLabel: this._recordLabel(),
			ChooserID: `${this.safeKey}_Chooser`,
		};
		const tmpReassignData = {
			ReassignCardID: `${this.safeKey}_ReassignCard`,
			ReassignID: `${this.safeKey}_Reassign`,
			Hidden: !tmpAdvanced,
		};

		const tmpRecord =
		{
			Title: this._presetRecordID ? `Reassign & delete this ${this._singular(this._recordLabel())}` : `Delete ${this._recordLabel()}`,
			Subtitle: this._presetRecordID
				? `Choose a replacement for each related record, then delete.`
				: `Select the ${this._recordLabel()} to delete, then remove them together.${this._advancedEnabled() ? ' Use "Reassign & delete" to move related records to a replacement first.' : ''}`,
			StatsID: `${this.safeKey}_Stats`,
			DeleteButtonID: `${this.safeKey}_Delete`,
			TableID: `${this.safeKey}_Table`,
			PickerMissing: (this._advancedEnabled() && !this.pict.providers['Pict-Section-Picker']),
			// Mode toggle only when advanced is enabled AND this is not the single-record preset flow.
			ModeSlot: (this._advancedEnabled() && !this._presetRecordID) ? [ tmpModeData ] : [],
			// The search/columns toolbar is not useful for the single-record preset flow.
			ToolbarSlot: this._presetRecordID ? [] : [ tmpToolbarData ],
			// The reassign card exists whenever advanced is enabled (hidden until Advanced mode).
			ReassignSlot: this._advancedEnabled() ? [ tmpReassignData ] : [],
		};

		return new Promise((resolve) =>
		{
			this.renderAsync(this.options.DefaultRenderable, this.options.DefaultDestinationAddress, tmpRecord,
				(pError) =>
				{
					if (pError)
					{
						this.pict.log.error(`BulkDelete: render error.`, pError);
						return resolve(false);
					}
					this._renderTable();
					if (!this._presetRecordID && this.pict.views['PRSP-Filters'])
					{
						// Render the recordset's filter experience into #PRSP_Filters_Container (ViewContext
						// 'BulkDelete', so its apply navigates back to /BulkDelete/FilteredTo/...). Mirrors the
						// filter view's own in-place re-render call.
						this.pict.views['PRSP-Filters'].render(undefined, undefined, { RecordSet: this._recordSet, ViewContext: 'BulkDelete' });
					}
					if (tmpAdvanced) { this._renderReassign(); }
					this.updateStats();
					this.pict.CSSMap.injectCSS();
					return resolve(true);
				});
		});
	}

	/** Effective visibility for a column (stored override wins, else `!DefaultHidden`). */
	_isColumnVisible(pCol)
	{
		const tmpOverrides = this.columnProvider ? this.columnProvider.getColumnVisibilityOverrides(this._columnScope(), 'BulkDelete') : {};
		if (tmpOverrides && Object.prototype.hasOwnProperty.call(tmpOverrides, pCol.Key))
		{
			return tmpOverrides[pCol.Key] === true;
		}
		return !pCol.DefaultHidden;
	}

	/** @return {Array<Record<string, any>>} The currently-visible columns. */
	_visibleColumns()
	{
		return this._columns().filter((pCol) => this._isColumnVisible(pCol));
	}

	/** Resolve a cell value for a column on a record (the synthetic __display column uses the name heuristic). */
	_cellValue(pRecord, pColumn)
	{
		if (pColumn.Key === '__display') { return this._displayName(pRecord); }
		return pRecord[pColumn.Key];
	}

	/** A human-friendly display name for a record (first present of the common name columns, else #id). */
	_displayName(pRecord)
	{
		if (!pRecord || typeof pRecord !== 'object') { return ''; }
		const tmpFields = [ this._displayField(), 'Name', 'Title', 'FullName', 'DisplayName', 'Label', 'Description', 'Code' ];
		for (let i = 0; i < tmpFields.length; i++)
		{
			const tmpValue = pRecord[tmpFields[i]];
			if (tmpValue !== undefined && tmpValue !== null && String(tmpValue).trim() !== '') { return String(tmpValue).trim(); }
		}
		return `#${pRecord[this.provider.getIDField()]}`;
	}

	/** Build the row models for the loaded records and render the table. */
	_renderTable()
	{
		const tmpColumns = this._visibleColumns();
		const tmpIDField = this.provider.getIDField();
		const tmpRows = this._records.map((pRecord) =>
		{
			const tmpID = pRecord[tmpIDField];
			return {
				RecordID: tmpID,
				RowID: `${this.safeKey}_row_${tmpID}`,
				Selected: !!this._selected[String(tmpID)],
				Cells: tmpColumns.map((pCol) => ({ Value: this._cellValue(pRecord, pCol) })),
			};
		});
		const tmpAllSelected = (tmpRows.length > 0 && tmpRows.every((pRow) => pRow.Selected));
		const tmpTableRecord = {
			Columns: tmpColumns.map((pCol) => ({ DisplayName: pCol.DisplayName })),
			Rows: tmpRows,
			SelectAllIcon: this.pict.icon(tmpAllSelected ? 'Check' : 'Minus'),
			EmptySlot: (tmpRows.length === 0) ? [ { EmptyText: this._filterString ? `No ${this._recordLabel()} match the filter.` : `No ${this._recordLabel()} found.` } ] : [],
			MoreSlot: this._hasMore ? [ {} ] : [],
		};
		const tmpHTML = this.pict.parseTemplateByHash('PRSP-BulkDelete-Table', tmpTableRecord);
		this.pict.ContentAssignment.assignContent(`#${this.safeKey}_Table`, tmpHTML);
	}

	/** Load the next page of records and append it. @return {Promise<void>} */
	async loadMore()
	{
		this._cursor += this._pageSize();
		await this._fetchPage(false);
		this._renderTable();
	}

	/**
	 * Toggle a record's selection (the row click). Re-renders the reassign section in Advanced mode so its
	 * per-record replacement pickers track the selection.
	 * @param {string|number} pRecordID
	 */
	toggleRow(pRecordID)
	{
		const tmpKey = String(pRecordID);
		if (this._selected[tmpKey]) { delete this._selected[tmpKey]; delete this._replacement[tmpKey]; }
		else { this._selected[tmpKey] = true; }
		const tmpRowElements = this.pict.ContentAssignment.getElement(`#${this.safeKey}_row_${pRecordID}`);
		if (tmpRowElements && tmpRowElements.length > 0)
		{
			tmpRowElements[0].classList.toggle('is-selected', !!this._selected[tmpKey]);
		}
		if (this._mode === 'Advanced') { this._renderReassign(); }
		this.updateStats();
	}

	/** Select / clear all the LOADED rows (the header checkbox). */
	toggleSelectAll()
	{
		const tmpIDField = this.provider.getIDField();
		const tmpAllSelected = (this._records.length > 0 && this._records.every((pRecord) => this._selected[String(pRecord[tmpIDField])]));
		for (let i = 0; i < this._records.length; i++)
		{
			const tmpKey = String(this._records[i][tmpIDField]);
			if (tmpAllSelected) { delete this._selected[tmpKey]; delete this._replacement[tmpKey]; }
			else { this._selected[tmpKey] = true; }
		}
		this._renderTable();
		if (this._mode === 'Advanced') { this._renderReassign(); }
		this.updateStats();
	}

	/** Switch Basic/Advanced mode (show/hide the reassign card + repaint the toggle). @param {string} pMode */
	setMode(pMode)
	{
		this._mode = (pMode === 'Advanced') ? 'Advanced' : 'Basic';
		const tmpToggleElements = this.pict.ContentAssignment.getElement(`#${this.safeKey}_ModeToggle`);
		if (tmpToggleElements && tmpToggleElements.length > 0)
		{
			const tmpHTML = this.pict.parseTemplateByHash('PRSP-BulkDelete-ModeToggle', { BasicActive: (this._mode !== 'Advanced'), AdvancedActive: (this._mode === 'Advanced') });
			this.pict.ContentAssignment.assignContent(`#${this.safeKey}_ModeToggle`, tmpHTML);
		}
		const tmpCardElements = this.pict.ContentAssignment.getElement(`#${this.safeKey}_ReassignCard`);
		if (tmpCardElements && tmpCardElements.length > 0)
		{
			tmpCardElements[0].classList.toggle('is-hidden', (this._mode !== 'Advanced'));
		}
		if (this._mode === 'Advanced') { this._renderReassign(); }
		this.updateStats();
	}

	/** Render the reassign section (a replacement picker per selected record) + mount the pickers. */
	_renderReassign()
	{
		const tmpIDField = this.provider.getIDField();
		const tmpSelectedIDs = Object.keys(this._selected).filter((pKey) => this._selected[pKey]);
		const tmpRows = tmpSelectedIDs.map((pID) => (
			{
				RecordID: pID,
				Display: this._displayName(this._recordsByID[pID] || {}),
				PickerHostID: `${this.safeKey}_repl_${String(pID).replace(/[^A-Za-z0-9]/g, '_')}`,
			}));
		const tmpHTML = this.pict.parseTemplateByHash('PRSP-BulkDelete-Reassign',
			{
				Rows: tmpRows,
				EmptySlot: (tmpRows.length === 0) ? [ { EmptyText: `Select ${this._recordLabel()} above to choose replacements.` } ] : [],
			});
		this.pict.ContentAssignment.assignContent(`#${this.safeKey}_Reassign`, tmpHTML);
		for (let i = 0; i < tmpRows.length; i++)
		{
			this._mountReplacementPicker(tmpRows[i].RecordID, tmpRows[i].PickerHostID, tmpSelectedIDs);
		}
	}

	/**
	 * Mount a single-select replacement picker over the same recordset entity, culling every id selected
	 * for deletion (so a record can't be its own or another victim's replacement).
	 * @param {string|number} pRecordID @param {string} pHostID @param {Array<string>} pExcludeIDs
	 */
	_mountReplacementPicker(pRecordID, pHostID, pExcludeIDs)
	{
		const tmpPickerProvider = this.pict.providers['Pict-Section-Picker'];
		if (!tmpPickerProvider)
		{
			return;
		}
		const tmpIDField = this.provider.getIDField();
		const tmpSafeID = String(pRecordID).replace(/[^A-Za-z0-9]/g, '_');
		const tmpPickerHash = `${this.safeKey}_ReplPicker_${tmpSafeID}`;
		const tmpValueAddress = `AppData.PRSPBulkDeleteRepl.${this.safeKey}.R${tmpSafeID}`;
		if (!this.pict.AppData.PRSPBulkDeleteRepl) { this.pict.AppData.PRSPBulkDeleteRepl = {}; }
		if (!this.pict.AppData.PRSPBulkDeleteRepl[this.safeKey]) { this.pict.AppData.PRSPBulkDeleteRepl[this.safeKey] = {}; }

		const tmpConfig = {
			Entity: this.provider.options.Entity,
			ValueField: tmpIDField,
			TextField: this._displayField(),
			SearchFields: this._searchFields(),
			DestinationAddress: `#${pHostID}`,
			ValueAddress: tmpValueAddress,
			Placeholder: `Search a replacement ${this._singular(this._recordLabel())}…`,
			BaseFilter: () => `FBL~${tmpIDField}~NIN~${(pExcludeIDs || []).map((pValue) => encodeURIComponent(pValue)).join(',')}`,
			OnChange: (pValue) => { this._replacement[String(pRecordID)] = pValue; this.updateStats(); },
		};
		// Field decoration (module policy): opt-in ⚙ to pin an extra column onto each replacement row so
		// same-named candidates are distinguishable. Resolved per entity by the metacontroller.
		if (this.pict.PictSectionRecordSet)
		{
			this.pict.PictSectionRecordSet.applyFieldDecoration(tmpConfig, this.provider.options.Entity);
		}
		tmpPickerProvider.createEntityPicker(tmpPickerHash, tmpConfig);
		// createEntityPicker builds the picker view but does not paint it into the host — render it, then
		// restore any prior choice (a fresh row has none, so setValue is conditional).
		this.pict.views[tmpPickerHash].render();
		if (this._replacement[String(pRecordID)] !== undefined)
		{
			this.pict.views[tmpPickerHash].setValue(this._replacement[String(pRecordID)]);
		}
	}

	/** @return {number} */
	_selectedCount() { return Object.keys(this._selected).filter((pKey) => this._selected[pKey]).length; }

	/** Recompute the stats line + the Delete button's enabled state. */
	updateStats()
	{
		const tmpSelectedIDs = Object.keys(this._selected).filter((pKey) => this._selected[pKey]);
		const tmpCount = tmpSelectedIDs.length;
		let tmpStats = `<strong>${tmpCount}</strong> selected to delete`;
		if (this._mode === 'Advanced')
		{
			const tmpMissing = tmpSelectedIDs.filter((pKey) => (this._replacement[pKey] === undefined || this._replacement[pKey] === null || this._replacement[pKey] === '')).length;
			if (tmpMissing > 0) { tmpStats += ` &middot; ${tmpMissing} still need a replacement`; }
		}
		this.pict.ContentAssignment.assignContent(`#${this.safeKey}_Stats`, tmpStats);
		const tmpButtonElements = this.pict.ContentAssignment.getElement(`#${this.safeKey}_Delete`);
		if (tmpButtonElements && tmpButtonElements.length > 0)
		{
			tmpButtonElements[0].disabled = (tmpCount < 1);
		}
	}

	/**
	 * Delete the selected records (confirm via the host modal). In Advanced mode, each record's
	 * relationships are repointed to its chosen replacement first, and the record is deleted only when the
	 * repoint has zero failures (there are no DB transactions, so a partial repoint must not orphan rows).
	 * @return {Promise<void>}
	 */
	async confirmBulkDelete()
	{
		const tmpSelectedIDs = Object.keys(this._selected).filter((pKey) => this._selected[pKey]);
		if (tmpSelectedIDs.length < 1)
		{
			return;
		}
		const tmpAdvanced = (this._mode === 'Advanced');

		const tmpModal = this.pict.views['Pict-Section-Modal'];
		if (tmpModal && typeof tmpModal.confirm === 'function')
		{
			const tmpMessage = tmpAdvanced
				? `Reassign related records and delete ${tmpSelectedIDs.length} ${this._recordLabel()}? This cannot be undone.`
				: `Delete ${tmpSelectedIDs.length} ${this._recordLabel()}? This cannot be undone.`;
			const tmpOk = await tmpModal.confirm(tmpMessage,
				{ title: 'Delete', confirmLabel: `Delete ${tmpSelectedIDs.length}`, cancelLabel: 'Cancel', dangerous: true });
			if (!tmpOk)
			{
				return;
			}
		}

		let tmpDeleted = 0;
		let tmpFailed = 0;
		let tmpBlocked = 0;
		for (let i = 0; i < tmpSelectedIDs.length; i++)
		{
			const tmpID = tmpSelectedIDs[i];
			const tmpRecord = this._recordsByID[tmpID];
			if (!tmpRecord)
			{
				tmpFailed++;
				continue;
			}
			if (tmpAdvanced)
			{
				const tmpTo = this._replacement[tmpID];
				if (tmpTo === undefined || tmpTo === null || tmpTo === '' || String(tmpTo) === String(tmpID))
				{
					// No (usable) replacement chosen — skip rather than silently orphan or delete unremapped.
					tmpBlocked++;
					continue;
				}
				const tmpRepoint = await this.pict.PictSectionRecordSet.repointRecordRelationships(this._recordSet, tmpID, tmpTo);
				if (tmpRepoint.failed > 0)
				{
					// A relationship failed to move — do NOT delete (it would orphan the un-moved rows).
					tmpFailed++;
					this.pict.log.error(`BulkDelete: repoint for ${this._recordSet} ${tmpID} -> ${tmpTo} had ${tmpRepoint.failed} failure(s); skipping delete.`);
					continue;
				}
			}
			try
			{
				await this.provider.deleteRecord(tmpRecord);
				delete this._selected[tmpID];
				delete this._replacement[tmpID];
				tmpDeleted++;
			}
			catch (pError)
			{
				tmpFailed++;
				this.pict.log.error(`BulkDelete: delete failed for ${this._recordSet} ${tmpID}.`, pError);
			}
		}

		this._toast(`Deleted ${tmpDeleted}${tmpFailed > 0 ? `, ${tmpFailed} failed` : ''}${tmpBlocked > 0 ? `, ${tmpBlocked} skipped (no replacement)` : ''}.`,
			(tmpFailed > 0 || tmpBlocked > 0) ? 'error' : 'success');

		// The single-record advanced flow returns to the list once its record is gone.
		if (this._presetRecordID && tmpDeleted > 0)
		{
			this.fable.providers.RecordSetRouter.pictRouter.navigate(`/PSRS/${this._recordSet}/List`);
			return;
		}

		await this._fetchPage(true);
		this._renderTable();
		if (this._mode === 'Advanced') { this._renderReassign(); }
		this.updateStats();
	}

	// --- Column chooser (mirrors the associate screens) ---

	/** Open/close the column chooser. */
	toggleColumnChooser()
	{
		const tmpWrapElements = this.pict.ContentAssignment.getElement(`#${this.safeKey}_Chooser_Wrap`);
		if (!tmpWrapElements || tmpWrapElements.length < 1) { return; }
		if (tmpWrapElements[0].classList.contains('is-open'))
		{
			tmpWrapElements[0].classList.remove('is-open');
			return;
		}
		this._renderColumnChooser();
		tmpWrapElements[0].classList.add('is-open');
	}

	/** Close the column chooser (backdrop outside-click). */
	closeColumnChooser()
	{
		const tmpWrapElements = this.pict.ContentAssignment.getElement(`#${this.safeKey}_Chooser_Wrap`);
		if (tmpWrapElements && tmpWrapElements.length > 0)
		{
			tmpWrapElements[0].classList.remove('is-open');
		}
	}

	/** Render the chooser rows. */
	_renderColumnChooser()
	{
		const tmpRows = this._columns().map((pCol) => ({ Key: pCol.Key, DisplayName: pCol.DisplayName, Visible: this._isColumnVisible(pCol) }));
		const tmpHTML = this.pict.parseTemplateByHash('PRSP-BulkDelete-Chooser', { Rows: tmpRows });
		this.pict.ContentAssignment.assignContent(`#${this.safeKey}_Chooser`, tmpHTML);
	}

	/** Toggle one column's visibility (persisted; refuses to hide the last visible column). @param {string} pKey */
	toggleColumn(pKey)
	{
		if (!this.columnProvider) { return; }
		const tmpCol = this._columns().find((pCol) => String(pCol.Key) === String(pKey));
		if (!tmpCol) { return; }
		const tmpVisible = this._isColumnVisible(tmpCol);
		if (tmpVisible && this._visibleColumns().length <= 1) { return; }
		this.columnProvider.setColumnVisibilityOverride(this._columnScope(), 'BulkDelete', pKey, !tmpVisible);
		this._renderTable();
		this._renderColumnChooser();
	}

	/** Clear column overrides — back to developer defaults. */
	resetColumns()
	{
		if (this.columnProvider) { this.columnProvider.clearColumnVisibilityOverrides(this._columnScope(), 'BulkDelete'); }
		this._renderTable();
		this._renderColumnChooser();
	}

	/** Crude singularizer ("Books" -> "Book"). */
	_singular(pLabel)
	{
		return (typeof pLabel === 'string' && pLabel.length > 1 && pLabel.slice(-1).toLowerCase() === 's') ? pLabel.slice(0, -1) : pLabel;
	}

	/** Non-blocking notification via the host modal's toast, when available. */
	_toast(pMessage, pType)
	{
		const tmpModal = this.pict.views['Pict-Section-Modal'];
		if (tmpModal && typeof tmpModal.toast === 'function')
		{
			tmpModal.toast(pMessage, { type: pType || 'info' });
		}
	}
}

module.exports = viewRecordSetBulkDelete;

module.exports.default_configuration = _DEFAULT_CONFIGURATION_BulkDelete;
