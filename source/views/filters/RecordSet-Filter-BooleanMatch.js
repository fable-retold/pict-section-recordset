const ViewRecordSetSUBSETFilterBase = require('./RecordSet-Filter-Base');

/**
 * BooleanMatch — a Yes / No filter for boolean columns. A boolean is stored as 0/1, so under
 * the hood the clause is an exact NumericMatch (`Type: 'NumericMatch'`, `ExactMatch: true`),
 * which pict's Filter.js compiles to `FBV(OR)~<col>~EQ~<0|1>` with no new compile-path type.
 * The clause only differs in how it is *rendered*: the generator tags it
 * `FilterRenderType: 'BooleanMatch'` so the FilterInstanceViews template routes it here (a
 * Yes/No <select>) instead of the numeric text box — see Pict-Template-FilterInstanceViews.
 *
 * Staging only: changing the dropdown mutates the live clause's `Values` but does NOT fire a
 * search — the user commits with Apply / Search (the stage-then-Apply contract, matching the
 * other filter views).
 */
const _DEFAULT_CONFIGURATION_Filter_BooleanMatch =
{
	ViewIdentifier: 'PRSP-FilterType-BooleanMatch',

	CSS: /*css*/`
.prsp-filter-boolean { min-width: 8rem; }
`,

	Templates:
	[
		{
			Hash: 'PRSP-Filter-BooleanMatch-Template',
			Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-Filter-BooleanMatch-Template] -->
	<div class="prsp-filter-boolean">
		<label>{~D:Record.Label~}</label>
		<select aria-label="{~D:Record.Label~}"
			onchange="_Pict.views['PRSP-FilterType-BooleanMatch'].selectValue(event, '{~D:Record.ClauseAddress~}', '{~D:Record.Hash~}', this.value)">
			<option value="" {~D:Record.BooleanAnySelected~}>Any</option>
			<option value="1" {~D:Record.BooleanYesSelected~}>Yes</option>
			<option value="0" {~D:Record.BooleanNoSelected~}>No</option>
		</select>
	</div>
	<!-- DefaultPackage end view template: [PRSP-Filter-BooleanMatch-Template] -->
`
		}
	],
};

class ViewRecordSetSUBSETFilterBooleanMatch extends ViewRecordSetSUBSETFilterBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

	/**
	 * @param {Record<string, any>} pRecord
	 */
	prepareRecord(pRecord)
	{
		super.prepareRecord(pRecord);

		// The current selection comes off the live clause's Values (Value as a fallback for
		// clauses restored from an older-shaped filter experience). '' => Any (no constraint).
		const tmpCurrent = (Array.isArray(pRecord.Values) && (pRecord.Values.length > 0)) ? String(pRecord.Values[0])
			: ((pRecord.Value !== undefined && pRecord.Value !== null) ? String(pRecord.Value) : '');
		pRecord.BooleanAnySelected = (tmpCurrent === '') ? 'selected' : '';
		pRecord.BooleanYesSelected = (tmpCurrent === '1') ? 'selected' : '';
		pRecord.BooleanNoSelected = (tmpCurrent === '0') ? 'selected' : '';
	}

	getFilterFormTemplate()
	{
		return 'PRSP-Filter-BooleanMatch-Template';
	}

	/**
	 * Stage the Yes/No selection onto the live clause. '' clears the constraint (Any); '1'/'0'
	 * set an exact match. Staging only — the search fires on Apply / Search, not here.
	 *
	 * @param {Event} pEvent
	 * @param {string} pClauseInformaryAddress
	 * @param {string} pClauseHash
	 * @param {string} pValue - '' | '1' | '0'
	 */
	selectValue(pEvent, pClauseInformaryAddress, pClauseHash, pValue)
	{
		const tmpClause = this.getInformaryScopedValue(pClauseInformaryAddress);
		if (!tmpClause)
		{
			this.pict.log.error(`[Filter-BooleanMatch] No clause found for address: ${pClauseInformaryAddress}`);
			return;
		}
		if (pValue === '' || pValue === null || pValue === undefined)
		{
			tmpClause.Values = [];
			delete tmpClause.Value;
		}
		else
		{
			tmpClause.Values = [ pValue ];
			tmpClause.Value = pValue;
		}
	}
}

module.exports = ViewRecordSetSUBSETFilterBooleanMatch;

module.exports.default_configuration = Object.assign({}, ViewRecordSetSUBSETFilterBase.default_configuration, _DEFAULT_CONFIGURATION_Filter_BooleanMatch);
