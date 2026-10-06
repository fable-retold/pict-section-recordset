/*
	A date-range quick filter seeded to a trailing window on first use.

	"Default to the last year" cannot be stored as a literal clause: a date baked
	in when the dashboard was authored means "365 days before the day someone ran
	the generator", and it rots silently. DefaultRelativeDays resolves against
	TODAY when the filter bar is built.

	The behaviour that matters is restraint — it must seed ONCE, and never over a
	value the user owns (an explicit pick, a deliberate clear, or a restored
	filter experience).
*/

const Chai   = require('chai');
const Expect = Chai.expect;

const libProviderBase = require('../source/providers/RecordSet-RecordProvider-Base.js');

/**
 * A provider stub exposing just the seams _seedRelativeDateDefaults touches.
 *
 * @param {number|undefined} pDefaultRelativeDays - Value on the clause descriptor.
 * @param {{Start:string, End:string}} [pCurrent] - Existing bounds.
 * @return {object} The stub.
 */
function providerStub(pDefaultRelativeDays, pCurrent)
{
	return {
		_SeededRelativeDates: {},
		upserts: [],
		current: pCurrent || { Start: '', End: '' },
		getFilterClauseSchemaForKey: () => ({ AvailableClauses: [ { ClauseKey: 'Date_Range', DefaultRelativeDays: pDefaultRelativeDays } ] }),
		getQuickFilterDateRangeValue: function() { return this.current; },
		// The REAL upsert, not a recorder. A stub here records whatever spelling the
		// caller happens to use and agrees with it, which is exactly how a
		// case-sensitivity bug shipped: the seeder passed 'Start', the real helper
		// compared against 'start', and the value landed on the END bound -- turning
		// "the last 365 days" into "everything before 365 days ago". The stub asserted
		// the caller's own spelling and saw nothing wrong. Drive the real code and
		// assert the resulting BOUNDS.
		upsertQuickFilterDateRange: function(pField, pClauseKey, pWhich, pValue)
		{
			this.upserts.push({ pField, pWhich, pValue });
			return libProviderBase.prototype.upsertQuickFilterDateRange.call(this, pField, pClauseKey, pWhich, pValue);
		},
		getFilterClauses: function() { return this.clauses; },
		clauses: [],
		_createQuickFilterClause: (pField, pClauseKey, pQuickFilterKey) => ({ QuickFilterKey: pQuickFilterKey, ClauseKey: pClauseKey, FilterByColumn: pField }),
		/** The bounds actually written, read back off the live clause. */
		boundsFor: function(pField)
		{
			const tmpClause = this.clauses.find((pClause) => pClause.QuickFilterKey === `Quick-${pField}`);
			return (tmpClause && tmpClause.Values) || {};
		},
		_seedRelativeDateDefaults: libProviderBase.prototype._seedRelativeDateDefaults,
	};
}

const DEFINITIONS = [ { Field: 'DateSampled', Control: 'daterange', ClauseKey: 'Date_Range' } ];

suite('RecordSet relative date default', () =>
{
	test('seeds Start to today minus the configured days', () =>
	{
		const tmpProvider = providerStub(365);
		tmpProvider._seedRelativeDateDefaults(DEFINITIONS);
		Expect(tmpProvider.upserts.length).to.equal(1);
		const tmpExpected = new Date();
		tmpExpected.setDate(tmpExpected.getDate() - 365);
		// Assert the BOUND that was written, not the argument that was passed.
		Expect(tmpProvider.boundsFor('DateSampled').Start).to.equal(tmpExpected.toISOString().slice(0, 10));
	});

	test('leaves the End bound alone — the window is open-ended forward', () =>
	{
		const tmpProvider = providerStub(365);
		tmpProvider._seedRelativeDateDefaults(DEFINITIONS);
		// The regression that shipped: the window landed on End, so the dashboard
		// filtered to everything BEFORE the cutoff instead of after it.
		const tmpBounds = tmpProvider.boundsFor('DateSampled');
		Expect(tmpBounds.End, 'End must stay open so the window runs forward to today').to.be.oneOf([ undefined, '' ]);
		Expect(tmpBounds.Start, 'Start carries the cutoff').to.be.a('string').and.not.equal('');
	});

	test('does NOT override a value the user already chose', () =>
	{
		const tmpProvider = providerStub(365, { Start: '2020-01-01', End: '' });
		tmpProvider._seedRelativeDateDefaults(DEFINITIONS);
		Expect(tmpProvider.upserts.length).to.equal(0);
	});

	test('does not re-seed after the user clears it', () =>
	{
		const tmpProvider = providerStub(365);
		tmpProvider._seedRelativeDateDefaults(DEFINITIONS);
		Expect(tmpProvider.upserts.length).to.equal(1);
		tmpProvider.current = { Start: '', End: '' };   // user cleared it
		tmpProvider._seedRelativeDateDefaults(DEFINITIONS);
		Expect(tmpProvider.upserts.length, 'still one — seeding is once per field').to.equal(1);
	});

	test('the helper routes either spelling of the bound to the same place', () =>
	{
		for (const tmpSpelling of [ 'start', 'Start', 'START' ])
		{
			const tmpProvider = providerStub(365);
			libProviderBase.prototype.upsertQuickFilterDateRange.call(tmpProvider, 'DateSampled', 'Date_Range', tmpSpelling, '2026-01-02');
			Expect(tmpProvider.boundsFor('DateSampled').Start, `'${tmpSpelling}' must set Start`).to.equal('2026-01-02');
			Expect(tmpProvider.boundsFor('DateSampled').End, `'${tmpSpelling}' must not set End`).to.be.oneOf([ undefined, '' ]);
		}
		for (const tmpSpelling of [ 'end', 'End' ])
		{
			const tmpProvider = providerStub(365);
			libProviderBase.prototype.upsertQuickFilterDateRange.call(tmpProvider, 'DateSampled', 'Date_Range', tmpSpelling, '2026-01-02');
			Expect(tmpProvider.boundsFor('DateSampled').End, `'${tmpSpelling}' must set End`).to.equal('2026-01-02');
		}
	});

	test('a filter without DefaultRelativeDays is untouched', () =>
	{
		const tmpProvider = providerStub(undefined);
		tmpProvider._seedRelativeDateDefaults(DEFINITIONS);
		Expect(tmpProvider.upserts.length).to.equal(0);
	});

	test('a non-daterange control is ignored', () =>
	{
		const tmpProvider = providerStub(365);
		tmpProvider._seedRelativeDateDefaults([ { Field: 'MixDesign', Control: 'distinct', ClauseKey: 'Date_Range' } ]);
		Expect(tmpProvider.upserts.length).to.equal(0);
	});

	test('a zero or nonsense window is ignored rather than seeding today', () =>
	{
		for (const tmpDays of [ 0, -5, 'soon', null ])
		{
			const tmpProvider = providerStub(tmpDays);
			tmpProvider._seedRelativeDateDefaults(DEFINITIONS);
			Expect(tmpProvider.upserts.length, `days ${JSON.stringify(tmpDays)}`).to.equal(0);
		}
	});
});
