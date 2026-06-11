const libPictView = require('pict-view');

/**
 * The list's column chooser: a small right-aligned "Columns" button above the table that opens a
 * popover of checkbox rows — the host-curated columns first, then the entity's remaining scalar
 * schema columns — letting the user show/hide columns per record set. Choices persist through the
 * ColumnDataProvider and repaint body-only through the list view (the filter bar is never touched).
 *
 * Renders nothing unless the active record set's configuration sets RecordSetListColumnChooser: true
 * (the list view only populates Record.ColumnChooserSlot when the flag is on).
 */

/** @type {Record<string, any>} */
const _DEFAULT_CONFIGURATION_List_ColumnChooser = (
	{
		ViewIdentifier: 'PRSP-List-ColumnChooser',

		DefaultRenderable: 'PRSP_Renderable_ColumnChooser',
		DefaultDestinationAddress: '#PRSP_ColumnChooser_Container',
		DefaultTemplateRecordAddress: false,

		AutoInitialize: false,
		AutoInitializeOrdinal: 0,

		AutoRender: false,
		AutoRenderOrdinal: 0,

		AutoSolveWithApp: false,
		AutoSolveOrdinal: 0,

		// Mirrors the add-filter popover chrome (fixed + JS-positioned so no ancestor overflow can
		// clip it; transparent backdrop catches outside clicks) with its own class namespace.
		CSS: /*css*/`
	.prsp-colchooser-bar { display: flex; justify-content: flex-end; margin: 0 0 0.35rem; }
	.prsp-colchooser-trigger { display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; font: inherit; font-size: 0.88rem;
		padding: 0.3rem 0.65rem; border: 1px solid var(--theme-color-border-default, #d7dce3); border-radius: 7px;
		background: var(--theme-color-background-panel, #fff); color: var(--theme-color-text-secondary, #45505f); }
	.prsp-colchooser-trigger:hover { background: var(--theme-color-background-tertiary, #eceef2); color: var(--theme-color-text-primary, #1f2733); }
	.prsp-colchooser-pop { position: fixed; z-index: 30; min-width: 260px; max-width: 340px; display: none; }
	.prsp-colchooser-pop.open { display: block; }
	.prsp-colchooser-backdrop { position: fixed; inset: 0; z-index: 0; }
	.prsp-colchooser-panel { position: relative; z-index: 1; display: flex; flex-direction: column; max-height: min(70vh, 460px);
		background: var(--theme-color-background-panel, #fff); border: 1px solid var(--theme-color-border-default, #d7dce3);
		border-radius: 10px; box-shadow: 0 10px 28px rgba(17, 24, 39, 0.14); overflow: hidden; }
	.prsp-colchooser-search { flex: 0 0 auto; display: flex; align-items: center; gap: 0.4rem; padding: 0.5rem 0.7rem; border-bottom: 1px solid var(--theme-color-border-light, #e8ebf0); }
	.prsp-colchooser-search-ic { display: inline-flex; color: var(--theme-color-text-muted, #6b7686); font-size: 0.9rem; }
	.prsp-colchooser-search input { flex: 1 1 auto; min-width: 0; font: inherit; font-size: 0.9rem; border: none; outline: none; background: transparent; color: var(--theme-color-text-primary, #1f2733); }
	.prsp-colchooser-list { flex: 1 1 auto; overflow-y: auto; padding: 0.25rem 0; }
	.prsp-colchooser-empty { padding: 0.7rem 0.8rem; color: var(--theme-color-text-muted, #6b7686); font-size: 0.86rem; }
	.prsp-colchooser-group { padding: 0.45rem 0.8rem 0.2rem; font-size: 0.72rem; font-weight: 650; letter-spacing: 0.04em; text-transform: uppercase; color: var(--theme-color-text-muted, #6b7686); }
	.prsp-colchooser-row { display: flex; align-items: center; gap: 0.5rem; width: 100%; font: inherit; font-size: 0.9rem; text-align: left; cursor: pointer;
		padding: 0.4rem 0.8rem; border: none; background: transparent; color: var(--theme-color-text-primary, #1f2733); }
	.prsp-colchooser-row:hover { background: var(--theme-color-background-tertiary, #eceef2); }
	.prsp-colchooser-check { display: inline-flex; flex: 0 0 auto; font-size: 0.85rem; color: var(--theme-color-brand-primary, #156dd1); visibility: hidden; }
	.prsp-colchooser-row.is-checked .prsp-colchooser-check { visibility: visible; }
	.prsp-colchooser-footer { flex: 0 0 auto; display: flex; justify-content: flex-end; padding: 0.45rem 0.7rem; border-top: 1px solid var(--theme-color-border-light, #e8ebf0); }
	.prsp-colchooser-reset { font: inherit; font-size: 0.84rem; cursor: pointer; border: none; background: transparent; color: var(--theme-color-text-muted, #6b7686); padding: 0.15rem 0.3rem; border-radius: 5px; }
	.prsp-colchooser-reset:hover { color: var(--theme-color-text-primary, #1f2733); background: var(--theme-color-background-tertiary, #eceef2); }
	`,
		CSSPriority: 500,

		Templates:
		[
			{
				// The {~V:~} slot in PRSP-List-Template renders this with the full list data as Record;
				// the one-or-zero-element ColumnChooserSlot array gates the whole control on the
				// RecordSetListColumnChooser flag with no JS branch.
				Hash: 'PRSP-List-ColumnChooser-Template',
				Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-List-ColumnChooser-Template] -->
	{~TS:PRSP-List-ColumnChooser-Button:Record.ColumnChooserSlot~}
	<!-- DefaultPackage end view template:  [PRSP-List-ColumnChooser-Template] -->
`
			},
			{
				Hash: 'PRSP-List-ColumnChooser-Button',
				Template: /*html*/`
	<div class="prsp-colchooser-bar">
		<button type="button" class="prsp-colchooser-trigger" id="PRSP_ColumnChooser_Trigger" title="Choose which columns to show" onclick="_Pict.views['PRSP-List-ColumnChooser'].toggleColumnChooser(event, '{~D:Record.RecordSet~}')">{~I:Settings~} Columns</button>
		<div class="prsp-colchooser-pop" id="PRSP_ColumnChooser_Popover"></div>
	</div>
`
			},
			{
				Hash: 'PRSP-ColumnChooser-Popover',
				Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-ColumnChooser-Popover] -->
	<div class="prsp-colchooser-backdrop" onclick="_Pict.views['PRSP-List-ColumnChooser'].closeColumnChooser()"></div>
	<div class="prsp-colchooser-panel">
		<div class="prsp-colchooser-search">
			<span class="prsp-colchooser-search-ic">{~I:Search~}</span>
			<input type="text" id="PRSP_ColumnChooser_Search" placeholder="Search columns…" autocomplete="off" value="{~D:AppData.PRSPColumnChooser.Search~}" oninput="_Pict.views['PRSP-List-ColumnChooser'].searchColumnChooser(this.value)" onkeydown="if (event.key === 'Escape') { event.preventDefault(); _Pict.views['PRSP-List-ColumnChooser'].closeColumnChooser(); }">
		</div>
		<div class="prsp-colchooser-list" id="PRSP_ColumnChooser_List">
			{~T:PRSP-ColumnChooser-List~}
		</div>
		<div class="prsp-colchooser-footer">
			<button type="button" class="prsp-colchooser-reset" onclick="_Pict.views['PRSP-List-ColumnChooser'].resetColumns()">Reset to defaults</button>
		</div>
	</div>
	<!-- DefaultPackage end view template: [PRSP-ColumnChooser-Popover] -->
`
			},
			{
				Hash: 'PRSP-ColumnChooser-List',
				Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-ColumnChooser-List] -->
	{~TS:PRSP-ColumnChooser-Row:AppData.PRSPColumnChooser.CuratedRows~}
	{~NE:AppData.PRSPColumnChooser.HasSchemaRows^<div class="prsp-colchooser-group">More columns</div>~}
	{~TS:PRSP-ColumnChooser-Row:AppData.PRSPColumnChooser.SchemaRows~}
	{~NE:AppData.PRSPColumnChooser.HasAuditRows^<div class="prsp-colchooser-group">Audit columns</div>~}
	{~TS:PRSP-ColumnChooser-Row:AppData.PRSPColumnChooser.AuditRows~}
	{~NE:AppData.PRSPColumnChooser.IsEmpty^<div class="prsp-colchooser-empty">No columns found.</div>~}
	<!-- DefaultPackage end view template: [PRSP-ColumnChooser-List] -->
`
			},
			{
				Hash: 'PRSP-ColumnChooser-Row',
				Template: /*html*/`
	<button type="button" class="prsp-colchooser-row {~D:Record.CheckedClass~}" onclick="_Pict.views['PRSP-List-ColumnChooser'].toggleColumn('{~D:Record.Key~}')">
		<span class="prsp-colchooser-check">{~I:Check~}</span>
		<span class="prsp-colchooser-name">{~D:Record.DisplayName~}</span>
	</button>
`
			}
		],

		Renderables:
		[
			{
				RenderableHash: 'PRSP_Renderable_ColumnChooser',
				TemplateHash: 'PRSP-List-ColumnChooser-Template',
				ContentDestinationAddress: '#PRSP_ColumnChooser_Container',
				RenderMethod: 'replace'
			},
			{
				RenderableHash: 'PRSP_ColumnChooser_Popover',
				TemplateHash: 'PRSP-ColumnChooser-Popover',
				ContentDestinationAddress: '#PRSP_ColumnChooser_Popover',
				RenderMethod: 'replace'
			},
			{
				RenderableHash: 'PRSP_ColumnChooser_List',
				TemplateHash: 'PRSP-ColumnChooser-List',
				ContentDestinationAddress: '#PRSP_ColumnChooser_List',
				RenderMethod: 'replace'
			}
		],

		Manifests: {}
	});

class viewRecordSetListColumnChooser extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DEFAULT_CONFIGURATION_List_ColumnChooser, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		this._chooserRecordSet = null;
		this._chooserSearch = '';
	}

	/**
	 * Open/close the chooser popover (the trigger button's handler).
	 *
	 * Open/closed is derived from the popover's DOM class, not an instance flag — a full list
	 * re-render replaces the popover element (visually closed), so a flag would go stale and
	 * demand a double-click to reopen.
	 *
	 * @param {Event} pEvent - The DOM click event
	 * @param {string} pRecordSet - The record set whose columns to manage
	 */
	toggleColumnChooser(pEvent, pRecordSet)
	{
		if (pEvent) { pEvent.preventDefault(); }
		const tmpPopoverElements = this.pict.ContentAssignment.getElement('#PRSP_ColumnChooser_Popover');
		if (tmpPopoverElements.length && tmpPopoverElements[0].classList.contains('open'))
		{
			return this.closeColumnChooser();
		}
		this._chooserRecordSet = pRecordSet;
		this._chooserSearch = '';
		this._buildColumnChooserRows();
		this.render('PRSP_ColumnChooser_Popover', undefined, { RecordSet: pRecordSet });
		this._paintColumnChooserOpenState(true);
	}

	/** Close the chooser popover. */
	closeColumnChooser()
	{
		this._paintColumnChooserOpenState(false);
	}

	/**
	 * Filter the chooser's column list by a search term, re-rendering only the list so the
	 * search input keeps focus.
	 * @param {string} pValue - The search term.
	 */
	searchColumnChooser(pValue)
	{
		this._chooserSearch = pValue || '';
		this._buildColumnChooserRows();
		this.render('PRSP_ColumnChooser_List', undefined, { RecordSet: this._chooserRecordSet });
	}

	/**
	 * Flip a column's visibility (a chooser row's handler). Delegates to the list view — which
	 * persists the override and repaints the rows body-only — then repaints the chooser rows
	 * truthfully (the list view may have refused, e.g. hiding the last visible column).
	 * @param {string} pKey - The column key to toggle.
	 */
	toggleColumn(pKey)
	{
		const tmpListView = this.pict.views['RSP-RecordSet-List'];
		if (!tmpListView || !tmpListView._lastRecordListData || !Array.isArray(tmpListView._lastRecordListData.ColumnCandidates))
		{
			return;
		}
		const tmpCandidate = tmpListView._lastRecordListData.ColumnCandidates.find((pCandidate) => pCandidate.Key === pKey);
		if (!tmpCandidate)
		{
			return;
		}
		const tmpColumnProvider = this.pict.providers.ColumnDataProvider;
		const tmpOverrides = tmpColumnProvider ? tmpColumnProvider.getColumnVisibilityOverrides(this._chooserRecordSet, 'List') : {};
		const tmpCurrentlyVisible = tmpListView._effectiveColumnVisibility(tmpCandidate, tmpOverrides);
		tmpListView.setColumnVisibility(this._chooserRecordSet, pKey, !tmpCurrentlyVisible);
		this._buildColumnChooserRows();
		this.render('PRSP_ColumnChooser_List', undefined, { RecordSet: this._chooserRecordSet });
	}

	/** Clear all overrides for the record set and repaint with default visibility (footer button). */
	resetColumns()
	{
		const tmpListView = this.pict.views['RSP-RecordSet-List'];
		if (!tmpListView)
		{
			return;
		}
		tmpListView.resetColumnVisibility(this._chooserRecordSet);
		this._buildColumnChooserRows();
		this.render('PRSP_ColumnChooser_List', undefined, { RecordSet: this._chooserRecordSet });
	}

	/**
	 * (Re)build the chooser's row models into AppData from the list view's pristine column
	 * candidates (single source of truth) + the current overrides, honouring the search term.
	 */
	_buildColumnChooserRows()
	{
		const tmpListView = this.pict.views['RSP-RecordSet-List'];
		const tmpListData = tmpListView && tmpListView._lastRecordListData;
		const tmpCandidates = (tmpListData && tmpListData.RecordSet === this._chooserRecordSet && Array.isArray(tmpListData.ColumnCandidates))
			? tmpListData.ColumnCandidates : [];
		const tmpColumnProvider = this.pict.providers.ColumnDataProvider;
		const tmpOverrides = tmpColumnProvider ? tmpColumnProvider.getColumnVisibilityOverrides(this._chooserRecordSet, 'List') : {};
		const tmpSearch = (this._chooserSearch || '').toLowerCase();
		const fSearchMatch = (pCandidate) => !tmpSearch || String(pCandidate.DisplayName || pCandidate.Key).toLowerCase().includes(tmpSearch);
		const fMapRow = (pCandidate) => (
			{
				Key: pCandidate.Key,
				DisplayName: pCandidate.DisplayName || pCandidate.Key,
				CheckedClass: tmpListView._effectiveColumnVisibility(pCandidate, tmpOverrides) ? 'is-checked' : '',
			});
		const tmpCuratedRows = tmpCandidates.filter((pCandidate) => pCandidate.Source === 'Curated').filter(fSearchMatch).map(fMapRow);
		const tmpSchemaRows = tmpCandidates.filter((pCandidate) => pCandidate.Source === 'Schema').filter(fSearchMatch).map(fMapRow);
		const tmpAuditRows = tmpCandidates.filter((pCandidate) => pCandidate.Source === 'Audit').filter(fSearchMatch).map(fMapRow);
		this.pict.AppData.PRSPColumnChooser =
		{
			RecordSet: this._chooserRecordSet,
			Search: this._chooserSearch || '',
			CuratedRows: tmpCuratedRows,
			SchemaRows: tmpSchemaRows,
			AuditRows: tmpAuditRows,
			// A group divider only earns its place when rows are showing above it.
			HasSchemaRows: (tmpSchemaRows.length > 0) && (tmpCuratedRows.length > 0),
			HasAuditRows: (tmpAuditRows.length > 0) && ((tmpCuratedRows.length + tmpSchemaRows.length) > 0),
			IsEmpty: (tmpCuratedRows.length + tmpSchemaRows.length + tmpAuditRows.length) === 0,
		};
	}

	/**
	 * Reflect the popover's open/closed state on its container element.
	 * @param {boolean} pOpen - Whether the popover should be open.
	 */
	_paintColumnChooserOpenState(pOpen)
	{
		const tmpPopoverElements = this.pict.ContentAssignment.getElement('#PRSP_ColumnChooser_Popover');
		if (!tmpPopoverElements.length)
		{
			return;
		}
		tmpPopoverElements[0].classList.toggle('open', !!pOpen);
		if (pOpen)
		{
			this._positionColumnChooserPopover(tmpPopoverElements[0]);
		}
	}

	/**
	 * Position the (fixed) popover against the trigger button, flipping above when there's more
	 * room there — same approach as the filters view's add-filter popover, so no ancestor
	 * overflow:hidden can clip it.
	 *
	 * @param {HTMLElement} pPopover - the #PRSP_ColumnChooser_Popover element (already display:block).
	 */
	_positionColumnChooserPopover(pPopover)
	{
		const tmpTriggerElements = this.pict.ContentAssignment.getElement('#PRSP_ColumnChooser_Trigger');
		if (!tmpTriggerElements.length)
		{
			return;
		}
		const tmpPanel = /** @type {HTMLElement} */ (pPopover.querySelector('.prsp-colchooser-panel'));
		const tmpRect = tmpTriggerElements[0].getBoundingClientRect();
		const tmpGap = 6;
		const tmpMargin = 8;
		const tmpVH = window.innerHeight;
		const tmpVW = window.innerWidth;
		const tmpWidth = pPopover.offsetWidth || 280;
		// Right-align the popover to the (right-aligned) trigger, clamped into the viewport.
		pPopover.style.left = `${Math.round(Math.max(tmpMargin, Math.min(tmpRect.right - tmpWidth, tmpVW - tmpWidth - tmpMargin)))}px`;
		pPopover.style.right = 'auto';
		const tmpSpaceBelow = tmpVH - tmpRect.bottom - tmpGap - tmpMargin;
		const tmpSpaceAbove = tmpRect.top - tmpGap - tmpMargin;
		// Prefer the natural downward direction; only flip above when the room below is genuinely cramped.
		if (tmpSpaceBelow >= 220 || tmpSpaceBelow >= tmpSpaceAbove)
		{
			pPopover.style.top = `${Math.round(tmpRect.bottom + tmpGap)}px`;
			pPopover.style.bottom = 'auto';
			if (tmpPanel) { tmpPanel.style.maxHeight = `${Math.max(160, Math.min(tmpSpaceBelow, 460))}px`; }
		}
		else
		{
			pPopover.style.top = 'auto';
			pPopover.style.bottom = `${Math.round(tmpVH - tmpRect.top + tmpGap)}px`;
			if (tmpPanel) { tmpPanel.style.maxHeight = `${Math.max(160, Math.min(tmpSpaceAbove, 460))}px`; }
		}
	}
}

module.exports = viewRecordSetListColumnChooser;

module.exports.default_configuration = _DEFAULT_CONFIGURATION_List_ColumnChooser;
