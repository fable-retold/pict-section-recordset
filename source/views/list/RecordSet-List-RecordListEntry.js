const libPictView = require('pict-view');

/** @type {Record<string, any>} */
const _DEFAULT_CONFIGURATION_List_RecordListEntry = (
	{
		ViewIdentifier: 'PRSP-List-RecordListEntry',

		DefaultRenderable: 'PRSP_Renderable_RecordListEntry',
		DefaultDestinationAddress: '#PRSP_RecordListEntry_Container',
		DefaultTemplateRecordAddress: false,

		// If this is set to true, when the App initializes this will.
		// While the App initializes, initialize will be called.
		AutoInitialize: false,
		AutoInitializeOrdinal: 0,

		// If this is set to true, when the App autorenders (on load) this will.
		// After the App initializes, render will be called.
		AutoRender: false,
		AutoRenderOrdinal: 0,

		AutoSolveWithApp: false,
		AutoSolveOrdinal: 0,

		// Record-list row chrome. Host apps brand it via --theme-color-* tokens; the hardcoded values
		// are fallbacks.
		CSS: /*css*/`
/* Vertically center every cell's content so the text lines up with the action control (it was
   top-aligned, which read as off next to the centered action cell). */
#PRSP_List_Table td { vertical-align: middle; }

/* Deleted rows (visible via the show-deleted filter) read as ghosts of themselves. */
.prsp-list-row.prsp-row-deleted td { opacity: 0.55; }

/* Row-as-button (opt-in via the RowClickOpensRecord record-set config flag): clicking anywhere in the
   row — except the action cell — follows the record's default link. */
.prsp-list-row.prsp-row-clickable { cursor: pointer; }
.prsp-list-row.prsp-row-clickable:hover { background: var(--theme-color-background-hover, var(--theme-color-background-tertiary, #f1f3f7)); }

/* Per-row action menu: a subtle three-dot trigger, revealed on row hover, that opens a small popover
   of the record's links (View, …). Clicks inside it never trigger the row navigation. */
.prsp-row-actions { white-space: nowrap; text-align: right; width: 1%; }
.prsp-row-actions-wrap { position: relative; display: inline-block; }
.prsp-row-actions-trigger { display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
	border: none; background: transparent; line-height: 1; padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 1.05rem;
	color: var(--theme-color-text-muted, #6b7686); opacity: 0; transition: opacity 0.12s ease, background 0.12s ease, color 0.12s ease; }
.prsp-list-row:hover .prsp-row-actions-trigger, .prsp-row-actions-wrap.open .prsp-row-actions-trigger { opacity: 1; }
.prsp-row-actions-trigger:hover { background: var(--theme-color-background-tertiary, #eceef2); color: var(--theme-color-text-primary, #1f2733); }
.prsp-row-actions-menu { position: absolute; right: 0; top: calc(100% + 2px); z-index: 30; min-width: 9rem; display: none;
	background: var(--theme-color-background-panel, #fff); border: 1px solid var(--theme-color-border-default, #d7dce3);
	border-radius: 9px; box-shadow: 0 10px 26px rgba(17, 24, 39, 0.16); padding: 0.25rem; text-align: left; }
.prsp-row-actions-wrap:hover .prsp-row-actions-menu, .prsp-row-actions-wrap.open .prsp-row-actions-menu { display: block; }
.prsp-row-actions-menu ul { list-style: none; margin: 0; padding: 0; }
.prsp-row-actions-menu li > a { display: block; padding: 0.4rem 0.65rem; border-radius: 6px; text-decoration: none; white-space: nowrap;
	color: var(--theme-color-text-primary, #1f2733); font-size: 0.9rem; }
.prsp-row-actions-menu li > a:hover { background: var(--theme-color-background-tertiary, #eceef2); }
`,
		CSSPriority: 500,

		Templates:
			[
				{
					// TODO: Add extras template here; it's in the header but not here yet.
					Hash: 'PRSP-List-RecordListEntry-Template',
					Template: /*html*/`
		{~TSWP:PRSP-List-RecordListEntry-Template-Row:Record.Records.Records:Record~}
	`
				},
				{
					Hash: 'PRSP-List-RecordListEntry-Template-Row',
					// The whole row is a click target for the record's default link — opt-in via the
					// RowClickOpensRecord record-set config flag (which adds prsp-row-clickable). The onclick
					// only fires when that class is present, skips clicks inside the action cell, and follows
					// the default link (data-prsp-default) only — so a host-overridden action cell with no
					// default link makes the row click a harmless no-op.
					Template: /*html*/`
		<!-- DefaultPackage pict view template: [PRSP-List-RecordListEntry-Template] -->
		<tr class="prsp-list-row{~NE:Record.Payload.RecordSetConfiguration.RowClickOpensRecord^ prsp-row-clickable~}{~NE:Record.Data.Deleted^ prsp-row-deleted~}" onclick="if (this.classList.contains('prsp-row-clickable') &amp;&amp; !event.target.closest('.prsp-row-actions')) { var tmpDefaultLink = this.querySelector('.prsp-row-actions a[data-prsp-default]'); if (tmpDefaultLink) { tmpDefaultLink.click(); } }">
			{~TSWP:PRSP-List-RecordListEntry-Template-Row-Cell:Record.Payload.TableCells:Record.Data~}
			{~T:PRSP-List-RecordListHeader-Template-Extra-Row~}
			{~T:PRSP-List-RecordListAction-Template-Cell~}
		</tr>
		<!-- DefaultPackage end view template:  [PRSP-List-RecordListEntry-Template] -->
	`
				},
				{
					Hash: 'PRSP-List-RecordListHeader-Template-Extra-Row',
					Template: /*html*/`
		<!-- DefaultPackage pict view template: [PRSP-List-RecordListHeader-Template-Extra-Row] -->
		{~TBR:Record.Payload.RecordSetConfiguration.RecordSetListExtraColumnRowTemplateHash~}
		<!-- DefaultPackage end view template:  [PRSP-List-RecordListHeader-Extra-Row] -->
	`
				},
				{
					Hash: 'PRSP-List-RecordListEntry-Template-Row-Cell',
					Template: /*html*/`
			<td style="border-bottom: 1px solid var(--theme-color-border-default, #ccc); padding: 5px;">
				{~TBDA:Record.Data.PictDashboard.ValueTemplate~}
			</td>
		`
				},
				{
					Hash: 'PRSP-List-RecordListEntry-Template-Entry-Cell-Datum',
					Template: /*html*/`
		<!-- DefaultPackage pict view template: [PRSP-List-RecordListEntry-Template-Entry-Cell-Datum] -->
		`
				},
				{
					// The action cell renders the three-dot hover menu when RowClickOpensRecord is set, else the
					// original always-visible link list. (Hosts such as LIMS override this whole template; those
					// lists keep their custom actions and — without the flag — their original row behavior.)
					Hash: 'PRSP-List-RecordListAction-Template-Cell',
					// FIXME: Needs a better way of getting the appropriate link templates in (likely requiring piping the RecordSet to the link manager)
					Template: /*html*/`
			<td class="prsp-row-actions" style="border-bottom: 1px solid var(--theme-color-border-default, #ccc); padding: 5px;">
				{~TIfAbs:PRSP-List-RecordListAction-Menu:Record:Record.Payload.RecordSetConfiguration.RowClickOpensRecord^TRUE^~}
				{~TIfAbs:PRSP-List-RecordListAction-List:Record:Record.Payload.RecordSetConfiguration.RowClickOpensRecord^FALSE^~}
			</td>
		`
				},
				{
					Hash: 'PRSP-List-RecordListAction-Menu',
					Template: /*html*/`
				<div class="prsp-row-actions-wrap">
					<button type="button" class="prsp-row-actions-trigger" aria-label="Actions" title="Actions" onclick="event.stopPropagation(); this.parentNode.classList.toggle('open');">{~I:More~}</button>
					<div class="prsp-row-actions-menu">
						<ul>
							{~TSWP:PRSP-List-RecordListAction-Template-Cell-Datum:Pict.providers.RecordSetLinkManager.linkTemplates:Record~}
						</ul>
					</div>
				</div>
		`
				},
				{
					Hash: 'PRSP-List-RecordListAction-List',
					Template: /*html*/`
				<ul>
					{~TSWP:PRSP-List-RecordListAction-Template-Cell-Datum:Pict.providers.RecordSetLinkManager.linkTemplates:Record~}
				</ul>
		`
				},
				{
					Hash: 'PRSP-List-RecordListAction-Template-Cell-Datum',
					// These use the new TemplateByReference template expression, which uses the values in these addresses to lookup the template hash then renders those template with the current Record state.
					// This is part one of refactoring to include metatemplate resolution ase a core behavior pict itself rather than a pict-section-form capability
					Template: /*html*/`
						<li><a {~NE:Record.Data.Default^data-prsp-default="1"~} href="{~TBR:Record.Data.URL~}">{~TBR:Record.Data.Name~}</a></li>
		`
				},
			],

		Renderables:
			[
				{
					RenderableHash: 'PRSP_Renderable_RecordListEntry',
					TemplateHash: 'PRSP-List-RecordListEntry-Template',
					DestinationAddress: '#PRSP_RecordListEntry_Container',
					RenderMethod: 'replace'
				}
			],

		Manifests: {}
	});

class viewRecordSetListRecordListEntry extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DEFAULT_CONFIGURATION_List_RecordListEntry, pOptions);
		super(pFable, tmpOptions, pServiceHash);
	}
}

module.exports = viewRecordSetListRecordListEntry;

module.exports.default_configuration = _DEFAULT_CONFIGURATION_List_RecordListEntry;
