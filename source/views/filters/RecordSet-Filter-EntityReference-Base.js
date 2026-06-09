const ViewRecordSetSUBSETFilterBase = require('./RecordSet-Filter-Base');

/**
 * Shared base for the four entity-reference filter types — Internal/External join × single/list.
 *
 * These were ~95% duplicate views, each with the same bespoke "search results | selection" table UI
 * and identical search/add/remove logic. This base consolidates all of it. Subclasses supply only the
 * two seams that actually differ:
 *   - `getSearchEntity(pClause)` — internal join searches `RemoteTable`, external `ExternalFilterByTable`.
 *   - `isMultiSelect()` — the `…List` variants append; the plain `…SelectedValue` variants replace.
 *
 * Rendering uses the same mechanism as before (the input template is emitted during the clause's
 * template parse, via `getFilterFormTemplate()`), so the consolidation is behavior-preserving. The
 * input template is itself a seam (`getEntityInputTemplate()`) so a host can swap the table UI for a
 * picker-backed input (a pict-section-form `Picker` InputType) without the module changing.
 *
 * Host-injected contextual scoping rides through `getContextScopeFilter(pClause)` — extra FoxHound
 * stanzas AND-applied to the entity search (project / spec-year / …). The module never learns what
 * those contexts mean; the host overrides the hook to read its own app state.
 */
const _DEFAULT_CONFIGURATION_EntityReference =
{
	ViewIdentifier: 'PRSP-FilterType-EntityReference-Base',

	// When set (by a host), entity clauses delegate their input to this pict-section-form InputType
	// (rendered via {~IWVDA:PSRSFilterProxyView:Record.ClauseDescriptor~}) instead of the built-in
	// table UI — e.g. 'Picker' to use pict-section-picker. Default false → the table UI.
	EntityInputType: false,

	Templates:
	[
		{
			// Table UI (default). Two cells: live search results | current selection.
			Hash: 'PRSP-Filter-EntityRef-Table',
			Template: /*html*/`
	<table><tbody><tr>
		<td valign="top">{~T:PRSP-Filter-EntityRef-SearchResults~}</td>
		<td valign="top">{~T:PRSP-Filter-EntityRef-SelectedValues~}</td>
	</tr></tbody></table>
`
		},
		{
			// Picker / form-input delegation (opt-in via EntityInputType). Renders one dynamic input
			// on the shared PSRSFilterProxyView from the clause's ClauseDescriptor (whose PictForm
			// InputType is stamped in prepareRecord). Bound to the clause's Values address.
			Hash: 'PRSP-Filter-EntityRef-Input',
			Template: /*html*/`
	{~IWVDA:PSRSFilterProxyView:Record.ClauseDescriptor~}
`
		},
		{
			Hash: 'PRSP-Filter-EntityRef-SearchResults',
			Template: /*html*/`
	<form id="PRSP_Filter_{~D:Record.Hash~}_Search_Form" onsubmit="_Pict.views['{~D:Context[0].Hash~}'].performSearch(event, '{~D:Record.ClauseAddress~}', '{~D:Record.Hash~}'); return false;">
		<input id="PRSP_Filter_{~D:Record.Hash~}_Search_Value" type="text" placeholder="Search..." value="{~D:Record.SearchInputValue~}" />
		<button type="submit" id="PRSP_Filter_{~D:Record.Hash~}_Button_Search" onclick="_Pict.views['{~D:Context[0].Hash~}'].performSearch(event, '{~D:Record.ClauseAddress~}', '{~D:Record.Hash~}')">Search</button>
	</form>
	<table>
		<thead><tr><th colspan="2">{~D:Record.Label~}</th></tr></thead>
		<tbody>{~TSWP:PRSP-Filter-EntityRef-SearchResults-Entry:Record.SearchResults:Record~}</tbody>
	</table>
	<button type="button" id="PRSP_Filter_{~D:Record.Hash~}_Button_LoadMore" class="is-hidden" onclick="_Pict.views['{~D:Context[0].Hash~}'].loadMore(event, '{~D:Record.ClauseAddress~}', '{~D:Record.Hash~}', {~D:Record.SearchResultsOffset:0~})">Load More</button>
`
		},
		{
			Hash: 'PRSP-Filter-EntityRef-SelectedValues',
			Template: /*html*/`
	<table>
		<thead><tr><th colspan="2">Selection</th></tr></thead>
		<tbody>{~TSWP:PRSP-Filter-EntityRef-SelectedValues-Entry:Record.SelectedValues:Record~}</tbody>
	</table>
`
		},
		{
			Hash: 'PRSP-Filter-EntityRef-SearchResults-Entry',
			Template: /*html*/`
	<tr><td><button onclick="_Pict.views['{~D:Context[0].Hash~}'].handleAdd(event, {~DVBK:Record.Data:Record.Payload.ExternalFilterTableLookupColumn~}, '{~D:Record.Payload.ClauseAddress~}', '{~D:Record.Payload.Hash~}')">Select</button></td><td>{~TFA:Record.Payload.ExternalRecordDisplayTemplate:Record~}</td></tr>
`
		},
		{
			Hash: 'PRSP-Filter-EntityRef-SelectedValues-Entry',
			Template: /*html*/`
	<tr><td><button onclick="_Pict.views['{~D:Context[0].Hash~}'].handleRemove(event, {~DVBK:Record.Data:Record.Payload.ExternalFilterTableLookupColumn~}, '{~D:Record.Payload.ClauseAddress~}', '{~D:Record.Payload.Hash~}')">Remove</button></td><td>{~TFA:Record.Payload.ExternalRecordDisplayTemplate:Record~}</td></tr>
`
		},
	],
};

class ViewRecordSetSUBSETFilterEntityReferenceBase extends ViewRecordSetSUBSETFilterBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		if (!pOptions.PageSize)
		{
			pOptions.PageSize = 15;
		}
		super(pFable, pOptions, pServiceHash);
	}

	// --- Seams the subclasses override (the only real differences between the 4 types) ---

	/** @param {Record<string, any>} pClause @return {string} The entity to search (RemoteTable / ExternalFilterByTable). */
	getSearchEntity(pClause)
	{
		return pClause.RemoteTable || pClause.ExternalFilterByTable;
	}

	/** @param {Record<string, any>} pClause @return {string} The value/ID column on the searched entity. */
	getLookupColumn(pClause)
	{
		return pClause.ExternalFilterTableLookupColumn || `ID${this.getSearchEntity(pClause)}`;
	}

	/** @return {boolean} True for the `…List` (multi-select) variants. */
	isMultiSelect()
	{
		return true;
	}

	/**
	 * Host-injectable contextual search scope. Returns extra FoxHound filter stanza(s) AND-applied to
	 * the entity search (e.g. "only this project's line items"). Default: the clause's static
	 * `ContextScopeFilter` if any, else none. Hosts override this to read app state — the module never
	 * learns what a "project" or "spec year" is.
	 *
	 * @param {Record<string, any>} pClause @return {string|Array<string>}
	 */
	getContextScopeFilter(pClause)
	{
		// ScopeToRecordSet knob: scope the entity search to the values present in the recordset's
		// data (FBL~<col>~INN~<distinct>), fetched + cached on the recordset provider. The first
		// search may be unscoped until the fetch resolves; subsequent searches are scoped.
		if (pClause && pClause.ScopeToRecordSet && pClause.FilterByColumn)
		{
			const tmpProvider = this.pict.providers['RSP-Provider-' + pClause.RecordSet];
			if (tmpProvider && typeof tmpProvider.getRecordSetColumnDistinct === 'function')
			{
				if (!tmpProvider._scopeDistinctCache || !Array.isArray(tmpProvider._scopeDistinctCache[pClause.FilterByColumn]))
				{
					tmpProvider.getRecordSetColumnDistinct(pClause.FilterByColumn, () => {});
				}
				const tmpVals = (tmpProvider._scopeDistinctCache || {})[pClause.FilterByColumn];
				if (Array.isArray(tmpVals) && tmpVals.length > 0)
				{
					return `FBL~${pClause.FilterByColumn}~INN~${tmpVals.join(',')}`;
				}
			}
		}
		return pClause.ContextScopeFilter || '';
	}

	/** @return {string} The template hash for the clause's value input (table UI, or the opt-in delegated input). */
	getFilterFormTemplate()
	{
		return this.options.EntityInputType ? 'PRSP-Filter-EntityRef-Input' : 'PRSP-Filter-EntityRef-Table';
	}

	/** @param {Record<string, any>} pRecord */
	prepareRecord(pRecord)
	{
		super.prepareRecord(pRecord);

		pRecord.ClauseDescriptor.PictForm = Object.assign({}, pRecord.PictForm);
		if (this.options.EntityInputType)
		{
			// Delegated input: a csv string round-trips through the informary at `.StringArrayValue`,
			// while the picker adapter writes the real ARRAY to `.Values` (what Filter.js reads) via
			// ValueArrayAddress. Keeping the informary off `.Values` avoids a Number field defaulting it
			// to "0". The descriptor also carries everything the picker needs + the contextual scope hook.
			pRecord.ClauseDescriptor.Address = pRecord.ClauseAddress + '.StringArrayValue';
			pRecord.ClauseDescriptor.DataType = 'String';
			pRecord.ClauseDescriptor.PictForm.InputType = pRecord.ClauseDescriptor.PictForm.InputType || this.options.EntityInputType;
			pRecord.ClauseDescriptor.PictForm.Entity = pRecord.ClauseDescriptor.PictForm.Entity || this.getSearchEntity(pRecord);
			pRecord.ClauseDescriptor.PictForm.ValueField = pRecord.ClauseDescriptor.PictForm.ValueField || this.getLookupColumn(pRecord);
			pRecord.ClauseDescriptor.PictForm.Multiple = this.isMultiSelect();
			pRecord.ClauseDescriptor.PictForm.SearchFields = pRecord.ClauseDescriptor.PictForm.SearchFields
				|| pRecord.ExternalFilterByColumns || (pRecord.ExternalFilterByColumn ? [ pRecord.ExternalFilterByColumn ] : [ 'Name' ]);
			// Composed, disambiguated option/chip label (the entity's "list entry" template); falls back to a
			// single display field when unset.
			pRecord.ClauseDescriptor.PictForm.TextTemplate = pRecord.ClauseDescriptor.PictForm.TextTemplate || pRecord.EntityListEntryTemplate;
			pRecord.ClauseDescriptor.PictForm.ValueArrayAddress = pRecord.ClauseValuesAddress;
			pRecord.ClauseDescriptor.PictForm.GetContextScopeFilter = () => this.getContextScopeFilter(this.getInformaryScopedValue(pRecord.ClauseAddress) || pRecord);
			// JoinEntity compound display (host opt-in on the clause): show each searched row joined to a
			// parent entity's field — e.g. a LineItem disambiguated by its Project. The picker fetch-then-
			// merges the join (Meadow can't join in one read). Forwarded straight through; no-op when unset.
			if (pRecord.JoinEntity || pRecord.ClauseDescriptor.PictForm.JoinEntity)
			{
				const tmpPF = pRecord.ClauseDescriptor.PictForm;
				tmpPF.JoinEntity = tmpPF.JoinEntity || pRecord.JoinEntity;
				tmpPF.JoinField = tmpPF.JoinField || pRecord.JoinField;
				tmpPF.JoinEntityValueField = tmpPF.JoinEntityValueField || pRecord.JoinEntityValueField;
				tmpPF.JoinEntityDisplayField = tmpPF.JoinEntityDisplayField || pRecord.JoinEntityDisplayField;
				if (tmpPF.JoinEntityFirst === undefined && pRecord.JoinEntityFirst !== undefined) { tmpPF.JoinEntityFirst = pRecord.JoinEntityFirst; }
				if (tmpPF.JoinSeparator === undefined && pRecord.JoinSeparator !== undefined) { tmpPF.JoinSeparator = pRecord.JoinSeparator; }
			}
			// Saved-filter seeding: mirror the live clause's Values array into the csv `.StringArrayValue`
			// the input reads, so a reloaded/persisted filter shows its current selections on render.
			const tmpLiveClause = this.getInformaryScopedValue(pRecord.ClauseAddress);
			if (tmpLiveClause && Array.isArray(tmpLiveClause.Values))
			{
				tmpLiveClause.StringArrayValue = tmpLiveClause.Values.join(',');
			}
		}
		else
		{
			pRecord.ClauseDescriptor.DataType = pRecord.DataType || 'Number';
		}
		if (!pRecord.ExternalFilterTableLookupColumn)
		{
			pRecord.ExternalFilterTableLookupColumn = this.getLookupColumn(pRecord);
		}
		if (!pRecord.SearchResults) { pRecord.SearchResults = []; }
		if (!pRecord.SelectedValues) { pRecord.SelectedValues = []; }
	}

	// --- Table UI search/select methods (consolidated from the 4 legacy views) ---

	loadMore(pEvent, pClauseInformaryAddress, pClauseHash, pCurrentOffset = 0)
	{
		this.performSearch(pEvent, pClauseInformaryAddress, pClauseHash, pCurrentOffset + this.options.PageSize);
	}

	performSearch(pEvent, pClauseInformaryAddress, pClauseHash, pOffset = 0)
	{
		if (pEvent) { pEvent.preventDefault(); }
		const tmpClause = this.getInformaryScopedValue(pClauseInformaryAddress);
		if (!tmpClause)
		{
			this.pict.log.error(`[Filter-EntityReference] No clause found for address: ${pClauseInformaryAddress}`);
			return;
		}
		tmpClause.SearchResultsOffset = pOffset;
		const tmpSearchInputValue = pOffset > 0 ? tmpClause.SearchInputValue : this.pict.ContentAssignment.readContent(`#PRSP_Filter_${tmpClause.Hash}_Search_Value`);
		tmpClause.SearchInputValue = tmpSearchInputValue;
		if (!tmpSearchInputValue)
		{
			tmpClause.SearchResults = [];
			tmpClause.LoadMoreEnabled = false;
			this._reRenderClause(tmpClause, pClauseInformaryAddress, pClauseHash);
			return;
		}
		const tmpFilterByColumns = tmpClause.ExternalFilterByColumns || (tmpClause.ExternalFilterByColumn ? [ tmpClause.ExternalFilterByColumn ] : [ 'Name' ]);
		const tmpSearchStanza = tmpFilterByColumns.map((pColumn) => `FBVOR~${pColumn}~LK~${encodeURIComponent(`%${tmpSearchInputValue}%`)}`).join('~');
		const tmpScope = this.getContextScopeFilter(tmpClause);
		const tmpScopeStanza = Array.isArray(tmpScope) ? tmpScope.filter(Boolean).join('~') : tmpScope;
		const tmpMeadowFilter = [ tmpScopeStanza, tmpSearchStanza ].filter(Boolean).join('~');
		this.pict.EntityProvider.gatherDataFromServer(
			[
				{
					Entity: this.getSearchEntity(tmpClause),
					Filter: tmpMeadowFilter,
					Destination: pOffset > 0 ? `${this.getInformaryAddressPrefix()}${pClauseInformaryAddress}.SearchResultsAppend` : `${this.getInformaryAddressPrefix()}${pClauseInformaryAddress}.SearchResults`,
					RecordStartCursor: pOffset,
					PageSize: this.options.PageSize,
					URLPrefix: tmpClause.URLPrefix,
				}
			],
			() =>
			{
				if (pOffset > 0 && tmpClause.SearchResultsAppend?.length > 0)
				{
					tmpClause.SearchResults = tmpClause.SearchResults.concat(tmpClause.SearchResultsAppend);
				}
				const tmpLoadedRecords = pOffset > 0 ? tmpClause.SearchResultsAppend : tmpClause.SearchResults;
				delete tmpClause.SearchResultsAppend;
				tmpClause.SearchResultsOffset = pOffset;
				tmpClause.LoadMoreEnabled = tmpLoadedRecords && tmpLoadedRecords.length >= this.options.PageSize;
				this._reRenderClause(tmpClause, pClauseInformaryAddress, pClauseHash);
				if (tmpClause.LoadMoreEnabled)
				{
					this.pict.ContentAssignment.removeClass(`#PRSP_Filter_${tmpClause.Hash}_Button_LoadMore`, 'is-hidden');
				}
			});
	}

	handleAdd(pEvent, pRecordLookupValue, pClauseInformaryAddress, pClauseHash)
	{
		if (pEvent) { pEvent.preventDefault(); }
		const tmpClause = this.getInformaryScopedValue(pClauseInformaryAddress);
		if (!tmpClause) { return; }
		const tmpRecordLookupColumn = this.getLookupColumn(tmpClause);
		const tmpRecordToAdd = (tmpClause.SearchResults || []).find((pRow) => pRow[tmpRecordLookupColumn] == pRecordLookupValue);
		if (!tmpRecordToAdd) { return; }
		const tmpValue = tmpRecordToAdd[tmpRecordLookupColumn];
		if (tmpValue == null) { return; }
		if (!tmpClause.SelectedValues) { tmpClause.SelectedValues = []; }
		if (!tmpClause.Values) { tmpClause.Values = []; }
		if (this.isMultiSelect())
		{
			if (tmpClause.SelectedValues.some((pSV) => pSV[tmpRecordLookupColumn] == pRecordLookupValue)) { return; }
			tmpClause.SelectedValues.push(tmpRecordToAdd);
			if (!tmpClause.Values.some((pV) => pV == tmpValue)) { tmpClause.Values.push(tmpValue); }
		}
		else
		{
			tmpClause.SelectedValues = [ tmpRecordToAdd ];
			tmpClause.Values = [ tmpValue ];
		}
		this._reRenderClause(tmpClause, pClauseInformaryAddress, pClauseHash);
	}

	handleRemove(pEvent, pRecordLookupValue, pClauseInformaryAddress, pClauseHash)
	{
		if (pEvent) { pEvent.preventDefault(); }
		const tmpClause = this.getInformaryScopedValue(pClauseInformaryAddress);
		if (!tmpClause) { return; }
		const tmpRecordLookupColumn = this.getLookupColumn(tmpClause);
		const tmpIndex = (tmpClause.SelectedValues || []).findIndex((pRow) => pRow[tmpRecordLookupColumn] == pRecordLookupValue);
		if (tmpIndex < 0) { return; }
		const tmpRemoved = tmpClause.SelectedValues.splice(tmpIndex, 1)[0];
		const tmpValue = tmpRemoved[tmpRecordLookupColumn];
		tmpClause.Values = (tmpClause.Values || []).filter((pV) => pV !== tmpValue);
		this._reRenderClause(tmpClause, pClauseInformaryAddress, pClauseHash);
	}

	/** Re-render a clause's container (the table UI re-paints on every search / add / remove). */
	_reRenderClause(pClause, pClauseInformaryAddress, pClauseHash)
	{
		const tmpRecord = Object.assign({ ClauseAddress: pClauseInformaryAddress }, pClause);
		this.prepareRecord(tmpRecord);
		this.render(null, `#PRSP_Filter_Container_${pClauseHash}`, tmpRecord);
	}
}

module.exports = ViewRecordSetSUBSETFilterEntityReferenceBase;

module.exports.default_configuration = Object.assign({}, ViewRecordSetSUBSETFilterBase.default_configuration, _DEFAULT_CONFIGURATION_EntityReference);
