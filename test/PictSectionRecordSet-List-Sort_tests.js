/*
	Unit tests for the record set list's OPT-IN column sort helpers (RecordSet-List-Sort.js): which columns are
	sortable (default off), parsing the active sort out of a FoxHound filter string, the header click-toggle
	cycle, and rewriting the filter string while preserving any active filter clauses. Pure logic, no browser.
*/

const Chai = require('chai');
const Expect = Chai.expect;

const libSort = require('../source/views/list/RecordSet-List-Sort.js');

suite
(
	'PictSectionRecordSet List Sort',
	() =>
	{
		suite('columnIsSortable — default off, opt in per list or per column', () =>
		{
			test('a column with no config is not sortable (default behavior unchanged)', () =>
			{
				Expect(libSort.columnIsSortable({}, { Key: 'Name' })).to.equal(false);
				Expect(libSort.columnIsSortable(undefined, { Key: 'Name' })).to.equal(false);
			});
			test('RecordSetListSortable:true makes every column sortable', () =>
			{
				Expect(libSort.columnIsSortable({ RecordSetListSortable: true }, { Key: 'Name' })).to.equal(true);
			});
			test('a column can opt out with Sortable:false even when the list is sortable', () =>
			{
				Expect(libSort.columnIsSortable({ RecordSetListSortable: true }, { Key: 'Name', Sortable: false })).to.equal(false);
			});
			test('a column can opt in with Sortable:true even when the list is not sortable', () =>
			{
				Expect(libSort.columnIsSortable({}, { Key: 'Name', Sortable: true })).to.equal(true);
			});
			test('a null column is never sortable', () =>
			{
				Expect(libSort.columnIsSortable({ RecordSetListSortable: true }, null)).to.equal(false);
			});
		});

		suite('parseSort — read the active sort from a filter string', () =>
		{
			test('null / empty / filter-only -> no sort', () =>
			{
				Expect(libSort.parseSort('')).to.equal(null);
				Expect(libSort.parseSort(null)).to.equal(null);
				Expect(libSort.parseSort('FBV~Name~LK~foo')).to.equal(null);
			});
			test('parses field + direction', () =>
			{
				Expect(libSort.parseSort('FSF~SizeBytes~DESC~0')).to.deep.equal({ Field: 'SizeBytes', Direction: 'DESC' });
				Expect(libSort.parseSort('FSF~Name~ASC~0')).to.deep.equal({ Field: 'Name', Direction: 'ASC' });
			});
			test('parses the sort out of a filter + sort combo', () =>
			{
				Expect(libSort.parseSort('FBV~Name~LK~foo~FSF~SizeBytes~DESC~0')).to.deep.equal({ Field: 'SizeBytes', Direction: 'DESC' });
			});
			test('handles a URI-encoded filter string', () =>
			{
				Expect(libSort.parseSort(encodeURIComponent('FSF~Name~ASC~0'))).to.deep.equal({ Field: 'Name', Direction: 'ASC' });
			});
		});

		suite('toggleSort — the three-state click cycle', () =>
		{
			test('unsorted / other column -> ASC', () =>
			{
				Expect(libSort.toggleSort(null, 'Name')).to.deep.equal({ Field: 'Name', Direction: 'ASC' });
				Expect(libSort.toggleSort({ Field: 'Other', Direction: 'DESC' }, 'Name')).to.deep.equal({ Field: 'Name', Direction: 'ASC' });
			});
			test('ASC -> DESC on the same column', () =>
			{
				Expect(libSort.toggleSort({ Field: 'Name', Direction: 'ASC' }, 'Name')).to.deep.equal({ Field: 'Name', Direction: 'DESC' });
			});
			test('DESC -> cleared (null)', () =>
			{
				Expect(libSort.toggleSort({ Field: 'Name', Direction: 'DESC' }, 'Name')).to.equal(null);
			});
		});

		suite('applySort — rewrite the filter string, preserving filters', () =>
		{
			test('adds a sort to an empty filter string', () =>
			{
				Expect(libSort.applySort('', { Field: 'SizeBytes', Direction: 'DESC' })).to.equal('FSF~SizeBytes~DESC~0');
			});
			test('replaces an existing sort', () =>
			{
				Expect(libSort.applySort('FSF~Name~ASC~0', { Field: 'SizeBytes', Direction: 'DESC' })).to.equal('FSF~SizeBytes~DESC~0');
			});
			test('clearing a sort (null) leaves an empty string', () =>
			{
				Expect(libSort.applySort('FSF~Name~ASC~0', null)).to.equal('');
			});
			test('preserves a filter clause while swapping the sort', () =>
			{
				Expect(libSort.applySort('FBV~Name~LK~foo~FSF~Name~ASC~0', { Field: 'SizeBytes', Direction: 'DESC' })).to.equal('FBV~Name~LK~foo~FSF~SizeBytes~DESC~0');
			});
			test('preserves a filter clause when clearing the sort', () =>
			{
				Expect(libSort.applySort('FBV~Name~LK~foo~FSF~Name~ASC~0', null)).to.equal('FBV~Name~LK~foo');
			});
		});
	}
);
