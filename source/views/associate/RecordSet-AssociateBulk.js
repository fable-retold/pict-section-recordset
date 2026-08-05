const libPictView = require('pict-view');

/**
 * The Bulk Associate screen — a purpose-built page for reconciling one anchor's joins in a single pass
 * ("which books belong to THIS store?"). The anchor recordset (the route's `:RecordSet`) is one side of
 * the association; the user picks an anchor record, then sees a searchable, paged table of the OTHER
 * side's records with a checkbox each. The rows currently joined to the anchor are PRE-CHECKED; checking a
 * new row stages an add, unchecking a linked row stages a remove, and "Apply changes" commits both at once
 * (create the newly-checked joins, delete the newly-unchecked ones). This makes the screen reflect the
 * current associations as one editable whole rather than an add-only picker.
 *
 * Registered ONCE by the metacontroller as `RSP-RecordSet-Associate` and parameterized by route:
 *   /PSRS/:RecordSet/Associate/:Association
 *   /PSRS/:RecordSet/Associate/:Association/:AnchorID
 *
 * Light opt-in: a recordset advertises the screen in its nav by listing `RecordSetBulkAssociations`, but
 * the route works for any association whose side matches `:RecordSet`. Data flows through the shared
 * `RecordSetAssociationManager` (listAssociatedRecords + fetchSidePage + createJoin/removeJoin); the anchor
 * picker comes from `pict-section-picker` (soft dependency); column visibility persists through the
 * `ColumnDataProvider`. The other-side table needs no picker — a nice robustness win over the old cull-picker.
 */

/** @type {Record<string, any>} */
const _DEFAULT_CONFIGURATION_AssociateBulk = (
	{
		ViewIdentifier: 'PRSP-AssociateBulk',

		DefaultRenderable: 'PRSP_Renderable_AssociateBulk',
		DefaultDestinationAddress: '#PRSP_Container',
		DefaultTemplateRecordAddress: false,

		AutoInitialize: false,
		AutoInitializeOrdinal: 0,
		AutoRender: false,
		AutoRenderOrdinal: 0,
		AutoSolveWithApp: false,
		AutoSolveOrdinal: 0,

		// The other-side page size for the reconcile table (record offset paging via "Load more").
		ReconcilePageSize: 50,

		CSS: /*css*/`
		.prsp-bulk { display: flex; flex-direction: column; gap: 1rem; padding: 0.25rem 0 1rem; }
		.prsp-bulk-header h2 { margin: 0 0 0.2rem; font-size: 1.25rem; color: var(--theme-color-text-primary, #1f2733); }
		.prsp-bulk-sub { margin: 0; color: var(--theme-color-text-muted, #6b7686); font-size: 0.92rem; }
		.prsp-bulk-card { border: 1px solid var(--theme-color-border-light, #e8ebf0); border-radius: 12px; padding: 0.8rem 0.9rem; background: var(--theme-color-background-primary, #fff); display: flex; flex-direction: column; gap: 0.6rem; }
		.prsp-bulk-card-label { font-size: 0.72rem; font-weight: 650; text-transform: uppercase; letter-spacing: 0.05em; color: var(--theme-color-text-muted, #6b7686); }
		.prsp-bulk-picker-host { max-width: 520px; }
		.prsp-bulk-note { color: var(--theme-color-status-error, #b62828); font-size: 0.86rem; }
		.prsp-bulk-hint { color: var(--theme-color-text-muted, #6b7686); font-size: 0.92rem; font-style: italic; padding: 0.5rem 0.2rem; }
		.prsp-bulk-bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
			border: 1px solid var(--theme-color-border-light, #e8ebf0); border-radius: 12px; padding: 0.7rem 1rem; background: var(--theme-color-background-secondary, #f7f8fa); }
		.prsp-bulk-stats { font-size: 0.95rem; color: var(--theme-color-text-secondary, #45505f); }
		.prsp-bulk-stats strong { color: var(--theme-color-brand-primary, #156dd1); font-size: 1.05rem; }
		.prsp-bulk-apply { display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer; font: inherit; font-size: 0.92rem; font-weight: 600;
			padding: 0.5rem 1rem; border-radius: 8px; border: 1px solid var(--theme-color-brand-primary, #156dd1);
			background: var(--theme-color-brand-primary, #156dd1); color: #fff; }
		.prsp-bulk-apply:hover { background: var(--theme-color-brand-primary-hover, #1259ad); }
		.prsp-bulk-apply[disabled] { opacity: 0.5; cursor: not-allowed; }
		.prsp-bulk-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; flex-wrap: wrap; }
		.prsp-bulk-search { flex: 1 1 220px; display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.6rem; border: 1px solid var(--theme-color-border-default, #d7dce3); border-radius: 8px; }
		.prsp-bulk-search-ic { display: inline-flex; color: var(--theme-color-text-muted, #6b7686); font-size: 0.9rem; }
		.prsp-bulk-search input { flex: 1 1 auto; min-width: 0; font: inherit; font-size: 0.9rem; border: none; outline: none; background: transparent; color: var(--theme-color-text-primary, #1f2733); }
		.prsp-bulk-tools { display: flex; align-items: center; gap: 0.6rem; }
		.prsp-bulk-colbtn { display: inline-flex; align-items: center; gap: 0.3rem; cursor: pointer; font: inherit; font-size: 0.78rem; padding: 0.2rem 0.5rem;
			border: 1px solid var(--theme-color-border-default, #d7dce3); border-radius: 6px; background: var(--theme-color-background-panel, #fff); color: var(--theme-color-text-secondary, #45505f); }
		.prsp-bulk-colbtn:hover { background: var(--theme-color-background-tertiary, #eceef2); color: var(--theme-color-text-primary, #1f2733); }
		.prsp-bulk-colchooser-wrap { position: relative; }
		.prsp-bulk-colchooser-backdrop { position: fixed; inset: 0; z-index: 30; display: none; }
		.prsp-bulk-colchooser-wrap.is-open .prsp-bulk-colchooser-backdrop { display: block; }
		.prsp-bulk-colchooser { position: absolute; right: 0; top: 0.3rem; z-index: 40; min-width: 200px; display: none;
			background: var(--theme-color-background-panel, #fff); border: 1px solid var(--theme-color-border-default, #d7dce3); border-radius: 10px; box-shadow: 0 10px 28px rgba(17, 24, 39, 0.14); overflow: hidden; }
		.prsp-bulk-colchooser-wrap.is-open .prsp-bulk-colchooser { display: block; }
		.prsp-bulk-colchooser-list { max-height: 50vh; overflow-y: auto; padding: 0.25rem; }
		.prsp-bulk-colrow { display: flex; align-items: center; gap: 0.5rem; width: 100%; text-align: left; cursor: pointer; font: inherit; font-size: 0.86rem;
			padding: 0.4rem 0.55rem; border: none; border-radius: 6px; background: transparent; color: var(--theme-color-text-primary, #1f2733); }
		.prsp-bulk-colrow:hover { background: var(--theme-color-background-tertiary, #eceef2); }
		.prsp-bulk-colrow-check { flex: 0 0 auto; display: inline-flex; width: 1em; color: var(--theme-color-brand-primary, #156dd1); visibility: hidden; }
		.prsp-bulk-colrow.is-on .prsp-bulk-colrow-check { visibility: visible; }
		.prsp-bulk-colchooser-foot { display: flex; justify-content: flex-end; padding: 0.35rem 0.5rem; border-top: 1px solid var(--theme-color-border-light, #e8ebf0); }
		.prsp-bulk-colreset { font: inherit; font-size: 0.8rem; cursor: pointer; border: none; background: transparent; color: var(--theme-color-text-muted, #6b7686); padding: 0.15rem 0.3rem; border-radius: 5px; }
		.prsp-bulk-tablewrap { max-height: 56vh; overflow: auto; border: 1px solid var(--theme-color-border-light, #e8ebf0); border-radius: 8px; }
		.prsp-rtbl { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
		.prsp-rtbl thead th { position: sticky; top: 0; z-index: 1; text-align: left; padding: 0.5rem 0.6rem; background: var(--theme-color-background-tertiary, #eceef2);
			color: var(--theme-color-text-secondary, #45505f); font-size: 0.72rem; font-weight: 650; text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap; }
		.prsp-rtbl-th-check { width: 1.8rem; text-align: center; cursor: pointer; }
		.prsp-rtbl-row { cursor: pointer; border-top: 1px solid var(--theme-color-border-light, #e8ebf0); }
		.prsp-rtbl-row:hover { background: var(--theme-color-background-tertiary, #eceef2); }
		.prsp-rtbl-row.is-selected { background: color-mix(in srgb, var(--theme-color-brand-primary, #156dd1) 9%, transparent); }
		.prsp-rtbl-row td { padding: 0.4rem 0.6rem; color: var(--theme-color-text-primary, #1f2733); max-width: 22rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
		.prsp-rtbl-td-check { width: 1.8rem; text-align: center; }
		.prsp-rtbl-check { display: inline-flex; color: var(--theme-color-brand-primary, #156dd1); visibility: hidden; }
		.prsp-rtbl-row.is-selected .prsp-rtbl-check { visibility: visible; }
		.prsp-rtbl-headcheck { display: inline-flex; color: var(--theme-color-text-muted, #6b7686); }
		.prsp-bulk-more { display: block; width: 100%; padding: 0.45rem; cursor: pointer; font: inherit; font-size: 0.85rem; border: none; border-top: 1px solid var(--theme-color-border-light, #e8ebf0);
			background: var(--theme-color-background-tertiary, #eceef2); color: var(--theme-color-text-secondary, #45505f); }
		.prsp-bulk-more:hover { background: var(--theme-color-background-selected, #e3edfb); color: var(--theme-color-brand-primary, #156dd1); }
		.prsp-bulk-empty { padding: 0.9rem; color: var(--theme-color-text-muted, #6b7686); font-size: 0.9rem; font-style: italic; text-align: center; }
		`,
		CSSPriority: 500,

		Templates:
		[
			{
				Hash: 'PRSP-AssociateBulk-Template',
				Template: /*html*/`
		<!-- DefaultPackage pict view template: [PRSP-AssociateBulk-Template] -->
		<div class="prsp-bulk">
			<div class="prsp-bulk-header">
				<h2>{~D:Record.Title~}</h2>
				<p class="prsp-bulk-sub">{~D:Record.Subtitle~}</p>
			</div>
			<div class="prsp-bulk-card">
				<span class="prsp-bulk-card-label">{~D:Record.AnchorLabel~}</span>
				<div class="prsp-bulk-picker-host" id="{~D:Record.AnchorPickerHostID~}"></div>
				{~NE:Record.PickerMissing^<div class="prsp-bulk-note">The entity picker (pict-section-picker) is not registered, so the anchor cannot be chosen.</div>~}
			</div>
			{~TS:PRSP-AssociateBulk-Hint:Record.HintSlot~}
			{~TS:PRSP-AssociateBulk-Body:Record.BodySlot~}
		</div>
		<!-- DefaultPackage end view template:  [PRSP-AssociateBulk-Template] -->
	`
			},
			{
				Hash: 'PRSP-AssociateBulk-Hint',
				Template: /*html*/`<div class="prsp-bulk-hint">{~D:Record.Hint~}</div>`
			},
			{
				Hash: 'PRSP-AssociateBulk-Body',
				Template: /*html*/`
		<div class="prsp-bulk-bar">
			<div class="prsp-bulk-stats" id="{~D:Record.StatsID~}"></div>
			<button type="button" class="prsp-bulk-apply" id="{~D:Record.ApplyButtonID~}" onclick="_Pict.views['RSP-RecordSet-Associate'].applyReconcile()">{~I:Check~} Apply changes</button>
		</div>
		<div class="prsp-bulk-card">
			<div class="prsp-bulk-toolbar">
				<div class="prsp-bulk-search">
					<span class="prsp-bulk-search-ic">{~I:Search~}</span>
					<input type="text" placeholder="Search {~D:Record.OtherLabel~}…" autocomplete="off" oninput="_Pict.views['RSP-RecordSet-Associate'].searchSide(this.value)">
				</div>
				<div class="prsp-bulk-tools">
					<div class="prsp-bulk-colchooser-wrap" id="{~D:Record.ChooserID~}_Wrap">
						<button type="button" class="prsp-bulk-colbtn" title="Choose columns" onclick="_Pict.views['RSP-RecordSet-Associate'].toggleColumnChooser()">{~I:Settings~} Columns</button>
						<div class="prsp-bulk-colchooser-backdrop" onclick="_Pict.views['RSP-RecordSet-Associate'].closeColumnChooser()"></div>
						<div class="prsp-bulk-colchooser" id="{~D:Record.ChooserID~}"></div>
					</div>
				</div>
			</div>
			<div class="prsp-bulk-tablewrap"><div id="{~D:Record.TableID~}"></div></div>
		</div>
	`
			},
			{
				Hash: 'PRSP-AssociateBulk-Table',
				Template: /*html*/`
		<table class="prsp-rtbl">
			<thead><tr><th class="prsp-rtbl-th-check" title="Select all loaded" onclick="_Pict.views['RSP-RecordSet-Associate'].toggleSelectAll()"><span class="prsp-rtbl-headcheck">{~D:Record.SelectAllIcon~}</span></th>{~TS:PRSP-AssociateBulk-HeaderCell:Record.Columns~}</tr></thead>
			<tbody>{~TS:PRSP-AssociateBulk-Row:Record.Rows~}</tbody>
		</table>
		{~TS:PRSP-AssociateBulk-Empty:Record.EmptySlot~}
		{~TS:PRSP-AssociateBulk-More:Record.MoreSlot~}
	`
			},
			{
				Hash: 'PRSP-AssociateBulk-HeaderCell',
				Template: /*html*/`<th>{~D:Record.DisplayName~}</th>`
			},
			{
				Hash: 'PRSP-AssociateBulk-Row',
				Template: /*html*/`<tr id="{~D:Record.RowID~}" class="prsp-rtbl-row{~NE:Record.Selected^ is-selected~}" onclick="_Pict.views['RSP-RecordSet-Associate'].toggleRow('{~D:Record.OtherID~}')"><td class="prsp-rtbl-td-check"><span class="prsp-rtbl-check">{~I:Check~}</span></td>{~TS:PRSP-AssociateBulk-Cell:Record.Cells~}</tr>`
			},
			{
				Hash: 'PRSP-AssociateBulk-Cell',
				Template: /*html*/`<td title="{~D:Record.Value~}">{~D:Record.Value~}</td>`
			},
			{
				Hash: 'PRSP-AssociateBulk-Empty',
				Template: /*html*/`<div class="prsp-bulk-empty">{~D:Record.EmptyText~}</div>`
			},
			{
				Hash: 'PRSP-AssociateBulk-More',
				Template: /*html*/`<button type="button" class="prsp-bulk-more" onclick="_Pict.views['RSP-RecordSet-Associate'].loadMore()">Load more</button>`
			},
			{
				Hash: 'PRSP-AssociateBulk-Chooser',
				Template: /*html*/`
		<div class="prsp-bulk-colchooser-list">{~TS:PRSP-AssociateBulk-ColRow:Record.Rows~}</div>
		<div class="prsp-bulk-colchooser-foot"><button type="button" class="prsp-bulk-colreset" onclick="_Pict.views['RSP-RecordSet-Associate'].resetColumns()">Reset to defaults</button></div>
	`
			},
			{
				Hash: 'PRSP-AssociateBulk-ColRow',
				Template: /*html*/`<button type="button" class="prsp-bulk-colrow{~NE:Record.Visible^ is-on~}" onclick="_Pict.views['RSP-RecordSet-Associate'].toggleColumn('{~D:Record.Key~}')"><span class="prsp-bulk-colrow-check">{~I:Check~}</span><span>{~D:Record.DisplayName~}</span></button>`
			}
		],

		Renderables:
		[
			{
				RenderableHash: 'PRSP_Renderable_AssociateBulk',
				TemplateHash: 'PRSP-AssociateBulk-Template',
				ContentDestinationAddress: '#PRSP_Container',
				RenderMethod: 'replace'
			}
		],

		Manifests: {}
	});

class viewRecordSetAssociateBulk extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DEFAULT_CONFIGURATION_AssociateBulk, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		/** @type {import('pict') & { PictSectionRecordSet: any }} */
		this.pict;

		this._anchorRecordSet = null;
		this._associationHash = null;
		this._anchorID = null;
		this._thisSide = null;
		this._otherSide = null;
		this._otherRecords = [];    // the loaded page(s) of other-side records to reconcile
		this._cursor = 0;           // record offset for paging
		this._hasMore = false;
		this._search = '';
		this._searchTimer = null;
		this._selected = {};        // String(OtherID) -> true : the CURRENT checked state, spans pages
		this._originalLinked = {};  // String(OtherID) -> joinRecord : snapshot of what was linked at load
	}

	/** @return {any} The association manager provider. */
	get manager()
	{
		return this.pict.providers.RecordSetAssociationManager;
	}

	/** @return {any} The column-visibility persistence provider (localStorage; host-overridable). */
	get columnProvider()
	{
		return this.pict.providers.ColumnDataProvider;
	}

	/** @return {number} The other-side page size for the reconcile table. */
	_pageSize()
	{
		return this.options.ReconcilePageSize || 50;
	}

	addRoutes(pPictRouter)
	{
		pPictRouter.router.on('/PSRS/:RecordSet/Associate/:Association/:AnchorID', this.handleAssociateRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/Associate/:Association', this.handleAssociateRoute.bind(this));
		return true;
	}

	/**
	 * Route handler — parse the anchor recordset, association, and optional preset anchor id, then paint.
	 * @param {Record<string, any>} pRoutePayload
	 */
	handleAssociateRoute(pRoutePayload)
	{
		if (typeof(pRoutePayload) != 'object')
		{
			throw new Error(`Pict RecordSet Associate route handler called with invalid route payload.`);
		}
		this._anchorRecordSet = pRoutePayload.data.RecordSet;
		this._associationHash = pRoutePayload.data.Association;
		this._anchorID = (pRoutePayload.data.AnchorID !== undefined && pRoutePayload.data.AnchorID !== '') ? pRoutePayload.data.AnchorID : null;

		// Use the recordset's RecordSetBulkAssociations Title (the opt-in label) as the screen title.
		this.options.ScreenTitle = false;
		const tmpRecordSetConfiguration = this.pict.PictSectionRecordSet
			? this.pict.PictSectionRecordSet.recordSetProviderConfigurations[this._anchorRecordSet] : null;
		const tmpBulkConfiguration = (tmpRecordSetConfiguration && Array.isArray(tmpRecordSetConfiguration.RecordSetBulkAssociations))
			? tmpRecordSetConfiguration.RecordSetBulkAssociations.find((pEntry) => pEntry.Association === this._associationHash) : null;
		if (tmpBulkConfiguration && tmpBulkConfiguration.Title)
		{
			this.options.ScreenTitle = tmpBulkConfiguration.Title;
		}

		return this.renderScreen();
	}

	/** A DOM/address-safe key for this screen's pickers + table. */
	get safeKey()
	{
		return `${String(this._anchorRecordSet)}_${String(this._associationHash)}`.replace(/[^A-Za-z0-9]/g, '_');
	}

	/** @return {string} */
	_anchorLabel() { return this._thisSide ? (this._thisSide.Title || this._thisSide.RecordSet || this._thisSide.Entity) : ''; }
	/** @return {string} */
	_otherLabel() { return this._otherSide ? (this._otherSide.Title || this._otherSide.RecordSet || this._otherSide.Entity) : ''; }

	/** Persistence scope for this association's other-side column visibility (distinct from list/matrix). */
	_columnScope() { return `Reconcile_${this._associationHash}_${this._otherSide && this._otherSide.RecordSet}`; }

	/**
	 * Load the anchor's current links (seeding the checked state + link snapshot), fetch the first page of
	 * the other side, paint the screen, and mount the anchor picker + reconcile table.
	 * @return {Promise<boolean>}
	 */
	async renderScreen()
	{
		const tmpSides = this.manager ? this.manager.resolveSides(this._associationHash, this._anchorRecordSet) : false;
		if (!tmpSides)
		{
			this.pict.log.warn(`AssociateBulk: association [${this._associationHash}] could not be resolved for [${this._anchorRecordSet}].`);
			return false;
		}
		this._thisSide = tmpSides.thisSide;
		this._otherSide = tmpSides.otherSide;
		// A fresh shell renders an empty search box, so start from an empty search term to stay in sync.
		this._search = '';

		const tmpHasAnchor = (this._anchorID !== undefined && this._anchorID !== null && this._anchorID !== '');

		// Seed the checked state + link snapshot from the anchor's current associations (ALL of them, not
		// just the first page), so a linked record on a page the user never scrolls to is still handled.
		this._selected = {};
		this._originalLinked = {};
		this._otherRecords = [];
		this._cursor = 0;
		this._hasMore = false;
		if (tmpHasAnchor)
		{
			const tmpItems = await this.manager.listAssociatedRecords(this._associationHash, this._anchorRecordSet, this._anchorID);
			for (let i = 0; i < tmpItems.length; i++)
			{
				const tmpKey = String(tmpItems[i].OtherID);
				this._originalLinked[tmpKey] = tmpItems[i].JoinRecord;
				this._selected[tmpKey] = true;
			}
			await this._fetchPage(true);
		}

		const tmpAnchorLabel = this._anchorLabel();
		const tmpOtherLabel = this._otherLabel();

		const tmpBodyData = {
			OtherLabel: tmpOtherLabel,
			StatsID: `${this.safeKey}_Stats`,
			ApplyButtonID: `${this.safeKey}_Apply`,
			ChooserID: `${this.safeKey}_Chooser`,
			TableID: `${this.safeKey}_Table`,
		};

		const tmpRecord =
		{
			Title: this.options.ScreenTitle || `Assign ${tmpOtherLabel} to a ${this._singular(tmpAnchorLabel)}`,
			Subtitle: `Pick one of the ${tmpAnchorLabel}, then check the ${tmpOtherLabel} it should be linked to. Applying adds the newly-checked and removes the unchecked.`,
			AnchorLabel: `${tmpAnchorLabel}`,
			AnchorPickerHostID: `${this.safeKey}_Anchor`,
			PickerMissing: !this.pict.providers['Pict-Section-Picker'],
			HintSlot: tmpHasAnchor ? [] : [ { Hint: `Choose one of the ${tmpAnchorLabel} above to begin.` } ],
			BodySlot: tmpHasAnchor ? [ tmpBodyData ] : [],
		};

		return new Promise((resolve) =>
		{
			this.renderAsync(this.options.DefaultRenderable, this.options.DefaultDestinationAddress, tmpRecord,
				(pError) =>
				{
					if (pError)
					{
						this.pict.log.error(`AssociateBulk: render error.`, pError);
						return resolve(false);
					}
					this._mountAnchorPicker(tmpSides, tmpRecord.AnchorPickerHostID);
					if (tmpHasAnchor)
					{
						this._renderTable();
						this.updateStats();
					}
					this.pict.CSSMap.injectCSS();
					return resolve(true);
				});
		});
	}

	/**
	 * Fetch one page of the OTHER side's records (search + offset paging). Reuses fetchSidePage by passing
	 * the OTHER side's RecordSet name so it resolves that side as "this side".
	 * @param {boolean} pReset - reset the offset + replace the loaded records (vs append the next page).
	 * @return {Promise<void>}
	 */
	async _fetchPage(pReset)
	{
		if (pReset) { this._cursor = 0; }
		const tmpResult = await this.manager.fetchSidePage(this._associationHash, this._otherSide.RecordSet, this._search, this._cursor, this._pageSize());
		this._otherRecords = pReset ? tmpResult.records : this._otherRecords.concat(tmpResult.records);
		this._hasMore = tmpResult.hasMore;
	}

	/**
	 * Mount the anchor (this side) picker — single select, preselected to the current anchor.
	 * @param {Record<string, any>} pSides @param {string} pHostID
	 */
	_mountAnchorPicker(pSides, pHostID)
	{
		const tmpPickerProvider = this.pict.providers['Pict-Section-Picker'];
		if (!tmpPickerProvider)
		{
			return;
		}
		const tmpPickerHash = `${this.safeKey}_AnchorPicker`;
		const tmpValueAddress = `AppData.PRSPBulkAnchor.${this.safeKey}`;

		const tmpConfig = this.manager.buildAnchorPickerConfig(this._associationHash, this._anchorRecordSet,
			{
				DestinationAddress: `#${pHostID}`,
				ValueAddress: tmpValueAddress,
				Placeholder: `Search ${pSides.thisSide.Title || pSides.thisSide.RecordSet || pSides.thisSide.Entity}…`,
				OnChange: (pValue) => { this.selectAnchor(pValue); },
			});
		if (!tmpConfig)
		{
			return;
		}
		tmpPickerProvider.createEntityPicker(tmpPickerHash, tmpConfig);
		// setValue (not render) so the picker (re)seeds + resolves the preset anchor's display without
		// firing OnChange (which would loop back into selectAnchor).
		this.pict.views[tmpPickerHash].setValue((this._anchorID !== undefined && this._anchorID !== null) ? this._anchorID : null);
	}

	/**
	 * The anchor picker's OnChange — switch the anchor and repaint (loads its current links + first page).
	 * @param {string|number} pAnchorID
	 * @return {Promise<void>}
	 */
	async selectAnchor(pAnchorID)
	{
		this._anchorID = (pAnchorID !== undefined && pAnchorID !== '') ? pAnchorID : null;
		await this.renderScreen();
	}

	/** Effective visibility for a column (stored override wins, else `!DefaultHidden`). */
	_isColumnVisible(pCol)
	{
		const tmpOverrides = this.columnProvider ? this.columnProvider.getColumnVisibilityOverrides(this._columnScope(), 'Reconcile') : {};
		if (tmpOverrides && Object.prototype.hasOwnProperty.call(tmpOverrides, pCol.Key))
		{
			return tmpOverrides[pCol.Key] === true;
		}
		return !pCol.DefaultHidden;
	}

	/** @return {Array<Record<string, any>>} The currently-visible other-side columns. */
	_visibleColumns()
	{
		return this._otherSide.TableColumns.filter((pCol) => this._isColumnVisible(pCol));
	}

	/** Build the row models for the loaded other-side records (pre-checking current links) and render the table. */
	_renderTable()
	{
		const tmpColumns = this._visibleColumns();
		const tmpIDField = this._otherSide.IDField;
		const tmpRows = this._otherRecords.map((pRecord) =>
		{
			const tmpID = pRecord[tmpIDField];
			return {
				OtherID: tmpID,
				RowID: `${this.safeKey}_row_${tmpID}`,
				Selected: !!this._selected[String(tmpID)],
				Cells: tmpColumns.map((pCol) => ({ Value: pCol.Template ? this.pict.parseTemplate(pCol.Template, pRecord) : pRecord[pCol.Key] })),
			};
		});
		const tmpAllSelected = (tmpRows.length > 0 && tmpRows.every((pRow) => pRow.Selected));
		const tmpTableRecord = {
			Columns: tmpColumns.map((pCol) => ({ DisplayName: pCol.DisplayName })),
			Rows: tmpRows,
			SelectAllIcon: this.pict.icon(tmpAllSelected ? 'Check' : 'Minus'),
			EmptySlot: (tmpRows.length === 0) ? [ { EmptyText: this._search ? `No ${this._otherLabel()} match the search.` : `No ${this._otherLabel()} found.` } ] : [],
			MoreSlot: this._hasMore ? [ {} ] : [],
		};
		const tmpHTML = this.pict.parseTemplateByHash('PRSP-AssociateBulk-Table', tmpTableRecord);
		this.pict.ContentAssignment.assignContent(`#${this.safeKey}_Table`, tmpHTML);
	}

	/** Debounced server-side search of the other side (resets to page 0). @param {string} pTerm */
	searchSide(pTerm)
	{
		this._search = pTerm;
		if (this._searchTimer) { clearTimeout(this._searchTimer); }
		this._searchTimer = setTimeout(async () =>
		{
			await this._fetchPage(true);
			this._renderTable();
		}, 250);
	}

	/** Load the next page of the other side and append it. @return {Promise<void>} */
	async loadMore()
	{
		this._cursor += this._pageSize();
		await this._fetchPage(false);
		this._renderTable();
	}

	/**
	 * Toggle a row's checked state (the row click). Updates the selection map + row class + stats.
	 * @param {string|number} pOtherID
	 */
	toggleRow(pOtherID)
	{
		const tmpKey = String(pOtherID);
		if (this._selected[tmpKey]) { delete this._selected[tmpKey]; }
		else { this._selected[tmpKey] = true; }
		const tmpRowElements = this.pict.ContentAssignment.getElement(`#${this.safeKey}_row_${pOtherID}`);
		if (tmpRowElements && tmpRowElements.length > 0)
		{
			tmpRowElements[0].classList.toggle('is-selected', !!this._selected[tmpKey]);
		}
		this.updateStats();
	}

	/**
	 * Select / clear all the LOADED rows (the header checkbox). Only affects records currently loaded — a
	 * linked record on an un-loaded page is left untouched (it stays in the selection/link maps), so this
	 * never silently unlinks something off-screen.
	 */
	toggleSelectAll()
	{
		const tmpIDField = this._otherSide.IDField;
		const tmpAllSelected = (this._otherRecords.length > 0 && this._otherRecords.every((pRecord) => this._selected[String(pRecord[tmpIDField])]));
		for (let i = 0; i < this._otherRecords.length; i++)
		{
			const tmpKey = String(this._otherRecords[i][tmpIDField]);
			if (tmpAllSelected) { delete this._selected[tmpKey]; }
			else { this._selected[tmpKey] = true; }
		}
		this._renderTable();
		this.updateStats();
	}

	/**
	 * Diff the current checked state against the link snapshot: `toCreate` are ids checked now but not
	 * originally linked; `toRemove` are the join records originally linked but now unchecked. Iterating the
	 * MAPS (not the rendered rows) is what makes an off-screen linked row a correct no-op.
	 * @return {{ toCreate: Array<string>, toRemove: Array<Record<string, any>> }}
	 */
	_computeReconcileDiff()
	{
		const tmpToCreate = [];
		const tmpToRemove = [];
		for (const tmpKey of Object.keys(this._selected))
		{
			if (this._selected[tmpKey] && !this._originalLinked[tmpKey]) { tmpToCreate.push(tmpKey); }
		}
		for (const tmpKey of Object.keys(this._originalLinked))
		{
			if (!this._selected[tmpKey]) { tmpToRemove.push(this._originalLinked[tmpKey]); }
		}
		return { toCreate: tmpToCreate, toRemove: tmpToRemove };
	}

	/** Recompute the pending-change stats line + the Apply button's enabled state. */
	updateStats()
	{
		const tmpDiff = this._computeReconcileDiff();
		const tmpAdd = tmpDiff.toCreate.length;
		const tmpRemove = tmpDiff.toRemove.length;
		this.pict.ContentAssignment.assignContent(`#${this.safeKey}_Stats`,
			`<strong>${tmpAdd}</strong> to add &middot; <strong>${tmpRemove}</strong> to remove`);
		const tmpButtonElements = this.pict.ContentAssignment.getElement(`#${this.safeKey}_Apply`);
		if (tmpButtonElements && tmpButtonElements.length > 0)
		{
			tmpButtonElements[0].disabled = ((tmpAdd + tmpRemove) < 1);
		}
	}

	/**
	 * Apply the staged changes — create the newly-checked joins and remove the newly-unchecked ones (confirm
	 * via the host modal), then repaint (which re-seeds from the now-current links, self-healing any partial
	 * failure).
	 * @return {Promise<void>}
	 */
	async applyReconcile()
	{
		if (this._anchorID === undefined || this._anchorID === null || this._anchorID === '')
		{
			return;
		}
		const tmpDiff = this._computeReconcileDiff();
		if (tmpDiff.toCreate.length < 1 && tmpDiff.toRemove.length < 1)
		{
			this._toast('No changes to apply.', 'info');
			return;
		}

		const tmpModal = this.pict.views['Pict-Section-Modal'];
		if (tmpModal && typeof tmpModal.confirm === 'function')
		{
			const tmpOk = await tmpModal.confirm(`Add ${tmpDiff.toCreate.length} and remove ${tmpDiff.toRemove.length} ${this._otherLabel()}?`,
				{ title: 'Apply changes', confirmLabel: 'Apply', cancelLabel: 'Cancel', dangerous: (tmpDiff.toRemove.length > 0) });
			if (!tmpOk)
			{
				return;
			}
		}

		let tmpCreated = 0;
		let tmpRemoved = 0;
		let tmpFailed = 0;
		for (let i = 0; i < tmpDiff.toCreate.length; i++)
		{
			try
			{
				await this.manager.createJoin(this._associationHash, this._anchorRecordSet, this._anchorID, tmpDiff.toCreate[i]);
				tmpCreated++;
			}
			catch (pError)
			{
				tmpFailed++;
				this.pict.log.error(`AssociateBulk: failed to create join for ${tmpDiff.toCreate[i]}.`, pError);
			}
		}
		for (let i = 0; i < tmpDiff.toRemove.length; i++)
		{
			try
			{
				await this.manager.removeJoin(this._associationHash, tmpDiff.toRemove[i]);
				tmpRemoved++;
			}
			catch (pError)
			{
				tmpFailed++;
				this.pict.log.error(`AssociateBulk: failed to remove a join.`, pError);
			}
		}
		this._toast(`Added ${tmpCreated}, removed ${tmpRemoved}${tmpFailed > 0 ? `, ${tmpFailed} failed` : ''}.`, tmpFailed > 0 ? 'error' : 'success');

		await this.renderScreen();
	}

	// --- Column chooser (mirrors the unlink/matrix screens, scoped per association's other side) ---

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
		const tmpRows = this._otherSide.TableColumns.map((pCol) => ({ Key: pCol.Key, DisplayName: pCol.DisplayName, Visible: this._isColumnVisible(pCol) }));
		const tmpHTML = this.pict.parseTemplateByHash('PRSP-AssociateBulk-Chooser', { Rows: tmpRows });
		this.pict.ContentAssignment.assignContent(`#${this.safeKey}_Chooser`, tmpHTML);
	}

	/** Toggle one column's visibility (persisted; refuses to hide the last visible column). @param {string} pKey */
	toggleColumn(pKey)
	{
		if (!this.columnProvider) { return; }
		const tmpCol = this._otherSide.TableColumns.find((pCol) => String(pCol.Key) === String(pKey));
		if (!tmpCol) { return; }
		const tmpVisible = this._isColumnVisible(tmpCol);
		if (tmpVisible && this._visibleColumns().length <= 1) { return; }
		this.columnProvider.setColumnVisibilityOverride(this._columnScope(), 'Reconcile', pKey, !tmpVisible);
		this._renderTable();
		this._renderColumnChooser();
	}

	/** Clear column overrides — back to developer defaults. */
	resetColumns()
	{
		if (this.columnProvider) { this.columnProvider.clearColumnVisibilityOverrides(this._columnScope(), 'Reconcile'); }
		this._renderTable();
		this._renderColumnChooser();
	}

	/** Crude singularizer ("Books" -> "Book"). */
	_singular(pLabel)
	{
		return (typeof pLabel === 'string' && pLabel.length > 1 && pLabel.slice(-1).toLowerCase() === 's') ? pLabel.slice(0, -1) : pLabel;
	}

	/**
	 * Non-blocking notification via the host modal's toast, when available.
	 * @param {string} pMessage @param {string} pType
	 */
	_toast(pMessage, pType)
	{
		const tmpModal = this.pict.views['Pict-Section-Modal'];
		if (tmpModal && typeof tmpModal.toast === 'function')
		{
			tmpModal.toast(pMessage, { type: pType || 'info' });
		}
	}
}

module.exports = viewRecordSetAssociateBulk;

module.exports.default_configuration = _DEFAULT_CONFIGURATION_AssociateBulk;
