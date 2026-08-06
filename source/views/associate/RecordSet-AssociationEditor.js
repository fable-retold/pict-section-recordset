const libPictView = require('pict-view');

/**
 * The Association Editor — a small, embeddable widget that manages one many-to-many association from
 * the perspective of a single anchor record (e.g. the Authors of THIS book). It renders:
 *   - a searchable entity picker of the OTHER side, with the currently-associated rows culled out, and
 *   - a list of the current associations, each with a remove button.
 *
 * It is instantiated once per (anchor recordset, association) by the read view's Association tab, with
 * a unique Hash. All join + display data flows through the shared `RecordSetAssociationManager`; the
 * picker comes from `pict-section-picker` (a soft dependency — the host registers it as
 * `Pict-Section-Picker`). Instance-specific state is passed via the render Record (not a per-instance
 * AppData address), so the shared templates stay address-stable across instances.
 *
 * Configuration (set by the read view when it creates the instance):
 *   - AssociationHash {string}  - the association to manage.
 *   - ThisRecordSet {string}    - the anchor recordset name (resolves which side is "this side").
 *   - ThisID {string|number}    - the anchor record's id (re-set before each render).
 *   - DefaultDestinationAddress - the tab body to render into.
 *   - PickerMode {'single'|'multi'} - the add control: 'single' (default) stages one pick that an
 *       explicit Add button (or Enter) commits; 'multi' stages chips that one Add commits together.
 *       Driven from the RecordSetReadTabs Association entry's PickerMode.
 */

/** @type {Record<string, any>} */
const _DEFAULT_CONFIGURATION_AssociationEditor = (
	{
		ViewIdentifier: 'PRSP-AssociationEditor',

		DefaultRenderable: 'PRSP_Renderable_AssociationEditor',
		DefaultDestinationAddress: '#PRSP_AssociationEditor_Container',
		DefaultTemplateRecordAddress: false,

		// Show the "Add defaults" affordance when the association has a defaults synthesizer. Set false
		// on an instance where synthesis is directionally meaningless (e.g. anchored on the type side of
		// a "seed a project with default types" synthesizer) — the synthesizer stays registered for the
		// side it applies to; this just hides the button on the side it does not.
		AllowSynthesize: true,

		AutoInitialize: false,
		AutoInitializeOrdinal: 0,
		AutoRender: false,
		AutoRenderOrdinal: 0,
		AutoSolveWithApp: false,
		AutoSolveOrdinal: 0,

		CSS: /*css*/`
		.prsp-assoc { display: flex; flex-direction: column; gap: 0.85rem; padding: 0.25rem 0 0.5rem; }
		.prsp-assoc-add { display: flex; flex-direction: column; gap: 0.35rem; }
		.prsp-assoc-add-label { font-size: 0.72rem; font-weight: 650; text-transform: uppercase; letter-spacing: 0.05em; color: var(--theme-color-text-muted, #6b7686); }
		.prsp-assoc-add-row { display: flex; align-items: flex-start; gap: 0.5rem; }
		.prsp-assoc-picker-host { flex: 1 1 auto; min-width: 0; max-width: 460px; }
		.prsp-assoc-add-btn { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; font: inherit; font-size: 0.9rem; font-weight: 600;
			padding: 0.45rem 0.85rem; border-radius: 8px; border: 1px solid var(--theme-color-brand-primary, #156dd1);
			background: var(--theme-color-brand-primary, #156dd1); color: #fff; }
		.prsp-assoc-add-btn:hover { background: var(--theme-color-brand-primary-hover, #1259ad); }
		.prsp-assoc-list { display: flex; flex-direction: column; gap: 0.3rem; }
		.prsp-assoc-list-head { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
		.prsp-assoc-list-title { font-size: 0.72rem; font-weight: 650; text-transform: uppercase; letter-spacing: 0.05em; color: var(--theme-color-text-muted, #6b7686); }
		.prsp-assoc-count { font-size: 0.78rem; color: var(--theme-color-text-muted, #6b7686); }
		.prsp-assoc-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.45rem 0.6rem; border: 1px solid var(--theme-color-border-light, #e8ebf0); border-radius: 8px;
			background: var(--theme-color-background-primary, #fff); }
		.prsp-assoc-row:hover { border-color: var(--theme-color-border-default, #d7dce3); }
		.prsp-assoc-row-name { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--theme-color-text-primary, #1f2733); font-size: 0.92rem; }
		.prsp-assoc-row-chips { flex: 1 1 auto; display: flex; flex-wrap: wrap; gap: 0.3rem; min-width: 0; }
		.prsp-assoc-chip { flex: 0 0 auto; display: inline-flex; align-items: center; font-size: 0.72rem; font-weight: 600; line-height: 1.25;
			padding: 0.05rem 0.4rem; border-radius: 5px; white-space: nowrap;
			background: var(--theme-color-background-tertiary, #eceef2); color: var(--theme-color-text-secondary, #45596b); }
		.prsp-assoc-status { flex: 0 0 auto; display: inline-flex; align-items: center; font-size: 0.68rem; font-weight: 700; line-height: 1.2; text-transform: uppercase; letter-spacing: 0.03em;
			padding: 0.08rem 0.42rem; border-radius: 999px; white-space: nowrap; }
		.prsp-assoc-status.is-expired { background: color-mix(in srgb, var(--theme-color-status-error, #b62828) 14%, transparent); color: var(--theme-color-status-error, #b62828); }
		.prsp-assoc-status.is-pending { background: color-mix(in srgb, var(--theme-color-status-warning, #b7791f) 16%, transparent); color: var(--theme-color-status-warning, #97650f); }
		.prsp-assoc-row-id { flex: 0 0 auto; font-size: 0.74rem; color: var(--theme-color-text-muted, #6b7686); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
		.prsp-assoc-remove { flex: 0 0 auto; display: inline-flex; align-items: center; cursor: pointer; border: none; background: transparent; color: var(--theme-color-text-muted, #6b7686); padding: 0.2rem; border-radius: 5px; font: inherit; }
		.prsp-assoc-remove:hover { color: var(--theme-color-status-error, #b62828); background: color-mix(in srgb, var(--theme-color-status-error, #b62828) 10%, transparent); }
		.prsp-assoc-empty { padding: 0.7rem 0.2rem; color: var(--theme-color-text-muted, #6b7686); font-size: 0.88rem; font-style: italic; }
		.prsp-assoc-note { color: var(--theme-color-status-error, #b62828); font-size: 0.86rem; }
		.prsp-assoc-head-right { display: flex; align-items: center; gap: 0.6rem; }
		.prsp-assoc-synth-btn { display: inline-flex; align-items: center; gap: 0.3rem; cursor: pointer; font: inherit; font-size: 0.76rem; font-weight: 600;
			padding: 0.2rem 0.55rem; border-radius: 6px; border: 1px solid var(--theme-color-border-default, #d7dce3);
			background: var(--theme-color-background-tertiary, #eceef2); color: var(--theme-color-text-secondary, #45596b); }
		.prsp-assoc-synth-btn:hover { background: var(--theme-color-background-secondary, #e2e6ec); }
		.prsp-assoc-row-cfg { flex: 0 0 auto; display: flex; align-items: center; gap: 0.65rem; }
		.prsp-assoc-cfg { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.78rem; color: var(--theme-color-text-secondary, #45596b); white-space: nowrap; cursor: default; }
		.prsp-assoc-cfg input[type="checkbox"] { cursor: pointer; }
		.prsp-assoc-cfg-num { width: 3.4rem; font: inherit; font-size: 0.8rem; padding: 0.1rem 0.3rem; border: 1px solid var(--theme-color-border-light, #e8ebf0); border-radius: 5px; }
		.prsp-assoc-cfg-sel { font: inherit; font-size: 0.8rem; padding: 0.05rem 0.2rem; border: 1px solid var(--theme-color-border-light, #e8ebf0); border-radius: 5px; }
		`,
		CSSPriority: 500,

		Templates:
		[
			{
				Hash: 'PRSP-AssociationEditor-Template',
				Template: /*html*/`
		<!-- DefaultPackage pict view template: [PRSP-AssociationEditor-Template] -->
		<div class="prsp-assoc">
			<div class="prsp-assoc-add">
				<span class="prsp-assoc-add-label">{~D:Record.AddLabel~}</span>
				<div class="prsp-assoc-add-row">
					<div class="prsp-assoc-picker-host" id="{~D:Record.PickerHostID~}"></div>
					<button type="button" class="prsp-assoc-add-btn" id="{~D:Record.AddButtonID~}" onclick="_Pict.views['{~D:Record.ViewHash~}'].addStaged()" onkeydown="if (event.key === 'Enter') { event.preventDefault(); _Pict.views['{~D:Record.ViewHash~}'].addStaged(); }">{~I:Plus~} {~D:Record.AddButtonLabel~}</button>
				</div>
				{~NE:Record.PickerMissing^<div class="prsp-assoc-note">The entity picker (pict-section-picker) is not registered, so associations cannot be added here.</div>~}
			</div>
			<div class="prsp-assoc-list">
				<div class="prsp-assoc-list-head">
					<span class="prsp-assoc-list-title">{~D:Record.ListLabel~}</span>
					<span class="prsp-assoc-head-right">
						<span class="prsp-assoc-count">{~D:Record.Count~}</span>
						{~TS:PRSP-AssociationEditor-SynthBtn:Record.SynthesizeSlot~}
					</span>
				</div>
				{~TS:PRSP-AssociationEditor-Row:Record.Items~}
				{~TS:PRSP-AssociationEditor-Empty:Record.EmptySlot~}
			</div>
		</div>
		<!-- DefaultPackage end view template:  [PRSP-AssociationEditor-Template] -->
	`
			},
			{
				Hash: 'PRSP-AssociationEditor-Empty',
				Template: /*html*/`<div class="prsp-assoc-empty">{~D:Record.EmptyText~}</div>`
			},
			{
				Hash: 'PRSP-AssociationEditor-Row',
				Template: /*html*/`
		<div class="prsp-assoc-row">
			<span class="prsp-assoc-row-name">{~RecordCard:Record.CardRecordSet^Record.OtherID^Record.Display~}</span>
			{~TS:PRSP-AssociationEditor-Status:Record.StatusBadgeSlot~}
			<span class="prsp-assoc-row-chips">{~TS:PRSP-AssociationEditor-Chip:Record.Chips~}</span>
			<span class="prsp-assoc-row-cfg">{~TS:PRSP-AssociationEditor-EditField:Record.EditFields~}</span>
			<span class="prsp-assoc-row-id">#{~D:Record.OtherID~}</span>
			<button type="button" class="prsp-assoc-remove" title="Remove association" onclick="_Pict.views['{~D:Record.ViewHash~}'].removeItem({~D:Record.JoinID~})">{~I:Trash~}</button>
		</div>
	`
			},
			{
				Hash: 'PRSP-AssociationEditor-Chip',
				Template: /*html*/`<span class="prsp-assoc-chip">{~D:Record.Text~}</span>`
			},
			{
				// A read-only status pill derived from the join record's lifecycle dates (Expired /
				// Not yet effective). Present only when a date column signals it — see _computeStatusBadge.
				Hash: 'PRSP-AssociationEditor-Status',
				Template: /*html*/`<span class="prsp-assoc-status {~D:Record.Class~}" title="{~D:Record.Title~}">{~D:Record.Text~}</span>`
			},
			{
				Hash: 'PRSP-AssociationEditor-SynthBtn',
				Template: /*html*/`<button type="button" class="prsp-assoc-synth-btn" title="Add the default associations" onclick="_Pict.views['{~D:Record.ViewHash~}'].synthesizeDefaults()">{~I:Download~} Add defaults</button>`
			},
			{
				// One editable per-join config control (a "rich" join's settings, e.g. Journal / Spreadsheet
				// / Ordinal). The kind flags pick the input; onchange writes through to the join row.
				Hash: 'PRSP-AssociationEditor-EditField',
				Template: /*html*/`{~TIfAbs:PRSP-AssociationEditor-EditCheckbox:Record:Record.IsCheckbox^TRUE^~}{~TIfAbs:PRSP-AssociationEditor-EditNumber:Record:Record.IsNumber^TRUE^~}{~TIfAbs:PRSP-AssociationEditor-EditSelect:Record:Record.IsSelect^TRUE^~}{~TIfAbs:PRSP-AssociationEditor-EditText:Record:Record.IsText^TRUE^~}`
			},
			{
				Hash: 'PRSP-AssociationEditor-EditCheckbox',
				Template: /*html*/`<label class="prsp-assoc-cfg"><input type="checkbox" {~D:Record.CheckedAttr~} onchange="_Pict.views['{~D:Record.ViewHash~}'].updateField({~D:Record.JoinID~},'{~D:Record.Field~}',this.checked)" />{~D:Record.Label~}</label>`
			},
			{
				Hash: 'PRSP-AssociationEditor-EditNumber',
				Template: /*html*/`<label class="prsp-assoc-cfg">{~D:Record.Label~}<input type="number" class="prsp-assoc-cfg-num" value="{~D:Record.Value~}" onchange="_Pict.views['{~D:Record.ViewHash~}'].updateField({~D:Record.JoinID~},'{~D:Record.Field~}',this.value)" /></label>`
			},
			{
				Hash: 'PRSP-AssociationEditor-EditSelect',
				Template: /*html*/`<label class="prsp-assoc-cfg">{~D:Record.Label~}<select class="prsp-assoc-cfg-sel" onchange="_Pict.views['{~D:Record.ViewHash~}'].updateField({~D:Record.JoinID~},'{~D:Record.Field~}',this.value)">{~TS:PRSP-AssociationEditor-EditOption:Record.Options~}</select></label>`
			},
			{
				Hash: 'PRSP-AssociationEditor-EditText',
				Template: /*html*/`<label class="prsp-assoc-cfg">{~D:Record.Label~}<input type="text" class="prsp-assoc-cfg-sel" value="{~D:Record.Value~}" onchange="_Pict.views['{~D:Record.ViewHash~}'].updateField({~D:Record.JoinID~},'{~D:Record.Field~}',this.value)" /></label>`
			},
			{
				Hash: 'PRSP-AssociationEditor-EditOption',
				Template: /*html*/`<option value="{~D:Record.Value~}" {~D:Record.SelectedAttr~}>{~D:Record.Label~}</option>`
			}
		],

		Renderables:
		[
			{
				RenderableHash: 'PRSP_Renderable_AssociationEditor',
				TemplateHash: 'PRSP-AssociationEditor-Template',
				ContentDestinationAddress: '#PRSP_AssociationEditor_Container',
				RenderMethod: 'replace'
			}
		],

		Manifests: {}
	});

class viewRecordSetAssociationEditor extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DEFAULT_CONFIGURATION_AssociationEditor, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		/** @type {import('pict')} */
		this.pict;

		// The other-side ids currently associated (the live cull set the picker reads via a closure).
		this._otherIDs = [];
		// The current list items (so removeItem/updateField can find the exact join record by JoinID).
		this._lastItems = [];
		// Guard so AutoSynthesizeWhenEmpty runs at most once per anchor (no re-synthesize loop).
		this._autoSynthesizedFor = null;
	}

	/** @return {any} The association manager provider. */
	get manager()
	{
		return this.pict.providers.RecordSetAssociationManager;
	}

	/** @return {string} A DOM/address-safe key derived from this instance's Hash. */
	get safeKey()
	{
		return String(this.Hash).replace(/[^A-Za-z0-9]/g, '_');
	}

	/**
	 * Load the current associations and (re)paint the whole widget, then mount the picker. This is the
	 * editor's entry point — the read view's Association tab calls it (not the framework `render()`),
	 * so the async data load happens before the template renders (the read-view pattern).
	 *
	 * @return {Promise<boolean>}
	 */
	async renderEditor()
	{
		const tmpSides = this.manager ? this.manager.resolveSides(this.options.AssociationHash, this.options.ThisRecordSet) : false;
		if (!tmpSides)
		{
			this.pict.log.warn(`AssociationEditor [${this.Hash}]: association [${this.options.AssociationHash}] could not be resolved for [${this.options.ThisRecordSet}].`);
			return false;
		}

		const tmpThisID = this.options.ThisID;
		let tmpItems = [];
		if (tmpThisID !== undefined && tmpThisID !== null && tmpThisID !== '')
		{
			tmpItems = await this.manager.listAssociatedRecords(this.options.AssociationHash, this.options.ThisRecordSet, tmpThisID);

			// Opt-in: synthesize the default associations the first time an empty anchor is opened.
			const tmpAssociation = this.manager.getAssociation(this.options.AssociationHash);
			if (tmpAssociation && tmpAssociation.AutoSynthesizeWhenEmpty && (tmpItems.length === 0)
				&& this.manager.hasDefaultSynthesizer(this.options.AssociationHash) && (this._autoSynthesizedFor !== `${tmpThisID}`))
			{
				this._autoSynthesizedFor = `${tmpThisID}`;
				const tmpSynth = await this.manager.synthesizeDefaults(this.options.AssociationHash, this.options.ThisRecordSet, tmpThisID);
				if (tmpSynth && (tmpSynth.created > 0))
				{
					tmpItems = await this.manager.listAssociatedRecords(this.options.AssociationHash, this.options.ThisRecordSet, tmpThisID);
				}
			}
		}

		// Per-join editable config controls (for "rich" joins) — empty array for a plain link.
		const tmpEditableFields = this.manager.getJoinEditableFields(this.options.AssociationHash);
		// Auto record-preview-card: when a card is registered for the other side, each row's name becomes a
		// preview-card trigger (the {~RecordCard:~} tag degrades to the plain name when CardRecordSet is '').
		const tmpCardManager = this.pict.providers.RecordSetCardManager;
		const tmpCardRecordSet = (tmpCardManager && tmpCardManager.hasCard(tmpSides.otherSide.RecordSet)) ? tmpSides.otherSide.RecordSet : '';
		// Stamp the view hash + the editable controls on each row.
		for (let i = 0; i < tmpItems.length; i++)
		{
			tmpItems[i].ViewHash = this.Hash;
			tmpItems[i].EditFields = this._buildEditFields(tmpEditableFields, tmpItems[i]);
			tmpItems[i].CardRecordSet = tmpCardRecordSet;
			tmpItems[i].StatusBadgeSlot = this._computeStatusBadge(tmpItems[i].JoinRecord);
		}
		this._lastItems = tmpItems;
		this._otherIDs = tmpItems.map((pItem) => pItem.OtherID);

		const tmpOtherLabel = tmpSides.otherSide.Title || tmpSides.otherSide.RecordSet || tmpSides.otherSide.Entity;
		const tmpPickerPresent = !!this.pict.providers['Pict-Section-Picker'];
		const tmpRecord =
		{
			ViewHash: this.Hash,
			PickerHostID: `${this.safeKey}_Picker`,
			AddButtonID: `${this.safeKey}_AddBtn`,
			AddButtonLabel: (this.options.PickerMode === 'multi') ? 'Add selected' : 'Add',
			AddLabel: `Add ${tmpOtherLabel}`,
			ListLabel: `Current ${tmpOtherLabel}`,
			Count: `${tmpItems.length} ${tmpItems.length === 1 ? 'record' : 'records'}`,
			Items: tmpItems,
			// One-or-zero-element slot drives the empty-state line (TS parses inner tags; NE would not).
			EmptySlot: (tmpItems.length === 0) ? [ { EmptyText: `No ${tmpOtherLabel} associated yet — use the search above to add some.` } ] : [],
			PickerMissing: !tmpPickerPresent,
			// The "Add defaults" button shows only when the host registered a defaults synthesizer AND this
			// instance opts in (AllowSynthesize, default true) — an embedding anchored on the side the
			// synthesizer does not apply to sets AllowSynthesize:false to hide it.
			SynthesizeSlot: ((this.options.AllowSynthesize !== false) && this.manager.hasDefaultSynthesizer(this.options.AssociationHash)) ? [ { ViewHash: this.Hash } ] : [],
		};

		return new Promise((resolve) =>
		{
			this.renderAsync(this.options.DefaultRenderable, this.options.DefaultDestinationAddress, tmpRecord,
				(pError) =>
				{
					if (pError)
					{
						this.pict.log.error(`AssociationEditor [${this.Hash}]: render error.`, pError);
						return resolve(false);
					}
					this._mountPicker(tmpSides, tmpRecord.PickerHostID);
					this.pict.CSSMap.injectCSS();
					return resolve(true);
				});
		});
	}

	/**
	 * Create (or reconfigure) the other-side entity picker into its host element and render it. The
	 * picker's BaseFilter culls the currently-associated ids via a closure over `this._otherIDs`, so it
	 * re-evaluates on every search as associations change.
	 *
	 * @param {Record<string, any>} pSides - resolved sides from the manager.
	 * @param {string} pPickerHostID - the picker host element id.
	 */
	_mountPicker(pSides, pPickerHostID)
	{
		const tmpPickerProvider = this.pict.providers['Pict-Section-Picker'];
		if (!tmpPickerProvider)
		{
			return;
		}
		const tmpPickerHash = `${this.safeKey}_PickerView`;
		const tmpValueAddress = `AppData.PRSPAssocPicker.${this.safeKey}`;
		const tmpMulti = (this.options.PickerMode === 'multi');
		// Reset the scratch value so the picker mounts empty (and re-culls) after each add.
		if (!this.pict.AppData.PRSPAssocPicker) { this.pict.AppData.PRSPAssocPicker = {}; }
		this.pict.AppData.PRSPAssocPicker[this.safeKey] = tmpMulti ? [] : null;

		const tmpConfig = this.manager.buildOtherPickerConfig(this.options.AssociationHash, this.options.ThisRecordSet, () => this._otherIDs,
			{
				Mode: tmpMulti ? 'multi' : 'single',
				DestinationAddress: `#${pPickerHostID}`,
				ValueAddress: tmpValueAddress,
				Placeholder: `Search ${pSides.otherSide.Title || pSides.otherSide.RecordSet || pSides.otherSide.Entity}…`,
				// No add-on-select: a single-select pick just stages the value and moves focus to the Add
				// button (so Enter commits). Multi mode stages chips; the Add button commits them.
				OnChange: tmpMulti ? undefined : (() => this._focusAddButton()),
			});
		if (!tmpConfig)
		{
			return;
		}
		tmpPickerProvider.createEntityPicker(tmpPickerHash, tmpConfig);
		this.pict.views[tmpPickerHash].render();
	}

	/** Move focus to the Add button so a single-select pick can be committed by pressing Enter. */
	_focusAddButton()
	{
		const tmpButton = document.getElementById(`${this.safeKey}_AddBtn`);
		if (tmpButton)
		{
			tmpButton.focus();
		}
	}

	/**
	 * Commit the staged selection(s) — the Add button (and Enter). Reads the picker's value: a single
	 * scalar, or (multi mode) an array of ids. Creates a join for each, then reloads + repaints so the
	 * new rows appear and are culled from the picker.
	 *
	 * @return {Promise<void>}
	 */
	async addStaged()
	{
		const tmpStaged = this.pict.AppData.PRSPAssocPicker ? this.pict.AppData.PRSPAssocPicker[this.safeKey] : null;
		const tmpIDs = (this.options.PickerMode === 'multi')
			? (Array.isArray(tmpStaged) ? tmpStaged.slice() : [])
			: ((tmpStaged === undefined || tmpStaged === null || tmpStaged === '') ? [] : [ tmpStaged ]);
		if (tmpIDs.length < 1)
		{
			return;
		}
		let tmpFailures = 0;
		for (let i = 0; i < tmpIDs.length; i++)
		{
			try
			{
				await this.manager.createJoin(this.options.AssociationHash, this.options.ThisRecordSet, this.options.ThisID, tmpIDs[i]);
			}
			catch (pError)
			{
				tmpFailures++;
				this.pict.log.error(`AssociationEditor [${this.Hash}]: failed to create association for ${tmpIDs[i]}.`, pError);
			}
		}
		if (tmpFailures > 0)
		{
			this._toast(`${tmpFailures} association(s) could not be added.`, 'error');
		}
		await this.renderEditor();
	}

	/**
	 * Remove one association (a list row's remove handler). Confirms via the host modal, deletes the
	 * join, then reloads + repaints.
	 *
	 * @param {string|number} pJoinID - the join record id to delete.
	 * @return {Promise<void>}
	 */
	async removeItem(pJoinID)
	{
		const tmpItem = this._lastItems.find((pItem) => String(pItem.JoinID) === String(pJoinID));
		if (!tmpItem)
		{
			return;
		}
		const fRemove = async () =>
		{
			try
			{
				await this.manager.removeJoin(this.options.AssociationHash, tmpItem.JoinRecord);
			}
			catch (pError)
			{
				this.pict.log.error(`AssociationEditor [${this.Hash}]: failed to remove association.`, pError);
				this._toast('Could not remove the association.', 'error');
				return;
			}
			await this.renderEditor();
		};

		const tmpModal = this.pict.views['Pict-Section-Modal'];
		if (tmpModal && typeof tmpModal.confirm === 'function')
		{
			const tmpOk = await tmpModal.confirm(`Remove the association with "${tmpItem.Display}"?`,
				{ title: 'Remove association', confirmLabel: 'Remove', cancelLabel: 'Cancel', dangerous: true });
			if (!tmpOk)
			{
				return;
			}
		}
		return fRemove();
	}

	/**
	 * Derive a read-only lifecycle badge from a join record's conventional date columns, so an expired
	 * (or not-yet-effective) association is obvious at a glance — e.g. an expired material↔producer link
	 * where the row would otherwise look identical to an active one. Zero-config: it keys off the
	 * `ExpirationDate` / `EffectiveDate` columns when present. Returns a one-or-zero-element slot.
	 * @param {Record<string, any>} pJoinRecord
	 * @return {Array<Record<string, any>>}
	 */
	_computeStatusBadge(pJoinRecord)
	{
		const tmpJoin = pJoinRecord || {};
		const fParseDate = (pValue) =>
		{
			if (!pValue) { return null; }
			const tmpString = String(pValue);
			if (tmpString.indexOf('0000-00-00') === 0) { return null; }
			const tmpDate = new Date(tmpString);
			return Number.isNaN(tmpDate.getTime()) ? null : tmpDate;
		};
		const tmpNow = new Date();
		const tmpExpiration = fParseDate(tmpJoin.ExpirationDate);
		if (tmpExpiration && (tmpExpiration.getTime() < tmpNow.getTime()))
		{
			return [ { Text: 'Expired', Class: 'is-expired', Title: `Expired ${ tmpExpiration.toLocaleDateString('en-US') }` } ];
		}
		const tmpEffective = fParseDate(tmpJoin.EffectiveDate);
		if (tmpEffective && (tmpEffective.getTime() > tmpNow.getTime()))
		{
			return [ { Text: 'Not yet effective', Class: 'is-pending', Title: `Effective ${ tmpEffective.toLocaleDateString('en-US') }` } ];
		}
		return [];
	}

	/**
	 * Shape an association's editable join-config fields into per-row render data (current value + the
	 * kind flags the row template dispatches on).
	 * @param {Array<Record<string, any>>} pFields - the association's JoinEditableFields.
	 * @param {Record<string, any>} pItem - one decorated association row (carries its JoinRecord).
	 * @return {Array<Record<string, any>>}
	 */
	_buildEditFields(pFields, pItem)
	{
		if (!Array.isArray(pFields) || pFields.length < 1)
		{
			return [];
		}
		const tmpJoin = pItem.JoinRecord || {};
		return pFields.map((pField) =>
		{
			const tmpType = pField.Type || 'text';
			const tmpRaw = tmpJoin[pField.Field];
			return {
				ViewHash: this.Hash,
				JoinID: pItem.JoinID,
				Field: pField.Field,
				Label: pField.Label || pField.Field,
				IsCheckbox: (tmpType === 'checkbox'),
				IsNumber: (tmpType === 'number'),
				IsSelect: (tmpType === 'select'),
				IsText: (tmpType === 'text'),
				CheckedAttr: ((tmpType === 'checkbox') && (tmpRaw === 1 || tmpRaw === true || tmpRaw === '1')) ? 'checked' : '',
				Value: (tmpRaw === undefined || tmpRaw === null) ? '' : tmpRaw,
				Options: (Array.isArray(pField.Options) ? pField.Options : []).map((pOption) =>
				{
					const tmpValue = (pOption && typeof pOption === 'object') ? pOption.Value : pOption;
					return { Value: tmpValue, Label: (pOption && typeof pOption === 'object') ? (pOption.Label || pOption.Value) : pOption, SelectedAttr: (`${tmpRaw}` === `${tmpValue}`) ? 'selected' : '' };
				}),
			};
		});
	}

	/**
	 * Persist one per-join config change (a "rich" join's editable column). Writes through to the join
	 * row in place so focus is kept; reverts to the server state on failure.
	 * @param {string|number} pJoinID @param {string} pField @param {any} pValue
	 * @return {Promise<void>}
	 */
	async updateField(pJoinID, pField, pValue)
	{
		const tmpItem = this._lastItems.find((pItem) => String(pItem.JoinID) === String(pJoinID));
		if (!tmpItem || !tmpItem.JoinRecord)
		{
			return;
		}
		// Meadow booleans are 1/0.
		const tmpValue = (pValue === true) ? 1 : ((pValue === false) ? 0 : pValue);
		try
		{
			await this.manager.updateJoin(this.options.AssociationHash, tmpItem.JoinRecord, { [pField]: tmpValue });
			tmpItem.JoinRecord[pField] = tmpValue;
		}
		catch (pError)
		{
			this.pict.log.error(`AssociationEditor [${this.Hash}]: failed to update join field ${pField}.`, pError);
			this._toast('Could not save the change.', 'error');
			await this.renderEditor();
		}
	}

	/**
	 * Seed the default associations for this anchor via the association's `SynthesizeDefaults` hook (the
	 * "Add defaults" button). PSRS dedupes + creates; the host decides what the defaults are. Reloads after.
	 * @return {Promise<void>}
	 */
	async synthesizeDefaults()
	{
		if (!this.manager.hasDefaultSynthesizer(this.options.AssociationHash))
		{
			return;
		}
		let tmpResult = { created: 0, skipped: 0 };
		try
		{
			tmpResult = await this.manager.synthesizeDefaults(this.options.AssociationHash, this.options.ThisRecordSet, this.options.ThisID);
		}
		catch (pError)
		{
			this.pict.log.error(`AssociationEditor [${this.Hash}]: synthesize defaults failed.`, pError);
			this._toast('Could not add the defaults.', 'error');
			return;
		}
		this._toast((tmpResult.created > 0) ? `Added ${tmpResult.created} default${tmpResult.created === 1 ? '' : 's'}.` : 'No new defaults to add.', (tmpResult.created > 0) ? 'success' : 'info');
		await this.renderEditor();
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

module.exports = viewRecordSetAssociationEditor;

module.exports.default_configuration = _DEFAULT_CONFIGURATION_AssociationEditor;
