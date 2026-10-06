const ViewRecordSetSUBSETFilterBase = require('./RecordSet-Filter-Base');

/**
 * DistinctSelectedValueList — a dropdown/checkbox filter whose options ARE the distinct
 * values of a column on the CORE entity (no join), fetched from Meadow's
 * `<Entity>s/Distinct/<Column>` endpoint through the recordset provider's cached
 * `getRecordSetColumnDistinct()`. The clause's `Values` array holds the selection; pict's
 * Filter.js compiles it to an OR-chain of `FBVOR~<col>~EQ~<value>` stanzas inside one
 * paren group.
 *
 * Clause config:
 *   - FilterByColumn {string} - the core-entity column the options come from / filter on.
 *   - Options {Array<any>} - optional STATIC option list; when present the distinct fetch is skipped.
 *   - DistinctFilter {string} - optional FoxHound stanza appended as `/FilteredTo/<...>` on the
 *     distinct query (e.g. `FBV~Deleted~EQ~0` to keep soft-deleted rows' values out of the list).
 *
 * Selected values missing from the option list (e.g. restored from a saved filter experience
 * whose value no longer appears in the data) are unioned in so they stay visible and
 * un-checkable. Selection toggles by option INDEX, never by value — values can contain
 * quotes that would break inline onclick attributes.
 *
 * Staging only: toggling checkboxes mutates the live clause but does NOT fire a search —
 * the user commits with Apply / Search (the stage-then-Apply contract).
 */
const _DEFAULT_CONFIGURATION_Filter_DistinctSelectedValueList =
{
	ViewIdentifier: 'PRSP-FilterType-DistinctSelectedValueList',

	CSS: /*css*/`
.prsp-filter-distinct { min-width: 12rem; }
.prsp-filter-distinct-options { display: flex; flex-direction: column; gap: 0.15rem; max-height: 11rem; overflow-y: auto;
	padding: 0.35rem 0.5rem; border-radius: 8px; border: 1px solid var(--theme-color-border-default, #d7dce3);
	background: var(--theme-color-background-primary, #fff); }
.prsp-filter-distinct-option { display: flex; align-items: center; gap: 0.45rem; cursor: pointer;
	font-size: 0.92rem; color: var(--theme-color-text-primary, #1f2733); margin: 0; }
.prsp-filter-distinct-option input[type="checkbox"] { width: auto; margin: 0; cursor: pointer; }
.prsp-filter-distinct-note { font-size: 0.82rem; color: var(--theme-color-text-muted, #6b7686); padding: 0.15rem 0; }
`,

	Templates:
	[
		{
			Hash: 'PRSP-Filter-DistinctSelectedValueList-Template',
			Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-Filter-DistinctSelectedValueList-Template] -->
	<div class="prsp-filter-distinct">
		<label>{~D:Record.Label~}</label>
		<div class="prsp-filter-distinct-options">
			{~TS:PRSP-Filter-Distinct-Loading:Record.DistinctLoading~}
			{~TS:PRSP-Filter-Distinct-Empty:Record.DistinctEmpty~}
			{~TSWP:PRSP-Filter-Distinct-Option:Record.DistinctOptions:Record~}
		</div>
	</div>
	<!-- DefaultPackage end view template: [PRSP-Filter-DistinctSelectedValueList-Template] -->
`
		},
		{
			Hash: 'PRSP-Filter-Distinct-Option',
			Template: /*html*/`
	<label class="prsp-filter-distinct-option">
		<input type="checkbox" {~D:Record.Data.CheckedAttribute~}
			onchange="_Pict.views['PRSP-FilterType-DistinctSelectedValueList'].toggleOption(event, '{~D:Record.Payload.ClauseAddress~}', '{~D:Record.Payload.Hash~}', {~D:Record.Data.OptionIndex~})">
		<span>{~D:Record.Data.Text~}</span>
	</label>
`
		},
		{
			Hash: 'PRSP-Filter-Distinct-Loading',
			Template: /*html*/`
	<span class="prsp-filter-distinct-note">Loading values…</span>
`
		},
		{
			Hash: 'PRSP-Filter-Distinct-Empty',
			Template: /*html*/`
	<span class="prsp-filter-distinct-note">No values available.</span>
`
		},
	],
};

class ViewRecordSetSUBSETFilterDistinctSelectedValueList extends ViewRecordSetSUBSETFilterBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

	getFilterFormTemplate()
	{
		return 'PRSP-Filter-DistinctSelectedValueList-Template';
	}

	/**
	 * The ordered raw option values for a clause: the static `Options` list when configured,
	 * else the provider's cached distinct values, with any selected values missing from the
	 * list unioned onto the end.
	 *
	 * @param {Record<string, any>} pClause
	 * @param {Record<string, any>} pProvider - The recordset provider (`RSP-Provider-<RecordSet>`).
	 * @return {Array<any>}
	 */
	_optionValues(pClause, pProvider)
	{
		let tmpValues = Array.isArray(pClause.Options) ? pClause.Options.slice() : null;
		if (!tmpValues)
		{
			const tmpCacheKey = this._distinctCacheKey(pClause, pProvider);
			const tmpCached = (pProvider && pProvider._scopeDistinctCache) ? pProvider._scopeDistinctCache[tmpCacheKey] : null;
			tmpValues = Array.isArray(tmpCached) ? tmpCached.slice() : [];
		}
		if (Array.isArray(pClause.Values))
		{
			for (const tmpSelected of pClause.Values)
			{
				if (!tmpValues.some((pValue) => pValue === tmpSelected))
				{
					tmpValues.push(tmpSelected);
				}
			}
		}
		return tmpValues;
	}

	/**
	 * This clause's static `DistinctFilter` narrowed by the current selection of every field named
	 * in `CascadeFrom` — the same rule the quick-filter bar applies, so the drawer control and the
	 * quick control always offer the same option list for a field. A parent with nothing selected
	 * narrows nothing.
	 *
	 * @param {Record<string, any>} pClause @param {Record<string, any>} pProvider
	 * @return {string} The FoxHound filter stanza chain, or '' for no filter.
	 */
	_resolveDistinctFilter(pClause, pProvider)
	{
		let tmpFilter = pClause.DistinctFilter || '';
		const tmpParentFields = Array.isArray(pClause.CascadeFrom) ? pClause.CascadeFrom : [];
		if ((tmpParentFields.length === 0) || !pProvider || (typeof pProvider.getQuickFilterEntityValue !== 'function'))
		{
			return tmpFilter;
		}
		for (const tmpParentField of tmpParentFields)
		{
			const tmpValues = pProvider.getQuickFilterEntityValue(tmpParentField);
			if (!Array.isArray(tmpValues) || (tmpValues.length === 0)) { continue; }
			// A value carrying a comma would split the IN list, so those are skipped.
			const tmpUsable = tmpValues.filter((pValue) => String(pValue).indexOf(',') === -1);
			if (tmpUsable.length === 0) { continue; }
			tmpFilter += `${tmpFilter ? '~' : ''}FBL~${tmpParentField}~INN~${tmpUsable.join(',')}`;
		}
		return tmpFilter;
	}

	/**
	 * The provider cache key for this clause's distinct values. The resolved filter is part of the
	 * key, so each parent selection caches on its own and going back to a previous one is instant.
	 *
	 * @param {Record<string, any>} pClause @param {Record<string, any>} pProvider
	 * @return {string}
	 */
	_distinctCacheKey(pClause, pProvider)
	{
		const tmpFilter = this._resolveDistinctFilter(pClause, pProvider);
		return tmpFilter ? `${pClause.FilterByColumn}::${tmpFilter}` : pClause.FilterByColumn;
	}

	/**
	 * Map the option values to render rows ({ Text, OptionIndex, CheckedAttribute }).
	 *
	 * @param {Record<string, any>} pClause
	 * @param {Record<string, any>} pProvider
	 * @return {Array<{ Text: string, OptionIndex: number, CheckedAttribute: string }>}
	 */
	_composeOptionList(pClause, pProvider)
	{
		const tmpSelected = Array.isArray(pClause.Values) ? pClause.Values : [];
		return this._optionValues(pClause, pProvider).map((pValue, pIndex) => (
		{
			Text: String(pValue),
			OptionIndex: pIndex,
			CheckedAttribute: tmpSelected.some((pSelectedValue) => pSelectedValue === pValue) ? 'checked' : '',
		}));
	}

	/**
	 * @param {Record<string, any>} pRecord
	 */
	prepareRecord(pRecord)
	{
		super.prepareRecord(pRecord);

		const tmpProvider = this.pict.providers['RSP-Provider-' + pRecord.RecordSet];
		pRecord.DistinctLoading = [];
		// No static Options: make sure the distinct values are fetched (cached on the provider),
		// re-rendering just this clause's container once they resolve. Errored fetches cache []
		// so this can't loop.
		if (!Array.isArray(pRecord.Options) && pRecord.FilterByColumn
			&& tmpProvider && typeof tmpProvider.getRecordSetColumnDistinct === 'function')
		{
			const tmpCacheKey = this._distinctCacheKey(pRecord, tmpProvider);
			if (!tmpProvider._scopeDistinctCache || !Array.isArray(tmpProvider._scopeDistinctCache[tmpCacheKey]))
			{
				pRecord.DistinctLoading = [ {} ];
				const tmpClauseAddress = pRecord.ClauseAddress;
				const tmpClauseHash = pRecord.Hash;
				tmpProvider.getRecordSetColumnDistinct(pRecord.FilterByColumn, { Filter: this._resolveDistinctFilter(pRecord, tmpProvider) },
					() => this._reRenderClause(tmpClauseAddress, tmpClauseHash));
			}
		}
		pRecord.DistinctOptions = this._composeOptionList(pRecord, tmpProvider);
		pRecord.DistinctEmpty = (pRecord.DistinctLoading.length === 0 && pRecord.DistinctOptions.length === 0) ? [ {} ] : [];
	}

	/**
	 * Toggle an option's membership in the live clause's `Values` by option index. Staging
	 * only — the search fires on Apply / Search, not here.
	 *
	 * @param {Event} pEvent
	 * @param {string} pClauseInformaryAddress
	 * @param {string} pClauseHash
	 * @param {number} pOptionIndex
	 */
	toggleOption(pEvent, pClauseInformaryAddress, pClauseHash, pOptionIndex)
	{
		const tmpClause = this.getInformaryScopedValue(pClauseInformaryAddress);
		if (!tmpClause)
		{
			this.pict.log.error(`[Filter-DistinctSelectedValueList] No clause found for address: ${pClauseInformaryAddress}`);
			return;
		}
		const tmpProvider = this.pict.providers['RSP-Provider-' + tmpClause.RecordSet];
		const tmpOptionValues = this._optionValues(tmpClause, tmpProvider);
		if (pOptionIndex < 0 || pOptionIndex >= tmpOptionValues.length)
		{
			return;
		}
		const tmpValue = tmpOptionValues[pOptionIndex];
		if (!Array.isArray(tmpClause.Values))
		{
			tmpClause.Values = [];
		}
		const tmpSelectedIndex = tmpClause.Values.findIndex((pSelectedValue) => pSelectedValue === tmpValue);
		if (tmpSelectedIndex >= 0)
		{
			tmpClause.Values.splice(tmpSelectedIndex, 1);
		}
		else
		{
			tmpClause.Values.push(tmpValue);
		}
		this._reRenderClause(pClauseInformaryAddress, pClauseHash);
	}

	/**
	 * Re-render this clause's container (the checkbox list repaints on toggle / fetch resolve).
	 *
	 * @param {string} pClauseInformaryAddress
	 * @param {string} pClauseHash
	 */
	_reRenderClause(pClauseInformaryAddress, pClauseHash)
	{
		const tmpClause = this.getInformaryScopedValue(pClauseInformaryAddress);
		if (!tmpClause)
		{
			return;
		}
		const tmpRecord = Object.assign({ ClauseAddress: pClauseInformaryAddress }, tmpClause);
		this.prepareRecord(tmpRecord);
		this.render(null, `#PRSP_Filter_Container_${pClauseHash}`, tmpRecord);
	}
}

module.exports = ViewRecordSetSUBSETFilterDistinctSelectedValueList;

module.exports.default_configuration = Object.assign({}, ViewRecordSetSUBSETFilterBase.default_configuration, _DEFAULT_CONFIGURATION_Filter_DistinctSelectedValueList);
