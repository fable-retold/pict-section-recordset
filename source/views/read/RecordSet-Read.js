const libPictRecordSetRecordView = require('../RecordSet-RecordBaseView.js');

// Identity + audit field names stamped on (virtually) every Meadow entity. These are
// surfaced through the record audit header (the first-class activity line + the Details
// modal), not inline in the record body. The entity's own ID/GUID field names are added
// at suppression time via the provider's getIDField()/getGUIDField().
const _AUDIT_FIELD_NAMES = ['CreatingIDUser', 'UpdatingIDUser', 'DeletingIDUser', 'Deleted', 'CreateDate', 'UpdateDate', 'DeleteDate'];

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
			.prsp-audit-popover { position: absolute; top: calc(100% + 8px); right: 0; min-width: 320px; max-width: 90vw; background: var(--theme-color-background-panel, #fff); border: 1px solid var(--theme-color-border-default, #d7dce3); border-radius: 10px; box-shadow: 0 14px 36px rgba(15, 23, 42, 0.18); padding: 1rem 1.1rem; z-index: 40; display: none; }
			.prsp-audit-popover.is-open { display: block; }
			.prsp-audit-dl { display: grid; grid-template-columns: auto 1fr; gap: 0.6rem 1rem; align-items: baseline; margin: 0; }
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
						</style>
						<div class="record-button-bar">
							<button id="PRSP-Read-CancelButton" type="button" onclick="_Pict.views['RSP-RecordSet-Read'].cancel()">Cancel</button>
							<button id="PRSP-Read-SaveButton" type="button" onclick="_Pict.views['RSP-RecordSet-Read'].save()">Save</button>
							<button id="PRSP-Read-EditButton" type="button" onclick="_Pict.views['RSP-RecordSet-Read'].edit()">Edit</button>
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
					Hash: 'PRSP-Read-Basic-Template',
					Template: /*html*/`
						<!-- DefaultPackage pict view template: [PRSP-Read-Basic-Template] -->
						<h1>{~D:Record.RecordSet~} {~D:Record.GUIDAddress~} [{~D:Record.RecordConfiguration.GUIDRecord~}]</h1>
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
						<h1>{~D:Record.RecordSet~} {~D:Record.GUIDAddress~} [{~D:Record.RecordConfiguration.GUIDRecord~}]</h1>
						<!--
						{~DJ:Record~}
						-->
						<style>
							.psrs-split-view
							{
								display: flex;
								height: 100%;
							}
							.psrs-left-panel
							{
								overflow: scroll;
							}
							.psrs-right-panel
							{
								overflow: scroll;
							}
							#psrs-resize
							{
								width: 1px; 
								padding-left: 10px;
								padding-right: 10px;
								cursor: col-resize;
							}
							#psrs-resize > div
							{
								width: 1px;
								height: 100%;
								background-color: rgba(0,0,0,0.5);
							}
							#PRSP-Read-Tab-Nav
							{
								display: flex;
								border-bottom: 1px solid rgba(0,0,0,0.5);
								margin-bottom: 20px;
								width: 100%;
							}
							.psrs-tab.is-active
							{
								border: 1px solid rgba(0,0,0,0.5);
							}
							.psrs-tab
							{
								border-right: 1px solid rgba(0,0,0,0.5);
								border-left: 1px solid rgba(0,0,0,0.5);
								padding: 10px;
							}
							.psrs-tab-body
							{
								display: none;
							}
							.psrs-tab-body.is-active
							{
								display: inherit;
							}
						</style>
						<div class="psrs-split-view">
							<div class="psrs-left-panel" style="min-width: 50%;">
								{~T:PRSP-Read-RecordRead-Template~}
							</div>
							<div id="psrs-resize">
								<div></div>
							</div>
							<div class="psrs-right-panel" style="width: 100%;">
								<div id="PRSP-Read-Tabs-Container">
									{~T:PRSP-Read-RecordTabNav-Template~}
									{~T:PRSP-Read-RecordTab-Template~}
								</div>
							</div>
						</div>
						<!-- DefaultPackage end view template:  [PRSP-Read-Split-Template] -->
						`
				},
				{
					Hash: 'PRSP-Read-Tab-Template',
					Template: /*html*/`
						<!-- DefaultPackage pict view template: [PRSP-Read-Tab-Template] -->
						<h1>{~D:Record.RecordSet~} {~D:Record.GUIDAddress~} [{~D:Record.RecordConfiguration.GUIDRecord~}]</h1>
						<!--
						{~DJ:Record~}
						-->
						<style>
							#PRSP-Read-Tab-Nav
							{
								display: flex;
								border-bottom: 1px solid rgba(0,0,0,0.5);
								margin-bottom: 20px;
								width: 100%;
							}
							.psrs-tab.is-active
							{
								border: 1px solid rgba(0,0,0,0.5);
							}
							.psrs-tab
							{
								padding: 10px;
								border-right: 1px solid rgba(0,0,0,0.5);
								border-left: 1px solid rgba(0,0,0,0.5);
							}
							.psrs-tab-body
							{
								display: none;
							}
							.psrs-tab-body.is-active
							{
								display: inherit;
							}
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
			DeletedBannerSlot: (!!pRecord.Deleted) ? [{ Date: pRecord.DeleteDate, UserID: pRecord.DeletingIDUser, HasDate: this._validAuditDate(pRecord.DeleteDate) }] : []
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
		const tmpSuppress = _AUDIT_FIELD_NAMES.slice();
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
					if (t.renderAsync)
					{
						await t.renderAsync();
					}
					else
					{
						t.render();
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
				this.setTab(this.activeTab || this.tabs?.[0]?.Hash);
				return true;
			}.bind(this));
	}

	async setTab(t)
	{
		if (this.activeTab !== t)
		{
			await this.onBeforeTabChange();
		}
		this.activeTab = t;
		const tabSet = document.querySelectorAll('.psrs-tab');
		const tabBodySet = document.querySelectorAll('.psrs-tab-body');
		for (const tb of tabSet)
		{
			tb.classList.remove('is-active');
			if (tb.id == `PSRS-TabNav-${ t }`)
			{
				tb.classList.add('is-active');
			}
		}
		for (const tb of tabBodySet)
		{
			tb.classList.remove('is-active');
			if (tb.id == `PSRS-Tab-${ t }`)
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
			const exclusionSet = [this.pict.providers[this.providerHash].getIDField(), this.pict.providers[this.providerHash].getGUIDField()].concat(_AUDIT_FIELD_NAMES);
			if (exclusionSet.includes(p))
			{
				continue;
			}
			const tmpDescriptor =
			{
				"Name": `${ this.pict.providers[providerHash].getHumanReadableFieldName?.() || p }`,
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

