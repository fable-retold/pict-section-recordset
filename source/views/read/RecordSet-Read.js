const libPictRecordSetRecordView = require('../RecordSet-RecordBaseView.js');
const libViewAssociationEditor = require('../associate/RecordSet-AssociationEditor.js');

// Identity + audit field names stamped on (virtually) every Meadow entity. These are
// surfaced through the record audit header (the first-class activity line + the Details
// modal), not inline in the record body. The entity's own ID/GUID field names are added
// at suppression time via the provider's getIDField()/getGUIDField().
// Audit / sync-bookkeeping fields suppressed from the record body and surfaced in the Details modal.
// ExternalSyncDate / ExternalSyncGUID are the external-sync auditing stamps (Headlight integration sync).
const _AUDIT_FIELD_NAMES = ['CreatingIDUser', 'UpdatingIDUser', 'DeletingIDUser', 'Deleted', 'CreateDate', 'UpdateDate', 'DeleteDate', 'ExternalSyncDate', 'ExternalSyncGUID'];

/** @type {Record<string, any>} */
const _DEFAULT_CONFIGURATION__Read = (
	{
		ViewIdentifier: 'PRSP-Read',

		DefaultRenderable: 'PRSP_Renderable_Read',
		DefaultDestinationAddress: '#PRSP_Container',
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

		CSS: /*css*/`
			/* Soft-deleted record banner (the ViewDeleted route) — quiet alarm, theme-token driven. */
		.prsp-read-deleted-banner { display: flex; align-items: center; gap: 0.5rem; margin: 0 0 0.85rem; padding: 0.55rem 0.85rem;
			border: 1px solid var(--theme-color-status-error, #c0504d); border-radius: 8px; font-size: 0.92rem;
			color: var(--theme-color-status-error, #c0504d);
			background: color-mix(in srgb, var(--theme-color-status-error, #c0504d) 8%, transparent); }
		.prsp-audit-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin: 0 0 1rem; }
			.prsp-audit-line { display: inline-flex; align-items: center; gap: 0.4rem; color: var(--theme-color-text-muted, #6b7686); font-size: 0.85rem; }
			.prsp-audit-line .pict-icon { font-size: 0.8rem; }
			.prsp-audit-line strong { color: var(--theme-color-text-secondary, #45505f); font-weight: 600; }
			.prsp-audit-button { display: inline-flex; align-items: center; gap: 0.4rem; border: 1px solid var(--theme-color-border-default, #d7dce3); background: var(--theme-color-background-primary, #fff); color: var(--theme-color-text-muted, #6b7686); border-radius: 8px; padding: 0.35rem 0.65rem; font: inherit; font-size: 0.82rem; cursor: pointer; transition: all 0.15s ease; }
			.prsp-audit-button:hover { border-color: var(--theme-color-brand-primary, #156dd1); color: var(--theme-color-brand-primary, #156dd1); }
			.prsp-record-related:empty { display: none; }
			.prsp-audit-anchor { position: relative; }
			.prsp-audit-popover { position: absolute; top: calc(100% + 8px); right: 0; min-width: 380px; width: max-content; max-width: 90vw; background: var(--theme-color-background-panel, #fff); border: 1px solid var(--theme-color-border-default, #d7dce3); border-radius: 10px; box-shadow: 0 14px 36px rgba(15, 23, 42, 0.18); padding: 1rem 1.1rem; z-index: 40; display: none; }
			.prsp-audit-popover.is-open { display: block; }
			.prsp-audit-dl { display: grid; grid-template-columns: auto auto; gap: 0.6rem 1rem; align-items: baseline; margin: 0; }
			.prsp-audit-dl dd { white-space: nowrap; }
			.prsp-audit-dl dt { color: var(--theme-color-text-muted, #6b7686); font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap; }
			.prsp-audit-dl dd { margin: 0; color: var(--theme-color-text-primary, #1f2733); font-size: 0.9rem; }
			.prsp-audit-dl dd small { color: var(--theme-color-text-muted, #6b7686); }
			.prsp-audit-dl dd.is-deleted { color: var(--theme-color-status-error, #b62828); }
			.prsp-audit-guid { display: inline-flex; align-items: center; gap: 0.4rem; }
			.prsp-audit-guid code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8rem; color: var(--theme-color-text-secondary, #45505f); background: var(--theme-color-background-secondary, #f5f6f8); padding: 0.1rem 0.4rem; border-radius: 5px; }
			.prsp-audit-copy { border: 0; background: transparent; color: var(--theme-color-text-muted, #6b7686); cursor: pointer; padding: 0.1rem 0.3rem; border-radius: 4px; font-size: 0.85rem; }
			.prsp-audit-copy:hover { color: var(--theme-color-brand-primary, #156dd1); }
			/* Tufte: in view mode the record VALUES are the foreground. Read-only fields render as
			   text (not boxed inputs), so the data outweighs its labels and section chrome. */
			.prsp-record-read input.input[readonly], .prsp-record-read input.input[disabled], .prsp-record-read textarea[readonly], .prsp-record-read textarea[disabled], .prsp-record-read select[disabled] { background: transparent !important; border-color: transparent !important; box-shadow: none !important; padding-left: 0 !important; padding-right: 0 !important; height: auto !important; min-height: 0 !important; opacity: 1 !important; cursor: default !important; color: var(--theme-color-text-primary, #1f2733) !important; -webkit-text-fill-color: var(--theme-color-text-primary, #1f2733) !important; font-weight: 600 !important; font-size: 1.1rem !important; }
			.prsp-record-read .label { font-size: 0.68rem !important; font-weight: 600 !important; text-transform: uppercase !important; letter-spacing: 0.05em !important; color: var(--theme-color-text-muted, #6b7686) !important; margin-bottom: 0.05rem !important; }
			.prsp-record-read .section-header { background: var(--theme-color-background-selected, #e3edfb) !important; color: var(--theme-color-brand-primary, #156dd1) !important; font-size: 0.74rem !important; font-weight: 700 !important; text-transform: uppercase !important; letter-spacing: 0.06em !important; padding: 0.4rem 0.8rem !important; border-radius: 6px !important; border-bottom: 0 !important; margin: 1.1rem 0 0.7rem !important; }
				/* Record header — a readable title (the record's own name, via a heuristic) with the entity
				   type as an eyebrow, instead of a raw "RecordSet GUIDField [guid]" string. */
			.prsp-read-head { margin: 0 0 1.1rem; }
			.prsp-read-eyebrow { font-size: 0.72rem; font-weight: 650; text-transform: uppercase; letter-spacing: 0.06em; color: var(--theme-color-text-muted, #6b7686); }
			.prsp-read-title { font-size: 1.5rem; font-weight: 700; line-height: 1.2; margin: 0.1rem 0 0; color: var(--theme-color-text-primary, #1f2733); }
				/* Read-view association tabs — pill nav, shared by the Tab and Split layouts (single source;
				   layouts style only their own nav container). */
			.psrs-tab { padding: 0.4rem 0.85rem; border: 1px solid var(--theme-color-border-default, #d7dce3); border-radius: 8px; cursor: pointer; font-size: 0.88rem; color: var(--theme-color-text-secondary, #45505f); background: var(--theme-color-background-panel, #fff); user-select: none; transition: all 0.15s ease; }
			.psrs-tab:hover { background: var(--theme-color-background-tertiary, #eceef2); color: var(--theme-color-text-primary, #1f2733); }
			.psrs-tab.is-active { border-color: var(--theme-color-brand-primary, #156dd1); background: var(--theme-color-background-selected, #e3edfb); color: var(--theme-color-brand-primary, #156dd1); font-weight: 600; }
			.psrs-tab-body { display: none; }
			.psrs-tab-body.is-active { display: block; }
		`,
		CSSPriority: 500,

		Templates:
			[
				{
					Hash: 'PRSP-Read-RecordRead-Template',
					Template: /*html*/`
						<!-- DefaultPackage pict view template: [PRSP-Read-RecordRead-Template] -->
						<div>
							{~TSWP:PRSP-Read-RecordRead-Template-Row:Record.DisplayFields:Record.Record~}
						</div>
						{~T:PRSP-Read-RecordButtonBar-Template~}
						<!-- DefaultPackage end view template:  [PRSP-Read-RecordRead-Template] -->
					`
				},
				{
					Hash: 'PRSP-Read-RecordRead-Template-Row',
					Template: /*html*/`
						<!-- DefaultPackage pict view template: [PRSP-Read-RecordRead-Template] -->
						<div>
							<span style="font-style: italic;">{~D:Record.Data.DisplayName~}</span>
							<span style="font-weight: bold;">{~DVBK:Record.Payload:Record.Data.Key~}</span>
						</div>
						<!-- DefaultPackage end view template:  [PRSP-Read-RecordRead-Template] -->
					`
				},
				{
					Hash: 'PRSP-Read-RecordButtonBar-Template',
					Template: /*html*/`
						<style>
							.record-button-bar-hidden
							{
								display: none;
							}
							.record-button-bar
							{
								display: flex;
								margin-top: 15px;
							}
							.record-button-bar > button
							{
								margin-right: 10px;
							}
						.record-button-bar > button.prsp-read-delete-btn
							{
								margin-left: auto;
								margin-right: 0;
								border: 1px solid var(--theme-color-status-error, #b62828);
								background: var(--theme-color-status-error, #b62828);
								color: #fff;
								border-radius: 6px;
								cursor: pointer;
							}
						.record-button-bar > button.prsp-read-delete-btn:hover
							{
								background: var(--theme-color-status-error-hover, #9c2020);
							}
						</style>
						<div class="record-button-bar">
							<button id="PRSP-Read-CancelButton" type="button" onclick="_Pict.views['RSP-RecordSet-Read'].cancel()">Cancel</button>
							<button id="PRSP-Read-SaveButton" type="button" onclick="_Pict.views['RSP-RecordSet-Read'].save()">Save</button>
							<button id="PRSP-Read-EditButton" type="button" onclick="_Pict.views['RSP-RecordSet-Read'].edit()">Edit</button>
							<button id="PRSP-Read-DeleteButton" type="button" class="prsp-read-delete-btn" onclick="_Pict.views['RSP-RecordSet-Read'].deleteRecord()">Delete</button>
						</div>
					`
				},
				{
					Hash: 'PRSP-Read-RecordTab-Template',
					Template: /*html*/`<!-- Placeholder for tabs, something has gone wrong if this comment is rendered. -->`
				},
				{
					Hash: 'PRSP-Read-RecordTabNav-Template',
					Template: /*html*/`<!-- Placeholder for tabs, something has gone wrong if this comment is rendered. -->`
				},
				{
					// Readable record header, shared by all three layouts: the record's display name (heuristic)
					// over a small entity-type eyebrow, falling back to the GUID field + value when the record
					// has no obvious name. DisplayTitle / TitleEyebrow are computed in renderRead().
					Hash: 'PRSP-Read-Header-Template',
					Template: /*html*/`
						<div class="prsp-read-head">
							<div class="prsp-read-eyebrow">{~D:Record.TitleEyebrow~}</div>
							<h1 class="prsp-read-title">{~D:Record.DisplayTitle~}</h1>
						</div>`
				},
				{
					Hash: 'PRSP-Read-Basic-Template',
					Template: /*html*/`
						<!-- DefaultPackage pict view template: [PRSP-Read-Basic-Template] -->
						{~T:PRSP-Read-Header-Template~}
						<!--
						{~DJ:Record~}
						-->
						<div>
							{~T:PRSP-Read-RecordRead-Template~}
						</div>
						<!-- DefaultPackage end view template:  [PRSP-Read-Basic-Template] -->
						`
				},
				{
					Hash: 'PRSP-Read-Split-Template',
					Template: /*html*/`
						<!-- DefaultPackage pict view template: [PRSP-Read-Split-Template] -->
						<style>
							.psrs-split-tabnav { display: flex; justify-content: flex-end; gap: 0.4rem; margin: 0.4rem 0 0.2rem; }
							#PRSP-Read-Tab-Nav { display: inline-flex; gap: 0.35rem; flex-wrap: wrap; }
							.psrs-tab { padding: 0.4rem 0.85rem; border: 1px solid var(--theme-color-border-default, #d7dce3); border-radius: 8px; cursor: pointer; font-size: 0.88rem; color: var(--theme-color-text-secondary, #45505f); background: var(--theme-color-background-panel, #fff); user-select: none; }
							.psrs-tab:hover { background: var(--theme-color-background-tertiary, #eceef2); color: var(--theme-color-text-primary, #1f2733); }
							.psrs-tab.is-active { border-color: var(--theme-color-brand-primary, #156dd1); background: var(--theme-color-background-selected, #e3edfb); color: var(--theme-color-brand-primary, #156dd1); font-weight: 600; }
							.psrs-split-view { display: flex; height: 100%; }
							.psrs-left-panel { overflow: auto; }
							.psrs-right-panel { overflow: auto; flex: 1 1 auto; }
							#psrs-resize { flex: 0 0 auto; padding-left: 10px; padding-right: 10px; cursor: col-resize; }
							#psrs-resize > div { width: 1px; height: 100%; background-color: var(--theme-color-border-default, rgba(0,0,0,0.2)); }
							.psrs-tab-body { display: none; }
							.psrs-tab-body.is-active { display: block; }
							/* Collapsed (default): no association is open, so the record takes the full width and the
							   association pane + resizer are hidden until a tab is chosen. */
							.psrs-split-view.psrs-collapsed .psrs-right-panel,
							.psrs-split-view.psrs-collapsed #psrs-resize { display: none; }
							.psrs-split-view.psrs-collapsed .psrs-left-panel { min-width: 100% !important; width: 100%; }
						</style>
						{~T:PRSP-Read-Header-Template~}
						<div class="psrs-split-tabnav">{~T:PRSP-Read-RecordTabNav-Template~}</div>
						<div class="psrs-split-view psrs-collapsed">
							<div class="psrs-left-panel" style="min-width: {~D:Record.SplitLeftWidth~};">
								{~T:PRSP-Read-RecordRead-Template~}
							</div>
							<div id="psrs-resize"><div></div></div>
							<div class="psrs-right-panel">
								{~T:PRSP-Read-RecordTab-Template~}
							</div>
						</div>
						<!-- DefaultPackage end view template:  [PRSP-Read-Split-Template] -->
						`
				},
				{
					Hash: 'PRSP-Read-Tab-Template',
					Template: /*html*/`
						<!-- DefaultPackage pict view template: [PRSP-Read-Tab-Template] -->
						{~T:PRSP-Read-Header-Template~}
						<!--
						{~DJ:Record~}
						-->
						<style>
							/* Tab layout owns only its nav container; the pill styling for .psrs-tab /
							   .psrs-tab-body is shared from the view's persistent CSS block. */
							#PRSP-Read-Tab-Nav { display: flex; flex-wrap: wrap; gap: 0.35rem; width: 100%; margin: 0 0 1.25rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--theme-color-border-light, #e8ebf0); }
						</style>
						<div class="psrs-tab-view">
							<div id="PRSP-Read-Tabs-Container">
								{~T:PRSP-Read-RecordTabNav-Template~}
								{~T:PRSP-Read-RecordTab-Template~}
							</div>
						</div>
						<!-- DefaultPackage end view template:  [PRSP-Read-Tab-Template] -->
						`
				},
				{
					Hash: 'PRSP-Read-Link-Name-Template',
					Template: `View`
				},
				{
					Hash: 'PRSP-Read-Link-URL-Template',
					// TODO: Double payload pattern...
					// Soft-deleted rows (visible via the show-deleted filter) route to ViewDeleted, whose
					// lookup explicitly includes deleted records — a plain View would find nothing.
					Template: `#/PSRS/{~D:Record.Payload.Payload.RecordSet~}/View{~NE:Record.Payload.Data.Deleted^Deleted~}/{~DVBK:Record.Payload.Data:Record.Payload.Payload.GUIDAddress~}`
				},
				// --- Record audit header (themeable; apps brand via --theme-color-* tokens) ---
				{
					Hash: 'PRSP-Read-RecordAuditHeader-Template',
					Template: /*html*/`
						{~TS:PRSP-Read-DeletedBanner-Template:AppData.PRSP_RecordAudit.DeletedBannerSlot~}
						<div class="prsp-audit-header">
							<div class="prsp-audit-activity">{~TS:PRSP-Read-RecordAudit-Line-Template:AppData.PRSP_RecordAudit.ActivitySlot~}</div>
							<div class="prsp-audit-anchor">
								<button type="button" class="prsp-audit-button" title="Identity and audit detail" onclick="_Pict.views['RSP-RecordSet-Read'].toggleRecordAudit()">{~I:Info~}<span>Details</span></button>
								<div class="prsp-audit-popover" id="PRSP-Read-AuditPopover">
									<dl class="prsp-audit-dl">
										<dt>{~D:AppData.PRSP_RecordAudit.IDFieldName~}</dt><dd><span class="prsp-audit-guid"><code>{~D:AppData.PRSP_RecordAudit.IDValue~}</code><button type="button" class="prsp-audit-copy" title="Copy" onclick="_Pict.views['RSP-RecordSet-Read'].copyValue('{~D:AppData.PRSP_RecordAudit.IDValue~}')">{~I:Copy~}</button></span></dd>
										<dt>{~D:AppData.PRSP_RecordAudit.GUIDFieldName~}</dt><dd><span class="prsp-audit-guid"><code>{~D:AppData.PRSP_RecordAudit.GUIDValue~}</code><button type="button" class="prsp-audit-copy" title="Copy" onclick="_Pict.views['RSP-RecordSet-Read'].copyValue('{~D:AppData.PRSP_RecordAudit.GUIDValue~}')">{~I:Copy~}</button></span></dd>
										{~TS:PRSP-Read-RecordAudit-Created-Template:AppData.PRSP_RecordAudit.CreatedSlot~}
										{~TS:PRSP-Read-RecordAudit-Updated-Template:AppData.PRSP_RecordAudit.UpdatedSlot~}
										{~TS:PRSP-Read-RecordAudit-Deleted-Template:AppData.PRSP_RecordAudit.DeletedSlot~}
										{~TS:PRSP-Read-RecordAudit-ExternalSync-Template:AppData.PRSP_RecordAudit.ExternalSyncSlot~}
									</dl>
								</div>
							</div>
						</div>
					`
				},
				{
					Hash: 'PRSP-Read-RecordAudit-Line-Template',
					Template: /*html*/`<span class="prsp-audit-line">{~I:Refresh~} {~D:Record.Label~} by <strong>{~E:User^Record.UserID^PRSP-Read-RecordAudit-UserName-Template~}</strong> &middot; {~DateFormat:Record.Date^MMM D, YYYY - h:mm A~}</span>`
				},
				{
					Hash: 'PRSP-Read-RecordAudit-UserName-Template',
					Template: /*html*/`{~D:Record.NameFirst~} {~D:Record.NameLast~}`
				},
				{
					Hash: 'PRSP-Read-RecordAudit-Created-Template',
					Template: /*html*/`<dt>Created</dt><dd>{~DateFormat:Record.Date^MMM D, YYYY - h:mm A~} <small>by {~E:User^Record.UserID^PRSP-Read-RecordAudit-UserName-Template~}</small></dd>`
				},
				{
					Hash: 'PRSP-Read-RecordAudit-Updated-Template',
					Template: /*html*/`<dt>Last updated</dt><dd>{~DateFormat:Record.Date^MMM D, YYYY - h:mm A~} <small>by {~E:User^Record.UserID^PRSP-Read-RecordAudit-UserName-Template~}</small></dd>`
				},
				{
					Hash: 'PRSP-Read-RecordAudit-Deleted-Template',
					Template: /*html*/`<dt>Deleted</dt><dd class="is-deleted">{~DateFormat:Record.Date^MMM D, YYYY - h:mm A~} <small>by {~E:User^Record.UserID^PRSP-Read-RecordAudit-UserName-Template~}</small></dd>`
				},
				{
					Hash: 'PRSP-Read-RecordAudit-ExternalSync-Template',
					Template: /*html*/`<dt>External sync</dt><dd>{~TIfAbs:PRSP-Read-RecordAudit-ExternalSyncDate-Template:Record:Record.HasDate^TRUE^~}{~NE:Record.NeverSynced^Never synced~}</dd>`
				},
				{
					Hash: 'PRSP-Read-RecordAudit-ExternalSyncDate-Template',
					Template: /*html*/`{~DateFormat:Record.Date^MMM D, YYYY - h:mm A~}`
				},
				{
					// Soft-deleted record banner (the ViewDeleted route, or a record deleted out from
					// under a normal View). The one-or-zero-element DeletedBannerSlot drives it.
					Hash: 'PRSP-Read-DeletedBanner-Template',
					Template: /*html*/`<div class="prsp-read-deleted-banner">{~I:Warning~} This record has been deleted{~TIfAbs:PRSP-Read-DeletedBanner-Date-Template:Record:Record.HasDate^TRUE^~}.</div>`
				},
				{
					Hash: 'PRSP-Read-DeletedBanner-Date-Template',
					Template: /*html*/` on {~DateFormat:Record.Date^MMM D, YYYY - h:mm A~}`
				},
			],

		Renderables:
			[
				{
					RenderableHash: 'PRSP_Renderable_Read_Basic',
					TemplateHash: 'PRSP-Read-Basic-Template',
					DestinationAddress: '#PRSP_Container',
					RenderMethod: 'replace'
				},
				{
					RenderableHash: 'PRSP_Renderable_Read_Split',
					TemplateHash: 'PRSP-Read-Split-Template',
					DestinationAddress: '#PRSP_Container',
					RenderMethod: 'replace'
				},
				{
					RenderableHash: 'PRSP_Renderable_Read_Tab',
					TemplateHash: 'PRSP-Read-Tab-Template',
					DestinationAddress: '#PRSP_Container',
					RenderMethod: 'replace'
				}
			],

		Manifests: {}
	});

class viewRecordSetRead extends libPictRecordSetRecordView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DEFAULT_CONFIGURATION__Read, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		this.layoutType = 'Basic';
		this.action = 'View';
		this.tabs = [];
		this.RecordSet = null;
		this.providerHash = null;
		this.activeTab = null;
		this.mouseHandler = null;
		this.manifest = null;
		this.defaultManifest = null;
		this.GUID = null;
	}

	initializeDragListener()
	{
		let isResizing = false;
		const handleMouseMove = (event) =>
		{
			const resizer = document.getElementById("psrs-resize");
			const leftPanel = document.querySelector(".psrs-left-panel");
			const rightPanel = document.querySelector(".psrs-right-panel");
			if (!isResizing || !(resizer.parentNode instanceof HTMLElement && leftPanel instanceof HTMLElement && rightPanel instanceof HTMLElement))
			{
				return;
			}
			const containerRect = resizer.parentNode.getBoundingClientRect();
			const newLeftWidth = event.clientX - containerRect.left;
			const newRightWidth = containerRect.width - newLeftWidth - resizer.offsetWidth;
			leftPanel.style.width = `${newLeftWidth}px`;
			leftPanel.style.minWidth = `${newLeftWidth}px`;
			rightPanel.style.width = `${newRightWidth}px`;
		}
		if (!this.mouseHandler)
		{
			this.mouseHandler = (event) =>
			{
				isResizing = true;
				document.body.style.userSelect = "none";
				document.addEventListener("mousemove", handleMouseMove);
				document.addEventListener("mouseup", () =>
				{
					isResizing = false;
					document.body.style.userSelect = "";
					document.removeEventListener("mousemove", handleMouseMove);
				});
			};
		}
		const resizer = document.getElementById("psrs-resize");
		resizer.removeEventListener('mousedown', this.mouseHandler);
		resizer.addEventListener("mousedown", this.mouseHandler);
	}

	onAfterRender(pRenderable)
	{
		if (this.layoutType == 'Split')
		{
			this.initializeDragListener();
		}
		
		this.pict.CSSMap.injectCSS();
		this._bindAuditDismiss();
		return super.onAfterRender(pRenderable);
	}

	handleRecordSetReadRoute(pRoutePayload)
	{
		if (typeof(pRoutePayload) != 'object')
		{
			throw new Error(`Pict RecordSet Read view route handler called with invalid route payload.`);
		}

		this.action = 'View';
		this.viewingDeletedRecord = false;
		const tmpProviderConfiguration = this.pict.PictSectionRecordSet.recordSetProviderConfigurations[pRoutePayload.data.RecordSet];
		this.layoutType = tmpProviderConfiguration?.ReadLayout || 'Basic';
		const tmpProviderHash = `RSP-Provider-${pRoutePayload.data.RecordSet}`;

		tmpProviderConfiguration.RoutePayload = pRoutePayload;
		tmpProviderConfiguration.RecordSet = pRoutePayload.data.RecordSet;
		tmpProviderConfiguration.GUIDRecord = pRoutePayload.data.GUIDRecord;

		if (this.delegateToCustomView(this.action, tmpProviderConfiguration, pRoutePayload)) { return true; }

		return this.renderRead(tmpProviderConfiguration, tmpProviderHash, pRoutePayload.data.GUIDRecord);
	}

	/**
	 * The deleted-record read route (`/PSRS/:RecordSet/ViewDeleted/:GUIDRecord`): identical to the
	 * View route except the record lookup explicitly includes soft-deleted rows (a normal View of a
	 * deleted record finds nothing — delete tracking filters it out — and renders broken). The flag
	 * also rides the read data as ViewingDeletedRecord, which drives the deleted banner.
	 */
	handleRecordSetReadDeletedRoute(pRoutePayload)
	{
		if (typeof(pRoutePayload) != 'object')
		{
			throw new Error(`Pict RecordSet Read view route handler called with invalid route payload.`);
		}

		this.action = 'View';
		this.viewingDeletedRecord = true;
		const tmpProviderConfiguration = this.pict.PictSectionRecordSet.recordSetProviderConfigurations[pRoutePayload.data.RecordSet];
		this.layoutType = tmpProviderConfiguration?.ReadLayout || 'Basic';
		const tmpProviderHash = `RSP-Provider-${pRoutePayload.data.RecordSet}`;

		tmpProviderConfiguration.RoutePayload = pRoutePayload;
		tmpProviderConfiguration.RecordSet = pRoutePayload.data.RecordSet;
		tmpProviderConfiguration.GUIDRecord = pRoutePayload.data.GUIDRecord;

		if (this.delegateToCustomView(this.action, tmpProviderConfiguration, pRoutePayload)) { return true; }

		return this.renderRead(tmpProviderConfiguration, tmpProviderHash, pRoutePayload.data.GUIDRecord);
	}

	handleRecordSetEditRoute(pRoutePayload)
	{
		if (typeof(pRoutePayload) != 'object')
		{
			throw new Error(`Pict RecordSet Read view route handler called with invalid route payload.`);
		}

		this.action = 'Edit';
		this.viewingDeletedRecord = false;
		const tmpProviderConfiguration = this.pict.PictSectionRecordSet.recordSetProviderConfigurations[pRoutePayload.data.RecordSet];
		this.layoutType = tmpProviderConfiguration?.ReadLayout || 'Basic';
		const tmpProviderHash = `RSP-Provider-${pRoutePayload.data.RecordSet}`;

		tmpProviderConfiguration.RoutePayload = pRoutePayload;
		tmpProviderConfiguration.RecordSet = pRoutePayload.data.RecordSet;
		tmpProviderConfiguration.GUIDRecord = pRoutePayload.data.GUIDRecord;

		if (this.delegateToCustomView(this.action, tmpProviderConfiguration, pRoutePayload)) { return true; }

		return this.renderRead(tmpProviderConfiguration, tmpProviderHash, pRoutePayload.data.GUIDRecord);
	}

	addRoutes(pPictRouter)
	{
		pPictRouter.addRoute('/PSRS/:RecordSet/View/:GUIDRecord', this.handleRecordSetReadRoute.bind(this));
		pPictRouter.addRoute('/PSRS/:RecordSet/ViewDeleted/:GUIDRecord', this.handleRecordSetReadDeletedRoute.bind(this));
		pPictRouter.addRoute('/PSRS/:RecordSet/Edit/:GUIDRecord', this.handleRecordSetEditRoute.bind(this));
		return true;
	}

	async cancel()
	{
		await this.onBeforeView();
		this.fable.providers.RecordSetRouter.pictRouter.navigate(`/PSRS/${ this.RecordSet }/View/${ this.GUID }`);
	}

	async save()
	{
		await this.onBeforeSave();
		await this.pict.providers[this.providerHash].updateRecord(this.pict.AppData[`${ this.RecordSet }Details`]);
		await this.onBeforeView();
		this.fable.providers.RecordSetRouter.pictRouter.navigate(`/PSRS/${ this.RecordSet }/View/${ this.GUID }`);
	}

	async edit()
	{
		await this.onBeforeEdit();
		this.fable.providers.RecordSetRouter.pictRouter.navigate(`/PSRS/${ this.RecordSet }/Edit/${ this.GUID }`);
	}

	/**
	 * Delete the record being viewed. Basic path: confirm via the host modal, delete, and return to the
	 * list. When the recordset opts into advanced delete (`RecordSetAdvancedDelete`), the modal also offers
	 * "Reassign & delete", which hands off to the Bulk Delete screen preselected to this one record — so the
	 * relationship-remapping UI (replacement picker) is reused rather than duplicated here.
	 * @return {Promise<void>}
	 */
	async deleteRecord()
	{
		const tmpRecord = this.pict.AppData[`${ this.RecordSet }Details`];
		const tmpProvider = this.pict.providers[this.providerHash];
		if (!tmpRecord || !tmpProvider)
		{
			return;
		}
		const tmpModal = this.pict.views['Pict-Section-Modal'];
		const tmpConfig = this.pict.PictSectionRecordSet ? this.pict.PictSectionRecordSet.recordSetProviderConfigurations[this.RecordSet] : null;
		const tmpAdvancedEnabled = !!(tmpConfig && tmpConfig.RecordSetAdvancedDelete === true);

		if (tmpAdvancedEnabled && tmpModal && typeof tmpModal.show === 'function')
		{
			const tmpChoice = await tmpModal.show(
				{
					title: 'Delete record',
					content: '<p>Delete this record, or reassign its related records to a replacement first?</p>',
					buttons:
					[
						{ Hash: 'cancel', Label: 'Cancel' },
						{ Hash: 'reassign', Label: 'Reassign & delete…' },
						{ Hash: 'delete', Label: 'Delete', Style: 'danger' },
					],
				});
			if (tmpChoice === 'reassign')
			{
				const tmpIDField = tmpProvider.getIDField();
				this.fable.providers.RecordSetRouter.pictRouter.navigate(`/PSRS/${ this.RecordSet }/BulkDelete/Record/${ tmpRecord[tmpIDField] }`);
				return;
			}
			if (tmpChoice !== 'delete')
			{
				return;
			}
			return this._performDelete(tmpRecord, tmpProvider);
		}

		if (tmpModal && typeof tmpModal.confirm === 'function')
		{
			const tmpOk = await tmpModal.confirm('Delete this record? This cannot be undone.',
				{ title: 'Delete record', confirmLabel: 'Delete', cancelLabel: 'Cancel', dangerous: true });
			if (!tmpOk)
			{
				return;
			}
		}
		return this._performDelete(tmpRecord, tmpProvider);
	}

	/**
	 * Delete the record through the provider and return to the list (toasting the outcome).
	 * @param {Record<string, any>} pRecord @param {any} pProvider @return {Promise<void>}
	 */
	async _performDelete(pRecord, pProvider)
	{
		const tmpModal = this.pict.views['Pict-Section-Modal'];
		try
		{
			await pProvider.deleteRecord(pRecord);
		}
		catch (pError)
		{
			this.pict.log.error(`RecordSetRead: delete failed for ${ this.RecordSet }.`, pError);
			if (tmpModal && typeof tmpModal.toast === 'function') { tmpModal.toast('Could not delete the record.', { type: 'error' }); }
			return;
		}
		if (tmpModal && typeof tmpModal.toast === 'function') { tmpModal.toast('Record deleted', { type: 'success' }); }
		this.fable.providers.RecordSetRouter.pictRouter.navigate(`/PSRS/${ this.RecordSet }/List`);
	}

	/**
	 * Build the record audit header state — the first-class activity line plus the data the
	 * Details modal renders. Identity (ID/GUID) and the create/update/delete stamps are read
	 * straight off the fetched record; the acting-user names resolve lazily via {~E:User^…~}
	 * in the templates (cachetrax-cached), so nothing is pre-resolved here. Stored at
	 * AppData.PRSP_RecordAudit for the templates to consume.
	 *
	 * @param {Record<string, any>} pRecord - The fetched record.
	 */
	_prepareRecordAuditState(pRecord)
	{
		if (!pRecord || typeof pRecord !== 'object')
		{
			this.pict.AppData.PRSP_RecordAudit = false;
			return;
		}
		const tmpProvider = this.pict.providers[this.providerHash];
		const tmpIDField = tmpProvider ? tmpProvider.getIDField() : 'ID';
		const tmpGUIDField = tmpProvider ? tmpProvider.getGUIDField() : 'GUID';

		const tmpHasCreate = this._validAuditDate(pRecord.CreateDate);
		const tmpHasUpdate = this._validAuditDate(pRecord.UpdateDate) && (pRecord.UpdateDate !== pRecord.CreateDate);
		const tmpDeleted = !!pRecord.Deleted && this._validAuditDate(pRecord.DeleteDate);

		let tmpActivitySlot = [];
		if (tmpHasUpdate)
		{
			tmpActivitySlot = [{ Label: 'Updated', Date: pRecord.UpdateDate, UserID: pRecord.UpdatingIDUser }];
		}
		else if (tmpHasCreate)
		{
			tmpActivitySlot = [{ Label: 'Created', Date: pRecord.CreateDate, UserID: pRecord.CreatingIDUser }];
		}

		const tmpIDValue = (pRecord[tmpIDField] != null) ? pRecord[tmpIDField] : '';
		this.pict.AppData.PRSP_RecordAudit =
		{
			RecordSet: this.RecordSet,
			DisplayName: this._computeDisplayName(pRecord),
			IDFieldName: tmpIDField,
			GUIDFieldName: tmpGUIDField,
			IDValue: tmpIDValue,
			GUIDValue: (pRecord[tmpGUIDField] != null) ? pRecord[tmpGUIDField] : '',
			ActivitySlot: tmpActivitySlot,
			CreatedSlot: tmpHasCreate ? [{ Date: pRecord.CreateDate, UserID: pRecord.CreatingIDUser }] : [],
			UpdatedSlot: tmpHasUpdate ? [{ Date: pRecord.UpdateDate, UserID: pRecord.UpdatingIDUser }] : [],
			DeletedSlot: tmpDeleted ? [{ Date: pRecord.DeleteDate, UserID: pRecord.DeletingIDUser }] : [],
			// The ViewDeleted route's banner: present whenever the record is soft-deleted (whether the
			// user arrived via ViewDeleted or the record was deleted out from under a normal View).
			DeletedBannerSlot: (!!pRecord.Deleted) ? [{ Date: pRecord.DeleteDate, UserID: pRecord.DeletingIDUser, HasDate: this._validAuditDate(pRecord.DeleteDate) }] : [],
			// External-sync auditing stamp — surfaced in the Details modal for entities that carry the field.
			ExternalSyncSlot: ('ExternalSyncDate' in pRecord) ? [{ Date: pRecord.ExternalSyncDate, HasDate: this._validAuditDate(pRecord.ExternalSyncDate), NeverSynced: !this._validAuditDate(pRecord.ExternalSyncDate) }] : []
		};
	}

	/**
	 * Compute a human-friendly display name for a record using an opinionated heuristic: first +
	 * last name, then a single descriptive field (FullName, Name, Title, …), else ''. Callers fall
	 * back to the GUID. Lets the page title read "Krishna Pavia Tester" instead of a raw GUID.
	 * @param {Record<string, any>} pRecord
	 * @return {string}
	 */
	_computeDisplayName(pRecord)
	{
		if (!pRecord || typeof pRecord !== 'object')
		{
			return '';
		}
		const tmpFirst = pRecord.NameFirst || pRecord.FirstName;
		const tmpLast = pRecord.NameLast || pRecord.LastName;
		if (tmpFirst || tmpLast)
		{
			return [tmpFirst, tmpLast].filter(Boolean).join(' ').trim();
		}
		const tmpCandidateFields = ['FullName', 'Name', 'Title', 'DisplayName', 'Label', 'Subject', 'Description', 'Code', 'Hash'];
		for (const tmpField of tmpCandidateFields)
		{
			if (pRecord[tmpField] != null && String(pRecord[tmpField]).trim() !== '')
			{
				return String(pRecord[tmpField]).trim();
			}
		}
		return '';
	}

	/**
	 * Whether an audit date value is present and meaningful (guards null/empty and the Meadow
	 * "0000-00-00" zero-date sentinel).
	 * @param {any} pValue
	 * @return {boolean}
	 */
	_validAuditDate(pValue)
	{
		if (!pValue)
		{
			return false;
		}
		return String(pValue).indexOf('0000-00-00') !== 0;
	}

	/**
	 * Toggle the anchored identity + audit popover open or closed. The content is rendered inline
	 * with the record (so the {~E:User^…~} names resolve during the read render); this just flips
	 * its visibility — no overlay.
	 */
	toggleRecordAudit()
	{
		const tmpPopover = document.getElementById('PRSP-Read-AuditPopover');
		if (tmpPopover)
		{
			tmpPopover.classList.toggle('is-open');
		}
	}

	/**
	 * Bind the one-time document handlers that dismiss the audit popover on an outside click or
	 * Escape. Browser-level events with no inline-handler equivalent — bound once and guarded so
	 * re-renders don't stack listeners.
	 */
	_bindAuditDismiss()
	{
		if (this._auditDismissBound || typeof document === 'undefined')
		{
			return;
		}
		this._auditDismissBound = true;
		document.addEventListener('click', (pEvent) =>
		{
			const tmpPopover = document.getElementById('PRSP-Read-AuditPopover');
			if (!tmpPopover || !tmpPopover.classList.contains('is-open'))
			{
				return;
			}
			if (tmpPopover.contains(pEvent.target) || (pEvent.target.closest && pEvent.target.closest('.prsp-audit-button')))
			{
				return;
			}
			tmpPopover.classList.remove('is-open');
		});
		document.addEventListener('keydown', (pEvent) =>
		{
			if (pEvent.key === 'Escape')
			{
				const tmpPopover = document.getElementById('PRSP-Read-AuditPopover');
				if (tmpPopover)
				{
					tmpPopover.classList.remove('is-open');
				}
			}
		});
	}

	/**
	 * Copy a record value (ID or GUID) to the clipboard from the audit popover, with a toast.
	 * @param {string} pValue
	 */
	copyValue(pValue)
	{
		const tmpModal = this.pict.views['Pict-Section-Modal'];
		const fToast = (pMessage, pType) =>
		{
			if (tmpModal && typeof tmpModal.toast === 'function')
			{
				tmpModal.toast(pMessage, { type: pType || 'success' });
			}
		};
		if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText)
		{
			navigator.clipboard.writeText(pValue).then(() => fToast('GUID copied to clipboard')).catch(() => fToast('Could not copy GUID', 'error'));
		}
		else
		{
			fToast('Could not copy GUID', 'error');
		}
	}

	/**
	 * Remove identity + audit descriptors from a (cloned) manifest so they don't render inline
	 * in the record body — they live behind the audit header's Details modal instead. Also
	 * prunes any section left with no descriptors (e.g. an emptied "Audit Trail" section). The
	 * entity's own ID/GUID field names are suppressed alongside the shared audit fields.
	 * @param {Record<string, any>} pManifest - The cloned manifest to mutate.
	 */
	_suppressAuditDescriptors(pManifest)
	{
		if (!pManifest || !pManifest.Descriptors)
		{
			return;
		}
		const tmpProvider = this.pict.providers[this.providerHash];
		const tmpSuppress = _AUDIT_FIELD_NAMES.concat('IDCustomer'); // IDCustomer: meadow-endpoints/retold tenancy discriminator — server-managed
		if (tmpProvider)
		{
			tmpSuppress.push(tmpProvider.getIDField());
			tmpSuppress.push(tmpProvider.getGUIDField());
		}
		for (const tmpKey of Object.keys(pManifest.Descriptors))
		{
			const tmpFieldName = tmpKey.split('.').pop();
			if (tmpSuppress.indexOf(tmpFieldName) >= 0)
			{
				delete pManifest.Descriptors[tmpKey];
			}
		}
		// Drop sections that no longer have any descriptors (so an emptied titled section like
		// "Audit Trail" doesn't render as a bare heading).
		if (Array.isArray(pManifest.Sections))
		{
			const tmpUsedSections = {};
			for (const tmpKey of Object.keys(pManifest.Descriptors))
			{
				const tmpSectionHash = pManifest.Descriptors[tmpKey] && pManifest.Descriptors[tmpKey].PictForm && pManifest.Descriptors[tmpKey].PictForm.Section;
				if (tmpSectionHash)
				{
					tmpUsedSections[tmpSectionHash] = true;
				}
			}
			pManifest.Sections = pManifest.Sections.filter((pSection) => tmpUsedSections[pSection.Hash]);
		}
	}

	onBeforeRenderRead(pRecordReadData)
	{
		this.formatDisplayData(pRecordReadData);
		return pRecordReadData;
	}

	formatDisplayData(pRecordListData)
	{
		pRecordListData.DisplayFields = [];
		const tmpSchema = pRecordListData.RecordSchema;
		const tmpProperties = tmpSchema?.properties;
		// loop throught the schema and add the columns to the tableCells -- just show all for now.
		for (const tmpColumn in tmpProperties)
		{
			pRecordListData.DisplayFields.push({
				'Key': tmpColumn,
				'DisplayName': tmpProperties?.[tmpColumn].title || tmpColumn,
			});
		}
		return pRecordListData;
	}

	async onBeforeEdit()
	{
		// Hook that is called when transitioning to edit mode. 
	}

	async onBeforeSave()
	{
		// Hook that is called before saving.
	}

	async onBeforeView()
	{
		// Hook that is called when transitioning to view mode. 
	}

	async onBeforeTabChange()
	{
		// Hook that is called when transitioning between tabs.
	}

	async renderRead(pRecordConfiguration, pProviderHash, pRecordGUID)
	{
		// Get the records
		if (!(pProviderHash in this.pict.providers))
		{
			this.pict.log.error(`RecordSetRead: No provider found for ${pProviderHash} in ${pRecordConfiguration.RecordSet}.  Read Render failed.`);
			return false;
		}

		let tmpRecordReadData =
		{
			"RecordSet": pRecordConfiguration.RecordSet,

			"RecordConfiguration": pRecordConfiguration,

			"RenderDestination": this.options.DefaultDestinationAddress,

			"Record": false,

			// Split layout: the starting width of the record (left) pane; the rest goes to the tabs
			// (right) pane. Any CSS width ('40%', '360px', …); default 50%. The divider stays draggable.
			"SplitLeftWidth": pRecordConfiguration.RecordSetReadSplitLeftWidth || '50%',
		};

		this.GUID = pRecordGUID;

		if (pRecordConfiguration.RecordSet !== this.RecordSet)
		{
			this.RecordSet = pRecordConfiguration.RecordSet;
			this.activeTab = null;
		}

		this.providerHash = pProviderHash;

		// If the record configuration does not have a GUID, try to infer one from the RecordSet name
		// TODO: This should be coming from the schema but that can come after we discuss how we deal with default routing
		tmpRecordReadData.GUIDAddress = this.pict.providers[pProviderHash].getGUIDField();

		tmpRecordReadData.Record = await this.pict.providers[pProviderHash].getRecordByGUID(pRecordGUID, this.viewingDeletedRecord === true);
		tmpRecordReadData.RecordSchema = await this.pict.providers[pProviderHash].getRecordSchema();
		tmpRecordReadData.ViewingDeletedRecord = (this.viewingDeletedRecord === true);
		this.pict.AppData[`${ tmpRecordReadData.RecordSet }Details`] = tmpRecordReadData.Record;

		// Build the audit header state (first-class activity line + the Details modal) for this record.
		this._prepareRecordAuditState(tmpRecordReadData.Record);

		if (pRecordConfiguration.RecordSetReadManifestOnly)
		{
			this.pict.TemplateProvider.addTemplate(`PRSP-Read-RecordRead-Template`, /*html*/`
				<!-- Manifest dynamic pict template: [PRSP-Read-RecordRead-Template] -->
				<div class="prsp-record-read">
				{~T:PRSP-Read-RecordAuditHeader-Template~}
				<div>${ this._generateManifestTemplate(pRecordConfiguration, 'RecordRead', null, true) }</div>
				{~T:PRSP-Read-RecordButtonBar-Template~}
				<div class="prsp-record-related" id="PRSP-Read-Related"></div>
				</div>
				<!-- Manifest dynamic pict end template: [PRSP-Read-RecordRead-Template] -->
			`);
		}
		else
		{
			// Construct a default manifest based on the RecordSchema:
			this.defaultManifest = await this._buildDefaultManifest(tmpRecordReadData.RecordSet);
			this.pict.TemplateProvider.addTemplate(`PRSP-Read-RecordRead-Template`, /*html*/`
				<!-- Manifest dynamic pict template: [PRSP-Read-RecordRead-Template] -->
				<div class="prsp-record-read">
				{~T:PRSP-Read-RecordAuditHeader-Template~}
				<div>${ this._generateManifestTemplate(pRecordConfiguration, 'RecordRead', null, true, this.action, this.defaultManifest) }</div>
				{~T:PRSP-Read-RecordButtonBar-Template~}
				<div class="prsp-record-related" id="PRSP-Read-Related"></div>
				</div>
				<!-- Manifest dynamic pict end template: [PRSP-Read-RecordRead-Template] -->
			`);
		}

		if (this.layoutType !== 'Basic')
		{
			this.tabs = await this._structureTabs(pRecordConfiguration, tmpRecordReadData.Record);
			this.pict.TemplateProvider.addTemplate('PRSP-Read-RecordTab-Template', /*html*/`
				<!-- DefaultPackage pict view template: [PRSP-Read-RecordTab-Template] -->
				${ this.tabs.map((t) => t.Template).join('') }
				<!-- DefaultPackage end view template:  [PRSP-Read-RecordTab-Template] -->
			`);
			this.pict.TemplateProvider.addTemplate('PRSP-Read-RecordTabNav-Template', /*html*/`
				<!-- DefaultPackage pict view template: [PRSP-Read-RecordTabNav-Template] -->
				<div id="PRSP-Read-Tab-Nav">
					${ this.tabs.map((t) => t.TabTemplate).join('') }
				</div>
				<!-- DefaultPackage end view template:  [PRSP-Read-RecordTabNav-Template] -->
			`);
		}

		// Readable record header: the record's own name (heuristic — Name / Title / DisplayName / …),
		// with the entity type (camelCase split) as an eyebrow. Falls back to the GUID field + value
		// when the record has no obvious display field. Computed before onBeforeRenderRead so apps can
		// still override DisplayTitle / TitleEyebrow there.
		const tmpReadableName = this._computeDisplayName(tmpRecordReadData.Record);
		tmpRecordReadData.DisplayTitle = tmpReadableName || `${ tmpRecordReadData.GUIDAddress } [${ pRecordConfiguration.GUIDRecord }]`;
		tmpRecordReadData.TitleEyebrow = String(pRecordConfiguration.RecordSet || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2');

		tmpRecordReadData = this.onBeforeRenderRead(tmpRecordReadData);

		this.renderAsync(`PRSP_Renderable_Read_${ this.layoutType }`, tmpRecordReadData.RenderDestination, tmpRecordReadData,
			async function (pError)
			{
				if (pError)
				{
					this.pict.log.error(`RecordSetRead: Error rendering read ${pError}`, tmpRecordReadData);
					return false;
				}

				if (this.pict.LogNoisiness > 0)
				{
					this.pict.log.info(`RecordSetRead: Rendered read ${tmpRecordReadData.RecordSet} with ${tmpRecordReadData.RecordConfiguration.GUIDRecord} []`, tmpRecordReadData);
				}
				else
				{
					this.pict.log.info(`RecordSetRead: Rendered read ${tmpRecordReadData.RecordSet} with ${tmpRecordReadData.RecordConfiguration.GUIDRecord} []`);
				}
				for (const s of this.manifest?.Sections || [])
				{
					this.pict.views[`PictSectionForm-${ s.Hash }`].render();
					this.pict.views[`PictSectionForm-${ s.Hash }`].marshalToView();
				}
				for (const t of this.tabs)
				{
					// Isolate each tab's render: the tabs share one sequential loop, so without this a single
					// tab that throws (e.g. an association editor whose list is large enough to overflow the
					// template-render stack) would blank not just itself but every tab AFTER it in the loop.
					// Catch, log, drop a small notice into the failed tab's body, and keep rendering the rest.
					try
					{
						if (t.renderAsync)
						{
							await t.renderAsync();
						}
						else
						{
							t.render();
						}
					}
					catch (pTabError)
					{
						this.pict.log.error(`RecordSetRead: tab "${ t.Title || t.Hash }" failed to render: ${ pTabError && (pTabError.message || pTabError) }`, pTabError);
						const tmpTabBody = t.Hash ? document.getElementById(`PSRS-Tab-${ t.Hash }`) : null;
						if (tmpTabBody && (tmpTabBody.innerHTML.trim() === ''))
						{
							tmpTabBody.innerHTML = `<div class="psrs-tab-error">This tab could not be displayed.</div>`;
						}
					}
				}
				if (this.action == 'Edit')
				{
					document.getElementById('PRSP-Read-EditButton').classList.add('record-button-bar-hidden');
					document.getElementById('PRSP-Read-SaveButton').classList.remove('record-button-bar-hidden');
					document.getElementById('PRSP-Read-CancelButton').classList.remove('record-button-bar-hidden');
				}
				else if (this.viewingDeletedRecord === true)
				{
					// A deleted record can't be edited (the Edit route's lookup excludes deleted rows) —
					// the ViewDeleted page is read-only.
					document.getElementById('PRSP-Read-EditButton').classList.add('record-button-bar-hidden');
					document.getElementById('PRSP-Read-SaveButton').classList.add('record-button-bar-hidden');
					document.getElementById('PRSP-Read-CancelButton').classList.add('record-button-bar-hidden');
				}
				else
				{
					document.getElementById('PRSP-Read-EditButton').classList.remove('record-button-bar-hidden');
					document.getElementById('PRSP-Read-SaveButton').classList.add('record-button-bar-hidden');
					document.getElementById('PRSP-Read-CancelButton').classList.add('record-button-bar-hidden');
				}
				// Delete is available only in read (View) mode: not while editing, and not on a record that is
				// already soft-deleted (the ViewDeleted page is read-only).
				const tmpDeleteButton = document.getElementById('PRSP-Read-DeleteButton');
				if (tmpDeleteButton)
				{
					if (this.action == 'Edit' || this.viewingDeletedRecord === true)
					{
						tmpDeleteButton.classList.add('record-button-bar-hidden');
					}
					else
					{
						tmpDeleteButton.classList.remove('record-button-bar-hidden');
					}
				}
				// Split opens to the record alone via the Full Record tab; other tabbed layouts default to the first tab.
				this.setTab(this.activeTab || (this.layoutType === 'Split' ? 'FullRecord' : this.tabs?.[0]?.Hash));
				return true;
			}.bind(this));
	}

	async setTab(t)
	{
		// Split layout opens to the record alone via the "Full Record" tab. Choosing an association tab
		// expands its editor beside the record; choosing "Full Record" (or re-choosing the active tab)
		// collapses back to the record-only view. Other layouts always activate the target.
		const tmpSplit = (this.layoutType === 'Split');
		const tmpNewActive = (tmpSplit && (!t || t === 'FullRecord' || t === this.activeTab)) ? 'FullRecord' : t;
		if (this.activeTab !== tmpNewActive)
		{
			await this.onBeforeTabChange();
		}
		this.activeTab = tmpNewActive;
		if (tmpSplit)
		{
			const tmpSplitView = document.querySelector('.psrs-split-view');
			if (tmpSplitView)
			{
				tmpSplitView.classList.toggle('psrs-collapsed', (tmpNewActive === 'FullRecord'));
			}
		}
		const tabSet = document.querySelectorAll('.psrs-tab');
		const tabBodySet = document.querySelectorAll('.psrs-tab-body');
		for (const tb of tabSet)
		{
			tb.classList.remove('is-active');
			if (tmpNewActive && tb.id == `PSRS-TabNav-${ tmpNewActive }`)
			{
				tb.classList.add('is-active');
			}
		}
		for (const tb of tabBodySet)
		{
			tb.classList.remove('is-active');
			if (tmpNewActive && tb.id == `PSRS-Tab-${ tmpNewActive }`)
			{
				tb.classList.add('is-active');
			}
		}
	}

	async _buildDefaultManifest(recordSet)
	{
		// Construct a default manifest based on the RecordSchema:
		const defaultManifest = 
		{
			"Form": "DefaultManifest",
			"Scope": "Default",
			"Descriptors": {},
			"Sections": 
			[
				{
					"Name": "",
					"Hash": "DefaultSection",
					"Solvers": [],
					"ShowTitle": false,
					"Groups": [
						{
							"Name": "",
							"Hash": "DefaultGroup",
							"Rows": [],
							"RecordSetSolvers": [],
							"ShowTitle": false
						}
					]
				}
			]
		}
		let rowCounter = 1;
		const providerHash = `RSP-Provider-${ recordSet }`;
		const schema = await this.pict.providers[providerHash].getRecordSchema();
		for (const p of Object.keys(schema.properties))
		{
			const exclusionSet = [this.pict.providers[this.providerHash].getIDField(), this.pict.providers[this.providerHash].getGUIDField()].concat(_AUDIT_FIELD_NAMES, 'IDCustomer');
			if (exclusionSet.includes(p))
			{
				continue;
			}
			const tmpDescriptor =
			{
				"Name": `${ this.pict.providers[providerHash].getHumanReadableFieldName?.(p) || p }`,
				"Hash": `${ this.pict.providers[this.providerHash].options.Entity  }-${ p }`,
				"DataType": "String",
				"PictForm": 
				{
					"Row": `${ rowCounter }`,
					"Section": "DefaultSection",
					"Group": "DefaultGroup"
				}
			};
			rowCounter += 1;
			switch (schema.properties[p].type)
			{
				case 'string':
				case 'autoguid':
					tmpDescriptor.DataType = 'String';
					break;
				case 'datetime':
				case 'date':
				case 'createdate':
				case 'updatedate':
					tmpDescriptor.DataType = 'String';
					tmpDescriptor.PictForm.InputType = 'DateTime'
					break;
				case 'boolean':
				case 'deleted':
					tmpDescriptor.DataType = 'Boolean';
				case 'integer':
				case 'decimal':
				case 'autoidentity':
				case 'createiduser':
				case 'updateiduser':
				case 'deleteiduser':
					tmpDescriptor.DataType = 'Number';
					break;
				default:
					tmpDescriptor.DataType = 'String';
			}

			const tmpForeignEntity = this.pict.PictSectionRecordSet.resolveForeignEntity(p, this.pict.PictSectionRecordSet.recordSetProviderConfigurations[recordSet], this.pict.providers[this.providerHash].getIDField());
			if (tmpForeignEntity && this.pict.providers['Pict-Section-Picker'])
			{
				// Foreign-key column → searchable entity Picker (edit) + resolved name (read, see the view-mode override).
				tmpDescriptor.PictForm.InputType = 'Picker';
				tmpDescriptor.PictForm.Entity = tmpForeignEntity;
				const tmpForeignConfig = this.pict.PictSectionRecordSet.recordSetProviderConfigurations[tmpForeignEntity];
				if (tmpForeignConfig && tmpForeignConfig.SearchFields) { tmpDescriptor.PictForm.SearchFields = tmpForeignConfig.SearchFields; }
			}
			// Per-record-set label override (e.g. Contract/Project IDOrganization → "Prime Contractor").
			const tmpReadRSConfig = this.pict.PictSectionRecordSet.recordSetProviderConfigurations[recordSet];
			if (tmpReadRSConfig && tmpReadRSConfig.FieldLabels && tmpReadRSConfig.FieldLabels[p]) { tmpDescriptor.Name = tmpReadRSConfig.FieldLabels[p]; }
			// JSON/object columns → embedded ObjectEditor (read-only tree in View, editable in Edit). Driven by the
			// schema column type, with a per-record-set ObjectEditorFields list to opt in string-typed JSON blobs.
			// Gated on the pict-section-form ObjectEditor input being registered (graceful on older form versions).
			const tmpObjectEditorFields = (tmpReadRSConfig && Array.isArray(tmpReadRSConfig.ObjectEditorFields)) ? tmpReadRSConfig.ObjectEditorFields : [];
			if (tmpDescriptor.PictForm.InputType !== 'Picker' && this.pict.providers['Pict-Input-ObjectEditor'] &&
				(schema.properties[p].type === 'object' || schema.properties[p].type === 'json' || tmpObjectEditorFields.includes(p)))
			{
				tmpDescriptor.DataType = 'Object';
				tmpDescriptor.PictForm.InputType = 'ObjectEditor';
			}
			defaultManifest.Descriptors[`${ recordSet }Details.${ p }`] = tmpDescriptor;
		}
		return defaultManifest;
	}

	_generateManifestTemplate(config, section, specificManifest, setBaseManifest, action = this.action, defaultManifest)
	{
		// Look for a manifest by the action (if there is no specific manifest passed) and fallback to view if the action manifest isn't present.
		const tmpManifestHash = specificManifest || config[`RecordSetReadDefaultManifest${ action }`] || config[`RecordSetReadManifests${ action }`]?.[0] || config[`RecordSetReadDefaultManifestView`] || config[`RecordSetReadManifestsView`]?.[0];
		// Make sure the copy of the manifest doesn't mutate the original (for read only handling).
		const tmpManifest = JSON.parse(JSON.stringify(defaultManifest ? defaultManifest : this.pict.PictSectionRecordSet.getManifest(tmpManifestHash)));
		if (!tmpManifest)
		{
			this.pict.log.error(`RecordSetRead: No manifest found for ${ config.RecordSet }. Read Render failed.`);
			return '';
		}
		if (!tmpManifest.Descriptors)
		{
			this.pict.log.error(`RecordSetRead: No manifest descriptors found for manifest ${ tmpManifestHash }. Read Render failed.`);
			return '';
		}
		else if (action == 'View' && !config.RecordSetReadOverrideReadOnly)
		{
			// If we are in view mode, apply the read only type unless overriden.
			for (const x of Object.keys(tmpManifest.Descriptors))
			{
				if (!tmpManifest.Descriptors[x].PictForm)
				{
					tmpManifest.Descriptors[x].PictForm = {};
				}
				// Entity-reference (Picker) fields stay a Picker but render read-only (the resolved entity
				// name as plain text, no dropdown); everything else becomes plain read-only text.
				if (tmpManifest.Descriptors[x].PictForm.InputType === 'Picker') { tmpManifest.Descriptors[x].PictForm.ReadOnly = true; continue; }
				// ObjectEditor stays an ObjectEditor but renders its read-only tree (not a plain text field).
				if (tmpManifest.Descriptors[x].PictForm.InputType === 'ObjectEditor') { tmpManifest.Descriptors[x].PictForm.ReadOnly = true; continue; }
				tmpManifest.Descriptors[x].PictForm.InputType = 'ReadOnly';
			}
		}
		// Suppress identity + audit fields from the body; they surface via the audit header's Details modal.
		if (config.RecordSetReadSuppressAuditFields !== false)
		{
			this._suppressAuditDescriptors(tmpManifest);
		}
		if (setBaseManifest)
		{
			this.manifest = tmpManifest;
		}
		let sectionsTemplate = '';
		// Clear any stale views in PictSectionForm before reinstantiating (if we don't the read only state doesn't get cleared).
		for (const s of tmpManifest?.Sections || [])
		{
			delete this.pict.views[`PictSectionForm-${ s.Hash }`]
		}
		this.pict.views.PictFormMetacontroller.bootstrapPictFormViewsFromManifest(tmpManifest);

		for (const pickList of tmpManifest?.PickLists || [])
		{
			this.pict.providers.DynamicMetaLists.rebuildListByHash(pickList.Hash);
		}

		for (const s of tmpManifest?.Sections || [])
		{
			const viewSectionID = `PSRS-Read-${ section }-Section-${ s.Hash }`;
			sectionsTemplate += /*html*/`<div id="${ viewSectionID }"></div>`;
			this.pict.views[`PictSectionForm-${ s.Hash }`].viewMarshalDestination = 'AppData';
			this.pict.views[`PictSectionForm-${ s.Hash }`].options.DefaultDestinationAddress = `#${ viewSectionID }`;
			this.pict.views[`PictSectionForm-${ s.Hash }`].rebuildCustomTemplate();
		}
		return sectionsTemplate
	}

	async _structureTabs(config, record)
	{
		const validTabs = config.ReadLayout == 'Tab' ? 
		[
			{
				Type: 'Record',
				RecordSet: config.RecordSet,
				Title: config.RecordSetReadTabTitle || 'Record',
				Hash: 'Record',
				Template: /*html*/`
					<div id="PSRS-Tab-Record" class="psrs-tab-body">{~T:PRSP-Read-RecordRead-Template~}</div>
				`,
				TabTemplate: /*html*/`
					<div class="psrs-tab" id="PSRS-TabNav-Record" onclick="_Pict.views['RSP-RecordSet-Read'].setTab('Record')">${ config.RecordSetReadTabTitle || 'Record' }</div>
				`,
				render: () => {}
			}
		] : config.ReadLayout == 'Split' ?
		[
			// Split layout: a leading "Full Record" tab that collapses the association pane back to the
			// record-only view (the record itself lives in the left pane, so this body stays empty).
			{
				Type: 'FullRecord',
				Hash: 'FullRecord',
				Title: config.RecordSetReadFullRecordTabTitle || 'Full Record',
				Template: /*html*/`
					<div id="PSRS-Tab-FullRecord" class="psrs-tab-body"></div>
				`,
				TabTemplate: /*html*/`
					<div class="psrs-tab" id="PSRS-TabNav-FullRecord" onclick="_Pict.views['RSP-RecordSet-Read'].setTab('FullRecord')">${ config.RecordSetReadFullRecordTabTitle || 'Full Record' }</div>
				`,
				render: () => {}
			}
		] : [];

		for (const t of config.RecordSetReadTabs)
		{
			if (!t.Title)
			{
				this.pict.log.info('Skipping tab that is missing title.');
				continue;
			}
			if (!t.Hash)
			{
				t.Hash = t.Title.replaceAll(' ', '');
			}
			if (t.Type == 'Manifest' || t.Type == 'AttachedRecord')
			{
				let recordSetConfig = null;
				let tmpManifest = null;
				if (t.Type == 'AttachedRecord')
				{
					const getMethod = async (remote, id) => {
						if (this.pict.providers[`RSP-Provider-${ remote }`])
						{
							return await this.pict.providers[`RSP-Provider-${ remote }`].getRecord(id);
						}
						else
						{
							return await new Promise((resolve, reject) =>
							{
								this.pict.EntityProvider.getEntity(remote, id, (pError, pResult) =>
								{
									if (pError)
									{
										resolve(null);
									}
									resolve(pResult);
								});
							});
						}
					};

					const getJoin = async (remote, field, value) => {
						let result = null;
						if (this.pict.providers[`RSP-Provider-${ remote }`])
						{
							result = await this.pict.providers[`RSP-Provider-${ remote }`].getRecordsInline(`FBV~${ field }~EQ~${ value }`);
						}
						else
						{
							result = await new Promise((resolve, reject) =>
							{
								this.pict.EntityProvider.getEntitySet(remote, `FBV~${ field }~EQ~${ value }`, (pError, pResult) =>
								{
									if (pError)
									{
										resolve(null);
									}
									resolve(pResult);
								});
							});
						}
						return result?.[0] || null;
					};
					
					if (!t.RecordSet)
					{
						this.pict.log.info(`Skipping attached record tab because no recordset was included.`);
					}
					recordSetConfig = this.pict.PictSectionRecordSet.recordSetProviderConfigurations[t.RecordSet];
					if (!recordSetConfig)
					{
						this.pict.log.info(`Skipping attached record tab because recordset ${ t.RecordSet } is not registered.`);
						continue;
					}
					t.Manifest = recordSetConfig.RecordSetReadDefaultManifestView || recordSetConfig.RecordSetReadManifestsView?.[0];
					tmpManifest = recordSetConfig.RecordSetReadManifestOnly ? this.pict.PictSectionRecordSet.getManifest(t.Manifest) : await this._buildDefaultManifest(recordSetConfig.RecordSetMeadowEntity || recordSetConfig.RecordSet);
					if (!tmpManifest)
					{
						this.pict.log.info(`Skipping manifest tab because manifest ${ t.Manifest } is not registered or default manifest could not be constructed.`);
						continue;
					}
					if (!t.JoinField)
					{
						t.JoinField = this.pict.providers[`RSP-Provider-${ t.RecordSet }`].getIDField();
					}
					if (t.JoiningRecordSet)
					{
						if (!t.BaseField)
						{
							t.BaseField = this.pict.providers[`RSP-Provider-${ config.RecordSet }`].getIDField();
						}
						if (!record[t.BaseField])
						{
							this.pict.log.info(`Skipping attached record tab because field ${ t.BaseField } does not exist on this record.`);
							continue;
						}
						const tempJoin = await getJoin(t.JoiningRecordSet, t.BaseField, record[t.BaseField]);
						if (!tempJoin?.[t.JoinField])
						{
							this.pict.log.info(`Skipping attached record tab because joining field ${ t.JoinField } does not exist on this record.`);
							continue;
						}
						const tempRecord = await getMethod(recordSetConfig.RecordSetMeadowEntity || recordSetConfig.RecordSet, tempJoin[t.JoinField]);
						this.pict.AppData[`${ t.RecordSet }Details`] = tempRecord;
					}
					else
					{
						if (!record[t.Joinfield])
						{
							this.pict.log.info(`Skipping attached record tab because joining field ${ t.JoinField } does not exist on this record.`);
							continue;
						}
						const tempRecord = await getMethod(recordSetConfig.RecordSetMeadowEntity || recordSetConfig.RecordSet, record[t.Joinfield]);
						this.pict.AppData[`${ t.RecordSet }Details`] = tempRecord;
					}
				}
				if (!tmpManifest)
				{
					tmpManifest = this.pict.PictSectionRecordSet.getManifest(t.Manifest);
				}
				t.Template = /*html*/`
					<div id="PSRS-Tab-${ t.Hash }" class="psrs-tab-body">${ this._generateManifestTemplate(config, 'RecordTab', t.Manifest, false, 'View', recordSetConfig && !recordSetConfig.RecordSetReadManifestOnly ? tmpManifest : null) }</div>
				`;
				t.TabTemplate = /*html*/`
					<div class="psrs-tab" id="PSRS-TabNav-${ t.Hash }" onclick="_Pict.views['RSP-RecordSet-Read'].setTab('${ t.Hash }')">${ t.Title }</div>
				`;
				t.render = () =>
				{
					// @ts-ignore
					for (const s of tmpManifest?.Sections || [])
					{
						this.pict.views[`PictSectionForm-${ s.Hash }`].render();
						this.pict.views[`PictSectionForm-${ s.Hash }`].marshalToView();
					}
				};
				validTabs.push(t);
			}
			else if (t.Type == 'View')
			{
				if (!t.View)
				{
					this.pict.log.info(`Skipping view tab because no view was included.`);
					continue;
				}
				const tmpView = this.pict.views[t.View];
				if (!tmpView)
				{
					this.pict.log.info(`Skipping view tab because view ${ t.View } is not registered.`);
					continue;
				}
				t.Template = /*html*/`
					<div id="PSRS-Tab-${ t.Hash }" class="psrs-tab-body"></div>
				`;
				t.TabTemplate = /*html*/`
					<div class="psrs-tab" id="PSRS-TabNav-${ t.Hash }" onclick="_Pict.views['RSP-RecordSet-Read'].setTab('${ t.Hash }')">${ t.Title }</div>
				`;
				tmpView.options.DefaultDestinationAddress = `#PSRS-Tab-${ t.Hash }`;
				t.render = () =>
				{
					this.pict.views[`${ t.View }`].renderAsync();
				};
				validTabs.push(t);
			}
			else if (t.Type == 'Association')
			{
				// An embeddable join-management widget for one association, anchored on THIS record.
				// Opt-in is light: a RecordSetReadTabs entry naming an Association registered in
				// settings.Associations. The manager resolves which side is "this side" from the
				// rendering recordset, so opting in Book->Authors and Author->Books are independent.
				const tmpAssociationManager = this.pict.providers.RecordSetAssociationManager;
				if (!tmpAssociationManager || !t.Association)
				{
					this.pict.log.info(`Skipping association tab because no association was included (or the manager is missing).`);
					continue;
				}
				const tmpSides = tmpAssociationManager.resolveSides(t.Association, config.RecordSet);
				if (!tmpSides)
				{
					this.pict.log.info(`Skipping association tab because association ${ t.Association } could not be resolved for ${ config.RecordSet }.`);
					continue;
				}
				const tmpEditorHash = `RSP-AssocEditor-${ config.RecordSet }-${ t.Association }`;
				if (!this.pict.views[tmpEditorHash])
				{
					this.pict.addView(tmpEditorHash, Object.assign({}, libViewAssociationEditor.default_configuration,
						{
							ViewIdentifier: tmpEditorHash,
							AssociationHash: t.Association,
							ThisRecordSet: config.RecordSet,
							DefaultDestinationAddress: `#PSRS-Tab-${ t.Hash }`,
							PickerMode: t.PickerMode || 'single',
						}), libViewAssociationEditor);
				}
				const tmpEditorView = this.pict.views[tmpEditorHash];
				tmpEditorView.options.AssociationHash = t.Association;
				tmpEditorView.options.ThisRecordSet = config.RecordSet;
				tmpEditorView.options.ThisID = record[tmpSides.thisSide.IDField];
				tmpEditorView.options.DefaultDestinationAddress = `#PSRS-Tab-${ t.Hash }`;
				tmpEditorView.options.PickerMode = t.PickerMode || 'single';
				t.Template = /*html*/`
					<div id="PSRS-Tab-${ t.Hash }" class="psrs-tab-body"></div>
				`;
				t.TabTemplate = /*html*/`
					<div class="psrs-tab" id="PSRS-TabNav-${ t.Hash }" onclick="_Pict.views['RSP-RecordSet-Read'].setTab('${ t.Hash }')">${ t.Title }</div>
				`;
				t.renderAsync = async () =>
				{
					tmpEditorView.options.ThisID = record[tmpSides.thisSide.IDField];
					tmpEditorView.options.DefaultDestinationAddress = `#PSRS-Tab-${ t.Hash }`;
					await tmpEditorView.renderEditor();
				};
				validTabs.push(t);
			}
		}
		return validTabs;
	}

	onInitialize()
	{

		// Add the route templates for the read view
		this.pict.PictSectionRecordSet.addRecordLinkTemplate('PRSP-Read-Link-Name-Template', 'PRSP-Read-Link-URL-Template', true);

		return super.onInitialize();
	}
}

module.exports = viewRecordSetRead;

module.exports.default_configuration = _DEFAULT_CONFIGURATION__Read;

